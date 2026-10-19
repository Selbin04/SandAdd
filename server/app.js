import "dotenv/config";
import dns from "dns";
import express from "express";
import mongoose from "mongoose";
import projectRoutes from "./routes/projects.js";
import authRoutes, { requireAuth } from "./routes/auth.js";
import createLiveWorksRouter from "./routes/liveWorks.js";
import folderRoutes from "./routes/folders.js";
import createAiRoutes from "./routes/ai.js";

const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/hourglass";
let mongoConnectionPromise = null;

/**
 * Configure DNS fallback for Atlas SRV connection strings.
 * On Windows and certain ISP resolvers, default dns.resolveSrv can fail with querySrv ECONNREFUSED.
 * Never override DNS on Linux / Lambda / Vercel because custom DNS servers are restricted
 * and will break SRV resolution.
 */
function configureDns(uri) {
  if (process.env.VERCEL) return;
  if (process.platform === "win32" && uri && uri.startsWith("mongodb+srv://")) {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
    } catch {
      /* ignore if not supported in environment */
    }
  }
}

async function connectMongo(uri) {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoConnectionPromise) {
    configureDns(uri);
    const options = {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };
    if (process.env.MONGODB_DATABASE) {
      options.dbName = process.env.MONGODB_DATABASE;
    }
    mongoConnectionPromise = mongoose
      .connect(uri, options)
      .catch((error) => {
        mongoConnectionPromise = null;
        throw error;
      });
  }
  await mongoConnectionPromise;
}

mongoose.connection.on("disconnected", () => {
  mongoConnectionPromise = null;
});
mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err?.message || err);
  mongoConnectionPromise = null;
});

export async function createApp({ allowMemory = false } = {}) {
  const isVercel = Boolean(process.env.VERCEL);
  const production = process.env.NODE_ENV === "production" || isVercel;
  const mongoUri =
    process.env.MONGODB_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGODB_CONNECTION_STRING ||
    (production ? "" : LOCAL_MONGO_URI);
  let useMemory = false;

  try {
    if (!mongoUri) {
      throw new Error(
        "Missing MongoDB connection string. Please set MONGODB_URL in Vercel Project Settings > Environment Variables."
      );
    }
    await connectMongo(mongoUri);
    console.log("Connected to MongoDB successfully.");
  } catch (error) {
    if (!allowMemory || production) {
      throw new Error(`MongoDB is required to run the API: ${error.message}`);
    }
    useMemory = true;
    console.warn(
      "MongoDB unavailable; using local JSON storage for development.",
      error.message
    );
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "5mb" }));
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Reconnection assurance middleware for serverless/cold-start environments
  app.use(async (req, res, next) => {
    if (!useMemory && mongoUri && mongoose.connection.readyState !== 1) {
      try {
        await connectMongo(mongoUri);
      } catch (connErr) {
        console.error("MongoDB reconnection failed:", connErr.message);
        return res.status(503).json({
          error: "Database connection failed.",
          details: `${connErr.message}. Ensure 0.0.0.0/0 is whitelisted in MongoDB Atlas Network Access and MONGODB_URL is configured in Vercel.`,
        });
      }
    }
    next();
  });

  app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    next(err);
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      storage: useMemory ? "file" : "mongodb",
      mongoReadyState: mongoose.connection?.readyState,
      database: mongoose.connection?.name || "hourglass",
    });
  });

  app.use("/api/auth", authRoutes(useMemory));
  app.use("/api/projects", requireAuth(useMemory), projectRoutes(useMemory));
  app.use("/api/folders", requireAuth(useMemory), folderRoutes(useMemory));
  app.use(
    "/api/live-works",
    requireAuth(useMemory),
    createLiveWorksRouter(useMemory)
  );
  app.use("/api/ai", createAiRoutes());

  app.use((err, _req, res, _next) => {
    console.error("API request failed", err);
    if (res.headersSent) return;
    res.status(500).json({
      error: "Internal server error.",
      details: err?.message || String(err),
    });
  });

  return app;
}
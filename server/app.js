import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import projectRoutes from "./routes/projects.js";
import authRoutes, { requireAuth } from "./routes/auth.js";
import createLiveWorksRouter from "./routes/liveWorks.js";

const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/hourglass";
let mongoConnectionPromise = null;

async function connectMongo(uri) {
  if (mongoose.connection.readyState === 1) return;
  if (!mongoConnectionPromise) {
    const options = { serverSelectionTimeoutMS: 5000 };
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

export async function createApp({ allowMemory = false } = {}) {
  const production = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const mongoUri =
    process.env.MONGODB_URL ||
    process.env.MONGO_URI ||
    (production ? "" : LOCAL_MONGO_URI);
  let useMemory = false;

  try {
    if (!mongoUri) throw new Error("MONGO_URI is required in production.");
    await connectMongo(mongoUri);
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
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    next(err);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, storage: useMemory ? "file" : "mongodb" });
  });
  app.use("/api/auth", authRoutes(useMemory));
  app.use("/api/projects", requireAuth(useMemory), projectRoutes(useMemory));
  app.use(
    "/api/live-works",
    requireAuth(useMemory),
    createLiveWorksRouter(useMemory)
  );
  app.use((err, _req, res, _next) => {
    console.error("API request failed", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error." });
  });
  return app;
}
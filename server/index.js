import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import projectRoutes from "./routes/projects.js";
import authRoutes, { requireAuth } from "./routes/auth.js";

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hourglass";

const app = express();
app.use(cors());
app.use(express.json());
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  next(err);
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: app.locals.useMemory ? "file" : "mongodb",
  });
});

async function start() {
  let useMemory = false;

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log("MongoDB connected:", MONGO_URI);
  } catch (err) {
    useMemory = true;
    console.warn(
      "MongoDB unavailable — saving projects to server/data/projects.json.",
      err.message
    );
  }

  app.locals.useMemory = useMemory;
  app.use("/api/auth", authRoutes(useMemory));
  // Projects require a signed-in session
  app.use("/api/projects", requireAuth(useMemory), projectRoutes(useMemory));

  app.listen(PORT, () => {
    console.log(`Hourglass API running on http://localhost:${PORT}`);
  });
}

start();

import path from "path";
import { pathToFileURL } from "url";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 5000;
const isEntrypoint = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

let appInstance = null;

export async function getApp() {
  if (!appInstance) {
    appInstance = await createApp({
      allowMemory: process.env.NODE_ENV !== "production" && !process.env.VERCEL,
    });
  }
  return appInstance;
}

if (isEntrypoint) {
  createApp({ allowMemory: true })
    .then((app) => {
      app.listen(PORT, () => {
        console.log(`Hourglass API running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Could not start Hourglass API", error);
      process.exitCode = 1;
    });
}

// Default export for Vercel Express service integration
export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("Vercel Express handler error:", error);
    return res.status(503).json({
      error: "API service failed to initialize.",
      details: error.message,
    });
  }
}

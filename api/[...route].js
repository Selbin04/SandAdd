import { createApp } from "../server/app.js";

let appPromise;

export default async function handler(req, res) {
  try {
    if (!appPromise) appPromise = createApp({ allowMemory: false });
    const app = await appPromise;
    if (!String(req.url || "").startsWith("/api")) {
      req.url = `/api${req.url?.startsWith("/") ? req.url : `/${req.url || ""}`}`;
    }
    return app(req, res);
  } catch (error) {
    appPromise = null;
    console.error("Could not initialize API function", error);
    return res.status(503).json({ error: "API database is not configured." });
  }
}
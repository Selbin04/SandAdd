import { Router } from "express";
import { liveWorksStore } from "../liveWorksStore.js";
import { liveWorksMongoStore } from "../liveWorksMongoStore.js";

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);
}

export default function createLiveWorksRouter(useMemory) {
  const router = Router();
  const store = useMemory ? liveWorksStore : liveWorksMongoStore;

  router.get("/", asyncRoute(async (req, res) => {
    const raw = String(req.query.ids || "");
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length === 0) return res.json({ works: {}, progress: {} });
    const works = await store.getMany(ids);
    const progress = {};
    for (const id of ids) {
      const p = await store.getProgress(id);
      if (p) progress[id] = p;
    }
    return res.json({ works, progress });
  }));

  router.get("/:originId", asyncRoute(async (req, res) => {
    const entry = await store.get(req.params.originId);
    if (!entry) return res.status(404).json({ error: "Not found" });
    const progress = await store.getProgress(req.params.originId);
    return res.json({ ...entry, progress: progress || null });
  }));

  router.put("/:originId", asyncRoute(async (req, res) => {
    const ownerId = String(req.user?.id || "");
    if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
    const result = await store.put(
      req.params.originId,
      req.body || {},
      ownerId
    );
    if (result?.error === "forbidden") {
      return res
        .status(403)
        .json({ error: "Not allowed to update this live work" });
    }
    return res.json(result.value);
  }));

  router.delete("/:originId", asyncRoute(async (req, res) => {
    const ownerId = String(req.user?.id || "");
    if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
    const result = await store.remove(req.params.originId, ownerId);
    if (result?.error === "forbidden") {
      return res
        .status(403)
        .json({ error: "Not allowed to delete this live work" });
    }
    return res.json(result.value || { ok: true });
  }));

  router.put("/:originId/progress", asyncRoute(async (req, res) => {
    const body = req.body || {};
    const author = body.author || null;
    let patch = body.byTopic;
    if (!patch && body.topicId != null) {
      patch = { [String(body.topicId)]: { done: Boolean(body.done) } };
    }
    if (!patch || typeof patch !== "object") {
      return res.status(400).json({ error: "byTopic or topicId required" });
    }
    const progress = await store.putProgress(
      req.params.originId,
      patch,
      author
    );
    return res.json(progress);
  }));

  router.get("/:originId/progress", asyncRoute(async (req, res) => {
    const progress = await store.getProgress(req.params.originId);
    return res.json(
      progress || { originId: req.params.originId, byTopic: {} }
    );
  }));

  return router;
}

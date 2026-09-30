import { Router } from "express";
import { liveWorksStore } from "../liveWorksStore.js";

export default function createLiveWorksRouter() {
  const router = Router();

  router.get("/", (req, res) => {
    const raw = String(req.query.ids || "");
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length === 0) return res.json({ works: {}, progress: {} });
    const works = liveWorksStore.getMany(ids);
    const progress = {};
    for (const id of ids) {
      const p = liveWorksStore.getProgress(id);
      if (p) progress[id] = p;
    }
    return res.json({ works, progress });
  });

  router.get("/:originId", (req, res) => {
    const entry = liveWorksStore.get(req.params.originId);
    if (!entry) return res.status(404).json({ error: "Not found" });
    const progress = liveWorksStore.getProgress(req.params.originId);
    return res.json({ ...entry, progress: progress || null });
  });

  router.put("/:originId", (req, res) => {
    const ownerId = String(req.user?.id || "");
    if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
    const result = liveWorksStore.put(
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
  });

  router.delete("/:originId", (req, res) => {
    const ownerId = String(req.user?.id || "");
    if (!ownerId) return res.status(401).json({ error: "Unauthorized" });
    const result = liveWorksStore.remove(req.params.originId, ownerId);
    if (result?.error === "forbidden") {
      return res
        .status(403)
        .json({ error: "Not allowed to delete this live work" });
    }
    return res.json(result.value || { ok: true });
  });

  router.put("/:originId/progress", (req, res) => {
    const body = req.body || {};
    const author = body.author || null;
    let patch = body.byTopic;
    if (!patch && body.topicId != null) {
      patch = { [String(body.topicId)]: { done: Boolean(body.done) } };
    }
    if (!patch || typeof patch !== "object") {
      return res.status(400).json({ error: "byTopic or topicId required" });
    }
    const progress = liveWorksStore.putProgress(
      req.params.originId,
      patch,
      author
    );
    return res.json(progress);
  });

  router.get("/:originId/progress", (req, res) => {
    const progress = liveWorksStore.getProgress(req.params.originId);
    return res.json(
      progress || { originId: req.params.originId, byTopic: {} }
    );
  });

  return router;
}

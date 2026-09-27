import { Router } from "express";
import Project from "../models/Project.js";
import { memoryStore } from "../store.js";

function parseProjectInput(body, { partial = false } = {}) {
  const result = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { error: "name is required" };
    result.name = name.slice(0, 80);
  }

  const rawDuration = body.durationMs ?? body.timeoutMs;
  if (!partial || rawDuration !== undefined) {
    const durationMs = Number(rawDuration);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { error: "durationMs must be a positive number" };
    }
    result.durationMs = Math.round(durationMs);
  }

  if (!partial || body.elapsedMs !== undefined) {
    const elapsedMs = Number(body.elapsedMs ?? 0);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      return { error: "elapsedMs must be a non-negative number" };
    }
    result.elapsedMs = Math.round(elapsedMs);
  }

  if (body.completed !== undefined) {
    result.completed = Boolean(body.completed);
  }

  if (body.important !== undefined) {
    result.important = Boolean(body.important);
  }

  if (body.stars !== undefined) {
    const stars = Number(body.stars);
    if (!Number.isFinite(stars) || stars < 0 || stars > 5) {
      return { error: "stars must be a number from 0 to 5" };
    }
    result.stars = Math.round(stars);
  }

  if (body.topics !== undefined) {
    if (!Array.isArray(body.topics)) {
      return { error: "topics must be an array" };
    }
    result.topics = body.topics.slice(0, 80).map((topic, index) => ({
      id: String(topic?.id || `${Date.now()}-${index}`),
      text: String(topic?.text ?? "").trim().slice(0, 80),
      done: Boolean(topic?.done),
    })).filter((topic) => topic.text);
  }

  if (body.bump !== undefined) {
    result.bump = Boolean(body.bump);
  }

  if (result.durationMs !== undefined && result.elapsedMs !== undefined) {
    result.elapsedMs = Math.min(result.elapsedMs, result.durationMs);
    result.completed = result.elapsedMs >= result.durationMs;
  }

  return { value: result };
}

function asProject(doc) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const durationMs = obj.durationMs ?? obj.timeoutMs;
  delete obj.timeoutMs;
  return {
    ...obj,
    durationMs,
    important: Boolean(obj.important),
    stars: Math.min(5, Math.max(0, Number(obj.stars) || 0)),
    topics: Array.isArray(obj.topics) ? obj.topics : [],
  };
}

export default function projectRoutes(useMemory) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      if (useMemory) {
        return res.json((await memoryStore.list()).map(asProject));
      }
      const projects = await Project.find().sort({ lastWorkedAt: -1, createdAt: -1 }).limit(100);
      res.json(projects.map(asProject));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const parsed = parseProjectInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      if (useMemory) {
        return res.status(201).json(asProject(await memoryStore.create(parsed.value)));
      }
      const project = await Project.create(parsed.value);
      res.status(201).json(asProject(project));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const parsed = parseProjectInput(req.body, { partial: true });
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      if (useMemory) {
        const updated = await memoryStore.update(req.params.id, parsed.value);
        if (!updated) return res.status(404).json({ error: "Not found" });
        return res.json(asProject(updated));
      }

      const current = await Project.findById(req.params.id);
      if (!current) return res.status(404).json({ error: "Not found" });

      const currentDuration = current.durationMs ?? current.timeoutMs;
      const next = {
        name: parsed.value.name ?? current.name,
        durationMs: parsed.value.durationMs ?? currentDuration,
        elapsedMs: parsed.value.elapsedMs ?? current.elapsedMs,
      };
      next.elapsedMs = Math.min(next.elapsedMs, next.durationMs);
      next.completed =
        parsed.value.completed ?? next.elapsedMs >= next.durationMs;
      if (parsed.value.important !== undefined) {
        next.important = parsed.value.important;
      }
      if (parsed.value.stars !== undefined) {
        next.stars = parsed.value.stars;
      }
      if (parsed.value.topics !== undefined) {
        next.topics = parsed.value.topics;
      }
      if (parsed.value.bump) {
        next.lastWorkedAt = new Date();
      }

      const updated = await Project.findByIdAndUpdate(req.params.id, next, {
        new: true,
      });
      res.json(asProject(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      if (useMemory) {
        const removed = await memoryStore.remove(req.params.id);
        if (!removed) return res.status(404).json({ error: "Not found" });
        return res.json(asProject(removed));
      }
      const removed = await Project.findByIdAndDelete(req.params.id);
      if (!removed) return res.status(404).json({ error: "Not found" });
      res.json(asProject(removed));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

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
    result.topics = body.topics.slice(0, 80).map((topic, index) => {
      const text = String(topic?.text ?? "").trim().slice(0, 80);
      if (!text) return null;
      const proof = topic?.sourceProof;
      let sourceProof = null;
      if (proof && typeof proof === "object" && (proof.mediaId || proof.name)) {
        sourceProof = {
          mediaId: String(proof.mediaId || ""),
          name: String(proof.name || "").slice(0, 120),
          type: String(proof.type || "").slice(0, 80),
          size: Number(proof.size) || 0,
          hasMedia: Boolean(proof.hasMedia || proof.mediaId || proof.dataUrl),
        };
      }
      let sources = [];
      if (Array.isArray(topic?.sources)) {
        sources = topic.sources.slice(0, 20).map((s, sIdx) => {
          if (!s || typeof s !== "object") return null;
          const sType = String(s.type || "text");
          const sProof = s.proof;
          let cleanProof = null;
          if (sProof && typeof sProof === "object" && (sProof.mediaId || sProof.name)) {
            cleanProof = {
              mediaId: String(sProof.mediaId || ""),
              name: String(sProof.name || "").slice(0, 120),
              type: String(sProof.type || "").slice(0, 80),
              size: Number(sProof.size) || 0,
              hasMedia: Boolean(sProof.hasMedia || sProof.mediaId || sProof.dataUrl),
            };
          }
          return {
            id: String(s.id || `src-${Date.now()}-${sIdx}`),
            title: String(s.title || s.name || "").trim().slice(0, 80),
            type: sType === "file" ? "file" : sType === "link" ? "link" : "text",
            content: String(s.content || s.text || s.source || "").slice(0, 500),
            proof: cleanProof,
          };
        }).filter(Boolean);
      }
      return {
        id: String(topic?.id || `${Date.now()}-${index}`),
        text,
        done: Boolean(topic?.done),
        source: String(topic?.source ?? "").trim().slice(0, 500),
        sourceProof,
        sources,
      };
    }).filter(Boolean);
  }

  if (body.bump !== undefined) {
    result.bump = Boolean(body.bump);
  }

  if (body.originId !== undefined) {
    const oid = body.originId == null || body.originId === ""
      ? null
      : String(body.originId).slice(0, 80);
    result.originId = oid;
  }

  if (body.originMode !== undefined) {
    const mode = String(body.originMode || "");
    result.originMode = mode === "assign" || mode === "follow" ? mode : null;
  }

  if (body.tasksLocked !== undefined) {
    result.tasksLocked = Boolean(body.tasksLocked);
  }

  if (body.sharedTemplateId !== undefined) {
    result.sharedTemplateId =
      body.sharedTemplateId == null || body.sharedTemplateId === ""
        ? null
        : String(body.sharedTemplateId).slice(0, 120);
  }

  if (body.creatorName !== undefined) {
    result.creatorName =
      body.creatorName == null || body.creatorName === ""
        ? null
        : String(body.creatorName).slice(0, 80);
  }

  if (body.creatorHandle !== undefined) {
    result.creatorHandle =
      body.creatorHandle == null || body.creatorHandle === ""
        ? null
        : String(body.creatorHandle).slice(0, 80);
  }

  if (body.folderId !== undefined) {
    result.folderId =
      body.folderId == null || body.folderId === ""
        ? null
        : String(body.folderId).slice(0, 80);
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
    originId: obj.originId || null,
    originMode: obj.originMode === "assign" || obj.originMode === "follow"
      ? obj.originMode
      : null,
    tasksLocked: Boolean(obj.tasksLocked || obj.originId),
    sharedTemplateId: obj.sharedTemplateId || null,
    creatorName: obj.creatorName || null,
    creatorHandle: obj.creatorHandle || null,
    folderId: obj.folderId || null,
  };
}

function ownerIdOf(req) {
  return String(req.user?.id || "");
}

export default function projectRoutes(useMemory) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      if (useMemory) {
        await memoryStore.claimOrphans(ownerId);
        return res.json((await memoryStore.list(ownerId)).map(asProject));
      }

      // Legacy pre-auth projects: claim once for the first signed-in user
      await Project.updateMany(
        {
          $or: [{ ownerId: { $exists: false } }, { ownerId: null }, { ownerId: "" }],
        },
        { $set: { ownerId } }
      );

      const projects = await Project.find({ ownerId })
        .sort({ lastWorkedAt: -1, createdAt: -1 })
        .limit(100);
      res.json(projects.map(asProject));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      const parsed = parseProjectInput(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      if (useMemory) {
        return res
          .status(201)
          .json(asProject(await memoryStore.create({ ...parsed.value, ownerId })));
      }
      const project = await Project.create({ ...parsed.value, ownerId });
      res.status(201).json(asProject(project));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      const parsed = parseProjectInput(req.body, { partial: true });
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      if (useMemory) {
        const updated = await memoryStore.update(
          req.params.id,
          parsed.value,
          ownerId
        );
        if (!updated) return res.status(404).json({ error: "Not found" });
        return res.json(asProject(updated));
      }

      const current = await Project.findOne({ _id: req.params.id, ownerId });
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
      if (parsed.value.originId !== undefined) {
        next.originId = parsed.value.originId;
      }
      if (parsed.value.originMode !== undefined) {
        next.originMode = parsed.value.originMode;
      }
      if (parsed.value.tasksLocked !== undefined) {
        next.tasksLocked = parsed.value.tasksLocked;
      }
      if (parsed.value.sharedTemplateId !== undefined) {
        next.sharedTemplateId = parsed.value.sharedTemplateId;
      }
      if (parsed.value.creatorName !== undefined) {
        next.creatorName = parsed.value.creatorName;
      }
      if (parsed.value.creatorHandle !== undefined) {
        next.creatorHandle = parsed.value.creatorHandle;
      }
      if (parsed.value.folderId !== undefined) {
        next.folderId = parsed.value.folderId;
      }
      if (parsed.value.bump) {
        next.lastWorkedAt = new Date();
      }

      const updated = await Project.findOneAndUpdate(
        { _id: req.params.id, ownerId },
        next,
        { new: true }
      );
      res.json(asProject(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      if (useMemory) {
        const removed = await memoryStore.remove(req.params.id, ownerId);
        if (!removed) return res.status(404).json({ error: "Not found" });
        return res.json(asProject(removed));
      }
      const removed = await Project.findOneAndDelete({
        _id: req.params.id,
        ownerId,
      });
      if (!removed) return res.status(404).json({ error: "Not found" });
      res.json(asProject(removed));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

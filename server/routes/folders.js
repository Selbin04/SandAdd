import { Router } from "express";
import Folder from "../models/Folder.js";
import Project from "../models/Project.js";
import { memoryStore } from "../store.js";

// In-memory fallback for folders when running without MongoDB
const memoryFolders = new Map(); // ownerId -> array of folders

function ownerIdOf(req) {
  return String(req.user?.id || "");
}

function serializeFolder(f) {
  if (!f) return null;
  return {
    id: String(f._id || f.id),
    name: String(f.name || ""),
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export default function folderRoutes(useMemory) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      if (useMemory) {
        const list = memoryFolders.get(ownerId) || [];
        return res.json(list.map(serializeFolder));
      }

      const folders = await Folder.find({ ownerId }).sort({ createdAt: 1 });
      return res.json(folders.map(serializeFolder));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      const name = String(req.body?.name || "").trim().slice(0, 60);
      if (!name) return res.status(400).json({ error: "Folder name is required" });

      if (useMemory) {
        const list = memoryFolders.get(ownerId) || [];
        if (list.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
          return res.status(409).json({ error: "A folder with that name already exists" });
        }
        const doc = {
          id: req.body?.id || `fld-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ownerId,
          name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        list.push(doc);
        memoryFolders.set(ownerId, list);
        return res.status(201).json(serializeFolder(doc));
      }

      const existing = await Folder.findOne({ ownerId, name });
      if (existing) {
        return res.status(409).json({ error: "A folder with that name already exists" });
      }

      const folder = await Folder.create({
        ownerId,
        name,
      });
      return res.status(201).json(serializeFolder(folder));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      const name = String(req.body?.name || "").trim().slice(0, 60);
      if (!name) return res.status(400).json({ error: "Folder name is required" });

      if (useMemory) {
        const list = memoryFolders.get(ownerId) || [];
        const item = list.find((f) => f.id === req.params.id);
        if (!item) return res.status(404).json({ error: "Folder not found" });
        item.name = name;
        item.updatedAt = new Date();
        return res.json(serializeFolder(item));
      }

      const folder = await Folder.findOneAndUpdate(
        { _id: req.params.id, ownerId },
        { $set: { name } },
        { new: true }
      );
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      return res.json(serializeFolder(folder));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const ownerId = ownerIdOf(req);
      if (!ownerId) return res.status(401).json({ error: "Sign in required." });

      if (useMemory) {
        const list = memoryFolders.get(ownerId) || [];
        memoryFolders.set(ownerId, list.filter((f) => f.id !== req.params.id));
        return res.json({ ok: true });
      }

      const folder = await Folder.findOneAndDelete({ _id: req.params.id, ownerId });
      // Clear folderId from projects in this folder
      await Project.updateMany(
        { ownerId, folderId: req.params.id },
        { $set: { folderId: null } }
      );
      return res.json({ ok: true, removed: serializeFolder(folder) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

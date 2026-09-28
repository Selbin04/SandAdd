import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(serverDir, process.env.DATA_DIR || "data");
const dataFile = path.join(
  dataDir,
  path.basename(process.env.PROJECTS_FILE || "projects.json")
);

function load() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const nextId = Number(parsed.nextId) || 1;
    return { projects, nextId };
  } catch {
    return { projects: [], nextId: 1 };
  }
}

function save(projects, nextId) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify({ nextId, projects }, null, 2),
    "utf8"
  );
}

const state = load();
const projects = state.projects;
let nextId = state.nextId;

function persist() {
  save(projects, nextId);
}

function sortByWorked(list) {
  return [...list].sort((a, b) => {
    const tb = new Date(b.lastWorkedAt || b.createdAt || 0).getTime();
    const ta = new Date(a.lastWorkedAt || a.createdAt || 0).getTime();
    return tb - ta;
  });
}

export const memoryStore = {
  async list(ownerId) {
    const uid = String(ownerId || "");
    return sortByWorked(projects.filter((p) => String(p.ownerId || "") === uid));
  },

  /** One-time: give pre-auth projects to the first signed-in user who loads them. */
  async claimOrphans(ownerId) {
    const uid = String(ownerId || "");
    if (!uid) return 0;
    let claimed = 0;
    for (const p of projects) {
      if (!p.ownerId) {
        p.ownerId = uid;
        claimed += 1;
      }
    }
    if (claimed) persist();
    return claimed;
  },

  async create({
    ownerId,
    name,
    durationMs,
    elapsedMs = 0,
    completed = false,
    topics = [],
    originId = null,
    originMode = null,
    tasksLocked = false,
    sharedTemplateId = null,
    folderId = null,
  }) {
    const now = new Date();
    const doc = {
      _id: String(nextId++),
      ownerId: String(ownerId || ""),
      name,
      durationMs,
      elapsedMs,
      completed: Boolean(completed),
      important: false,
      stars: 0,
      topics: Array.isArray(topics) ? topics : [],
      originId: originId ? String(originId) : null,
      originMode: originMode === "assign" || originMode === "follow" ? originMode : null,
      tasksLocked: Boolean(tasksLocked || originId),
      sharedTemplateId: sharedTemplateId ? String(sharedTemplateId) : null,
      folderId: folderId ? String(folderId) : null,
      createdAt: now,
      updatedAt: now,
      lastWorkedAt: now,
    };
    projects.unshift(doc);
    persist();
    return doc;
  },

  async update(id, patch, ownerId) {
    const uid = String(ownerId || "");
    const doc = projects.find(
      (p) => p._id === id && String(p.ownerId || "") === uid
    );
    if (!doc) return null;
    if (patch.name !== undefined) doc.name = patch.name;
    if (patch.durationMs !== undefined) doc.durationMs = patch.durationMs;
    if (patch.elapsedMs !== undefined) doc.elapsedMs = patch.elapsedMs;
    if (patch.completed !== undefined) doc.completed = Boolean(patch.completed);
    if (patch.important !== undefined) doc.important = Boolean(patch.important);
    if (patch.stars !== undefined) doc.stars = patch.stars;
    if (patch.topics !== undefined) doc.topics = patch.topics;
    if (patch.originId !== undefined) doc.originId = patch.originId;
    if (patch.originMode !== undefined) doc.originMode = patch.originMode;
    if (patch.tasksLocked !== undefined) doc.tasksLocked = Boolean(patch.tasksLocked);
    if (patch.sharedTemplateId !== undefined) {
      doc.sharedTemplateId = patch.sharedTemplateId;
    }
    if (patch.folderId !== undefined) {
      doc.folderId = patch.folderId ? String(patch.folderId) : null;
    }
    if (doc.elapsedMs > doc.durationMs) doc.elapsedMs = doc.durationMs;
    doc.completed = doc.elapsedMs >= doc.durationMs;
    if (patch.bump) doc.lastWorkedAt = new Date();
    doc.updatedAt = new Date();
    persist();
    return doc;
  },

  async remove(id, ownerId) {
    const uid = String(ownerId || "");
    const index = projects.findIndex(
      (p) => p._id === id && String(p.ownerId || "") === uid
    );
    if (index === -1) return null;
    const [removed] = projects.splice(index, 1);
    persist();
    return removed;
  },
};

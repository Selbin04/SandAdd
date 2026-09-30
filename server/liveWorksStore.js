import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(serverDir, process.env.DATA_DIR || "data");
const dataFile = path.join(dataDir, "liveWorks.json");

function load() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      works:
        parsed.works && typeof parsed.works === "object" ? parsed.works : {},
      progress:
        parsed.progress && typeof parsed.progress === "object"
          ? parsed.progress
          : {},
    };
  } catch {
    return { works: {}, progress: {} };
  }
}

function save(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        works: state.works,
        progress: state.progress,
      },
      null,
      2
    ),
    "utf8"
  );
}

const state = load();

function sanitizeWorks(works) {
  if (!Array.isArray(works)) return [];
  return works
    .map((w, index) => {
      const text = String(w?.text || "").trim().slice(0, 80);
      if (!text) return null;
      return {
        id: String(w?.id || `w-${index}`),
        text,
        done: Boolean(w?.done),
        source: String(w?.source || "").trim().slice(0, 500),
        sourceProof: w?.sourceProof && typeof w.sourceProof === "object"
          ? {
              mediaId: w.sourceProof.mediaId || null,
              name: String(w.sourceProof.name || "").slice(0, 120),
              type: String(w.sourceProof.type || "").slice(0, 80),
              size: Number(w.sourceProof.size) || 0,
              hasMedia: Boolean(
                w.sourceProof.hasMedia ||
                  w.sourceProof.mediaId ||
                  w.sourceProof.dataUrl
              ),
            }
          : null,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

export const liveWorksStore = {
  get(originId) {
    const id = String(originId || "");
    if (!id) return null;
    return state.works[id] || null;
  },

  getMany(ids) {
    const out = {};
    for (const raw of ids || []) {
      const id = String(raw || "");
      if (!id) continue;
      if (state.works[id]) out[id] = state.works[id];
    }
    return out;
  },

  put(originId, payload, ownerId) {
    const id = String(originId || "");
    if (!id) return null;
    const prev = state.works[id];
    if (prev?.ownerId && String(prev.ownerId) !== String(ownerId)) {
      return { error: "forbidden" };
    }
    if (payload?.deleted) {
      state.works[id] = {
        originId: id,
        ownerId: String(ownerId),
        deleted: true,
        deletedAt: Date.now(),
      };
      delete state.progress[id];
      save(state);
      return { value: state.works[id] };
    }
    const entry = {
      originId: id,
      ownerId: String(ownerId),
      name: String(payload?.name || prev?.name || "Work").slice(0, 80),
      mode:
        payload?.mode === "assign" || prev?.mode === "assign"
          ? "assign"
          : "follow",
      works: sanitizeWorks(payload?.works),
      durationMs: Number(payload?.durationMs) || prev?.durationMs || 30_000,
      updatedAt: Date.now(),
      author: payload?.author || prev?.author || null,
      deleted: false,
    };
    state.works[id] = entry;
    save(state);
    return { value: entry };
  },

  remove(originId, ownerId) {
    const id = String(originId || "");
    const prev = state.works[id];
    if (!prev) return { value: null };
    if (prev.ownerId && String(prev.ownerId) !== String(ownerId)) {
      return { error: "forbidden" };
    }
    state.works[id] = {
      originId: id,
      ownerId: String(ownerId),
      deleted: true,
      deletedAt: Date.now(),
    };
    delete state.progress[id];
    save(state);
    return { value: state.works[id] };
  },

  getProgress(originId) {
    const id = String(originId || "");
    if (!id) return null;
    return state.progress[id] || null;
  },

  putProgress(originId, byTopicPatch, author = null) {
    const id = String(originId || "");
    if (!id) return null;
    const prev =
      state.progress[id] && typeof state.progress[id] === "object"
        ? state.progress[id]
        : { originId: id, byTopic: {} };
    const byTopic =
      prev.byTopic && typeof prev.byTopic === "object" ? { ...prev.byTopic } : {};
    const patch =
      byTopicPatch && typeof byTopicPatch === "object" ? byTopicPatch : {};
    for (const [topicId, value] of Object.entries(patch)) {
      if (!topicId) continue;
      if (value && typeof value === "object") {
        byTopic[String(topicId)] = {
          done: Boolean(value.done),
          updatedAt: Date.now(),
          by: value.by || author?.handle || author?.name || null,
        };
      } else {
        byTopic[String(topicId)] = {
          done: Boolean(value),
          updatedAt: Date.now(),
          by: author?.handle || author?.name || null,
        };
      }
    }
    state.progress[id] = {
      originId: id,
      byTopic,
      updatedAt: Date.now(),
    };
    save(state);
    return state.progress[id];
  },
};

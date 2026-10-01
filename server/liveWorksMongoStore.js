import LiveWork from "./models/LiveWork.js";

function serialize(entry) {
  if (!entry) return null;
  return {
    originId: entry.originId,
    ownerId: entry.ownerId || "",
    name: entry.name,
    mode: entry.mode,
    works: Array.isArray(entry.works) ? entry.works : [],
    durationMs: entry.durationMs,
    updatedAt: entry.updatedAt,
    deleted: Boolean(entry.deleted),
    deletedAt: entry.deletedAt || undefined,
    author: entry.author || null,
  };
}

function sanitizeWorks(works) {
  if (!Array.isArray(works)) return [];
  return works
    .map((work, index) => {
      const text = String(work?.text || "").trim().slice(0, 80);
      if (!text) return null;
      return {
        id: String(work?.id || `w-${index}`),
        text,
        done: Boolean(work?.done),
        source: String(work?.source || "").trim().slice(0, 500),
        sourceProof: work?.sourceProof && typeof work.sourceProof === "object"
          ? {
              mediaId: work.sourceProof.mediaId || null,
              name: String(work.sourceProof.name || "").slice(0, 120),
              type: String(work.sourceProof.type || "").slice(0, 80),
              size: Number(work.sourceProof.size) || 0,
              hasMedia: Boolean(
                work.sourceProof.hasMedia ||
                  work.sourceProof.mediaId ||
                  work.sourceProof.dataUrl
              ),
            }
          : null,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

export const liveWorksMongoStore = {
  async get(originId) {
    const entry = await LiveWork.findOne({ originId: String(originId || "") }).lean();
    return serialize(entry);
  },

  async getMany(ids) {
    const entries = await LiveWork.find({
      originId: { $in: ids.map(String) },
    }).lean();
    return Object.fromEntries(entries.map((entry) => [entry.originId, serialize(entry)]));
  },

  async getProgress(originId) {
    const entry = await LiveWork.findOne({ originId: String(originId || "") })
      .select("progress")
      .lean();
    return entry?.progress || null;
  },

  async put(originId, payload, ownerId) {
    const id = String(originId || "");
    if (!id) return null;
    const previous = await LiveWork.findOne({ originId: id });
    if (previous?.ownerId && String(previous.ownerId) !== String(ownerId)) {
      return { error: "forbidden" };
    }
    if (payload?.deleted) {
      const deleted = await LiveWork.findOneAndUpdate(
        { originId: id },
        {
          $set: {
            originId: id,
            ownerId: String(ownerId),
            deleted: true,
            deletedAt: Date.now(),
            progress: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      return { value: serialize(deleted) };
    }

    const entry = await LiveWork.findOneAndUpdate(
      { originId: id },
      {
        $set: {
          originId: id,
          ownerId: String(ownerId),
          name: String(payload?.name || previous?.name || "Work").slice(0, 80),
          mode: payload?.mode === "assign" || previous?.mode === "assign"
            ? "assign"
            : "follow",
          works: sanitizeWorks(payload?.works),
          durationMs: Number(payload?.durationMs) || previous?.durationMs || 30_000,
          updatedAt: Date.now(),
          deleted: false,
          deletedAt: null,
          author: payload?.author || previous?.author || null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { value: serialize(entry) };
  },

  async remove(originId, ownerId) {
    const id = String(originId || "");
    const previous = await LiveWork.findOne({ originId: id });
    if (!previous) return { value: null };
    if (previous.ownerId && String(previous.ownerId) !== String(ownerId)) {
      return { error: "forbidden" };
    }
    previous.ownerId = String(ownerId);
    previous.deleted = true;
    previous.deletedAt = Date.now();
    previous.progress = null;
    await previous.save();
    return { value: serialize(previous) };
  },

  async putProgress(originId, byTopicPatch, author = null) {
    const id = String(originId || "");
    if (!id) return null;
    let entry = await LiveWork.findOne({ originId: id });
    if (!entry) entry = new LiveWork({ originId: id, name: "Work" });

    const previous = entry.progress && typeof entry.progress === "object"
      ? entry.progress
      : { originId: id, byTopic: {} };
    const byTopic = { ...(previous.byTopic || {}) };
    for (const [topicId, value] of Object.entries(byTopicPatch || {})) {
      if (!topicId) continue;
      const topicValue = value && typeof value === "object" ? value : null;
      byTopic[String(topicId).slice(0, 120)] = {
        done: Boolean(topicValue ? topicValue.done : value),
        updatedAt: Date.now(),
        by: topicValue?.by || author?.handle || author?.name || null,
      };
    }
    entry.progress = { originId: id, byTopic, updatedAt: Date.now() };
    await entry.save();
    return entry.progress;
  },
};
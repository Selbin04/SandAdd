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
    about: entry.about || "",
  };
}

function sanitizeWorks(works) {
  if (!Array.isArray(works)) return [];
  return works
    .map((work, index) => {
      const text = String(work?.text || "").trim().slice(0, 120);
      if (!text) return null;
      const hasCheckbox = work?.hasCheckbox !== false && work?.checkboxEnabled !== false;
      return {
        id: String(work?.id || `w-${index}`),
        text,
        done: Boolean(work?.done),
        hasCheckbox,
        checkboxEnabled: hasCheckbox,
        source: String(work?.source || "").trim().slice(0, 1000),
        sourceTitle: String(work?.sourceTitle || "").trim().slice(0, 120),
        sources: Array.isArray(work?.sources) ? work.sources : [],
        likeCount: Number(work?.likeCount) || 0,
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
    const id = String(originId || "");
    const cleanId = id.replace(/^(live|view)-/, "");
    const entry = await LiveWork.findOne({
      originId: { $in: [id, cleanId] },
    }).lean();
    return serialize(entry);
  },

  async getMany(ids) {
    const rawIds = ids.map(String);
    const cleanIds = rawIds.map((id) => id.replace(/^(live|view)-/, ""));
    const allQueryIds = Array.from(new Set([...rawIds, ...cleanIds]));
    const entries = await LiveWork.find({
      originId: { $in: allQueryIds },
    }).lean();
    const result = {};
    for (const entry of entries) {
      const s = serialize(entry);
      result[entry.originId] = s;
      result[`live-${entry.originId}`] = s;
      result[`view-${entry.originId}`] = s;
    }
    return result;
  },

  async getProgress(originId) {
    const id = String(originId || "");
    const cleanId = id.replace(/^(live|view)-/, "");
    const entry = await LiveWork.findOne({
      originId: { $in: [id, cleanId] },
    })
      .select("progress")
      .lean();
    return entry?.progress || null;
  },

  async put(originId, payload, ownerId) {
    const rawId = String(originId || "");
    const id = rawId.replace(/^(live|view)-/, "");
    if (!id) return null;
    const previous = await LiveWork.findOne({ originId: { $in: [id, rawId] } });
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
          about: String(payload?.about || previous?.about || "").slice(0, 2000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return { value: serialize(entry) };
  },

  async remove(originId, ownerId) {
    const rawId = String(originId || "");
    const id = rawId.replace(/^(live|view)-/, "");
    const previous = await LiveWork.findOne({ originId: { $in: [id, rawId] } });
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
    const rawId = String(originId || "");
    const id = rawId.replace(/^(live|view)-/, "");
    if (!id) return null;
    let entry = await LiveWork.findOne({ originId: { $in: [id, rawId] } });
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
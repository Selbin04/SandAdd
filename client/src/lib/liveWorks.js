/** Live work shares: creator publishes task lists; followers sync them. */

const LIVE_WORKS_KEY = "sandadd.liveWorks";
const LIVE_PROGRESS_KEY = "sandadd.liveWorkProgress";
const LIVE_EVENT = "sandadd:live-works";

let liveChannel = null;
try {
  liveChannel = new BroadcastChannel("sandadd-live-works");
} catch {
  liveChannel = null;
}

function notifyLiveSync(reason = "update") {
  try {
    window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: { reason } }));
  } catch {
    /* ignore */
  }
  try {
    liveChannel?.postMessage({ reason, at: Date.now() });
  } catch {
    /* ignore */
  }
}

/** Subscribe to creator/follower live work updates (same tab + other tabs). */
export function subscribeLiveSync(handler) {
  if (typeof handler !== "function") return () => {};
  const onEvent = () => handler();
  window.addEventListener(LIVE_EVENT, onEvent);
  if (liveChannel) liveChannel.addEventListener("message", onEvent);
  return () => {
    window.removeEventListener(LIVE_EVENT, onEvent);
    if (liveChannel) liveChannel.removeEventListener("message", onEvent);
  };
}

function readCatalog() {
  try {
    const raw = localStorage.getItem(LIVE_WORKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCatalog(catalog) {
  try {
    localStorage.setItem(LIVE_WORKS_KEY, JSON.stringify(catalog));
    notifyLiveSync("catalog");
    return true;
  } catch {
    return false;
  }
}

function readProgressCatalog() {
  try {
    const raw = localStorage.getItem(LIVE_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgressCatalog(catalog) {
  try {
    localStorage.setItem(LIVE_PROGRESS_KEY, JSON.stringify(catalog));
    notifyLiveSync("progress");
    return true;
  } catch {
    return false;
  }
}

export function snapshotLiveWorks(project) {
  const topics = Array.isArray(project?.topics) ? project.topics : [];
  return topics
    .map((t, index) => ({
      id: String(t?.id || `w-${index}`),
      text: String(t?.text || "").trim().slice(0, 80),
      done: Boolean(t?.done),
      source: String(t?.source || "").trim().slice(0, 500),
      sourceProof: t?.sourceProof
        ? {
            mediaId: t.sourceProof.mediaId || null,
            name: t.sourceProof.name || "",
            type: t.sourceProof.type || "",
            size: t.sourceProof.size || 0,
            hasMedia: Boolean(
              t.sourceProof.hasMedia ||
                t.sourceProof.mediaId ||
                t.sourceProof.dataUrl
            ),
            ...(t.sourceProof.dataUrl ? { dataUrl: t.sourceProof.dataUrl } : {}),
          }
        : null,
    }))
    .filter((w) => w.text)
    .slice(0, 80);
}

/** Publish / refresh a live share so followers get updated tasks. */
export function publishLiveWork(project, mode = "follow", author = null) {
  if (!project?._id || !project?.name) return null;
  const originId = String(project._id);
  const catalog = readCatalog();
  const prev = catalog[originId];
  const entry = {
    originId,
    name: String(project.name).slice(0, 80),
    mode: mode === "assign" ? "assign" : prev?.mode === "assign" ? "assign" : "follow",
    works: snapshotLiveWorks(project),
    durationMs: project.durationMs || project.timeoutMs || 30_000,
    updatedAt: Date.now(),
    author: author || prev?.author || null,
  };
  catalog[originId] = entry;
  writeCatalog(catalog);

  // Keep shared tick state in sync when creator updates the list
  publishTopicsProgress(originId, project.topics || [], author);
  return entry;
}

export function getLiveWork(originId) {
  if (!originId) return null;
  const catalog = readCatalog();
  return catalog[String(originId)] || null;
}

/** Mark a live work as deleted so followers drop it from Progress. */
export function unpublishLiveWork(originId) {
  if (!originId) return;
  const id = String(originId);
  const catalog = readCatalog();
  catalog[id] = {
    originId: id,
    deleted: true,
    deletedAt: Date.now(),
  };
  writeCatalog(catalog);

  const progress = readProgressCatalog();
  if (progress[id]) {
    delete progress[id];
    writeProgressCatalog(progress);
  }
}

export function isLiveWorkDeleted(originId) {
  const live = getLiveWork(originId);
  return Boolean(live?.deleted);
}

export function getLiveWorkProgress(originId) {
  if (!originId) return null;
  return readProgressCatalog()[String(originId)] || null;
}

/** Follower or creator reports a task tick so everyone stays in sync. */
export function reportLiveTopicProgress(originId, topicId, done, author = null) {
  if (!originId || !topicId) return null;
  const oid = String(originId);
  const tid = String(topicId);
  const catalog = readProgressCatalog();
  const entry =
    catalog[oid] && typeof catalog[oid] === "object"
      ? catalog[oid]
      : { originId: oid, byTopic: {} };
  const byTopic =
    entry.byTopic && typeof entry.byTopic === "object" ? { ...entry.byTopic } : {};
  byTopic[tid] = {
    done: Boolean(done),
    updatedAt: Date.now(),
    by: author?.handle || author?.name || null,
  };
  catalog[oid] = {
    originId: oid,
    byTopic,
    updatedAt: Date.now(),
  };
  writeProgressCatalog(catalog);
  return catalog[oid];
}

export function publishTopicsProgress(originId, topics, author = null) {
  if (!originId || !Array.isArray(topics)) return;
  for (const t of topics) {
    if (!t?.id) continue;
    reportLiveTopicProgress(originId, t.id, Boolean(t.done), author);
  }
}

/** Apply shared tick state onto a topic list (creator or follower). */
export function applyLiveProgress(topics, originId) {
  const list = Array.isArray(topics) ? topics : [];
  const progress = getLiveWorkProgress(originId);
  if (!progress?.byTopic) return list;
  return list.map((t) => {
    const remote = progress.byTopic[String(t.id)];
    if (!remote) return t;
    return { ...t, done: Boolean(remote.done) };
  });
}

/** Merge creator's live task list into a follower's topics, then shared ticks. */
export function mergeFollowerTopics(localTopics, liveWorks, originId = null) {
  const local = Array.isArray(localTopics) ? localTopics : [];
  const live = Array.isArray(liveWorks) ? liveWorks : [];
  const localById = new Map(local.map((t) => [String(t.id), t]));
  const merged = live.map((w, index) => {
    const id = String(w.id || `w-${index}`);
    const prev = localById.get(id);
    return {
      id,
      text: String(w.text || "").trim().slice(0, 80),
      // Prefer creator snapshot done; local done is fallback before progress merge
      done: Boolean(w.done) || Boolean(prev?.done),
      source: String(w.source || "").trim().slice(0, 500),
      sourceProof: w.sourceProof || prev?.sourceProof || null,
    };
  });
  return originId ? applyLiveProgress(merged, originId) : merged;
}

/** True if follower topics differ from the live creator snapshot. */
export function followerTopicsNeedSync(localTopics, liveWorks, originId = null) {
  const next = mergeFollowerTopics(localTopics, liveWorks, originId);
  const local = Array.isArray(localTopics) ? localTopics : [];
  if (next.length !== local.length) return true;
  const localById = new Map(local.map((t) => [String(t.id), t]));
  return next.some((t) => {
    const prev = localById.get(String(t.id));
    if (!prev) return true;
    return (
      prev.text !== t.text ||
      Boolean(prev.done) !== Boolean(t.done) ||
      String(prev.source || "") !== String(t.source || "") ||
      String(prev.sourceProof?.mediaId || "") !== String(t.sourceProof?.mediaId || "")
    );
  });
}

export function buildLiveShareTemplate(project, mode, author = null) {
  const entry = publishLiveWork(project, mode, author);
  if (!entry) return null;
  return {
    templateId: `live-${entry.originId}`,
    originId: entry.originId,
    shareMode: entry.mode,
    name: entry.name,
    works: entry.works,
    durationMs: entry.durationMs,
    live: true,
    tasksLocked: true,
  };
}

export function isTasksLocked(project) {
  return Boolean(project?.tasksLocked || project?.originId);
}

/** Origin id used for shared progress (creator id, or follower's originId). */
export function liveOriginKey(project) {
  if (!project) return null;
  if (project.originId) return String(project.originId);
  if (!isTasksLocked(project) && project._id) return String(project._id);
  return null;
}

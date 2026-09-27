const FEED_KEY = "sandadd.socialPosts";
const GROUP_FEED_KEY = "sandadd.groupPosts";
const CUSTOM_GROUPS_KEY = "sandadd.customGroups";
const PROFILE_KEY = "sandadd.userProfile";
const MESSAGE_SHARE_KEY = "sandadd.messageShares";
const ADDED_TEMPLATES_KEY = "sandadd.addedProjectTemplates";
const DB_NAME = "sandadd.media";
const DB_VERSION = 2;

export const SHARE_GROUPS = [
  { id: "g1", name: "Tech Placement Info" },
  { id: "g2", name: "CSE S7 B" },
  { id: "g3", name: "Ship Club" },
];

export function loadCustomGroups() {
  try {
    const raw = localStorage.getItem(CUSTOM_GROUPS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (g) => g && typeof g.id === "string" && typeof g.name === "string"
    );
  } catch {
    return [];
  }
}

function saveCustomGroups(list) {
  try {
    localStorage.setItem(CUSTOM_GROUPS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Builtin + user-created groups for share pickers. */
export function getShareGroups() {
  const custom = loadCustomGroups().map((g) => ({
    id: g.id,
    name: g.name,
  }));
  return [...SHARE_GROUPS, ...custom];
}

export function createCustomGroup({ name, blurb = "" }) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    throw new Error("Enter a group name");
  }
  const existing = [
    ...SHARE_GROUPS.map((g) => g.name.toLowerCase()),
    ...loadCustomGroups().map((g) => g.name.toLowerCase()),
  ];
  if (existing.includes(trimmed.toLowerCase())) {
    throw new Error("A group with that name already exists");
  }
  const group = {
    id: `ug-${Date.now()}`,
    name: trimmed.slice(0, 60),
    blurb: (typeof blurb === "string" ? blurb.trim() : "").slice(0, 120) || "Your group",
    members: 1,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };
  saveCustomGroups([group, ...loadCustomGroups()]);
  return group;
}

export function loadAddedTemplateIds() {
  try {
    const raw = localStorage.getItem(ADDED_TEMPLATES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

export function markTemplateAdded(templateId) {
  if (!templateId) return;
  const id = String(templateId);
  const next = Array.from(new Set([...loadAddedTemplateIds(), id]));
  try {
    localStorage.setItem(ADDED_TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Snapshot a project's works list for posts / messages. */
export function snapshotProjectWorks(project) {
  const topics = Array.isArray(project?.topics) ? project.topics : [];
  return topics
    .map((t) => ({
      id: String(t.id || ""),
      text: String(t.text || "").trim().slice(0, 80),
      done: Boolean(t.done),
    }))
    .filter((t) => t.text);
}

/** Build a shareable project payload for a social post. */
export function buildSharedProject({ name, worksText = "", durationMs = 30_000 }) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    throw new Error("Enter a project name");
  }
  const works = String(worksText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((text, index) => ({
      id: `w-${Date.now()}-${index}`,
      text: text.slice(0, 80),
      done: false,
    }));
  return {
    templateId: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed.slice(0, 80),
    works,
    durationMs: durationMs || 30_000,
  };
}

/** Attach works (and cloneable project) when sharing a finished Progress project. */
export function buildSharePayloadFromProject(project) {
  if (!project?.name) return { works: [], sharedProject: null };
  const works = snapshotProjectWorks(project);
  return {
    works,
    sharedProject: {
      templateId: `fin-${project._id || "p"}-${Date.now()}`,
      name: project.name,
      works,
      durationMs: project.durationMs || project.timeoutMs || 30_000,
    },
  };
}

const DEFAULT_PROFILE = {
  name: "SandAdd User",
  handle: "sandadduser",
};

/** In-memory caches so videos stay visible even when localStorage can't hold them. */
let userPostsCache = null;
let groupPostsCache = null;
let messageSharesCache = null;
let feedEpoch = 0;

function bumpFeedEpoch() {
  feedEpoch += 1;
  return feedEpoch;
}

export function readAuthorProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : DEFAULT_PROFILE.name,
      handle:
        typeof parsed.handle === "string" && parsed.handle.trim()
          ? parsed.handle.trim().replace(/^@/, "")
          : DEFAULT_PROFILE.handle,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Drop heavy dataUrls for localStorage (quota); keep metadata. */
function lightProof(proof) {
  if (!proof) return null;
  return {
    name: proof.name || "",
    type: proof.type || "",
    size: proof.size || 0,
    mediaId: proof.mediaId || null,
    hasMedia: Boolean(proof.dataUrl || proof.mediaId),
  };
}

function lightPost(post) {
  if (!post) return post;
  return { ...post, proof: lightProof(post.proof) };
}

function lightMessage(msg) {
  if (!msg) return msg;
  return { ...msg, proof: lightProof(msg.proof) };
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB unavailable"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("feeds")) {
        db.createObjectStore("feeds");
      }
      if (!db.objectStoreNames.contains("media")) {
        db.createObjectStore("media");
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet(storeName, key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(storeName, key, value) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function ensureProofId(postOrMsg, prefix) {
  if (!postOrMsg?.proof?.dataUrl && !postOrMsg?.proof?.mediaId) return postOrMsg;
  if (postOrMsg.proof.mediaId) return postOrMsg;
  return {
    ...postOrMsg,
    proof: {
      ...postOrMsg.proof,
      mediaId: `${prefix}-${postOrMsg.id || Date.now()}`,
    },
  };
}

function pickRicherProof(a, b) {
  if (a?.dataUrl && !b?.dataUrl) return a;
  if (b?.dataUrl && !a?.dataUrl) return b;
  if (a?.dataUrl || b?.dataUrl) return { ...(b || {}), ...(a || {}), dataUrl: (a?.dataUrl || b?.dataUrl) };
  return a || b || null;
}

function mergeByIdPreferMedia(memoryList, storedList) {
  const map = new Map();
  for (const item of storedList || []) {
    if (item?.id == null) continue;
    map.set(String(item.id), item);
  }
  for (const item of memoryList || []) {
    if (item?.id == null) continue;
    const id = String(item.id);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, item);
      continue;
    }
    map.set(id, {
      ...prev,
      ...item,
      proof: pickRicherProof(item.proof, prev.proof),
    });
  }
  const preferredOrder = (memoryList?.length ? memoryList : storedList) || [];
  const seen = new Set();
  const out = [];
  for (const item of preferredOrder) {
    const id = String(item.id);
    if (seen.has(id)) continue;
    const merged = map.get(id);
    if (merged) {
      out.push(merged);
      seen.add(id);
    }
  }
  for (const [id, item] of map) {
    if (!seen.has(id)) out.push(item);
  }
  return out;
}

async function persistProofMedia(proof) {
  if (!proof?.mediaId || !proof.dataUrl) return;
  await idbSet("media", proof.mediaId, {
    dataUrl: proof.dataUrl,
    type: proof.type || "",
    name: proof.name || "",
    size: proof.size || 0,
  });
}

async function restoreProofMedia(proof) {
  if (!proof) return null;
  if (proof.dataUrl) return proof;
  if (!proof.mediaId) return proof;
  try {
    const stored = await idbGet("media", proof.mediaId);
    if (!stored?.dataUrl) return proof;
    return {
      ...proof,
      dataUrl: stored.dataUrl,
      type: proof.type || stored.type || "",
      name: proof.name || stored.name || "",
      size: proof.size || stored.size || 0,
    };
  } catch {
    return proof;
  }
}

async function restoreListMedia(list) {
  if (!Array.isArray(list)) return [];
  return Promise.all(
    list.map(async (item) => {
      if (!item?.proof) return item;
      const proof = await restoreProofMedia(item.proof);
      return { ...item, proof };
    })
  );
}

async function persistListMedia(list) {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (item?.proof?.dataUrl) await persistProofMedia(item.proof);
  }
}

function persistFeedAsync(feedKey, fullValue, lightValue) {
  void (async () => {
    try {
      await idbSet("feeds", feedKey, lightValue);
      if (feedKey === "userPosts") await persistListMedia(fullValue);
      else if (feedKey === "groupPosts") {
        for (const list of Object.values(fullValue || {})) {
          await persistListMedia(list);
        }
      } else if (feedKey === "messageShares") {
        for (const list of Object.values(fullValue || {})) {
          await persistListMedia(list);
        }
      }
    } catch {
      /* ignore quota / private mode */
    }
  })();
}

export function loadUserPosts() {
  if (userPostsCache) return userPostsCache;
  const list = readJson(FEED_KEY, []);
  userPostsCache = Array.isArray(list) ? list : [];
  return userPostsCache;
}

/** View posts + your group posts (for Profile). */
export function loadProfilePosts() {
  const view = loadUserPosts();
  const groupMap = loadAllGroupPosts();
  const fromGroups = [];
  for (const list of Object.values(groupMap || {})) {
    if (!Array.isArray(list)) continue;
    for (const post of list) {
      if (post?.isUser === true) fromGroups.push(post);
    }
  }
  const merged = mergeByIdPreferMedia(view, fromGroups);
  return merged.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

export function saveUserPosts(posts) {
  userPostsCache = posts;
  bumpFeedEpoch();
  const light = posts.map(lightPost);
  writeJson(FEED_KEY, light);
  persistFeedAsync("userPosts", posts, light);
}

export function addUserPost(post) {
  const nextPost = ensureProofId(post, "proof");
  const next = [nextPost, ...loadUserPosts()];
  saveUserPosts(next);
  if (nextPost.proof?.dataUrl) void persistProofMedia(nextPost.proof);
  return next;
}

export function updateUserPost(id, patch) {
  const next = loadUserPosts().map((p) =>
    p.id === id ? ensureProofId({ ...p, ...patch, id: p.id }, "proof") : p
  );
  saveUserPosts(next);
  return next;
}

export function deleteUserPost(id) {
  const next = loadUserPosts().filter((p) => p.id !== id);
  saveUserPosts(next);
  return next;
}

/** Delete a post from View and any group feed (Profile delete). */
export function deleteAuthoredPost(id) {
  deleteUserPost(id);
  const map = { ...loadAllGroupPosts() };
  let changed = false;
  for (const [gid, list] of Object.entries(map)) {
    if (!Array.isArray(list)) continue;
    const next = list.filter((p) => p.id !== id);
    if (next.length !== list.length) {
      map[gid] = next;
      changed = true;
    }
  }
  if (changed) saveAllGroupPosts(map);
  return loadProfilePosts();
}

/** Count posts/messages linked to a topic (from tick → share flow). */
export function countSharesForTopic(topicId) {
  if (!topicId) return 0;
  const tid = String(topicId);
  let n = loadUserPosts().filter((p) => String(p.topicId) === tid).length;
  const groups = loadAllGroupPosts();
  for (const list of Object.values(groups)) {
    if (!Array.isArray(list)) continue;
    n += list.filter((p) => String(p.topicId) === tid).length;
  }
  const messages = loadAllMessageShares();
  for (const list of Object.values(messages)) {
    if (!Array.isArray(list)) continue;
    n += list.filter((m) => String(m.topicId) === tid).length;
  }
  return n;
}

/** Remove all View / Group / Message shares created for a topic. */
export function deleteSharesForTopic(topicId) {
  if (!topicId) return 0;
  const tid = String(topicId);
  let removed = 0;

  const posts = loadUserPosts();
  const nextPosts = posts.filter((p) => {
    if (String(p.topicId) === tid) {
      removed += 1;
      return false;
    }
    return true;
  });
  if (nextPosts.length !== posts.length) saveUserPosts(nextPosts);

  const groupMap = { ...loadAllGroupPosts() };
  let groupsChanged = false;
  for (const [gid, list] of Object.entries(groupMap)) {
    if (!Array.isArray(list)) continue;
    const next = list.filter((p) => {
      if (String(p.topicId) === tid) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (next.length !== list.length) {
      groupMap[gid] = next;
      groupsChanged = true;
    }
  }
  if (groupsChanged) saveAllGroupPosts(groupMap);

  const msgMap = { ...loadAllMessageShares() };
  let msgChanged = false;
  for (const [threadId, list] of Object.entries(msgMap)) {
    if (!Array.isArray(list)) continue;
    const next = list.filter((m) => {
      if (String(m.topicId) === tid) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (next.length !== list.length) {
      msgMap[threadId] = next;
      msgChanged = true;
    }
  }
  if (msgChanged) saveAllMessageShares(msgMap);

  return removed;
}

function loadAllGroupPosts() {
  if (groupPostsCache) return groupPostsCache;
  const data = readJson(GROUP_FEED_KEY, {});
  groupPostsCache = data && typeof data === "object" ? data : {};
  return groupPostsCache;
}

function saveAllGroupPosts(map) {
  groupPostsCache = map;
  bumpFeedEpoch();
  const light = {};
  for (const [gid, list] of Object.entries(map)) {
    light[gid] = Array.isArray(list) ? list.map(lightPost) : [];
  }
  writeJson(GROUP_FEED_KEY, light);
  persistFeedAsync("groupPosts", map, light);
}

export function loadGroupPosts(groupId) {
  const map = loadAllGroupPosts();
  const list = map[groupId];
  return Array.isArray(list) ? list : [];
}

export function addGroupPost(groupId, post) {
  const map = { ...loadAllGroupPosts() };
  const list = Array.isArray(map[groupId]) ? map[groupId] : [];
  const nextPost = ensureProofId(post, "gproof");
  map[groupId] = [nextPost, ...list];
  saveAllGroupPosts(map);
  if (nextPost.proof?.dataUrl) void persistProofMedia(nextPost.proof);
  return map[groupId];
}

export const SHARE_THREADS = [
  { id: "sandadd", name: "SandAdd", official: true },
  { id: "1", name: "Alex" },
  { id: "2", name: "Maya" },
  { id: "3", name: "Jordan" },
];

function loadAllMessageShares() {
  if (messageSharesCache) return messageSharesCache;
  const data = readJson(MESSAGE_SHARE_KEY, {});
  messageSharesCache = data && typeof data === "object" ? data : {};
  return messageSharesCache;
}

function saveAllMessageShares(map) {
  messageSharesCache = map;
  bumpFeedEpoch();
  const light = {};
  for (const [tid, list] of Object.entries(map)) {
    light[tid] = Array.isArray(list) ? list.map(lightMessage) : [];
  }
  writeJson(MESSAGE_SHARE_KEY, light);
  persistFeedAsync("messageShares", map, light);
}

export function loadSharedMessages(threadId) {
  const map = loadAllMessageShares();
  const list = map[threadId];
  return Array.isArray(list) ? list : [];
}

export function addSharedMessage(threadId, message) {
  const map = { ...loadAllMessageShares() };
  const list = Array.isArray(map[threadId]) ? map[threadId] : [];
  const nextMsg = ensureProofId(message, "mproof");
  map[threadId] = [...list, nextMsg];
  saveAllMessageShares(map);
  if (nextMsg.proof?.dataUrl) void persistProofMedia(nextMsg.proof);
  return map[threadId];
}

/** Restore full media (including videos) from IndexedDB after reload. */
export async function hydrateSocialFeeds() {
  // Always seed from localStorage first so Profile/View don't start empty
  if (userPostsCache === null) loadUserPosts();
  if (groupPostsCache === null) loadAllGroupPosts();
  if (messageSharesCache === null) loadAllMessageShares();

  try {
    const [userPosts, groupPosts, messageShares] = await Promise.all([
      idbGet("feeds", "userPosts"),
      idbGet("feeds", "groupPosts"),
      idbGet("feeds", "messageShares"),
    ]);

    // Merge memory + stored; never drop in-memory dataUrls
    userPostsCache = mergeByIdPreferMedia(
      userPostsCache,
      Array.isArray(userPosts) ? userPosts : []
    );
    userPostsCache = await restoreListMedia(userPostsCache);

    const mergedGroups = { ...(typeof groupPosts === "object" && groupPosts ? groupPosts : {}) };
    if (groupPostsCache) {
      for (const [gid, list] of Object.entries(groupPostsCache)) {
        mergedGroups[gid] = mergeByIdPreferMedia(list, mergedGroups[gid] || []);
      }
    }
    for (const gid of Object.keys(mergedGroups)) {
      mergedGroups[gid] = await restoreListMedia(mergedGroups[gid] || []);
    }
    groupPostsCache = mergedGroups;

    const mergedMessages = {
      ...(typeof messageShares === "object" && messageShares ? messageShares : {}),
    };
    if (messageSharesCache) {
      for (const [tid, list] of Object.entries(messageSharesCache)) {
        mergedMessages[tid] = mergeByIdPreferMedia(list, mergedMessages[tid] || []);
      }
    }
    for (const tid of Object.keys(mergedMessages)) {
      mergedMessages[tid] = await restoreListMedia(mergedMessages[tid] || []);
    }
    messageSharesCache = mergedMessages;

    // Persist any in-memory media that IDB doesn't have yet
    await persistListMedia(userPostsCache);
    for (const list of Object.values(groupPostsCache)) await persistListMedia(list);
    for (const list of Object.values(messageSharesCache)) await persistListMedia(list);

    // Keep localStorage in sync with merged feed metadata
    writeJson(FEED_KEY, (userPostsCache || []).map(lightPost));
  } catch {
    /* IDB blocked — memory + light localStorage only */
  }
  return {
    userPosts: loadUserPosts(),
    profilePosts: loadProfilePosts(),
    groupPosts: loadAllGroupPosts(),
    messageShares: loadAllMessageShares(),
  };
}

function sniffMime(file) {
  if (file.type) return file.type;
  const name = (file.name || "").toLowerCase();
  if (/\.mp4$/i.test(name)) return "video/mp4";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.m4v$/i.test(name)) return "video/x-m4v";
  if (/\.ogg$/i.test(name) || /\.ogv$/i.test(name)) return "video/ogg";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  return "";
}

export function isImageProof(proof) {
  if (!proof?.dataUrl) return false;
  if (proof.type?.startsWith("image/")) return true;
  return proof.dataUrl.startsWith("data:image/");
}

export function isVideoProof(proof) {
  if (!proof?.dataUrl) return false;
  if (proof.type?.startsWith("video/")) return true;
  return proof.dataUrl.startsWith("data:video/");
}

export function isPdfProof(proof) {
  if (!proof) return false;
  if (proof.type === "application/pdf") return Boolean(proof.dataUrl);
  if (proof.dataUrl?.startsWith("data:application/pdf")) return true;
  return Boolean(proof.dataUrl && /\.pdf$/i.test(proof.name || ""));
}

export function fileToProof(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const type = sniffMime(file);
    const isVideo = type.startsWith("video/");
    const isImage = type.startsWith("image/");
    const isPdf = type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isVideo && !isImage && !isPdf) {
      reject(new Error("Use an image, video, or PDF file"));
      return;
    }
    const maxBytes = isVideo ? 20 * 1024 * 1024 : 2.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      reject(
        new Error(
          isVideo
            ? "Video must be under 20 MB"
            : "File must be under 2.5 MB"
        )
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        reject(new Error("Could not read proof file"));
        return;
      }
      resolve({
        name: file.name,
        type: type || "application/octet-stream",
        size: file.size,
        dataUrl,
        mediaId: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    };
    reader.onerror = () => reject(new Error("Could not read proof file"));
    reader.readAsDataURL(file);
  });
}

export const PROOF_ACCEPT =
  "image/*,video/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.m4v";

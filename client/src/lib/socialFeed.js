const FEED_KEY = "sandadd.socialPosts";
const GROUP_FEED_KEY = "sandadd.groupPosts";
const PROFILE_KEY = "sandadd.userProfile";
const MESSAGE_SHARE_KEY = "sandadd.messageShares";
const DB_NAME = "sandadd.media";
const DB_VERSION = 1;

export const SHARE_GROUPS = [
  { id: "g1", name: "Morning Pour" },
  { id: "g2", name: "Deep Work" },
  { id: "g3", name: "Ship Club" },
];

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
    hasMedia: Boolean(proof.dataUrl),
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
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet(key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("feeds", "readonly");
    const req = tx.objectStore("feeds").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("feeds", "readwrite");
    tx.objectStore("feeds").put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function ensureProofId(postOrMsg, prefix) {
  if (!postOrMsg?.proof?.dataUrl) return postOrMsg;
  if (postOrMsg.proof.mediaId) return postOrMsg;
  return {
    ...postOrMsg,
    proof: {
      ...postOrMsg.proof,
      mediaId: `${prefix}-${postOrMsg.id || Date.now()}`,
    },
  };
}

export function loadUserPosts() {
  if (userPostsCache) return userPostsCache;
  const list = readJson(FEED_KEY, []);
  userPostsCache = Array.isArray(list) ? list : [];
  return userPostsCache;
}

export function saveUserPosts(posts) {
  userPostsCache = posts;
  bumpFeedEpoch();
  writeJson(FEED_KEY, posts.map(lightPost));
  void idbSet("userPosts", posts).catch(() => {});
}

export function addUserPost(post) {
  const nextPost = ensureProofId(post, "proof");
  const next = [nextPost, ...loadUserPosts()];
  saveUserPosts(next);
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
  void idbSet("groupPosts", map).catch(() => {});
}

export function loadGroupPosts(groupId) {
  const map = loadAllGroupPosts();
  const list = map[groupId];
  return Array.isArray(list) ? list : [];
}

export function addGroupPost(groupId, post) {
  const map = { ...loadAllGroupPosts() };
  const list = Array.isArray(map[groupId]) ? map[groupId] : [];
  map[groupId] = [ensureProofId(post, "gproof"), ...list];
  saveAllGroupPosts(map);
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
  void idbSet("messageShares", map).catch(() => {});
}

export function loadSharedMessages(threadId) {
  const map = loadAllMessageShares();
  const list = map[threadId];
  return Array.isArray(list) ? list : [];
}

export function addSharedMessage(threadId, message) {
  const map = { ...loadAllMessageShares() };
  const list = Array.isArray(map[threadId]) ? map[threadId] : [];
  map[threadId] = [...list, ensureProofId(message, "mproof")];
  saveAllMessageShares(map);
  return map[threadId];
}

/** Restore full media (including videos) from IndexedDB after reload. */
export async function hydrateSocialFeeds() {
  const epochAtStart = feedEpoch;
  try {
    const [userPosts, groupPosts, messageShares] = await Promise.all([
      idbGet("userPosts"),
      idbGet("groupPosts"),
      idbGet("messageShares"),
    ]);

    // Don't clobber in-memory posts that were written while IDB was loading
    if (feedEpoch === epochAtStart) {
      if (Array.isArray(userPosts)) userPostsCache = userPosts;
      if (groupPosts && typeof groupPosts === "object") groupPostsCache = groupPosts;
      if (messageShares && typeof messageShares === "object") {
        messageSharesCache = messageShares;
      }
    }

    // First run: seed IDB from whatever localStorage still has
    if (!userPosts && userPostsCache?.length) {
      void idbSet("userPosts", userPostsCache).catch(() => {});
    }
    if (!groupPosts && groupPostsCache && Object.keys(groupPostsCache).length) {
      void idbSet("groupPosts", groupPostsCache).catch(() => {});
    }
    if (
      !messageShares &&
      messageSharesCache &&
      Object.keys(messageSharesCache).length
    ) {
      void idbSet("messageShares", messageSharesCache).catch(() => {});
    }
  } catch {
    /* IDB blocked — memory + light localStorage only */
  }
  return {
    userPosts: loadUserPosts(),
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

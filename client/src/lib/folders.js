/** Named folders for organizing Progress works (per user). */

function storageKey(userId) {
  return `sandadd.folders.${userId || "local"}`;
}

function membershipKey(userId) {
  return `sandadd.folderMembers.${userId || "local"}`;
}

export function loadFolders(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((f) => ({
        id: String(f?.id || ""),
        name: String(f?.name || "").trim().slice(0, 60),
      }))
      .filter((f) => f.id && f.name);
  } catch {
    return [];
  }
}

function saveFolders(userId, folders) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(folders));
    return true;
  } catch {
    return false;
  }
}

/** Map of workId -> folderId (or null when unfiled). */
export function loadFolderMembership(userId) {
  try {
    const raw = localStorage.getItem(membershipKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    for (const [workId, folderId] of Object.entries(parsed)) {
      if (!workId) continue;
      out[String(workId)] =
        folderId == null || folderId === "" ? null : String(folderId);
    }
    return out;
  } catch {
    return {};
  }
}

function saveFolderMembership(userId, map) {
  try {
    localStorage.setItem(membershipKey(userId), JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function setWorkFolder(userId, workId, folderId) {
  if (!userId || !workId) return;
  const map = loadFolderMembership(userId);
  const nextId = folderId == null || folderId === "" ? null : String(folderId);
  if (nextId == null) delete map[String(workId)];
  else map[String(workId)] = nextId;
  saveFolderMembership(userId, map);
}

export function applyFolderMembership(userId, projects) {
  const map = loadFolderMembership(userId);
  if (!Array.isArray(projects)) return [];
  return projects.map((p) => {
    const id = String(p?._id || "");
    const fromServer = p?.folderId ? String(p.folderId) : null;
    const fromLocal = Object.prototype.hasOwnProperty.call(map, id)
      ? map[id]
      : undefined;
    const folderId = fromLocal !== undefined ? fromLocal : fromServer;
    return { ...p, folderId: folderId || null };
  });
}

export function createFolder(userId, name) {
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) throw new Error("Enter a folder name");
  const folders = loadFolders(userId);
  if (folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("A folder with that name already exists");
  }
  const folder = {
    id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
  };
  saveFolders(userId, [...folders, folder]);
  return folder;
}

export function renameFolder(userId, folderId, name) {
  const trimmed = String(name || "").trim().slice(0, 60);
  if (!trimmed) throw new Error("Enter a folder name");
  const folders = loadFolders(userId);
  const next = folders.map((f) =>
    f.id === folderId ? { ...f, name: trimmed } : f
  );
  saveFolders(userId, next);
  return next.find((f) => f.id === folderId) || null;
}

export function deleteFolder(userId, folderId) {
  const folders = loadFolders(userId).filter((f) => f.id !== folderId);
  saveFolders(userId, folders);
  const map = loadFolderMembership(userId);
  let changed = false;
  for (const [workId, fid] of Object.entries(map)) {
    if (fid === folderId) {
      delete map[workId];
      changed = true;
    }
  }
  if (changed) saveFolderMembership(userId, map);
  return folders;
}

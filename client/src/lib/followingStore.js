const FOLLOWED_GROUPS_KEY = "sandadd.followedWorkGroups";
const FOLLOWED_GROUPS_EVENT = "sandadd:followed-work-groups-changed";

function notifyFollowedWorkGroupsChanged() {
  window.dispatchEvent(new CustomEvent(FOLLOWED_GROUPS_EVENT));
}

function canonicalWorkId(templateOrProject) {
  const originId = templateOrProject?.originId || templateOrProject?._id;
  if (originId) return String(originId);
  const templateId = String(templateOrProject?.templateId || "");
  return templateId.startsWith("live-") ? templateId.slice(5) : templateId;
}

export function loadFollowedWorkGroups() {
  try {
    const raw = localStorage.getItem(FOLLOWED_GROUPS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFollowedWorkGroups(groups) {
  try {
    localStorage.setItem(FOLLOWED_GROUPS_KEY, JSON.stringify(groups));
    notifyFollowedWorkGroupsChanged();
  } catch {
    /* ignore */
  }
}

export function joinFollowedWorkGroup(templateOrProject) {
  if (!templateOrProject) return null;
  const existing = loadFollowedWorkGroups();
  const workTitle = templateOrProject.name || templateOrProject.workTitle || "Shared Work";
  const workId = canonicalWorkId(templateOrProject) || String(Date.now());
  const id = `fw-${workId}`;

  const authorName =
    templateOrProject.authorName ||
    templateOrProject.creatorName ||
    templateOrProject.creator?.name ||
    "Work Creator";
  const authorHandle =
    templateOrProject.authorHandle ||
    templateOrProject.creatorHandle ||
    templateOrProject.creator?.handle ||
    "";
  const currentUser = templateOrProject.currentUser || {};
  const currentHandle = String(currentUser.handle || "").toLowerCase();
  const currentName = String(currentUser.name || "Member");
  const isCreator = Boolean(templateOrProject.isCreator);
  const memberKey = currentHandle || currentName.toLowerCase();
  const welcomeText = `Welcome! You are now following the "${workTitle}" work group. Updates from ${authorName} will be automatically posted here.`;
  const makeWelcomeMessage = () => ({
    id: `welcome-${Date.now()}`,
    from: "them",
    text: welcomeText,
    welcomeFor: memberKey,
    createdAt: new Date().toISOString(),
  });
  const alreadyExists = existing.find((g) => g.id === id);
  if (alreadyExists) {
    const members = Array.isArray(alreadyExists.members) ? alreadyExists.members : [];
    const alreadyJoined = members.some((member) => member.key === memberKey);
    const welcomedMembers = Array.isArray(alreadyExists.welcomedMembers)
      ? alreadyExists.welcomedMembers
      : [];
    const messages = (alreadyExists.messages || []).filter(
      (message) =>
        !isCreator ||
        !String(message.id).startsWith("m-init-") ||
        !String(message.text).startsWith("Welcome! You are now following the ")
    );
    const hasLegacyWelcome =
      alreadyJoined &&
      messages.some(
        (message) =>
          String(message.id).startsWith("m-init-") &&
          String(message.text).startsWith(`Welcome! You are now following the "${workTitle}"`)
      );
    const shouldWelcome =
      !isCreator &&
      !welcomedMembers.includes(memberKey) &&
      !hasLegacyWelcome;
    const updated = {
      ...alreadyExists,
      name: workTitle,
      workTitle,
      topics: templateOrProject.works || templateOrProject.topics || alreadyExists.topics,
      role: isCreator ? "Creator" : "Member",
      members: members.some((member) => member.key === memberKey)
        ? members
        : [...members, { key: memberKey, name: currentName, handle: currentHandle }],
      welcomedMembers:
        shouldWelcome || hasLegacyWelcome
          ? [...new Set([...welcomedMembers, memberKey])]
          : welcomedMembers,
      messages: shouldWelcome ? [...messages, makeWelcomeMessage()] : messages,
    };
    saveFollowedWorkGroups(existing.map((group) => group.id === id ? updated : group));
    return updated;
  }

  const initial = (workTitle[0] || "W").toUpperCase();

  const newGroup = {
    id,
    originId: workId,
    name: workTitle, // Group name is the exact work name
    initial,
    role: isCreator ? "Creator" : "Member",
    creatorName: authorName,
    creatorHandle: authorHandle,
    members: [{ key: memberKey, name: currentName, handle: currentHandle }],
    workTitle,
    progress: templateOrProject.progress || 0,
    lastUpdate: "Just joined work group",
    status: `Following Work · ${workTitle}`,
    isFollowing: true,
    topics: templateOrProject.works || templateOrProject.topics || [],
    welcomedMembers: isCreator ? [] : [memberKey],
    messages: isCreator ? [] : [makeWelcomeMessage()],
  };

  const updated = [newGroup, ...existing];
  saveFollowedWorkGroups(updated);
  return newGroup;
}

export function getFollowedWorkGroup(originId) {
  if (!originId) return null;
  const id = `fw-${String(originId)}`;
  const groups = loadFollowedWorkGroups();
  const group = groups.find((item) => item.id === id);
  if (!group || group.role !== "Creator") return group || null;

  const messages = (group.messages || []).filter(
    (message) =>
      !String(message.id).startsWith("m-init-") ||
      !String(message.text).startsWith("Welcome! You are now following the ")
  );
  if (messages.length === (group.messages || []).length) return group;

  const updated = { ...group, messages };
  saveFollowedWorkGroups(groups.map((item) => item.id === id ? updated : item));
  return updated;
}

export function addFollowedWorkMessage(originId, author, text, replyTo = null, isUpdate = false) {
  const trimmed = typeof text === "string" ? text.trim().slice(0, 500) : "";
  if (!originId || !trimmed) return null;
  const groups = loadFollowedWorkGroups();
  let updatedGroup = null;
  const targetId = String(originId);

  const updated = groups.map((group) => {
    if (group.id !== `fw-${targetId}` && group.originId !== targetId) return group;
    const isCreator = group.role === "Creator" || author?.isCreator;
    const msgFrom = isUpdate ? "update" : (isCreator ? "creator" : "me");
    const msgAuthor = author?.name || (isCreator ? group.creatorName || "Creator" : "Member");
    const msgRole = isCreator ? "Creator" : "Follower";

    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: msgFrom,
      author: msgAuthor,
      authorHandle: author?.handle || "",
      role: msgRole,
      text: trimmed,
      replyTo: replyTo ? {
        id: replyTo.id,
        author: replyTo.author || (replyTo.from === "update" ? "Project Update" : "Member"),
        text: typeof replyTo.text === "string" ? replyTo.text.slice(0, 120) : "",
      } : null,
      createdAt: new Date().toISOString(),
    };

    updatedGroup = {
      ...group,
      lastUpdate: isUpdate ? trimmed : group.lastUpdate,
      messages: [...(group.messages || []), newMessage],
    };
    return updatedGroup;
  });

  if (updatedGroup) {
    saveFollowedWorkGroups(updated);
    return updatedGroup;
  }

  return null;
}

export function pushFollowedWorkUpdate(workTitleOrId, updateText, nextProgress = null) {
  const existing = loadFollowedWorkGroups();
  let found = false;
  const targetStr = String(workTitleOrId);

  const updated = existing.map((g) => {
    if (
      g.id === targetStr ||
      g.id === `fw-${targetStr}` ||
      g.originId === targetStr ||
      g.workTitle === workTitleOrId ||
      g.name === workTitleOrId
    ) {
      found = true;
      const nextMsgs = [
        ...(g.messages || []),
        {
          id: `update-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: "update",
          author: g.creatorName || "Project Update",
          text: updateText,
          createdAt: new Date().toISOString(),
        },
      ];
      return {
        ...g,
        progress: nextProgress !== null ? nextProgress : g.progress,
        lastUpdate: updateText,
        messages: nextMsgs,
      };
    }
    return g;
  });

  if (found) {
    saveFollowedWorkGroups(updated);
  }
}

export function ensureFollowedWorkGroup(project, currentUser = {}) {
  if (!project) return null;
  const originId = project.originId || project._id;
  if (!originId) return null;
  const existing = getFollowedWorkGroup(originId);
  if (existing) return existing;

  return joinFollowedWorkGroup({
    ...project,
    currentUser,
    isCreator: !project.originId || project.originMode === "assign",
  });
}


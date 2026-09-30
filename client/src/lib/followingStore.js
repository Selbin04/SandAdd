const FOLLOWED_GROUPS_KEY = "sandadd.followedWorkGroups";

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
  } catch {
    /* ignore */
  }
}

export function joinFollowedWorkGroup(templateOrProject) {
  if (!templateOrProject) return null;
  const existing = loadFollowedWorkGroups();
  const workTitle = templateOrProject.name || templateOrProject.workTitle || "Shared Work";
  const id = `fw-${templateOrProject._id || templateOrProject.templateId || Date.now()}`;
  
  const alreadyExists = existing.find((g) => g.id === id || g.workTitle === workTitle);
  if (alreadyExists) return alreadyExists;

  const authorName =
    templateOrProject.authorName ||
    templateOrProject.creatorName ||
    "Work Creator";
  const initial = (workTitle[0] || "W").toUpperCase();
  const bgColors = [
    "linear-gradient(135deg, #ec4899, #8b5cf6)",
    "linear-gradient(135deg, #3b82f6, #06b6d4)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
  ];
  const bg = bgColors[existing.length % bgColors.length];

  const newGroup = {
    id,
    name: workTitle, // Group name is the exact work name
    initial,
    bg,
    role: `Created by ${authorName}`,
    workTitle,
    progress: templateOrProject.progress || 0,
    lastUpdate: "Just joined work group",
    status: `Following Work · ${workTitle}`,
    isFollowing: true,
    topics: templateOrProject.works || templateOrProject.topics || [],
    messages: [
      {
        id: `m-init-${Date.now()}`,
        from: "them",
        text: `Welcome! You are now following the "${workTitle}" work group. Updates from ${authorName} will be automatically posted here.`,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const updated = [newGroup, ...existing];
  saveFollowedWorkGroups(updated);
  return newGroup;
}

export function pushFollowedWorkUpdate(workTitleOrId, updateText, nextProgress = null) {
  const existing = loadFollowedWorkGroups();
  let found = false;
  const updated = existing.map((g) => {
    if (g.id === workTitleOrId || g.workTitle === workTitleOrId || g.name === workTitleOrId) {
      found = true;
      const nextMsgs = [
        ...(g.messages || []),
        {
          id: `update-${Date.now()}`,
          from: "them",
          text: `📢 ${updateText}`,
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

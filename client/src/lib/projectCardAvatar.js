import { getLiveWork } from "./liveWorks.js";

/**
 * Resolves the ORIGINAL creator's profile image for a progress path folder card.
 *
 * Requirements:
 * 1. For user's own progress paths (!originId && !sharedTemplateId):
 *    The original creator is the current user. Resolves from localStorage "sandadd.userAvatar"
 *    (or userProfile.avatar / authUser.avatar / project.creatorAvatar).
 * 2. For followed/shared/imported progress paths (has originId or sharedTemplateId):
 *    The original creator is the author of that shared work. Resolves from:
 *    - project.creatorAvatar / project.creatorPhoto / project.authorAvatar
 *    - liveWorks entry (author.avatar or creatorAvatar)
 *    - followed work groups (group.creatorAvatar)
 *    - social posts (matched post.avatar or post.author.avatar)
 *    - If creator is the current user (e.g. self-assigned/following self), returns user's avatar.
 *    - If creator is another user with no photo, returns "" (displays creator initial, NOT current user's image).
 */
export function getCardAvatar(project) {
  if (!project) return "";

  // 1. Direct creatorAvatar / creatorPhoto / authorAvatar on the project
  if (project.creatorAvatar && typeof project.creatorAvatar === "string" && project.creatorAvatar.trim()) {
    return project.creatorAvatar.trim();
  }
  if (project.creatorPhoto && typeof project.creatorPhoto === "string" && project.creatorPhoto.trim()) {
    return project.creatorPhoto.trim();
  }
  if (project.authorAvatar && typeof project.authorAvatar === "string" && project.authorAvatar.trim()) {
    return project.authorAvatar.trim();
  }
  if (project.creator?.avatar && typeof project.creator.avatar === "string" && project.creator.avatar.trim()) {
    return project.creator.avatar.trim();
  }

  // 2. If this is a followed / synced / imported progress path from an origin
  const originKey = project.originId || project.sharedTemplateId;
  if (originKey) {
    // Check liveWorks catalog for original creator avatar
    try {
      const live = getLiveWork(originKey);
      if (live?.author?.avatar) return live.author.avatar;
      if (live?.creatorAvatar) return live.creatorAvatar;
      if (live?.avatar) return live.avatar;
    } catch {
      /* ignore */
    }

    // Check followed work groups
    try {
      const rawGroups = localStorage.getItem("sandadd.followedWorkGroups");
      if (rawGroups) {
        const groups = JSON.parse(rawGroups);
        if (Array.isArray(groups)) {
          const matched = groups.find(
            (g) =>
              g.id === originKey ||
              g.id === `fw-${originKey}` ||
              g.workId === originKey ||
              g.originId === originKey
          );
          if (matched?.creatorAvatar) return matched.creatorAvatar;
          if (matched?.avatar) return matched.avatar;
        }
      }
    } catch {
      /* ignore */
    }

    // Check social feed posts for the original creator's avatar
    try {
      const rawPosts = localStorage.getItem("sandadd.socialPosts");
      if (rawPosts) {
        const posts = JSON.parse(rawPosts);
        if (Array.isArray(posts)) {
          const matched = posts.find(
            (p) =>
              p.projectId === originKey ||
              p.originId === originKey ||
              p.id === originKey ||
              p.id === `live-${originKey}` ||
              p.sharedProject?.originId === originKey ||
              p.sharedProject?._id === originKey
          );
          if (matched?.avatar) return matched.avatar;
          if (matched?.author?.avatar) return matched.author.avatar;
          if (matched?.creatorAvatar) return matched.creatorAvatar;
        }
      }
    } catch {
      /* ignore */
    }

    // Check if the original creator is actually the current user (e.g. user follows own work)
    let isSelf = false;
    try {
      const currentAuthor = JSON.parse(localStorage.getItem("sandadd.author") || "{}");
      const currentProfile = JSON.parse(localStorage.getItem("sandadd.userProfile") || "{}");
      const myName = (currentProfile.name || currentAuthor.name || "").toLowerCase().trim();
      const creatorName = (project.creatorName || "").toLowerCase().trim();
      if (creatorName === "me" || creatorName === "you" || (myName && creatorName === myName)) {
        isSelf = true;
      }
    } catch {
      /* ignore */
    }

    if (isSelf) {
      try {
        const userAvatar = localStorage.getItem("sandadd.userAvatar");
        if (userAvatar) return userAvatar;
      } catch {
        /* ignore */
      }
    }

    // Origin belongs to another creator who does not have an image
    return "";
  }

  // 3. User's OWN progress path (created by the user)
  // Check if a custom creator name was assigned to someone else
  if (project.creatorName && project.creatorName !== "Me" && project.creatorName !== "Work Creator") {
    let isSelf = false;
    try {
      const currentProfile = JSON.parse(localStorage.getItem("sandadd.userProfile") || "{}");
      const currentAuthor = JSON.parse(localStorage.getItem("sandadd.author") || "{}");
      const myName = (currentProfile.name || currentAuthor.name || "").toLowerCase().trim();
      if (myName && project.creatorName.toLowerCase().trim() === myName) {
        isSelf = true;
      }
    } catch {
      /* ignore */
    }

    if (!isSelf && project.originMode === "assign") {
      // Assigned from someone else without an image
      return "";
    }
  }

  // Original creator is the current user:
  try {
    const userAvatar = localStorage.getItem("sandadd.userAvatar");
    if (userAvatar) return userAvatar;
  } catch {
    /* ignore */
  }

  try {
    const currentProfile = JSON.parse(localStorage.getItem("sandadd.userProfile") || "{}");
    if (currentProfile?.avatar) return currentProfile.avatar;
  } catch {
    /* ignore */
  }

  try {
    const authUser = JSON.parse(localStorage.getItem("sandadd.authUser") || "null");
    if (authUser?.avatar) return authUser.avatar;
  } catch {
    /* ignore */
  }

  return "";
}

/**
 * Resolves the creator name for tooltip attribution.
 */
export function getCardCreatorName(project) {
  if (!project) return "You";
  if (project.creatorName && project.creatorName !== "Me" && project.creatorName !== "Work Creator") {
    return project.creatorName;
  }
  const originKey = project.originId || project.sharedTemplateId;
  if (originKey) {
    try {
      const live = getLiveWork(originKey);
      if (live?.author?.name) return live.author.name;
      if (live?.creatorName) return live.creatorName;
    } catch {
      /* ignore */
    }
  }
  try {
    const raw = localStorage.getItem("sandadd.userProfile");
    if (raw) {
      const p = JSON.parse(raw);
      if (p.name && p.name.trim()) return p.name.trim();
    }
  } catch {
    /* ignore */
  }
  return "You";
}

/**
 * Resolves the creator initial for fallback when no photo image is available.
 */
export function getCardInitial(project) {
  const name = getCardCreatorName(project);
  if (name && name.trim()) {
    return name.trim().charAt(0).toUpperCase();
  }
  return (project?.name || "P").trim().charAt(0).toUpperCase();
}

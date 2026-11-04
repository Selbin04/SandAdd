import { getLiveWork } from "./liveWorks.js";

/**
 * Returns the current user's active avatar from localStorage or auth data.
 */
export function getCurrentUserAvatar() {
  try {
    const rawAvatar = localStorage.getItem("sandadd.userAvatar");
    if (rawAvatar && typeof rawAvatar === "string" && rawAvatar.trim()) {
      return rawAvatar.trim();
    }
  } catch {}
  try {
    const profile = JSON.parse(localStorage.getItem("sandadd.userProfile") || "{}");
    if (profile?.avatar && typeof profile.avatar === "string" && profile.avatar.trim()) {
      return profile.avatar.trim();
    }
  } catch {}
  try {
    const author = JSON.parse(localStorage.getItem("sandadd.author") || "{}");
    if (author?.avatar && typeof author.avatar === "string" && author.avatar.trim()) {
      return author.avatar.trim();
    }
  } catch {}
  try {
    const authUser = JSON.parse(localStorage.getItem("sandadd.authUser") || "null");
    if (authUser?.avatar && typeof authUser.avatar === "string" && authUser.avatar.trim()) {
      return authUser.avatar.trim();
    }
  } catch {}
  return "";
}

/**
 * Determines whether a given project/progress path was created by the current user.
 */
export function isUserOwnProject(project) {
  if (!project) return false;
  const originKey = project.originId || project.sharedTemplateId;
  // If it has no origin / shared template and wasn't assigned from someone else, it's user's own project
  if (!originKey && project.originMode !== "assign") {
    return true;
  }
  // Check creator identity against current user
  try {
    const userProfile = JSON.parse(localStorage.getItem("sandadd.userProfile") || "{}");
    const userAuthor = JSON.parse(localStorage.getItem("sandadd.author") || "{}");
    const authUser = JSON.parse(localStorage.getItem("sandadd.authUser") || "null");

    const myNames = [
      (userProfile.name || "").toLowerCase().trim(),
      (userAuthor.name || "").toLowerCase().trim(),
      (authUser?.name || "").toLowerCase().trim(),
      "me",
      "you",
      "sandadd user",
      "work creator",
    ].filter(Boolean);

    const creatorName = (project.creatorName || "").toLowerCase().trim();
    if (creatorName && myNames.includes(creatorName)) {
      return true;
    }

    const myHandles = [
      (userProfile.handle || "").toLowerCase().trim().replace(/^@/, ""),
      (userAuthor.handle || "").toLowerCase().trim().replace(/^@/, ""),
      (authUser?.handle || "").toLowerCase().trim().replace(/^@/, ""),
    ].filter(Boolean);

    const creatorHandle = (project.creatorHandle || "").toLowerCase().trim().replace(/^@/, "");
    if (creatorHandle && myHandles.includes(creatorHandle)) {
      return true;
    }

    if (authUser?.id && project.userId && String(authUser.id) === String(project.userId)) {
      return true;
    }
  } catch {}
  return false;
}

/**
 * Resolves the creator's profile image for a progress path folder card.
 *
 * For the user's own progress paths:
 * ALWAYS returns the user's latest active avatar (so updating profile picture
 * updates every progress folder card immediately). If the user has no avatar,
 * returns "" so the fallback initial is displayed.
 *
 * For followed/shared/imported progress paths from another author:
 * Returns the original creator's image from project.creatorAvatar, liveWorks,
 * or social posts.
 */
export function getCardAvatar(project) {
  if (!project) return "";

  const currentUserAvatar = getCurrentUserAvatar();

  // 1. If this is the current user's own progress path:
  if (isUserOwnProject(project)) {
    return currentUserAvatar;
  }

  // 2. For external progress paths (followed/shared/imported from someone else):
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

  const originKey = project.originId || project.sharedTemplateId;
  if (originKey) {
    try {
      const live = getLiveWork(originKey);
      if (live?.author?.avatar) return live.author.avatar;
      if (live?.creatorAvatar) return live.creatorAvatar;
      if (live?.avatar) return live.avatar;
    } catch {}

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
    } catch {}

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
    } catch {}

    // Belongs to an external creator who has no photo
    return "";
  }

  return currentUserAvatar;
}

/**
 * Resolves the creator name for tooltip attribution.
 */
export function getCardCreatorName(project) {
  if (!project) return "You";
  if (isUserOwnProject(project)) {
    try {
      const raw = localStorage.getItem("sandadd.userProfile");
      if (raw) {
        const p = JSON.parse(raw);
        if (p.name && p.name.trim()) return p.name.trim();
      }
    } catch {}
    return "You";
  }

  if (project.creatorName && project.creatorName !== "Me" && project.creatorName !== "Work Creator") {
    return project.creatorName;
  }
  const originKey = project.originId || project.sharedTemplateId;
  if (originKey) {
    try {
      const live = getLiveWork(originKey);
      if (live?.author?.name) return live.author.name;
      if (live?.creatorName) return live.creatorName;
    } catch {}
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

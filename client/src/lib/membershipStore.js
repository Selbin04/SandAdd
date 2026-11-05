import { getFollowedWorkGroup } from "./followingStore.js";
import { getLiveWork } from "./liveWorks.js";
import { isUserOwnProject } from "./projectCardAvatar.js";

const MEMBERSHIP_PREFIX = "sandadd.membership.";

/**
 * Resolves the primary key for membership associated with a project or its shared origin.
 */
export function getMembershipKey(project) {
  if (!project) return "";
  return String(project.originId || project.sharedTemplateId || project._id || project.id || "").trim();
}

/**
 * Checks if the current project represents a shared work (shared to follow or user following).
 */
export function isSharedOrFollowedWork(project) {
  if (!project) return false;
  return Boolean(
    project.originId ||
    project.sharedTemplateId ||
    project.isShared ||
    project.shareMode === "follow" ||
    project.originMode === "follow" ||
    project.mode === "follow" ||
    Boolean(getFollowedWorkGroup(project.originId || project.sharedTemplateId || project._id || project.id)) ||
    Boolean(getLiveWork(project.originId || project.sharedTemplateId || project._id || project.id))
  );
}

/**
 * Checks if the current user is the creator of this progress folder.
 */
export function isFolderCreator(project) {
  if (!project) return true;
  // If it is a followed work group from another creator, check role
  const group = getFollowedWorkGroup(project.originId || project.sharedTemplateId || project._id || project.id);
  if (group && group.role !== "Creator" && !group.isCreator) {
    return false;
  }
  // If it has an external origin and not own project
  if ((project.originId || project.sharedTemplateId) && !isUserOwnProject(project)) {
    return false;
  }
  return true;
}

/**
 * Gets the current membership status for the project's creator / shared work.
 */
export function getMembership(project) {
  const key = getMembershipKey(project);
  if (!key) return { isMember: false, tier: null, isCreator: false };

  const isCreator = isFolderCreator(project);
  if (isCreator) {
    return { isMember: true, tier: "creator", isCreator: true, price: 0 };
  }

  try {
    const raw = localStorage.getItem(`${MEMBERSHIP_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isMember) {
        return {
          isMember: true,
          tier: parsed.tier || "support",
          price: parsed.price || (parsed.tier === "paths" ? 199 : 99),
          joinedAt: parsed.joinedAt || null,
          isCreator: false,
        };
      }
    }
  } catch {
    /* ignore */
  }

  return { isMember: false, tier: null, isCreator: false };
}

/**
 * Simulates purchasing a dummy membership (Support: RS 99, Valuable Paths: RS 199).
 */
export function purchaseMembership(project, tier = "support") {
  const key = getMembershipKey(project);
  if (!key) return null;

  const price = tier === "paths" ? 199 : 99;
  const payload = {
    isMember: true,
    tier,
    price,
    joinedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${MEMBERSHIP_PREFIX}${key}`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sandadd:membership-updated", {
        detail: { key, tier, price, payload },
      })
    );
  }

  return payload;
}

/**
 * Cancels or clears membership for testing.
 */
export function clearMembership(project) {
  const key = getMembershipKey(project);
  if (!key) return;

  try {
    localStorage.removeItem(`${MEMBERSHIP_PREFIX}${key}`);
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sandadd:membership-updated", {
        detail: { key, isMember: false },
      })
    );
  }
}


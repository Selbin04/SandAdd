const REVIEW_KEY = "hourglass.dailyReview";
const SELECTED_KEY = "hourglass.dailySelected";
const WORKS_KEY = "hourglass.dailyWorks";
const FORCE_KEY = "hourglass.dailyReviewForce";
/** Bump this number to show the morning review one more time after deploy/refresh. */
const FORCE_VERSION = 7;

export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns true once when FORCE_VERSION is bumped; clears review gate + Selected + works. */
export function applyDailyReviewForce() {
  try {
    if (Number(localStorage.getItem(FORCE_KEY)) !== FORCE_VERSION) {
      localStorage.setItem(FORCE_KEY, String(FORCE_VERSION));
      localStorage.removeItem(REVIEW_KEY);
      localStorage.removeItem(SELECTED_KEY);
      localStorage.removeItem(WORKS_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function shouldShowDailyReview() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.date !== todayKey() || !parsed?.done;
  } catch {
    return true;
  }
}

export function markDailyReviewDone() {
  localStorage.setItem(
    REVIEW_KEY,
    JSON.stringify({ date: todayKey(), done: true })
  );
}

export function loadDailySelectedIds() {
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey() || !Array.isArray(parsed.ids)) return [];
    return parsed.ids.map(String);
  } catch {
    return [];
  }
}

export function saveDailySelectedIds(ids) {
  localStorage.setItem(
    SELECTED_KEY,
    JSON.stringify({ date: todayKey(), ids: ids.map(String) })
  );
}

function loadWorksStore() {
  try {
    const raw = localStorage.getItem(WORKS_KEY);
    if (!raw) return { date: todayKey(), byProject: {} };
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey()) return { date: todayKey(), byProject: {} };
    return {
      date: todayKey(),
      byProject:
        parsed.byProject && typeof parsed.byProject === "object"
          ? parsed.byProject
          : {},
    };
  } catch {
    return { date: todayKey(), byProject: {} };
  }
}

function saveWorksStore(store) {
  localStorage.setItem(WORKS_KEY, JSON.stringify(store));
}

/** null = not chosen yet today; array = chosen topic ids (may be empty). */
export function getDailyWorkIds(projectId) {
  const store = loadWorksStore();
  const key = String(projectId);
  if (!Object.prototype.hasOwnProperty.call(store.byProject, key)) return null;
  const ids = store.byProject[key];
  return Array.isArray(ids) ? ids.map(String) : [];
}

export function hasChosenDailyWorks(projectId) {
  return getDailyWorkIds(projectId) !== null;
}

export function saveDailyWorkIds(projectId, topicIds) {
  const store = loadWorksStore();
  store.byProject[String(projectId)] = topicIds.map(String);
  saveWorksStore(store);
}

export function clearDailyWorkIds(projectId) {
  const store = loadWorksStore();
  delete store.byProject[String(projectId)];
  saveWorksStore(store);
}

export function incompleteImportant(projects) {
  return projects
    .filter((p) => p.important && !p.completed)
    .sort((a, b) => {
      const sb = Number(b.stars) || 0;
      const sa = Number(a.stars) || 0;
      if (sb !== sa) return sb - sa;
      const tb = new Date(b.lastWorkedAt || b.createdAt || 0).getTime();
      const ta = new Date(a.lastWorkedAt || a.createdAt || 0).getTime();
      return tb - ta;
    });
}

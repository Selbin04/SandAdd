/** Profile highlights — special works pinned on your profile. */

const HIGHLIGHTS_KEY = "sandadd.profileHighlights";

export function loadHighlights() {
  try {
    const raw = localStorage.getItem(HIGHLIGHTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((h) => ({
        id: String(h?.id || ""),
        workId: String(h?.workId || ""),
        name: String(h?.name || "").trim().slice(0, 80),
        createdAt: h?.createdAt || null,
      }))
      .filter((h) => h.id && h.workId);
  } catch {
    return [];
  }
}

function saveHighlights(list) {
  try {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addHighlightWorks(works = []) {
  const current = loadHighlights();
  const existing = new Set(current.map((h) => h.workId));
  const next = [...current];
  for (const work of works) {
    const workId = String(work?._id || work?.id || "");
    if (!workId || existing.has(workId)) continue;
    existing.add(workId);
    next.push({
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workId,
      name: String(work?.name || "Work").trim().slice(0, 80) || "Work",
      createdAt: new Date().toISOString(),
    });
  }
  saveHighlights(next);
  return next;
}

export function removeHighlight(id) {
  const next = loadHighlights().filter((h) => h.id !== id);
  saveHighlights(next);
  return next;
}

export function removeHighlightByWorkId(workId) {
  const id = String(workId || "");
  const next = loadHighlights().filter((h) => h.workId !== id);
  saveHighlights(next);
  return next;
}

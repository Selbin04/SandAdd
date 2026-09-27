export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function formatShort(ms) {
  const total = Math.max(0, Math.round(ms / 100) / 10);
  if (total < 60) return `${total.toFixed(1)}s`;
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

export function projectDuration(project) {
  return project?.durationMs ?? project?.timeoutMs ?? 0;
}

export function fillProgress(elapsedMs, durationMs) {
  if (!durationMs || durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

export function fillLabel(elapsedMs, durationMs) {
  const p = fillProgress(elapsedMs, durationMs);
  if (p <= 0.02) return "Not started";
  if (p >= 0.98) return "Finished";
  return `${Math.round(p * 100)}% done`;
}

/** Progress from ticked works: 2 works → each tick = 50%, untick reverses. */
export function elapsedFromWorks(topics, durationMs) {
  const list = Array.isArray(topics) ? topics : [];
  const duration = Number(durationMs) || 0;
  if (list.length === 0 || duration <= 0) return 0;
  const done = list.filter((t) => t?.done).length;
  return Math.min(duration, Math.round((done / list.length) * duration));
}

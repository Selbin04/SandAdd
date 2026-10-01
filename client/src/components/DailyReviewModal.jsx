import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import "./DailyReviewModal.css";

export default function DailyReviewModal({
  project,
  index,
  total,
  onSelect,
  onSkip,
  onPrevious,
}) {
  if (!project) return null;

  const duration = projectDuration(project);
  const progress = fillProgress(project.elapsedMs, duration);
  const stars = Math.min(5, Math.max(0, Number(project.stars) || 0));
  const canGoPrevious = index > 0;

  return (
    <div
      className="daily-review-backdrop"
      onClick={onSkip}
      role="presentation"
    >
      <div
        className="daily-review-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="daily-review-eyebrow">
          Today&apos;s important · {index + 1} of {total}
        </p>
        <h2 id="daily-review-title">{project.name}</h2>
        <p className="daily-review-meta">{fillLabel(project.elapsedMs, duration)}</p>
        {stars > 0 && (
          <p className="daily-review-stars" aria-label={`${stars} stars`}>
            {"★".repeat(stars)}
            <span className="off">{"★".repeat(5 - stars)}</span>
          </p>
        )}
        <div className="daily-review-glass" aria-hidden="true">
          <span className="daily-review-sand" style={{ height: `${progress * 100}%` }} />
        </div>
        <div className="daily-review-actions">
          <button
            type="button"
            className="daily-review-previous"
            onClick={onPrevious}
            disabled={!canGoPrevious}
          >
            Previous
          </button>
          <button type="button" className="daily-review-select" onClick={onSelect}>
            Select
          </button>
        </div>
        <p className="daily-review-hint">
          Select to keep this project and choose today&apos;s tasks · click outside to skip · Previous to undo
        </p>
      </div>
    </div>
  );
}

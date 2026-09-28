import { useState } from "react";
import "./TodayWorksModal.css";

export default function TodayWorksModal({ project, onConfirm, onSkip }) {
  const topics = Array.isArray(project.topics) ? project.topics : [];
  const [picked, setPicked] = useState(() => new Set());

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="today-works-backdrop" role="presentation">
      <div
        className="today-works-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-works-title"
      >
        <p className="today-works-eyebrow">Works for today</p>
        <h2 id="today-works-title">{project.name}</h2>
        <p className="today-works-hint">
          Pick which works to do today
        </p>

        {topics.length === 0 ? (
          <p className="today-works-empty">
            No works listed yet. Add them by double-clicking this work in Important or Works.
          </p>
        ) : (
          <ul className="today-works-list">
            {topics.map((topic) => {
              const on = picked.has(topic.id);
              return (
                <li key={topic.id}>
                  <button
                    type="button"
                    className={`today-works-item ${on ? "is-on" : ""}`}
                    onClick={() => toggle(topic.id)}
                    aria-pressed={on}
                  >
                    <span className="today-works-check" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                    <span>{topic.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="today-works-actions">
          <button type="button" className="today-works-skip" onClick={onSkip}>
            Skip
          </button>
          <button
            type="button"
            className="today-works-confirm"
            onClick={() => onConfirm([...picked])}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

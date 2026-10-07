import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { getProjectCreator } from "../lib/liveWorks.js";

export default function SelectedStack({ projects, activeId, onSelect, onOpenTopics, onOpenWork }) {
  return (
    <aside className="panel selected-panel">
      <header className="panel-head">
        <h2>SELECTED ( TODAY )</h2>
        <span className="storage-pill">{projects.length}</span>
      </header>
      {projects.length === 0 ? (
        <p className="empty">
          Projects and today&apos;s tasks from the morning review appear here. Double-click a project to see today&apos;s tasks.
        </p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => {
            const duration = projectDuration(p);
            const progress = fillProgress(p.elapsedMs, duration);
            const active = p._id === activeId;
            return (
              <li key={p._id} className={`${active ? "active" : ""} ${p.completed ? "done" : ""}`}>
                <button
                  type="button"
                  className="project-select"
                  onClick={() => onSelect(p)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.closest("li").getBoundingClientRect();
                    onOpenTopics(p, rect);
                  }}
                >
                  <span className="mini-glass" aria-hidden="true">
                    <span className="mini-sand" style={{ height: `${progress * 100}%` }} />
                  </span>
                  <span className="project-copy">
                    <strong>{p.name}</strong>
                    <span>{fillLabel(p.elapsedMs, duration)}</span>
                    <span className="project-progress-track" aria-hidden="true">
                      <span style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="open-work-btn"
                  aria-label={`Open ${p.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenWork?.(p);
                  }}
                >
                  Open
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

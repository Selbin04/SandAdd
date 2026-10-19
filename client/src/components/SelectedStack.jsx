import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";

export default function SelectedStack({
  projects,
  activeId,
  onSelect,
  onOpenTopics,
  onOpenWork,
}) {
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
        <div className="selected-boxes-scroll-wrapper">
          <div
            className="selected-boxes-row"
            role="list"
            aria-label="Selected progress folders"
          >
            {projects.map((p) => {
              const duration = projectDuration(p);
              const progress = fillProgress(p.elapsedMs, duration);
              const active = p._id === activeId;
              return (
                <div
                  key={p._id}
                  className={`selected-rect-box ${active ? "active" : ""} ${p.completed ? "done" : ""}`}
                  onClick={() => onSelect(p)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onOpenTopics(p, rect);
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Double click to view today's tasks for ${p.name}`}
                >
                  <div className="selected-rect-top">
                    <span className="mini-glass" aria-hidden="true">
                      <span
                        className="mini-sand"
                        style={{ height: `${progress * 100}%` }}
                      />
                    </span>
                    <span className="selected-rect-time">
                      {fillLabel(p.elapsedMs, duration)}
                    </span>
                    {onOpenWork ? (
                      <button
                        type="button"
                        className="selected-rect-open-btn"
                        aria-label={`Open ${p.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWork(p);
                        }}
                      >
                        Open
                      </button>
                    ) : null}
                  </div>

                  <div className="selected-rect-body">
                    <strong className="selected-rect-name" title={p.name}>
                      {p.name}
                    </strong>
                  </div>

                  <div className="selected-rect-track" aria-hidden="true">
                    <span
                      className="selected-rect-fill"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

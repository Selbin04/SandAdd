import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { isTasksLocked } from "../lib/liveWorks.js";
import { useHorizontalScroll } from "../lib/useHorizontalScroll.js";
import WorkFolderStats from "./WorkFolderStats.jsx";

export default function SelectedStack({
  projects,
  activeId,
  onSelect,
  onOpenTopics,
}) {
  const selectedScroll = useHorizontalScroll();

  return (
    <aside className="panel selected-panel">
      <header className="panel-head">
        <h2>SELECTED ( TODAY )</h2>
        <div className="panel-head-actions">
          <div className="folder-scroll-controls">
            <button
              type="button"
              className={`folder-scroll-arrow ${!selectedScroll.canScrollLeft ? "is-disabled" : ""}`}
              onClick={() => selectedScroll.scrollByAmount(-220)}
              disabled={!selectedScroll.canScrollLeft}
              title="Scroll left"
              aria-label="Scroll left"
            >
              ‹
            </button>
            <button
              type="button"
              className={`folder-scroll-arrow ${!selectedScroll.canScrollRight ? "is-disabled" : ""}`}
              onClick={() => selectedScroll.scrollByAmount(220)}
              disabled={!selectedScroll.canScrollRight}
              title="Scroll right"
              aria-label="Scroll right"
            >
              ›
            </button>
          </div>
          <span className="storage-pill">{projects.length}</span>
        </div>
      </header>
      {projects.length === 0 ? (
        <p className="empty">No projects selected for today.</p>
      ) : (
        <div
          ref={selectedScroll.elRef}
          className="selected-boxes-scroll-wrapper"
        >
          <div
            className="selected-boxes-row"
            role="list"
            aria-label="Selected progress folders"
          >
            {projects.map((p) => {
              const duration = projectDuration(p);
              const progress = fillProgress(p.elapsedMs, duration);
              const active = p._id === activeId;
              const locked = isTasksLocked(p);
              return (
                <div
                  key={p._id}
                  className={`selected-rect-box ${active ? "active" : ""} ${p.completed ? "done" : ""}`}
                  onClick={(e) => {
                    onSelect?.(p);
                    if (onOpenTopics) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onOpenTopics(p, rect);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(p);
                      if (onOpenTopics) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onOpenTopics(p, rect);
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Click to view tasks for ${p.name}`}
                >
                  <div className="selected-rect-top">
                    <div className="selected-rect-top-left">
                      <span className="mini-glass" aria-hidden="true">
                        <span
                          className="mini-sand"
                          style={{ height: `${progress * 100}%` }}
                        />
                      </span>
                      <WorkFolderStats
                        project={p}
                        allProjects={projects}
                        layout="card"
                      />
                    </div>
                    {fillLabel(p.elapsedMs, duration) ? (
                      <span className="selected-rect-time">
                        {fillLabel(p.elapsedMs, duration)}
                      </span>
                    ) : null}
                  </div>

                  <div className="selected-rect-body">
                    <strong className="selected-rect-name" title={p.name}>
                      {p.name}
                    </strong>
                    {locked || p.originId || p.sharedTemplateId ? (
                      <span
                        className="work-lock-pill"
                        title="Tasks sync from creator — new update added"
                      >
                        {p.originMode === "assign" ? "CONTRIBUTION" : "FOLLOWING"}
                      </span>
                    ) : null}
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

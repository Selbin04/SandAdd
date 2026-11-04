import { isTasksLocked } from "../lib/liveWorks.js";
import { useHorizontalScroll } from "../lib/useHorizontalScroll.js";
import WorkFolderStats from "./WorkFolderStats.jsx";
import { getCardAvatar, getCardCreatorName, getCardInitial } from "../lib/projectCardAvatar.js";

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
              const active = p._id === activeId;
              const locked = isTasksLocked(p);
              const avatarSrc = getCardAvatar(p);
              const initial = getCardInitial(p);
              const creatorName = getCardCreatorName(p);
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
                      <div className="project-card-info">
                        <strong className="project-card-title-wrap">
                          <span className="selected-rect-name" title={p.name}>
                            {p.name}
                          </span>
                          {locked || p.originId || p.sharedTemplateId ? (
                            <span
                              className="work-lock-pill"
                              title="Tasks sync from creator — new update added"
                            >
                              {p.originMode === "assign" ? "CONTRIBUTION" : "FOLLOWING"}
                            </span>
                          ) : null}
                        </strong>
                        {p.about?.trim() ? (
                          <p className="project-card-about-preview" title={p.about.trim()}>
                            {p.about.trim()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="selected-rect-bottom">
                    <div className="selected-rect-bottom-left">
                      <WorkFolderStats
                        project={p}
                        allProjects={projects}
                        layout="card"
                      />
                    </div>

                    <div
                      className="project-card-avatar-wrap"
                      title={creatorName ? `Created by ${creatorName}` : "Creator profile"}
                    >
                      {avatarSrc ? (
                        <img src={avatarSrc} className="project-card-avatar" alt={creatorName} />
                      ) : (
                        <span className="project-card-avatar-fallback">{initial}</span>
                      )}
                    </div>
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

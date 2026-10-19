import { useEffect, useRef, useState } from "react";
import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { getProjectCreator, isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";
import FolderHourglassModal from "./FolderHourglassModal.jsx";

export default function ProjectPanel({
  title,
  projects,
  activeId,
  storage,
  showStorage = false,
  showCreate = false,
  newName = "",
  onNewName,
  onCreate,
  onSelect,
  onDelete,
  onToggleImportant,
  importantAction = "add",
  emptyText,
  onOpenTopics,
  onOpenWork,
  onSetStars,
  onShareFollow,
  onShareAssign,
  folders = [],
  onMoveToFolder,
  onCreateFolder,
  onDeleteFolder,
  activeFolderId = null,
  onSelectFolder,
  allProjects = [],
}) {
  const sentinelRef = useRef(null);
  const [isFloating, setIsFloating] = useState(false);
  const [hourglassFolder, setHourglassFolder] = useState(null);

  useEffect(() => {
    if (!showCreate) return;

    const checkFloating = () => {
      if (
        typeof window === "undefined" ||
        window.innerWidth > 768 ||
        !sentinelRef.current
      ) {
        setIsFloating(false);
        return;
      }
      const rect = sentinelRef.current.getBoundingClientRect();
      const threshold = window.innerHeight - 70;
      if (rect.top > threshold) {
        setIsFloating(true);
      } else {
        setIsFloating(false);
      }
    };

    checkFloating();
    window.addEventListener("scroll", checkFloating, { passive: true });
    window.addEventListener("resize", checkFloating, { passive: true });
    return () => {
      window.removeEventListener("scroll", checkFloating);
      window.removeEventListener("resize", checkFloating);
    };
  }, [showCreate]);

  const activeFolder =
    activeFolderId && folders
      ? folders.find((f) => f.id === activeFolderId) || null
      : null;

  const unfiledCount = (allProjects.length > 0 ? allProjects : projects).filter(
    (p) => !p.folderId
  ).length;

  return (
    <aside
      className={`panel projects-panel ${importantAction === "remove" ? "important-panel" : ""}`}
    >
      <header className="panel-head">
        <h2>{title}</h2>
        <div className="panel-head-actions">
          {importantAction === "remove" && (
            <span className="storage-pill">{projects.length}</span>
          )}
          {showStorage && (
            <span className={`storage-pill ${storage}`}>{storage}</span>
          )}
        </div>
      </header>

      {showCreate && (
        <>
          <div ref={sentinelRef} className="new-project-sentinel" />
          <form
            className={`new-project ${isFloating ? "is-floating-mobile" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              onCreate();
            }}
          >
            <input
              type="text"
              maxLength={80}
              placeholder={
                activeFolder
                  ? `Create progress in "${activeFolder.name}"…`
                  : "Create New Progress Path"
              }
              value={newName}
              onChange={(e) => onNewName(e.target.value)}
            />
            <button type="submit" className="chip active">
              Save
            </button>
          </form>

          {/* New folders used to arrange the progress folders, ordered horizontally in rectangle small boxes */}
          <div className="folder-arrange-bar">
            <div className="folder-arrange-label-wrap">
              <span className="folder-arrange-title">Folders</span>
              <span className="folder-arrange-hint">Arrange progress paths</span>
            </div>

            <div className="folder-boxes-scroll-wrapper">
              <div
                className="folder-boxes-row"
                role="tablist"
                aria-label="Progress folders"
              >
                {/* Box 1: "All Paths" / Unfiled */}
                <button
                  type="button"
                  className={`folder-rect-box ${activeFolderId === null ? "is-active" : ""}`}
                  onClick={() => onSelectFolder?.(null)}
                  role="tab"
                  aria-selected={activeFolderId === null}
                  title="All unfiled progress folders"
                >
                  <div className="folder-rect-top">
                    <span className="folder-rect-icon">📁</span>
                    <span className="folder-rect-badge">{unfiledCount}</span>
                  </div>
                  <div className="folder-rect-name">All Paths</div>
                  <div className="folder-rect-sub">Unfiled progress</div>
                </button>

                {/* Box 2..N: Folders used to arrange progress folders */}
                {folders.map((folder) => {
                  const count = (allProjects.length > 0 ? allProjects : projects).filter(
                    (p) => p.folderId === folder.id
                  ).length;
                  const isSelected = activeFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      className={`folder-rect-box ${isSelected ? "is-active" : ""}`}
                      onClick={() => onSelectFolder?.(folder.id)}
                      role="tab"
                      aria-selected={isSelected}
                      tabIndex={0}
                      title={`Folder: ${folder.name}`}
                    >
                      <div className="folder-rect-top">
                        <span className="folder-rect-icon">📂</span>
                        <span className="folder-rect-badge">{count}</span>
                        <div
                          className="folder-rect-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="folder-rect-action-btn hourglass"
                            title={`Hourglass & Progress for ${folder.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHourglassFolder(folder);
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M5 22h14" />
                              <path d="M5 2h14" />
                              <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                            </svg>
                          </button>
                          {onDeleteFolder ? (
                            <button
                              type="button"
                              className="folder-rect-action-btn delete"
                              title={`Delete folder ${folder.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFolder(folder);
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="folder-rect-name" title={folder.name}>
                        {folder.name}
                      </div>
                      <div className="folder-rect-sub">
                        {count} {count === 1 ? "path" : "paths"}
                      </div>
                    </div>
                  );
                })}

                {/* "+ New Folder" rectangle small box */}
                {onCreateFolder ? (
                  <button
                    type="button"
                    className="folder-rect-box is-new-folder-box"
                    onClick={onCreateFolder}
                    title="Create new folder to arrange progress folders"
                  >
                    <div className="folder-rect-top">
                      <span className="folder-new-plus-icon">+</span>
                      <span className="folder-new-tag">NEW</span>
                    </div>
                    <div className="folder-rect-name">New Folder</div>
                    <div className="folder-rect-sub">Arrange progress</div>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {activeFolder && (
        <div className="folder-active-filter-strip">
          <span className="folder-active-filter-text">
            Viewing: <strong>{activeFolder.name}</strong>
          </span>
          <button
            type="button"
            className="folder-clear-filter-btn"
            onClick={() => onSelectFolder?.(null)}
          >
            Show All Paths
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : importantAction === "remove" ? (
        <div className="important-boxes-scroll-wrapper">
          <div
            className="important-boxes-row"
            role="list"
            aria-label="Important progress folders"
          >
            {projects.map((p) => {
              const duration = projectDuration(p);
              const progress = fillProgress(p.elapsedMs, duration);
              const active = p._id === activeId;
              const locked = isTasksLocked(p);
              const markLabel = `Remove ${p.name} from important`;
              return (
                <div
                  key={p._id}
                  className={`important-rect-box ${active ? "is-active" : ""} ${p.completed ? "done" : ""}`}
                  onClick={() => (onOpenWork ? onOpenWork(p) : onSelect(p))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (onOpenWork) onOpenWork(p);
                      else onSelect(p);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onOpenTopics(p, rect);
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Open ${p.name}`}
                >
                  {locked || p.originId || p.sharedTemplateId ? (
                    <span
                      className="update-red-dot corner-red-dot"
                      title="New update added in this progress path"
                    />
                  ) : null}

                  <div className="important-rect-top">
                    <div className="important-rect-top-left">
                      <span className="mini-glass" aria-hidden="true">
                        <span
                          className="mini-sand"
                          style={{ height: `${progress * 100}%` }}
                        />
                      </span>
                      <span className="important-rect-time">
                        {fillLabel(p.elapsedMs, duration)}
                      </span>
                    </div>

                    <div
                      className="important-rect-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <WorkMenu
                        workName={p.name}
                        onShareFollow={
                          locked ? undefined : () => onShareFollow?.(p)
                        }
                        onShareAssign={
                          locked ? undefined : () => onShareAssign?.(p)
                        }
                        folders={folders}
                        currentFolderId={p.folderId || null}
                        onMoveToFolder={
                          onMoveToFolder
                            ? (folderId) => onMoveToFolder(p, folderId)
                            : undefined
                        }
                        onDelete={() => onDelete(p._id)}
                      />
                      <button
                        type="button"
                        className="important-rect-star-btn is-on"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleImportant(p, false);
                        }}
                        aria-label={markLabel}
                        title={markLabel}
                      >
                        ★
                      </button>
                    </div>
                  </div>

                  <div className="important-rect-body">
                    <div className="important-rect-name" title={p.name}>
                      {p.name}
                    </div>
                    {locked || p.originId || p.sharedTemplateId ? (
                      <span
                        className="work-lock-pill"
                        title="Tasks sync from creator — new update added"
                      >
                        {p.originMode === "assign" ? "CONTRIB" : "FOLLOW"}
                      </span>
                    ) : null}
                  </div>

                  <div className="important-rect-foot">
                    {onSetStars ? (
                      <span
                        className="priority-stars"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {[1, 2, 3, 4, 5].map((n) => {
                          const current = Number(p.stars) || 0;
                          return (
                            <span
                              key={n}
                              role="button"
                              tabIndex={0}
                              className={`star-btn ${n <= current ? "is-on" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStars(p, n === current ? 0 : n);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onSetStars(p, n === current ? 0 : n);
                                }
                              }}
                              aria-label={`Set ${p.name} to ${n} star${n === 1 ? "" : "s"}`}
                            >
                              ★
                            </span>
                          );
                        })}
                      </span>
                    ) : null}
                    <div className="important-rect-track" aria-hidden="true">
                      <span
                        className="important-rect-fill"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="project-list">
          {projects.map((p) => {
            const duration = projectDuration(p);
            const progress = fillProgress(p.elapsedMs, duration);
            const active = p._id === activeId;
            const locked = isTasksLocked(p);
            const markLabel =
              importantAction === "add"
                ? `Add ${p.name} to important`
                : `Remove ${p.name} from important`;
            return (
              <li
                key={p._id}
                className={`${active ? "active" : ""} ${p.completed ? "done" : ""}`}
              >
                {locked || p.originId || p.sharedTemplateId ? (
                  <span
                    className="update-red-dot corner-red-dot"
                    title="New update added in this progress path"
                  />
                ) : null}
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
                    <span
                      className="mini-sand"
                      style={{ height: `${progress * 100}%` }}
                    />
                  </span>
                  <span className="project-copy">
                    <strong>
                      {p.name}
                      {locked || p.originId || p.sharedTemplateId ? (
                        <span
                          className="work-lock-pill"
                          title="Tasks sync from creator — new update added"
                        >
                          {p.originMode === "assign" ? "CONTRIBUTION" : "FOLLOWING"}
                        </span>
                      ) : null}
                    </strong>
                    <span>{fillLabel(p.elapsedMs, duration)}</span>
                    <span className="project-progress-track" aria-hidden="true">
                      <span style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                    {importantAction === "remove" && (
                      <span
                        className="priority-stars"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {[1, 2, 3, 4, 5].map((n) => {
                          const current = Number(p.stars) || 0;
                          return (
                            <span
                              key={n}
                              role="button"
                              tabIndex={0}
                              className={`star-btn ${n <= current ? "is-on" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStars(p, n === current ? 0 : n);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onSetStars(p, n === current ? 0 : n);
                                }
                              }}
                              aria-label={`Set ${p.name} to ${n} star${n === 1 ? "" : "s"}`}
                            >
                              ★
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </span>
                </button>
                {onOpenWork ? (
                  <button
                    type="button"
                    className="open-work-btn"
                    aria-label={`Open ${p.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWork(p);
                    }}
                  >
                    Open
                  </button>
                ) : null}
                <WorkMenu
                  workName={p.name}
                  onShareFollow={
                    locked ? undefined : () => onShareFollow?.(p)
                  }
                  onShareAssign={
                    locked ? undefined : () => onShareAssign?.(p)
                  }
                  folders={folders}
                  currentFolderId={p.folderId || null}
                  onMoveToFolder={
                    onMoveToFolder
                      ? (folderId) => onMoveToFolder(p, folderId)
                      : undefined
                  }
                  onDelete={() => onDelete(p._id)}
                />
                <button
                  type="button"
                  className={`mark-important ${importantAction === "remove" ? "is-on" : ""}`}
                  onClick={() => onToggleImportant(p, importantAction === "add")}
                  aria-label={markLabel}
                  title={markLabel}
                >
                  ★
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hourglassFolder && (
        <FolderHourglassModal
          folder={hourglassFolder}
          projects={(allProjects.length > 0 ? allProjects : projects).filter(
            (p) => p.folderId === hourglassFolder.id
          )}
          onClose={() => setHourglassFolder(null)}
          onOpenWork={onOpenWork}
        />
      )}
    </aside>
  );
}

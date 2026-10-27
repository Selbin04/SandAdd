import { useEffect, useRef, useState } from "react";
import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { getProjectCreator, getNotificationCount, isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";
import FolderHourglassModal from "./FolderHourglassModal.jsx";
import { useHorizontalScroll } from "../lib/useHorizontalScroll.js";
import WorkFolderStats from "./WorkFolderStats.jsx";

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
  const folderScroll = useHorizontalScroll();
  const importantScroll = useHorizontalScroll();

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

          {/* Folders used to arrange progress folders */}
          <div className="folder-arrange-bar">
            <div className="folder-arrange-label-wrap">
              <div className="folder-arrange-title-group">
                <span className="folder-arrange-title">Folders</span>
              </div>
              <div className="folder-scroll-controls">
                <button
                  type="button"
                  className={`folder-scroll-arrow ${!folderScroll.canScrollLeft ? "is-disabled" : ""}`}
                  onClick={() => folderScroll.scrollByAmount(-220)}
                  disabled={!folderScroll.canScrollLeft}
                  title="Scroll left"
                  aria-label="Scroll left"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`folder-scroll-arrow ${!folderScroll.canScrollRight ? "is-disabled" : ""}`}
                  onClick={() => folderScroll.scrollByAmount(220)}
                  disabled={!folderScroll.canScrollRight}
                  title="Scroll right"
                  aria-label="Scroll right"
                >
                  ›
                </button>
              </div>
            </div>

            <div
              ref={folderScroll.elRef}
              className="folder-boxes-scroll-wrapper"
            >
              <div
                className="folder-boxes-row folder-titles-row"
                role="tablist"
                aria-label="Progress folders"
              >
                {/* Title: "All Paths" */}
                {(() => {
                  const unfiled = (allProjects.length > 0 ? allProjects : projects).filter(
                    (p) => !p.folderId
                  );
                  const hasUpdates = unfiled.some(
                    (p) => isTasksLocked(p) || p.originId || p.sharedTemplateId || Boolean(p.notificationCount)
                  );
                  const notifCount = hasUpdates
                    ? unfiled.reduce(
                        (sum, p) =>
                          isTasksLocked(p) || p.originId || p.sharedTemplateId || Boolean(p.notificationCount)
                            ? sum + getNotificationCount(p)
                            : sum,
                        0
                      )
                    : 0;
                  const isSelected = activeFolderId === null;
                  return (
                    <button
                      type="button"
                      className={`folder-title-pill ${isSelected ? "is-active" : ""}`}
                      onClick={() => onSelectFolder?.(null)}
                      role="tab"
                      aria-selected={isSelected}
                      title="All Paths"
                    >
                      {hasUpdates && (
                        <span
                          className="update-red-dot corner-red-dot"
                          title={`${notifCount} new updates`}
                        >
                          {notifCount > 99 ? "99+" : notifCount}
                        </span>
                      )}
                      <span className="folder-title-name">All Paths</span>
                      <span className="folder-title-count">{unfiledCount}</span>
                    </button>
                  );
                })()}

                {/* Arranged Folder Titles */}
                {folders.map((folder) => {
                  const folderProjects = (allProjects.length > 0 ? allProjects : projects).filter(
                    (p) => String(p.folderId || "") === String(folder.id)
                  );
                  const count = folderProjects.length;
                  const isSelected = activeFolderId === folder.id;
                  const hasUpdates = folderProjects.some(
                    (p) => isTasksLocked(p) || p.originId || p.sharedTemplateId || Boolean(p.notificationCount)
                  );
                  const notifCount = hasUpdates
                    ? folderProjects.reduce(
                        (sum, p) =>
                          isTasksLocked(p) || p.originId || p.sharedTemplateId || Boolean(p.notificationCount)
                            ? sum + getNotificationCount(p)
                            : sum,
                        0
                      )
                    : 0;
                  return (
                    <div
                      key={folder.id}
                      className={`folder-title-pill ${isSelected ? "is-active" : ""}`}
                      onClick={() => onSelectFolder?.(folder.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setHourglassFolder(folder);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectFolder?.(folder.id);
                        }
                      }}
                      role="tab"
                      aria-selected={isSelected}
                      tabIndex={0}
                      title={folder.name}
                    >
                      {hasUpdates && (
                        <span
                          className="update-red-dot corner-red-dot"
                          title={`${notifCount} new updates`}
                        >
                          {notifCount > 99 ? "99+" : notifCount}
                        </span>
                      )}
                      <span className="folder-title-name">{folder.name}</span>
                      <span className="folder-title-count">{count}</span>
                      <div
                        className="folder-title-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="folder-title-action-btn hourglass"
                          title="Hourglass & progress"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHourglassFolder(folder);
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
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
                            className="folder-title-action-btn delete"
                            title="Delete folder"
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
                  );
                })}

                {/* "+ New Folder" Title Button */}
                {onCreateFolder ? (
                  <button
                    type="button"
                    className="folder-title-pill is-new-folder"
                    onClick={onCreateFolder}
                    title="New folder"
                  >
                    <span className="folder-title-plus">+</span>
                    <span className="folder-title-name">New Folder</span>
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
            <strong>{activeFolder.name}</strong>
          </span>
          <button
            type="button"
            className="folder-clear-filter-btn"
            onClick={() => onSelectFolder?.(null)}
          >
            All Paths
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <>
          {importantAction === "remove" && (
            <div
              ref={importantScroll.elRef}
              className="important-boxes-scroll-wrapper important-mobile-view"
            >
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
                      key={`mob-${p._id}`}
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
                      {locked || p.originId || p.sharedTemplateId || Boolean(p.notificationCount) ? (
                        <span
                          className="update-red-dot corner-red-dot"
                          title={`${getNotificationCount(p)} new updates in this progress path`}
                        >
                          {getNotificationCount(p)}
                        </span>
                      ) : null}

                      <div className="important-rect-top">
                        <div className="important-rect-top-left">
                          <span className="mini-glass" aria-hidden="true">
                            <span
                              className="mini-sand"
                              style={{ height: `${progress * 100}%` }}
                            />
                          </span>
                          <WorkFolderStats
                            project={p}
                            allProjects={allProjects.length > 0 ? allProjects : projects}
                            layout="card"
                          />
                          {fillLabel(p.elapsedMs, duration) ? (
                            <span className="important-rect-time">
                              {fillLabel(p.elapsedMs, duration)}
                            </span>
                          ) : null}
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
                            onRemoveImportant={() => onToggleImportant?.(p, false)}
                            onDelete={() => onDelete(p._id)}
                          />
                        </div>
                      </div>

                      <div className="important-rect-body">
                        <div className="important-rect-name" title={p.name}>
                          {p.name}
                        </div>
                        {locked || p.originId || p.sharedTemplateId ? (
                          <span
                            className="work-lock-pill important-work-lock-pill"
                            title="Tasks sync from creator — new update added"
                          >
                            {p.originMode === "assign" ? "CONTRIBUTION" : "FOLLOWING"}
                          </span>
                        ) : null}
                      </div>

                      <div className="important-rect-foot">
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
          )}

          <ul
            className={`project-list ${importantAction === "remove" ? "important-desktop-view" : ""}`}
          >
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
                role="button"
                tabIndex={0}
                title={`Open ${p.name}`}
                onClick={() => (onOpenWork ? onOpenWork(p) : onSelect(p))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (onOpenWork) onOpenWork(p);
                    else onSelect(p);
                  }
                }}
              >
                {locked || p.originId || p.sharedTemplateId || Boolean(p.notificationCount) ? (
                  <span
                    className="update-red-dot corner-red-dot"
                    title={`${getNotificationCount(p)} new updates in this progress path`}
                  >
                    {getNotificationCount(p)}
                  </span>
                ) : null}
                <div
                  className="project-select"
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
                      <span className="project-title-text" title={p.name}>
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
                    {fillLabel(p.elapsedMs, duration) ? (
                      <span>{fillLabel(p.elapsedMs, duration)}</span>
                    ) : null}
                    <span className="project-progress-track" aria-hidden="true">
                      <span style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  </span>
                </div>
                <div
                  className="project-row-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WorkFolderStats
                    project={p}
                    allProjects={allProjects.length > 0 ? allProjects : projects}
                    layout="row"
                  />
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
                    onRemoveImportant={
                      importantAction === "remove"
                        ? () => onToggleImportant?.(p, false)
                        : undefined
                    }
                    onToggleImportant={
                      onToggleImportant
                        ? () => onToggleImportant(p, !p.important)
                        : undefined
                    }
                    isImportant={Boolean(p.important)}
                    onDelete={() => onDelete(p._id)}
                  />
                  <button
                    type="button"
                    className={`mark-important ${importantAction === "remove" ? "is-on" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleImportant(p, importantAction === "add");
                    }}
                    aria-label={markLabel}
                    title={markLabel}
                  >
                    ★
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {hourglassFolder && (
        <FolderHourglassModal
          folder={hourglassFolder}
          projects={(allProjects.length > 0 ? allProjects : projects).filter(
            (p) => String(p.folderId || "") === String(hourglassFolder.id)
          )}
          onClose={() => setHourglassFolder(null)}
          onOpenWork={onOpenWork}
        />
      )}
    </aside>
  );
}

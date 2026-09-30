import { useState, useEffect } from "react";
import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";

const PLACEHOLDERS = ["New work name", "create new learning.."];

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
}) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className={`panel projects-panel ${importantAction === "remove" ? "important-panel" : ""}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        <div className="panel-head-actions">
          {showStorage && (
            <span className={`storage-pill ${storage}`}>{storage}</span>
          )}
          {onCreateFolder ? (
            <button
              type="button"
              className="create-folder-btn"
              onClick={onCreateFolder}
            >
              Create new folder
            </button>
          ) : null}
        </div>
      </header>

      {showCreate && (
        <form
          className="new-project"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate();
          }}
        >
          <input
            type="text"
            maxLength={80}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            value={newName}
            onChange={(e) => onNewName(e.target.value)}
          />
          <button type="submit" className="chip active">
            Save
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="empty">{emptyText}</p>
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
                    <strong>
                      {p.name}
                      {locked ? (
                        <span className="work-lock-pill" title="Tasks sync from creator">
                          {p.originMode === "assign" ? "Assigned" : "Following"}
                        </span>
                      ) : null}
                    </strong>
                    <span>{fillLabel(p.elapsedMs, duration)}</span>
                    {importantAction === "remove" && (
                      <span
                        className="priority-stars"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        {[1, 2, 3, 4, 5].map((n) => {
                          const current = Number(p.stars) || 0;
                          return (
                            <button
                              key={n}
                              type="button"
                              className={n <= current ? "is-on" : ""}
                              onClick={() => onSetStars(p, n === current ? 0 : n)}
                              aria-label={`Set ${p.name} to ${n} star${n === 1 ? "" : "s"}`}
                            >
                              ★
                            </button>
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
    </aside>
  );
}

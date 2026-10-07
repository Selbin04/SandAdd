import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { getProjectCreator, isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";
import "./FolderPanel.css";

export default function FolderPanel({
  folder,
  projects,
  activeId,
  folders = [],
  onSelect,
  onOpenWork,
  onDelete,
  onToggleImportant,
  onOpenTopics,
  onShareFollow,
  onShareAssign,
  onMoveToFolder,
  onDeleteFolder,
}) {
  return (
    <aside className="panel folder-panel">
      <header className="panel-head folder-panel-head">
        <h2>{folder.name}</h2>
        <button
          type="button"
          className="folder-delete-btn"
          onClick={() => onDeleteFolder?.(folder)}
          aria-label={`Delete folder ${folder.name}`}
          title="Delete folder (projects return to the Projects list)"
        >
          ×
        </button>
      </header>

      {projects.length === 0 ? (
        <p className="empty">No progress in this folder yet.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => {
            const duration = projectDuration(p);
            const progress = fillProgress(p.elapsedMs, duration);
            const active = p._id === activeId;
            const locked = isTasksLocked(p);
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
                    const rect = e.currentTarget
                      .closest("li")
                      .getBoundingClientRect();
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
                {locked || p.originId || p.sharedTemplateId ? (
                  <button
                    type="button"
                    className="open-work-btn group-work-btn"
                    aria-label={`Open group for ${p.name}`}
                    title="Open group chat & updates"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWork?.(p);
                    }}
                  >
                    💬 Group
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
                  className="mark-important"
                  onClick={() => onToggleImportant(p, true)}
                  aria-label={`Add ${p.name} to important`}
                  title={`Add ${p.name} to important`}
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

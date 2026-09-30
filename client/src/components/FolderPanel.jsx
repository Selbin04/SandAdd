import { useState } from "react";
import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import { isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";
import "./FolderPanel.css";

export default function FolderPanel({
  folder,
  projects,
  addableWorks = [],
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
  const [addId, setAddId] = useState("");

  return (
    <aside className="panel folder-panel">
      <header className="panel-head folder-panel-head">
        <h2>{folder.name}</h2>
        <button
          type="button"
          className="folder-delete-btn"
          onClick={() => onDeleteFolder?.(folder)}
          aria-label={`Delete folder ${folder.name}`}
          title="Delete folder (works return to Works)"
        >
          ×
        </button>
      </header>

      {addableWorks.length > 0 ? (
        <form
          className="folder-add-work"
          onSubmit={(e) => {
            e.preventDefault();
            if (!addId) return;
            const work = addableWorks.find((p) => p._id === addId);
            if (work) onMoveToFolder?.(work, folder.id);
            setAddId("");
          }}
        >
          <select
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            aria-label={`Add work to ${folder.name}`}
          >
            <option value="">Add a work…</option>
            {addableWorks.map((work) => (
              <option key={work._id} value={work._id}>
                {work.name}
              </option>
            ))}
          </select>
          <button type="submit" className="chip active" disabled={!addId}>
            Add
          </button>
        </form>
      ) : null}

      {projects.length === 0 ? (
        <p className="empty">
          {addableWorks.length > 0
            ? "Pick a work above to add it here."
            : "No works in this folder yet."}
        </p>
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
                      {locked ? (
                        <span
                          className="work-lock-pill"
                          title="Tasks sync from creator"
                        >
                          {p.originMode === "assign" ? "Assigned" : "Following"}
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

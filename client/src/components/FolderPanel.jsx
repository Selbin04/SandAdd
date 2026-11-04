import { useEffect, useState } from "react";
import { getProjectCreator, getNotificationCount, isTasksLocked } from "../lib/liveWorks.js";
import WorkMenu from "./WorkMenu.jsx";
import WorkFolderStats from "./WorkFolderStats.jsx";
import { getCardAvatar, getCardCreatorName, getCardInitial } from "../lib/projectCardAvatar.js";
import "./FolderPanel.css";

export default function FolderPanel({
  folder,
  projects,
  allFolderProjects,
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
  onCreateInFolder,
}) {
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [, setAvatarUpdateTick] = useState(0);

  useEffect(() => {
    const onAvatarChange = () => setAvatarUpdateTick((t) => t + 1);
    window.addEventListener("sandadd:avatar-changed", onAvatarChange);
    window.addEventListener("sandadd:profile-updated", onAvatarChange);
    window.addEventListener("storage", onAvatarChange);
    return () => {
      window.removeEventListener("sandadd:avatar-changed", onAvatarChange);
      window.removeEventListener("sandadd:profile-updated", onAvatarChange);
      window.removeEventListener("storage", onAvatarChange);
    };
  }, []);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    onCreateInFolder?.(folder.id, name);
    setNewFileName("");
    setShowAddFile(false);
  };

  return (
    <aside className="panel folder-panel">
      <header className="panel-head folder-panel-head">
        <h2>{folder.name}</h2>
        <div className="folder-head-actions">
          {onCreateInFolder && (
            <button
              type="button"
              className={`folder-round-add-btn ${showAddFile ? "is-open" : ""}`}
              onClick={() => setShowAddFile((prev) => !prev)}
              aria-label={showAddFile ? "Close add file field" : "Add progress file to folder"}
              title={showAddFile ? "Close field" : "Add progress file to folder"}
            >
              <span className="folder-round-add-icon">{showAddFile ? "×" : "+"}</span>
            </button>
          )}
          <button
            type="button"
            className="folder-delete-btn"
            onClick={() => onDeleteFolder?.(folder)}
            aria-label={`Delete folder ${folder.name}`}
            title="Delete folder (projects return to the Projects list)"
          >
            ×
          </button>
        </div>
      </header>

      {showAddFile && (
        <form className="folder-add-file-form" onSubmit={handleAddSubmit}>
          <input
            type="text"
            maxLength={80}
            placeholder="New Progress File name…"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="chip active">
            Add
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <p className="empty">No progress in this folder yet.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => {
            const active = p._id === activeId;
            const locked = isTasksLocked(p);
            const avatarSrc = getCardAvatar(p);
            const initial = getCardInitial(p);
            const creatorName = getCardCreatorName(p);
            return (
              <li
                key={p._id}
                className={`${active ? "active" : ""} ${p.completed ? "done" : ""}`}
                role="button"
                tabIndex={0}
                title={`Open ${p.name}`}
                onClick={() => (onOpenWork ? onOpenWork(p) : onSelect(p))}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenTopics(p, rect);
                }}
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

                {/* Top Row: Mini-glass + Title on left; WorkMenu + Star on right */}
                <div className="project-card-top">
                  <div className="project-card-top-left">
                    <div className="project-card-info">
                      <strong className="project-card-title-wrap">
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
                      {p.about?.trim() ? (
                        <p className="project-card-about-preview" title={p.about.trim()}>
                          {p.about.trim()}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className="project-card-top-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <WorkFolderStats
                      project={p}
                      allProjects={allFolderProjects || projects}
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
                      className={`mark-important ${p.important ? "is-on" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleImportant(p, !p.important);
                      }}
                      aria-label={`Toggle important for ${p.name}`}
                      title={p.important ? `Remove ${p.name} from important` : `Add ${p.name} to important`}
                    >
                      ★
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Circular Avatar on right */}
                <div className="project-card-bottom">
                  <div
                    className="project-card-bottom-right"
                    onClick={(e) => e.stopPropagation()}
                  >
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
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

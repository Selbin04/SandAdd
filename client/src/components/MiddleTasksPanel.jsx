import { useEffect, useRef, useState } from "react";
import { elapsedFromWorks, projectDuration } from "../lib/time.js";
import { getProjectCreator, getProjectCreatorTagline } from "../lib/liveWorks.js";
import { getLocalPostsForTopic } from "../lib/socialFeed.js";
import "./MiddleTasksPanel.css";

export default function MiddleTasksPanel({
  project,
  onClose,
  onToggleTask,
  onAddTask,
  onRemoveTask,
  onShareProgress,
  onReset,
  isLocked = false,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [hasCheckbox, setHasCheckbox] = useState(true);
  const formRef = useRef(null);

  useEffect(() => {
    if (!showAddForm) return undefined;
    const handleOutsideClick = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("touchstart", handleOutsideClick, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
    };
  }, [showAddForm]);

  if (!project) return null;

  const topics = Array.isArray(project.topics) ? project.topics : [];
  const checkableTopics = topics.filter((t) => t && t.hasCheckbox !== false);
  let duration = projectDuration(project);
  if (!duration || duration <= 0) duration = 30_000;

  const elapsedMs =
    checkableTopics.length > 0
      ? elapsedFromWorks(topics, duration)
      : Number(project.elapsedMs) || 0;
  const progress = duration > 0 ? Math.min(1, elapsedMs / duration) : 0;
  const completed = progress >= 1;
  const doneCount = checkableTopics.filter((t) => t.done).length;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text || isLocked) return;
    onAddTask(text, { hasCheckbox });
    setNewTaskText("");
  };

  return (
    <div className="middle-tasks-panel">
      <header className="middle-tasks-header">
        <div className="middle-tasks-title-group">
          {(() => {
            const creator = getProjectCreator(project);
            const tagline = getProjectCreatorTagline(project);
            if (!tagline && !creator?.name) return null;
            return (
              <div className="middle-tasks-creator-tagline" title={`Created by ${tagline || creator?.name}`}>
                <span className="middle-creator-by">by</span>
                <span className="middle-creator-name">{creator?.name || tagline}</span>
                {creator?.handle ? (
                  <span className="middle-creator-handle">@{creator.handle}</span>
                ) : null}
              </div>
            );
          })()}
          <span
            className={`middle-tasks-badge ${
              completed ? "is-completed" : elapsedMs > 0 ? "is-active" : ""
            }`}
          >
            {completed ? "✓ Finished" : elapsedMs > 0 ? "⚡ In Progress" : "○ Idle"}
          </span>
          <h2 className="middle-tasks-title">{project.name}</h2>
        </div>
        <button
          type="button"
          className="middle-tasks-close-btn"
          onClick={onClose}
          aria-label="Close task list"
          title="Close tasks"
        >
          ✕
        </button>
      </header>

      {/* Progress Bar */}
      <div className="middle-tasks-progress-box">
        <div className="middle-tasks-pct-info">
          <span>
            {doneCount} of {checkableTopics.length} tasks completed
          </span>
          <strong>{Math.round(progress * 100)}%</strong>
        </div>
        <div className="middle-tasks-progress-track">
          <div
            className="middle-tasks-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Task Checklist */}
      <div className="middle-tasks-body">
        <div className="middle-tasks-header-row">
          <h3 className="middle-tasks-subtitle">Tasks Checklist</h3>
          {!isLocked && (
            <button
              type="button"
              className="middle-tasks-add-quick-btn"
              onClick={() => setShowAddForm((v) => !v)}
              title={showAddForm ? "Close form" : "Push new task to top of stack"}
            >
              {showAddForm ? "✕ Cancel" : "+ Add Task"}
            </button>
          )}
        </div>

        {/* Add task input at top of stack */}
        {!isLocked && (
          <div className="middle-tasks-add-wrapper">
            {!showAddForm ? (
              <div className="middle-tasks-toggle-bar">
                <button
                  type="button"
                  className="middle-tasks-stack-trigger"
                  onClick={() => setShowAddForm(true)}
                  aria-label="Add new task to top of stack"
                  title="Add new task to top of stack"
                >
                  <span className="middle-tasks-stack-trigger-icon">+</span>
                  <span>Add task to top of stack…</span>
                  <span className="middle-tasks-stack-pill">TOP</span>
                </button>
              </div>
            ) : (
              <form ref={formRef} className="middle-tasks-add-form" onSubmit={handleAddSubmit}>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="middle-tasks-input"
                  autoFocus
                />
                <label className="middle-tasks-checkbox-opt" title="Uncheck to create a note line without a checkbox">
                  <input
                    type="checkbox"
                    checked={hasCheckbox}
                    onChange={(e) => setHasCheckbox(e.target.checked)}
                  />
                  <span>Checkbox</span>
                </label>
                <button
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="middle-tasks-add-btn"
                >
                  Add
                </button>
              </form>
            )}
          </div>
        )}

        {topics.length > 0 ? (
          <ul className="middle-tasks-list">
            {topics.map((t, idx) => {
              const showCheck = t.hasCheckbox !== false;
              const isTop = idx === 0;
              return (
                <li key={t.id || idx} className={`middle-task-item ${t.done ? "is-done" : ""} ${isTop ? "is-top-item" : ""}`}>
                  <div className="middle-task-row">
                    {showCheck ? (
                      <button
                        type="button"
                        className={`middle-tasks-check ${t.done ? "checked" : ""}`}
                        onClick={() => onToggleTask(t.id || t._id)}
                        aria-label="Toggle task"
                      >
                        {t.done ? "✓" : ""}
                      </button>
                    ) : null}
                    <span
                      className="middle-tasks-text"
                      onClick={() => showCheck && onToggleTask(t.id || t._id)}
                    >
                      {t.text}
                      {isTop ? <span className="middle-top-badge">TOP</span> : null}
                    </span>
                    {!isLocked && (
                      <button
                        type="button"
                        className="middle-tasks-delete-btn"
                        onClick={() => onRemoveTask(t.id || t._id)}
                        title="Delete task"
                      >
                        <span aria-hidden="true" style={{ fontSize: "16px", lineHeight: 1 }}>⋮</span>
                      </button>
                    )}
                  </div>

                  {/* Task Sources & File Proofs */}
                  {Array.isArray(t.sources) && t.sources.length > 0 ? (
                    <div className="task-sources-list">
                      {t.sources.map((s, sIdx) => {
                        const isLink = s.type === "link" || /^https?:\/\//i.test(s.content || "");
                        const isFile = s.type === "file" || Boolean(s.proof);
                        return (
                          <div key={s.id || sIdx} className="task-source-chip">
                            {isLink ? (
                              <a
                                href={s.content.startsWith("http") ? s.content : `https://${s.content}`}
                                target="_blank"
                                rel="noreferrer"
                                className="task-source-link"
                              >
                                🔗 {s.title ? `${s.title}: ${s.content}` : s.content}
                              </a>
                            ) : isFile ? (
                              <span className="task-source-file">
                                📎 {s.title ? `${s.title}: ` : ""}{s.proof?.name || s.content || "Attached file"}
                              </span>
                            ) : (
                              <span className="task-source-text">📝 {s.title ? `${s.title}: ` : ""}{s.content}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : t.source ? (
                    <div className="task-sources-list">
                      <div className="task-source-chip">
                        {/^https?:\/\//i.test(t.source) || /^[\w.-]+\.[a-z]{2,}/i.test(t.source) ? (
                          <a
                            href={t.source.startsWith("http") ? t.source : `https://${t.source}`}
                            target="_blank"
                            rel="noreferrer"
                            className="task-source-link"
                          >
                            🔗 {t.source}
                          </a>
                        ) : (
                          <span className="task-source-text">📝 {t.source}</span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {(() => {
                    const postsCount = t?.id ? getLocalPostsForTopic(t.id).length : 0;
                    if (postsCount === 0) return null;
                    return (
                      <div className="task-sources-list" style={{ marginTop: "4px" }}>
                        <div className="task-source-chip">
                          <span
                            className="task-source-text"
                            style={{
                              color: "var(--brass)",
                              fontWeight: 700,
                              borderColor: "rgba(0, 176, 255, 0.35)",
                              background: "rgba(0, 176, 255, 0.08)",
                            }}
                          >
                            💬 {postsCount} {postsCount === 1 ? "finish post" : "finish posts"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="middle-tasks-empty">
            <p>No tasks added to this stack yet. Add one above.</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer className="middle-tasks-footer">
        <button
          type="button"
          className="middle-tasks-action-btn primary"
          onClick={onShareProgress}
        >
          Share
        </button>

        <button
          type="button"
          className="middle-tasks-action-btn secondary"
          onClick={onReset}
        >
          Reset Work
        </button>
      </footer>
    </div>
  );
}

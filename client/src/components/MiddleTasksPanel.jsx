import { useState } from "react";
import { elapsedFromWorks, projectDuration } from "../lib/time.js";

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
  const [newTaskText, setNewTaskText] = useState("");

  if (!project) return null;

  const topics = Array.isArray(project.topics) ? project.topics : [];
  let duration = projectDuration(project);
  if (!duration || duration <= 0) duration = 30_000;

  const elapsedMs =
    topics.length > 0
      ? elapsedFromWorks(topics, duration)
      : Number(project.elapsedMs) || 0;
  const progress = duration > 0 ? Math.min(1, elapsedMs / duration) : 0;
  const completed = progress >= 1;
  const doneCount = topics.filter((t) => t.done).length;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text || isLocked) return;
    onAddTask(text);
    setNewTaskText("");
  };

  return (
    <div className="middle-tasks-panel">
      <header className="middle-tasks-header">
        <div className="middle-tasks-title-group">
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
            {doneCount} of {topics.length} tasks completed
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
        <h3 className="middle-tasks-subtitle">Tasks Checklist</h3>
        {topics.length > 0 ? (
          <ul className="middle-tasks-list">
            {topics.map((t, idx) => (
              <li key={t.id || idx} className={t.done ? "is-done" : ""}>
                <button
                  type="button"
                  className={`middle-tasks-check ${t.done ? "checked" : ""}`}
                  onClick={() => onToggleTask(t.id || t._id)}
                  aria-label="Toggle task"
                >
                  {t.done ? "✓" : ""}
                </button>
                <span
                  className="middle-tasks-text"
                  onClick={() => onToggleTask(t.id || t._id)}
                >
                  {t.text}
                </span>
                {!isLocked && (
                  <button
                    type="button"
                    className="middle-tasks-delete-btn"
                    onClick={() => onRemoveTask(t.id || t._id)}
                    title="Delete task"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="middle-tasks-empty">
            <p>No tasks added to this work yet.</p>
          </div>
        )}

        {/* Add task input */}
        {!isLocked && (
          <form className="middle-tasks-add-form" onSubmit={handleAddSubmit}>
            <input
              type="text"
              placeholder="+ Add a task item..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="middle-tasks-input"
            />
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

      {/* Footer Actions */}
      <footer className="middle-tasks-footer">
        <button
          type="button"
          className="middle-tasks-action-btn primary"
          onClick={onShareProgress}
        >
          Share Progress
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

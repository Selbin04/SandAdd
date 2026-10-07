import { useMemo } from "react";
import "./TaskSelector.css";

export default function TaskSelector({
  topics = [],
  mode = "all", // "all" | "select"
  onModeChange,
  selectedIds = new Set(),
  onToggleId,
  onSelectAll,
  onDeselectAll,
}) {
  const allTasks = useMemo(() => {
    if (!Array.isArray(topics)) return [];
    return topics
      .map((t, idx) => ({
        id: String(t?.id || `w-${idx}`),
        text: String(t?.text || "").trim(),
        done: Boolean(t?.done),
      }))
      .filter((t) => t.text);
  }, [topics]);

  if (allTasks.length === 0) {
    return (
      <div className="task-selector-empty">
        <small>No individual tasks defined in this project. Full progress will be shared.</small>
      </div>
    );
  }

  const selectedCount = mode === "all" ? allTasks.length : selectedIds.size;

  return (
    <div className="task-selector">
      <div className="task-selector-header">
        <label className="task-selector-label">Tasks to share</label>
        <div className="task-selector-modes" role="radiogroup" aria-label="Tasks selection mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === "all"}
            className={`task-mode-btn ${mode === "all" ? "is-active" : ""}`}
            onClick={() => onModeChange?.("all")}
          >
            Share all ({allTasks.length})
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "select"}
            className={`task-mode-btn ${mode === "select" ? "is-active" : ""}`}
            onClick={() => onModeChange?.("select")}
          >
            Select specific ({selectedCount})
          </button>
        </div>
      </div>

      {mode === "select" ? (
        <div className="task-selector-box">
          <div className="task-selector-actions">
            <span className="task-selector-count">
              {selectedIds.size} of {allTasks.length} selected
            </span>
            <div className="task-selector-action-btns">
              <button type="button" className="task-action-btn" onClick={onSelectAll}>
                Select all
              </button>
              <span className="task-action-sep">•</span>
              <button type="button" className="task-action-btn" onClick={onDeselectAll}>
                Deselect all
              </button>
            </div>
          </div>

          <div className="task-selector-list">
            {allTasks.map((t) => {
              const checked = selectedIds.has(t.id);
              return (
                <label key={t.id} className={`task-selector-item ${checked ? "is-checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleId?.(t.id)}
                  />
                  <span className="task-selector-text">{t.text}</span>
                  <span className={`task-selector-status ${t.done ? "is-done" : "is-pending"}`}>
                    {t.done ? "✓ Done" : "Pending"}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedIds.size === 0 && (
            <p className="task-selector-error">Please select at least 1 task to share.</p>
          )}
        </div>
      ) : (
        <div className="task-selector-preview">
          <span className="task-selector-preview-text">
            All {allTasks.length} {allTasks.length === 1 ? "task" : "tasks"} from this progress will be shared.
          </span>
        </div>
      )}
    </div>
  );
}

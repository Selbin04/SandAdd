import { useState } from "react";
import "./KanbanBoard.css";

const STICKY_COLORS = [
  "sticky-pink",
  "sticky-orange",
  "sticky-green",
  "sticky-blue",
  "sticky-yellow",
];

export default function KanbanBoard({ project, onUpdateTopics, activeName }) {
  const [newTaskText, setNewTaskText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const topics = Array.isArray(project?.topics) ? project.topics : [];

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const colorIndex = topics.length % STICKY_COLORS.length;
    const rot = (Math.sin(topics.length * 2.5) * 3).toFixed(1);
    const newTopic = {
      id: Math.random().toString(36).slice(2),
      text: newTaskText.trim(),
      status: "todo",
      done: false,
      color: STICKY_COLORS[colorIndex],
      rot: rot,
      createdAt: Date.now(),
    };
    const next = [...topics, newTopic];
    onUpdateTopics(next);
    setNewTaskText("");
  };

  const handleMoveStatus = (topicId, targetStatus) => {
    const next = topics.map((t) => {
      if (t.id === topicId || t._id === topicId) {
        return {
          ...t,
          status: targetStatus,
          done: targetStatus === "done",
        };
      }
      return t;
    });
    onUpdateTopics(next);
  };

  const handleToggleDone = (topicId) => {
    const next = topics.map((t) => {
      if (t.id === topicId || t._id === topicId) {
        const isDone = !t.done;
        return {
          ...t,
          done: isDone,
          status: isDone ? "done" : "todo",
        };
      }
      return t;
    });
    onUpdateTopics(next);
  };

  const handleDeleteTask = (topicId) => {
    const next = topics.filter((t) => t.id !== topicId && t._id !== topicId);
    onUpdateTopics(next);
  };

  const handleSaveEdit = (topicId) => {
    if (!editText.trim()) return;
    const next = topics.map((t) => {
      if (t.id === topicId || t._id === topicId) {
        return { ...t, text: editText.trim() };
      }
      return t;
    });
    onUpdateTopics(next);
    setEditingId(null);
    setEditText("");
  };

  // Organize tasks by column
  const todoTasks = topics.filter((t) => !t.done && (t.status === "todo" || !t.status));
  const inProgressTasks = topics.filter((t) => !t.done && t.status === "in_progress");
  const doneTasks = topics.filter((t) => t.done || t.status === "done");

  const totalCount = topics.length;
  const doneCount = doneTasks.length;

  if (!project) {
    return (
      <div className="wb-container">
        <div className="wb-board wb-empty">
          <div className="wb-header-row">
            <div className="wb-col-head">To do</div>
            <div className="wb-col-head">In progress</div>
            <div className="wb-col-head">Done</div>
          </div>
          <div className="wb-empty-msg">
            Select a project from the left sidebar to load its task board.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wb-container">
      {/* Top Add Bar */}
      <form className="wb-add-bar" onSubmit={handleAddTask}>
        <span className="wb-project-tag">{project.name || activeName}</span>
        <input
          type="text"
          className="wb-add-input"
          placeholder="Write a new sticky note..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
        />
        <button type="submit" className="wb-add-btn">
          + Add Note
        </button>
      </form>

      {/* Main Whiteboard Frame */}
      <div className="wb-board">
        {/* Whiteboard Header Row (To do | In progress | Done) */}
        <div className="wb-header-row">
          <div className="wb-col-head">
            <span>To do</span>
            {todoTasks.length > 0 && <span className="wb-count">{todoTasks.length}</span>}
          </div>
          <div className="wb-col-head">
            <span>In progress</span>
            {inProgressTasks.length > 0 && <span className="wb-count">{inProgressTasks.length}</span>}
          </div>
          <div className="wb-col-head">
            <span>Done</span>
            {doneTasks.length > 0 && <span className="wb-count">{doneTasks.length}</span>}
          </div>
        </div>

        {/* Whiteboard Content Columns in 1 Row */}
        <div className="wb-columns-row">
          {/* Column 1: To Do */}
          <div className="wb-col">
            <div className="sticky-grid">
              {todoTasks.map((t, idx) => (
                <StickyNote
                  key={t.id || t._id || idx}
                  task={t}
                  index={idx}
                  column="todo"
                  editingId={editingId}
                  editText={editText}
                  setEditingId={setEditingId}
                  setEditText={setEditText}
                  onSaveEdit={handleSaveEdit}
                  onMoveStatus={handleMoveStatus}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="wb-col">
            <div className="sticky-grid">
              {inProgressTasks.map((t, idx) => (
                <StickyNote
                  key={t.id || t._id || idx}
                  task={t}
                  index={idx}
                  column="in_progress"
                  editingId={editingId}
                  editText={editText}
                  setEditingId={setEditingId}
                  setEditText={setEditText}
                  onSaveEdit={handleSaveEdit}
                  onMoveStatus={handleMoveStatus}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>

          {/* Column 3: Done */}
          <div className="wb-col">
            <div className="sticky-grid">
              {doneTasks.map((t, idx) => (
                <StickyNote
                  key={t.id || t._id || idx}
                  task={t}
                  index={idx}
                  column="done"
                  editingId={editingId}
                  editText={editText}
                  setEditingId={setEditingId}
                  setEditText={setEditText}
                  onSaveEdit={handleSaveEdit}
                  onMoveStatus={handleMoveStatus}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StickyNote({
  task,
  index,
  column,
  editingId,
  editText,
  setEditingId,
  setEditText,
  onSaveEdit,
  onMoveStatus,
  onToggleDone,
  onDelete,
}) {
  const isEditing = editingId === (task.id || task._id);
  const colorClass = task.color || STICKY_COLORS[index % STICKY_COLORS.length];
  const rotDeg = task.rot || ((index % 5 - 2) * 1.8).toFixed(1);
  const showCheck = task.hasCheckbox !== false;

  return (
    <div
      className={`sticky-note ${colorClass} ${task.done ? "is-done" : ""}`}
      style={{ transform: `rotate(${rotDeg}deg)` }}
    >
      {isEditing ? (
        <div className="sticky-edit">
          <textarea
            className="sticky-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSaveEdit(task.id || task._id);
              }
            }}
            autoFocus
          />
          <div className="sticky-edit-actions">
            <button
              type="button"
              className="sticky-btn-save"
              onClick={() => onSaveEdit(task.id || task._id)}
            >
              Save
            </button>
            <button
              type="button"
              className="sticky-btn-cancel"
              onClick={() => setEditingId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="sticky-body">
            {showCheck ? (
              <button
                type="button"
                className={`sticky-check ${task.done ? "checked" : ""}`}
                onClick={() => onToggleDone(task.id || task._id)}
                aria-label="Toggle completed"
              >
                {task.done ? "✓" : ""}
              </button>
            ) : null}
            <p
              className={`sticky-text ${task.done ? "done-text" : ""}`}
              onClick={() => {
                setEditingId(task.id || task._id);
                setEditText(task.text);
              }}
              title="Click to edit task"
            >
              {task.text}
            </p>
          </div>

          <div className="sticky-toolbar">
            <div className="sticky-moves">
              {column !== "todo" && (
                <button
                  type="button"
                  className="move-btn"
                  onClick={() =>
                    onMoveStatus(
                      task.id || task._id,
                      column === "done" ? "in_progress" : "todo"
                    )
                  }
                  title="Move left"
                >
                  ←
                </button>
              )}
              {column !== "done" && (
                <button
                  type="button"
                  className="move-btn"
                  onClick={() =>
                    onMoveStatus(
                      task.id || task._id,
                      column === "todo" ? "in_progress" : "done"
                    )
                  }
                  title="Move right"
                >
                  →
                </button>
              )}
            </div>
            <button
              type="button"
              className="del-btn"
              onClick={() => onDelete(task.id || task._id)}
              title="Delete sticky note"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

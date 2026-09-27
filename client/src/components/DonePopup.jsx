import { useState } from "react";
import "./DonePopup.css";

export default function DonePopup({
  project,
  x,
  y,
  onClose,
  onAdd,
  onRemove,
  onToggle,
  mode = "all",
  topicIds = null,
}) {
  const [text, setText] = useState("");
  const allTopics = Array.isArray(project.topics) ? project.topics : [];
  const todayMode = mode === "today";
  const topics = todayMode
    ? allTopics.filter((t) => (topicIds || []).includes(String(t.id)))
    : allTopics;

  const left = Math.min(Math.max(8, x), window.innerWidth - 276);
  const top = Math.min(Math.max(8, y), window.innerHeight - 220);

  return (
    <div
      className="done-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="done-card"
        style={{ left, top }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={
          todayMode
            ? `${project.name} works for today`
            : `${project.name} works to do`
        }
      >
        <p className="done-title">{project.name}</p>
        <p className="done-hint">
          {todayMode
            ? "Works to do today"
            : "What the works to do in this project"}
        </p>

        {topics.length === 0 ? (
          <p className="done-empty">
            {todayMode
              ? "No works picked for today."
              : "No works yet. Add one below."}
          </p>
        ) : (
          <ul className="done-list">
            {topics.map((topic) => {
              const finished = topic.done === true;
              return (
                <li key={topic.id} className={finished ? "is-done" : ""}>
                  <button
                    type="button"
                    className={`done-check ${finished ? "is-checked" : ""}`}
                    onClick={() => onToggle?.(project._id, topic.id)}
                    aria-pressed={finished}
                    aria-label={
                      finished
                        ? `Mark ${topic.text} as not done`
                        : `Mark ${topic.text} as done`
                    }
                  >
                    {finished ? "✓" : ""}
                  </button>
                  <span className="done-text">{topic.text}</span>
                  {!todayMode && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => onRemove(project._id, topic.id)}
                      aria-label={`Remove ${topic.text}`}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!todayMode && (
          <form
            className="done-add"
            onSubmit={(e) => {
              e.preventDefault();
              const next = text.trim();
              if (!next) return;
              onAdd(project._id, next);
              setText("");
            }}
          >
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Fix login"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <button type="submit" className="chip active">
              Add
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

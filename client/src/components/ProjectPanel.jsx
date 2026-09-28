import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";

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
  onSetStars,
}) {
  return (
    <aside className={`panel projects-panel ${importantAction === "remove" ? "important-panel" : ""}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {showStorage && (
          <span className={`storage-pill ${storage}`}>{storage}</span>
        )}
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
            placeholder="New work name"
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
                    <strong>{p.name}</strong>
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
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onDelete(p._id)}
                  aria-label={`Delete ${p.name}`}
                >
                  ×
                </button>
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

import { useState } from "react";
import "./CreateFolderModal.css";

export default function CreateFolderModal({ onClose, onCreate, works = [] }) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleWork = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onCreate?.({
        name,
        workIds: [...selectedIds],
      });
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not create folder");
      setBusy(false);
    }
  };

  return (
    <div className="folder-modal-backdrop" onMouseDown={onClose} role="presentation">
      <form
        className="folder-modal-card"
        role="dialog"
        aria-labelledby="folder-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="folder-modal-title">Create new folder</h2>
        <p className="folder-modal-hint">
          Name the box, then pick which projects belong in it.
        </p>
        <label className="folder-modal-field">
          Folder name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Client work"
            autoFocus
          />
        </label>

        <div className="folder-modal-works">
          <span className="folder-modal-works-label">Add progress</span>
          {works.length === 0 ? (
            <p className="folder-modal-works-empty">
              No unfiled progress yet. Create progress first, or add it later from the folder.
            </p>
          ) : (
            <ul className="folder-modal-works-list">
              {works.map((work) => {
                const id = work._id;
                const checked = selectedIds.has(id);
                return (
                  <li key={id}>
                    <label className={checked ? "is-checked" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWork(id)}
                      />
                      <span>{work.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? <p className="folder-modal-error">{error}</p> : null}
        <div className="folder-modal-actions">
          <button type="button" className="folder-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="folder-modal-submit" disabled={busy}>
            {busy ? "Creating…" : "Create folder"}
          </button>
        </div>
      </form>
    </div>
  );
}

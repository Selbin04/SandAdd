import { useEffect, useRef, useState } from "react";
import "./FolderAboutField.css";

export default function FolderAboutField({
  project,
  onSaveAbout,
  isLocked = false,
}) {
  const [draft, setDraft] = useState(project?.about || "");
  const [isEditing, setIsEditing] = useState(!project?.about);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  // Sync draft and editing state when project changes
  useEffect(() => {
    const currentAbout = project?.about || "";
    setDraft(currentAbout);
    setIsEditing(!currentAbout);
    setStatus("");
  }, [project?._id, project?.about]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    setIsSaving(true);
    setStatus("Saving…");
    try {
      await onSaveAbout?.(trimmed);
      setStatus("Saved");
      if (trimmed) {
        setIsEditing(false);
      }
    } catch {
      setStatus("Error saving");
    } finally {
      setIsSaving(false);
    }
  };

  // If saved and not in edit mode, display only the small title "About" and the saved text (no outer borders)
  if (!isEditing && (project?.about || draft.trim())) {
    const textToShow = project?.about || draft.trim();
    return (
      <div
        className="folder-about-display"
        onClick={() => !isLocked && setIsEditing(true)}
        title={isLocked ? undefined : "Click to edit"}
        role={isLocked ? undefined : "button"}
        tabIndex={isLocked ? undefined : 0}
        onKeyDown={(e) => {
          if (!isLocked && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
      >
        <div className="folder-about-display-head">
          <span className="folder-about-small-title">About</span>
          {!isLocked && (
            <button
              type="button"
              className="folder-about-edit-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              aria-label="Edit about notes"
              title="Edit notes"
            >
              ✎ Edit
            </button>
          )}
        </div>
        <div className="folder-about-display-content">
          <p className="folder-about-saved-text">{textToShow}</p>
        </div>
      </div>
    );
  }

  // Edit Mode: minimal card with small "About" title, textarea, and save/cancel actions
  return (
    <div className="folder-about-card">
      <div className="folder-about-head">
        <div className="folder-about-title-row">
          <span className="folder-about-small-title">About</span>
          {status ? (
            <span
              className={`folder-about-status ${
                status === "Saved"
                  ? "is-saved"
                  : status === "Saving…"
                    ? "is-saving"
                    : "is-error"
              }`}
            >
              {status === "Saved" ? "✓ Saved" : status}
            </span>
          ) : null}
        </div>
      </div>

      <div className="folder-about-body">
        <textarea
          ref={textareaRef}
          className="folder-about-textarea"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus("");
          }}
          placeholder="Write about this progress folder — describe its goals, key links, summary or notes…"
          maxLength={2000}
          rows={6}
          disabled={isLocked}
          autoFocus={Boolean(project?.about)}
        />
      </div>

      <div className="folder-about-foot">
        <span className="folder-about-counter">{draft.length}/2000</span>
        <div className="folder-about-actions">
          {project?.about ? (
            <button
              type="button"
              className="folder-about-cancel-btn"
              onClick={() => {
                setDraft(project.about);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          ) : null}
          {!isLocked && (
            <button
              type="button"
              className="folder-about-save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

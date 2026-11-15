import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ProgressFab.css";

export default function ProgressFab({
  onCreate,
  onCreateFolder,
  activeFolderName = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showModal) {
          setShowModal(false);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, showModal]);

  // Autofocus input when modal opens
  useEffect(() => {
    if (showModal) {
      setFolderName("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showModal]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = folderName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreate?.(trimmed);
      setShowModal(false);
      setIsOpen(false);
      setFolderName("");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenProgressFolderDialog = () => {
    setIsOpen(false);
    setShowModal(true);
  };

  const handleOpenFolderDialog = () => {
    setIsOpen(false);
    onCreateFolder?.();
  };

  const content = (
    <>
      {/* Background overlay when menu is open */}
      {isOpen && (
        <div
          className="progress-fab-backdrop"
          onClick={() => setIsOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Floating Action Button and Popover Menu */}
      <div className="progress-fab-root">
        {isOpen && (
          <div
            className="progress-fab-menu"
            role="menu"
            aria-label="Create options"
          >
            <button
              type="button"
              className="progress-fab-item"
              role="menuitem"
              onClick={handleOpenProgressFolderDialog}
            >
              <div className="progress-fab-item-icon">📁</div>
              <div className="progress-fab-item-text">
                <span className="progress-fab-item-title">
                  Create Progress Folder
                </span>
                <span className="progress-fab-item-desc">
                  {activeFolderName
                    ? `Add in "${activeFolderName}"`
                    : "Add new progress folder"}
                </span>
              </div>
            </button>

            {onCreateFolder && (
              <button
                type="button"
                className="progress-fab-item"
                role="menuitem"
                onClick={handleOpenFolderDialog}
              >
                <div className="progress-fab-item-icon folder-icon">🗂️</div>
                <div className="progress-fab-item-text">
                  <span className="progress-fab-item-title">
                    Create New Folder
                  </span>
                  <span className="progress-fab-item-desc">
                    Organize progress folders
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Round Plus Button (FAB like WhatsApp / Google Drive) */}
        <button
          type="button"
          className={`progress-fab-btn ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          title={isOpen ? "Close menu" : "Create new progress folder"}
          aria-label={isOpen ? "Close menu" : "Create new progress folder"}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className="progress-fab-icon" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
        </button>
      </div>

      {/* Modal Dialog for naming the new Progress Folder */}
      {showModal && (
        <div
          className="progress-fab-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="presentation"
        >
          <form
            className="progress-fab-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-fab-modal-title"
            onSubmit={handleSubmit}
          >
            <div className="progress-fab-modal-header">
              <div className="progress-fab-modal-icon" aria-hidden="true">
                📁
              </div>
              <div className="progress-fab-modal-titles">
                <h3
                  id="progress-fab-modal-title"
                  className="progress-fab-modal-title"
                >
                  Create New Progress Folder
                </h3>
                <p className="progress-fab-modal-subtitle">
                  {activeFolderName
                    ? `Creating in folder "${activeFolderName}"`
                    : "Create a new progress folder"}
                </p>
              </div>
            </div>

            <div className="progress-fab-modal-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className="progress-fab-modal-input"
                maxLength={80}
                placeholder="e.g. Daily Practice, System Design..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="progress-fab-modal-actions">
              <button
                type="button"
                className="progress-fab-modal-btn cancel"
                onClick={() => setShowModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="progress-fab-modal-btn primary"
                disabled={!folderName.trim() || busy}
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}


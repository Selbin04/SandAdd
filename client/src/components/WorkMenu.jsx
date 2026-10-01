import { useEffect, useRef, useState } from "react";
import "./WorkMenu.css";

export default function WorkMenu({
  workName = "work",
  onShareFollow,
  onShareAssign,
  onDelete,
  folders = [],
  currentFolderId = null,
  onMoveToFolder,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const canShare = Boolean(onShareFollow || onShareAssign);
  const canMove = typeof onMoveToFolder === "function";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="work-menu" ref={rootRef}>
      <button
        type="button"
        className={`work-menu-trigger ${open ? "is-open" : ""}`}
        aria-label={`Options for ${workName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {open ? (
        <ul className="work-menu-list" role="menu">
          {canShare && onShareFollow ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onShareFollow();
                }}
              >
                Share project to follow
              </button>
            </li>
          ) : null}
          {canShare && onShareAssign ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onShareAssign();
                }}
              >
                Assign project
              </button>
            </li>
          ) : null}
          {canMove ? (
            <>
              <li role="none" className="work-menu-section">
                <span>Move to folder</span>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={!currentFolderId ? "is-current" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onMoveToFolder(null);
                  }}
                >
                  Projects (unfiled)
                </button>
              </li>
              {folders.map((folder) => (
                <li key={folder.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={
                      currentFolderId === folder.id ? "is-current" : ""
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onMoveToFolder(folder.id);
                    }}
                  >
                    {folder.name}
                  </button>
                </li>
              ))}
              {folders.length === 0 ? (
                <li role="none">
                  <span className="work-menu-empty">No folders yet</span>
                </li>
              ) : null}
            </>
          ) : null}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete?.();
              }}
            >
              Delete project
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

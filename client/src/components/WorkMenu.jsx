import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const canShare = Boolean(onShareFollow || onShareAssign);
  const canMove = typeof onMoveToFolder === "function";

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const right = Math.max(8, window.innerWidth - rect.right);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setMenuStyle({
          position: "fixed",
          bottom: `${window.innerHeight - rect.top + 6}px`,
          right: `${right}px`,
          top: "auto",
          left: "auto",
          zIndex: 999999,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          top: `${rect.bottom + 6}px`,
          right: `${right}px`,
          bottom: "auto",
          left: "auto",
          zIndex: 999999,
        });
      }
    };

    updatePosition();

    const onDoc = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const menuElement = open ? (
    <ul
      className="work-menu-list is-portal"
      role="menu"
      style={menuStyle}
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
            Share to follow
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
            Share to contribute
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
                className={currentFolderId === folder.id ? "is-current" : ""}
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
  ) : null;

  return (
    <div className={`work-menu ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
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
      {open && typeof document !== "undefined"
        ? createPortal(menuElement, document.body)
        : null}
    </div>
  );
}

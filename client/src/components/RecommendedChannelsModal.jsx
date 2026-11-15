import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getRecommendedPlatformFolders } from "../lib/recommendedChannels.js";
import "./RecommendedChannelsModal.css";

export default function RecommendedChannelsModal({
  post,
  allPosts = [],
  onAddProject,
  addedTemplateIds = new Set(),
  addingTemplateId = null,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState(() => new Set());
  const [localAdded, setLocalAdded] = useState(() => new Set());
  const [localAddingId, setLocalAddingId] = useState(null);
  const inputRef = useRef(null);

  const shared = post?.sharedProject;
  const pathName =
    shared?.name ||
    post?.projectName ||
    (post?.meta?.includes("·") ? post.meta.split("·")[1]?.trim() : "") ||
    "Progress Folder";

  // Compute recommended platform folders related to this post's folder
  const folders = useMemo(
    () => getRecommendedPlatformFolders(post, allPosts),
    [post, allPosts]
  );

  // Filter folders by search query
  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => {
      const nameMatch = f.name?.toLowerCase().includes(q);
      const descMatch = f.about?.toLowerCase().includes(q);
      const authorMatch =
        f.author?.name?.toLowerCase().includes(q) ||
        f.author?.handle?.toLowerCase().includes(q);
      const workMatch = f.works?.some((w) =>
        (w.text || "").toLowerCase().includes(q)
      );
      return nameMatch || descMatch || authorMatch || workMatch;
    });
  }, [folders, query]);

  const toggleExpand = (id) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddFolder = async (folder) => {
    if (!onAddProject || localAddingId || addingTemplateId) return;
    const tid = String(folder.templateId || folder.id);
    setLocalAddingId(tid);
    try {
      await onAddProject(
        {
          templateId: folder.templateId,
          originId: folder.originId || null,
          name: folder.name,
          about: folder.about || "",
          durationMs: folder.durationMs || 30000,
          shareMode: folder.shareMode || null,
          works: folder.works,
        },
        folder.author
      );
      setLocalAdded((prev) => new Set(prev).add(tid));
    } catch {
      /* ignore */
    } finally {
      setLocalAddingId(null);
    }
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!post) return null;

  const content = (
    <div
      className="rec-channels-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="rec-channels-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-channels-title"
      >
        {/* Header */}
        <div className="rec-channels-head">
          <div className="rec-channels-head-main">
            <div className="rec-channels-head-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <path d="M12 11v6" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M9 14h6" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="rec-channels-head-text">
              <h3 id="rec-channels-title" className="rec-channels-title">
                Recommended Channels
              </h3>
              <p className="rec-channels-subtitle" title={pathName}>
                Public progress folders related to &ldquo;{pathName}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rec-channels-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Search bar */}
        <div className="rec-channels-search-bar">
          <input
            ref={inputRef}
            type="text"
            className="rec-channels-search-input"
            placeholder="Search related progress folders, tasks, or creators..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="rec-channels-count-pill" title="Available related folders">
            {filteredFolders.length} found
          </span>
        </div>

        {/* Platform Progress Folders List */}
        <ul className="rec-channels-list">
          {filteredFolders.length === 0 ? (
            <li className="rec-channels-empty">
              No matching progress folders found for &ldquo;{query}&rdquo;.
            </li>
          ) : (
            filteredFolders.map((folder) => {
              const tid = String(folder.templateId || folder.id);
              const isAdded =
                addedTemplateIds?.has(tid) ||
                localAdded.has(tid) ||
                (folder.originId && addedTemplateIds?.has(String(folder.originId)));
              const isBusy =
                addingTemplateId === tid || localAddingId === tid;
              const isExpanded = expandedFolderIds.has(folder.id);

              return (
                <li key={folder.id} className="rec-channel-card">
                  {/* Creator Avatar */}
                  <div
                    className={`rec-channel-avatar ${
                      folder.author?.isPlatform ? "is-platform" : ""
                    }`}
                    style={
                      folder.author?.avatar
                        ? {
                            backgroundImage: `url(${folder.author.avatar})`,
                            backgroundSize: "cover",
                          }
                        : {}
                    }
                    aria-hidden="true"
                  >
                    {!folder.author?.avatar && (folder.author?.initial || "📁")}
                  </div>

                  {/* Folder Details */}
                  <div className="rec-channel-content">
                    {/* Author & Badge Row */}
                    <div className="rec-channel-top-row">
                      <div className="rec-channel-name-wrap">
                        <span className="rec-channel-author-name">
                          {folder.author?.name || "Platform Creator"}
                        </span>
                        {folder.author?.handle && (
                          <span className="rec-channel-handle">
                            @{folder.author.handle}
                          </span>
                        )}
                      </div>
                      {folder.badge && (
                        <span className="rec-channel-badge">{folder.badge}</span>
                      )}
                    </div>

                    {/* Progress Folder Name */}
                    <h4 className="rec-folder-name">{folder.name}</h4>

                    {/* Description / Category */}
                    {folder.about && (
                      <p className="rec-channel-desc">{folder.about}</p>
                    )}

                    {/* Tasks Preview Controls */}
                    <div className="rec-folder-tasks-bar">
                      <span className="rec-folder-task-count">
                        <span className="rec-folder-task-icon">📋</span>
                        {folder.works?.length || 0} tasks
                      </span>
                      {folder.works?.length > 0 && (
                        <button
                          type="button"
                          className="rec-folder-toggle-tasks-btn"
                          onClick={() => toggleExpand(folder.id)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Hide tasks ▲" : "Preview tasks ▼"}
                        </button>
                      )}
                    </div>

                    {/* Expandable Tasks Preview List */}
                    {isExpanded && folder.works?.length > 0 && (
                      <ul className="rec-folder-expanded-tasks">
                        {folder.works.map((w, index) => (
                          <li
                            key={w.id || index}
                            className="rec-folder-task-item"
                          >
                            <span
                              className="rec-folder-task-bullet"
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <span className="rec-folder-task-text">
                              {w.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Add to Progress Action Button */}
                  <div className="rec-folder-action-wrap">
                    <button
                      type="button"
                      className={`rec-folder-btn ${
                        isAdded ? "is-added" : isBusy ? "is-busy" : ""
                      }`}
                      disabled={isAdded || isBusy}
                      onClick={() => handleAddFolder(folder)}
                      title={
                        isAdded
                          ? "Already in your Progress"
                          : `Add ${folder.name} to Progress`
                      }
                      aria-label={
                        isAdded
                          ? "Added to Progress"
                          : `Add ${folder.name} to Progress`
                      }
                    >
                      {isAdded ? (
                        <>
                          <span className="rec-btn-check" aria-hidden="true">
                            ✓
                          </span>
                          <span>Added to Progress</span>
                        </>
                      ) : isBusy ? (
                        <span>Adding…</span>
                      ) : (
                        <>
                          <span aria-hidden="true">+</span>
                          <span>Add to Progress</span>
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer */}
        <div className="rec-channels-foot">
          <div className="rec-channels-foot-info">
            <span>
              {filteredFolders.length} public progress folder
              {filteredFolders.length === 1 ? "" : "s"} available
            </span>
          </div>
          <button
            type="button"
            className="rec-channels-done-btn"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

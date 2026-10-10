import { useEffect, useRef, useState } from "react";
import {
  PROOF_ACCEPT,
  fileToProof,
  isImageProof,
  isPdfProof,
  isVideoProof,
  restoreTopicSourceProof,
} from "../lib/socialFeed.js";
import { getProjectCreatorTagline } from "../lib/liveWorks.js";
import FileUploadHint from "./FileUploadHint.jsx";
import "./DonePopup.css";

function normalizeSourceUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`.slice(0, 500);
  return s.slice(0, 500);
}

function openSourceUrl(url) {
  const href = normalizeSourceUrl(url);
  if (!href) return false;
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

function isUrlSource(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s);
}

export function getTopicSources(topic) {
  if (Array.isArray(topic?.sources) && topic.sources.length > 0) {
    return topic.sources;
  }
  const list = [];
  if (topic?.sourceProof?.dataUrl || topic?.sourceProof?.mediaId || topic?.sourceProof?.name) {
    list.push({
      id: "legacy-file",
      type: "file",
      content: topic.sourceProof.name || "Attached file",
      proof: topic.sourceProof,
    });
  }
  if (String(topic?.source || "").trim()) {
    const s = String(topic.source).trim();
    const isUrl = isUrlSource(s);
    list.push({
      id: "legacy-source",
      type: isUrl ? "link" : "text",
      content: s,
      proof: null,
    });
  }
  return list;
}

function topicHasSource(topic) {
  return getTopicSources(topic).length > 0;
}

function dataUrlToObjectUrl(proof) {
  if (!proof?.dataUrl) return null;
  try {
    const [header, base64] = proof.dataUrl.split(",");
    if (!base64) return proof.dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const mime =
      (header && /data:([^;]+)/.exec(header)?.[1]) ||
      proof.type ||
      "application/octet-stream";
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return proof.dataUrl;
  }
}

/** Inline file viewer — click to open full viewer in-app (no browser tab). */
function SourceFileViewer({ proof }) {
  const [ready, setReady] = useState(proof?.dataUrl ? proof : null);
  const [loading, setLoading] = useState(
    !proof?.dataUrl && Boolean(proof?.mediaId)
  );
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    restoreTopicSourceProof(proof).then((full) => {
      if (!alive) return;
      setReady(full);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [proof?.mediaId, proof?.dataUrl, proof?.name]);

  if (loading) {
    return (
      <p className="done-source-meta">Loading {proof?.name || "file"}…</p>
    );
  }
  if (!ready?.dataUrl) {
    return (
      <p className="done-source-meta">
        File “{proof?.name || "source"}” isn’t available yet.
      </p>
    );
  }

  const label = ready.name || "Attached file";
  const kind = isImageProof(ready)
    ? "Image"
    : isVideoProof(ready)
      ? "Video"
      : isPdfProof(ready)
        ? "PDF"
        : "File";

  return (
    <>
      <button
        type="button"
        className="done-source-file-btn"
        onClick={() => setOpened(true)}
      >
        <span className="done-source-file-kind">{kind}</span>
        <span className="done-source-file-name">{label}</span>
        <span className="done-source-file-action">Open</span>
      </button>
      {opened ? (
        <SourceFileLightbox proof={ready} onClose={() => setOpened(false)} />
      ) : null}
    </>
  );
}

function SourceFileLightbox({ proof, onClose }) {
  return (
    <div
      className="done-source-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={proof.name || "Source file"}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="done-source-lightbox-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="done-source-lightbox-head">
          <strong>{proof.name || "Source file"}</strong>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="done-source-lightbox-body">
          {isImageProof(proof) ? (
            <img
              className="done-source-lightbox-media"
              src={proof.dataUrl}
              alt={proof.name || "Source"}
            />
          ) : null}
          {isVideoProof(proof) ? (
            <video
              className="done-source-lightbox-media is-video"
              src={proof.dataUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
            >
              Your browser can’t play this video.
            </video>
          ) : null}
          {isPdfProof(proof) ? <PdfInline proof={proof} large /> : null}
          {!isImageProof(proof) &&
          !isVideoProof(proof) &&
          !isPdfProof(proof) ? (
            <p className="done-source-meta">Attached: {proof.name || "file"}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PdfInline({ proof, large = false }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const next = dataUrlToObjectUrl(proof);
    setUrl(next);
    return () => {
      if (next?.startsWith("blob:")) URL.revokeObjectURL(next);
    };
  }, [proof?.dataUrl, proof?.type]);

  if (!url) {
    return <p className="done-source-meta">Loading PDF…</p>;
  }
  return (
    <iframe
      className={large ? "done-source-pdf is-large" : "done-source-pdf"}
      title={proof.name || "PDF source"}
      src={url}
    />
  );
}

export default function DonePopup({
  project,
  x,
  y,
  onClose,
  onAdd,
  onRemove,
  onToggle,
  onSetSource,
  mode = "all",
  topicIds = null,
  readOnlyTasks = false,
  inline = false,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceProof, setSourceProof] = useState(null);
  const [hasCheckbox, setHasCheckbox] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [busyFile, setBusyFile] = useState(false);
  const [sourcePanelId, setSourcePanelId] = useState(null);
  const [sourceTab, setSourceTab] = useState("open");
  const [isSourceEditMode, setIsSourceEditMode] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [sourceTitleDraft, setSourceTitleDraft] = useState("");
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [editingContentId, setEditingContentId] = useState(null);
  const [editingContentValue, setEditingContentValue] = useState("");
  const [openSourceIndex, setOpenSourceIndex] = useState(0);
  const addFileRef = useRef(null);
  const topicFileRef = useRef(null);
  const doneListRef = useRef(null);
  const pendingTopicIdRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!showAddForm) return undefined;
    const handleOutsideClick = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick, true);
    document.addEventListener("touchstart", handleOutsideClick, true);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
    };
  }, [showAddForm]);

  const allTopics = Array.isArray(project.topics) ? project.topics : [];
  const todayMode = mode === "today";
  const topics = todayMode
    ? allTopics.filter((t) => (topicIds || []).includes(String(t.id)))
    : allTopics;
  const panelTopic = topics.find((t) => t.id === sourcePanelId) || null;

  useEffect(() => {
    if (doneListRef.current) {
      doneListRef.current.scrollTop = doneListRef.current.scrollHeight;
    }
  }, [topics.length]);

  const left = inline ? 8 : Math.min(Math.max(8, x), window.innerWidth - 340);
  const top = inline ? 8 : Math.min(Math.max(8, y), window.innerHeight - 360);

  useEffect(() => {
    if (!panelTopic) return;
    const isUrl = isUrlSource(panelTopic.source);
    setLinkDraft(isUrl ? String(panelTopic.source || "") : "");
    setTextDraft(!isUrl ? String(panelTopic.source || "") : "");
    setSourceTitleDraft("");
    setEditingTitleId(null);
    setEditingContentId(null);
    setSourceTab("open");
    setIsSourceEditMode(false);
    setOpenSourceIndex(0);
  }, [panelTopic?.id, panelTopic?.source, panelTopic?.sourceProof?.mediaId]);

  const pickTopicFile = (topicId) => {
    pendingTopicIdRef.current = topicId;
    topicFileRef.current?.click();
  };

  const openPanel = (topic) => {
    setSourceError("");
    setSourcePanelId(topic.id);
    setOpenSourceIndex(0);
    const isUrl = isUrlSource(topic.source);
    setLinkDraft(isUrl ? String(topic.source || "") : "");
    setTextDraft(!isUrl ? String(topic.source || "") : "");
    setSourceTitleDraft("");
    setEditingTitleId(null);
    setEditingContentId(null);
    setSourceTab("open");
    setIsSourceEditMode(false);
  };

  const closePanel = () => {
    setSourcePanelId(null);
    setSourceTab("open");
    setIsSourceEditMode(false);
    setLinkDraft("");
    setTextDraft("");
    setSourceTitleDraft("");
    setEditingTitleId(null);
    setEditingContentId(null);
    setOpenSourceIndex(0);
  };

  const addSourceItem = (topic, newItem) => {
    const current = getTopicSources(topic);
    const updated = [
      ...current,
      {
        id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...newItem,
      },
    ];
    onSetSource?.(project._id, topic.id, { sources: updated });
    setOpenSourceIndex(current.length);
  };

  const updateSourceItemTitle = (topic, sourceId, newTitle) => {
    const current = getTopicSources(topic);
    const updated = current.map((s) =>
      s.id === sourceId ? { ...s, title: newTitle.trim() } : s
    );
    onSetSource?.(project._id, topic.id, { sources: updated });
  };

  const updateSourceItemContent = (topic, sourceId, newContent) => {
    const current = getTopicSources(topic);
    const updated = current.map((s) =>
      s.id === sourceId ? { ...s, content: newContent.trim() } : s
    );
    onSetSource?.(project._id, topic.id, { sources: updated });
  };

  const removeSourceItem = (topic, sourceId) => {
    const current = getTopicSources(topic);
    const updated = current.filter((s) => s.id !== sourceId);
    onSetSource?.(project._id, topic.id, { sources: updated });
    setOpenSourceIndex((i) => Math.max(0, Math.min(i, updated.length - 1)));
  };

  const addTextSource = (topic) => {
    const trimmed = textDraft.trim();
    if (!trimmed) return;
    addSourceItem(topic, {
      type: "text",
      title: sourceTitleDraft.trim(),
      content: trimmed,
      proof: null,
    });
    setTextDraft("");
    setSourceTitleDraft("");
    setSourceTab("open");
  };

  const addLinkSource = (topic) => {
    const normalized = normalizeSourceUrl(linkDraft);
    if (!normalized) return;
    addSourceItem(topic, {
      type: "link",
      title: sourceTitleDraft.trim(),
      content: normalized,
      proof: null,
    });
    setLinkDraft("");
    setSourceTitleDraft("");
    setSourceTab("open");
  };

  const clearAllSources = (topic) => {
    onSetSource?.(project._id, topic.id, {
      source: "",
      sourceProof: null,
      sources: [],
    });
    setLinkDraft("");
    setTextDraft("");
    setSourceTitleDraft("");
    setEditingTitleId(null);
    setSourceTab("text");
  };

  const onTopicFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const topicId = pendingTopicIdRef.current;
    pendingTopicIdRef.current = null;
    if (!file || !topicId) return;
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    setSourceError("");
    setBusyFile(true);
    try {
      const proof = await fileToProof(file);
      addSourceItem(topic, {
        type: "file",
        title: sourceTitleDraft.trim(),
        content: proof.name || "File",
        proof,
      });
      setSourceTitleDraft("");
      setSourceTab("open");
    } catch (err) {
      setSourceError(err.message || "Could not attach file");
    } finally {
      setBusyFile(false);
    }
  };

  const onAddFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSourceError("");
    setBusyFile(true);
    try {
      const proof = await fileToProof(file);
      setSourceProof(proof);
      setSource("");
    } catch (err) {
      setSourceError(err.message || "Could not attach file");
    } finally {
      setBusyFile(false);
    }
  };

  return (
    <div
      className={inline ? "done-inline" : "done-backdrop"}
      onMouseDown={inline ? undefined : onClose}
      role="presentation"
    >
      <input
        ref={topicFileRef}
        type="file"
        accept={PROOF_ACCEPT}
        hidden
        onChange={onTopicFile}
      />
      <input
        ref={addFileRef}
        type="file"
        accept={PROOF_ACCEPT}
        hidden
        onChange={onAddFile}
      />
      <div
        className={`done-card ${inline ? "done-card-inline" : ""}`}
        style={inline ? undefined : { left, top }}
        onMouseDown={(e) => e.stopPropagation()}
        role={inline ? undefined : "dialog"}
        aria-label={inline ? undefined : todayMode
          ? `${project.name} tasks for today`
          : `${project.name} tasks`}
      >
        <div className={`done-head-bar ${inline ? "done-inline-head" : ""}`}>
          <div className="done-head-copy">
            <p className="done-title">{project.name}</p>
            <p className="done-hint">
              {todayMode
                ? "Tasks for today"
                : readOnlyTasks
                  ? "Tasks sync from the creator — you can tick them, but not edit or add"
                  : "Tasks"}
            </p>
          </div>
          <div className="done-head-right">
            {(() => {
              const tagline = getProjectCreatorTagline(project);
              if (!tagline) return null;
              return (
                <span className="creator-tagline-chip">{tagline}</span>
              );
            })()}
            {inline ? (
              <button
                type="button"
                className="done-inline-close"
                onClick={onClose}
                aria-label="Close work workspace"
              >
                ×
              </button>
            ) : !inline && onClose ? (
              <button
                type="button"
                className="done-inline-close"
                onClick={onClose}
                aria-label="Close tasks"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        {topics.length === 0 ? (
          <p className="done-empty">
            {todayMode
              ? "No tasks picked for today."
              : readOnlyTasks
                ? "No tasks yet. Wait for the creator to add some."
                : "No tasks yet. Add one below."}
          </p>
        ) : (
          <ul ref={doneListRef} className="done-list">
            {topics.map((topic) => {
              const finished = topic.done === true;
              const sourceList = getTopicSources(topic);
              const sourceCount = sourceList.length;
              const hasSource = sourceCount > 0;
              const isOpen = sourcePanelId === topic.id;
              const sourceBtnText = sourceCount > 0 ? `Source (${sourceCount})` : "Source";

              const showCheck = topic.hasCheckbox !== false;
              return (
                <li
                  key={topic.id}
                  className={`${finished ? "is-done" : ""} ${isOpen ? "is-source-open" : ""}`}
                >
                  <div className="done-row">
                    {showCheck ? (
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
                    ) : null}
                    <span className="done-text">{topic.text}</span>
                    <button
                      type="button"
                      className={`done-source ${hasSource ? "has-source" : ""} ${isOpen ? "is-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOpen) closePanel();
                        else openPanel(topic);
                      }}
                      disabled={busyFile || (readOnlyTasks && !hasSource)}
                      title={
                        readOnlyTasks
                          ? hasSource
                            ? `${sourceCount} source(s)`
                            : "No source"
                          : hasSource
                            ? `${sourceCount} source(s)`
                            : "Add source"
                      }
                      aria-expanded={isOpen}
                      aria-label={`Source for ${topic.text}`}
                    >
                      {sourceBtnText}
                    </button>
                    {!todayMode && !readOnlyTasks && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onRemove(project._id, topic.id)}
                        aria-label={`Remove ${topic.text}`}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {isOpen ? (
                    <div className="done-source-panel" role="tablist">
                      <div className="done-source-tabs">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sourceTab === "open"}
                          className={sourceTab === "open" ? "is-active" : ""}
                          onClick={() => setSourceTab("open")}
                        >
                          Open ({sourceCount})
                        </button>
                        {isSourceEditMode && !readOnlyTasks ? (
                          <>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "text"}
                              className={sourceTab === "text" ? "is-active" : ""}
                              onClick={() => setSourceTab("text")}
                            >
                              + Text
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "link"}
                              className={sourceTab === "link" ? "is-active" : ""}
                              onClick={() => setSourceTab("link")}
                            >
                              + Link
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "file"}
                              className={sourceTab === "file" ? "is-active" : ""}
                              onClick={() => setSourceTab("file")}
                            >
                              + File
                            </button>
                          </>
                        ) : null}
                        {!readOnlyTasks ? (
                          <button
                            type="button"
                            className={`done-source-edit-toggle ${isSourceEditMode ? "is-active" : ""}`}
                            onClick={() => {
                              setIsSourceEditMode((prev) => {
                                const next = !prev;
                                if (!next) {
                                  setSourceTab("open");
                                  setEditingTitleId(null);
                                  setEditingContentId(null);
                                }
                                return next;
                              });
                            }}
                            title={isSourceEditMode ? "Close edit options" : "Edit source"}
                            aria-label="Toggle source edit mode"
                          >
                            ✎ {isSourceEditMode ? "Done" : "Edit"}
                          </button>
                        ) : null}
                      </div>

                      {sourceTab === "open" ? (
                        <div className="done-source-pane">
                          {!hasSource ? (
                            <p className="done-source-meta">
                              {readOnlyTasks
                                ? "No source yet."
                                : "No source yet — click the ✎ Edit icon in top right to add sources to this task."}
                            </p>
                          ) : (() => {
                            const safeIdx = Math.max(0, Math.min(openSourceIndex, sourceCount - 1));
                            const activeItem = sourceList[safeIdx] || sourceList[0];
                            return (
                              <div className="done-source-one-by-one">

                                <div className="done-source-item">
                                  <header className="done-source-item-head">
                                    <span className="done-source-item-badge">
                                      {activeItem.type ? activeItem.type.toUpperCase() : "SOURCE"} {sourceCount > 1 ? `(#${safeIdx + 1})` : ""}
                                    </span>
                                    {isSourceEditMode && !readOnlyTasks && (
                                      <button
                                        type="button"
                                        className="done-source-item-del"
                                        onClick={() => removeSourceItem(topic, activeItem.id)}
                                        title="Remove this source"
                                        aria-label="Remove source"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </header>

                                  <div className="done-source-item-title-section">
                                    {editingTitleId === activeItem.id && isSourceEditMode ? (
                                      <form
                                        className="done-source-title-edit-form"
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          updateSourceItemTitle(topic, activeItem.id, editingTitleValue);
                                          setEditingTitleId(null);
                                        }}
                                      >
                                        <input
                                          type="text"
                                          className="done-source-title-edit-input"
                                          value={editingTitleValue}
                                          onChange={(e) => setEditingTitleValue(e.target.value)}
                                          placeholder="Source title (e.g. API Specs)"
                                          maxLength={80}
                                          autoFocus
                                        />
                                        <button type="submit" className="done-source-title-save-btn">
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="done-source-title-cancel-btn"
                                          onClick={() => setEditingTitleId(null)}
                                        >
                                          Cancel
                                        </button>
                                      </form>
                                    ) : (
                                      <div className="done-source-title-display">
                                        <strong className="done-source-title-heading">
                                          {activeItem.title ? (
                                            activeItem.title
                                          ) : (
                                            <span className="done-source-untitled">Untitled source</span>
                                          )}
                                        </strong>
                                        {isSourceEditMode && !readOnlyTasks && (
                                          <button
                                            type="button"
                                            className="done-source-title-edit-btn"
                                            onClick={() => {
                                              setEditingTitleId(activeItem.id);
                                              setEditingTitleValue(activeItem.title || "");
                                            }}
                                            title="Add or edit title for this source"
                                          >
                                            ✎ {activeItem.title ? "Rename" : "+ Add title"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="done-source-item-body">
                                    {activeItem.type === "file" && activeItem.proof ? (
                                      <SourceFileViewer proof={activeItem.proof} />
                                    ) : activeItem.type === "link" || isUrlSource(activeItem.content) ? (
                                      editingContentId === activeItem.id && isSourceEditMode ? (
                                        <form
                                          className="done-source-content-edit-form"
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            const normalized = normalizeSourceUrl(editingContentValue);
                                            if (normalized) {
                                              updateSourceItemContent(topic, activeItem.id, normalized);
                                            }
                                            setEditingContentId(null);
                                          }}
                                        >
                                          <input
                                            type="text"
                                            className="done-source-title-edit-input"
                                            value={editingContentValue}
                                            onChange={(e) => setEditingContentValue(e.target.value)}
                                            placeholder="https://example.com"
                                            maxLength={500}
                                            autoFocus
                                          />
                                          <div className="done-source-edit-actions">
                                            <button type="submit" className="done-source-title-save-btn">
                                              Save link
                                            </button>
                                            <button
                                              type="button"
                                              className="done-source-title-cancel-btn"
                                              onClick={() => setEditingContentId(null)}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <>
                                          <p className="done-source-meta">{activeItem.content}</p>
                                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                            <button
                                              type="button"
                                              className="done-source-primary"
                                              onClick={() => openSourceUrl(activeItem.content)}
                                            >
                                              Open link
                                            </button>
                                            {isSourceEditMode && !readOnlyTasks && (
                                              <button
                                                type="button"
                                                className="done-source-title-edit-btn"
                                                onClick={() => {
                                                  setEditingContentId(activeItem.id);
                                                  setEditingContentValue(activeItem.content || "");
                                                }}
                                                title="Edit link URL"
                                              >
                                                ✎ Edit link
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      )
                                    ) : editingContentId === activeItem.id && isSourceEditMode ? (
                                      <form
                                        className="done-source-content-edit-form"
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          updateSourceItemContent(topic, activeItem.id, editingContentValue);
                                          setEditingContentId(null);
                                        }}
                                      >
                                        <textarea
                                          className="done-source-textarea"
                                          value={editingContentValue}
                                          onChange={(e) => setEditingContentValue(e.target.value)}
                                          rows={3}
                                          maxLength={500}
                                          autoFocus
                                        />
                                        <div className="done-source-edit-actions">
                                          <button type="submit" className="done-source-primary">
                                            Save text
                                          </button>
                                          <button
                                            type="button"
                                            className="done-source-title-cancel-btn"
                                            onClick={() => setEditingContentId(null)}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <div className="done-source-text-card">
                                        <p className="done-source-text-content">{activeItem.content}</p>
                                        {isSourceEditMode && !readOnlyTasks && (
                                          <button
                                            type="button"
                                            className="done-source-title-edit-btn"
                                            style={{ marginTop: "6px" }}
                                            onClick={() => {
                                              setEditingContentId(activeItem.id);
                                              setEditingContentValue(activeItem.content || "");
                                            }}
                                            title="Edit text content"
                                          >
                                            ✎ Edit text
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {sourceCount > 1 && (
                                  <div className="done-source-pills">
                                    {sourceList.map((item, idx) => (
                                      <button
                                        key={item.id || idx}
                                        type="button"
                                        className={`done-source-pill ${idx === safeIdx ? "is-active" : ""}`}
                                        onClick={() => setOpenSourceIndex(idx)}
                                        title={item.title ? `${idx + 1}. ${item.title}` : `Source ${idx + 1}`}
                                      >
                                        <span className="done-source-pill-num">{idx + 1}.</span>
                                        <span className="done-source-pill-text">
                                          {item.title || (item.type ? item.type.toUpperCase() : `Source ${idx + 1}`)}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {hasSource && isSourceEditMode && !readOnlyTasks ? (
                            <button
                              type="button"
                              className="done-source-clear"
                              onClick={() => {
                                clearAllSources(topic);
                                setOpenSourceIndex(0);
                              }}
                            >
                              Clear all sources
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {sourceTab === "text" && !readOnlyTasks ? (
                        <div className="done-source-pane">
                          <input
                            type="text"
                            className="done-source-title-input"
                            value={sourceTitleDraft}
                            onChange={(e) => setSourceTitleDraft(e.target.value)}
                            placeholder="Source title / label (e.g. Release Notes) [optional]"
                            maxLength={80}
                          />
                          <textarea
                            className="done-source-textarea"
                            value={textDraft}
                            onChange={(e) => setTextDraft(e.target.value)}
                            placeholder="Write text notes or source details for this task..."
                            rows={3}
                            maxLength={500}
                            aria-label="Source text notes"
                          />
                          <button
                            type="button"
                            className="done-source-primary"
                            onClick={() => addTextSource(topic)}
                            disabled={!textDraft.trim()}
                          >
                            + Add text note
                          </button>
                        </div>
                      ) : null}

                      {sourceTab === "link" && !readOnlyTasks ? (
                        <div className="done-source-pane">
                          <input
                            type="text"
                            className="done-source-title-input"
                            value={sourceTitleDraft}
                            onChange={(e) => setSourceTitleDraft(e.target.value)}
                            placeholder="Source title / label (e.g. GitHub Repo / Figma) [optional]"
                            maxLength={80}
                          />
                          <input
                            type="url"
                            value={linkDraft}
                            onChange={(e) => setLinkDraft(e.target.value)}
                            placeholder="https://github.com/…"
                            aria-label="Source link"
                          />
                          <button
                            type="button"
                            className="done-source-primary"
                            onClick={() => addLinkSource(topic)}
                            disabled={!linkDraft.trim()}
                          >
                            + Add link
                          </button>
                        </div>
                      ) : null}

                      {sourceTab === "file" && !readOnlyTasks ? (
                        <div className="done-source-pane">
                          <input
                            type="text"
                            className="done-source-title-input"
                            value={sourceTitleDraft}
                            onChange={(e) => setSourceTitleDraft(e.target.value)}
                            placeholder="Source title / label (e.g. Architecture Diagram PDF) [optional]"
                            maxLength={80}
                          />
                          <p className="done-source-meta">
                            Upload image, video, or PDF to attach as a source to this task
                          </p>
                          <button
                            type="button"
                            className="done-source-primary"
                            disabled={busyFile}
                            onClick={() => pickTopicFile(topic.id)}
                          >
                            {busyFile ? "Uploading…" : "+ Upload & attach file"}
                          </button>
                          <FileUploadHint />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {sourceError ? <p className="done-source-error">{sourceError}</p> : null}

        {!todayMode && !readOnlyTasks && (
          <div className="done-add-container">
            {!showAddForm ? (
              <div className="done-add-toggle-bar">
                <button
                  type="button"
                  className="done-add-round-btn"
                  onClick={() => setShowAddForm(true)}
                  aria-expanded={false}
                  aria-label="Add new task or progress file"
                  title="Add new task / progress file"
                >
                  <span className="done-add-round-icon">+</span>
                </button>
              </div>
            ) : (
              <form
                ref={formRef}
                className="done-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = text.trim();
                  if (!next) return;
                  const sourceValue = isUrlSource(source)
                    ? normalizeSourceUrl(source)
                    : source.trim();
                  onAdd(project._id, next, {
                    source: sourceValue,
                    sourceTitle: sourceTitle.trim(),
                    sourceProof,
                    hasCheckbox,
                  });
                  setText("");
                  setSource("");
                  setSourceTitle("");
                  setSourceProof(null);
                  setSourceError("");
                  setHasCheckbox(true);
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
                <input
                  type="text"
                  className="done-add-source"
                  maxLength={500}
                  placeholder="Source text or URL (optional)"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    if (e.target.value) setSourceProof(null);
                  }}
                />
                {source.trim() || sourceProof ? (
                  <input
                    type="text"
                    className="done-add-source-title"
                    maxLength={80}
                    placeholder="Source title / label (optional)"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                  />
                ) : null}
                <div className="done-add-actions">
                  <label className="done-add-checkbox-opt" title="Uncheck to create a note line without a checkbox">
                    <input
                      type="checkbox"
                      checked={hasCheckbox}
                      onChange={(e) => setHasCheckbox(e.target.checked)}
                    />
                    <span>Checkbox</span>
                  </label>
                  <button
                    type="button"
                    className="done-file-btn"
                    disabled={busyFile}
                    onClick={() => addFileRef.current?.click()}
                  >
                    {sourceProof
                      ? sourceProof.name || "File attached"
                      : busyFile
                        ? "Reading…"
                        : "Attach file"}
                  </button>
                  <button type="submit" className="chip active" disabled={busyFile}>
                    Add
                  </button>
                </div>
                <FileUploadHint />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

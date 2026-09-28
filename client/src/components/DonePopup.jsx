import { useEffect, useRef, useState } from "react";
import {
  PROOF_ACCEPT,
  fileToProof,
  isImageProof,
  isPdfProof,
  isVideoProof,
  restoreTopicSourceProof,
} from "../lib/socialFeed.js";
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

function topicHasSource(topic) {
  return Boolean(
    String(topic?.source || "").trim() ||
      topic?.sourceProof?.mediaId ||
      topic?.sourceProof?.dataUrl ||
      topic?.sourceProof?.name
  );
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
}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceProof, setSourceProof] = useState(null);
  const [sourceError, setSourceError] = useState("");
  const [busyFile, setBusyFile] = useState(false);
  const [sourcePanelId, setSourcePanelId] = useState(null);
  const [sourceTab, setSourceTab] = useState("open");
  const [linkDraft, setLinkDraft] = useState("");
  const addFileRef = useRef(null);
  const topicFileRef = useRef(null);
  const pendingTopicIdRef = useRef(null);

  const allTopics = Array.isArray(project.topics) ? project.topics : [];
  const todayMode = mode === "today";
  const topics = todayMode
    ? allTopics.filter((t) => (topicIds || []).includes(String(t.id)))
    : allTopics;
  const panelTopic = topics.find((t) => t.id === sourcePanelId) || null;

  const left = Math.min(Math.max(8, x), window.innerWidth - 340);
  const top = Math.min(Math.max(8, y), window.innerHeight - 360);

  useEffect(() => {
    if (!panelTopic) return;
    setLinkDraft(String(panelTopic.source || ""));
    setSourceTab(topicHasSource(panelTopic) ? "open" : "link");
  }, [panelTopic?.id, panelTopic?.source, panelTopic?.sourceProof?.mediaId]);

  const pickTopicFile = (topicId) => {
    pendingTopicIdRef.current = topicId;
    topicFileRef.current?.click();
  };

  const openPanel = (topic) => {
    setSourceError("");
    setSourcePanelId(topic.id);
    setLinkDraft(String(topic.source || ""));
    setSourceTab(topicHasSource(topic) ? "open" : "link");
  };

  const closePanel = () => {
    setSourcePanelId(null);
    setSourceTab("open");
    setLinkDraft("");
  };

  const saveLink = (topic) => {
    const normalized = normalizeSourceUrl(linkDraft);
    onSetSource?.(project._id, topic.id, {
      source: normalized,
      sourceProof: null,
    });
    setSourceTab("open");
  };

  const clearSource = (topic) => {
    onSetSource?.(project._id, topic.id, { source: "", sourceProof: null });
    setLinkDraft("");
    setSourceTab("link");
  };

  const onTopicFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const topicId = pendingTopicIdRef.current;
    pendingTopicIdRef.current = null;
    if (!file || !topicId) return;
    setSourceError("");
    setBusyFile(true);
    try {
      const proof = await fileToProof(file);
      onSetSource?.(project._id, topicId, {
        source: "",
        sourceProof: proof,
      });
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
      className="done-backdrop"
      onMouseDown={onClose}
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
            : "What the works to do"}
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
              const hasSource = topicHasSource(topic);
              const isFileSource = Boolean(
                topic.sourceProof?.mediaId ||
                  topic.sourceProof?.dataUrl ||
                  topic.sourceProof?.name
              );
              const isOpen = sourcePanelId === topic.id;
              const sourceLabel = topic.sourceProof?.name
                ? `File: ${topic.sourceProof.name}`
                : topic.source || "";
              return (
                <li
                  key={topic.id}
                  className={`${finished ? "is-done" : ""} ${isOpen ? "is-source-open" : ""}`}
                >
                  <div className="done-row">
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
                    <button
                      type="button"
                      className={`done-source ${hasSource ? "has-source" : ""} ${isOpen ? "is-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOpen) closePanel();
                        else openPanel(topic);
                      }}
                      disabled={busyFile}
                      title={hasSource ? sourceLabel || "Source" : "Add source"}
                      aria-expanded={isOpen}
                      aria-label={`Source for ${topic.text}`}
                    >
                      Source
                    </button>
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
                          Open
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sourceTab === "link"}
                          className={sourceTab === "link" ? "is-active" : ""}
                          onClick={() => setSourceTab("link")}
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sourceTab === "file"}
                          className={sourceTab === "file" ? "is-active" : ""}
                          onClick={() => setSourceTab("file")}
                        >
                          File
                        </button>
                      </div>

                      {sourceTab === "open" ? (
                        <div className="done-source-pane">
                          {!hasSource ? (
                            <p className="done-source-meta">
                              No source yet — use Link or File.
                            </p>
                          ) : isFileSource ? (
                            <>
                              <p className="done-source-meta">
                                {topic.sourceProof?.name || "Attached file"}
                              </p>
                              <SourceFileViewer proof={topic.sourceProof} />
                            </>
                          ) : (
                            <>
                              <p className="done-source-meta">{topic.source}</p>
                              <button
                                type="button"
                                className="done-source-primary"
                                onClick={() => openSourceUrl(topic.source)}
                              >
                                Open link
                              </button>
                            </>
                          )}
                          {hasSource ? (
                            <button
                              type="button"
                              className="done-source-clear"
                              onClick={() => clearSource(topic)}
                            >
                              Clear source
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {sourceTab === "link" ? (
                        <div className="done-source-pane">
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
                            onClick={() => saveLink(topic)}
                          >
                            Save link
                          </button>
                        </div>
                      ) : null}

                      {sourceTab === "file" ? (
                        <div className="done-source-pane">
                          <p className="done-source-meta">
                            Upload image, video, or PDF
                            {topic.sourceProof?.name
                              ? ` · current: ${topic.sourceProof.name}`
                              : ""}
                          </p>
                          <button
                            type="button"
                            className="done-source-primary"
                            disabled={busyFile}
                            onClick={() => pickTopicFile(topic.id)}
                          >
                            {busyFile ? "Uploading…" : "Upload file"}
                          </button>
                          {topic.sourceProof ? (
                            <SourceFileViewer proof={topic.sourceProof} />
                          ) : null}
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

        {!todayMode && (
          <form
            className="done-add"
            onSubmit={(e) => {
              e.preventDefault();
              const next = text.trim();
              if (!next) return;
              onAdd(project._id, next, {
                source: normalizeSourceUrl(source),
                sourceProof,
              });
              setText("");
              setSource("");
              setSourceProof(null);
              setSourceError("");
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
              type="url"
              className="done-add-source"
              maxLength={500}
              placeholder="Source URL (optional)"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (e.target.value) setSourceProof(null);
              }}
            />
            <div className="done-add-actions">
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
          </form>
        )}
      </div>
    </div>
  );
}

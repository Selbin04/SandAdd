import { useEffect, useState } from "react";
import {
  isImageProof,
  isPdfProof,
  isVideoProof,
  restoreTopicSourceProof,
  getLocalPostsForTopic,
} from "../lib/socialFeed.js";
import AiSourceSummary from "./AiSourceSummary.jsx";
import TaskSourcePosts from "./TaskSourcePosts.jsx";
import "./SourceMedia.css";

export function normalizeSourceUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s.slice(0, 500);
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) return `https://${s}`.slice(0, 500);
  return s.slice(0, 500);
}

export function openSourceUrl(url) {
  const href = normalizeSourceUrl(url);
  if (!href) return false;
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

export function isUrlSource(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  return /^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s);
}

export function workHasSource(work) {
  return Boolean(
    String(work?.source || "").trim() ||
      work?.sourceProof?.mediaId ||
      work?.sourceProof?.dataUrl ||
      work?.sourceProof?.name ||
      (Array.isArray(work?.sources) && work.sources.length > 0) ||
      (work?.id && getLocalPostsForTopic(work.id).length > 0)
  );
}

export function workHasFileSource(work) {
  return Boolean(
    work?.sourceProof?.mediaId ||
      work?.sourceProof?.dataUrl ||
      work?.sourceProof?.name
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
    return <p className="source-media-meta">Loading PDF…</p>;
  }
  return (
    <iframe
      className={large ? "source-media-pdf is-large" : "source-media-pdf"}
      title={proof.name || "PDF source"}
      src={url}
    />
  );
}

function SourceFileLightbox({ proof, onClose }) {
  return (
    <div
      className="source-media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={proof.name || "Source file"}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="source-media-lightbox-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="source-media-lightbox-head">
          <strong>{proof.name || "Source file"}</strong>
          <button type="button" className="source-media-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="source-media-lightbox-body">
          {isImageProof(proof) ? (
            <img
              className="source-media-lightbox-media"
              src={proof.dataUrl}
              alt={proof.name || "Source"}
            />
          ) : null}
          {isVideoProof(proof) ? (
            <video
              className="source-media-lightbox-media is-video"
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
            <p className="source-media-meta">Attached: {proof.name || "file"}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Clickable file chip → opens in-app viewer (not a browser tab). */
export function SourceFileViewer({ proof }) {
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
      <p className="source-media-meta">Loading {proof?.name || "file"}…</p>
    );
  }
  if (!ready?.dataUrl) {
    return (
      <p className="source-media-meta">
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
        className="source-media-file-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpened(true);
        }}
      >
        <span className="source-media-file-kind">{kind}</span>
        <span className="source-media-file-name">{label}</span>
        <span className="source-media-file-action">Open</span>
      </button>
      {opened ? (
        <SourceFileLightbox proof={ready} onClose={() => setOpened(false)} />
      ) : null}
    </>
  );
}

export function WorkSourceControl({ work }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("open");
  const [topicPostsCount, setTopicPostsCount] = useState(() =>
    work?.id ? getLocalPostsForTopic(work.id).length : 0
  );

  useEffect(() => {
    if (!work?.id) return;
    const update = () => {
      setTopicPostsCount(getLocalPostsForTopic(work.id).length);
    };
    update();
    window.addEventListener("sandadd:feed-changed", update);
    return () => window.removeEventListener("sandadd:feed-changed", update);
  }, [work?.id]);

  const sourcesList = Array.isArray(work?.sources) ? work.sources : [];
  const fileSources = [
    ...(workHasFileSource(work)
      ? [{ proof: work.sourceProof, title: work.sourceProof?.name || "File", type: "file" }]
      : []),
    ...sourcesList.filter((s) => s.type === "file" || Boolean(s.proof)),
  ];
  const linkSources = [
    ...(isUrlSource(work?.source)
      ? [{ content: work.source, title: "Link", type: "link" }]
      : []),
    ...sourcesList.filter((s) => s.type === "link" || (s.content && isUrlSource(s.content))),
  ];
  const textSources = [
    ...(work?.source && !isUrlSource(work.source)
      ? [{ content: work.source, title: "Note", type: "text" }]
      : []),
    ...sourcesList.filter(
      (s) => s.type === "text" || (s.content && !isUrlSource(s.content) && !s.proof)
    ),
  ];

  const hasPosts = topicPostsCount > 0;
  const hasFile = fileSources.length > 0;
  const hasLink = linkSources.length > 0;
  const hasText = textSources.length > 0;
  const has = workHasSource(work) || hasPosts || hasFile || hasLink || hasText;

  if (!has) return null;

  return (
    <div className={`work-source ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className={`work-source-btn ${has ? "has-source" : ""} ${open ? "is-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setTab("open");
        }}
        aria-expanded={open}
      >
        Source
      </button>
      {open ? (
        <div
          className="work-source-panel"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="work-source-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "open"}
              className={`work-source-tab-btn ${tab === "open" ? "is-active" : ""}`}
              onClick={() => setTab("open")}
            >
              <span className="work-source-tab-label">Open</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "file"}
              className={`work-source-tab-btn ${tab === "file" ? "is-active" : ""}`}
              onClick={() => setTab("file")}
              disabled={!hasFile}
              title={hasFile ? "View attached files" : "No attached files"}
            >
              <span className="work-source-tab-label">File</span>
              {fileSources.length > 0 ? (
                <span className="work-source-tab-count">{fileSources.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "link"}
              className={`work-source-tab-btn ${tab === "link" ? "is-active" : ""}`}
              onClick={() => setTab("link")}
              disabled={!hasLink}
              title={hasLink ? "View source links" : "No source links"}
            >
              <span className="work-source-tab-label">Link</span>
              {linkSources.length > 0 ? (
                <span className="work-source-tab-count">{linkSources.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "post"}
              className={`work-source-tab-btn ${tab === "post" ? "is-active" : ""}`}
              onClick={() => setTab("post")}
              title="View finish posts"
            >
              <span className="work-source-tab-label">Post</span>
              {topicPostsCount > 0 ? (
                <span className="work-source-tab-count">{topicPostsCount}</span>
              ) : null}
            </button>
            {hasText ? (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "text"}
                className={`work-source-tab-btn ${tab === "text" ? "is-active" : ""}`}
                onClick={() => setTab("text")}
                title="View notes"
              >
                <span className="work-source-tab-label">Text</span>
              </button>
            ) : null}
          </div>

          {tab === "open" ? (
            <div className="work-source-pane">
              {hasFile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <AiSourceSummary
                      source={{
                        type: "file",
                        content: work?.source,
                        proof: fileSources[0]?.proof || work?.sourceProof,
                        title: work?.title || work?.name || "Source",
                        aiSummary: work?.aiSummary,
                      }}
                    />
                  </div>
                  {fileSources.map((f, i) => (
                    <SourceFileViewer key={f.proof?.mediaId || f.proof?.name || i} proof={f.proof} />
                  ))}
                </div>
              ) : hasLink ? (
                <>
                  <p className="source-media-meta">{linkSources[0]?.content || work.source}</p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <AiSourceSummary
                      source={{
                        type: "link",
                        content: linkSources[0]?.content || work?.source,
                        title: work?.title || work?.name || "Source",
                        aiSummary: work?.aiSummary,
                      }}
                    />
                    <button
                      type="button"
                      className="work-source-primary"
                      onClick={() => openSourceUrl(linkSources[0]?.content || work.source)}
                    >
                      Open link ↗
                    </button>
                  </div>
                </>
              ) : hasText ? (
                <div className="source-media-text-card">
                  {textSources[0]?.title ? (
                    <strong className="source-media-text-title">{textSources[0].title}</strong>
                  ) : null}
                  <p className="source-media-text-content">{textSources[0]?.content || work.source}</p>
                  <div style={{ marginTop: "8px" }}>
                    <AiSourceSummary
                      source={{
                        type: "text",
                        content: textSources[0]?.content || work?.source,
                        title: textSources[0]?.title || work?.title || "Note",
                        aiSummary: work?.aiSummary,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="source-media-meta">No source available.</p>
              )}

              {topicPostsCount > 0 && (
                <div className="done-source-finished-posts-preview">
                  <div className="done-source-finished-posts-preview-head">
                    <span className="done-source-finished-posts-preview-title">
                      ✓ Finished Posts ({topicPostsCount})
                    </span>
                    <button
                      type="button"
                      className="done-source-finished-posts-view-all"
                      onClick={() => setTab("post")}
                    >
                      View posts →
                    </button>
                  </div>
                  <p className="done-source-finished-posts-preview-sub">
                    Users posted completion updates for this task.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {tab === "file" && hasFile ? (
            <div className="work-source-pane">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {fileSources.map((f, i) => (
                  <SourceFileViewer key={f.proof?.mediaId || f.proof?.name || i} proof={f.proof} />
                ))}
              </div>
            </div>
          ) : null}

          {tab === "link" && hasLink ? (
            <div className="work-source-pane">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {linkSources.map((l, i) => (
                  <div key={i} className="work-source-link-card">
                    {l.title ? <strong className="source-media-link-title">{l.title}</strong> : null}
                    <p className="source-media-meta">{l.content}</p>
                    <button
                      type="button"
                      className="work-source-primary"
                      onClick={() => openSourceUrl(l.content)}
                    >
                      Open link ↗
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "post" ? (
            <div className="work-source-pane">
              <TaskSourcePosts
                topic={work}
                onPostsLoaded={(loaded) => setTopicPostsCount(loaded.length)}
              />
            </div>
          ) : null}

          {tab === "text" && hasText ? (
            <div className="work-source-pane">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {textSources.map((t, i) => (
                  <div key={i} className="source-media-text-card">
                    {t.title ? <strong className="source-media-text-title">{t.title}</strong> : null}
                    <p className="source-media-text-content">{t.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

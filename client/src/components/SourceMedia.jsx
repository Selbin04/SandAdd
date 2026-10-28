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
import SourceTextFullScreenModal from "./SourceTextFullScreenModal.jsx";
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

/** Cover image thumbnail with page/media slice overview before full view. */
export function ImageCoverSlicePreview({ proof, onOpen }) {
  const [hasError, setHasError] = useState(false);
  const hasCustomName = Boolean(proof?.name && proof.name !== "Cover Image");
  const name = hasCustomName ? proof.name : "";

  return (
    <div
      className="done-source-cover-card done-source-image-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      title={name ? `Click to view ${name}` : "Click to view image"}
    >
      <div className="done-source-cover-slice-box">
        {proof?.dataUrl && !hasError ? (
          <img
            src={proof.dataUrl}
            alt={name || "Source image"}
            className="done-source-cover-slice-img is-loaded"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="done-source-slice-fallback">
            <div className="done-source-slice-fallback-glow" aria-hidden="true" />
            <div className="done-source-slice-mockup-page">
              <div className="done-source-mockup-header">
                <span className="done-source-mockup-icon">🖼️</span>
                {name ? <span className="done-source-mockup-bar is-brand">{name}</span> : null}
              </div>
            </div>
          </div>
        )}
        <div className="done-source-cover-overlay">
          <span className="done-source-cover-action-pill" aria-label="View Image">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </span>
        </div>
      </div>
      {hasCustomName ? (
        <div className="done-source-cover-info">
          <div className="done-source-cover-meta-wrap">
            <span className="done-source-cover-title" title={name}>{name}</span>
          </div>
          <div className="done-source-cover-actions">
            <button
              type="button"
              className="done-source-cover-open-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
              aria-label="Open image lightbox"
              title="Open image"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Cover video thumbnail with slice overview and play action. */
export function VideoCoverSlicePreview({ proof, onOpen }) {
  const hasCustomName = Boolean(proof?.name && proof.name !== "Video Attachment");
  const name = hasCustomName ? proof.name : "";

  return (
    <div
      className="done-source-cover-card done-source-video-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      title={name ? `Click to play ${name}` : "Click to play video"}
    >
      <div className="done-source-cover-slice-box">
        <video
          src={proof?.dataUrl}
          className="done-source-cover-slice-img is-loaded"
          preload="metadata"
          muted
        />
        <div className="done-source-cover-overlay">
          <span className="done-source-cover-action-pill is-play" aria-label="Play video">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
        </div>
      </div>
      {hasCustomName ? (
        <div className="done-source-cover-info">
          <div className="done-source-cover-meta-wrap">
            <span className="done-source-cover-title" title={name}>{name}</span>
          </div>
          <div className="done-source-cover-actions">
            <button
              type="button"
              className="done-source-cover-open-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpen?.();
              }}
              aria-label="Play video"
              title="Play video"
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Mini browser cover card with page slice overview before click open. */
export function LinkCoverSlicePreview({
  url,
  title,
  onOpen,
  onEdit,
  isEditMode = false,
  readOnly = false,
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const normalized = normalizeSourceUrl(url);

  let hostname = "";
  let displayPath = "";
  try {
    const parsed = new URL(normalized);
    hostname = parsed.hostname.replace(/^www\./i, "");
    displayPath = parsed.pathname !== "/" ? parsed.pathname : "";
  } catch {
    hostname = String(url || "").replace(/^https?:\/\//i, "").split("/")[0] || "website";
  }

  // Cover screenshot & favicon
  const screenshotUrl = normalized
    ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(normalized)}?w=800`
    : "";
  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
    : "";

  return (
    <div
      className="done-source-cover-card done-source-link-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      title={`Click to open ${hostname}`}
    >
      {/* Mini Browser Window Bar */}
      <div className="done-source-browser-bar">
        <div className="done-source-browser-dots" aria-hidden="true">
          <span className="done-source-dot is-red" />
          <span className="done-source-dot is-yellow" />
          <span className="done-source-dot is-green" />
        </div>
        <div className="done-source-browser-address">
          <svg
            className="done-source-browser-lock"
            viewBox="0 0 24 24"
            width="10"
            height="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              className="done-source-browser-favicon"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : null}
          <span className="done-source-browser-url-text">
            {hostname}
            {displayPath ? <span className="done-source-browser-path">{displayPath}</span> : null}
          </span>
        </div>
        <div className="done-source-browser-status" title="Live link">
          <span className="done-source-live-indicator" />
        </div>
      </div>

      {/* Page Slice Overview Box */}
      <div className="done-source-cover-slice-box">
        {screenshotUrl && !imgFailed ? (
          <img
            src={screenshotUrl}
            alt={title || hostname}
            className={`done-source-cover-slice-img ${imgLoaded ? "is-loaded" : "is-loading"}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : null}

        {/* Elegant wireframe fallback displayed while loading or if snapshot cannot be taken */}
        {(!imgLoaded || imgFailed) && (
          <div className="done-source-slice-fallback">
            <div className="done-source-slice-fallback-glow" aria-hidden="true" />
            <div className="done-source-slice-mockup-page">
              <div className="done-source-mockup-header">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    className="done-source-mockup-fav"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="done-source-mockup-icon">🌐</span>
                )}
                <span className="done-source-mockup-bar is-brand">{hostname}</span>
              </div>
              <div className="done-source-mockup-lines">
                <span className="done-source-mockup-line is-h1" />
                <span className="done-source-mockup-line is-p" />
                <span className="done-source-mockup-line is-p-short" />
              </div>
              <div className="done-source-mockup-cards">
                <span className="done-source-mockup-card-tile" />
                <span className="done-source-mockup-card-tile" />
                <span className="done-source-mockup-card-tile" />
              </div>
            </div>
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className="done-source-cover-overlay">
          <span className="done-source-cover-action-pill" aria-label="Open link">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </span>
        </div>
      </div>

      {/* Cover Info / Meta Footer */}
      <div className="done-source-cover-info">
        <div className="done-source-cover-meta-wrap">
          <span className="done-source-cover-title" title={title || url}>
            {title || hostname}
          </span>
          <span className="done-source-cover-suburl" title={url}>
            {url}
          </span>
        </div>
        <div className="done-source-cover-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="done-source-cover-open-btn"
            onClick={onOpen}
            title="Open link"
            aria-label="Open link"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </button>
          {isEditMode && !readOnly && onEdit ? (
            <button
              type="button"
              className="done-source-title-edit-btn"
              onClick={onEdit}
              title="Edit link URL"
            >
              ✎ Edit
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Clickable file chip / cover overview → opens in-app viewer (not a browser tab). */
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

  const isImg = isImageProof(ready);
  const isVid = isVideoProof(ready);

  return (
    <>
      {isImg ? (
        <ImageCoverSlicePreview
          proof={ready}
          onOpen={(e) => {
            e?.stopPropagation?.();
            setOpened(true);
          }}
        />
      ) : isVid ? (
        <VideoCoverSlicePreview
          proof={ready}
          onOpen={(e) => {
            e?.stopPropagation?.();
            setOpened(true);
          }}
        />
      ) : (
        <button
          type="button"
          className="source-media-file-btn"
          onClick={(e) => {
            e.stopPropagation();
            setOpened(true);
          }}
          title={`Open ${label}`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="source-media-file-name">{label}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
      {opened ? (
        <SourceFileLightbox proof={ready} onClose={() => setOpened(false)} />
      ) : null}
    </>
  );
}

export function WorkSourceControl({ work }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("open");
  const [fullScreenText, setFullScreenText] = useState(null);
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
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <AiSourceSummary
                      source={{
                        type: "link",
                        content: linkSources[0]?.content || work?.source,
                        title: work?.title || work?.name || "Source",
                        aiSummary: work?.aiSummary,
                      }}
                    />
                  </div>
                  <LinkCoverSlicePreview
                    url={linkSources[0]?.content || work.source}
                    title={linkSources[0]?.title || work?.title || work?.name}
                    onOpen={() => openSourceUrl(linkSources[0]?.content || work.source)}
                  />
                </div>
              ) : hasText ? (
                <div className="source-media-text-card">
                  <div className="source-media-text-card-head">
                    {textSources[0]?.title ? (
                      <strong className="source-media-text-title">{textSources[0].title}</strong>
                    ) : null}
                    <button
                      type="button"
                      className="source-media-fullscreen-btn"
                      onClick={() =>
                        setFullScreenText({
                          title: textSources[0]?.title || work?.title || work?.name || "Source Text",
                          subtitle: work?.title || work?.name || "",
                          content: textSources[0]?.content || work.source || "",
                        })
                      }
                      title="View text in full screen"
                      aria-label="View text in full screen"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>
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
                  <LinkCoverSlicePreview
                    key={l.id || i}
                    url={l.content}
                    title={l.title}
                    onOpen={() => openSourceUrl(l.content)}
                  />
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
                    <div className="source-media-text-card-head">
                      {t.title ? (
                        <strong className="source-media-text-title">{t.title}</strong>
                      ) : null}
                      <button
                        type="button"
                        className="source-media-fullscreen-btn"
                        onClick={() =>
                          setFullScreenText({
                            title: t.title || work?.title || work?.name || "Source Text",
                            subtitle: work?.title || work?.name || "",
                            content: t.content || "",
                          })
                        }
                        title="View text in full screen"
                        aria-label="View text in full screen"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                      </button>
                    </div>
                    <p className="source-media-text-content">{t.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {fullScreenText ? (
        <SourceTextFullScreenModal
          isOpen={Boolean(fullScreenText)}
          title={fullScreenText.title}
          subtitle={fullScreenText.subtitle}
          content={fullScreenText.content}
          canEdit={false}
          onClose={() => setFullScreenText(null)}
        />
      ) : null}
    </div>
  );
}

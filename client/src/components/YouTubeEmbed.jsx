import { useState } from "react";
import { parseYouTubeVideo } from "../lib/youtubeHelper.js";
import "./YouTubeEmbed.css";

/**
 * YouTube in-app embed player.
 * Detects and plays any YouTube link directly inside the app with full controls,
 * responsive 16:9 frame, theater expansion modal, and copy/open tools.
 */
export default function YouTubeEmbed({
  url,
  title = "",
  className = "",
  autoPlay = false,
  onEdit = null,
  isEditMode = false,
  readOnly = false,
  showTopBar = true,
}) {
  const video = parseYouTubeVideo(url);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isTheater, setIsTheater] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!video) return null;

  const displayTitle = title || "YouTube Video";

  const handlePlay = (e) => {
    e?.stopPropagation?.();
    setIsPlaying(true);
  };

  const handleCopyLink = (e) => {
    e?.stopPropagation?.();
    try {
      navigator.clipboard.writeText(video.watchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenExternal = (e) => {
    e?.stopPropagation?.();
    window.open(video.watchUrl, "_blank", "noopener,noreferrer");
  };

  const handleToggleTheater = (e) => {
    e?.stopPropagation?.();
    setIsTheater((prev) => !prev);
  };

  const thumbnailSrc = imgError ? video.thumbnailUrl : video.hqThumbnailUrl;

  const playerIframe = (
    <iframe
      className="youtube-embed-iframe"
      src={isPlaying ? video.embedUrl : video.standardEmbedUrl}
      title={displayTitle}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  );

  return (
    <div className={`youtube-embed-card ${className} ${isTheater ? "is-theater-active" : ""}`}>
      {showTopBar && (
        <div className="youtube-embed-topbar">
          <div className="youtube-embed-badge" title="YouTube video ready to play">
            <svg
              className="youtube-embed-badge-icon"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span className="youtube-embed-badge-text">YouTube</span>
          </div>

          <div className="youtube-embed-title-wrap">
            <span className="youtube-embed-title" title={displayTitle}>
              {displayTitle}
            </span>
          </div>

          <div className="youtube-embed-actions">
            <button
              type="button"
              className="youtube-embed-action-btn"
              onClick={handleToggleTheater}
              title={isTheater ? "Normal size" : "Expand in-app theater player"}
              aria-label="Toggle theater mode"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            <button
              type="button"
              className="youtube-embed-action-btn"
              onClick={handleCopyLink}
              title={copied ? "Link copied!" : "Copy YouTube link"}
              aria-label="Copy YouTube link"
            >
              {copied ? (
                <span className="youtube-embed-copied-badge">✓ Copied</span>
              ) : (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="youtube-embed-action-btn is-external"
              onClick={handleOpenExternal}
              title="Watch on YouTube (external tab)"
              aria-label="Watch on YouTube"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </button>

            {isEditMode && !readOnly && onEdit ? (
              <button
                type="button"
                className="youtube-embed-action-btn is-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit link URL"
              >
                ✎
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Video Frame (16:9 Aspect Ratio) */}
      <div className="youtube-embed-viewport">
        {isPlaying ? (
          playerIframe
        ) : (
          <div
            className="youtube-embed-facade"
            onClick={handlePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePlay(e);
              }
            }}
            title="Click to play YouTube video inside app"
            aria-label="Play YouTube video inside app"
          >
            <img
              src={thumbnailSrc}
              alt={displayTitle}
              className="youtube-embed-thumb"
              loading="lazy"
              onError={() => setImgError(true)}
            />

            <div className="youtube-embed-play-overlay">
              <div className="youtube-embed-play-btn" aria-hidden="true">
                <svg viewBox="0 0 68 48" width="54" height="38">
                  <path
                    className="yt-play-shape"
                    d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
                  />
                  <polygon points="45 24 27 14 27 34" fill="#ffffff" />
                </svg>
              </div>
              <span className="youtube-embed-play-label">Play Video</span>
            </div>
          </div>
        )}
      </div>

      {/* In-app Theater Lightbox Modal */}
      {isTheater && (
        <div
          className="youtube-theater-backdrop"
          onClick={handleToggleTheater}
          role="dialog"
          aria-modal="true"
          aria-label="Theater Mode Video Player"
        >
          <div
            className="youtube-theater-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="youtube-theater-head">
              <div className="youtube-theater-head-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#ff0000" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span>{displayTitle}</span>
              </div>
              <div className="youtube-theater-head-actions">
                <button
                  type="button"
                  className="youtube-theater-close-btn"
                  onClick={handleToggleTheater}
                  aria-label="Close theater mode"
                  title="Close theater mode"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="youtube-theater-body">
              <iframe
                className="youtube-embed-iframe"
                src={video.embedUrl}
                title={displayTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


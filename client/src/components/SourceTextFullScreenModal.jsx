import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SourceTextFullScreenModal.css";

export function extractFirstSentence(text) {
  if (!text) return { sentence: "", hasMore: false };
  const raw = String(text).trim();
  if (!raw) return { sentence: "", hasMore: false };

  // First check lines
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const firstLine = lines[0] || raw;

  // Look for sentence terminators (. ! ?)
  const match = firstLine.match(/^([\s\S]+?[.!?])(?:\s|$)/);
  if (match && match[1]) {
    const sentence = match[1].trim();
    const hasMore = raw.length > sentence.length || lines.length > 1;
    return { sentence, hasMore };
  }

  // If there are multiple lines but no sentence terminator on line 1
  if (lines.length > 1) {
    return { sentence: firstLine, hasMore: true };
  }

  // Single line without sentence terminator: if it exceeds ~80 characters
  if (raw.length > 80) {
    const cut = raw.slice(0, 75);
    const lastSpace = cut.lastIndexOf(" ");
    const sentence = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
    return { sentence, hasMore: true };
  }

  return { sentence: raw, hasMore: false };
}

export default function SourceTextFullScreenModal({
  isOpen = true,
  title = "Source Text",
  subtitle = "",
  content = "",
  canEdit = false,
  initialEditing = false,
  onSave = null,
  onClose = null,
}) {
  const [isEditing, setIsEditing] = useState(Boolean(initialEditing && canEdit));
  const [draftContent, setDraftContent] = useState(content || "");
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState("md"); // sm, md, lg, xl
  const [isWide, setIsWide] = useState(false);
  const textareaRef = useRef(null);

  // Sync content when props change
  useEffect(() => {
    setDraftContent(content || "");
    setIsEditing(Boolean(initialEditing && canEdit));
  }, [content, initialEditing, canEdit]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Handle hotkeys (Escape to close, Ctrl+Enter / Ctrl+S to save)
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key === "s")) {
        if (isEditing && onSave) {
          e.preventDefault();
          onSave(draftContent);
          setIsEditing(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isEditing, draftContent, onSave, onClose]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  if (!isOpen) return null;

  const textToAnalyze = isEditing ? draftContent : content || draftContent;
  const trimmed = textToAnalyze.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const charCount = textToAnalyze.length;
  const lineCount = textToAnalyze ? textToAnalyze.split("\n").length : 0;
  const readingTimeMins = Math.max(1, Math.ceil(wordCount / 200));

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToAnalyze);
      } else {
        const dummy = document.createElement("textarea");
        dummy.value = textToAnalyze;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveClick = () => {
    onSave?.(draftContent);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setDraftContent(content || "");
    setIsEditing(false);
    if (initialEditing && !content) {
      onClose?.();
    }
  };

  const cycleFontSize = () => {
    const order = ["sm", "md", "lg", "xl"];
    const nextIdx = (order.indexOf(fontSize) + 1) % order.length;
    setFontSize(order[nextIdx]);
  };

  const fontSizeLabels = {
    sm: "Font: 14px",
    md: "Font: 16px",
    lg: "Font: 19px",
    xl: "Font: 22px",
  };

  return createPortal(
    <div
      className="st-fs-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="st-fs-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="st-fs-container" onMouseDown={(e) => e.stopPropagation()}>
        {/* Top Navigation Bar */}
        <header className="st-fs-header">
          <div className="st-fs-header-left">
            <span className="st-fs-badge">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              SOURCE TEXT
            </span>
            <div className="st-fs-title-group">
              <h2 id="st-fs-title" className="st-fs-title" title={title}>
                {title || "Untitled Note"}
              </h2>
              {subtitle ? (
                <span className="st-fs-subtitle" title={subtitle}>
                  in {subtitle}
                </span>
              ) : null}
            </div>
          </div>

          {/* Center Stats Bar */}
          <div className="st-fs-stats" title="Real-time document length statistics">
            <span className="st-fs-stat-pill">
              <strong>{wordCount.toLocaleString()}</strong> words
            </span>
            <span className="st-fs-stat-sep">•</span>
            <span className="st-fs-stat-pill">
              <strong>{charCount.toLocaleString()}</strong> characters
            </span>
            <span className="st-fs-stat-sep">•</span>
            <span className="st-fs-stat-pill">
              <strong>{lineCount.toLocaleString()}</strong> lines
            </span>
            <span className="st-fs-stat-sep">•</span>
            <span className="st-fs-stat-pill">~{readingTimeMins}m read</span>
          </div>

          {/* Right Action Controls */}
          <div className="st-fs-header-right">
            {!isEditing && (
              <>
                <button
                  type="button"
                  className="st-fs-action-btn"
                  onClick={cycleFontSize}
                  title="Cycle font size for reading comfort"
                >
                  <span className="st-fs-font-icon">Aa</span>
                  <span className="st-fs-btn-label">{fontSizeLabels[fontSize]}</span>
                </button>

                <button
                  type="button"
                  className={`st-fs-action-btn ${isWide ? "is-active" : ""}`}
                  onClick={() => setIsWide((w) => !w)}
                  title={isWide ? "Switch to standard reading width" : "Expand to full width"}
                  aria-label={isWide ? "Reading width" : "Full width"}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {isWide ? (
                      <>
                        <polyline points="4 14 10 14 10 20" />
                        <polyline points="20 10 14 10 14 4" />
                        <line x1="14" y1="10" x2="21" y2="3" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </>
                    ) : (
                      <>
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </>
                    )}
                  </svg>
                  <span className="st-fs-btn-label">{isWide ? "Standard Width" : "Full Width"}</span>
                </button>

                <button
                  type="button"
                  className={`st-fs-action-btn ${copied ? "is-copied" : ""}`}
                  onClick={handleCopy}
                  title="Copy full text to clipboard"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {copied ? (
                      <polyline points="20 6 9 17 4 12" />
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </>
                    )}
                  </svg>
                  <span className="st-fs-btn-label">{copied ? "Copied!" : "Copy"}</span>
                </button>

                {canEdit && onSave && (
                  <button
                    type="button"
                    className="st-fs-action-btn is-edit-trigger"
                    onClick={() => setIsEditing(true)}
                    title="Edit this text in full screen"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span className="st-fs-btn-label">Edit Text</span>
                  </button>
                )}
              </>
            )}

            {isEditing && (
              <>
                <button
                  type="button"
                  className="st-fs-btn-save"
                  onClick={handleSaveClick}
                  title="Save text changes (Ctrl+S or Ctrl+Enter)"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="st-fs-btn-cancel"
                  onClick={handleCancelClick}
                  title="Discard changes and exit editor"
                >
                  Cancel
                </button>
              </>
            )}

            <button
              type="button"
              className="st-fs-btn-close"
              onClick={onClose}
              aria-label="Exit full screen (Escape)"
              title="Close full screen (Esc)"
            >
              <span className="st-fs-close-x">×</span>
              <kbd className="st-fs-close-kbd">ESC</kbd>
            </button>
          </div>
        </header>

        {/* Document Body */}
        <main className={`st-fs-body ${isWide ? "is-wide" : "is-standard"}`}>
          {isEditing ? (
            <div className="st-fs-editor-wrap">
              <textarea
                ref={textareaRef}
                className={`st-fs-textarea font-${fontSize}`}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Type infinite words here freely without any restrictions, notes, specifications, articles, instructions, or thoughts..."
                aria-label="Full screen source text editor"
                spellCheck="true"
              />
              <footer className="st-fs-editor-hint">
                <span>Tip: Press <kbd>Ctrl+S</kbd> or <kbd>Ctrl+Enter</kbd> to save anytime • Infinite word length supported</span>
                <span><strong>{wordCount.toLocaleString()}</strong> words written</span>
              </footer>
            </div>
          ) : (
            <div className={`st-fs-reader font-${fontSize}`}>
              {draftContent ? (
                <div className="st-fs-reader-content">
                  {draftContent}
                </div>
              ) : (
                <div className="st-fs-empty">
                  <div className="st-fs-empty-icon" aria-hidden="true">📝</div>
                  <h3 className="st-fs-empty-title">This text source is currently empty</h3>
                  <p className="st-fs-empty-desc">
                    You can type unlimited words, write deep work logs, documentation, notes, or research.
                  </p>
                  {canEdit && onSave && (
                    <button
                      type="button"
                      className="st-fs-empty-action"
                      onClick={() => setIsEditing(true)}
                    >
                      Start Writing in Full Screen
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>,
    document.body
  );
}

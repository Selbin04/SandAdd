import { useEffect, useState } from "react";
import { summarizeSourceApi } from "../api.js";
import "./AiSourceSummary.css";

const API_KEY_STORAGE = "sandadd_gemini_key";

export default function AiSourceSummary({
  source,
  onSaveSummary,
  compact = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(source?.aiSummary || null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || "";
    } catch {
      return "";
    }
  });

  // Sync with prop changes if source changes
  useEffect(() => {
    setSummary(source?.aiSummary || null);
    setError("");
  }, [source?.id, source?.content, source?.aiSummary]);

  const handleSaveApiKey = (e) => {
    e?.preventDefault?.();
    const cleanKey = apiKeyInput.trim();
    try {
      if (cleanKey) {
        localStorage.setItem(API_KEY_STORAGE, cleanKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
      }
    } catch {
      /* ignore storage error */
    }
    setShowKeyInput(false);
    // Re-trigger summary with new key
    handleFetchSummary(e, true);
  };

  const handleFetchSummary = async (e, forceRefresh = false) => {
    e?.stopPropagation?.();

    // Toggle if summary already exists and not a refresh
    if (summary && !forceRefresh) {
      setIsOpen((prev) => !prev);
      return;
    }

    setIsOpen(true);
    setLoading(true);
    setError("");

    try {
      let clientApiKey = "";
      try {
        clientApiKey = localStorage.getItem(API_KEY_STORAGE) || "";
      } catch {
        clientApiKey = "";
      }

      const res = await summarizeSourceApi({
        type: source?.type,
        content: source?.content,
        proof: source?.proof,
        title: source?.title,
        clientApiKey,
      });

      if (res?.ok && res?.summary) {
        setSummary(res.summary);
        onSaveSummary?.(res.summary);
      } else {
        setError("Could not generate summary.");
      }
    } catch (err) {
      setError(err?.message || "Failed to analyze source.");
    } finally {
      setLoading(false);
    }
  };

  const hasSummary = Boolean(summary?.overview);

  return (
    <div className={`ai-source-summary-container ${className}`}>
      {/* Leftmost Trigger Button */}
      <button
        type="button"
        className={`ai-source-summary-btn ${compact ? "is-compact" : ""} ${hasSummary ? "has-summary" : ""} ${loading ? "is-loading" : ""} ${isOpen ? "is-active" : ""}`}
        onClick={handleFetchSummary}
        title={
          hasSummary
            ? isOpen
              ? "Close AI preview"
              : "View AI preview of this source"
            : "Click for AI summary of what's inside before opening"
        }
        aria-expanded={isOpen}
      >
        <span className="ai-source-sparkle" aria-hidden="true">✨</span>
        <span className="ai-source-btn-text">
          {loading
            ? "Analyzing…"
            : hasSummary
              ? "AI Summary"
              : "Summarize"}
        </span>
        {hasSummary && !loading && (
          <span className="ai-source-indicator-dot" aria-hidden="true" />
        )}
      </button>

      {/* Expanded AI Preview Card */}
      {isOpen && (
        <div
          className="ai-source-card"
          onClick={(e) => e.stopPropagation()}
          role="region"
          aria-label="AI Source Summary"
        >
          {/* Card Header */}
          <div className="ai-source-card-header">
            <div className="ai-source-header-meta">
              <span className="ai-source-card-badge">
                <span className="ai-source-sparkle-small">✨</span>
                AI Preview
              </span>
              {summary?.sourceType ? (
                <span className="ai-source-type-pill">{summary.sourceType}</span>
              ) : null}
              {summary?.estimatedTime ? (
                <span className="ai-source-time-pill">{summary.estimatedTime}</span>
              ) : null}
            </div>

            <div className="ai-source-card-actions">
              <button
                type="button"
                className="ai-source-icon-btn"
                onClick={() => setShowKeyInput((prev) => !prev)}
                title="Configure Gemini API Key"
                aria-label="Configure API Key"
              >
                ⚙
              </button>
              <button
                type="button"
                className="ai-source-icon-btn"
                onClick={(e) => handleFetchSummary(e, true)}
                disabled={loading}
                title="Re-analyze source content"
                aria-label="Re-analyze source"
              >
                ↻
              </button>
              <button
                type="button"
                className="ai-source-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Close summary"
                aria-label="Close summary"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Optional API Key Configuration Form */}
          {showKeyInput && (
            <form className="ai-source-apikey-form" onSubmit={handleSaveApiKey}>
              <div className="ai-source-apikey-label">
                Google Gemini API Key (optional):
              </div>
              <div className="ai-source-apikey-row">
                <input
                  type="password"
                  className="ai-source-apikey-input"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="ai-source-apikey-save">
                  Save
                </button>
              </div>
              <p className="ai-source-apikey-hint">
                Stored privately in your browser for high-accuracy Gemini 1.5 Flash multimodal summaries.
              </p>
            </form>
          )}

          {/* Card Content Area */}
          {loading ? (
            <div className="ai-source-loading-state">
              <div className="ai-source-shimmer-bar" />
              <div className="ai-source-shimmer-bar short" />
              <p className="ai-source-loading-text">
                Extracting and reading source content…
              </p>
            </div>
          ) : error ? (
            <div className="ai-source-error-state">
              <p className="ai-source-error-text">⚠️ {error}</p>
              <button
                type="button"
                className="ai-source-retry-btn"
                onClick={(e) => handleFetchSummary(e, true)}
              >
                Try Again
              </button>
            </div>
          ) : summary ? (
            <div className="ai-source-content-body">
              {summary.title && summary.title !== source?.title ? (
                <div className="ai-source-inferred-title">
                  {summary.title}
                </div>
              ) : null}
              <p className="ai-source-overview">{summary.overview}</p>

              {Array.isArray(summary.keyPoints) && summary.keyPoints.length > 0 ? (
                <ul className="ai-source-keypoints">
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx} className="ai-source-point-item">
                      <span className="ai-source-bullet-icon">▸</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="ai-source-footer-hint">
                <span>💡 Preview ready — click below to open full source.</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { generateTopicsApi } from "../api.js";
import {
  getWorkspaceItems,
  saveWorkspaceItem,
  updateWorkspaceItem,
  deleteWorkspaceItem,
  checkAndTriggerScheduled,
  COVER_PRESETS,
  getCoverPresetDataUrl,
  getCoverPresetObject,
} from "../lib/scheduledProgressStore.js";
import { fileToProof } from "../lib/socialFeed.js";
import {
  IconPaperclip,
  IconMoreVertical,
  IconHeartBubble,
  DoneCoverImage,
} from "./DoneSharedComponents.jsx";
import "./AiProgressWorkspace.css";

export default function AiProgressWorkspace({
  project,
  inline = false,
  onClose,
  onAddTopic,
  showToast,
  readOnlyTasks = false,
}) {
  const projectId = project?._id || project?.id;
  const [items, setItems] = useState(() => getWorkspaceItems(projectId));
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'drafts' | 'scheduled' | 'pushed'
  const [expandedSourceId, setExpandedSourceId] = useState(null);

  // AI Generator state
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(3); // 1 to 5
  const [isGenerating, setIsGenerating] = useState(false);

  // Card More Menu state
  const [menuItem, setMenuItem] = useState(null);
  const [menuStyle, setMenuStyle] = useState({});

  // Edit modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editSchedule, setEditSchedule] = useState("");

  // Cover modal state
  const [coverItem, setCoverItem] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverTheme, setCoverTheme] = useState("space");
  const [coverMode, setCoverMode] = useState("top");
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const coverFileInputRef = useRef(null);

  // Sync workspace items on external updates
  useEffect(() => {
    const handleWorkspaceUpdate = () => {
      setItems(getWorkspaceItems(projectId));
    };
    window.addEventListener("sandadd:workspace-updated", handleWorkspaceUpdate);
    return () => window.removeEventListener("sandadd:workspace-updated", handleWorkspaceUpdate);
  }, [projectId]);

  // Active check interval for scheduled items (every 8s while workspace is open)
  useEffect(() => {
    if (!projectId || !onAddTopic) return;
    const interval = setInterval(() => {
      const pushed = checkAndTriggerScheduled(projectId, onAddTopic);
      if (pushed.length > 0) {
        setItems(getWorkspaceItems(projectId));
        pushed.forEach((p) => {
          showToast?.(`⏰ Auto-pushed: "${p.text}"`);
        });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [projectId, onAddTopic, showToast]);

  // AI Generation
  const handleGenerateAi = async (e) => {
    e?.preventDefault?.();
    if (isGenerating) return;

    setIsGenerating(true);

    try {
      let clientApiKey = "";
      try {
        clientApiKey = localStorage.getItem("sandadd_gemini_key") || "";
      } catch {}

      const existingTopics = Array.isArray(project?.topics) ? project.topics : [];
      const res = await generateTopicsApi({
        prompt: prompt.trim() || `Create progressive milestone files for ${project?.name || "this project"}`,
        count,
        projectName: project?.name || "",
        existingTopics,
        clientApiKey,
      });

      if (res?.ok && Array.isArray(res.topics) && res.topics.length > 0) {
        res.topics.forEach((t, idx) => {
          const themeId = t.coverTheme || COVER_PRESETS[idx % COVER_PRESETS.length].id;
          const coverObj = getCoverPresetObject(themeId);
          saveWorkspaceItem(projectId, {
            text: t.text,
            description: t.description || "",
            source: t.source || (t.links?.[0]?.url) || "",
            links: Array.isArray(t.links) ? t.links : [],
            sourceTitle: t.text,
            coverImage: coverObj,
            coverTheme: themeId,
            coverMode: "top",
            status: "draft",
          });
        });

        setItems(getWorkspaceItems(projectId));
        showToast?.(`✨ Generated ${res.topics.length} progress files!`);
        setPrompt("");
      } else {
        throw new Error(res?.error || "Could not generate files");
      }
    } catch (err) {
      console.warn("AI Generation fallback triggered:", err);
      const fallbackItems = generateLocalProgressFiles(prompt, project?.name, count);
      fallbackItems.forEach((t) => {
        const coverObj = getCoverPresetObject(t.coverTheme);
        saveWorkspaceItem(projectId, {
          text: t.text,
          description: t.description,
          source: t.source || (t.links?.[0]?.url) || "",
          links: Array.isArray(t.links) ? t.links : [],
          coverImage: coverObj,
          coverTheme: t.coverTheme,
          coverMode: "top",
          status: "draft",
        });
      });
      setItems(getWorkspaceItems(projectId));
      showToast?.(`✨ Created ${fallbackItems.length} progress files!`);
      setPrompt("");
    } finally {
      setIsGenerating(false);
    }
  };

  const resolveItemCoverPayload = (item) => {
    let coverPayload = item.coverImage;
    if (!coverPayload && item.coverTheme) {
      coverPayload = getCoverPresetObject(item.coverTheme);
    } else if (typeof coverPayload === "string") {
      const isPreset = COVER_PRESETS.some((p) => p.id === coverPayload);
      coverPayload = isPreset
        ? getCoverPresetObject(coverPayload)
        : {
            dataUrl: coverPayload,
            name: "Cover",
            hasMedia: true,
            type: coverPayload.startsWith("data:image/svg") ? "image/svg+xml" : "image/jpeg",
            themeId: item.coverTheme || undefined,
          };
    } else if (coverPayload && typeof coverPayload === "object") {
      const themeId = coverPayload.themeId || item.coverTheme;
      if (!coverPayload.dataUrl && themeId) {
        coverPayload = {
          ...coverPayload,
          dataUrl: getCoverPresetDataUrl(themeId),
          themeId,
        };
      }
    }
    return coverPayload;
  };

  const buildItemSources = (item) => {
    const list = [];
    const desc = String(item.description || "").trim();

    if (desc) {
      list.push({
        id: `src-desc-${item.id || Date.now()}`,
        title: "Description & Action Plan",
        type: "text",
        content: desc,
        proof: null,
      });
    }

    const linksList = Array.isArray(item.links) && item.links.length > 0
      ? item.links
      : item.source
        ? [{ title: "Reference Resource", url: item.source }]
        : [];

    linksList.forEach((lnk, idx) => {
      const url = typeof lnk === "string" ? lnk : lnk?.url || lnk?.source || "";
      const title = typeof lnk === "object" && lnk?.title ? lnk.title : `Resource ${idx + 1}`;
      if (url) {
        list.push({
          id: `src-link-${item.id || Date.now()}-${idx}`,
          title,
          type: "link",
          content: url,
          proof: null,
        });
      }
    });

    return list;
  };

  // Push single item directly to progress path
  const handlePushDirectly = (item) => {
    if (readOnlyTasks) {
      showToast?.("Progress folder is in read-only mode");
      return;
    }
    const coverPayload = resolveItemCoverPayload(item);
    const itemSources = buildItemSources(item);
    const desc = String(item.description || "").trim();
    const linksList = Array.isArray(item.links) && item.links.length > 0
      ? item.links
      : item.source
        ? [{ title: "Reference Resource", url: item.source }]
        : [];
    const formattedLinks = linksList
      .map((l, i) => `${i + 1}. ${l.title || "Resource"}: ${l.url || l}`)
      .join("\n");
    const combinedSource = desc && formattedLinks
      ? `${desc}\n\nRelated Resources:\n${formattedLinks}`
      : desc || formattedLinks;

    onAddTopic?.(item.text, {
      source: combinedSource,
      sourceTitle: item.sourceTitle || item.text,
      description: desc,
      sources: itemSources,
      coverImage: coverPayload,
      coverMode: item.coverMode || (coverPayload ? "top" : "none"),
      hasCheckbox: true,
    });

    updateWorkspaceItem(item.id, {
      status: "pushed",
      pushedAt: new Date().toISOString(),
    });

    setItems(getWorkspaceItems(projectId));
    showToast?.(`🚀 Pushed "${item.text}" directly to Progress Path!`);
    setMenuItem(null);
  };

  // Push all unpushed drafts directly
  const handlePushAllDrafts = () => {
    if (readOnlyTasks) {
      showToast?.("Progress folder is in read-only mode");
      return;
    }
    const unpushed = items.filter((x) => x.status !== "pushed");
    if (unpushed.length === 0) return;

    unpushed.forEach((item) => {
      const coverPayload = resolveItemCoverPayload(item);
      const itemSources = buildItemSources(item);
      const desc = String(item.description || "").trim();
      const linksList = Array.isArray(item.links) && item.links.length > 0
        ? item.links
        : item.source
          ? [{ title: "Reference Resource", url: item.source }]
          : [];
      const formattedLinks = linksList
        .map((l, i) => `${i + 1}. ${l.title || "Resource"}: ${l.url || l}`)
        .join("\n");
      const combinedSource = desc && formattedLinks
        ? `${desc}\n\nRelated Resources:\n${formattedLinks}`
        : desc || formattedLinks;

      onAddTopic?.(item.text, {
        source: combinedSource,
        sourceTitle: item.sourceTitle || item.text,
        description: desc,
        sources: itemSources,
        coverImage: coverPayload,
        coverMode: item.coverMode || (coverPayload ? "top" : "none"),
        hasCheckbox: true,
      });

      updateWorkspaceItem(item.id, {
        status: "pushed",
        pushedAt: new Date().toISOString(),
      });
    });

    setItems(getWorkspaceItems(projectId));
    showToast?.(`🚀 Pushed all ${unpushed.length} progress files to Progress Path!`);
  };

  // Manual Add Draft
  const handleAddManualDraft = () => {
    const defaultTheme = COVER_PRESETS[items.length % COVER_PRESETS.length].id;
    const coverObj = getCoverPresetObject(defaultTheme);
    const newItem = saveWorkspaceItem(projectId, {
      text: `Progress File ${items.length + 1}`,
      description: "Define actionable milestones and tasks for this progress file.",
      source: "",
      coverImage: coverObj,
      coverTheme: defaultTheme,
      coverMode: "top",
      status: "draft",
    });
    setItems(getWorkspaceItems(projectId));
    handleOpenEditModal(newItem);
  };

  // Toggle more menu
  const handleToggleMoreMenu = (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuItem?.id === item.id) {
      setMenuItem(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 190;
    const menuLeft = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setMenuStyle({
      position: "fixed",
      left: `${menuLeft}px`,
      top: `${rect.bottom + 4}px`,
      zIndex: 100000,
    });
    setMenuItem(item);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setEditTitle(item.text || "");
    setEditDesc(item.description || "");
    setEditSource(item.source || "");
    setEditSchedule(item.scheduledAt ? toDatetimeLocalString(new Date(item.scheduledAt)) : "");
    setMenuItem(null);
  };

  const handleSaveEdit = (e) => {
    e?.preventDefault?.();
    if (!editingItem) return;
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;

    const scheduledDate = editSchedule ? new Date(editSchedule).toISOString() : null;

    updateWorkspaceItem(editingItem.id, {
      text: cleanTitle,
      description: editDesc.trim(),
      source: editSource.trim(),
      scheduledAt: scheduledDate,
    });

    setItems(getWorkspaceItems(projectId));
    showToast?.("Progress file updated");
    setEditingItem(null);
  };

  // Schedule Shortcuts
  const handleSetQuickSchedule = (item, offsetHours) => {
    const target = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    target.setMinutes(Math.ceil(target.getMinutes() / 15) * 15, 0, 0);

    updateWorkspaceItem(item.id, {
      scheduledAt: target.toISOString(),
    });
    setItems(getWorkspaceItems(projectId));
    showToast?.(`⏰ Scheduled for ${target.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  };

  const handleCancelSchedule = (item) => {
    updateWorkspaceItem(item.id, {
      scheduledAt: null,
      status: "draft",
    });
    setItems(getWorkspaceItems(projectId));
    showToast?.("Schedule removed");
  };

  // Delete
  const handleDeleteItem = (id) => {
    deleteWorkspaceItem(id);
    setItems(getWorkspaceItems(projectId));
    showToast?.("Progress file draft deleted");
    setMenuItem(null);
  };

  // Coverpage Modal
  const handleOpenCoverModal = (item) => {
    setCoverItem(item);
    const existing = item.coverImage || (item.coverTheme ? getCoverPresetObject(item.coverTheme) : null);
    setCoverPreview(existing);
    setCoverTheme(item.coverTheme || existing?.themeId || "space");
    setCoverMode(item.coverMode || (existing ? "top" : "top"));
    setCoverUrlInput("");
    setMenuItem(null);
  };

  const handlePickPresetTheme = (themeId) => {
    setCoverTheme(themeId);
    setCoverPreview(getCoverPresetObject(themeId));
  };

  const handleUploadCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const proof = await fileToProof(file);
      setCoverTheme("");
      setCoverPreview(proof);
    } catch {
      showToast?.("Could not load image");
    }
  };

  const handleApplyCoverUrl = () => {
    const trimmed = coverUrlInput.trim();
    if (trimmed) {
      setCoverTheme("");
      setCoverPreview({
        dataUrl: trimmed,
        name: "Custom URL",
        hasMedia: true,
        type: "image/jpeg",
      });
      setCoverUrlInput("");
    }
  };

  const handleSaveCover = () => {
    if (!coverItem) return;
    updateWorkspaceItem(coverItem.id, {
      coverImage: coverPreview,
      coverTheme,
      coverMode,
    });
    setItems(getWorkspaceItems(projectId));
    showToast?.("Coverpage applied");
    setCoverItem(null);
  };

  const handleRemoveCover = () => {
    if (!coverItem) return;
    updateWorkspaceItem(coverItem.id, {
      coverImage: null,
      coverTheme: null,
      coverMode: "none",
    });
    setItems(getWorkspaceItems(projectId));
    showToast?.("Coverpage removed");
    setCoverItem(null);
  };

  // Filtered Items
  const draftsCount = items.filter((x) => x.status === "draft").length;
  const scheduledCount = items.filter((x) => x.status === "scheduled").length;
  const pushedCount = items.filter((x) => x.status === "pushed").length;

  const filteredItems = items.filter((item) => {
    if (filterTab === "drafts") return item.status === "draft";
    if (filterTab === "scheduled") return item.status === "scheduled";
    if (filterTab === "pushed") return item.status === "pushed";
    return true;
  });

  return (
    <div
      className={`progg-ai-workspace-page ${inline ? "is-inline" : "is-popup"}`}
      role="dialog"
      aria-label="AI Progg Workspace"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Header Bar */}
      <header className="ws-head-bar">
        <div className="ws-head-left">
          <button
            type="button"
            className="ws-back-btn"
            onClick={onClose}
            aria-label="Back to progress folder"
            title="Return to Progress Folder"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            <span>Back to Folder</span>
          </button>
          <div className="ws-title-wrap">
            <h3 className="ws-main-title">
              <span className="ws-sparkle-icon" aria-hidden="true">✨</span>
              <span>AI Progg Workspace</span>
            </h3>
            <span className="ws-project-badge" title={project?.name}>
              Folder: {project?.name}
            </span>
          </div>
        </div>

        <div className="ws-head-right">
          <div className="ws-stat-pills">
            <span className="ws-stat-pill is-draft" title="Unpushed drafts">
              {draftsCount} Drafts
            </span>
            <span className="ws-stat-pill is-scheduled" title="Scheduled auto-pushes">
              {scheduledCount} Scheduled
            </span>
          </div>
          <button
            type="button"
            className="ws-close-btn"
            onClick={onClose}
            aria-label="Close workspace"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. Main Scrollable Container */}
      <div className="ws-content-body">
        {/* AI Generator Panel */}
        <section className="ws-ai-generator-card">
          <div className="ws-gen-header">
            <div className="ws-gen-badge">
              <span className="ws-gen-glow-dot" />
              <span>AI Milestone Engine</span>
            </div>
            <span className="ws-gen-limit-hint">Create up to 5 progress files at once</span>
          </div>

          <form onSubmit={handleGenerateAi} className="ws-gen-form">
            <div className="ws-input-row">
              <div className="ws-prompt-input-wrapper">
                <span className="ws-prompt-icon" aria-hidden="true">💡</span>
                <input
                  type="text"
                  className="ws-prompt-input"
                  placeholder="Enter your prompt / idea (e.g. 'Build an e-commerce website', 'Learn Python data science', 'Marathon preparation plan')..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  aria-label="Progress file prompt or idea"
                />
                {prompt ? (
                  <button
                    type="button"
                    className="ws-prompt-clear-btn"
                    onClick={() => setPrompt("")}
                    title="Clear prompt"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <div className="ws-count-selector" title="Choose 1 to 5 progress files to generate">
                <span className="ws-count-label">Count:</span>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`ws-count-btn ${count === num ? "is-selected" : ""}`}
                    onClick={() => setCount(num)}
                    disabled={isGenerating}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className={`ws-gen-submit-btn ${isGenerating ? "is-loading" : ""}`}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="ws-spinner" aria-hidden="true" />
                    <span>Generating Ideas...</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">✨</span>
                    <span>Generate Progress Files ({count})</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Idea Pills */}
            <div className="ws-quick-pills">
              <span className="ws-quick-label">Suggestions:</span>
              <button
                type="button"
                className="ws-quick-pill"
                onClick={() => setPrompt(`Foundations & Setup for ${project?.name || "project"}`)}
              >
                Foundations & Setup
              </button>
              <button
                type="button"
                className="ws-quick-pill"
                onClick={() => setPrompt(`Core Milestones & Architecture for ${project?.name || "project"}`)}
              >
                Core Milestones
              </button>
              <button
                type="button"
                className="ws-quick-pill"
                onClick={() => setPrompt(`Testing, Polish & Capstone Deliverables for ${project?.name || "project"}`)}
              >
                Testing & Polish
              </button>
              <button
                type="button"
                className="ws-manual-add-btn"
                onClick={handleAddManualDraft}
                title="Create a progress file manually"
              >
                + Manual Draft
              </button>
            </div>
          </form>
        </section>

        {/* 3. Toolbar & Filters */}
        <section className="ws-list-toolbar">
          <div className="ws-filter-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "all"}
              className={`ws-filter-tab ${filterTab === "all" ? "is-active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "drafts"}
              className={`ws-filter-tab ${filterTab === "drafts" ? "is-active" : ""}`}
              onClick={() => setFilterTab("drafts")}
            >
              Drafts ({draftsCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "scheduled"}
              className={`ws-filter-tab ${filterTab === "scheduled" ? "is-active" : ""}`}
              onClick={() => setFilterTab("scheduled")}
            >
              Scheduled ({scheduledCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === "pushed"}
              className={`ws-filter-tab ${filterTab === "pushed" ? "is-active" : ""}`}
              onClick={() => setFilterTab("pushed")}
            >
              Pushed ({pushedCount})
            </button>
          </div>

          <div className="ws-toolbar-actions">
            {draftsCount + scheduledCount > 0 && (
              <button
                type="button"
                className="ws-push-all-btn"
                onClick={handlePushAllDrafts}
                title="Immediately push all drafts to the progress path"
              >
                <span aria-hidden="true">🚀</span>
                <span>Push All Drafts ({draftsCount + scheduledCount})</span>
              </button>
            )}
          </div>
        </section>

        {/* 4. Progress Files List (Matches exact DonePopup .done-list structure and styles) */}
        {filteredItems.length === 0 ? (
          <div className="ws-empty-state">
            <div className="ws-empty-icon" aria-hidden="true">📁</div>
            <p className="ws-empty-title">No workspace progress files</p>
            <p className="ws-empty-subtitle">
              {filterTab === "scheduled"
                ? "No files are scheduled. Set a date and time on any draft to auto-push!"
                : filterTab === "pushed"
                  ? "Pushed items will be archived here once sent to the progress path."
                  : "Generate up to 5 progress files at once using AI above, or create one manually."}
            </p>
          </div>
        ) : (
          <ul className="done-list ws-exact-done-list">
            {filteredItems.map((item) => {
              const isPushed = item.status === "pushed";
              const isScheduled = item.status === "scheduled" && item.scheduledAt;
              const itemCover = resolveItemCoverPayload(item);
              const hasCover = Boolean(
                itemCover &&
                  (itemCover.dataUrl ||
                    itemCover.themeId ||
                    itemCover.mediaId ||
                    (typeof itemCover === "string" && itemCover.trim().length > 0))
              );
              const coverMode = item.coverMode || (hasCover ? "top" : "none");
              const isFullCover = hasCover && coverMode === "full";
              const isTopCover = hasCover && coverMode === "top";
              const isSourceExpanded = expandedSourceId === item.id;
              const scheduledDate = isScheduled ? new Date(item.scheduledAt) : null;
              const linksList = Array.isArray(item.links) && item.links.length > 0
                ? item.links
                : item.source
                  ? [{ title: "Reference Resource", url: item.source }]
                  : [];
              const hasSource = Boolean(item.source || item.description || linksList.length > 0);
              const sourceCount = (item.description ? 1 : 0) + linksList.length;

              const renderSourceExpand = (isCover = false) => {
                if (!isSourceExpanded) return null;
                return (
                  <div className={`ws-item-source-expand ${isCover ? "is-cover-mode" : ""}`}>
                    {item.description ? (
                      <div className="ws-source-desc-section">
                        <span className="ws-source-section-tag">📄 Description & Action Plan</span>
                        <p className="ws-item-desc-text">{item.description}</p>
                      </div>
                    ) : null}
                    {linksList.length > 0 ? (
                      <div className="ws-source-link-section">
                        <span className="ws-source-section-tag">
                          🔗 Related Resources ({linksList.length} links)
                        </span>
                        <div className="ws-source-links-grid">
                          {linksList.map((lnk, idx) => {
                            const url = typeof lnk === "string" ? lnk : lnk?.url || lnk?.source || "";
                            const title = typeof lnk === "object" && lnk?.title ? lnk.title : `Resource ${idx + 1}`;
                            const href = url.startsWith("http") ? url : `https://${url}`;
                            return (
                              <div key={idx} className="ws-source-link-item">
                                <span className="ws-source-link-num">{idx + 1}.</span>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ws-source-link-anchor"
                                  title={url}
                                >
                                  <span className="ws-source-link-title">{title}</span>
                                  <span className="ws-source-link-url">{url.replace(/^https?:\/\//i, "")}</span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              };

              const renderTray = (mode = "normal") => (
                <div className={`ws-card-exact-tray is-${mode}`}>
                  <div className="ws-tray-left">
                    {!isPushed ? (
                      <div className="ws-tray-schedule-wrap">
                        <label className="ws-tray-sched-label" title="Set date and time to auto-push">
                          <span className="ws-tray-sched-icon" aria-hidden="true">⏰</span>
                          <input
                            type="datetime-local"
                            className="ws-tray-datetime-input"
                            value={item.scheduledAt ? toDatetimeLocalString(new Date(item.scheduledAt)) : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                updateWorkspaceItem(item.id, {
                                  scheduledAt: new Date(val).toISOString(),
                                });
                                setItems(getWorkspaceItems(projectId));
                                showToast?.("Auto-push scheduled!");
                              }
                            }}
                          />
                        </label>

                        <div className="ws-tray-chips">
                          <button
                            type="button"
                            className="ws-tray-chip"
                            onClick={() => handleSetQuickSchedule(item, 1)}
                            title="Auto-push in 1 hour"
                          >
                            +1h
                          </button>
                          <button
                            type="button"
                            className="ws-tray-chip"
                            onClick={() => handleSetQuickSchedule(item, 24)}
                            title="Auto-push tomorrow"
                          >
                            +24h
                          </button>
                          {isScheduled && (
                            <button
                              type="button"
                              className="ws-tray-chip-cancel"
                              onClick={() => handleCancelSchedule(item)}
                              title="Remove auto-push schedule"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="ws-tray-pushed-indicator">
                        ✓ Included in Progress Path
                      </span>
                    )}
                  </div>

                  <div className="ws-tray-right">
                    {!isPushed ? (
                      <button
                        type="button"
                        className="ws-tray-push-btn"
                        onClick={() => handlePushDirectly(item)}
                        title="Push to progress folder now"
                      >
                        <span>🚀 Push to Path</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="ws-tray-icon-btn"
                      onClick={() => handleOpenCoverModal(item)}
                      title="Add or Change Coverpage"
                    >
                      🖼️
                    </button>

                    <button
                      type="button"
                      className="ws-tray-icon-btn"
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit Progress File"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      className="ws-tray-icon-btn is-delete"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Delete Draft"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );

              return (
                <li
                  key={item.id}
                  className={`ws-exact-item ${isPushed ? "is-done" : ""} ${isSourceExpanded ? "is-source-open" : ""} ${
                    isFullCover ? "has-cover cover-full" : isTopCover ? "has-cover cover-top" : ""
                  }`}
                >
                  {/* Option 1: Full Card Cover */}
                  {isFullCover ? (
                    <div className="done-cover-full-wrapper">
                      <div className="done-cover-full-backdrop">
                        <DoneCoverImage cover={itemCover} className="done-cover-full-img" />
                        <div className="done-cover-full-scrim" />
                      </div>

                      <div className="done-cover-full-content">
                        {/* Sky-Blue Pill Box for Checkbox + Task Text */}
                        <div className="done-cover-pill-box">
                          <button
                            type="button"
                            className={`done-cover-check ${isPushed ? "is-checked" : ""}`}
                            onClick={() => handlePushDirectly(item)}
                            title={isPushed ? "Included in progress path" : "Click to push to progress path"}
                          >
                            {isPushed ? "✓" : ""}
                          </button>
                          <span className={`done-cover-pill-text ${isPushed ? "is-done" : ""}`}>
                            {item.text}
                          </span>
                          {isScheduled ? (
                            <span className="done-top-badge done-top-badge-sky">
                              ⏰ {formatScheduledTime(scheduledDate)}
                            </span>
                          ) : isPushed ? (
                            <span className="done-top-badge done-top-badge-sky">✓ PUSHED</span>
                          ) : (
                            <span className="done-top-badge done-top-badge-sky">DRAFT</span>
                          )}
                        </div>

                        {/* SOURCE Button underneath bubble */}
                        <div className="done-cover-mid-row">
                          <button
                            type="button"
                            className={`done-source done-source-cover ${hasSource ? "has-source" : ""} ${isSourceExpanded ? "is-active" : ""}`}
                            onClick={() => setExpandedSourceId(isSourceExpanded ? null : item.id)}
                            title={hasSource ? item.source || item.description : "No source"}
                          >
                            <span className="done-source-label">
                              SOURCE ({sourceCount})
                            </span>
                          </button>
                        </div>

                        {renderSourceExpand(true)}

                        {/* Bottom Row */}
                        <div className="done-cover-bottom-row">
                          <div className="done-cover-actions">
                            <button
                              type="button"
                              className="done-cover-heart-btn"
                              onClick={() => handlePushDirectly(item)}
                              title={isPushed ? "Pushed to progress path" : "Push directly to progress path"}
                            >
                              <IconHeartBubble filled={isPushed} />
                            </button>
                            <button
                              type="button"
                              className={`done-cover-white-circle-btn ${menuItem?.id === item.id ? "is-active" : ""}`}
                              onClick={(e) => handleToggleMoreMenu(item, e)}
                              title="Options"
                            >
                              <span className="done-cover-circle-inner" />
                            </button>
                          </div>
                        </div>

                        {renderTray("full")}
                      </div>
                    </div>
                  ) : isTopCover ? (
                    /* Option 2: Top Banner Cover */
                    <div className="done-cover-top-wrapper">
                      <div className="done-cover-top-banner">
                        <DoneCoverImage cover={itemCover} className="done-cover-top-img" />
                      </div>

                      <div className="done-cover-top-body">
                        <div className="done-row">
                          <div className="done-row-main">
                            <div className="done-text-line">
                              <span className={`done-text ${isPushed ? "is-done" : ""}`}>
                                {item.text}
                              </span>
                              {isScheduled ? (
                                <span className="done-top-badge is-sched-badge">
                                  ⏰ {formatScheduledTime(scheduledDate)}
                                </span>
                              ) : isPushed ? (
                                <span className="done-top-badge is-push-badge">✓ PUSHED</span>
                              ) : (
                                <span className="done-top-badge is-draft-badge">DRAFT</span>
                              )}
                            </div>

                            <button
                              type="button"
                              className={`done-source ${hasSource ? "has-source" : ""} ${isSourceExpanded ? "is-active" : ""}`}
                              onClick={() => setExpandedSourceId(isSourceExpanded ? null : item.id)}
                              title={hasSource ? item.source || item.description : "View notes/source"}
                            >
                              <IconPaperclip className="done-source-icon" />
                              <span className="done-source-label">Source</span>
                              {sourceCount > 0 ? (
                                <span className="done-source-count-chip">
                                  <span className="done-source-sep">•</span>
                                  <span className="done-source-count">{sourceCount}</span>
                                </span>
                              ) : null}
                            </button>
                          </div>

                          <div className="done-row-side">
                            <div className="done-row-actions">
                              <button
                                type="button"
                                className={`done-more-btn ${menuItem?.id === item.id ? "is-active" : ""}`}
                                onClick={(e) => handleToggleMoreMenu(item, e)}
                                title="Options"
                              >
                                <IconMoreVertical />
                              </button>
                            </div>
                            <button
                              type="button"
                              className={`done-check ${isPushed ? "is-checked" : ""}`}
                              onClick={() => handlePushDirectly(item)}
                              title={isPushed ? "Included in progress path" : "Push directly to progress path"}
                            >
                              {isPushed ? "✓" : ""}
                            </button>
                          </div>
                        </div>

                        {renderSourceExpand(false)}
                        {renderTray("top")}
                      </div>
                    </div>
                  ) : (
                    /* Option 3: Normal State (No cover image) */
                    <>
                      <div className="done-row">
                        <div className="done-row-main">
                          <div className="done-text-line">
                            <span className={`done-text ${isPushed ? "is-done" : ""}`}>
                              {item.text}
                            </span>
                            {isScheduled ? (
                              <span className="done-top-badge is-sched-badge">
                                ⏰ {formatScheduledTime(scheduledDate)}
                              </span>
                            ) : isPushed ? (
                              <span className="done-top-badge is-push-badge">✓ PUSHED</span>
                            ) : (
                              <span className="done-top-badge is-draft-badge">DRAFT</span>
                            )}
                          </div>

                          <button
                            type="button"
                            className={`done-source ${hasSource ? "has-source" : ""} ${isSourceExpanded ? "is-active" : ""}`}
                            onClick={() => setExpandedSourceId(isSourceExpanded ? null : item.id)}
                            title={hasSource ? item.source || item.description : "View notes/source"}
                          >
                            <IconPaperclip className="done-source-icon" />
                            <span className="done-source-label">Source</span>
                            {sourceCount > 0 ? (
                              <span className="done-source-count-chip">
                                <span className="done-source-sep">•</span>
                                <span className="done-source-count">{sourceCount}</span>
                              </span>
                            ) : null}
                          </button>
                        </div>

                        <div className="done-row-side">
                          <div className="done-row-actions">
                            <button
                              type="button"
                              className={`done-more-btn ${menuItem?.id === item.id ? "is-active" : ""}`}
                              onClick={(e) => handleToggleMoreMenu(item, e)}
                              title="Options"
                            >
                              <IconMoreVertical />
                            </button>
                          </div>
                          <button
                            type="button"
                            className={`done-check ${isPushed ? "is-checked" : ""}`}
                            onClick={() => handlePushDirectly(item)}
                            title={isPushed ? "Included in progress path" : "Push directly to progress path"}
                          >
                            {isPushed ? "✓" : ""}
                          </button>
                        </div>
                      </div>

                      {renderSourceExpand(false)}
                      {renderTray("normal")}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Floating Card Actions Menu (Anchorable via More Button) */}
      {menuItem &&
        createPortal(
          <div
            className="hourglass-menu-overlay"
            onClick={() => setMenuItem(null)}
          >
            <ul
              className="hourglass-action-menu"
              style={menuStyle}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              {menuItem.status !== "pushed" && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="hourglass-action-item-btn"
                    onClick={() => handlePushDirectly(menuItem)}
                  >
                    <span className="menu-item-icon" aria-hidden="true">🚀</span>
                    <span className="hourglass-action-item-label">Push to Progress Path</span>
                  </button>
                </li>
              )}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="hourglass-action-item-btn"
                  onClick={() => handleOpenCoverModal(menuItem)}
                >
                  <span className="menu-item-icon" aria-hidden="true">🖼️</span>
                  <span className="hourglass-action-item-label">
                    {menuItem.coverImage ? "Change Coverpage" : "Add Coverpage"}
                  </span>
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="hourglass-action-item-btn"
                  onClick={() => handleOpenEditModal(menuItem)}
                >
                  <span className="menu-item-icon" aria-hidden="true">✏️</span>
                  <span className="hourglass-action-item-label">Edit Details</span>
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="hourglass-action-item-btn is-report"
                  onClick={() => handleDeleteItem(menuItem.id)}
                >
                  <span className="menu-item-icon" aria-hidden="true">🗑️</span>
                  <span className="hourglass-action-item-label">Delete Progress File</span>
                </button>
              </li>
            </ul>
          </div>,
          document.body
        )}

      {/* 5. Edit Modal */}
      {editingItem &&
        createPortal(
          <div className="ws-modal-overlay" onClick={() => setEditingItem(null)}>
            <div className="ws-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal-head">
                <h4>Edit Progress File</h4>
                <button
                  type="button"
                  className="ws-modal-close"
                  onClick={() => setEditingItem(null)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="ws-modal-form">
                <label className="ws-field-label">
                  File Title / Milestone Name
                  <input
                    type="text"
                    className="ws-modal-input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={120}
                    required
                  />
                </label>

                <label className="ws-field-label">
                  Milestone Deliverables & Notes
                  <textarea
                    className="ws-modal-textarea"
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Detail the steps or goals for this progress file..."
                  />
                </label>

                <label className="ws-field-label">
                  Reference Source / Link (Optional)
                  <input
                    type="text"
                    className="ws-modal-input"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    placeholder="https://... or documentation title"
                  />
                </label>

                <label className="ws-field-label">
                  Auto-Push Date & Time
                  <input
                    type="datetime-local"
                    className="ws-modal-input"
                    value={editSchedule}
                    onChange={(e) => setEditSchedule(e.target.value)}
                  />
                </label>

                <div className="ws-modal-foot">
                  <button
                    type="button"
                    className="ws-modal-cancel"
                    onClick={() => setEditingItem(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="ws-modal-submit">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 6. Coverpage Modal */}
      {coverItem &&
        createPortal(
          <div className="ws-modal-overlay" onClick={() => setCoverItem(null)}>
            <div className="ws-modal-card ws-cover-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ws-modal-head">
                <h4>Customize Coverpage</h4>
                <button
                  type="button"
                  className="ws-modal-close"
                  onClick={() => setCoverItem(null)}
                >
                  ✕
                </button>
              </div>

              {/* Live Preview */}
              <div className="ws-cover-preview-box">
                {coverPreview ? (
                  <div className={`ws-cover-preview-banner ${coverMode === "full" ? "is-full" : ""}`}>
                    <DoneCoverImage cover={coverPreview} className="ws-cover-preview-img" />
                    <span className="ws-preview-tag">
                      Preview: {coverMode === "full" ? "Full Card" : "Top Banner"}
                    </span>
                  </div>
                ) : (
                  <div className="ws-cover-preview-empty">No coverpage attached</div>
                )}
              </div>

              {/* Display Mode Selection */}
              <div className="ws-cover-mode-row">
                <span className="ws-field-sublabel">Cover Display Style:</span>
                <div className="ws-mode-options">
                  <button
                    type="button"
                    className={`ws-mode-btn ${coverMode === "top" ? "is-selected" : ""}`}
                    onClick={() => setCoverMode("top")}
                  >
                    Top Banner
                  </button>
                  <button
                    type="button"
                    className={`ws-mode-btn ${coverMode === "full" ? "is-selected" : ""}`}
                    onClick={() => setCoverMode("full")}
                  >
                    Full Card
                  </button>
                </div>
              </div>

              {/* Aesthetic Presets */}
              <div className="ws-presets-section">
                <span className="ws-field-sublabel">Aesthetic Themes:</span>
                <div className="ws-presets-grid">
                  {COVER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`ws-preset-card ${coverTheme === p.id ? "is-active" : ""}`}
                      style={{ background: p.gradient }}
                      onClick={() => handlePickPresetTheme(p.id)}
                    >
                      <span className="ws-preset-name" style={{ color: p.textColor }}>
                        {p.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload or URL */}
              <div className="ws-upload-section">
                <span className="ws-field-sublabel">Or Upload Custom Image:</span>
                <div className="ws-upload-actions">
                  <input
                    type="file"
                    ref={coverFileInputRef}
                    accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
                    hidden
                    onChange={handleUploadCoverFile}
                  />
                  <button
                    type="button"
                    className="ws-upload-file-btn"
                    onClick={() => coverFileInputRef.current?.click()}
                  >
                    📁 Browse Device Image
                  </button>
                  <div className="ws-url-input-wrap">
                    <input
                      type="text"
                      className="ws-url-input"
                      placeholder="Paste image URL (https://...)"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ws-url-apply-btn"
                      onClick={handleApplyCoverUrl}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="ws-modal-foot">
                {coverPreview && (
                  <button
                    type="button"
                    className="ws-modal-danger"
                    onClick={handleRemoveCover}
                  >
                    Remove Cover
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="ws-modal-cancel"
                  onClick={() => setCoverItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ws-modal-submit"
                  onClick={handleSaveCover}
                >
                  Apply Coverpage
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Helpers
 */
function toDatetimeLocalString(date) {
  if (!date || isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function formatScheduledTime(date) {
  if (!date || isNaN(date.getTime())) return "Scheduled";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
}

function generateLocalProgressFiles(prompt = "", projectName = "", count = 3) {
  const num = Math.max(1, Math.min(5, parseInt(count, 10) || 3));
  const raw = `${prompt} ${projectName}`.trim();
  const lower = raw.toLowerCase();

  // Extract clean subject from user prompt
  let subject = prompt.trim()
    .replace(/^(create|make|generate|build|give me|write|design|plan|prepare|learn|master)\s+/i, "")
    .replace(/^(milestones|steps|progress files|tasks|roadmap|plan)\s+(for|about|to|on)\s+/i, "")
    .replace(/^(how to|in \d+ steps?)\s+/i, "")
    .replace(/\s+(in \d+ steps?|up to \d+|milestones?)$/i, "")
    .trim();

  if (!subject) {
    subject = projectName.trim() || "Progress Milestone";
  }

  subject = subject.charAt(0).toUpperCase() + subject.slice(1);

  let pool = [];

  if (/react|next\.?js|vue|angular|svelte|frontend|web\s*dev|html|css|tailwind|javascript|typescript/i.test(lower)) {
    pool = [
      {
        title: `Phase 1: Project Setup & Core Tooling for ${subject}`,
        desc: `Initialize the modern project repository with strict TypeScript and Vite configurations, install foundational development dependencies, and establish clean folder structures for modular components, styles, and utilities. Configure ESLint and Prettier for automated code quality enforcement, set up path aliases, and verify fast-refresh compilation to ensure an optimal developer workflow before proceeding.`,
        links: [
          { title: "MDN Web Docs - Getting Started with the Web", url: "https://developer.mozilla.org/en-US/docs/Learn" },
          { title: "Vite Next-Gen Frontend Tooling Guide", url: "https://vite.dev/guide/" },
          { title: "TypeScript Handbook - The Basics", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
          { title: "ESLint Configuration & Rules Reference", url: "https://eslint.org/docs/latest/use/getting-started" },
          { title: "Tailwind CSS Modern Styling Documentation", url: "https://tailwindcss.com/docs/installation" },
        ],
        coverTheme: "neon",
      },
      {
        title: `Phase 2: Component Architecture & Responsive Layouts for ${subject}`,
        desc: `Design and assemble reusable UI primitive components following accessibility principles, establish consistent typography and color tokens, and craft fluid responsive grid layouts for all screen viewports. Break down complex user interface sections into self-contained dumb and smart components, utilizing Radix primitives and modern CSS Flexbox and Grid to guarantee exceptional visual harmony.`,
        links: [
          { title: "React Official Learn & Component Architecture", url: "https://react.dev/learn" },
          { title: "Web.dev Responsive Web Design Fundamentals", url: "https://web.dev/explore/design" },
          { title: "Radix UI Accessible Primitives Documentation", url: "https://www.radix-ui.com/primitives" },
          { title: "Lucide Open Source Icon Library & Guide", url: "https://lucide.dev/icons/" },
          { title: "CSS-Tricks A Complete Guide to Flexbox & Grid", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/" },
        ],
        coverTheme: "space",
      },
      {
        title: `Phase 3: Interactive Workflows & State Management for ${subject}`,
        desc: `Implement robust global and local state management patterns to coordinate user interactions, handle multi-step form submissions, and maintain seamless client-side navigation. Connect asynchronous data fetching layers with TanStack Query or native Fetch, implement optimistic UI updates, and build clear skeleton loaders alongside defensive error boundaries to prevent runtime crashes.`,
        links: [
          { title: "React Hooks Reference & State Management", url: "https://react.dev/reference/react" },
          { title: "TanStack React Query Data Fetching Guide", url: "https://tanstack.com/query/latest/docs/framework/react/overview" },
          { title: "MDN Fetch API & Asynchronous Network Requests", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch" },
          { title: "Zustand Barebones State Management Guide", url: "https://docs.pmnd.rs/zustand/getting-started/introduction" },
          { title: "Zod TypeScript-first Schema Validation", url: "https://zod.dev" },
        ],
        coverTheme: "midnight",
      },
      {
        title: `Phase 4: Optimization, Accessibility & Automated Testing for ${subject}`,
        desc: `Conduct comprehensive performance profiling with Google Lighthouse to eliminate rendering bottlenecks, optimize bundle sizes via code-splitting, and ensure strict compliance with WCAG accessibility guidelines. Write comprehensive unit and integration test suites using Vitest and React Testing Library, verifying critical user journeys and edge cases to ensure long-term codebase stability.`,
        links: [
          { title: "Vitest Next-Generation Unit Testing Framework", url: "https://vitest.dev/guide/" },
          { title: "Testing Library - React Testing Utilities", url: "https://testing-library.com/docs/react-testing-library/intro/" },
          { title: "Web.dev Core Web Vitals & Performance Optimization", url: "https://web.dev/explore/fast" },
          { title: "Lighthouse Performance & Accessibility Audits", url: "https://developer.chrome.com/docs/lighthouse/overview/" },
          { title: "WCAG Web Content Accessibility Guidelines", url: "https://www.w3.org/WAI/standards-guidelines/wcag/" },
        ],
        coverTheme: "royal",
      },
      {
        title: `Phase 5: Production Deployment & Verification for ${subject}`,
        desc: `Configure automated CI/CD deployment pipelines on modern cloud platforms such as Vercel or Cloudflare Pages, set up custom domains with SSL certificates, and tune production caching headers. Validate production asset delivery, verify responsive behavior across mobile, tablet, and desktop devices, and publish release documentation celebrating the milestone completion.`,
        links: [
          { title: "Vercel Production Deployment & Framework Guides", url: "https://vercel.com/docs" },
          { title: "Cloudflare Pages Jamstack Hosting & Edge Deployment", url: "https://developers.cloudflare.com/pages/" },
          { title: "Netlify Continuous Deployment Workflow Guide", url: "https://docs.netlify.com/" },
          { title: "GitHub Actions CI/CD Pipeline Automation", url: "https://docs.github.com/en/actions" },
          { title: "Google Search Central Technical SEO Quickstart", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" },
        ],
        coverTheme: "sunset",
      },
    ];
  } else if (/python|ai|machine\s*learning|deep\s*learning|data\s*science|pandas|pytorch|tensorflow|nlp|llm/i.test(lower)) {
    pool = [
      {
        title: `Phase 1: Environment Setup & Dataset Ingestion for ${subject}`,
        desc: `Configure an isolated Python virtual environment, install state-of-the-art data science libraries, and establish reproducible Jupyter notebook workflows for exploratory research. Ingest raw structured or unstructured datasets from authoritative repositories, execute automated schema validation, and inspect missing value distributions to create clean foundational data partitions.`,
        links: [
          { title: "Python Official Tutorial & Virtual Environments", url: "https://docs.python.org/3/tutorial/venv.html" },
          { title: "Kaggle Open Datasets & Machine Learning Hub", url: "https://www.kaggle.com/datasets" },
          { title: "Pandas Getting Started & Data Ingestion Guide", url: "https://pandas.pydata.org/docs/getting_started/" },
          { title: "NumPy Fundamental Numerical Computing Guide", url: "https://numpy.org/doc/stable/user/absolute_beginners.html" },
          { title: "Anaconda / Conda Environment Management Docs", url: "https://docs.conda.io/projects/conda/en/latest/user-guide/getting-started.html" },
        ],
        coverTheme: "space",
      },
      {
        title: `Phase 2: Exploratory Analysis & Feature Engineering for ${subject}`,
        desc: `Analyze data distributions, correlation heatmaps, and outlier behaviors using Seaborn and Matplotlib to extract meaningful underlying trends and patterns. Engineer discriminative input features, normalize numerical vectors, encode categorical attributes, and construct robust train-validation-test splits to prevent statistical data leakage during training.`,
        links: [
          { title: "Seaborn Statistical Data Visualization Tutorials", url: "https://seaborn.pydata.org/tutorial.html" },
          { title: "Scikit-Learn Preprocessing & Feature Engineering", url: "https://scikit-learn.org/stable/modules/preprocessing.html" },
          { title: "Matplotlib Comprehensive Plotting Library Guide", url: "https://matplotlib.org/stable/tutorials/index.html" },
          { title: "Towards Data Science Exploratory Data Analysis Best Practices", url: "https://towardsdatascience.com" },
          { title: "SciPy Statistical Functions and Distributions Reference", url: "https://docs.scipy.org/doc/scipy/reference/stats.html" },
        ],
        coverTheme: "midnight",
      },
      {
        title: `Phase 3: Model Architecture & Baseline Training for ${subject}`,
        desc: `Formulate the mathematical architecture and choose appropriate baseline algorithms across linear models, ensemble trees, or neural network architectures in PyTorch or Scikit-Learn. Establish loss functions, configure gradient descent optimizers with learning rate schedulers, and log training loss trajectories across epochs using experiment tracking tools.`,
        links: [
          { title: "PyTorch Deep Learning Tutorials & Quickstart", url: "https://pytorch.org/tutorials/" },
          { title: "Hugging Face Transformers & Model Hub", url: "https://huggingface.co/docs" },
          { title: "Scikit-Learn Supervised & Unsupervised Learning", url: "https://scikit-learn.org/stable/user_guide.html" },
          { title: "TensorFlow Core Machine Learning Documentation", url: "https://www.tensorflow.org/tutorials" },
          { title: "Weights & Biases Experiment Tracking & Metrics", url: "https://docs.wandb.ai/" },
        ],
        coverTheme: "neon",
      },
      {
        title: `Phase 4: Hyperparameter Tuning & Model Validation for ${subject}`,
        desc: `Execute systematic hyperparameter exploration via Bayesian optimization or grid sweeps to maximize target accuracy, precision, recall, and F1 metrics. Analyze confusion matrices, residual error distributions, and cross-validation variance across holdout splits to guarantee that the trained model generalizes exceptionally well without overfitting.`,
        links: [
          { title: "Scikit-Learn Model Evaluation & Scoring Metrics", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
          { title: "Optuna Hyperparameter Optimization Framework", url: "https://optuna.readthedocs.io/en/stable/" },
          { title: "Hugging Face PEFT Parameter-Efficient Fine-Tuning", url: "https://huggingface.co/docs/peft/" },
          { title: "PyTorch Lightning Scalable Deep Learning", url: "https://lightning.ai/docs/pytorch/latest//" },
          { title: "Papers with Code State-of-the-Art Benchmarks", url: "https://paperswithcode.com" },
        ],
        coverTheme: "royal",
      },
      {
        title: `Phase 5: Inference Pipeline & Practical Deployment for ${subject}`,
        desc: `Export optimized model artifacts, serialize weights using ONNX runtime, and construct high-performance asynchronous REST endpoints using FastAPI. Containerize the complete inference service using Docker, document API request/response schemas, and verify batch latency benchmarks under simulated load for production reliability.`,
        links: [
          { title: "FastAPI Modern Python Web APIs for ML Services", url: "https://fastapi.tiangolo.com/tutorial/" },
          { title: "ONNX Open Neural Network Exchange Runtime", url: "https://onnxruntime.ai/docs/" },
          { title: "Docker Containerization Guide for Machine Learning", url: "https://docs.docker.com/get-started/" },
          { title: "Ray Serve Scalable Model Serving Architecture", url: "https://docs.ray.io/en/latest/serve/index.html" },
          { title: "MLflow Open Source Lifecycle Management", url: "https://mlflow.org/docs/latest/index.html" },
        ],
        coverTheme: "forest",
      },
    ];
  } else if (/fitness|workout|gym|health|diet|running|marathon|weight|exercise|nutrition|yoga/i.test(lower)) {
    pool = [
      {
        title: `Phase 1: Baseline Assessment & Goal Calibration for ${subject}`,
        desc: `Record comprehensive baseline physical metrics, screen joint mobility, and establish realistic quantitative milestones for strength, endurance, and body composition. Formulate an individualized weekly training schedule, outline movement safety guidelines, and log initial baseline measurements in a dedicated training journal to ensure accountability.`,
        links: [
          { title: "WHO World Health Organization Physical Activity Guidelines", url: "https://www.who.int/health-topics/physical-activity" },
          { title: "ACE American Council on Exercise Library & Biomechanics", url: "https://www.acefitness.org/resources/everyone/exercise-library/" },
          { title: "USDA Nutrition.gov Dietary Planning & Macronutrients Guide", url: "https://nutrition.gov/topics/basic-nutrition" },
          { title: "Runner's World Training Plans & Pacing Guides", url: "https://www.runnersworld.com/training/" },
          { title: "Bodybuilding.com Resistance Training & Workout Database", url: "https://www.bodybuilding.com/content" },
        ],
        coverTheme: "forest",
      },
      {
        title: `Phase 2: Nutritional Blueprint & Hydration Protocol for ${subject}`,
        desc: `Calculate daily basal metabolic rate and target macronutrient splits aligned with energy expenditure, prioritizing lean protein intake and nutrient-dense whole foods. Establish disciplined pre- and post-workout hydration and fueling protocols, eliminate inflammatory processed ingredients, and prepare weekly meal prep routines to support consistent muscular recovery.`,
        links: [
          { title: "USDA Nutrition.gov Dietary Planning & Macronutrients Guide", url: "https://nutrition.gov/topics/basic-nutrition" },
          { title: "Harvard T.H. Chan School of Public Health Nutrition Source", url: "https://www.hsph.harvard.edu/nutritionsource/" },
          { title: "National Institutes of Health Dietary Supplements Factsheets", url: "https://ods.od.nih.gov/factsheets/list-all/" },
          { title: "EatRight Academy of Nutrition and Dietetics", url: "https://www.eatright.org/food" },
          { title: "MyFitnessPal Calorie & Macro Tracking Platform", url: "https://www.myfitnesspal.com" },
        ],
        coverTheme: "sunset",
      },
      {
        title: `Phase 3: Core Conditioning & Movement Mechanics for ${subject}`,
        desc: `Master fundamental compound movement patterns with strict biomechanical form, emphasizing spinal alignment, core engagement, and controlled eccentric tempos. Implement dedicated dynamic warm-up drills and mobility sequences before sessions to safeguard connective tissue and maximize neuromuscular activation across all target muscle groups.`,
        links: [
          { title: "ACE Exercise Technique & Biomechanics Library", url: "https://www.acefitness.org/resources/everyone/exercise-library/" },
          { title: "ExRx.net Comprehensive Exercise & Muscle Directory", url: "https://exrx.net" },
          { title: "BarBend Strength Training & Lifting Mechanics", url: "https://barbend.com" },
          { title: "National Strength and Conditioning Association Guidelines", url: "https://www.nsca.com" },
          { title: "Yoga Journal Mobility & Flexibility Practices", url: "https://www.yogajournal.com" },
        ],
        coverTheme: "neon",
      },
      {
        title: `Phase 4: Progressive Overload & Endurance Scaling for ${subject}`,
        desc: `Systematically increase weekly training stimulus by manipulating resistance loads, repetition volume, training density, and cardiovascular intervals according to proven periodization models. Monitor heart rate recovery, manage central nervous system fatigue through planned deload cycles, and ensure at least eight hours of quality sleep for peak physical adaptation.`,
        links: [
          { title: "Runner's World Training Plans & Pacing Guides", url: "https://www.runnersworld.com/training/" },
          { title: "Stronger By Science Evidence-Based Training Science", url: "https://www.strongerbyscience.com" },
          { title: "Strava Global Athlete Tracking & Community", url: "https://www.strava.com" },
          { title: "Mayo Clinic Fitness & Exercise Programs", url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/basics/fitness-basics/hlv-20049447" },
          { title: "American Heart Association Physical Activity Guidelines", url: "https://www.heart.org/en/healthy-living/fitness" },
        ],
        coverTheme: "space",
      },
      {
        title: `Phase 5: Performance Benchmark & Long-Term Roadmap for ${subject}`,
        desc: `Re-evaluate physical performance benchmarks against initial baseline metrics, assessing strength improvements, body composition shifts, and cardiovascular stamina gains. Formulate a sustainable long-term periodization roadmap with new quarterly targets, celebratory reward milestones, and habit maintenance strategies to keep progressing year-round.`,
        links: [
          { title: "Bodybuilding.com Resistance Training & Workout Database", url: "https://www.bodybuilding.com/content" },
          { title: "WHO Physical Activity Guidelines & Lifelong Health", url: "https://www.who.int/health-topics/physical-activity" },
          { title: "ACE Health & Fitness Continuing Education", url: "https://www.acefitness.org" },
          { title: "Precision Nutrition Habit-Based Coaching Articles", url: "https://www.precisionnutrition.com/blog" },
          { title: "CrossFit Official Workout & Fitness Standards", url: "https://www.crossfit.com" },
        ],
        coverTheme: "royal",
      },
    ];
  } else if (/business|startup|saas|marketing|ecommerce|sales|product|launch|finance|stripe|shopify/i.test(lower)) {
    pool = [
      {
        title: `Phase 1: Market Research & Audience Discovery for ${subject}`,
        desc: `Conduct comprehensive customer discovery interviews to isolate high-urgency pain points, analyze competitor value propositions, and quantify addressable market demand. Synthesize customer persona profiles with specific willingness-to-pay criteria, validate regulatory and financial requirements, and define crystal-clear differentiation angles before investing resources.`,
        links: [
          { title: "Harvard Business Review Strategy & Innovation", url: "https://hbr.org/" },
          { title: "Y Combinator Startup Library & Playbook", url: "https://www.ycombinator.com/library" },
          { title: "Statista Global Market Data & Consumer Insights", url: "https://www.statista.com" },
          { title: "CB Insights Venture Capital & Market Intelligence", url: "https://www.cbinsights.com/research/" },
          { title: "Strategyzer Business Model Canvas Framework", url: "https://www.strategyzer.com/library" },
        ],
        coverTheme: "midnight",
      },
      {
        title: `Phase 2: Value Proposition & Offer Packaging for ${subject}`,
        desc: `Draft compelling offer positioning that clearly addresses customer objections, establish tiered pricing structures backed by unit economics, and formulate strong risk-reversal guarantees. Create conversion-focused messaging frameworks, define core deliverables and bonus assets, and validate messaging resonance through peer and early-adopter feedback loops.`,
        links: [
          { title: "Y Combinator Essential Startup Advice", url: "https://www.ycombinator.com/library" },
          { title: "Copyblogger Content Marketing & Sales Copywriting", url: "https://copyblogger.com" },
          { title: "Stripe Atlas Business Formation & Pricing Guides", url: "https://stripe.com/atlas/guides" },
          { title: "Reforge Product Strategy & Growth Frameworks", url: "https://www.reforge.com/blog" },
          { title: "First Round Review Tactical Management Insights", url: "https://review.firstround.com" },
        ],
        coverTheme: "sunset",
      },
      {
        title: `Phase 3: High-Converting Landing Experience for ${subject}`,
        desc: `Build a blazing-fast responsive landing page featuring persuasive hero headlines, social proof testimonials, clear feature breakdowns, and frictionless checkout integrations. Instrument privacy-compliant analytics funnels, set up automated email confirmation sequences, and conduct end-to-end sandbox payment simulations to guarantee zero checkout drop-off.`,
        links: [
          { title: "Stripe Documentation & Payment Integration Guide", url: "https://stripe.com/docs" },
          { title: "Shopify Developer Documentation & APIs", url: "https://shopify.dev/docs" },
          { title: "Web.dev Landing Page Speed & Conversion Optimization", url: "https://web.dev/explore/fast" },
          { title: "Unbounce High-Converting Landing Page Guide", url: "https://unbounce.com/landing-page-articles/" },
          { title: "Google Analytics 4 Measurement & Funnel Setup", url: "https://support.google.com/analytics/answer/9304153" },
        ],
        coverTheme: "space",
      },
      {
        title: `Phase 4: Multi-Channel Outreach & Traffic Acquisition for ${subject}`,
        desc: `Execute a multi-channel go-to-market distribution strategy across organic search engine optimization, targeted community discussions, and curated strategic partnerships. Launch high-value educational content assets, track customer acquisition costs across channels, and continuously A/B test ad copy and email subject lines to compound traffic momentum.`,
        links: [
          { title: "Moz Beginner's Guide to SEO & Inbound Marketing", url: "https://moz.com/beginners-guide-to-seo" },
          { title: "HubSpot Inbound Marketing Methodology & Tools", url: "https://www.hubspot.com/inbound-marketing" },
          { title: "Ahrefs SEO & Content Marketing Learning Hub", url: "https://ahrefs.com/blog/" },
          { title: "Product Hunt Launch Playbook & Community Guidelines", url: "https://www.producthunt.com" },
          { title: "Buffer Social Media Marketing Strategies", url: "https://buffer.com/resources" },
        ],
        coverTheme: "neon",
      },
      {
        title: `Phase 5: KPI Review, Conversion Optimization & Scaling for ${subject}`,
        desc: `Deeply analyze customer acquisition cost against customer lifetime value, inspect checkout drop-off funnels, and systematically resolve customer onboarding friction points. Implement customer referral mechanisms, optimize recurring retention loops, and compile a quarterly scaling forecast to sustainably accelerate long-term revenue growth.`,
        links: [
          { title: "Harvard Business Review Scaling & Leadership", url: "https://hbr.org/" },
          { title: "Stripe Resources on SaaS Metrics & Billing", url: "https://stripe.com/resources/more/saas-metrics-101" },
          { title: "Baremetrics SaaS Financial Metrics & Benchmarks", url: "https://baremetrics.com/academy" },
          { title: "ProfitWell Subscription Pricing & Churn Analysis", url: "https://www.profitwell.com/recur" },
          { title: "Mixpanel Product Analytics & Retention Guides", url: "https://mixpanel.com/blog/" },
        ],
        coverTheme: "royal",
      },
    ];
  } else {
    const enc = encodeURIComponent(subject.split(" ")[0].toLowerCase());
    pool = [
      {
        title: `Phase 1: Foundations, Scope & Setup for ${subject}`,
        desc: `Thoroughly investigate foundational theories, assemble all necessary documentation and development tools, and define explicit success criteria for executing ${subject}. Establish organized directory structures, configure essential environment variables, and document initial milestone assumptions to maintain clear project trajectory from day one.`,
        links: [
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
        ],
        coverTheme: "space",
      },
      {
        title: `Phase 2: Core Methodology & First Prototype for ${subject}`,
        desc: `Synthesize the primary methodology into a tangible working prototype, validating assumptions through hands-on experimentation and incremental builds for ${subject}. Document initial functional benchmarks, collect immediate feedback on operational friction, and iteratively refine component architecture to ensure a solid foundation.`,
        links: [
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "MIT OpenCourseWare Learning Materials & Syllabi", url: "https://ocw.mit.edu" },
          { title: "MDN Web Docs - Technical References & Guides", url: "https://developer.mozilla.org" },
          { title: "Stack Overflow Developer Community & Discussions", url: "https://stackoverflow.com" },
          { title: "Dev.to Community Tutorials & Development Stories", url: "https://dev.to" },
        ],
        coverTheme: "neon",
      },
      {
        title: `Phase 3: Deep Execution & Key Deliverables for ${subject}`,
        desc: `Execute the full scope of milestone deliverables with focused concentration, producing polished assets and integrating all required functional modules for ${subject}. Eliminate edge-case bugs, streamline inter-module communication, and document architectural decisions to establish reliable, maintainable standards.`,
        links: [
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Medium In-Depth Engineering & Design Case Studies", url: "https://medium.com" },
          { title: "Hacker News Tech & Entrepreneurship Discussions", url: "https://news.ycombinator.com" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
        ],
        coverTheme: "sunset",
      },
      {
        title: `Phase 4: Quality Review, Polish & Refinement for ${subject}`,
        desc: `Perform rigorous end-to-end quality assurance audits, resolving visual and technical discrepancies while optimizing execution efficiency and accessibility for ${subject}. Solicit peer critiques, benchmark performance against industry standards, and polish interactive details to deliver a premium user experience.`,
        links: [
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Medium In-Depth Engineering & Design Case Studies", url: "https://medium.com" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
        ],
        coverTheme: "midnight",
      },
      {
        title: `Phase 5: Capstone Completion, Validation & Launch for ${subject}`,
        desc: `Consolidate all finalized milestone components, verify end-to-end completion against original acceptance criteria, and publish clean documentation for ${subject}. Archive project deliverables, distribute release announcements, and celebrate milestone completion with stakeholders and community members.`,
        links: [
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
        ],
        coverTheme: "royal",
      },
    ];
  }

  const themes = ["space", "sunset", "neon", "forest", "royal", "midnight"];
  return pool.slice(0, num).map((t, i) => ({
    text: t.title,
    description: t.desc,
    links: Array.isArray(t.links) && t.links.length >= 5 ? t.links : [],
    source: t.links?.[0]?.url || t.source || "",
    coverTheme: t.coverTheme || themes[i % themes.length],
  }));
}

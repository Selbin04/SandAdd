import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PROOF_ACCEPT,
  fileToProof,
  isImageProof,
  isPdfProof,
  isVideoProof,
  restoreTopicSourceProof,
  getLocalPostsForTopic,
} from "../lib/socialFeed.js";
import { getProjectCreator, getProjectCreatorTagline, getLiveWork } from "../lib/liveWorks.js";
import { getFollowedWorkGroup } from "../lib/followingStore.js";
import { likeTopicApi, addTopicCommentApi, deleteTopicCommentApi } from "../api.js";
import FileUploadHint from "./FileUploadHint.jsx";
import FolderHourglassModal from "./FolderHourglassModal.jsx";
import AiSourceSummary from "./AiSourceSummary.jsx";
import TaskSourcePosts from "./TaskSourcePosts.jsx";
import SourceTextFullScreenModal from "./SourceTextFullScreenModal.jsx";
import {
  ImageCoverSlicePreview,
  VideoCoverSlicePreview,
  LinkCoverSlicePreview,
} from "./SourceMedia.jsx";
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

const TASK_COMMENTS_KEY_PREFIX = "sandadd.taskComments.";

function getTaskComments(projectId, topicOrId) {
  const topicId = typeof topicOrId === "object" ? topicOrId?.id : topicOrId;
  const fromTopic = typeof topicOrId === "object" && Array.isArray(topicOrId?.comments)
    ? topicOrId.comments
    : [];
  if (!projectId || !topicId) return fromTopic;
  try {
    const raw = localStorage.getItem(`${TASK_COMMENTS_KEY_PREFIX}${projectId}.${topicId}`);
    if (!raw) return fromTopic;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return fromTopic;
    const ids = new Set(list.map((c) => c.id));
    for (const c of fromTopic) {
      if (!ids.has(c.id)) list.push(c);
    }
    return list;
  } catch {
    return fromTopic;
  }
}

function saveTaskComments(projectId, topicId, comments) {
  if (!projectId || !topicId) return;
  try {
    localStorage.setItem(
      `${TASK_COMMENTS_KEY_PREFIX}${projectId}.${topicId}`,
      JSON.stringify(comments)
    );
  } catch {
    /* ignore */
  }
}

function formatCommentTime(iso) {
  if (!iso) return "Just now";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 45) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function IconHeartBubble({ className = "", filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path
        d="M15.8 9.2a2.5 2.5 0 0 0-3.5 0l-.3.4-.3-.4a2.5 2.5 0 0 0-3.5 0 2.5 2.5 0 0 0 0 3.5l3.8 3.8 3.8-3.8a2.5 2.5 0 0 0 0-3.5Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

function IconAsk({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconHeart({ className = "", filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconComment({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconReport({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function IconMoreVertical({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="19" r="2.2" />
    </svg>
  );
}

function IconTrash({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconCopy({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconPaperclip({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconPhotoCover({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconBannerMode({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 11h18" />
      <path d="M7 16h6" strokeWidth="2.5" />
    </svg>
  );
}

function IconFullCardMode({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <rect x="6" y="6" width="12" height="6" rx="2" fill="currentColor" fillOpacity="0.35" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconNoCover({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7" y1="8" x2="17" y2="8" strokeWidth="2.5" />
      <line x1="7" y1="13" x2="13" y2="13" strokeWidth="2" />
    </svg>
  );
}

function DoneCoverImage({ cover, className = "" }) {
  const [url, setUrl] = useState(
    cover?.dataUrl || (typeof cover === "string" ? cover : "")
  );

  useEffect(() => {
    if (cover?.dataUrl) {
      setUrl(cover.dataUrl);
      return;
    }
    if (typeof cover === "string" && cover) {
      setUrl(cover);
      return;
    }
    if (cover?.mediaId) {
      let alive = true;
      restoreTopicSourceProof(cover).then((full) => {
        if (alive && full?.dataUrl) {
          setUrl(full.dataUrl);
        }
      });
      return () => {
        alive = false;
      };
    }
    setUrl("");
  }, [cover?.dataUrl, cover?.mediaId]);

  if (!url) return null;
  return <img src={url} alt="Cover" className={className} />;
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

  const isImg = isImageProof(ready);
  const isVid = isVideoProof(ready);

  return (
    <>
      {isImg ? (
        <ImageCoverSlicePreview
          proof={ready}
          onOpen={() => setOpened(true)}
        />
      ) : isVid ? (
        <VideoCoverSlicePreview
          proof={ready}
          onOpen={() => setOpened(true)}
        />
      ) : (
        <button
          type="button"
          className="done-source-file-btn"
          onClick={() => setOpened(true)}
          title={`Open ${label}`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="done-source-file-name">{label}</span>
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
  onUpdateTopic,
  onShareTopic = null,
  mode = "all",
  topicIds = null,
  readOnlyTasks = false,
  inline = false,
  isCollaborative = false,
  folders = [],
  allProjects = [],
  aboutSlot = null,
}) {
  const [showHourglassModal, setShowHourglassModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceProof, setSourceProof] = useState(null);
  const [hasCheckbox, setHasCheckbox] = useState(true);
  const [addCoverImage, setAddCoverImage] = useState(null);
  const [addCoverMode, setAddCoverMode] = useState("top");
  const addCoverFileRef = useRef(null);
  const [coverModalTopic, setCoverModalTopic] = useState(null);
  const [coverModalImage, setCoverModalImage] = useState(null);
  const [coverModalMode, setCoverModalMode] = useState("top");
  const changeCoverFileRef = useRef(null);
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
  const [fullScreenSource, setFullScreenSource] = useState(null);
  const addFileRef = useRef(null);
  const topicFileRef = useRef(null);
  const doneListRef = useRef(null);
  const pendingTopicIdRef = useRef(null);
  const formRef = useRef(null);
  const [taskMenuTopic, setTaskMenuTopic] = useState(null);
  const [taskMenuStyle, setTaskMenuStyle] = useState({});
  const [taskLikes, setTaskLikes] = useState(() => {
    try {
      const saved = localStorage.getItem(`sandadd_likes_${project?._id || "default"}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [taskLikeCounts, setTaskLikeCounts] = useState(() => {
    try {
      const saved = localStorage.getItem(`sandadd.taskLikeCounts.${project?._id || "default"}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const isCollaborativeWork = Boolean(
    isCollaborative ||
    project?.originId ||
    project?.sharedTemplateId ||
    project?.isShared ||
    project?.originMode === "follow" ||
    project?.originMode === "assign" ||
    project?.shareMode === "follow" ||
    project?.shareMode === "assign" ||
    project?.mode === "assign" ||
    project?.mode === "follow" ||
    project?.tasksLocked ||
    Boolean(getFollowedWorkGroup(project?.originId || project?.sharedTemplateId || project?._id)) ||
    Boolean(getLiveWork(project?.originId || project?.sharedTemplateId || project?._id)) ||
    Boolean(project?.creatorHandle && String(project.creatorHandle).trim().length > 0)
  );

  const getLikeCountForTopic = (topicId) => {
    const allT = Array.isArray(project?.topics) ? project.topics : [];
    const topic = allT.find((t) => t.id === topicId) || (topics || []).find((t) => t.id === topicId);
    const isLiked = Boolean(taskLikes[topicId]);
    const stored = taskLikeCounts[topicId];
    if (typeof stored === "number") return stored;
    if (topic && typeof topic.likeCount === "number" && topic.likeCount > 0) return topic.likeCount;
    return isLiked ? 1 : 0;
  };
  const [askModalTopic, setAskModalTopic] = useState(null);
  const [askText, setAskText] = useState("");
  const [commentModalTopic, setCommentModalTopic] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [taskComments, setTaskComments] = useState([]);
  const [reportModalTopic, setReportModalTopic] = useState(null);
  const [reportText, setReportText] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const taskMenuRef = useRef(null);
  const taskTriggerBtnRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const [moreMenuTopic, setMoreMenuTopic] = useState(null);
  const [moreMenuStyle, setMoreMenuStyle] = useState({});
  const moreMenuRef = useRef(null);
  const moreTriggerBtnRef = useRef(null);

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
  const hasDailyTopics = Array.isArray(topicIds) && topicIds.length > 0;
  const [filterMode, setFilterMode] = useState(() => (mode === "today" && hasDailyTopics ? "today" : "all"));

  useEffect(() => {
    setFilterMode(mode === "today" && hasDailyTopics ? "today" : "all");
  }, [mode, hasDailyTopics, project?._id]);

  useEffect(() => {
    if (inline || !onClose) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [inline, onClose]);

  const todayMode = filterMode === "today" && hasDailyTopics;
  const topics = todayMode
    ? allTopics.filter((t) => (topicIds || []).includes(String(t.id)))
    : allTopics;
  const panelTopic = topics.find((t) => t.id === sourcePanelId) || null;

  const totalFolderLikes = (allTopics.length > 0 ? allTopics : topics).reduce((sum, topic) => {
    return sum + (topic?.id ? getLikeCountForTopic(topic.id) : 0);
  }, 0);

  const [followersCount, setFollowersCount] = useState(() => {
    if (typeof project?.followersCount === "number") return project.followersCount;
    if (typeof project?.followerCount === "number") return project.followerCount;
    if (Array.isArray(project?.followers)) return project.followers.length;
    if (Array.isArray(project?.subscribers)) return project.subscribers.length;
    const origin = project?.originId || project?.sharedTemplateId || project?._id;
    const group = getFollowedWorkGroup(origin);
    if (group?.members && Array.isArray(group.members) && group.members.length > 0) {
      return group.members.length;
    }
    const copies = (allProjects || []).filter((p) => {
      const pOrigin = p.originId || p.sharedTemplateId;
      return pOrigin && (pOrigin === project?._id || pOrigin === project?.originId || pOrigin === project?.sharedTemplateId);
    }).length;
    if (copies > 0) return copies;
    if (project?.originMode === "follow" || project?.shareMode === "follow" || project?.mode === "follow") {
      return 1;
    }
    return 0;
  });

  useEffect(() => {
    const updateFollowers = () => {
      if (typeof project?.followersCount === "number") {
        setFollowersCount(project.followersCount);
        return;
      }
      if (typeof project?.followerCount === "number") {
        setFollowersCount(project.followerCount);
        return;
      }
      if (Array.isArray(project?.followers)) {
        setFollowersCount(project.followers.length);
        return;
      }
      const origin = project?.originId || project?.sharedTemplateId || project?._id;
      const group = getFollowedWorkGroup(origin);
      if (group?.members && Array.isArray(group.members) && group.members.length > 0) {
        setFollowersCount(group.members.length);
        return;
      }
      const copies = (allProjects || []).filter((p) => {
        const pOrigin = p.originId || p.sharedTemplateId;
        return pOrigin && (pOrigin === project?._id || pOrigin === project?.originId || pOrigin === project?.sharedTemplateId);
      }).length;
      if (copies > 0) {
        setFollowersCount(copies);
        return;
      }
      if (project?.originMode === "follow" || project?.shareMode === "follow" || project?.mode === "follow") {
        setFollowersCount(1);
        return;
      }
      setFollowersCount(0);
    };

    updateFollowers();
    window.addEventListener("sandadd:followed-work-groups-changed", updateFollowers);
    return () => {
      window.removeEventListener("sandadd:followed-work-groups-changed", updateFollowers);
    };
  }, [project?._id, project?.originId, project?.sharedTemplateId, project?.followersCount, allProjects]);

  const [topicPostsCounts, setTopicPostsCounts] = useState({});

  useEffect(() => {
    const updateCounts = () => {
      const counts = {};
      for (const t of topics) {
        if (t?.id) {
          counts[t.id] = getLocalPostsForTopic(t.id).length;
        }
      }
      setTopicPostsCounts(counts);
    };

    updateCounts();
    window.addEventListener("sandadd:feed-changed", updateCounts);
    return () => {
      window.removeEventListener("sandadd:feed-changed", updateCounts);
    };
  }, [topics]);

  useEffect(() => {
    if (doneListRef.current) {
      doneListRef.current.scrollTop = 0;
    }
  }, [topics.length]);

  const navH =
    typeof window !== "undefined"
      ? parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--navbar-height"
          )
        ) || 64
      : 64;
  const minTop = inline ? 8 : navH + 8;
  const left = inline ? 8 : Math.min(Math.max(8, x), Math.max(8, window.innerWidth - 340));
  const top = inline
    ? 8
    : Math.min(Math.max(minTop, y), Math.max(minTop, window.innerHeight - 360));

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
    const pCount = topicPostsCounts[topic.id] || getLocalPostsForTopic(topic.id).length;
    const hasSrc = topicHasSource(topic);
    setSourceTab(hasSrc ? "open" : pCount > 0 ? "post" : "open");
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

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!taskMenuTopic && !moreMenuTopic) return undefined;
    const handleDocClick = (e) => {
      if (
        taskMenuRef.current &&
        !taskMenuRef.current.contains(e.target) &&
        taskTriggerBtnRef.current &&
        !taskTriggerBtnRef.current.contains(e.target)
      ) {
        setTaskMenuTopic(null);
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target) &&
        moreTriggerBtnRef.current &&
        !moreTriggerBtnRef.current.contains(e.target)
      ) {
        setMoreMenuTopic(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setTaskMenuTopic(null);
        setMoreMenuTopic(null);
      }
    };
    const handleScroll = (e) => {
      if (taskMenuRef.current && taskMenuRef.current.contains(e.target)) return;
      if (moreMenuRef.current && moreMenuRef.current.contains(e.target)) return;
      setTaskMenuTopic(null);
      setMoreMenuTopic(null);
    };
    document.addEventListener("mousedown", handleDocClick, true);
    document.addEventListener("touchstart", handleDocClick, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleDocClick, true);
      document.removeEventListener("touchstart", handleDocClick, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [taskMenuTopic, moreMenuTopic]);

  const handleToggleTaskMenu = (topic, e) => {
    e.stopPropagation();
    setMoreMenuTopic(null);
    if (taskMenuTopic?.id === topic.id) {
      setTaskMenuTopic(null);
      taskTriggerBtnRef.current = null;
      return;
    }
    const btn = e.currentTarget;
    taskTriggerBtnRef.current = btn;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 165;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const menuLeft = Math.max(8, Math.min(rect.left - 20, window.innerWidth - menuWidth - 8));

    setTaskMenuStyle({
      position: "fixed",
      left: `${menuLeft}px`,
      top: isAbove ? "auto" : `${rect.bottom + 6}px`,
      bottom: isAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      zIndex: 100000,
    });
    setTaskMenuTopic(topic);
  };

  const handleToggleMoreMenu = (topic, e) => {
    e.stopPropagation();
    setTaskMenuTopic(null);
    if (moreMenuTopic?.id === topic.id) {
      setMoreMenuTopic(null);
      moreTriggerBtnRef.current = null;
      return;
    }
    const btn = e.currentTarget;
    moreTriggerBtnRef.current = btn;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 145;
    const menuHeight = 85;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const menuLeft = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));

    setMoreMenuStyle({
      position: "fixed",
      left: `${menuLeft}px`,
      top: isAbove ? "auto" : `${rect.bottom + 6}px`,
      bottom: isAbove ? `${window.innerHeight - rect.top + 6}px` : "auto",
      zIndex: 100000,
    });
    setMoreMenuTopic(topic);
  };

  const handleActionAsk = (topic) => {
    setTaskMenuTopic(null);
    setAskText("");
    setAskModalTopic(topic);
  };

  const handleActionLike = (topic) => {
    const nextLiked = !taskLikes[topic.id];
    setTaskLikes((prev) => {
      const next = { ...prev, [topic.id]: nextLiked };
      try {
        localStorage.setItem(`sandadd_likes_${project?._id || "default"}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

    setTaskLikeCounts((prev) => {
      const current = typeof prev[topic.id] === "number" ? prev[topic.id] : (taskLikes[topic.id] ? 1 : 0);
      const nextCount = Math.max(0, current + (nextLiked ? 1 : -1));
      const nextMap = { ...prev, [topic.id]: nextCount };
      try {
        localStorage.setItem(
          `sandadd.taskLikeCounts.${project?._id || "default"}`,
          JSON.stringify(nextMap)
        );
      } catch {
        /* ignore */
      }
      return nextMap;
    });

    if (project?._id) {
      likeTopicApi(project._id, topic.id).catch(() => {});
    }

    showToast(nextLiked ? `Liked "${topic.text}"` : `Unliked "${topic.text}"`);
  };

  const handleActionComment = (topic) => {
    setTaskMenuTopic(null);
    setCommentModalTopic(topic);
    setCommentText("");
    setTaskComments(getTaskComments(project?._id, topic));
  };

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!commentModalTopic || !commentText.trim()) return;
    const authorName = localStorage.getItem("sandadd.profile.name") || "You";
    const newComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: authorName,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [...taskComments, newComment];
    setTaskComments(next);
    saveTaskComments(project?._id, commentModalTopic.id, next);
    if (project?._id) {
      addTopicCommentApi(project._id, commentModalTopic.id, { text: newComment.text, author: authorName }).catch(() => {});
    }
    setCommentText("");
    showToast(`Comment added to "${commentModalTopic.text}"`);
  };

  const handleDeleteComment = (commentId) => {
    if (!commentModalTopic) return;
    const next = taskComments.filter((c) => c.id !== commentId);
    setTaskComments(next);
    saveTaskComments(project?._id, commentModalTopic.id, next);
    if (project?._id) {
      deleteTopicCommentApi(project._id, commentModalTopic.id, commentId).catch(() => {});
    }
    showToast("Comment deleted");
  };

  const handleActionReport = (topic) => {
    setTaskMenuTopic(null);
    setReportText("");
    setReportModalTopic(topic);
  };

  const handleSubmitAsk = (e) => {
    e.preventDefault();
    if (!askModalTopic) return;
    const q = askText.trim();
    if (!q) return;
    showToast(`Question submitted for "${askModalTopic.text}"`);
    setAskModalTopic(null);
    setAskText("");
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();
    if (!reportModalTopic) return;
    showToast(`Report received for "${reportModalTopic.text}". Thank you.`);
    setReportModalTopic(null);
    setReportText("");
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

  const updateSourceItemSummary = (topic, sourceId, aiSummary) => {
    const current = getTopicSources(topic);
    const updated = current.map((s) =>
      s.id === sourceId ? { ...s, aiSummary } : s
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

  const onPickAddCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyFile(true);
    try {
      const proof = await fileToProof(file);
      setAddCoverImage(proof);
      setAddCoverMode((prev) => (prev === "full" ? "full" : "top"));
    } catch (err) {
      setSourceError(err.message || "Could not attach cover image");
    } finally {
      setBusyFile(false);
    }
  };

  const onPickChangeCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusyFile(true);
    try {
      const proof = await fileToProof(file);
      setCoverModalImage(proof);
      if (coverModalMode === "none") {
        setCoverModalMode("top");
      }
    } catch (err) {
      setSourceError(err.message || "Could not attach cover image");
    } finally {
      setBusyFile(false);
    }
  };

  const handleUpdateTopicCover = (topicId, updates) => {
    const projId = project?._id || project?.id;
    if (onUpdateTopic) {
      onUpdateTopic(projId, topicId, updates);
    } else {
      const allT = Array.isArray(project?.topics) ? project.topics : [];
      const updated = allT.map((t) => (t.id === topicId ? { ...t, ...updates } : t));
      onSetSource?.(projId, topicId, { ...updates, topics: updated });
    }
  };

  const openCoverModal = (topic) => {
    setCoverModalTopic(topic);
    setCoverModalImage(topic.coverImage || null);
    const mode =
      topic.coverMode === "full"
        ? "full"
        : topic.coverMode === "top"
          ? "top"
          : topic.coverImage
            ? "top"
            : "none";
    setCoverModalMode(mode);
  };

  const handleApplyCoverModal = () => {
    if (!coverModalTopic) return;
    const mode =
      coverModalMode === "none" || !coverModalImage ? "none" : coverModalMode;
    const image = mode === "none" ? null : coverModalImage;
    handleUpdateTopicCover(coverModalTopic.id, {
      coverImage: image,
      coverMode: mode,
    });
    setCoverModalTopic(null);
    showToast(
      mode === "none"
        ? `Cover removed (normal state)`
        : `Cover saved (${mode === "full" ? "Full card" : "Top banner"})`
    );
  };

  return (
    <>
      <div
        className={inline ? "done-inline" : "done-backdrop"}
        onMouseDown={inline ? undefined : (e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
        onClick={inline ? undefined : (e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
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
      <input
        ref={addCoverFileRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
        hidden
        onChange={onPickAddCover}
      />
      <input
        ref={changeCoverFileRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
        hidden
        onChange={onPickChangeCover}
      />
      <div
        className={`done-card ${inline ? "done-card-inline" : ""}`}
        style={inline ? undefined : { left, top }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role={inline ? undefined : "dialog"}
        aria-label={inline ? undefined : todayMode
          ? `${project.name} tasks for today`
          : `${project.name} tasks`}
      >
        <div className={`done-head-bar ${inline ? "done-inline-head" : ""}`}>
          <div className="done-head-copy">
            {(() => {
              const creator = getProjectCreator(project);
              const tagline = getProjectCreatorTagline(project);
              if (!tagline && !creator?.name) return null;
              return (
                <div className="done-creator-top-line" title={`Created by ${tagline || creator?.name}`}>
                  <span className="done-creator-by">by</span>
                  <span className="done-creator-name">{creator?.name || tagline}</span>
                  {creator?.handle ? (
                    <span className="done-creator-handle">@{creator.handle}</span>
                  ) : null}
                </div>
              );
            })()}
            <p className="done-title">{project.name}</p>
            {hasDailyTopics ? (
              <div className="done-view-mode-tabs" role="tablist" aria-label="Task view filter">
                <button
                  type="button"
                  role="tab"
                  aria-selected={todayMode}
                  className={`done-view-mode-tab ${todayMode ? "is-active" : ""}`}
                  onClick={() => setFilterMode("today")}
                >
                  Today ({allTopics.filter((t) => (topicIds || []).includes(String(t.id))).length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!todayMode}
                  className={`done-view-mode-tab ${!todayMode ? "is-active" : ""}`}
                  onClick={() => setFilterMode("all")}
                >
                  All ({allTopics.length})
                </button>
              </div>
            ) : (
              <p className="done-hint">
                {todayMode ? "Tasks for today" : "Progress Files"}
              </p>
            )}
          </div>
          <div className="done-head-right">
            <div className="done-head-actions-row">
              <button
                type="button"
                className="done-head-hourglass-btn"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowHourglassModal(true);
                }}
                aria-label={`Open hourglass and progress for ${project.name}`}
                title="Open hourglass & progress"
              >
                <svg
                  className="done-head-hourglass-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 22h14" />
                  <path d="M5 2h14" />
                  <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                  <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                </svg>
              </button>
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

            {isCollaborativeWork ? (
              <div
                className="done-head-stats-row"
                aria-label={`Progress folder statistics: ${totalFolderLikes} likes, ${followersCount} followers`}
              >
                <div
                  className="done-head-stat-pill"
                  title={`${totalFolderLikes} total like${totalFolderLikes === 1 ? "" : "s"} across all progress files`}
                >
                  <svg
                    className="done-head-stat-icon is-like"
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="currentColor"
                    stroke="none"
                    aria-hidden="true"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span className="done-head-stat-count">{totalFolderLikes}</span>
                </div>
                <div
                  className="done-head-stat-pill"
                  title={`${followersCount} follower${followersCount === 1 ? "" : "s"} of this progress folder`}
                >
                  <svg
                    className="done-head-stat-icon is-followers"
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="done-head-stat-count">{followersCount}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="done-scroll-content">
          {aboutSlot ? (
            <div className="done-about-section">
              {aboutSlot}
            </div>
          ) : null}

          <div className="done-tasks-section-header">
            <div className="done-tasks-title-stack-group">
              <svg
                className="done-stack-icon"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className="done-tasks-section-title">
                {todayMode ? "Tasks for Today" : "Progress Files"}
              </span>
              <span className="done-tasks-section-count">
                {topics.filter((t) => t.done).length}/{topics.length} done
              </span>
            </div>
            {!todayMode && !readOnlyTasks && (
              <button
                type="button"
                className={`done-stack-add-quick-btn ${showAddForm ? "is-open" : ""}`}
                onClick={() => setShowAddForm((v) => !v)}
                aria-label={showAddForm ? "Close add file form" : "Push new progress file to top of stack"}
                title={showAddForm ? "Close form" : "Push new progress file to top of stack"}
              >
                <span className="done-stack-add-icon">{showAddForm ? "×" : "+"}</span>
                <span className="done-stack-add-label">{showAddForm ? "Close" : "New File"}</span>
              </button>
            )}
          </div>

          {!todayMode && !readOnlyTasks && (
            <div className={`done-add-container is-top-stack ${showAddForm ? "is-open" : ""}`}>
              {!showAddForm ? (
                <div className="done-add-toggle-bar">
                  <button
                    type="button"
                    className="done-add-stack-trigger"
                    onClick={() => setShowAddForm(true)}
                    aria-expanded={false}
                    aria-label="Add new progress file to top of stack"
                    title="Add new progress file to top of stack"
                  >
                    <span className="done-add-stack-trigger-icon">+</span>
                    <span className="done-add-stack-trigger-text">Add progress file to top of stack…</span>
                    <span className="done-add-stack-pill">TOP</span>
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
                    onAdd?.(project?._id || project?.id, next, {
                      source: sourceValue,
                      sourceTitle: sourceTitle.trim(),
                      sourceProof,
                      hasCheckbox,
                      coverImage: addCoverImage,
                      coverMode: addCoverImage ? addCoverMode : "none",
                    });
                    setText("");
                    setSource("");
                    setSourceTitle("");
                    setSourceProof(null);
                    setAddCoverImage(null);
                    setAddCoverMode("top");
                    setSourceError("");
                    setHasCheckbox(true);
                  }}
                >
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="New progress file title… (e.g. Fix login)"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="done-add-source"
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
                    <button
                      type="button"
                      className={`done-cover-add-btn ${addCoverImage ? "has-cover" : ""}`}
                      disabled={busyFile}
                      onClick={() => addCoverFileRef.current?.click()}
                      title="Attach a cover image to this progress file"
                    >
                      <IconPhotoCover />
                      <span>{addCoverImage ? (addCoverMode === "full" ? "Cover: Full" : "Cover: Banner") : "Cover"}</span>
                    </button>
                    <button type="submit" className="chip active" disabled={busyFile}>
                      Add
                    </button>
                  </div>
                  {addCoverImage ? (
                    <div className="done-add-cover-preview-row">
                      <div className="done-add-cover-thumb-wrap">
                        <img src={addCoverImage.dataUrl} alt="Cover" className="done-add-cover-thumb" />
                        <span className="done-add-cover-name" title={addCoverImage.name}>
                          {addCoverImage.name || "Cover image"}
                        </span>
                      </div>
                      <div className="done-add-cover-modes" role="radiogroup" aria-label="Cover style">
                        <button
                          type="button"
                          className={`done-add-cover-mode-chip ${addCoverMode === "top" ? "is-active" : ""}`}
                          onClick={() => setAddCoverMode("top")}
                          title="Top banner cover (image at top, content below)"
                        >
                          <IconBannerMode /> Top banner
                        </button>
                        <button
                          type="button"
                          className={`done-add-cover-mode-chip ${addCoverMode === "full" ? "is-active" : ""}`}
                          onClick={() => setAddCoverMode("full")}
                          title="Full card cover (image covers entire card)"
                        >
                          <IconFullCardMode /> Full card
                        </button>
                      </div>
                      <button
                        type="button"
                        className="done-add-cover-remove-btn"
                        onClick={() => setAddCoverImage(null)}
                        title="Remove cover image (leave in normal state)"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : null}
                  <FileUploadHint />
                </form>
              )}
            </div>
          )}

          {sourceError ? <p className="done-source-error">{sourceError}</p> : null}

          {topics.length === 0 ? (
            <p className="done-empty">
              {todayMode
                ? "No tasks picked for today."
                : readOnlyTasks
                  ? "No tasks yet. Wait for the creator to add some."
                  : "No progress files in this stack yet. Add one above to start your stack."}
            </p>
          ) : (
            <ul ref={doneListRef} className="done-list">
              {topics.map((topic, index) => {
                const finished = topic.done === true;
                const sourceList = getTopicSources(topic);
                const sourceCount = sourceList.length;
                const hasSource = sourceCount > 0;
                const isOpen = sourcePanelId === topic.id;
                const topicPostsCount =
                  topicPostsCounts[topic.id] ?? getLocalPostsForTopic(topic.id).length;
                const hasTopicPosts = topicPostsCount > 0;
                const totalSourceCount = sourceCount + topicPostsCount;
                const isTopFile = index === 0 && !todayMode;
                const canOpenSource = !busyFile && (!readOnlyTasks || hasSource || hasTopicPosts);

                const showCheck = topic.hasCheckbox !== false;
                const hasCover = Boolean(
                  topic?.coverImage &&
                    (topic.coverImage.dataUrl ||
                      topic.coverImage.mediaId ||
                      (typeof topic.coverImage === "string" && topic.coverImage.length > 0))
                );
                const coverMode =
                  topic?.coverMode === "full"
                    ? "full"
                    : topic?.coverMode === "top"
                      ? "top"
                      : hasCover
                        ? "top"
                        : "none";
                const isFullCover = hasCover && coverMode === "full";
                const isTopCover = hasCover && coverMode === "top";

                return (
                  <li
                    key={topic.id}
                    className={`${finished ? "is-done" : ""} ${isOpen ? "is-source-open" : ""} ${isTopFile ? "is-top-file" : ""} ${isFullCover ? "has-cover cover-full" : isTopCover ? "has-cover cover-top" : ""}`}
                  >
                    {isFullCover ? (
                      <div className="done-cover-full-wrapper">
                        <div className="done-cover-full-backdrop">
                          <DoneCoverImage cover={topic.coverImage} className="done-cover-full-img" />
                          <div className="done-cover-full-scrim" />
                        </div>

                        <div className="done-cover-full-content">
                          {/* Sky-Blue Pill Box for Checkbox + Task Text (as in user screenshot) */}
                          <div className="done-cover-pill-box">
                            {showCheck ? (
                              <button
                                type="button"
                                className={`done-cover-check ${finished ? "is-checked" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggle?.(project._id, topic.id);
                                }}
                                aria-pressed={finished}
                                aria-label={
                                  finished
                                    ? `Mark ${topic.text} as not done`
                                    : `Mark ${topic.text} as done`
                                }
                                title={finished ? "Completed (click to undo)" : "Mark as done"}
                              >
                                {finished ? "✓" : ""}
                              </button>
                            ) : null}
                            <span className={`done-cover-pill-text ${finished ? "is-done" : ""}`}>
                              {topic.text}
                            </span>
                            {isTopFile ? (
                              <span className="done-top-badge done-top-badge-sky" title="Top of progress files stack (latest)">
                                TOP
                              </span>
                            ) : null}
                          </div>

                          {/* SOURCE Button underneath bubble */}
                          <div className="done-cover-mid-row">
                            <button
                              type="button"
                              className={`done-source done-source-cover ${hasSource || hasTopicPosts ? "has-source" : ""} ${isOpen ? "is-active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isOpen) closePanel();
                                else openPanel(topic);
                              }}
                              disabled={!canOpenSource}
                              title={
                                readOnlyTasks
                                  ? hasSource || hasTopicPosts
                                    ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                    : "No source"
                                  : hasSource || hasTopicPosts
                                    ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                    : "Add source"
                              }
                              aria-expanded={isOpen}
                              aria-label={`Source for ${topic.text}`}
                            >
                              <span className="done-source-label">SOURCE ({totalSourceCount})</span>
                            </button>
                          </div>

                          {/* Bottom Row: white circular button at bottom right (as in user screenshot) */}
                          <div className="done-cover-bottom-row">
                            <div className="done-cover-actions">
                              {Boolean(!todayMode || isCollaborativeWork || (Array.isArray(topic.comments) && topic.comments.length > 0) || taskLikes[topic.id]) ? (
                                <button
                                  type="button"
                                  className={`done-cover-heart-btn ${taskLikes[topic.id] ? "is-liked" : ""} ${finished ? "is-done" : ""}`}
                                  onClick={(e) => handleToggleTaskMenu(topic, e)}
                                  title="Actions (Ask, Like, Comment, Report)"
                                  aria-label={`Actions for ${topic.text}`}
                                >
                                  <IconHeartBubble filled={Boolean(taskLikes[topic.id])} />
                                </button>
                              ) : null}
                              {!todayMode && !readOnlyTasks && (
                                <button
                                  type="button"
                                  className={`done-cover-white-circle-btn ${moreMenuTopic?.id === topic.id ? "is-active" : ""}`}
                                  onClick={(e) => handleToggleMoreMenu(topic, e)}
                                  aria-label={`Options for ${topic.text}`}
                                  title="Options & Cover settings"
                                >
                                  <span className="done-cover-circle-inner" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : isTopCover ? (
                      <div className="done-cover-top-wrapper">
                        {/* Top Banner Image (Option 2 matching user screenshot) */}
                        <div className="done-cover-top-banner">
                          <DoneCoverImage cover={topic.coverImage} className="done-cover-top-img" />
                        </div>

                        {/* Bottom Body (same colors and styles as previous progress file state) */}
                        <div className="done-cover-top-body">
                          <div className="done-row">
                            <div className="done-row-main">
                              <div className="done-text-line">
                                <span className={`done-text ${finished ? "is-done" : ""}`}>
                                  {topic.text}
                                </span>
                                {isTopFile ? (
                                  <span className="done-top-badge" title="Top of progress files stack (latest)">
                                    TOP
                                  </span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className={`done-source ${hasSource || hasTopicPosts ? "has-source" : ""} ${isOpen ? "is-active" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isOpen) closePanel();
                                  else openPanel(topic);
                                }}
                                disabled={!canOpenSource}
                                title={
                                  readOnlyTasks
                                    ? hasSource || hasTopicPosts
                                      ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                      : "No source"
                                    : hasSource || hasTopicPosts
                                      ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                      : "Add source"
                                }
                                aria-expanded={isOpen}
                                aria-label={`Source for ${topic.text}`}
                              >
                                <IconPaperclip className="done-source-icon" />
                                <span className="done-source-label">Source</span>
                                {totalSourceCount > 0 ? (
                                  <span className="done-source-count-chip">
                                    <span className="done-source-sep" aria-hidden="true">•</span>
                                    <span className="done-source-count">{totalSourceCount}</span>
                                  </span>
                                ) : null}
                              </button>
                            </div>

                            <div className="done-row-side">
                              <div className="done-row-actions">
                                {Boolean(!todayMode || isCollaborativeWork || (Array.isArray(topic.comments) && topic.comments.length > 0) || taskLikes[topic.id]) ? (
                                  <button
                                    type="button"
                                    className={`done-return-btn ${taskMenuTopic?.id === topic.id ? "is-active" : ""} ${finished ? "is-done" : ""}`}
                                    onClick={(e) => handleToggleTaskMenu(topic, e)}
                                    title="Actions (Ask, Like, Comment, Report)"
                                    aria-label={`Actions for ${topic.text}`}
                                  >
                                    <IconHeartBubble filled={Boolean(taskLikes[topic.id])} />
                                  </button>
                                ) : null}
                                {!todayMode && !readOnlyTasks && (
                                  <button
                                    type="button"
                                    className={`done-more-btn ${moreMenuTopic?.id === topic.id ? "is-active" : ""}`}
                                    onClick={(e) => handleToggleMoreMenu(topic, e)}
                                    aria-label={`Options for ${topic.text}`}
                                    title="More options"
                                  >
                                    <IconMoreVertical />
                                  </button>
                                )}
                              </div>

                              {showCheck ? (
                                <button
                                  type="button"
                                  className={`done-check ${finished ? "is-checked" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle?.(project?._id || project?.id, topic.id);
                                  }}
                                  aria-pressed={finished}
                                  aria-label={
                                    finished
                                      ? `Mark ${topic.text} as not done`
                                      : `Mark ${topic.text} as done`
                                  }
                                  title={finished ? "Completed (click to undo)" : "Mark as done"}
                                >
                                  {finished ? "✓" : ""}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Normal State without cover image */
                      <div className="done-row">
                        <div className="done-row-main">
                          <div className="done-text-line">
                            <span className="done-text">
                              {topic.text}
                            </span>
                            {isTopFile ? (
                              <span className="done-top-badge" title="Top of progress files stack (latest)">
                                TOP
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className={`done-source ${hasSource || hasTopicPosts ? "has-source" : ""} ${isOpen ? "is-active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOpen) closePanel();
                              else openPanel(topic);
                            }}
                            disabled={!canOpenSource}
                            title={
                              readOnlyTasks
                                ? hasSource || hasTopicPosts
                                  ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                  : "No source"
                                : hasSource || hasTopicPosts
                                  ? `${sourceCount} source(s)${hasTopicPosts ? ` · ${topicPostsCount} post(s)` : ""}`
                                  : "Add source"
                            }
                            aria-expanded={isOpen}
                            aria-label={`Source for ${topic.text}`}
                          >
                            <span className="done-source-label">SOURCE ({totalSourceCount})</span>
                          </button>
                        </div>

                        <div className="done-row-side">
                          <div className="done-row-actions">
                            {Boolean(!todayMode || isCollaborativeWork || (Array.isArray(topic.comments) && topic.comments.length > 0) || taskLikes[topic.id]) ? (
                              <button
                                type="button"
                                className={`done-return-btn ${taskMenuTopic?.id === topic.id ? "is-active" : ""} ${finished ? "is-done" : ""}`}
                                onClick={(e) => handleToggleTaskMenu(topic, e)}
                                title="Actions (Ask, Like, Comment, Report)"
                                aria-label={`Actions for ${topic.text}`}
                                aria-haspopup="true"
                                aria-expanded={taskMenuTopic?.id === topic.id}
                              >
                                <IconHeartBubble filled={Boolean(taskLikes[topic.id])} />
                              </button>
                            ) : null}
                            {!todayMode && !readOnlyTasks && (
                              <button
                                type="button"
                                className={`done-more-btn ${moreMenuTopic?.id === topic.id ? "is-active" : ""}`}
                                onClick={(e) => handleToggleMoreMenu(topic, e)}
                                aria-label={`Options for ${topic.text}`}
                                title="More options"
                                aria-haspopup="true"
                                aria-expanded={moreMenuTopic?.id === topic.id}
                              >
                                <IconMoreVertical />
                              </button>
                            )}
                          </div>

                          {showCheck ? (
                            <button
                              type="button"
                              className={`done-check ${finished ? "is-checked" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggle?.(project._id, topic.id);
                              }}
                              aria-pressed={finished}
                              aria-label={
                                finished
                                  ? `Mark ${topic.text} as not done`
                                  : `Mark ${topic.text} as done`
                              }
                              title={finished ? "Completed (click to undo)" : "Mark as done"}
                            >
                              {finished ? "✓" : ""}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}

                  {isOpen ? (
                    <div className="done-source-panel" role="tablist">
                      <div className="done-source-tabs">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sourceTab === "open"}
                          className={`done-source-tab-btn ${sourceTab === "open" ? "is-active" : ""}`}
                          onClick={() => setSourceTab("open")}
                        >
                          <span>Open</span>
                          {sourceCount > 0 ? (
                            <span className="done-source-tab-count">{sourceCount}</span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={sourceTab === "post"}
                          className={`done-source-tab-btn ${sourceTab === "post" ? "is-active" : ""}`}
                          onClick={() => setSourceTab("post")}
                        >
                          <span>Post</span>
                          {(topicPostsCounts[topic.id] || 0) > 0 ? (
                            <span className="done-source-tab-count">
                              {topicPostsCounts[topic.id]}
                            </span>
                          ) : null}
                        </button>
                        {isSourceEditMode && !readOnlyTasks ? (
                          <>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "file"}
                              className={`done-source-tab-btn ${sourceTab === "file" ? "is-active" : ""}`}
                              onClick={() => setSourceTab("file")}
                            >
                              + File
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "link"}
                              className={`done-source-tab-btn ${sourceTab === "link" ? "is-active" : ""}`}
                              onClick={() => setSourceTab("link")}
                            >
                              + Link
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sourceTab === "text"}
                              className={`done-source-tab-btn ${sourceTab === "text" ? "is-active" : ""}`}
                              onClick={() => setSourceTab("text")}
                            >
                              + Text
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
                                {sourceCount > 1 && (
                                  <div className="done-source-pills" role="tablist" aria-label="Source pagination">
                                    <span className="done-source-pills-label">Sources</span>
                                    <div className="done-source-pills-track">
                                      {sourceList.map((item, idx) => {
                                        const isSelected = idx === safeIdx;
                                        const typeName =
                                          item.type === "file"
                                            ? "File"
                                            : item.type === "link" || isUrlSource(item.content)
                                              ? "Link"
                                              : "Note";
                                        const name =
                                          item.title ||
                                          item.proof?.name ||
                                          (item.content ? String(item.content).slice(0, 30) : "") ||
                                          typeName;
                                        return (
                                          <button
                                            key={item.id || idx}
                                            type="button"
                                            role="tab"
                                            aria-selected={isSelected}
                                            className={`done-source-pill ${isSelected ? "is-active" : ""}`}
                                            onClick={() => setOpenSourceIndex(idx)}
                                            title={`Source ${idx + 1}: ${name} (${typeName})`}
                                            aria-label={`Source ${idx + 1}: ${name}`}
                                          >
                                            <span className="done-source-pill-num">{idx + 1}</span>
                                            {isSelected ? (
                                              <span className="done-source-pill-glow" aria-hidden="true" />
                                            ) : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="done-source-item">
                                  {(isSourceEditMode && !readOnlyTasks) || activeItem.aiSummary ? (
                                    <header className="done-source-item-head">
                                      <div className="done-source-item-head-left">
                                        <AiSourceSummary
                                          source={activeItem}
                                          onSaveSummary={(summaryData) =>
                                            updateSourceItemSummary(topic, activeItem.id, summaryData)
                                          }
                                        />
                                      </div>
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
                                  ) : null}

                                  {(editingTitleId === activeItem.id && isSourceEditMode) || Boolean(activeItem.title) || (isSourceEditMode && !readOnlyTasks) ? (
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
                                          {activeItem.title ? (
                                            <strong className="done-source-title-heading">
                                              {activeItem.title}
                                            </strong>
                                          ) : null}
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
                                  ) : null}

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
                                        <LinkCoverSlicePreview
                                          url={activeItem.content}
                                          title={activeItem.title}
                                          onOpen={() => openSourceUrl(activeItem.content)}
                                          onEdit={() => {
                                            setEditingContentId(activeItem.id);
                                            setEditingContentValue(activeItem.content || "");
                                          }}
                                          isEditMode={isSourceEditMode}
                                          readOnly={readOnlyTasks}
                                        />
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
                                          rows={4}
                                          placeholder="Type infinite words here freely..."
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
                                      (() => {
                                        const fullContent = String(activeItem.content || "").trim();

                                        return (
                                          <div className="done-source-text-card">
                                            {isSourceEditMode && !readOnlyTasks ? (
                                              <div className="done-source-text-card-head">
                                                <div className="done-source-text-actions">
                                                  <button
                                                    type="button"
                                                    className="done-source-title-edit-btn"
                                                    onClick={() => {
                                                      setEditingContentId(activeItem.id);
                                                      setEditingContentValue(activeItem.content || "");
                                                    }}
                                                    title="Edit text content"
                                                  >
                                                    ✎ Edit text
                                                  </button>
                                                </div>
                                              </div>
                                            ) : null}

                                            <div className="done-source-text-body">
                                              <p className="done-source-text-content">
                                                {fullContent}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {(topicPostsCounts[topic.id] || 0) > 0 ? (
                            <div className="done-source-finished-posts-preview">
                              <div className="done-source-finished-posts-preview-head">
                                <span className="done-source-finished-posts-preview-title">
                                  ✓ Finished Posts ({topicPostsCounts[topic.id]})
                                </span>
                                <button
                                  type="button"
                                  className="done-source-finished-posts-view-all"
                                  onClick={() => setSourceTab("post")}
                                >
                                  View posts →
                                </button>
                              </div>
                              <p className="done-source-finished-posts-preview-sub">
                                Users posted completion updates for this task. Click to view.
                              </p>
                            </div>
                          ) : null}
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

                      {sourceTab === "post" ? (
                        <div className="done-source-pane">
                          <TaskSourcePosts
                            topic={topic}
                            project={project}
                            onShareFinish={onShareTopic}
                            onPostsLoaded={(loaded) => {
                              setTopicPostsCounts((prev) => ({
                                ...prev,
                                [topic.id]: loaded.length,
                              }));
                            }}
                          />
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
                            placeholder="Write text notes or source details for this task (infinite words supported)..."
                            rows={4}
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
        </div>
      </div>
    </div>

    {taskMenuTopic &&
      createPortal(
        <ul
          ref={taskMenuRef}
          className="task-action-menu"
          style={taskMenuStyle}
          role="menu"
          aria-label="Task actions"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn"
              onClick={() => handleActionAsk(taskMenuTopic)}
            >
              <span className="task-action-icon">
                <IconAsk />
              </span>
              <span className="task-action-label">Ask</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={`task-action-item-btn ${taskLikes[taskMenuTopic.id] ? "is-liked" : ""}`}
              onClick={() => handleActionLike(taskMenuTopic)}
            >
              <span className="task-action-icon">
                <IconHeart filled={Boolean(taskLikes[taskMenuTopic.id])} />
              </span>
              <span className="task-action-label">
                {taskLikes[taskMenuTopic.id] ? "Liked" : "Like"}
              </span>
              <span
                className={`task-action-count-badge ${
                  taskLikes[taskMenuTopic.id] ? "is-liked" : ""
                }`}
              >
                {getLikeCountForTopic(taskMenuTopic.id)}
              </span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn"
              onClick={() => handleActionComment(taskMenuTopic)}
            >
              <span className="task-action-icon">
                <IconComment />
              </span>
              <span className="task-action-label">Comment</span>
              <span
                className={`task-action-count-badge ${
                  getTaskComments(project?._id, taskMenuTopic.id).length > 0 ? "has-comments" : ""
                }`}
              >
                {getTaskComments(project?._id, taskMenuTopic.id).length}
              </span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn is-report"
              onClick={() => handleActionReport(taskMenuTopic)}
            >
              <span className="task-action-icon">
                <IconReport />
              </span>
              <span className="task-action-label">Report</span>
            </button>
          </li>
        </ul>,
        document.body
      )}

    {moreMenuTopic &&
      createPortal(
        <ul
          ref={moreMenuRef}
          className="task-action-menu task-more-menu"
          style={moreMenuStyle}
          role="menu"
          aria-label="More task options"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn"
              onClick={() => {
                const target = moreMenuTopic;
                setMoreMenuTopic(null);
                openCoverModal(target);
              }}
            >
              <span className="task-action-icon">
                <IconPhotoCover />
              </span>
              <span className="task-action-label">
                {moreMenuTopic.coverImage ? "Change cover image" : "Add cover image"}
              </span>
            </button>
          </li>
          {moreMenuTopic.coverImage ? (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="task-action-item-btn"
                  onClick={() => {
                    const target = moreMenuTopic;
                    setMoreMenuTopic(null);
                    const currentMode =
                      target.coverMode === "full" ? "full" : "top";
                    const newMode = currentMode === "full" ? "top" : "full";
                    handleUpdateTopicCover(target.id, { coverMode: newMode });
                    showToast(
                      `Switched cover to ${newMode === "full" ? "full card" : "top banner"}`
                    );
                  }}
                >
                  <span className="task-action-icon">
                    {moreMenuTopic.coverMode === "full" ? (
                      <IconBannerMode />
                    ) : (
                      <IconFullCardMode />
                    )}
                  </span>
                  <span className="task-action-label">
                    {moreMenuTopic.coverMode === "full"
                      ? "Switch to Top banner"
                      : "Switch to Full cover"}
                  </span>
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="task-action-item-btn"
                  onClick={() => {
                    const target = moreMenuTopic;
                    setMoreMenuTopic(null);
                    handleUpdateTopicCover(target.id, {
                      coverImage: null,
                      coverMode: "none",
                    });
                    showToast("Removed cover (normal state)");
                  }}
                >
                  <span className="task-action-icon">
                    <IconNoCover />
                  </span>
                  <span className="task-action-label">Remove cover (normal state)</span>
                </button>
              </li>
            </>
          ) : null}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn"
              onClick={() => {
                const textToCopy = moreMenuTopic.text;
                setMoreMenuTopic(null);
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(textToCopy).catch(() => {});
                }
                showToast(`Copied text to clipboard`);
              }}
            >
              <span className="task-action-icon">
                <IconCopy />
              </span>
              <span className="task-action-label">Copy text</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="task-action-item-btn is-report"
              onClick={() => {
                const topicToRemove = moreMenuTopic;
                setMoreMenuTopic(null);
                onRemove(project._id, topicToRemove.id);
                showToast(`Removed "${topicToRemove.text}"`);
              }}
            >
              <span className="task-action-icon">
                <IconTrash />
              </span>
              <span className="task-action-label">Delete task</span>
            </button>
          </li>
        </ul>,
        document.body
      )}

    {askModalTopic &&
      createPortal(
        <div
          className="task-action-modal-overlay"
          onClick={() => setAskModalTopic(null)}
        >
          <div
            className="task-action-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-modal-title"
          >
            <div className="task-action-modal-head">
              <h4 id="ask-modal-title">Ask about task</h4>
              <button
                type="button"
                className="task-action-modal-close"
                onClick={() => setAskModalTopic(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="task-action-modal-taskname">
              Task: <strong>{askModalTopic.text}</strong>
            </p>
            <form onSubmit={handleSubmitAsk}>
              <textarea
                className="task-action-modal-textarea"
                rows={3}
                placeholder="What would you like to ask or clarify about this task?"
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                autoFocus
              />
              <div className="task-action-modal-foot">
                <button
                  type="button"
                  className="task-action-modal-cancel"
                  onClick={() => setAskModalTopic(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="task-action-modal-submit"
                  disabled={!askText.trim()}
                >
                  Send Question
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    {commentModalTopic &&
      createPortal(
        <div
          className="task-action-modal-overlay"
          onClick={() => setCommentModalTopic(null)}
        >
          <div
            className="task-action-modal-card task-comment-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="comment-modal-title"
          >
            <div className="task-action-modal-head">
              <div className="task-comment-modal-title-row">
                <h4 id="comment-modal-title">Comments</h4>
                <span className="task-comment-count-badge">
                  {taskComments.length}
                </span>
              </div>
              <button
                type="button"
                className="task-action-modal-close"
                onClick={() => setCommentModalTopic(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="task-action-modal-taskname">
              Task: <strong>{commentModalTopic.text}</strong>
            </p>

            <div className="task-comment-body">
              {taskComments.length === 0 ? (
                <div className="task-comment-empty">
                  <span>No comments yet. Write a comment below!</span>
                </div>
              ) : (
                <div className="task-comment-list">
                  {taskComments.map((c) => (
                    <div key={c.id} className="task-comment-item">
                      <div className="task-comment-header">
                        <div className="task-comment-author-badge">
                          <span className="task-comment-avatar-circle">
                            {(c.author || "U").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="task-comment-author-name">
                            {c.author || "You"}
                          </span>
                        </div>
                        <div className="task-comment-meta-right">
                          <span className="task-comment-time">
                            {formatCommentTime(c.createdAt)}
                          </span>
                          <button
                            type="button"
                            className="task-comment-delete-btn"
                            onClick={() => handleDeleteComment(c.id)}
                            title="Delete comment"
                            aria-label="Delete comment"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="task-comment-text">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmitComment} className="task-comment-form">
                <textarea
                  className="task-action-modal-textarea task-comment-input"
                  rows={2}
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (commentText.trim()) handleSubmitComment(e);
                    }
                  }}
                  autoFocus
                />
                <div className="task-action-modal-foot">
                  <button
                    type="button"
                    className="task-action-modal-cancel"
                    onClick={() => setCommentModalTopic(null)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="task-action-modal-submit"
                    disabled={!commentText.trim()}
                  >
                    Post Comment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

    {reportModalTopic &&
      createPortal(
        <div
          className="task-action-modal-overlay"
          onClick={() => setReportModalTopic(null)}
        >
          <div
            className="task-action-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
          >
            <div className="task-action-modal-head">
              <h4 id="report-modal-title">Report task</h4>
              <button
                type="button"
                className="task-action-modal-close"
                onClick={() => setReportModalTopic(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="task-action-modal-taskname">
              Task: <strong>{reportModalTopic.text}</strong>
            </p>
            <form onSubmit={handleSubmitReport}>
              <textarea
                className="task-action-modal-textarea"
                rows={3}
                placeholder="Describe the issue or reason for reporting this task..."
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                autoFocus
              />
              <div className="task-action-modal-foot">
                <button
                  type="button"
                  className="task-action-modal-cancel"
                  onClick={() => setReportModalTopic(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="task-action-modal-submit is-danger"
                  disabled={!reportText.trim()}
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    {coverModalTopic &&
      createPortal(
        <div
          className="cover-modal-overlay"
          onClick={() => setCoverModalTopic(null)}
          role="presentation"
        >
          <div
            className="cover-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cover-modal-title"
          >
            <header className="cover-modal-header">
              <div className="cover-modal-title-wrap">
                <IconPhotoCover />
                <div>
                  <h3 id="cover-modal-title">Progress File Cover</h3>
                  <p className="cover-modal-sub">"{coverModalTopic.text}"</p>
                </div>
              </div>
              <button
                type="button"
                className="cover-modal-close-btn"
                onClick={() => setCoverModalTopic(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="cover-modal-body">
              {/* Option Selector: 3 options (Top banner, Full card, Normal state) */}
              <div
                className="cover-options-grid"
                role="radiogroup"
                aria-label="Cover display option"
              >
                {/* Option 1: Top Banner */}
                <div
                  className={`cover-option-card ${
                    coverModalMode === "top" && coverModalImage ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setCoverModalMode("top");
                    if (!coverModalImage) {
                      changeCoverFileRef.current?.click();
                    }
                  }}
                  role="radio"
                  aria-checked={coverModalMode === "top" && Boolean(coverModalImage)}
                  tabIndex={0}
                >
                  <div className="cover-option-visual is-top-demo">
                    <div
                      className="demo-top-img"
                      style={{
                        backgroundImage: coverModalImage?.dataUrl
                          ? `url(${coverModalImage.dataUrl})`
                          : undefined,
                      }}
                    />
                    <div className="demo-top-body" />
                  </div>
                  <span className="cover-option-name">Top banner</span>
                  <span className="cover-option-desc">Image at top, body below</span>
                </div>

                {/* Option 2: Full Card */}
                <div
                  className={`cover-option-card ${
                    coverModalMode === "full" && coverModalImage ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setCoverModalMode("full");
                    if (!coverModalImage) {
                      changeCoverFileRef.current?.click();
                    }
                  }}
                  role="radio"
                  aria-checked={coverModalMode === "full" && Boolean(coverModalImage)}
                  tabIndex={0}
                >
                  <div className="cover-option-visual is-full-demo">
                    <div
                      className="demo-full-img"
                      style={{
                        backgroundImage: coverModalImage?.dataUrl
                          ? `url(${coverModalImage.dataUrl})`
                          : undefined,
                      }}
                    >
                      <div className="demo-full-pill" />
                    </div>
                  </div>
                  <span className="cover-option-name">Full card</span>
                  <span className="cover-option-desc">Image covers entire card</span>
                </div>

                {/* Option 3: Normal State */}
                <div
                  className={`cover-option-card ${
                    coverModalMode === "none" || !coverModalImage ? "is-selected" : ""
                  }`}
                  onClick={() => setCoverModalMode("none")}
                  role="radio"
                  aria-checked={coverModalMode === "none" || !coverModalImage}
                  tabIndex={0}
                >
                  <div className="cover-option-visual is-none-demo">
                    <div className="demo-none-body">
                      <div className="demo-none-line" />
                      <div className="demo-none-badge" />
                    </div>
                  </div>
                  <span className="cover-option-name">Normal state</span>
                  <span className="cover-option-desc">Without cover image</span>
                </div>
              </div>

              {/* Image upload / change bar */}
              {coverModalMode !== "none" ? (
                <div className="cover-image-picker-bar">
                  {coverModalImage ? (
                    <div className="cover-chosen-info">
                      <img
                        src={coverModalImage.dataUrl}
                        alt="Cover"
                        className="cover-chosen-thumb"
                      />
                      <div className="cover-chosen-meta">
                        <span className="cover-chosen-name">
                          {coverModalImage.name || "Cover image attached"}
                        </span>
                        {coverModalImage.size ? (
                          <span className="cover-chosen-size">
                            {Math.round(coverModalImage.size / 1024)} KB
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="cover-repick-btn"
                        onClick={() => changeCoverFileRef.current?.click()}
                        disabled={busyFile}
                      >
                        {busyFile ? "Reading…" : "Change image"}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cover-upload-trigger-btn"
                      onClick={() => changeCoverFileRef.current?.click()}
                      disabled={busyFile}
                    >
                      <IconPhotoCover />
                      <span>{busyFile ? "Reading image…" : "Choose cover image…"}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <footer className="cover-modal-footer">
              <button
                type="button"
                className="cover-modal-cancel-btn"
                onClick={() => setCoverModalTopic(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cover-modal-apply-btn"
                onClick={handleApplyCoverModal}
              >
                Save Changes
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

    {toastMessage &&
      createPortal(
        <div className="done-action-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>,
        document.body
      )}

    {showHourglassModal && (
      <FolderHourglassModal
        folder={
          (folders || []).find((f) => f.id === project?.folderId) || {
            name: project?.name || "Progress",
          }
        }
        projects={
          (() => {
            const parent = (folders || []).find((f) => f.id === project?.folderId);
            if (parent && Array.isArray(allProjects) && allProjects.length > 0) {
              const inFolder = allProjects.filter((p) => p.folderId === parent.id);
              if (inFolder.length > 0) return inFolder;
            }
            return project ? [project] : [];
          })()
        }
        onClose={() => setShowHourglassModal(false)}
      />
    )}

    {fullScreenSource ? (
      <SourceTextFullScreenModal
        isOpen={Boolean(fullScreenSource)}
        title={fullScreenSource.title}
        subtitle={fullScreenSource.subtitle}
        content={fullScreenSource.content}
        canEdit={fullScreenSource.canEdit}
        initialEditing={fullScreenSource.initialEditing}
        onSave={fullScreenSource.onSave}
        onClose={() => setFullScreenSource(null)}
      />
    ) : null}
  </>
  );
}

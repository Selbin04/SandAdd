import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SHARE_THREADS,
  PROOF_ACCEPT,
  addGroupPost,
  addSharedMessage,
  addUserPost,
  fileToProof,
  getShareGroups,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import { buildLiveShareTemplate, getLiveWork } from "../lib/liveWorks.js";
import { joinFollowedWorkGroup, getFollowedWorkGroup } from "../lib/followingStore.js";
import { getAuthUser } from "../lib/auth.js";
import TaskSelector from "./TaskSelector.jsx";
import ProofMedia from "./ProofMedia.jsx";
import FileUploadHint from "./FileUploadHint.jsx";
import { normalizeSourceUrl } from "./SourceMedia.jsx";
import "./WorkShareModal.css";

function resolveExactCreator(project, author) {
  const authUser = getAuthUser();
  const isFollowed = Boolean(project?.originId || project?.sharedTemplateId);

  if (isFollowed) {
    const originKey = project.originId || project.sharedTemplateId;
    let live = null;
    try {
      live = getLiveWork(originKey);
    } catch {
      /* ignore */
    }
    const group = getFollowedWorkGroup(originKey);

    const name =
      (project?.creatorName && project.creatorName !== "Work Creator" && project.creatorName !== "Creator" && project.creatorName !== "Me"
        ? project.creatorName
        : null) ||
      live?.author?.name ||
      group?.creatorName ||
      project?.creatorName ||
      author?.name ||
      "Creator";

    const handle =
      project?.creatorHandle ||
      live?.author?.handle ||
      group?.creatorHandle ||
      "";

    return { name, handle };
  }

  // User's own project
  const name =
    (project?.creatorName && project.creatorName !== "Me" && project.creatorName !== "Work Creator"
      ? project.creatorName
      : null) ||
    author?.name ||
    authUser?.name ||
    "User";

  const handle =
    project?.creatorHandle ||
    author?.handle ||
    authUser?.handle ||
    "";

  return { name, handle };
}

const TARGETS = [
  { id: "post", label: "Post", hint: "Share to Social → View" },
  { id: "groups", label: "Groups", hint: "Share into a group feed" },
  { id: "messages", label: "Messages", hint: "Send in a chat" },
];

export default function WorkShareModal({ project, mode = "follow", onClose, onShared }) {
  const [step, setStep] = useState("target");
  const [target, setTarget] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(null);
  const [proofName, setProofName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef(null);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const next = await fileToProof(file);
      setProof(next);
      setProofName(next?.name || "");
    } catch (err) {
      setProof(null);
      setProofName("");
      setError(err.message || "Could not attach media");
    } finally {
      setBusy(false);
    }
  };

  const removeProof = () => {
    setProof(null);
    setProofName("");
  };

  const [taskMode, setTaskMode] = useState("all");
  const projectTopics = project?.topics || [];
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => {
    return new Set(projectTopics.map((t, idx) => String(t?.id || `w-${idx}`)));
  });

  const handleToggleTaskId = (id) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTasks = () => {
    setSelectedTaskIds(new Set(projectTopics.map((t, idx) => String(t?.id || `w-${idx}`))));
  };

  const handleDeselectAllTasks = () => {
    setSelectedTaskIds(new Set());
  };

  const shareGroups = getShareGroups();
  const selectedGroup = shareGroups.find((g) => g.id === groupId) || null;
  const selectedThread = SHARE_THREADS.find((t) => t.id === threadId) || null;
  const isAssign = mode === "assign";
  const title = isAssign ? "Share to contribute" : "Share to follow";
  const blurb = isAssign
    ? "Assignees add this project to Progress. They get task updates and cannot edit or add tasks."
    : "Followers add this project to Progress. They get task updates and cannot edit or add tasks.";

  const defaultBody = () =>
    isAssign
      ? `Contribute to project: ${project?.name || "project"}`
      : `Follow this project: ${project?.name || "project"}`;

  const goCompose = (nextTarget, nextGroupId = null, nextThreadId = null) => {
    setTarget(nextTarget);
    setGroupId(nextGroupId);
    setThreadId(nextThreadId);
    setError("");
    setStep("compose");
  };

  const publish = async () => {
    if (!project?._id) {
      setError("No project to share.");
      return;
    }
    if (target !== "post" && target !== "groups" && target !== "messages") {
      setError("Pick where to share first.");
      return;
    }
    if (target === "groups" && !groupId) {
      setError("Pick a group first.");
      return;
    }
    if (taskMode === "select" && selectedTaskIds.size === 0) {
      setError("Please select at least 1 task to share.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const author = readAuthorProfile();
      const creator = resolveExactCreator(project, author);
      let sharedProject = buildLiveShareTemplate(project, mode, author);
      if (!sharedProject) throw new Error("Could not prepare share.");

      let finalWorks = sharedProject.works;
      if (taskMode === "select") {
        finalWorks = sharedProject.works.filter((w) => selectedTaskIds.has(String(w.id)));
        sharedProject = {
          ...sharedProject,
          works: finalWorks,
        };
      }

      const body = caption.trim() || defaultBody();
      const trimmedLink = linkUrl.trim();
      const normalizedLink = trimmedLink ? normalizeSourceUrl(trimmedLink) : "";

      let mediaProof = proof || null;
      if (!mediaProof && normalizedLink) {
        mediaProof = {
          type: "link",
          url: normalizedLink,
          name: normalizedLink,
        };
      }

      const base = {
        id: `live-${Date.now()}`,
        name: author.name,
        handle: author.handle,
        initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
        body,
        projectId: project._id,
        projectName: project.name,
        creatorName: creator.name,
        creatorHandle: creator.handle,
        works: finalWorks,
        sharedProject: {
          ...sharedProject,
          link: normalizedLink || null,
          proof: proof || null,
        },
        proof: mediaProof,
        link: normalizedLink || null,
        createdAt: new Date().toISOString(),
        isUser: true,
        shareMode: mode,
        kind: "post",
      };

      if (target === "groups") {
        addGroupPost(groupId, {
          ...base,
          meta: `${isAssign ? "assigned" : "follow"} · ${project.name} · ${selectedGroup?.name || "group"}`,
          groupId,
          groupName: selectedGroup?.name || "",
          creatorName: creator.name,
          creatorHandle: creator.handle,
          proof: mediaProof,
          link: normalizedLink || null,
        });
      } else if (target === "messages") {
        addSharedMessage(threadId, {
          id: `live-msg-${Date.now()}`,
          from: "me",
          text: body,
          authorName: author.name,
          authorHandle: author.handle,
          creatorName: creator.name,
          creatorHandle: creator.handle,
          proof: mediaProof,
          link: normalizedLink || null,
          projectName: project.name,
          works: sharedProject.works,
          sharedProject: {
            ...sharedProject,
            link: normalizedLink || null,
            proof: proof || null,
          },
          createdAt: new Date().toISOString(),
          shareMode: mode,
        });
      } else {
        addUserPost({
          ...base,
          meta: `${isAssign ? "assigned" : "open to follow"} · ${project.name}`,
          groupId: null,
          groupName: "",
          creatorName: creator.name,
          creatorHandle: creator.handle,
          proof: mediaProof,
          link: normalizedLink || null,
        });
      }

      if (mode === "follow" || mode === "assign") {
        joinFollowedWorkGroup({
          ...sharedProject,
          originId: project._id,
          templateId: project._id,
          name: project.name,
          creatorName: creator.name || author?.name || "Work Creator",
          creatorHandle: creator.handle || author?.handle || "",
          currentUser: author,
          isCreator: true,
        });
      }

      onShared?.({ mode, target, groupId, threadId, sharedProject, author });
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not share.");
    } finally {
      setBusy(false);
    }
  };

  const pickTarget = (id) => {
    setError("");
    setTarget(id);
    if (id === "groups") {
      setStep("pick-group");
      return;
    }
    if (id === "messages") {
      setStep("pick-thread");
      return;
    }
    goCompose("post");
  };

  const backFromCompose = () => {
    setError("");
    if (target === "groups") setStep("pick-group");
    else if (target === "messages") setStep("pick-thread");
    else setStep("target");
  };

  const submitLabel =
    target === "groups"
      ? `Post to ${selectedGroup?.name || "Group"}`
      : target === "messages"
        ? `Send to ${selectedThread?.name || "chat"}`
        : "Post to View";

  const modalContent = (
    <div className="work-share-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="work-share-card"
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="work-share-head">
          <h2>{title}</h2>
          <p>{project?.name || "Work"}</p>
        </header>
        <p className="work-share-blurb">{blurb}</p>

        {step === "target" ? (
          <div className="work-share-targets">
            <p className="work-share-hint">Where do you want to share?</p>
            {TARGETS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="work-share-target"
                disabled={busy}
                onClick={() => pickTarget(item.id)}
              >
                <span className="work-share-num">{i + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        ) : step === "pick-group" ? (
          <div className="work-share-targets">
            <button
              type="button"
              className="work-share-back"
              onClick={() => setStep("target")}
            >
              ← Back
            </button>
            <p className="work-share-hint">Pick a group</p>
            {shareGroups.map((group, i) => (
              <button
                key={group.id}
                type="button"
                className="work-share-target"
                disabled={busy}
                onClick={() => goCompose("groups", group.id, null)}
              >
                <span className="work-share-num">{i + 1}</span>
                <span>
                  <strong>{group.name}</strong>
                  <small>{isAssign ? "Share to contribute into this group" : "Share to follow"}</small>
                </span>
              </button>
            ))}
          </div>
        ) : step === "pick-thread" ? (
          <div className="work-share-targets">
            <button
              type="button"
              className="work-share-back"
              onClick={() => setStep("target")}
            >
              ← Back
            </button>
            <p className="work-share-hint">Pick a chat</p>
            {SHARE_THREADS.map((thread, i) => (
              <button
                key={thread.id}
                type="button"
                className="work-share-target"
                disabled={busy}
                onClick={() => goCompose("messages", null, thread.id)}
              >
                <span className="work-share-num">{i + 1}</span>
                <span>
                  <strong>
                    {thread.name}
                    {thread.official ? " · Team" : ""}
                  </strong>
                  <small>
                    {isAssign ? "Assign in this chat" : "Invite to follow"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="work-share-compose">
            <button type="button" className="work-share-back" onClick={backFromCompose}>
              ← Back
            </button>
            <p className="work-share-hint">
              Write something before sharing
              {target === "groups"
                ? ` to ${selectedGroup?.name || "the group"}`
                : target === "messages"
                  ? ` to ${selectedThread?.name || "the chat"}`
                  : " to View"}
              .
            </p>
            <label className="work-share-caption">
              Caption
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder={defaultBody()}
                aria-label="Write something"
                autoFocus
              />
            </label>

            <div className="work-share-attachments">
              <div className="work-share-attach-header">
                <span className="work-share-attach-title">Attachments</span>
                <span className="work-share-attach-sub">Image, video, or link</span>
              </div>

              <div className="work-share-attach-row">
                <input
                  ref={fileRef}
                  type="file"
                  accept={PROOF_ACCEPT}
                  hidden
                  onChange={onFileChange}
                />
                <button
                  type="button"
                  className="work-share-attach-btn"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <span aria-hidden="true" className="work-share-attach-icon">
                    {proof?.type?.startsWith("video/") ? "🎥" : "🖼️"}
                  </span>
                  <span>{proofName ? "Change image / video" : "Attach image or video"}</span>
                </button>

                {proofName ? (
                  <button
                    type="button"
                    className="work-share-remove-btn"
                    title="Remove media file"
                    onClick={removeProof}
                  >
                    ✕ Remove
                  </button>
                ) : null}
              </div>

              {proof ? (
                <div className="work-share-preview-card">
                  <ProofMedia proof={proof} className="work-share-proof-preview" />
                  <div className="work-share-preview-info">
                    <span className="work-share-file-name" title={proof.name}>
                      {proof.name}
                    </span>
                    {proof.size ? (
                      <span className="work-share-file-size">
                        {(proof.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <FileUploadHint />
              )}

              <div className="work-share-link-row">
                <label className="work-share-link-label" htmlFor="work-share-link-input">
                  <span aria-hidden="true">🔗</span> Attach link
                </label>
                <div className="work-share-link-input-wrap">
                  <input
                    id="work-share-link-input"
                    type="url"
                    className="work-share-link-input"
                    placeholder="https://example.com or source link"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                  {linkUrl ? (
                    <button
                      type="button"
                      className="work-share-clear-link"
                      onClick={() => setLinkUrl("")}
                      title="Clear link"
                      aria-label="Clear link"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {linkUrl.trim() ? (
                  <div className="work-share-link-preview">
                    <span className="work-share-link-badge">Attached</span>
                    <a
                      href={normalizeSourceUrl(linkUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="work-share-link-test"
                    >
                      Test link ↗
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <TaskSelector
              topics={projectTopics}
              mode={taskMode}
              onModeChange={setTaskMode}
              selectedIds={selectedTaskIds}
              onToggleId={handleToggleTaskId}
              onSelectAll={handleSelectAllTasks}
              onDeselectAll={handleDeselectAllTasks}
            />
            <button
              type="button"
              className="work-share-submit"
              disabled={busy}
              onClick={() => void publish()}
            >
              {busy ? "Sharing…" : submitLabel}
            </button>
          </div>
        )}

        {error ? <p className="work-share-error">{error}</p> : null}
        <button type="button" className="work-share-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}

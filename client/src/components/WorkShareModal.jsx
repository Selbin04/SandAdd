import { useState } from "react";
import {
  SHARE_THREADS,
  addGroupPost,
  addSharedMessage,
  addUserPost,
  getShareGroups,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import { buildLiveShareTemplate } from "../lib/liveWorks.js";
import "./WorkShareModal.css";

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

  const shareGroups = getShareGroups();
  const selectedGroup = shareGroups.find((g) => g.id === groupId) || null;
  const selectedThread = SHARE_THREADS.find((t) => t.id === threadId) || null;
  const isAssign = mode === "assign";
  const title = isAssign ? "Share to assign" : "Share to follow";
  const blurb = isAssign
    ? "Assignees add this work to Progress. They get your task list updates and cannot edit or add tasks."
    : "Followers add this work to Progress. They get your task list updates and cannot edit or add tasks.";

  const defaultBody = () =>
    isAssign
      ? `Assigned work: ${project?.name || "work"}`
      : `Follow this work: ${project?.name || "work"}`;

  const goCompose = (nextTarget, nextGroupId = null, nextThreadId = null) => {
    setTarget(nextTarget);
    setGroupId(nextGroupId);
    setThreadId(nextThreadId);
    setError("");
    setStep("compose");
  };

  const publish = async () => {
    if (!project?._id) {
      setError("No work to share.");
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
    if (target === "messages" && !threadId) {
      setError("Pick a chat first.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const author = readAuthorProfile();
      const sharedProject = buildLiveShareTemplate(project, mode, author);
      if (!sharedProject) throw new Error("Could not prepare share.");

      const body = caption.trim() || defaultBody();
      const base = {
        id: `live-${Date.now()}`,
        name: author.name,
        handle: author.handle,
        initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
        body,
        projectId: project._id,
        projectName: project.name,
        works: sharedProject.works,
        sharedProject,
        proof: null,
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
        });
      } else if (target === "messages") {
        addSharedMessage(threadId, {
          id: `live-msg-${Date.now()}`,
          from: "me",
          text: body,
          proof: null,
          projectName: project.name,
          works: sharedProject.works,
          sharedProject,
          createdAt: new Date().toISOString(),
          shareMode: mode,
        });
      } else {
        addUserPost({
          ...base,
          meta: `${isAssign ? "assigned" : "open to follow"} · ${project.name}`,
          groupId: null,
          groupName: "",
        });
      }

      onShared?.({ mode, target, groupId, threadId });
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

  return (
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
                  <small>{isAssign ? "Assign into this group" : "Share to follow"}</small>
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
              Write something
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
}

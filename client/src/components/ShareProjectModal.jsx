import { useRef, useState } from "react";
import {
  SHARE_GROUPS,
  SHARE_THREADS,
  PROOF_ACCEPT,
  addGroupPost,
  addSharedMessage,
  addUserPost,
  fileToProof,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
import "./ShareProjectModal.css";

const TARGETS = [
  { id: "post", label: "Post", hint: "Share to Social → View", ready: true },
  { id: "groups", label: "Groups", hint: "Share into a group feed", ready: true },
  { id: "messages", label: "Messages", hint: "Send proof in a chat", ready: true },
];

export default function ShareProjectModal({ project, onClose, onPosted }) {
  const [step, setStep] = useState("target"); // target | pick-group | pick-thread | proof
  const [target, setTarget] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [caption, setCaption] = useState(
    project?.name ? `Finished ${project.name}` : "Finished a pour"
  );
  const [proof, setProof] = useState(null);
  const [proofName, setProofName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const selectedGroup = SHARE_GROUPS.find((g) => g.id === groupId) || null;
  const selectedThread = SHARE_THREADS.find((t) => t.id === threadId) || null;

  const pickTarget = (item) => {
    if (!item.ready) {
      setError(`${item.label} sharing isn’t ready yet.`);
      return;
    }
    setError("");
    setTarget(item.id);
    setGroupId(null);
    setThreadId(null);
    if (item.id === "groups") {
      setStep("pick-group");
      return;
    }
    if (item.id === "messages") {
      setStep("pick-thread");
      return;
    }
    setStep("proof");
  };

  const pickGroup = (id) => {
    setGroupId(id);
    setError("");
    setStep("proof");
  };

  const pickThread = (id) => {
    setThreadId(id);
    setError("");
    setStep("proof");
  };

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
      setError(err.message || "Could not attach proof");
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (target !== "post" && target !== "groups" && target !== "messages") {
      setError("That share target isn’t available yet.");
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
    if (!proof) {
      setError("Attach a proof file before posting.");
      return;
    }

    const author = readAuthorProfile();
    const body = caption.trim() || `Finished ${project?.name || "a project"}`;
    const base = {
      id: `user-${Date.now()}`,
      name: author.name,
      handle: author.handle,
      initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
      body,
      projectId: project?._id || null,
      projectName: project?.name || "",
      proof,
      createdAt: new Date().toISOString(),
      isUser: true,
    };

    if (target === "groups") {
      const post = {
        ...base,
        meta: `finished · ${project?.name || "project"} · ${selectedGroup?.name || "group"}`,
        groupId,
        groupName: selectedGroup?.name || "",
      };
      addGroupPost(groupId, post);
      onPosted?.(post, { target, groupId });
    } else if (target === "messages") {
      const message = {
        id: `share-${Date.now()}`,
        from: "me",
        text: body,
        proof,
        projectName: project?.name || "",
        createdAt: new Date().toISOString(),
      };
      addSharedMessage(threadId, message);
      onPosted?.(message, { target, threadId });
    } else {
      const post = {
        ...base,
        meta: `finished · ${project?.name || "project"}`,
        groupId: null,
        groupName: "",
      };
      addUserPost(post);
      onPosted?.(post, { target });
    }

    onClose?.();
  };

  const backFromProof = () => {
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

  const proofHint =
    target === "groups"
      ? `Add a proof, then post to ${selectedGroup?.name || "the group"}.`
      : target === "messages"
        ? `Add a proof, then send to ${selectedThread?.name || "the chat"}.`
        : "Add a proof that you finished this project, then post it to Social View.";

  return (
    <div className="share-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="share-card"
        role="dialog"
        aria-label="Share completed project"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="share-head">
          <h2>Share</h2>
          <p>{project?.name || "Completed project"}</p>
        </header>

        {step === "target" ? (
          <div className="share-targets">
            <p className="share-hint">Where do you want to share?</p>
            {TARGETS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`share-target ${item.ready ? "" : "is-disabled"}`}
                onClick={() => pickTarget(item)}
              >
                <span className="share-num">{i + 1}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))}
          </div>
        ) : step === "pick-group" ? (
          <div className="share-targets">
            <button
              type="button"
              className="share-back"
              onClick={() => {
                setStep("target");
                setError("");
              }}
            >
              ← Back
            </button>
            <p className="share-hint">Pick a group</p>
            {SHARE_GROUPS.map((group, i) => (
              <button
                key={group.id}
                type="button"
                className="share-target"
                onClick={() => pickGroup(group.id)}
              >
                <span className="share-num">{i + 1}</span>
                <span>
                  <strong>{group.name}</strong>
                  <small>Share proof into this group</small>
                </span>
              </button>
            ))}
          </div>
        ) : step === "pick-thread" ? (
          <div className="share-targets">
            <button
              type="button"
              className="share-back"
              onClick={() => {
                setStep("target");
                setError("");
              }}
            >
              ← Back
            </button>
            <p className="share-hint">Pick a chat</p>
            {SHARE_THREADS.map((thread, i) => (
              <button
                key={thread.id}
                type="button"
                className="share-target"
                onClick={() => pickThread(thread.id)}
              >
                <span className="share-num">{i + 1}</span>
                <span>
                  <strong>
                    {thread.name}
                    {thread.official ? " · Team" : ""}
                  </strong>
                  <small>Send proof in this conversation</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="share-proof">
            <button type="button" className="share-back" onClick={backFromProof}>
              ← Back
            </button>
            <p className="share-hint">{proofHint}</p>
            <label className="share-caption">
              Caption
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={280}
              />
            </label>
            <div className="share-attach">
              <input
                ref={fileRef}
                type="file"
                accept={PROOF_ACCEPT}
                hidden
                onChange={onFileChange}
              />
              <button
                type="button"
                className="share-attach-btn"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {proofName ? "Change proof file" : "Select proof from files"}
              </button>
              {proofName ? (
                <p className="share-file-name">{proofName}</p>
              ) : (
                <p className="share-file-name is-muted">
                  Image, video, or PDF — videos up to 20 MB
                </p>
              )}
              <ProofMedia proof={proof} className="share-preview" />
            </div>
            <button
              type="button"
              className="share-submit"
              disabled={busy}
              onClick={publish}
            >
              {submitLabel}
            </button>
          </div>
        )}

        {error ? <p className="share-error">{error}</p> : null}
        <button type="button" className="share-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

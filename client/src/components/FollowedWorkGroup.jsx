import { useEffect, useState, useRef } from "react";
import {
  addFollowedWorkMessage,
  ensureFollowedWorkGroup,
  getFollowedWorkGroup,
} from "../lib/followingStore.js";
import { readAuthorProfile } from "../lib/socialFeed.js";
import "./FollowedWorkGroup.css";

export default function FollowedWorkGroup({ originId, project }) {
  const [group, setGroup] = useState(() => {
    if (originId) return getFollowedWorkGroup(originId);
    if (project) return ensureFollowedWorkGroup(project, readAuthorProfile());
    return null;
  });
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isUpdate, setIsUpdate] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'updates' | 'chat'
  const [showQuickUpdates, setShowQuickUpdates] = useState(false);
  const messagesEndRef = useRef(null);

  const effectiveOriginId = originId || project?.originId || project?._id;

  useEffect(() => {
    const refresh = () => {
      if (!effectiveOriginId) return;
      let current = getFollowedWorkGroup(effectiveOriginId);
      if (!current && project) {
        current = ensureFollowedWorkGroup(project, readAuthorProfile());
      }
      setGroup(current);
    };

    const onStorage = (event) => {
      if (event.key === "sandadd.followedWorkGroups") refresh();
    };

    refresh();
    window.addEventListener("sandadd:followed-work-groups-changed", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("sandadd:followed-work-groups-changed", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [effectiveOriginId, project]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [group?.messages?.length, open, replyingTo]);

  if (!group && project) {
    const created = ensureFollowedWorkGroup(project, readAuthorProfile());
    if (created) setGroup(created);
  }

  if (!group) return null;

  const isCreator = group.role === "Creator";
  const messages = group.messages || [];
  const filteredMessages = messages.filter((m) => {
    if (activeTab === "updates") return m.from === "update" || m.role === "Creator";
    if (activeTab === "chat") return m.from !== "update";
    return true;
  });

  const sendMessage = (event) => {
    event.preventDefault();
    if (!draft.trim() || !effectiveOriginId) return;

    const author = readAuthorProfile();
    const updated = addFollowedWorkMessage(
      effectiveOriginId,
      { ...author, isCreator },
      draft,
      replyingTo,
      isUpdate
    );

    if (updated) {
      setGroup(updated);
      setDraft("");
      setReplyingTo(null);
      setIsUpdate(false);
    }
  };

  const postQuickUpdate = (text) => {
    if (!effectiveOriginId) return;
    const author = readAuthorProfile();
    const updated = addFollowedWorkMessage(
      effectiveOriginId,
      { ...author, isCreator: true },
      text,
      null,
      true
    );
    if (updated) {
      setGroup(updated);
      setShowQuickUpdates(false);
    }
  };

  return (
    <div className="work-group-anchor">
      <button
        type="button"
        className="work-group-trigger"
        aria-expanded={open}
        aria-label={`${group.name}, ${unseenCount} new messages`}
        onClick={() => {
          setOpen((value) => !value);
          setUnseenCount(0);
        }}
      >
        <span className="work-group-initial" aria-hidden="true">
          {group.initial || (group.name ? group.name[0].toUpperCase() : "W")}
        </span>
        <span className="work-group-trigger-copy">
          <strong>{group.name} Group</strong>
          <small>
            {isCreator ? "👑 Creator" : "👥 Member"} · {group.members?.length || 1} member
            {group.members?.length === 1 ? "" : "s"}
          </small>
        </span>
        {unseenCount > 0 ? (
          <span className="work-group-notification" aria-hidden="true">
            {unseenCount}
          </span>
        ) : null}
        <span className="work-group-chevron" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <section className="work-group-panel" aria-label={`${group.name} messages`}>
          <header className="work-group-panel-head">
            <div className="work-group-head-title">
              <strong>{group.name} Group</strong>
              <span>
                {group.status || "Progress & Member Chat"}
              </span>
            </div>
            <div className="work-group-head-actions">
              {isCreator ? (
                <button
                  type="button"
                  className="inform-update-btn"
                  onClick={() => setShowQuickUpdates((v) => !v)}
                  title="Inform followers of new progress update"
                >
                  📢 Inform Update
                </button>
              ) : null}
              <button
                type="button"
                className="close-panel-btn"
                aria-label="Close group messages"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {/* Quick Update Selector for Creator */}
          {showQuickUpdates && isCreator ? (
            <div className="quick-updates-box">
              <span className="quick-updates-title">Broadcast Quick Update to Followers:</span>
              <div className="quick-updates-buttons">
                <button
                  type="button"
                  onClick={() => postQuickUpdate(`🚀 Project milestone updated: ${group.name}`)}
                >
                  🚀 Milestone Updated
                </button>
                <button
                  type="button"
                  onClick={() => postQuickUpdate(`⏳ Progress updated for ${group.name}`)}
                >
                  ⏳ Progress Updated
                </button>
                <button
                  type="button"
                  onClick={() => postQuickUpdate(`✅ Completed major tasks in ${group.name}`)}
                >
                  ✅ Major Tasks Completed
                </button>
              </div>
            </div>
          ) : null}

          {/* Filter Tabs */}
          <div className="work-group-tabs">
            <button
              type="button"
              className={`work-group-tab ${activeTab === "all" ? "is-active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({messages.length})
            </button>
            <button
              type="button"
              className={`work-group-tab ${activeTab === "updates" ? "is-active" : ""}`}
              onClick={() => setActiveTab("updates")}
            >
              📢 Updates
            </button>
            <button
              type="button"
              className={`work-group-tab ${activeTab === "chat" ? "is-active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              💬 Chat
            </button>
          </div>

          <div className="work-group-messages" aria-live="polite">
            {filteredMessages.length === 0 ? (
              <p className="work-group-empty">No messages or updates in this group yet.</p>
            ) : (
              filteredMessages.map((message) => {
                const isSysUpdate = message.from === "update";
                const isMsgMine = message.from === "me" || message.author === readAuthorProfile().name;
                const isMsgCreator = message.role === "Creator" || message.author === group.creatorName;

                return (
                  <article
                    key={message.id}
                    className={`work-group-message ${
                      isSysUpdate ? "is-update" : isMsgMine ? "is-mine" : ""
                    }`}
                  >
                    <header className="msg-header">
                      <strong className="msg-author">
                        {isSysUpdate
                          ? "📢 Project Update"
                          : message.author || (isMsgMine ? "You" : "Member")}
                      </strong>

                      {isSysUpdate ? (
                        <span className="msg-badge update-badge">Update</span>
                      ) : isMsgCreator ? (
                        <span className="msg-badge creator-badge">👑 Creator</span>
                      ) : (
                        <span className="msg-badge follower-badge">Follower</span>
                      )}
                    </header>

                    {/* Quoted parent message if this is a reply */}
                    {message.replyTo ? (
                      <div className="work-group-reply-quote">
                        <span className="reply-quote-author">
                          ↩ Replying to {message.replyTo.author}:
                        </span>
                        <p className="reply-quote-text">{message.replyTo.text}</p>
                      </div>
                    ) : null}

                    <p className="msg-body">{message.text}</p>

                    {!isSysUpdate ? (
                      <div className="msg-actions">
                        <button
                          type="button"
                          className="msg-reply-btn"
                          onClick={() => setReplyingTo(message)}
                        >
                          ↩ Reply
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Replying Preview Banner */}
          {replyingTo ? (
            <div className="work-group-reply-bar">
              <span className="reply-bar-text">
                Replying to <strong>{replyingTo.author}</strong>: &quot;
                {replyingTo.text.slice(0, 45)}
                {replyingTo.text.length > 45 ? "..." : ""}&quot;
              </span>
              <button
                type="button"
                className="reply-bar-close"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
              >
                ×
              </button>
            </div>
          ) : null}

          <form className="work-group-compose" onSubmit={sendMessage}>
            {isCreator ? (
              <label className="update-toggle-label" title="Post message as an official project update">
                <input
                  type="checkbox"
                  checked={isUpdate}
                  onChange={(e) => setIsUpdate(e.target.checked)}
                />
                <span>Update</span>
              </label>
            ) : null}
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder={
                replyingTo
                  ? `Reply to ${replyingTo.author}...`
                  : isUpdate
                  ? "Post a project update..."
                  : "Message project group..."
              }
              aria-label="Message the project group"
            />
            <button type="submit" disabled={!draft.trim()}>
              {isUpdate ? "Post Update" : replyingTo ? "Reply" : "Send"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
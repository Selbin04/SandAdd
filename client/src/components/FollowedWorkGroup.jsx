import { useEffect, useState } from "react";
import {
  addFollowedWorkMessage,
  getFollowedWorkGroup,
} from "../lib/followingStore.js";
import { readAuthorProfile } from "../lib/socialFeed.js";
import "./FollowedWorkGroup.css";

export default function FollowedWorkGroup({ originId }) {
  const [group, setGroup] = useState(() => getFollowedWorkGroup(originId));
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(3);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const refresh = () => setGroup(getFollowedWorkGroup(originId));
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
  }, [originId]);

  const sendMessage = (event) => {
    event.preventDefault();
    const updated = addFollowedWorkMessage(originId, readAuthorProfile(), draft);
    if (updated) {
      setGroup(updated);
      setDraft("");
    }
  };

  if (!group) return null;

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
        <span className="work-group-initial" aria-hidden="true">{group.initial}</span>
        <span className="work-group-trigger-copy">
          <strong>{group.name}</strong>
          <small>{group.role || "Member"} · {group.members?.length || 1} member{group.members?.length === 1 ? "" : "s"}</small>
        </span>
        {unseenCount > 0 ? (
          <span className="work-group-notification" aria-hidden="true">
            {unseenCount}
          </span>
        ) : null}
        <span className="work-group-chevron" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <section className="work-group-panel" aria-label={`${group.name} messages`}>
          <header className="work-group-panel-head">
            <div>
              <strong>{group.name}</strong>
              <span>{group.status}</span>
            </div>
            <button type="button" aria-label="Close group messages" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="work-group-messages" aria-live="polite">
            {(group.messages || []).map((message) => (
              <article
                key={message.id}
                className={`work-group-message${message.from === "update" ? " is-update" : ""}${message.from === "me" ? " is-mine" : ""}`}
              >
                <strong>{message.from === "update" ? "Project update" : message.author || (message.from === "me" ? "You" : group.creatorName || "Project group")}</strong>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          <form className="work-group-compose" onSubmit={sendMessage}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              placeholder="Message the project group"
              aria-label="Message the project group"
            />
            <button type="submit" disabled={!draft.trim()}>Send</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
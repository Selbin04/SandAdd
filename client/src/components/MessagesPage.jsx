import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hydrateSocialFeeds, loadSharedMessages } from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
import { WorkSourceControl } from "./SourceMedia.jsx";
import "./MessagesPage.css";

const SANDADD_ID = "sandadd";

const THREADS = [
  {
    id: "1",
    initial: "A",
    name: "Alex",
    preview: "Nice pour today — how long was the session?",
    time: "2m",
    unread: true,
    status: "Direct message",
    messages: [
      { id: "a1", from: "them", text: "Nice pour today — how long was the session?" },
      { id: "a2", from: "me", text: "Still pouring — check back when this hourglass fills." },
    ],
  },
  {
    id: "2",
    initial: "M",
    name: "Maya",
    preview: "Join Deep Work tomorrow morning?",
    time: "1h",
    unread: true,
    status: "Direct message",
    messages: [
      { id: "m1", from: "them", text: "Join Deep Work tomorrow morning?" },
      { id: "m2", from: "me", text: "Still pouring — check back when this hourglass fills." },
    ],
  },
  {
    id: "3",
    initial: "J",
    name: "Jordan",
    preview: "Shipped the draft. Thanks for the nudge.",
    time: "Yesterday",
    unread: false,
    status: "Direct message",
    messages: [
      { id: "j1", from: "them", text: "Shipped the draft. Thanks for the nudge." },
      { id: "j2", from: "me", text: "Still pouring — check back when this hourglass fills." },
    ],
  },
  {
    id: SANDADD_ID,
    name: "SandAdd",
    preview: "Got feedback? Tell us anything — we read every message.",
    time: "Official",
    unread: true,
    official: true,
    status: "Official · Feedback & support",
    messages: [
      {
        id: "sa1",
        from: "them",
        text: "Hey — this is SandAdd. Talk to us directly here.",
      },
      {
        id: "sa2",
        from: "them",
        text: "Bug, idea, or how pouring feels in real work? Send feedback anytime. We read every message.",
      },
    ],
  },
];

function ThreadAvatar({ thread }) {
  if (thread.official) {
    return (
      <img
        className="messages-avatar messages-avatar-logo"
        src="/sandadd-mark.png?v=exact4"
        alt=""
      />
    );
  }
  return (
    <span className="messages-avatar" aria-hidden="true">
      {thread.initial}
    </span>
  );
}

function MessageBubble({ msg, onFollowProject }) {
  const [isAdding, setIsAdding] = useState(false);
  const [followError, setFollowError] = useState("");
  const works = Array.isArray(msg.works)
    ? msg.works
    : Array.isArray(msg.sharedProject?.works)
      ? msg.sharedProject.works
      : [];
  const projectTitle = msg.sharedProject?.name || msg.projectName;
  const shareMode = msg.shareMode || msg.sharedProject?.shareMode;
  const isLiveShare =
    msg.sharedProject?.live ||
    msg.sharedProject?.originId ||
    String(msg.sharedProject?.templateId || "").startsWith("live-");
  const isLiveFollow =
    shareMode === "follow" &&
    Boolean(isLiveShare);
  const canAddToProgress = Boolean(msg.sharedProject && onFollowProject);
  const progressActionLabel =
    shareMode === "assign"
      ? "Contribute"
      : isLiveFollow
        ? "Follow in Progress"
        : "Add to Progress";

  const followProject = async () => {
    if (!onFollowProject || !msg.sharedProject) return;
    setIsAdding(true);
    setFollowError("");
    try {
      await onFollowProject(msg.sharedProject, {
        name: msg.authorName || msg.sharedProject.authorName || "Work Creator",
        handle: msg.authorHandle || msg.sharedProject.authorHandle || "",
      });
    } catch (error) {
      setFollowError(error.message || "Could not add work to Progress.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className={`messages-bubble-wrap ${msg.from === "me" ? "is-mine" : "is-theirs"}`}>
      <p className={`messages-bubble ${msg.from === "me" ? "is-mine" : "is-theirs"}`}>
        {msg.text}
      </p>
      {projectTitle || works.length > 0 ? (
        <div className="messages-works">
          {projectTitle ? (
            <p className="messages-works-project">{projectTitle}</p>
          ) : null}
          {works.length > 0 ? (
            <>
              <p className="messages-works-label">Tasks</p>
              <ul>
                {works.map((w) => {
                  const showCheck = w.hasCheckbox !== false;
                  return (
                    <li key={w.id || w.text} className={w.done ? "is-done" : ""}>
                      {showCheck ? (
                        <span aria-hidden="true">{w.done ? "✓" : "○"}</span>
                      ) : null}
                      <span className="messages-work-text">{w.text}</span>
                      <WorkSourceControl work={w} />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {canAddToProgress ? (
            <button
              type="button"
              className="messages-works-follow"
              disabled={isAdding}
              onClick={followProject}
            >
              {isAdding ? "Adding…" : progressActionLabel}
            </button>
          ) : null}
          {followError ? <p className="messages-works-follow-error">{followError}</p> : null}
        </div>
      ) : null}
      <ProofMedia proof={msg.proof} className="messages-proof" />
    </div>
  );
}

export default function MessagesPage({ initialThreadId = null, onFollowProject = null }) {
  const [activeId, setActiveId] = useState(initialThreadId || SANDADD_ID);
  const [draft, setDraft] = useState("");
  const [extraByThread, setExtraByThread] = useState({});
  const bubblesRef = useRef(null);
  const endRef = useRef(null);
  const [sharedByThread, setSharedByThread] = useState(() => {
    const start = {};
    THREADS.forEach((t) => {
      start[t.id] = loadSharedMessages(t.id);
    });
    return start;
  });

  useEffect(() => {
    if (initialThreadId) setActiveId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    let alive = true;
    hydrateSocialFeeds().then((data) => {
      if (!alive) return;
      const map = data.messageShares || {};
      setSharedByThread((prev) => {
        const next = { ...prev };
        THREADS.forEach((t) => {
          next[t.id] = Array.isArray(map[t.id]) ? map[t.id] : loadSharedMessages(t.id);
        });
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [activeId]);

  const active = THREADS.find((t) => t.id === activeId) || THREADS[0];
  const extras = extraByThread[activeId] || [];
  const shared = sharedByThread[activeId] || [];
  const messageTime = (msg) => {
    if (msg?.createdAt) {
      const t = Date.parse(msg.createdAt);
      if (!Number.isNaN(t)) return t;
    }
    const digits = String(msg?.id || "").replace(/\D/g, "");
    const fromId = digits ? Number(digits.slice(-13)) : 0;
    return Number.isFinite(fromId) ? fromId : 0;
  };
  const messages = [
    ...(active.messages || []),
    ...[...extras, ...shared].sort((a, b) => messageTime(a) - messageTime(b)),
  ];
  const messagesKey = messages.map((m) => m.id).join("|");

  useLayoutEffect(() => {
    const el = bubblesRef.current;
    const end = endRef.current;
    const jump = () => {
      if (el) el.scrollTop = el.scrollHeight;
      end?.scrollIntoView({ block: "end" });
    };
    jump();
    const frame = requestAnimationFrame(jump);
    return () => cancelAnimationFrame(frame);
  }, [activeId, messagesKey]);

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const now = Date.now();
    setExtraByThread((prev) => ({
      ...prev,
      [activeId]: [
        ...(prev[activeId] || []),
        {
          id: `local-${now}`,
          from: "me",
          text,
          createdAt: new Date(now).toISOString(),
        },
      ],
    }));
    setDraft("");
  };

  return (
    <section className="messages-page" aria-label="Messages">
      <aside className="messages-list" aria-label="Conversations">
        {THREADS.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`messages-thread ${activeId === thread.id ? "is-active" : ""} ${thread.unread ? "is-unread" : ""} ${thread.official ? "is-official" : ""}`}
            onClick={() => setActiveId(thread.id)}
          >
            <ThreadAvatar thread={thread} />
            <span className="messages-thread-body">
              <span className="messages-thread-top">
                <strong>
                  {thread.name}
                  {thread.official ? <span className="messages-official-badge">Team</span> : null}
                </strong>
                <time>{thread.time}</time>
              </span>
              <span className="messages-preview">{thread.preview}</span>
            </span>
          </button>
        ))}
      </aside>

      <div className="messages-chat" aria-label={`Chat with ${active.name}`}>
        <header className="messages-chat-head">
          <ThreadAvatar thread={active} />
          <div>
            <strong>
              {active.name}
              {active.official ? <span className="messages-official-badge">Team</span> : null}
            </strong>
            <span className="messages-status">{active.status}</span>
          </div>
        </header>

        <div className="messages-bubbles" ref={bubblesRef}>
          <div className="messages-bubbles-spacer" aria-hidden="true" />
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onFollowProject={onFollowProject} />
          ))}
          <div ref={endRef} aria-hidden="true" />
        </div>

        <form className="messages-compose" onSubmit={send}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              active.official
                ? "Send feedback to SandAdd…"
                : "Write a message…"
            }
            aria-label={active.official ? "Feedback to SandAdd" : "Message"}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </section>
  );
}

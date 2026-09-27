import { useEffect, useMemo, useRef, useState } from "react";
import {
  addGroupPost,
  addUserPost,
  fileToProof,
  hydrateSocialFeeds,
  loadGroupPosts,
  loadUserPosts,
  PROOF_ACCEPT,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
import "./SocialPage.css";

const SAMPLE_FEED = [
  {
    id: "1",
    initial: "A",
    name: "Alex",
    meta: "poured 45 min · Design system",
    body: "Closed the gap on the logo mark and shipped the navbar refresh.",
  },
  {
    id: "2",
    initial: "M",
    name: "Maya",
    meta: "poured 2 hr · API rewrite",
    body: "Three important projects cleared before noon. Hourglass never lied.",
  },
  {
    id: "3",
    initial: "J",
    name: "Jordan",
    meta: "poured 20 min · Writing",
    body: "Short session, one finished draft. Showing up counts.",
  },
];

const GROUPS = [
  {
    id: "g1",
    name: "Morning Pour",
    members: 12,
    blurb: "Daily check-ins before noon.",
    posts: [
      {
        id: "g1p1",
        initial: "R",
        name: "Rina",
        meta: "poured 30 min · today",
        body: "Morning pour done. Cleared two Important items before coffee.",
      },
      {
        id: "g1p2",
        initial: "K",
        name: "Kai",
        meta: "poured 15 min · today",
        body: "Short session, but I showed up. Streak intact.",
      },
    ],
  },
  {
    id: "g2",
    name: "Deep Work",
    members: 8,
    blurb: "Long pours, few distractions.",
    posts: [
      {
        id: "g2p1",
        initial: "S",
        name: "Sam",
        meta: "poured 2 hr · API",
        body: "Phone off. Two hours straight. Deep Work works.",
      },
      {
        id: "g2p2",
        initial: "L",
        name: "Leah",
        meta: "poured 90 min · writing",
        body: "Draft chapter finished. No tabs, no chat.",
      },
    ],
  },
  {
    id: "g3",
    name: "Ship Club",
    members: 21,
    blurb: "Finish something every week.",
    posts: [
      {
        id: "g3p1",
        initial: "N",
        name: "Nora",
        meta: "shipped · landing page",
        body: "Shipped the hero this week. Proof attached in my head.",
      },
      {
        id: "g3p2",
        initial: "T",
        name: "Theo",
        meta: "shipped · bugfix",
        body: "Closed the pour glitch. Another week, another ship.",
      },
    ],
  },
];

function IconLike({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {filled ? (
        <path
          fill="currentColor"
          d="M12 21s-6.7-4.3-9.3-8.2C.7 9.9 1.5 6.2 4.6 5.1c1.9-.7 4-.2 5.3 1.3L12 8.2l2.1-1.8c1.3-1.5 3.4-2 5.3-1.3 3.1 1.1 3.9 4.8 1.9 7.7C18.7 16.7 12 21 12 21z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          d="M12 20.5s-6.2-4-8.7-7.6C1.4 10.2 2.1 6.8 4.9 5.8c1.7-.6 3.6-.1 4.8 1.2L12 9.2l2.3-2.2c1.2-1.3 3.1-1.8 4.8-1.2 2.8 1 3.5 4.4 1.6 7.1C18.2 16.5 12 20.5 12 20.5z"
        />
      )}
    </svg>
  );
}

function IconComment() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        d="M8 11.2 15.8 6.6M8 12.8l7.8 4.6"
      />
    </svg>
  );
}

function IconReport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M6 4.5h9.5L13 9l2.5 4.5H6V20"
      />
    </svg>
  );
}

function PostActions({ postId, liked, onLike }) {
  return (
    <div className="social-actions">
      <button
        type="button"
        className={liked ? "is-liked" : ""}
        aria-label={liked ? "Unlike" : "Like"}
        aria-pressed={liked}
        onClick={() => onLike(postId)}
      >
        <IconLike filled={liked} />
      </button>
      <button type="button" aria-label="Comment">
        <IconComment />
      </button>
      <button type="button" aria-label="Share">
        <IconShare />
      </button>
      <button type="button" className="is-report" aria-label="Report">
        <IconReport />
      </button>
    </div>
  );
}

function FeedCard({ item, liked, onLike }) {
  return (
    <article className="social-card">
      <div className="social-card-top">
        <span className="social-avatar" aria-hidden="true">
          {item.initial}
        </span>
        <div>
          <strong>{item.name}</strong>
          <span className="social-meta">{item.meta}</span>
        </div>
      </div>
      <p>{item.body}</p>
      <ProofMedia proof={item.proof} />
      <PostActions postId={item.id} liked={liked} onLike={onLike} />
    </article>
  );
}

export default function SocialPage({ initialGroupId = null }) {
  const [section, setSection] = useState(initialGroupId ? "groups" : "view");
  const [openGroupId, setOpenGroupId] = useState(initialGroupId);
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [groupUserPosts, setGroupUserPosts] = useState(() =>
    initialGroupId ? loadGroupPosts(initialGroupId) : []
  );
  const [viewPosts, setViewPosts] = useState(() => loadUserPosts());
  const [draft, setDraft] = useState("");
  const [proof, setProof] = useState(null);
  const [proofName, setProofName] = useState("");
  const [postError, setPostError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    hydrateSocialFeeds().then((data) => {
      if (!alive) return;
      setViewPosts(data.userPosts || []);
      if (openGroupId) {
        const list = data.groupPosts?.[openGroupId];
        setGroupUserPosts(Array.isArray(list) ? list : []);
      }
    });
    return () => {
      alive = false;
    };
  }, [openGroupId]);

  useEffect(() => {
    setGroupUserPosts(openGroupId ? loadGroupPosts(openGroupId) : []);
    setDraft("");
    setProof(null);
    setProofName("");
    setPostError("");
  }, [openGroupId]);

  useEffect(() => {
    if (section === "view" && !openGroupId) {
      setViewPosts(loadUserPosts());
      setDraft("");
      setProof(null);
      setProofName("");
      setPostError("");
    }
  }, [section, openGroupId]);

  const feed = useMemo(() => [...viewPosts, ...SAMPLE_FEED], [viewPosts]);
  const openGroup = GROUPS.find((g) => g.id === openGroupId) || null;
  const groupFeed = useMemo(
    () => [...groupUserPosts, ...(openGroup?.posts || [])],
    [groupUserPosts, openGroup]
  );

  const toggleLike = (id) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goGroupsList = () => {
    setSection("groups");
    setOpenGroupId(null);
  };

  const onProofChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPostError("");
    setBusy(true);
    try {
      const next = await fileToProof(file);
      setProof(next);
      setProofName(next?.name || "");
    } catch (err) {
      setProof(null);
      setProofName("");
      setPostError(err.message || "Could not attach file");
    } finally {
      setBusy(false);
    }
  };

  const submitViewPost = (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) {
      setPostError("Write something to post.");
      return;
    }
    const author = readAuthorProfile();
    const post = {
      id: `view-${Date.now()}`,
      name: author.name,
      handle: author.handle,
      initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
      meta: "just now",
      body,
      proof: proof || null,
      createdAt: new Date().toISOString(),
      isUser: true,
    };
    setViewPosts(addUserPost(post));
    setDraft("");
    setProof(null);
    setProofName("");
    setPostError("");
  };

  const submitGroupPost = (e) => {
    e.preventDefault();
    if (!openGroupId || !openGroup) return;
    const body = draft.trim();
    if (!body) {
      setPostError("Write something to post.");
      return;
    }
    const author = readAuthorProfile();
    const post = {
      id: `group-${Date.now()}`,
      name: author.name,
      handle: author.handle,
      initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
      meta: `in ${openGroup.name}`,
      body,
      proof: proof || null,
      createdAt: new Date().toISOString(),
      isUser: true,
      groupId: openGroupId,
      groupName: openGroup.name,
    };
    setGroupUserPosts(addGroupPost(openGroupId, post));
    setDraft("");
    setProof(null);
    setProofName("");
    setPostError("");
  };

  return (
    <section className="social-page" aria-label="Social">
      {!openGroup && (
        <div className="social-tabs" role="tablist" aria-label="Social sections">
          <button
            type="button"
            role="tab"
            id="social-tab-view"
            aria-selected={section === "view"}
            aria-controls="social-panel-view"
            className={section === "view" ? "is-active" : ""}
            onClick={() => {
              setSection("view");
              setOpenGroupId(null);
            }}
          >
            View
          </button>
          <button
            type="button"
            role="tab"
            id="social-tab-groups"
            aria-selected={section === "groups"}
            aria-controls="social-panel-groups"
            className={section === "groups" ? "is-active" : ""}
            onClick={goGroupsList}
          >
            Groups
          </button>
        </div>
      )}

      {openGroup ? (
        <div className="social-group-page" aria-label={`${openGroup.name} group`}>
          <button type="button" className="social-group-back" onClick={goGroupsList}>
            ← Groups
          </button>
          <header className="social-group-hero">
            <span className="social-avatar social-avatar-group" aria-hidden="true">
              {openGroup.name.slice(0, 1)}
            </span>
            <div>
              <h1>{openGroup.name}</h1>
              <p className="social-meta">
                {openGroup.members} members · {openGroup.blurb}
              </p>
            </div>
          </header>
          <p className="social-group-dummy">Group feed</p>
          <form className="social-group-compose" onSubmit={submitGroupPost}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Post in ${openGroup.name}…`}
              rows={3}
              maxLength={280}
              aria-label="Write a group post"
            />
            <div className="social-group-compose-actions">
              <input
                ref={fileRef}
                type="file"
                accept={PROOF_ACCEPT}
                hidden
                onChange={onProofChange}
              />
              <button
                type="button"
                className="social-group-attach"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {proofName ? "Change file" : "Attach"}
              </button>
              <button type="submit" className="social-group-post-btn" disabled={busy}>
                Post
              </button>
            </div>
            {proofName ? <p className="social-group-attach-name">{proofName}</p> : null}
            <ProofMedia proof={proof} className="social-group-attach-preview" />
            {postError ? <p className="social-group-post-error">{postError}</p> : null}
          </form>
          <div className="social-feed">
            {groupFeed.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                liked={likedIds.has(item.id)}
                onLike={toggleLike}
              />
            ))}
          </div>
        </div>
      ) : section === "view" ? (
        <div
          className="social-view"
          role="tabpanel"
          id="social-panel-view"
          aria-labelledby="social-tab-view"
        >
          <form className="social-group-compose" onSubmit={submitViewPost}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Share an update…"
              rows={3}
              maxLength={280}
              aria-label="Write a post"
            />
            <div className="social-group-compose-actions">
              <input
                ref={fileRef}
                type="file"
                accept={PROOF_ACCEPT}
                hidden
                onChange={onProofChange}
              />
              <button
                type="button"
                className="social-group-attach"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {proofName ? "Change file" : "Attach"}
              </button>
              <button type="submit" className="social-group-post-btn" disabled={busy}>
                Post
              </button>
            </div>
            {proofName ? <p className="social-group-attach-name">{proofName}</p> : null}
            <ProofMedia proof={proof} className="social-group-attach-preview" />
            {postError ? <p className="social-group-post-error">{postError}</p> : null}
          </form>
          <div className="social-feed">
            {feed.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                liked={likedIds.has(item.id)}
                onLike={toggleLike}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="social-groups"
          role="tabpanel"
          id="social-panel-groups"
          aria-labelledby="social-tab-groups"
        >
          {GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className="social-card social-group-open"
              onClick={() => setOpenGroupId(group.id)}
            >
              <div className="social-card-top">
                <span className="social-avatar social-avatar-group" aria-hidden="true">
                  {group.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{group.name}</strong>
                  <span className="social-meta">{group.members} members</span>
                </div>
              </div>
              <p>{group.blurb}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

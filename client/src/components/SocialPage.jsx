import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addGroupPost,
  addUserPost,
  buildSharedProject,
  createCustomGroup,
  fileToProof,
  hydrateSocialFeeds,
  loadAddedTemplateIds,
  loadCustomGroups,
  loadGroupPosts,
  loadUserPosts,
  markTemplateAdded,
  PROOF_ACCEPT,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
import {
  WorkSourceControl,
  normalizeSourceUrl,
  workHasSource,
} from "./SourceMedia.jsx";
import "./SocialPage.css";

function newDraftWork() {
  return {
    id: `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: "",
    source: "",
    sourceProof: null,
  };
}

const SAMPLE_FEED = [
  {
    id: "1",
    initial: "A",
    name: "Alex",
    handle: "alex",
    meta: "poured 45 min · Design system",
    body: "Closed the gap on the logo mark and shipped the navbar refresh.",
  },
  {
    id: "2",
    initial: "M",
    name: "Maya",
    handle: "maya",
    meta: "poured 2 hr · API rewrite",
    body: "Three important works cleared before noon. Hourglass never lied.",
  },
  {
    id: "3",
    initial: "J",
    name: "Jordan",
    handle: "jordan",
    meta: "poured 20 min · Writing",
    body: "Short session, one finished draft. Showing up counts.",
  },
];

const SEED_GROUPS = [
  {
    id: "g1",
    name: "Tech Placement Info",
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
    name: "CSE S7 B",
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

function toDisplayGroup(g) {
  return {
    id: g.id,
    name: g.name,
    members: g.members ?? 1,
    blurb: g.blurb || "Your group",
    posts: Array.isArray(g.posts) ? g.posts : [],
    isCustom: Boolean(g.isCustom),
  };
}

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

function FeedCard({
  item,
  liked,
  onLike,
  onAddProject,
  addedTemplateIds,
  addingTemplateId,
  onOpenProfile,
}) {
  const shared = item.sharedProject;
  const works = Array.isArray(shared?.works)
    ? shared.works
    : Array.isArray(item.works)
      ? item.works
      : [];
  const alreadyAdded =
    shared?.templateId && addedTemplateIds?.has(String(shared.templateId));
  const adding =
    shared?.templateId && addingTemplateId === String(shared.templateId);

  const openProfile = () => {
    onOpenProfile?.({
      postId: item.id,
      name: item.name || "User",
      handle: item.handle || "",
      initial:
        item.initial ||
        String(item.name || "U")
          .trim()
          .slice(0, 1)
          .toUpperCase() ||
        "U",
      avatar: item.avatar || "",
    });
  };

  return (
    <article className="social-card">
      <div className="social-card-top">
        <button
          type="button"
          className="social-avatar social-avatar-btn"
          onClick={openProfile}
          aria-label={`Open ${item.name || "user"} profile`}
        >
          {item.avatar ? (
            <img src={item.avatar} alt="" />
          ) : (
            item.initial
          )}
        </button>
        <div>
          <button
            type="button"
            className="social-author-btn"
            onClick={openProfile}
          >
            <strong>{item.name}</strong>
          </button>
          <span className="social-meta">{item.meta}</span>
        </div>
      </div>
      <p>{item.body}</p>
      {works.length > 0 || shared ? (
        <div className="social-shared-project">
          {shared?.name ? (
            <>
              <p className="social-shared-project-label">
                {shared.shareMode === "assign"
                  ? "Assigned work"
                  : shared.live || shared.originId
                    ? "Follow this work"
                    : "Shared work"}
              </p>
              <strong className="social-shared-project-name">{shared.name}</strong>
            </>
          ) : item.projectName ? (
            <>
              <p className="social-shared-project-label">Work</p>
              <strong className="social-shared-project-name">{item.projectName}</strong>
            </>
          ) : null}
          {works.length > 0 ? (
            <>
              <p className="social-shared-project-label is-works">
                What the works to do
              </p>
              <ul className="social-shared-project-works">
                {works.map((w) => (
                  <li
                    key={w.id || w.text}
                    className={`social-work-row ${w.done ? "is-done" : ""}`}
                  >
                    <div className="social-work-main">
                      <span className="social-work-tick" aria-hidden="true">
                        {w.done ? "✓" : "○"}
                      </span>
                      <span className="social-work-text">{w.text}</span>
                      {workHasSource(w) ? <WorkSourceControl work={w} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : shared?.live || shared?.originId ? (
            <p className="social-shared-project-label is-works">
              Tasks will sync when the creator adds them
            </p>
          ) : null}
          {shared ? (
            <button
              type="button"
              className="social-shared-project-add"
              disabled={alreadyAdded || adding || !onAddProject}
              onClick={() => onAddProject?.(shared)}
            >
              {alreadyAdded
                ? "Added to Progress"
                : adding
                  ? "Adding…"
                  : shared.shareMode === "assign"
                    ? "Accept assignment"
                    : shared.live || shared.originId
                      ? "Follow in Progress"
                      : "Add to Progress"}
            </button>
          ) : null}
        </div>
      ) : null}
      <ProofMedia proof={item.proof} />
      <PostActions postId={item.id} liked={liked} onLike={onLike} />
    </article>
  );
}

function ViewProfilePanel({ profile, posts, onClose, style, fixed = false }) {
  if (!profile) return null;
  const initial =
    profile.initial ||
    String(profile.name || "U")
      .trim()
      .slice(0, 1)
      .toUpperCase() ||
    "U";
  const handle =
    profile.handle ||
    String(profile.name || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) ||
    "user";

  return (
    <aside
      className={`social-view-profile${fixed ? " is-fixed" : ""}`}
      aria-label={`${profile.name} profile`}
      style={style}
    >
      <header className="social-view-profile-head">
        <h2>Profile</h2>
        <button type="button" className="social-view-profile-close" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="social-view-profile-hero">
        <span className="social-view-profile-avatar" aria-hidden="true">
          {profile.avatar ? <img src={profile.avatar} alt="" /> : initial}
        </span>
        <div>
          <h3>{profile.name}</h3>
          <p className="social-view-profile-handle">@{handle}</p>
          <div className="social-view-profile-stats">
            <span>
              <strong>128</strong> followers
            </span>
            <span>
              <strong>86</strong> following
            </span>
          </div>
        </div>
      </div>
      <h4 className="social-view-profile-posts-title">View posts</h4>
      {posts.length === 0 ? (
        <p className="social-view-profile-empty">No posts from this profile</p>
      ) : (
        <ul className="social-view-profile-posts">
          {posts.map((post) => (
            <li key={post.id}>
              <p className="social-meta">{post.meta}</p>
              <p>{post.body}</p>
              <ProofMedia proof={post.proof} className="social-view-profile-proof" />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export default function SocialPage({
  initialGroupId = null,
  onAddSharedProject = null,
}) {
  const [section, setSection] = useState(initialGroupId ? "groups" : "view");
  const [openGroupId, setOpenGroupId] = useState(initialGroupId);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const pageRef = useRef(null);
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
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [draftWorks, setDraftWorks] = useState(() => [newDraftWork()]);
  const [sharedProject, setSharedProject] = useState(null);
  const [workFileBusyId, setWorkFileBusyId] = useState(null);
  const workFileRef = useRef(null);
  const pendingWorkFileIdRef = useRef(null);
  const [addedTemplateIds, setAddedTemplateIds] = useState(
    () => new Set(loadAddedTemplateIds())
  );

  useEffect(() => {
    const refresh = () => setAddedTemplateIds(new Set(loadAddedTemplateIds()));
    const onStorage = (e) => {
      if (e.key === "sandadd.addedProjectTemplates") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("sandadd:templates-changed", refresh);
    // Refresh when returning to Social so delete-from-Progress is reflected
    refresh();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sandadd:templates-changed", refresh);
    };
  }, []);
  const [addingTemplateId, setAddingTemplateId] = useState(null);
  const [customGroups, setCustomGroups] = useState(() =>
    loadCustomGroups().map(toDisplayGroup)
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupBlurb, setNewGroupBlurb] = useState("");
  const [groupCreateError, setGroupCreateError] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    hydrateSocialFeeds().then((data) => {
      if (!alive) return;
      setViewPosts(data.userPosts || []);
      if (openGroupId) {
        const list = data.groupPosts?.[openGroupId];
        setGroupUserPosts(Array.isArray(list) ? list : loadGroupPosts(openGroupId));
      } else {
        setGroupUserPosts([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [section, openGroupId]);

  useEffect(() => {
    setDraft("");
    setProof(null);
    setProofName("");
    setPostError("");
    setShowProjectForm(false);
    setProjectName("");
    setDraftWorks([newDraftWork()]);
    setSharedProject(null);
  }, [openGroupId, section]);

  const clearComposeExtras = () => {
    setProof(null);
    setProofName("");
    setSharedProject(null);
    setShowProjectForm(false);
    setProjectName("");
    setDraftWorks([newDraftWork()]);
    setPostError("");
  };

  const resetProjectCompose = () => {
    setSharedProject(null);
    setProjectName("");
    setDraftWorks([newDraftWork()]);
    setShowProjectForm(false);
  };

  const applyProjectToCompose = () => {
    setPostError("");
    try {
      const next = buildSharedProject({
        name: projectName,
        works: draftWorks
          .map((w) => ({
            id: w.id,
            text: w.text,
            source: normalizeSourceUrl(w.source),
            sourceProof: w.sourceProof,
          }))
          .filter((w) => String(w.text || "").trim()),
      });
      setSharedProject(next);
      setShowProjectForm(false);
    } catch (err) {
      setPostError(err.message || "Could not add work");
    }
  };

  const updateDraftWork = (id, patch) => {
    setDraftWorks((list) =>
      list.map((w) => (w.id === id ? { ...w, ...patch } : w))
    );
  };

  const addDraftWork = () => {
    setDraftWorks((list) => [...list, newDraftWork()]);
  };

  const removeDraftWork = (id) => {
    setDraftWorks((list) => {
      const next = list.filter((w) => w.id !== id);
      return next.length ? next : [newDraftWork()];
    });
  };

  const pickWorkFile = (workId) => {
    pendingWorkFileIdRef.current = workId;
    workFileRef.current?.click();
  };

  const onWorkFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const workId = pendingWorkFileIdRef.current;
    pendingWorkFileIdRef.current = null;
    if (!file || !workId) return;
    setWorkFileBusyId(workId);
    setPostError("");
    try {
      const proof = await fileToProof(file);
      updateDraftWork(workId, { sourceProof: proof, source: "" });
    } catch (err) {
      setPostError(err.message || "Could not attach source file");
    } finally {
      setWorkFileBusyId(null);
    }
  };

  const handleAddSharedProject = async (template) => {
    if (!template?.templateId || !onAddSharedProject) return;
    const id = String(template.templateId);
    if (addedTemplateIds.has(id)) return;
    setAddingTemplateId(id);
    setPostError("");
    try {
      await onAddSharedProject(template);
      markTemplateAdded(id);
      setAddedTemplateIds(new Set(loadAddedTemplateIds()));
    } catch (err) {
      setPostError(err.message || "Could not add work to Progress");
    } finally {
      setAddingTemplateId(null);
    }
  };

  const groups = useMemo(
    () => [...customGroups, ...SEED_GROUPS.map(toDisplayGroup)],
    [customGroups]
  );
  const feed = useMemo(() => [...viewPosts, ...SAMPLE_FEED], [viewPosts]);
  const openGroup = groups.find((g) => g.id === openGroupId) || null;
  const profilePosts = useMemo(() => {
    if (!viewingProfile) return [];
    const handle = String(viewingProfile.handle || "")
      .toLowerCase()
      .replace(/^@/, "");
    const name = String(viewingProfile.name || "").trim().toLowerCase();
    return feed.filter((post) => {
      const postHandle = String(post.handle || "")
        .toLowerCase()
        .replace(/^@/, "");
      if (handle && postHandle && postHandle === handle) return true;
      return String(post.name || "").trim().toLowerCase() === name;
    });
  }, [feed, viewingProfile]);
  const groupFeed = useMemo(
    () => [...groupUserPosts, ...(openGroup?.posts || [])],
    [groupUserPosts, openGroup]
  );

  useLayoutEffect(() => {
    if (!viewingProfile?.postId || section !== "view") {
      setProfileAnchor(null);
      return undefined;
    }

    const syncAnchor = () => {
      const page = pageRef.current;
      if (!page) return;
      const row = page.querySelector(
        `.social-feed-row[data-post-id="${viewingProfile.postId}"]`
      );
      if (!row) {
        setProfileAnchor(null);
        return;
      }
      const pageRect = page.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const gap = 16;
      const available = pageRect.left - gap - 12;
      if (available < 200) {
        setProfileAnchor({ mode: "stack" });
        return;
      }
      const width = Math.min(300, available);
      const left = pageRect.left - gap - width;
      const maxHeight = Math.min(520, window.innerHeight - 24);
      const top = Math.min(
        Math.max(12, rowRect.top),
        Math.max(12, window.innerHeight - Math.min(maxHeight, 160))
      );
      setProfileAnchor({
        mode: "side",
        top,
        left,
        width,
        maxHeight,
      });
    };

    syncAnchor();
    window.addEventListener("scroll", syncAnchor, true);
    window.addEventListener("resize", syncAnchor);
    return () => {
      window.removeEventListener("scroll", syncAnchor, true);
      window.removeEventListener("resize", syncAnchor);
    };
  }, [viewingProfile, section, feed]);

  const toggleLike = (id) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goGroupsList = () => {
    setViewingProfile(null);
    setSection("groups");
    setOpenGroupId(null);
  };

  const openCreateGroup = () => {
    setShowCreateGroup(true);
    setGroupCreateError("");
  };

  const cancelCreateGroup = () => {
    setShowCreateGroup(false);
    setNewGroupName("");
    setNewGroupBlurb("");
    setGroupCreateError("");
  };

  const submitCreateGroup = (e) => {
    e.preventDefault();
    setGroupCreateError("");
    try {
      const group = createCustomGroup({
        name: newGroupName,
        blurb: newGroupBlurb,
      });
      setCustomGroups(loadCustomGroups().map(toDisplayGroup));
      setNewGroupName("");
      setNewGroupBlurb("");
      setGroupCreateError("");
      setShowCreateGroup(false);
      setOpenGroupId(group.id);
      setSection("groups");
    } catch (err) {
      setGroupCreateError(err.message || "Could not create group");
    }
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

  const resolveWorksForPost = (projectShare) => {
    if (!projectShare) return { works: [], sharedProject: null };
    let works = Array.isArray(projectShare.works) ? [...projectShare.works] : [];
    let nextShare = { ...projectShare, works };
    if (works.length > 0) {
      const includeWorks = window.confirm(
        'Include “What the works to do” in this post?'
      );
      if (!includeWorks) {
        // Declined → no works list and no Add to Progress
        return { works: [], sharedProject: null };
      }
    } else {
      // No works to share → don't offer Add to Progress
      nextShare = null;
    }
    return { works, sharedProject: nextShare };
  };

  const submitViewPost = (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !sharedProject) {
      setPostError("Write something or add a work to post.");
      return;
    }
    const author = readAuthorProfile();
    const attachedName = sharedProject?.name || "";
    const { works, sharedProject: projectShare } = resolveWorksForPost(sharedProject);
    const post = {
      id: `view-${Date.now()}`,
      name: author.name,
      handle: author.handle,
      initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
      meta: projectShare ? "shared a work · just now" : "just now",
      body: body || (attachedName ? `Shared work: ${attachedName}` : ""),
      proof: proof || null,
      works,
      sharedProject: projectShare,
      projectName: projectShare ? attachedName : "",
      createdAt: new Date().toISOString(),
      isUser: true,
      kind: "post",
    };
    setViewPosts(addUserPost(post));
    setDraft("");
    clearComposeExtras();
  };

  const submitGroupPost = (e) => {
    e.preventDefault();
    if (!openGroupId || !openGroup) return;
    const body = draft.trim();
    if (!body && !sharedProject) {
      setPostError("Write something or add a work to post.");
      return;
    }
    const author = readAuthorProfile();
    const attachedName = sharedProject?.name || "";
    const { works, sharedProject: projectShare } = resolveWorksForPost(sharedProject);
    const post = {
      id: `group-${Date.now()}`,
      name: author.name,
      handle: author.handle,
      initial: author.name.trim().slice(0, 1).toUpperCase() || "U",
      meta: projectShare
        ? `shared a work · ${openGroup.name}`
        : `in ${openGroup.name}`,
      body: body || (attachedName ? `Shared work: ${attachedName}` : ""),
      proof: proof || null,
      works,
      sharedProject: projectShare,
      projectName: projectShare ? attachedName : "",
      createdAt: new Date().toISOString(),
      isUser: true,
      groupId: openGroupId,
      groupName: openGroup.name,
      kind: "post",
    };
    setGroupUserPosts(addGroupPost(openGroupId, post));
    setDraft("");
    clearComposeExtras();
  };

  const composeExtras = (
    <>
      <button
        type="button"
        className={`social-group-attach ${showProjectForm || sharedProject ? "is-active" : ""}`}
        disabled={busy}
        onClick={() => {
          setPostError("");
          if (sharedProject) {
            resetProjectCompose();
            return;
          }
          setShowProjectForm((v) => !v);
        }}
      >
        {sharedProject ? "Remove work" : "Work"}
      </button>
    </>
  );

  const projectComposePanel = showProjectForm ? (
    <div className="social-project-compose">
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Work name"
        maxLength={80}
        aria-label="Work name"
      />
      <p className="social-project-works-label">
        What the works to do
      </p>
      <ul className="social-project-works-edit">
        {draftWorks.map((work, index) => (
          <li key={work.id}>
            <div className="social-project-work-row">
              <input
                type="text"
                value={work.text}
                onChange={(e) => updateDraftWork(work.id, { text: e.target.value })}
                placeholder={`Work ${index + 1}`}
                maxLength={80}
                aria-label={`Work ${index + 1}`}
              />
              <button
                type="button"
                className="social-project-work-remove"
                onClick={() => removeDraftWork(work.id)}
                aria-label={`Remove work ${index + 1}`}
              >
                ×
              </button>
            </div>
            <input
              type="url"
              value={work.source}
              onChange={(e) =>
                updateDraftWork(work.id, {
                  source: e.target.value,
                  sourceProof: e.target.value ? null : work.sourceProof,
                })
              }
              placeholder="Source URL (optional)"
              maxLength={500}
              aria-label={`Source link for work ${index + 1}`}
            />
            <div className="social-project-work-source-actions">
              <button
                type="button"
                className="social-project-work-file"
                disabled={workFileBusyId === work.id}
                onClick={() => pickWorkFile(work.id)}
              >
                {work.sourceProof
                  ? work.sourceProof.name || "File attached"
                  : workFileBusyId === work.id
                    ? "Uploading…"
                    : "Attach source file"}
              </button>
              {work.sourceProof ? (
                <button
                  type="button"
                  className="social-project-work-clear-file"
                  onClick={() => updateDraftWork(work.id, { sourceProof: null })}
                >
                  Clear file
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="social-project-compose-actions">
        <button
          type="button"
          className="social-project-work-add"
          onClick={addDraftWork}
        >
          Add work
        </button>
        <button
          type="button"
          className="social-project-compose-save"
          onClick={applyProjectToCompose}
        >
          Add work to post
        </button>
      </div>
    </div>
  ) : null;

  const sharedProjectChip = sharedProject ? (
    <p className="social-project-chip">
      Work ready: <strong>{sharedProject.name}</strong>
      {sharedProject.works?.length
        ? ` · ${sharedProject.works.length} work${sharedProject.works.length === 1 ? "" : "s"}`
        : ""}
    </p>
  ) : null;

  return (
    <section
      ref={pageRef}
      className="social-page"
      aria-label="Social"
    >
      <input
        ref={workFileRef}
        type="file"
        accept={PROOF_ACCEPT}
        hidden
        onChange={onWorkFileChange}
      />
      {!openGroup && (
        <div className="social-tabs-row">
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
                setShowCreateGroup(false);
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
              onClick={() => {
                setViewingProfile(null);
                goGroupsList();
              }}
            >
              Groups
            </button>
          </div>
          {section === "groups" ? (
            <button
              type="button"
              className="social-new-group-btn"
              aria-expanded={showCreateGroup}
              onClick={() => (showCreateGroup ? cancelCreateGroup() : openCreateGroup())}
            >
              {showCreateGroup ? "Cancel" : "New group"}
            </button>
          ) : null}
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
              {composeExtras}
              <button type="submit" className="social-group-post-btn" disabled={busy}>
                Post
              </button>
            </div>
            {projectComposePanel}
            {sharedProjectChip}
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
                onAddProject={handleAddSharedProject}
                addedTemplateIds={addedTemplateIds}
                addingTemplateId={addingTemplateId}
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
          <div className="social-view-main">
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
                {composeExtras}
                <button type="submit" className="social-group-post-btn" disabled={busy}>
                  Post
                </button>
              </div>
              {projectComposePanel}
              {sharedProjectChip}
              {proofName ? <p className="social-group-attach-name">{proofName}</p> : null}
              <ProofMedia proof={proof} className="social-group-attach-preview" />
              {postError ? <p className="social-group-post-error">{postError}</p> : null}
            </form>
            <div className="social-feed">
              {feed.map((item) => {
                const showProfile =
                  viewingProfile && viewingProfile.postId === item.id;
                const stackProfile =
                  showProfile && profileAnchor?.mode === "stack";
                const sideProfile =
                  showProfile && profileAnchor?.mode === "side";
                return (
                  <div
                    key={item.id}
                    data-post-id={item.id}
                    className={`social-feed-row${showProfile ? " is-profile-open" : ""}`}
                  >
                    {stackProfile ? (
                      <ViewProfilePanel
                        profile={viewingProfile}
                        posts={profilePosts}
                        onClose={() => setViewingProfile(null)}
                      />
                    ) : null}
                    {sideProfile ? (
                      <ViewProfilePanel
                        profile={viewingProfile}
                        posts={profilePosts}
                        onClose={() => setViewingProfile(null)}
                        fixed
                        style={{
                          top: profileAnchor.top,
                          left: profileAnchor.left,
                          width: profileAnchor.width,
                          maxHeight: profileAnchor.maxHeight,
                        }}
                      />
                    ) : null}
                    <FeedCard
                      item={item}
                      liked={likedIds.has(item.id)}
                      onLike={toggleLike}
                      onAddProject={handleAddSharedProject}
                      addedTemplateIds={addedTemplateIds}
                      addingTemplateId={addingTemplateId}
                      onOpenProfile={setViewingProfile}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="social-groups"
          role="tabpanel"
          id="social-panel-groups"
          aria-labelledby="social-tab-groups"
        >
          {showCreateGroup ? (
            <form className="social-create-group" onSubmit={submitCreateGroup}>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                maxLength={60}
                aria-label="Group name"
                autoFocus
              />
              <input
                type="text"
                value={newGroupBlurb}
                onChange={(e) => setNewGroupBlurb(e.target.value)}
                placeholder="Short description (optional)"
                maxLength={120}
                aria-label="Group description"
              />
              <button type="submit" className="social-create-group-btn">
                Create
              </button>
              {groupCreateError ? (
                <p className="social-group-post-error">{groupCreateError}</p>
              ) : null}
            </form>
          ) : null}
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="social-card social-group-open"
              onClick={() => {
                setViewingProfile(null);
                setOpenGroupId(group.id);
              }}
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

import { useEffect, useState } from "react";
import { fillLabel, fillProgress, projectDuration, elapsedFromWorks } from "../lib/time.js";
import {
  deleteAuthoredPost,
  hydrateSocialFeeds,
  loadProfilePosts,
  updateUserPost,
} from "../lib/socialFeed.js";
import {
  addHighlightWorks,
  loadHighlights,
  removeHighlight,
} from "../lib/highlights.js";
import ProofMedia from "./ProofMedia.jsx";
import { WorkSourceControl } from "./SourceMedia.jsx";
import "./ProfilePage.css";

const PROFILE_KEY = "sandadd.userProfile";

const DEFAULT_PROFILE = {
  name: "SandAdd User",
  handle: "sandadduser",
  bio: "I pour into what matters.",
};

/** Demo social counts for the profile prototype. */
const DUMMY_FOLLOWERS = 128;
const DUMMY_FOLLOWING = 86;

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : DEFAULT_PROFILE.name,
      handle:
        typeof parsed.handle === "string" && parsed.handle.trim()
          ? parsed.handle.trim().replace(/^@/, "")
          : DEFAULT_PROFILE.handle,
      bio: typeof parsed.bio === "string" ? parsed.bio : DEFAULT_PROFILE.bio,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

function toHandle(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "sandadduser";
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8L16.3 4.5a2 2 0 0 0-2.8 0L3 15v5zM13 7l4 4"
      />
    </svg>
  );
}

function IconDelete() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12"
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

/** Completed work shares from Progress → Share (View). */
function isFinishedPost(post) {
  if (!post) return false;
  if (post.kind === "finished") return true;
  const meta = String(post.meta || "").toLowerCase();
  return meta.startsWith("finished");
}

export default function ProfilePage({
  projects = [],
  activeId = null,
  onOpenProject,
}) {
  const [profile, setProfile] = useState(readProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [section, setSection] = useState("posts");
  const [postsFeed, setPostsFeed] = useState("posts"); // posts | finished
  const [posts, setPosts] = useState(() => loadProfilePosts());
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [highlights, setHighlights] = useState(() => loadHighlights());
  const [pickingHighlight, setPickingHighlight] = useState(false);
  const [pickIds, setPickIds] = useState(() => new Set());
  const [viewingHighlightId, setViewingHighlightId] = useState(null);

  useEffect(() => {
    if (!editing) setDraft(profile);
  }, [profile, editing]);

  useEffect(() => {
    let alive = true;
    // Refresh whenever Profile mounts or Posts tab is selected
    setPosts(loadProfilePosts());
    hydrateSocialFeeds().then((data) => {
      if (!alive) return;
      setPosts(data.profilePosts || loadProfilePosts());
    });
    return () => {
      alive = false;
    };
  }, [section]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setPosts(loadProfilePosts());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const initial = profile.name.trim().slice(0, 1).toUpperCase() || "S";
  const normalPosts = posts.filter((p) => !isFinishedPost(p));
  const finishedPosts = posts.filter((p) => isFinishedPost(p));
  const visiblePosts = postsFeed === "finished" ? finishedPosts : normalPosts;
  const highlightedIds = new Set(highlights.map((h) => h.workId));
  const pickableWorks = projects.filter((p) => p?._id && !highlightedIds.has(p._id));
  const viewingWork = viewingHighlightId
    ? projects.find((p) => p._id === viewingHighlightId) || null
    : null;
  const viewingTopics = Array.isArray(viewingWork?.topics) ? viewingWork.topics : [];
  const viewingDuration = viewingWork ? projectDuration(viewingWork) : 0;
  const viewingElapsed =
    viewingTopics.length > 0
      ? elapsedFromWorks(viewingTopics, viewingDuration)
      : Number(viewingWork?.elapsedMs) || 0;
  const viewingPct = Math.round(
    fillProgress(viewingElapsed, viewingDuration) * 100
  );
  const viewingDoneCount = viewingTopics.filter((t) => t?.done).length;

  const openHighlightPicker = () => {
    setViewingHighlightId(null);
    setPickIds(new Set());
    setPickingHighlight(true);
  };

  const closeHighlightPicker = () => {
    setPickingHighlight(false);
    setPickIds(new Set());
  };

  const togglePickWork = (id) => {
    setPickIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmHighlights = () => {
    const selected = projects.filter((p) => pickIds.has(p._id));
    if (selected.length === 0) {
      closeHighlightPicker();
      return;
    }
    setHighlights(addHighlightWorks(selected));
    closeHighlightPicker();
  };

  const deleteHighlight = (id) => {
    const item = highlights.find((h) => h.id === id);
    if (item && viewingHighlightId === item.workId) {
      setViewingHighlightId(null);
    }
    setHighlights(removeHighlight(id));
  };

  const startEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(profile);
    setEditing(false);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const name = draft.name.trim() || DEFAULT_PROFILE.name;
    const handle = (draft.handle.trim().replace(/^@/, "") || toHandle(name)).slice(0, 24);
    const bio = draft.bio.trim().slice(0, 160);
    const next = { name, handle, bio };
    setProfile(next);
    saveProfile(next);
    setEditing(false);
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditBody(post.body || "");
    setShareNote("");
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditBody("");
  };

  const saveEditPost = (id) => {
    const body = editBody.trim();
    if (!body) return;
    updateUserPost(id, { body });
    setPosts(loadProfilePosts());
    setEditingPostId(null);
    setEditBody("");
  };

  const removePost = (id) => {
    if (!window.confirm("Delete this post?")) return;
    setPosts(deleteAuthoredPost(id));
    if (editingPostId === id) cancelEditPost();
  };

  const sharePost = async (post) => {
    setShareNote("");
    const text = `${post.body}${post.projectName ? `\n(${post.projectName})` : ""}\n— via SandAdd`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SandAdd post", text });
        setShareNote("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareNote("Copied to clipboard");
      } else {
        setShareNote("Sharing not available here");
      }
    } catch {
      setShareNote("Share cancelled");
    }
    window.setTimeout(() => setShareNote(""), 2000);
  };

  return (
    <section className="profile-page" aria-label="Your portfolio">
      <header className="profile-hero">
        <span className="profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <div className="profile-hero-text">
          {editing ? (
            <form className="profile-edit" onSubmit={saveEdit}>
              <label>
                Display name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  maxLength={40}
                  autoFocus
                />
              </label>
              <label>
                Handle
                <input
                  value={draft.handle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      handle: e.target.value.replace(/^@/, "").replace(/\s+/g, ""),
                    }))
                  }
                  maxLength={24}
                  placeholder="username"
                />
              </label>
              <label>
                Bio
                <textarea
                  value={draft.bio}
                  onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                  maxLength={160}
                  rows={3}
                />
              </label>
              <div className="profile-edit-actions">
                <button type="submit">Save</button>
                <button type="button" className="is-ghost" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1>{profile.name}</h1>
              <p className="profile-handle">@{profile.handle}</p>
              <div className="profile-follow-stats" aria-label="Follow counts">
                <span>
                  <strong>{DUMMY_FOLLOWERS}</strong> followers
                </span>
                <span>
                  <strong>{DUMMY_FOLLOWING}</strong> following
                </span>
              </div>
              <p className="profile-bio">{profile.bio || "No bio yet."}</p>
              <button type="button" className="profile-edit-btn" onClick={startEdit}>
                Edit profile
              </button>
            </>
          )}
        </div>
      </header>

      <div className="profile-card">
        <h2>About your portfolio</h2>
        <p>
          Highlight special works and keep finished shares here — your public
          name and photo live on Profile (icon in the navbar).
        </p>
      </div>

      <div className="profile-highlights" aria-label="Highlights">
        <div className="profile-highlights-row">
          {highlights.map((item) => {
            const work = projects.find((p) => p._id === item.workId);
            const label = work?.name || item.name || "Work";
            const letter = label.trim().slice(0, 1).toUpperCase() || "W";
            return (
              <div key={item.id} className="profile-highlight-tile">
                <div className="profile-highlight-box is-filled">
                  <button
                    type="button"
                    className={`profile-highlight-open ${
                      viewingHighlightId === item.workId ? "is-active" : ""
                    }`}
                    onClick={() => {
                      if (!work) return;
                      setPickingHighlight(false);
                      setViewingHighlightId((id) =>
                        id === work._id ? null : work._id
                      );
                    }}
                    aria-label={`View highlight ${label}`}
                    aria-pressed={viewingHighlightId === item.workId}
                  >
                    <span aria-hidden="true">{letter}</span>
                  </button>
                  <button
                    type="button"
                    className="profile-highlight-remove"
                    aria-label={`Remove ${label} from highlights`}
                    onClick={() => deleteHighlight(item.id)}
                  >
                    ×
                  </button>
                </div>
                <span className="profile-highlight-label">{label}</span>
              </div>
            );
          })}

          <div className="profile-highlight-tile">
            <button
              type="button"
              className="profile-highlight-box is-add"
              onClick={openHighlightPicker}
              aria-label="Add highlight"
            >
              <span className="profile-highlight-plus" aria-hidden="true">
                +
              </span>
            </button>
            <span className="profile-highlight-label">Add highlight</span>
          </div>
        </div>
      </div>

      {pickingHighlight ? (
        <div
          className="profile-highlight-picker"
          role="dialog"
          aria-labelledby="highlight-picker-title"
        >
          <header className="profile-highlight-picker-head">
            <button
              type="button"
              className="profile-highlight-back"
              onClick={closeHighlightPicker}
            >
              ← Back
            </button>
            <h2 id="highlight-picker-title">Add highlight</h2>
            <button
              type="button"
              className="profile-highlight-done"
              onClick={confirmHighlights}
              disabled={pickIds.size === 0}
            >
              Add{pickIds.size > 0 ? ` (${pickIds.size})` : ""}
            </button>
          </header>
          <p className="profile-highlight-picker-hint">
            Choose special works to show on your profile.
          </p>
          {pickableWorks.length === 0 ? (
            <p className="profile-empty">
              {projects.length === 0
                ? "Create a work first, then add it as a highlight."
                : "All your works are already highlighted."}
            </p>
          ) : (
            <ul className="profile-highlight-pick-list">
              {pickableWorks.map((work) => {
                const checked = pickIds.has(work._id);
                const duration = projectDuration(work);
                const elapsed = work.elapsedMs || 0;
                return (
                  <li key={work._id}>
                    <label className={checked ? "is-checked" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePickWork(work._id)}
                      />
                      <span className="profile-highlight-pick-copy">
                        <strong>{work.name || "Untitled"}</strong>
                        <span>{fillLabel(elapsed, duration)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : viewingWork ? (
        <div
          className="profile-highlight-detail"
          role="region"
          aria-label={`${viewingWork.name || "Work"} highlight details`}
        >
          <header className="profile-highlight-detail-head">
            <div>
              <h2>{viewingWork.name || "Untitled"}</h2>
              <p className="profile-highlight-detail-meta">
                {viewingTopics.length > 0
                  ? `${viewingDoneCount}/${viewingTopics.length} tasks done`
                  : fillLabel(viewingElapsed, viewingDuration)}
              </p>
            </div>
            <button
              type="button"
              className="profile-highlight-back"
              onClick={() => setViewingHighlightId(null)}
            >
              Close
            </button>
          </header>

          <div className="profile-highlight-pct" aria-label="Completion">
            <div className="profile-highlight-pct-row">
              <span>Completed</span>
              <strong>{viewingPct}%</strong>
            </div>
            <div
              className="profile-highlight-pct-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={viewingPct}
            >
              <div
                className="profile-highlight-pct-fill"
                style={{ width: `${viewingPct}%` }}
              />
            </div>
          </div>

          <h3 className="profile-highlight-tasks-title">Tasks</h3>
          {viewingTopics.length === 0 ? (
            <p className="profile-empty">No tasks listed for this work yet.</p>
          ) : (
            <ul className="profile-highlight-task-list">
              {viewingTopics.map((topic) => (
                <li
                  key={topic.id || topic.text}
                  className={topic.done ? "is-done" : ""}
                >
                  <span aria-hidden="true">{topic.done ? "✓" : "○"}</span>
                  <span>{topic.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={section === "posts"}
          className={section === "posts" ? "is-active" : ""}
          onClick={() => setSection("posts")}
        >
          Posts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "saved"}
          className={section === "saved" ? "is-active" : ""}
          onClick={() => setSection("saved")}
        >
          Saved
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "projects"}
          className={section === "projects" ? "is-active" : ""}
          onClick={() => setSection("projects")}
        >
          Works
        </button>
      </div>

      <div className="profile-section" role="tabpanel">
        {section === "posts" ? (
          <>
            <div
              className="profile-posts-subtabs"
              role="tablist"
              aria-label="Posts feed"
            >
              <button
                type="button"
                role="tab"
                aria-selected={postsFeed === "posts"}
                className={postsFeed === "posts" ? "is-active" : ""}
                onClick={() => setPostsFeed("posts")}
              >
                Posts
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={postsFeed === "finished"}
                className={postsFeed === "finished" ? "is-active" : ""}
                onClick={() => setPostsFeed("finished")}
              >
                Finished
              </button>
            </div>
            {visiblePosts.length === 0 ? (
              <p className="profile-empty">
                {postsFeed === "finished"
                  ? "No finished works shared yet"
                  : "No any posts to show"}
              </p>
            ) : (
              <>
                {shareNote ? (
                  <p className="profile-share-note">{shareNote}</p>
                ) : null}
                <ul className="profile-post-list">
                  {visiblePosts.map((post) => {
                    const isEditing = editingPostId === post.id;
                    return (
                      <li key={post.id} className="profile-post-item">
                        <p className="profile-post-meta">{post.meta}</p>
                        {isEditing ? (
                          <div className="profile-post-edit">
                            <textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              rows={3}
                              maxLength={280}
                            />
                            <div className="profile-post-edit-actions">
                              <button
                                type="button"
                                onClick={() => saveEditPost(post.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="is-ghost"
                                onClick={cancelEditPost}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="profile-post-body">{post.body}</p>
                        )}
                        {(() => {
                          const works = Array.isArray(post.sharedProject?.works)
                            ? post.sharedProject.works
                            : Array.isArray(post.works)
                              ? post.works
                              : [];
                          if (
                            !works.length &&
                            !post.sharedProject?.name &&
                            !post.projectName
                          ) {
                            return null;
                          }
                          return (
                            <div className="profile-post-works">
                              {(post.sharedProject?.name ||
                                post.projectName) && (
                                <p className="profile-post-works-name">
                                  {post.sharedProject?.name || post.projectName}
                                </p>
                              )}
                              <p className="profile-post-works-label">
                                What the works to do
                              </p>
                              {works.length > 0 ? (
                                <ul>
                                  {works.map((w) => (
                                    <li
                                      key={w.id || w.text}
                                      className={w.done ? "is-done" : ""}
                                    >
                                      <span aria-hidden="true">
                                        {w.done ? "✓" : "○"}
                                      </span>
                                      <span className="profile-work-text">
                                        {w.text}
                                      </span>
                                      <WorkSourceControl work={w} />
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="profile-post-works-empty">
                                  No works listed
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        <ProofMedia
                          proof={post.proof}
                          className="profile-post-proof"
                        />
                        <div className="profile-post-actions">
                          <button
                            type="button"
                            aria-label="Edit post"
                            title="Edit"
                            onClick={() => startEditPost(post)}
                          >
                            <IconEdit />
                          </button>
                          <button
                            type="button"
                            aria-label="Share post"
                            title="Share"
                            onClick={() => sharePost(post)}
                          >
                            <IconShare />
                          </button>
                          <button
                            type="button"
                            className="is-danger"
                            aria-label="Delete post"
                            title="Delete"
                            onClick={() => removePost(post.id)}
                          >
                            <IconDelete />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        ) : section === "saved" ? (
          <p className="profile-empty">No any saved to show</p>
        ) : projects.length === 0 ? (
          <p className="profile-empty">No works to show</p>
        ) : (
          <ul className="profile-project-list">
            {projects.map((project) => {
              const duration = projectDuration(project);
              const elapsed = project.elapsedMs || 0;
              const done = fillLabel(elapsed, duration);
              const pct = Math.round(fillProgress(elapsed, duration) * 100);
              return (
                <li key={project._id}>
                  <button
                    type="button"
                    className={`profile-project-item ${activeId === project._id ? "is-active" : ""}`}
                    onClick={() => onOpenProject?.(project)}
                  >
                    <span className="profile-project-main">
                      <strong>{project.name || "Untitled"}</strong>
                      <span className="profile-project-meta">
                        {project.important ? "Important · " : ""}
                        {done}
                      </span>
                    </span>
                    <span className="profile-project-pct" aria-hidden="true">
                      {pct}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
        </>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { fillLabel, fillProgress, projectDuration } from "../lib/time.js";
import {
  deleteAuthoredPost,
  hydrateSocialFeeds,
  loadProfilePosts,
  updateUserPost,
} from "../lib/socialFeed.js";
import ProofMedia from "./ProofMedia.jsx";
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

export default function ProfilePage({
  projects = [],
  activeId = null,
  onOpenProject,
}) {
  const [profile, setProfile] = useState(readProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [section, setSection] = useState("posts");
  const [posts, setPosts] = useState(() => loadProfilePosts());
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [shareNote, setShareNote] = useState("");

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
    <section className="profile-page" aria-label="Your profile">
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
        <h2>About you</h2>
        <p>
          This is your SandAdd user profile — separate from any project you pour
          into. Your name here is who you are on Social and Messages.
        </p>
      </div>

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
          Projects
        </button>
      </div>

      <div className="profile-section" role="tabpanel">
        {section === "posts" ? (
          posts.length === 0 ? (
            <p className="profile-empty">No any posts to show</p>
          ) : (
            <>
              {shareNote ? <p className="profile-share-note">{shareNote}</p> : null}
              <ul className="profile-post-list">
                {posts.map((post) => {
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
                            <button type="button" onClick={() => saveEditPost(post.id)}>
                              Save
                            </button>
                            <button type="button" className="is-ghost" onClick={cancelEditPost}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="profile-post-body">{post.body}</p>
                      )}
                      <ProofMedia proof={post.proof} className="profile-post-proof" />
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
          )
        ) : section === "saved" ? (
          <p className="profile-empty">No any saved to show</p>
        ) : projects.length === 0 ? (
          <p className="profile-empty">No any projects to show</p>
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
    </section>
  );
}

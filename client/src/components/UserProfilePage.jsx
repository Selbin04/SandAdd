import { useEffect, useRef, useState } from "react";
import {
  deleteAuthoredPost,
  hydrateSocialFeeds,
  loadProfilePosts,
  updateUserPost,
} from "../lib/socialFeed.js";
import FileUploadHint from "./FileUploadHint.jsx";
import ProofMedia from "./ProofMedia.jsx";
import "./UserProfilePage.css";

const PROFILE_KEY = "sandadd.userProfile";
const AVATAR_KEY = "sandadd.userAvatar";

const DEFAULT_PROFILE = {
  name: "SandAdd User",
  handle: "sandadduser",
  bio: "I pour into what matters.",
};

const DUMMY_FOLLOWERS = 128;
const DUMMY_FOLLOWING = 86;

function readProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : DEFAULT_PROFILE.name,
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

function readAvatar() {
  try {
    return localStorage.getItem(AVATAR_KEY) || "";
  } catch {
    return "";
  }
}

function saveAvatar(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
    else localStorage.removeItem(AVATAR_KEY);
    return true;
  } catch {
    return false;
  }
}

function toHandle(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "sandadduser"
  );
}

function isFinishedPost(post) {
  if (!post) return false;
  if (post.kind === "finished") return true;
  return String(post.meta || "").toLowerCase().startsWith("finished");
}

function loadViewPosts() {
  try {
    return loadProfilePosts().filter((p) => !isFinishedPost(p));
  } catch {
    return [];
  }
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

export default function UserProfilePage() {
  const [profile, setProfile] = useState(readProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [avatar, setAvatar] = useState(readAvatar);
  const [avatarError, setAvatarError] = useState("");
  const [posts, setPosts] = useState(loadViewPosts);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editBody, setEditBody] = useState("");
  const [shareNote, setShareNote] = useState("");
  const fileRef = useRef(null);

  const refreshPosts = () => setPosts(loadViewPosts());

  const refresh = () => {
    setProfile(readProfile());
    setAvatar(readAvatar());
    refreshPosts();
  };

  useEffect(() => {
    refresh();
    let alive = true;
    hydrateSocialFeeds()
      .then((data) => {
        if (!alive) return;
        try {
          const list = data.profilePosts || loadProfilePosts();
          setPosts(list.filter((p) => !isFinishedPost(p)));
        } catch {
          refreshPosts();
        }
      })
      .catch(() => {
        if (alive) refreshPosts();
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!editing) setDraft(profile);
  }, [profile, editing]);

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
    const handle = (
      draft.handle.trim().replace(/^@/, "") || toHandle(name)
    ).slice(0, 24);
    const bio = draft.bio.trim().slice(0, 160);
    const next = { name, handle, bio };
    setProfile(next);
    saveProfile(next);
    setEditing(false);
  };

  const startEditPost = (post) => {
    if (!post?.id) return;
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
    if (!id || !body) return;
    updateUserPost(id, { body });
    refreshPosts();
    setEditingPostId(null);
    setEditBody("");
  };

  const removePost = (id) => {
    if (!id) return;
    if (!window.confirm("Delete this post?")) return;
    deleteAuthoredPost(id);
    refreshPosts();
    if (editingPostId === id) cancelEditPost();
  };

  const sharePost = async (post) => {
    setShareNote("");
    const text = `${post?.body || ""}${
      post?.projectName ? `\n(${post.projectName})` : ""
    }\n— via SandAdd`;
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

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    setAvatarError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file");
      return;
    }
    if (file.size > 1_500_000) {
      setAvatarError("Image too large — use one under 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      const ok = saveAvatar(dataUrl);
      if (!ok) {
        setAvatarError("Could not save photo (storage full)");
        return;
      }
      setAvatar(dataUrl);
    };
    reader.onerror = () => setAvatarError("Could not read that image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearAvatar = () => {
    setAvatar("");
    saveAvatar("");
    setAvatarError("");
  };

  return (
    <section className="user-profile-page" aria-label="Your profile">
      <header className="user-profile-hero">
        <div className="user-profile-avatar-wrap">
          <button
            type="button"
            className="user-profile-avatar"
            onClick={() => fileRef.current?.click()}
            aria-label="Set public profile picture"
            title="Add public profile picture"
          >
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              <span className="user-profile-avatar-placeholder">
                <span className="user-profile-avatar-letter">{initial}</span>
                <span className="user-profile-avatar-hint">Add photo</span>
              </span>
            )}
          </button>
          <FileUploadHint />
          {avatar ? (
            <button
              type="button"
              className="user-profile-avatar-clear"
              onClick={clearAvatar}
            >
              Remove photo
            </button>
          ) : null}
          {avatarError ? (
            <p className="user-profile-avatar-error">{avatarError}</p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickAvatar}
          />
        </div>

        <div className="user-profile-hero-text">
          {editing ? (
            <form className="user-profile-edit" onSubmit={saveEdit}>
              <label>
                Display name
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
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
                      handle: e.target.value
                        .replace(/^@/, "")
                        .replace(/\s+/g, ""),
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
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, bio: e.target.value }))
                  }
                  maxLength={160}
                  rows={3}
                />
              </label>
              <div className="user-profile-edit-actions">
                <button type="submit">Save</button>
                <button
                  type="button"
                  className="is-ghost"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1>{profile.name}</h1>
              <p className="user-profile-handle">@{profile.handle}</p>
              <div
                className="user-profile-follow-stats"
                aria-label="Follow counts"
              >
                <span>
                  <strong>{DUMMY_FOLLOWERS}</strong> followers
                </span>
                <span>
                  <strong>{DUMMY_FOLLOWING}</strong> following
                </span>
              </div>
              <p className="user-profile-bio">
                {profile.bio || "No bio yet."}
              </p>
              <button
                type="button"
                className="user-profile-edit-btn"
                onClick={startEdit}
              >
                Edit profile
              </button>
            </>
          )}
        </div>
      </header>

      <div className="user-profile-section">
        <h2>View posts</h2>
        {shareNote ? (
          <p className="user-profile-share-note">{shareNote}</p>
        ) : null}
        {posts.length === 0 ? (
          <p className="user-profile-empty">No posts to show</p>
        ) : (
          <ul className="user-profile-post-list">
            {posts.map((post, index) => {
              const key = post?.id || `post-${index}`;
              const isEditing = Boolean(post?.id && editingPostId === post.id);
              const works = Array.isArray(post?.sharedProject?.works)
                ? post.sharedProject.works
                : Array.isArray(post?.works)
                  ? post.works
                  : [];
              const projectName =
                post?.sharedProject?.name || post?.projectName || "";
              return (
                <li key={key} className="user-profile-post-item">
                  {post?.meta ? (
                    <p className="user-profile-post-meta">{post.meta}</p>
                  ) : null}
                  {isEditing ? (
                    <div className="user-profile-post-edit">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        maxLength={280}
                      />
                      <div className="user-profile-post-edit-actions">
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
                  ) : post?.body ? (
                    <p className="user-profile-post-body">{post.body}</p>
                  ) : null}
                  {(works.length > 0 || projectName) && (
                    <div className="user-profile-post-works">
                      {projectName ? (
                        <p className="user-profile-post-works-name">
                          {projectName}
                        </p>
                      ) : null}
                      {works.length > 0 ? (
                        <ul>
                          {works.map((w, wi) => (
                            <li
                              key={w?.id || w?.text || `w-${wi}`}
                              className={w?.done ? "is-done" : ""}
                            >
                              <span aria-hidden="true">
                                {w?.done ? "✓" : "○"}
                              </span>
                              <span>{w?.text || "Task"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                  {post?.proof ? (
                    <ProofMedia
                      proof={post.proof}
                      className="user-profile-post-proof"
                    />
                  ) : null}
                  {post?.id ? (
                    <div className="user-profile-post-actions">
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
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

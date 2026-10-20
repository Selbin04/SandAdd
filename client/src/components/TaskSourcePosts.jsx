import { useEffect, useState, useRef } from "react";
import {
  getLocalPostsForTopic,
  fetchTopicPosts,
  loadPostComments,
  addPostComment,
  readAuthorProfile,
} from "../lib/socialFeed.js";
import { toggleLikeSocialPost } from "../api.js";
import ProofMedia from "./ProofMedia.jsx";
import "./TaskSourcePosts.css";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "just now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function TaskSourcePosts({
  topic,
  project,
  onShareFinish,
  onPostsLoaded,
}) {
  const topicId = topic?.id || null;
  const [posts, setPosts] = useState(() => getLocalPostsForTopic(topicId));
  const [loading, setLoading] = useState(false);
  const [likedMap, setLikedMap] = useState({});
  const [likeCountMap, setLikeCountMap] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const aliveRef = useRef(true);

  // Load and refresh posts for this topic
  useEffect(() => {
    aliveRef.current = true;
    if (!topicId) {
      setPosts([]);
      return;
    }

    // 1. Initial synchronous local load
    const initial = getLocalPostsForTopic(topicId);
    setPosts(initial);
    onPostsLoaded?.(initial);

    // Initial like state setup
    const initialLiked = {};
    const initialLikeCounts = {};
    const currentAuthor = readAuthorProfile();
    for (const p of initial) {
      const likes = Array.isArray(p.likes) ? p.likes.map(String) : [];
      initialLiked[p.id] = Boolean(
        currentAuthor?.handle && likes.includes(currentAuthor.handle)
      );
      initialLikeCounts[p.id] = likes.length;
    }
    setLikedMap(initialLiked);
    setLikeCountMap(initialLikeCounts);

    // 2. Background fetch from server to get cross-user posts
    setLoading(true);
    fetchTopicPosts(topicId)
      .then((serverPosts) => {
        if (!aliveRef.current) return;
        setPosts(serverPosts);
        onPostsLoaded?.(serverPosts);

        setLikeCountMap((prev) => {
          const next = { ...prev };
          for (const p of serverPosts) {
            if (next[p.id] == null) {
              next[p.id] = Array.isArray(p.likes) ? p.likes.length : 0;
            }
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (aliveRef.current) setLoading(false);
      });

    // 3. Listen for feed updates (e.g. user posted finish or deleted)
    const handleFeedChanged = () => {
      if (!aliveRef.current || !topicId) return;
      const updated = getLocalPostsForTopic(topicId);
      setPosts(updated);
      onPostsLoaded?.(updated);
    };

    const handleCommentsChanged = (e) => {
      const changedPostId = e?.detail?.postId;
      if (changedPostId) {
        setCommentsMap((prev) => ({
          ...prev,
          [changedPostId]: loadPostComments(changedPostId),
        }));
      }
    };

    window.addEventListener("sandadd:feed-changed", handleFeedChanged);
    window.addEventListener("sandadd:comments-changed", handleCommentsChanged);

    return () => {
      aliveRef.current = false;
      window.removeEventListener("sandadd:feed-changed", handleFeedChanged);
      window.removeEventListener("sandadd:comments-changed", handleCommentsChanged);
    };
  }, [topicId]);

  const handleToggleLike = async (postId) => {
    if (!postId) return;
    const currentLiked = Boolean(likedMap[postId]);
    const currentCount = likeCountMap[postId] ?? 0;

    setLikedMap((prev) => ({ ...prev, [postId]: !currentLiked }));
    setLikeCountMap((prev) => ({
      ...prev,
      [postId]: currentLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    }));

    try {
      await toggleLikeSocialPost(postId);
    } catch {
      // Revert on error
      setLikedMap((prev) => ({ ...prev, [postId]: currentLiked }));
      setLikeCountMap((prev) => ({ ...prev, [postId]: currentCount }));
    }
  };

  const handleToggleComments = (postId) => {
    if (!postId) return;
    const isExpanded = Boolean(expandedComments[postId]);
    const nextState = !isExpanded;

    setExpandedComments((prev) => ({ ...prev, [postId]: nextState }));
    if (nextState && !commentsMap[postId]) {
      const local = loadPostComments(postId);
      const postItem = posts.find((p) => p.id === postId);
      const initialList = Array.isArray(postItem?.comments) && postItem.comments.length > local.length
        ? postItem.comments
        : local;
      setCommentsMap((prev) => ({ ...prev, [postId]: initialList }));
    }
  };

  const handleCommentSubmit = (postId, e) => {
    e?.preventDefault?.();
    const text = String(commentInputs[postId] || "").trim();
    if (!text) return;

    const updated = addPostComment(postId, text);
    setCommentsMap((prev) => ({ ...prev, [postId]: updated }));
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  return (
    <div className="task-source-posts-container">
      <header className="task-source-posts-header">
        <div className="task-source-posts-header-info">
          <div className="task-source-posts-title-row">
            <h4 className="task-source-posts-title">Task Finish Posts</h4>
            <span className="task-source-posts-count-badge">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </span>
          </div>
          <p className="task-source-posts-sub">
            Posts published by users who finished this particular task.
          </p>
        </div>

        {onShareFinish && (
          <button
            type="button"
            className="task-source-posts-share-btn"
            onClick={() => onShareFinish?.(topic, project)}
            title="Publish a post for finishing this task"
          >
            + Share finish
          </button>
        )}
      </header>

      {loading && posts.length === 0 ? (
        <p className="done-source-meta">Checking posts for this task…</p>
      ) : posts.length === 0 ? (
        <div className="task-source-posts-empty">
          <span className="task-source-posts-empty-icon" aria-hidden="true">
            📝
          </span>
          <p className="task-source-posts-empty-title">
            No posts for this task yet
          </p>
          <p className="task-source-posts-empty-desc">
            When users finish “{topic?.text || "this task"}” and share their completion or proof, their posts will appear here.
          </p>
          {onShareFinish && (
            <button
              type="button"
              className="task-source-posts-empty-btn"
              onClick={() => onShareFinish?.(topic, project)}
            >
              Share your finish now
            </button>
          )}
        </div>
      ) : (
        <div className="task-source-posts-list">
          {posts.map((post) => {
            const pid = post.id || post._id;
            const isLiked = Boolean(likedMap[pid]);
            const likesCount = likeCountMap[pid] ?? (Array.isArray(post.likes) ? post.likes.length : 0);
            const isCommentsOpen = Boolean(expandedComments[pid]);
            const postComments = commentsMap[pid] || post.comments || [];
            const commentsCount = Math.max(postComments.length, Array.isArray(post.comments) ? post.comments.length : 0);
            const authorName = post.author?.name || post.name || "User";
            const authorHandle = post.author?.handle || post.handle || "";
            const initial =
              post.initial ||
              post.author?.initial ||
              authorName.trim().slice(0, 1).toUpperCase() ||
              "U";

            return (
              <article key={pid} className="task-source-post-card">
                <header className="task-source-post-header">
                  <div className="task-source-post-author-box">
                    <span className="task-source-post-avatar">
                      {post.avatar ? (
                        <img src={post.avatar} alt={authorName} />
                      ) : (
                        initial
                      )}
                    </span>
                    <div className="task-source-post-author-info">
                      <div className="task-source-post-author-names">
                        <strong className="task-source-post-author-name">
                          {authorName}
                        </strong>
                        {authorHandle && (
                          <span className="task-source-post-handle">
                            @{authorHandle.replace(/^@/, "")}
                          </span>
                        )}
                      </div>
                      <span className="task-source-post-meta">
                        {formatRelativeTime(post.createdAt)}
                        {post.groupName ? ` · in ${post.groupName}` : " · View Feed"}
                      </span>
                    </div>
                  </div>

                  <span className="task-source-post-badge">
                    ✓ Finished task
                  </span>
                </header>

                {post.body && (
                  <p className="task-source-post-body">{post.body}</p>
                )}

                {post.proof && (
                  <div className="task-source-post-proof">
                    <ProofMedia proof={post.proof} />
                  </div>
                )}

                <footer className="task-source-post-footer">
                  <button
                    type="button"
                    className={`task-source-post-action-btn ${isLiked ? "is-liked" : ""}`}
                    onClick={() => handleToggleLike(pid)}
                    aria-label={isLiked ? "Unlike post" : "Like post"}
                    title={isLiked ? "Unlike" : "Like"}
                  >
                    <span>{isLiked ? "♥" : "♡"}</span>
                    <span>{likesCount}</span>
                  </button>

                  <button
                    type="button"
                    className={`task-source-post-action-btn ${isCommentsOpen ? "is-active" : ""}`}
                    onClick={() => handleToggleComments(pid)}
                    aria-label="Toggle comments"
                    title="Comments"
                  >
                    <span>💬</span>
                    <span>{commentsCount}</span>
                  </button>
                </footer>

                {isCommentsOpen && (
                  <div className="task-source-post-comments-wrap">
                    {postComments.length > 0 ? (
                      <div className="task-source-post-comments-list">
                        {postComments.map((c) => (
                          <div key={c.id || Math.random()} className="task-source-post-comment-item">
                            <div className="task-source-post-comment-head">
                              <span className="task-source-post-comment-author">
                                {c.name || c.author || "User"}
                              </span>
                              <span className="task-source-post-comment-time">
                                {formatRelativeTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="task-source-post-comment-text">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="done-source-meta" style={{ margin: "2px 0" }}>
                        No comments yet.
                      </p>
                    )}

                    <form
                      className="task-source-post-comment-form"
                      onSubmit={(e) => handleCommentSubmit(pid, e)}
                    >
                      <input
                        type="text"
                        className="task-source-post-comment-input"
                        placeholder="Write a comment…"
                        value={commentInputs[pid] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [pid]: e.target.value,
                          }))
                        }
                        maxLength={500}
                      />
                      <button
                        type="submit"
                        className="task-source-post-comment-submit"
                        disabled={!String(commentInputs[pid] || "").trim()}
                      >
                        Reply
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

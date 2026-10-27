import React, { useState, useEffect, useCallback } from "react";
import { getFollowedWorkGroup } from "../lib/followingStore.js";
import "./WorkFolderStats.css";

export function calculateProjectLikes(project) {
  if (!project) return 0;
  const topics = Array.isArray(project.topics)
    ? project.topics
    : Array.isArray(project.works)
    ? project.works
    : [];

  let taskLikes = {};
  let taskLikeCounts = {};

  try {
    const rawLikes = localStorage.getItem(`sandadd_likes_${project._id || "default"}`);
    if (rawLikes) taskLikes = JSON.parse(rawLikes);
  } catch {
    taskLikes = {};
  }

  try {
    const rawCounts = localStorage.getItem(`sandadd.taskLikeCounts.${project._id || "default"}`);
    if (rawCounts) taskLikeCounts = JSON.parse(rawCounts);
  } catch {
    taskLikeCounts = {};
  }

  return topics.reduce((sum, topic) => {
    if (!topic || !topic.id) return sum;
    const stored = taskLikeCounts[topic.id];
    if (typeof stored === "number") return sum + stored;
    if (typeof topic.likeCount === "number" && topic.likeCount > 0) return sum + topic.likeCount;
    return sum + (taskLikes[topic.id] ? 1 : 0);
  }, 0);
}

export function calculateProjectFollowers(project, allProjects = []) {
  if (!project) return 0;
  if (typeof project.followersCount === "number") return project.followersCount;
  if (typeof project.followerCount === "number") return project.followerCount;
  if (Array.isArray(project.followers)) return project.followers.length;
  if (Array.isArray(project.subscribers)) return project.subscribers.length;

  const origin = project.originId || project.sharedTemplateId || project._id;
  const group = getFollowedWorkGroup(origin);
  if (group?.members && Array.isArray(group.members) && group.members.length > 0) {
    return group.members.length;
  }

  const copies = (allProjects || []).filter((p) => {
    const pOrigin = p?.originId || p?.sharedTemplateId;
    return (
      pOrigin &&
      (pOrigin === project._id ||
        pOrigin === project.originId ||
        pOrigin === project.sharedTemplateId)
    );
  }).length;
  if (copies > 0) return copies;

  if (
    project.originMode === "follow" ||
    project.shareMode === "follow" ||
    project.mode === "follow"
  ) {
    return 1;
  }

  return 0;
}

export default function WorkFolderStats({ project, allProjects = [], layout = "row" }) {
  const [likes, setLikes] = useState(() => calculateProjectLikes(project));
  const [followers, setFollowers] = useState(() =>
    calculateProjectFollowers(project, allProjects)
  );

  const refreshStats = useCallback(() => {
    setLikes(calculateProjectLikes(project));
    setFollowers(calculateProjectFollowers(project, allProjects));
  }, [project, allProjects]);

  useEffect(() => {
    refreshStats();
  }, [project, allProjects, refreshStats]);

  useEffect(() => {
    window.addEventListener("sandadd:followed-work-groups-changed", refreshStats);
    window.addEventListener("sandadd:feed-changed", refreshStats);
    window.addEventListener("storage", refreshStats);

    return () => {
      window.removeEventListener("sandadd:followed-work-groups-changed", refreshStats);
      window.removeEventListener("sandadd:feed-changed", refreshStats);
      window.removeEventListener("storage", refreshStats);
    };
  }, [refreshStats]);

  return (
    <div
      className={`work-folder-stats is-${layout}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Progress folder statistics: ${likes} likes, ${followers} followers`}
    >
      <span
        className="work-stat-pill"
        title={`${likes} total like${likes === 1 ? "" : "s"} across all progress files`}
      >
        <svg
          className="work-stat-icon is-like"
          viewBox="0 0 24 24"
          width="11"
          height="11"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <span className="work-stat-count">{likes}</span>
      </span>

      <span
        className="work-stat-pill"
        title={`${followers} follower${followers === 1 ? "" : "s"}`}
      >
        <svg
          className="work-stat-icon is-followers"
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="work-stat-count">{followers}</span>
      </span>
    </div>
  );
}

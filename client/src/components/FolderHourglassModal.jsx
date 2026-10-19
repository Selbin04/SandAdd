import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Hourglass from "./Hourglass.jsx";
import { fillProgress, projectDuration } from "../lib/time.js";
import "./FolderHourglassModal.css";

export default function FolderHourglassModal({
  folder,
  projects = [],
  onClose,
  onOpenWork,
}) {
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [isPouring, setIsPouring] = useState(false);
  const pourTimeoutRef = useRef(null);
  const prevProgressRef = useRef(null);
  const prevWorkIdRef = useRef(selectedWorkId);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Compute folder aggregate metrics
  let totalFolderTasks = 0;
  let completedFolderTasks = 0;
  let totalFolderDuration = 0;
  let totalFolderElapsed = 0;
  let finishedWorksCount = 0;

  const worksStats = projects.map((p) => {
    const checkable = (p.topics || []).filter((t) => t && t.hasCheckbox !== false);
    const doneTasks = checkable.filter((t) => t.done).length;
    const dur = projectDuration(p);
    const elapsed = Math.min(dur, p.elapsedMs || 0);

    totalFolderTasks += checkable.length;
    completedFolderTasks += doneTasks;
    totalFolderDuration += dur;
    totalFolderElapsed += elapsed;

    let ratio = 0;
    if (checkable.length > 0) {
      ratio = doneTasks / checkable.length;
    } else if (dur > 0) {
      ratio = fillProgress(elapsed, dur);
    } else if (p.completed) {
      ratio = 1;
    }

    const isFinished =
      p.completed ||
      (checkable.length > 0 && doneTasks === checkable.length) ||
      (dur > 0 && elapsed >= dur);

    if (isFinished) finishedWorksCount++;

    return {
      project: p,
      tasksCount: checkable.length,
      doneTasks,
      duration: dur,
      elapsed,
      ratio: Math.min(1, Math.max(0, ratio)),
      isFinished,
    };
  });

  let folderRatio = 0;
  if (totalFolderTasks > 0) {
    folderRatio = completedFolderTasks / totalFolderTasks;
  } else if (totalFolderDuration > 0) {
    folderRatio = totalFolderElapsed / totalFolderDuration;
  } else if (projects.length > 0) {
    folderRatio = finishedWorksCount / projects.length;
  }
  folderRatio = Math.min(1, Math.max(0, folderRatio));

  // Determine active view (all folder vs specific work)
  const activeWorkStat = selectedWorkId
    ? worksStats.find((w) => w.project._id === selectedWorkId)
    : null;

  const activeTitle = activeWorkStat
    ? activeWorkStat.project.name
    : folder?.name || "Folder Progress";
  const activeProgress = activeWorkStat ? activeWorkStat.ratio : folderRatio;
  const activePercent = Math.round(activeProgress * 100);
  const activeFinished =
    activeProgress >= 0.999 && (projects.length > 0 || (activeWorkStat && activeWorkStat.tasksCount > 0));

  // Timed sand pouring: only animate for a satisfying burst when progress changes, then settle
  useEffect(() => {
    const progressChanged =
      prevProgressRef.current !== null && prevProgressRef.current !== activeProgress;
    const workChanged = prevWorkIdRef.current !== selectedWorkId;

    if (progressChanged || workChanged) {
      if (activeProgress > 0 && activeProgress < 0.999) {
        setIsPouring(true);
        if (pourTimeoutRef.current) clearTimeout(pourTimeoutRef.current);
        pourTimeoutRef.current = setTimeout(() => {
          setIsPouring(false);
        }, 2200);
      } else {
        setIsPouring(false);
      }
    } else if (prevProgressRef.current === null) {
      if (activeProgress > 0 && activeProgress < 0.999) {
        setIsPouring(true);
        pourTimeoutRef.current = setTimeout(() => {
          setIsPouring(false);
        }, 1500);
      }
    }

    prevProgressRef.current = activeProgress;
    prevWorkIdRef.current = selectedWorkId;

    return () => {
      if (pourTimeoutRef.current) clearTimeout(pourTimeoutRef.current);
    };
  }, [activeProgress, selectedWorkId]);

  const handleManualPour = () => {
    if (activeProgress > 0 && activeProgress < 0.999) {
      setIsPouring(true);
      if (pourTimeoutRef.current) clearTimeout(pourTimeoutRef.current);
      pourTimeoutRef.current = setTimeout(() => {
        setIsPouring(false);
      }, 2200);
    }
  };

  return createPortal(
    <div
      className="folder-hg-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="folder-hg-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-hg-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="folder-hg-header">
          <div className="folder-hg-header-info">
            <span className="folder-hg-badge">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 22h14" />
                <path d="M5 2h14" />
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
              </svg>
              FOLDER HOURGLASS
            </span>
            <h2 id="folder-hg-title" className="folder-hg-title">
              {activeTitle}
            </h2>
          </div>
          <button
            type="button"
            className="folder-hg-close-btn"
            onClick={onClose}
            aria-label="Close folder hourglass"
          >
            ×
          </button>
        </header>

        {/* View Switcher if folder has multiple works */}
        {projects.length > 1 && (
          <div className="folder-hg-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!selectedWorkId}
              className={`folder-hg-tab ${!selectedWorkId ? "is-active" : ""}`}
              onClick={() => setSelectedWorkId(null)}
            >
              📁 All Works ({projects.length})
            </button>
            {projects.map((p) => (
              <button
                key={p._id}
                type="button"
                role="tab"
                aria-selected={selectedWorkId === p._id}
                className={`folder-hg-tab ${selectedWorkId === p._id ? "is-active" : ""}`}
                onClick={() => setSelectedWorkId(p._id)}
                title={p.name}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Main Hourglass Stage */}
        <div className="folder-hg-stage">
          <div
            className={`folder-hg-glow ${activeFinished ? "is-finished" : isPouring ? "is-pouring" : ""}`}
          />
          <div
            className="folder-hg-hourglass-wrap"
            onClick={handleManualPour}
            title={activeProgress > 0 && activeProgress < 0.999 ? "Click to flow sand" : undefined}
          >
            <Hourglass
              progress={activeProgress}
              pouring={isPouring}
              finished={activeFinished}
            />
          </div>
        </div>

        {/* Big Progress Bar & Metrics */}
        <section className="folder-hg-progress-card">
          <div className="folder-hg-progress-headline">
            <span className="folder-hg-percent">{activePercent}%</span>
            {(activeFinished || isPouring || activeProgress > 0) && (
              <span
                className={`folder-hg-status-pill ${
                  activeFinished
                    ? "pill-done"
                    : isPouring
                    ? "pill-pouring"
                    : "pill-active"
                }`}
              >
                {activeFinished
                  ? "Completed"
                  : isPouring
                  ? "Pouring Sand…"
                  : "In Progress"}
              </span>
            )}
          </div>

          <div
            className="folder-hg-bar-track"
            role="progressbar"
            aria-valuenow={activePercent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              className={`folder-hg-bar-fill ${activeFinished ? "is-complete" : ""}`}
              style={{ width: `${activePercent}%` }}
            >
              <span className="folder-hg-bar-shine" />
            </div>
          </div>

          <div className="folder-hg-stats-grid">
            <div className="folder-hg-stat">
              <span className="folder-hg-stat-label">Tasks</span>
              <strong className="folder-hg-stat-val">
                {activeWorkStat
                  ? `${activeWorkStat.doneTasks} / ${activeWorkStat.tasksCount}`
                  : `${completedFolderTasks} / ${totalFolderTasks}`}
              </strong>
            </div>
            <div className="folder-hg-stat">
              <span className="folder-hg-stat-label">Works</span>
              <strong className="folder-hg-stat-val">
                {finishedWorksCount} / {projects.length} done
              </strong>
            </div>
            <div className="folder-hg-stat">
              <span className="folder-hg-stat-label">Sand Flow</span>
              <strong className="folder-hg-stat-val">
                {activeFinished ? "Full bottom" : isPouring ? "Pouring" : "Top reservoir"}
              </strong>
            </div>
          </div>
        </section>

        {/* Progress Files Breakdown List */}
        {projects.length > 0 && !selectedWorkId && (
          <div className="folder-hg-works-list">
            <h3 className="folder-hg-section-sub">Progress Files in Folder</h3>
            <div className="folder-hg-files-scroll">
              {worksStats.map((item) => (
                <button
                  key={item.project._id}
                  type="button"
                  className="folder-hg-file-row"
                  onClick={() => setSelectedWorkId(item.project._id)}
                >
                  <div className="folder-hg-file-meta">
                    <span className="folder-hg-file-name">{item.project.name}</span>
                    <span className="folder-hg-file-pct">
                      {Math.round(item.ratio * 100)}%
                    </span>
                  </div>
                  <div className="folder-hg-mini-track">
                    <div
                      className="folder-hg-mini-fill"
                      style={{ width: `${Math.round(item.ratio * 100)}%` }}
                    />
                  </div>
                  <span className="folder-hg-file-hint">
                    {item.tasksCount > 0
                      ? `${item.doneTasks}/${item.tasksCount} tasks`
                      : item.isFinished
                      ? "Finished"
                      : "Click to focus"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <footer className="folder-hg-footer">
          {activeWorkStat && onOpenWork && (
            <button
              type="button"
              className="folder-hg-action-btn primary"
              onClick={() => {
                onClose?.();
                onOpenWork?.(activeWorkStat.project);
              }}
            >
              Open &quot;{activeWorkStat.project.name}&quot;
            </button>
          )}
          <button
            type="button"
            className="folder-hg-action-btn secondary"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

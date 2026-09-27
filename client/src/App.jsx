import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Hourglass from "./components/Hourglass.jsx";
import PourButton from "./components/PourButton.jsx";
import ProjectPanel from "./components/ProjectPanel.jsx";
import DonePopup from "./components/DonePopup.jsx";
import DailyReviewModal from "./components/DailyReviewModal.jsx";
import SelectedStack from "./components/SelectedStack.jsx";
import TodayWorksModal from "./components/TodayWorksModal.jsx";
import SocialPage from "./components/SocialPage.jsx";
import MessagesPage from "./components/MessagesPage.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import ShareProjectModal from "./components/ShareProjectModal.jsx";
import {
  createProject,
  deleteProject,
  fetchHealth,
  fetchProjects,
  updateProject,
} from "./api.js";
import { projectDuration } from "./lib/time.js";
import {
  applyDailyReviewForce,
  clearDailyWorkIds,
  getDailyWorkIds,
  incompleteImportant,
  loadDailySelectedIds,
  markDailyReviewDone,
  saveDailySelectedIds,
  saveDailyWorkIds,
  shouldShowDailyReview,
} from "./lib/dailyReview.js";
import "./App.css";

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.75);
  } catch (error){
    console.error( error);
  }
}

function workTime(project) {
  return new Date(project.lastWorkedAt || project.createdAt || 0).getTime();
}

function upsertProject(list, project) {
  const next = list.filter((p) => p._id !== project._id);
  next.unshift(project);
  return next.sort((a, b) => workTime(b) - workTime(a));
}

function patchProject(list, project) {
  return list.map((p) => (p._id === project._id ? project : p));
}

export default function App() {
  const [durationMs, setDurationMs] = useState(30_000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeName, setActiveName] = useState("");
  const [newName, setNewName] = useState("");
  const [storage, setStorage] = useState("mongodb");
  const [apiError, setApiError] = useState("");
  const [needsCompleteSave, setNeedsCompleteSave] = useState(false);
  const [topicPopup, setTopicPopup] = useState(null);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => loadDailySelectedIds());
  const [worksPickerId, setWorksPickerId] = useState(null);
  const [page, setPage] = useState("progress");
  const [shareOpen, setShareOpen] = useState(false);
  const [socialGroupId, setSocialGroupId] = useState(null);
  const [messagesThreadId, setMessagesThreadId] = useState(null);
  const reviewStartedRef = useRef(false);

  const pouringRef = useRef(false);
  const elapsedRef = useRef(0);
  const durationRef = useRef(durationMs);
  const completedRef = useRef(false);
  const activeIdRef = useRef(null);
  const projectsRef = useRef([]);
  const pourIntentRef = useRef(false);

  pouringRef.current = pouring;
  elapsedRef.current = elapsedMs;
  durationRef.current = durationMs;
  completedRef.current = completed;
  activeIdRef.current = activeId;
  projectsRef.current = projects;

  const applyProject = useCallback((project) => {
    const duration = projectDuration(project);
    const elapsed = Math.min(project.elapsedMs, duration);
    const done = elapsed >= duration;
    activeIdRef.current = project._id;
    durationRef.current = duration;
    elapsedRef.current = elapsed;
    completedRef.current = done;
    pouringRef.current = false;
    setActiveId(project._id);
    setActiveName(project.name);
    setDurationMs(duration);
    setElapsedMs(elapsed);
    setCompleted(done);
    setPouring(false);
  }, []);

  const snapshot = useCallback(
    () => ({
      durationMs: durationRef.current,
      elapsedMs: Math.round(elapsedRef.current),
      completed: elapsedRef.current >= durationRef.current,
    }),
    []
  );

  const saveCurrent = useCallback(
    async (bump = false) => {
      const id = activeIdRef.current;
      if (!id) return null;
      try {
        const updated = await updateProject(id, { ...snapshot(), bump });
        setProjects((list) =>
          bump ? upsertProject(list, updated) : patchProject(list, updated)
        );
        setApiError("");
        return updated;
      } catch (err) {
        setApiError(err.message);
        return null;
      }
    },
    [snapshot]
  );

  const finishDailyReview = useCallback(() => {
    setReviewQueue([]);
    setReviewIndex(0);
    markDailyReviewDone();
  }, []);

  const advanceReview = useCallback(
    (selectCurrent) => {
      const current = reviewQueue[reviewIndex];
      if (selectCurrent && current) {
        setSelectedIds((ids) => {
          if (ids.includes(current._id)) return ids;
          const next = [...ids, current._id];
          saveDailySelectedIds(next);
          return next;
        });
      }
      if (reviewIndex + 1 >= reviewQueue.length) {
        finishDailyReview();
      } else {
        setReviewIndex((i) => i + 1);
      }
    },
    [finishDailyReview, reviewIndex, reviewQueue]
  );

  const previousReview = useCallback(() => {
    if (reviewIndex <= 0) return;
    setWorksPickerId(null);
    const prev = reviewQueue[reviewIndex - 1];
    if (prev) {
      clearDailyWorkIds(prev._id);
      setSelectedIds((ids) => {
        const next = ids.filter((id) => id !== prev._id);
        saveDailySelectedIds(next);
        return next;
      });
    }
    setReviewIndex((i) => i - 1);
  }, [reviewIndex, reviewQueue]);

  const beginSelectWithWorks = useCallback(() => {
    const current = reviewQueue[reviewIndex];
    if (!current) return;
    if ((current.topics || []).length > 0) {
      setWorksPickerId(current._id);
      return;
    }
    saveDailyWorkIds(current._id, []);
    advanceReview(true);
  }, [advanceReview, reviewIndex, reviewQueue]);

  const loadProjects = useCallback(async () => {
    try {
      const [health, list] = await Promise.all([fetchHealth(), fetchProjects()]);
      setStorage(health.storage || "file");
      setProjects(list);
      setApiError("");
      if (!activeIdRef.current && list[0]) applyProject(list[0]);

      const forced = applyDailyReviewForce();
      if (forced) setSelectedIds([]);

      if (!reviewStartedRef.current && (forced || shouldShowDailyReview())) {
        reviewStartedRef.current = true;
        const queue = incompleteImportant(list);
        if (queue.length === 0) {
          markDailyReviewDone();
        } else {
          setReviewQueue(queue);
          setReviewIndex(0);
        }
      }
    } catch {
      setApiError("API offline — start the Express server on port 5000.");
    }
  }, [applyProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let raf;
    let last = performance.now();

    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (pouringRef.current && !completedRef.current) {
        const next = Math.min(elapsedRef.current + dt, durationRef.current);
        elapsedRef.current = next;
        setElapsedMs(next);
        if (next >= durationRef.current) {
          pouringRef.current = false;
          completedRef.current = true;
          setPouring(false);
          setCompleted(true);
          setNeedsCompleteSave(true);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!needsCompleteSave) return;
    setNeedsCompleteSave(false);
    playChime();
    saveCurrent(true);
  }, [needsCompleteSave, saveCurrent]);

  useEffect(() => {
    if (!pouring || !activeId) return;
    const timer = setInterval(() => {
      saveCurrent(true);
    }, 1500);
    return () => clearInterval(timer);
  }, [pouring, activeId, saveCurrent]);

  const ensureProject = useCallback(async () => {
    if (activeIdRef.current) return activeIdRef.current;
    const count = projectsRef.current.length + 1;
    const created = await createProject({
      name: `Project ${count}`,
      durationMs: durationRef.current,
      elapsedMs: 0,
      completed: false,
    });
    setProjects((list) => upsertProject(list, created));
    applyProject(created);
    return created._id;
  }, [applyProject]);

  const startPour = async () => {
    if (completedRef.current) return;
    pourIntentRef.current = true;
    try {
      await ensureProject();
      if (pourIntentRef.current && !completedRef.current) {
        setApiError("");
        setPouring(true);
      }
    } catch (err) {
      setApiError(err.message);
    }
  };

  const stopPour = () => {
    pourIntentRef.current = false;
    setPouring(false);
    saveCurrent(true);
  };

  const handleCreate = async () => {
    try {
      await saveCurrent(false);
      const count = projectsRef.current.length + 1;
      const name = newName.trim() || `Project ${count}`;
      const created = await createProject({
        name,
        durationMs: durationRef.current,
        elapsedMs: 0,
        completed: false,
      });
      setNewName("");
      setProjects((list) => upsertProject(list, created));
      applyProject(created);
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleSelect = async (project) => {
    if (project._id === activeIdRef.current) return;
    const worked = pouringRef.current;
    pourIntentRef.current = false;
    pouringRef.current = false;
    setPouring(false);
    await saveCurrent(worked);
    applyProject(project);
  };

  const handleConfirmDailyWorks = (topicIds) => {
    if (!worksPickerId) return;
    saveDailyWorkIds(worksPickerId, topicIds);
    setWorksPickerId(null);
    advanceReview(true);
  };

  const handleSkipDailyWorks = () => {
    if (!worksPickerId) return;
    saveDailyWorkIds(worksPickerId, []);
    setWorksPickerId(null);
    advanceReview(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteProject(id);
      const remaining = projectsRef.current.filter((p) => p._id !== id);
      setProjects(remaining);
      setTopicPopup((open) => (open?.projectId === id ? null : open));
      if (activeIdRef.current === id) {
        if (remaining[0]) applyProject(remaining[0]);
        else {
          activeIdRef.current = null;
          elapsedRef.current = 0;
          completedRef.current = false;
          pouringRef.current = false;
          setActiveId(null);
          setActiveName("");
          setElapsedMs(0);
          setCompleted(false);
          setPouring(false);
        }
      }
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const reset = async () => {
    pouringRef.current = false;
    completedRef.current = false;
    elapsedRef.current = 0;
    setPouring(false);
    setCompleted(false);
    setElapsedMs(0);
    await saveCurrent(true);
  };

  const progress = Math.min(1, elapsedMs / durationMs);
  const shareProject =
    projects.find((p) => p._id === activeId) ||
    (activeName ? { _id: activeId, name: activeName } : null);
  const regularProjects = projects.filter((p) => !p.important);
  const importantProjects = projects
    .filter((p) => p.important)
    .sort((a, b) => {
      const sb = Number(b.stars) || 0;
      const sa = Number(a.stars) || 0;
      if (sb !== sa) return sb - sa;
      return workTime(b) - workTime(a);
    });
  const selectedProjects = selectedIds
    .map((id) => projects.find((p) => p._id === id))
    .filter(Boolean);
  const reviewProject = reviewQueue[reviewIndex] || null;

  const handleToggleImportant = async (project, makeImportant) => {
    try {
      const updated = await updateProject(project._id, {
        important: makeImportant,
      });
      setProjects((list) => patchProject(list, updated));
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleSetStars = async (project, stars) => {
    try {
      const updated = await updateProject(project._id, { stars });
      setProjects((list) => patchProject(list, updated));
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleOpenTopics = (project, rect, view = "all") => {
    const width = 260;
    const gap = 8;
    const spaceRight = window.innerWidth - rect.right;
    const x = spaceRight > width + 16 ? rect.right + gap : rect.left - width - gap;

    applyProject(project);

    if (view === "today") {
      setTopicPopup({
        projectId: project._id,
        x,
        y: rect.top,
        mode: "today",
        topicIds: getDailyWorkIds(project._id) || [],
      });
      return;
    }

    setTopicPopup({
      projectId: project._id,
      x,
      y: rect.top,
      mode: "all",
      topicIds: null,
    });
  };

  const handleAddTopic = async (projectId, text) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const topics = [
      ...(project.topics || []),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, done: true },
    ];
    try {
      const updated = await updateProject(projectId, { topics });
      setProjects((list) => patchProject(list, updated));
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleRemoveTopic = async (projectId, topicId) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const topics = (project.topics || []).filter((t) => t.id !== topicId);
    try {
      const updated = await updateProject(projectId, { topics });
      setProjects((list) => patchProject(list, updated));
      setApiError("");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const popupProject = topicPopup
    ? projects.find((p) => p._id === topicPopup.projectId)
    : null;
  const worksPickerProject = worksPickerId
    ? projects.find((p) => p._id === worksPickerId)
    : null;

  return (
    <div className="app">
      <Navbar
        storage={storage}
        activeName={activeName}
        page={page}
        onNavigate={(next) => {
          if (next !== "social") setSocialGroupId(null);
          if (next !== "messages") setMessagesThreadId(null);
          setPage(next);
        }}
      />

      {page === "social" ? (
        <SocialPage key={socialGroupId || "social"} initialGroupId={socialGroupId} />
      ) : page === "messages" ? (
        <MessagesPage
          key={messagesThreadId || "messages"}
          initialThreadId={messagesThreadId}
        />
      ) : page === "profile" ? (
        <ProfilePage
          projects={projects}
          activeId={activeId}
          onOpenProject={(project) => {
            handleSelect(project);
            setPage("progress");
          }}
        />
      ) : (
      <div className="layout">
        <div className="left-col">
          <div id="selected-panel">
            <SelectedStack
              projects={selectedProjects}
              activeId={activeId}
              onSelect={handleSelect}
              onOpenTopics={(project, rect) => handleOpenTopics(project, rect, "today")}
            />
          </div>
          <div id="projects-panel">
            <ProjectPanel
              title="Projects"
              projects={regularProjects}
              activeId={activeId}
              storage={storage}
              showStorage
              showCreate
              newName={newName}
              onNewName={setNewName}
              onCreate={handleCreate}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onToggleImportant={handleToggleImportant}
              importantAction="add"
              emptyText="Create a project, pour as you work, then save another. Star a project to move it to Important. Double-click a project to list what work to do."
              onOpenTopics={(project, rect) => handleOpenTopics(project, rect, "all")}
            />
          </div>
        </div>

        <main className="stage" id="stage">
          <p className="active-project">
            {activeName ? `Working on ${activeName}` : "No project yet — pour or save one"}
          </p>
          <div className="glass-row">
            <div className="glass-wrap">
              <Hourglass
                progress={progress}
                pouring={pouring}
                finished={completed}
              />
            </div>
            <PourButton
              pouring={pouring}
              disabled={completed}
              onPress={startPour}
              onRelease={stopPour}
              onReset={reset}
            />
          </div>

          <div className="progress-done">
            <div className="progress-done-label">
              <span>Done</span>
              <strong>{Math.round(progress * 100)}%</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Progress done"
            >
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            {completed && (
              <button
                type="button"
                className="share-done-btn"
                onClick={() => setShareOpen(true)}
              >
                Share
              </button>
            )}
          </div>

          <p className="status">
            {completed
              ? `${activeName || "This project"} is finished.`
              : pouring
                ? `Marking progress on ${activeName || "a new project"}…`
                : elapsedMs > 0
                  ? "Paused — progress is saved. Hold POUR to continue."
                  : "Idle — hold POUR to mark work on this project."}
          </p>
          {apiError && <p className="api-error">{apiError}</p>}
        </main>

        <div className="right-col" id="important-panel">
          <ProjectPanel
            title="Important"
            projects={importantProjects}
            activeId={activeId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onToggleImportant={handleToggleImportant}
            importantAction="remove"
            emptyText="Star a project on the left to keep it here. Use up to 5 stars to set priority."
            onOpenTopics={(project, rect) => handleOpenTopics(project, rect, "all")}
            onSetStars={handleSetStars}
          />
        </div>
      </div>
      )}
      {worksPickerProject && (
        <TodayWorksModal
          project={worksPickerProject}
          onConfirm={handleConfirmDailyWorks}
          onSkip={handleSkipDailyWorks}
        />
      )}
      {!worksPickerProject && reviewProject && (
        <DailyReviewModal
          project={reviewProject}
          index={reviewIndex}
          total={reviewQueue.length}
          onSelect={beginSelectWithWorks}
          onSkip={() => advanceReview(false)}
          onPrevious={previousReview}
        />
      )}
      {popupProject && (
        <DonePopup
          project={popupProject}
          x={topicPopup.x}
          y={topicPopup.y}
          mode={topicPopup.mode || "all"}
          topicIds={topicPopup.topicIds}
          onClose={() => setTopicPopup(null)}
          onAdd={handleAddTopic}
          onRemove={handleRemoveTopic}
        />
      )}
      {shareOpen && (
        <ShareProjectModal
          project={shareProject}
          onClose={() => setShareOpen(false)}
          onPosted={(post, meta) => {
            setShareOpen(false);
            if (meta?.target === "groups" && meta.groupId) {
              setSocialGroupId(meta.groupId);
              setMessagesThreadId(null);
              setPage("social");
            } else if (meta?.target === "messages" && meta.threadId) {
              setMessagesThreadId(meta.threadId);
              setSocialGroupId(null);
              setPage("messages");
            } else {
              setSocialGroupId(null);
              setMessagesThreadId(null);
              setPage("social");
            }
          }}
        />
      )}
    </div>
  );
}

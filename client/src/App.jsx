import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import AuthPage from "./components/AuthPage.jsx";
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
import TopicShareModal from "./components/TopicShareModal.jsx";
import {
  createProject,
  deleteProject,
  fetchHealth,
  fetchMe,
  fetchProjects,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateProject,
} from "./api.js";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  saveAuthSession,
} from "./lib/auth.js";
import { projectDuration, elapsedFromWorks } from "./lib/time.js";
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
import {
  countSharesForTopic,
  deleteSharesForTopic,
  persistTopicSourceProof,
  prepareTopicsForSave,
  restoreProjectsTopicMedia,
} from "./lib/socialFeed.js";
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
  const [authUser, setAuthUser] = useState(() =>
    getAuthToken() ? getAuthUser() : null
  );
  const [authReady, setAuthReady] = useState(() => !getAuthToken());
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
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
  const [shareSeed, setShareSeed] = useState(null);
  const [topicShare, setTopicShare] = useState(null);
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
  const pourTargetRef = useRef(null);
  const topicPopupRef = useRef(null);
  const worksPourBaselineRef = useRef(null);
  const saveCurrentRef = useRef(null);

  pouringRef.current = pouring;
  topicPopupRef.current = topicPopup;
  // Do not sync elapsedRef from state here — the pour RAF owns it while pouring.
  // Syncing every render was resetting progress between frames.
  if (!pouringRef.current && pourTargetRef.current == null) {
    elapsedRef.current = elapsedMs;
  }
  durationRef.current = durationMs;
  completedRef.current = completed;
  activeIdRef.current = activeId;
  projectsRef.current = projects;

  const applyProject = useCallback((project) => {
    let duration = projectDuration(project);
    // Old shared-from-post templates used 30 minutes; pour looked frozen.
    if (!duration || duration <= 0 || duration === 30 * 60 * 1000) {
      duration = 30_000;
    }
    const topics = Array.isArray(project.topics) ? project.topics : [];
    const rawElapsed = Number(project.elapsedMs) || 0;
    // When works exist, sand follows tick ratio (e.g. 1/2 = 50%).
    const elapsed =
      topics.length > 0
        ? elapsedFromWorks(topics, duration)
        : Math.min(rawElapsed, duration);
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

    // Persist corrected duration / works-based progress if stored value was wrong
    if (
      project.durationMs !== duration ||
      (topics.length > 0 && Math.round(rawElapsed) !== elapsed)
    ) {
      void updateProject(project._id, {
        durationMs: duration,
        elapsedMs: elapsed,
        completed: done,
      })
        .then((updated) => {
          setProjects((list) => patchProject(list, updated));
        })
        .catch(() => {});
    }
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
  saveCurrentRef.current = saveCurrent;

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
      const withMedia = await restoreProjectsTopicMedia(list);
      setProjects(withMedia);
      setApiError("");
      if (!activeIdRef.current && withMedia[0]) applyProject(withMedia[0]);

      const forced = applyDailyReviewForce();
      if (forced) setSelectedIds([]);

      if (!reviewStartedRef.current && (forced || shouldShowDailyReview())) {
        reviewStartedRef.current = true;
        const queue = incompleteImportant(withMedia);
        if (queue.length === 0) {
          markDailyReviewDone();
        } else {
          setReviewQueue(queue);
          setReviewIndex(0);
        }
      }
    } catch (err) {
      const msg = err?.message || "";
      if (/sign in|session/i.test(msg)) {
        setAuthUser(null);
        return;
      }
      setApiError("API offline — start the Express server on port 5000.");
    }
  }, [applyProject]);

  useEffect(() => {
    const onCleared = () => setAuthUser(null);
    window.addEventListener("sandadd:auth-cleared", onCleared);
    return () => window.removeEventListener("sandadd:auth-cleared", onCleared);
  }, []);

  useEffect(() => {
    let alive = true;
    const token = getAuthToken();
    if (!token) {
      setAuthReady(true);
      setAuthUser(null);
      return undefined;
    }
    fetchMe()
      .then((data) => {
        if (!alive) return;
        saveAuthSession({ token, user: data.user });
        setAuthUser(data.user);
      })
      .catch(() => {
        if (!alive) return;
        clearAuthSession();
        setAuthUser(null);
      })
      .finally(() => {
        if (alive) setAuthReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadProjects();
  }, [authUser, loadProjects]);

  const handleAuthSubmit = async ({ mode, name, email, password }) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const data =
        mode === "register"
          ? await registerAccount({ name, email, password })
          : await loginAccount({ email, password });
      saveAuthSession(data);
      setAuthUser(data.user);
      reviewStartedRef.current = false;
    } catch (err) {
      setAuthError(err.message || "Could not authenticate.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAccount();
    } catch {
      clearAuthSession();
    }
    setAuthUser(null);
    setProjects([]);
    setActiveId(null);
    setActiveName("");
    setPage("progress");
    reviewStartedRef.current = false;
  };
  useEffect(() => {
    let raf;
    let last = performance.now();

    const tick = (now) => {
      const dt = now - last;
      last = now;
      const duration = durationRef.current;
      const target = pourTargetRef.current;

      if (target != null && duration > 0) {
        const cur = elapsedRef.current;
        const diff = target - cur;
        // Slow auto-pour from works ticks (~8s for a full glass)
        const rate = Math.max(duration / 8000, 0.15);
        const stepBudget = rate * dt;

        if (Math.abs(diff) <= stepBudget || Math.abs(diff) < 1) {
          elapsedRef.current = target;
          setElapsedMs(target);
          pourTargetRef.current = null;
          pouringRef.current = false;
          setPouring(false);
          const done = target >= duration - 0.5;
          completedRef.current = done;
          setCompleted(done);
          // Save quietly — no chime for works-based pour
          void saveCurrentRef.current?.(true);
        } else {
          const next = cur + Math.sign(diff) * stepBudget;
          elapsedRef.current = next;
          setElapsedMs(next);
          completedRef.current = false;
          setCompleted(false);
          // Stream only while sand is falling (progress up)
          const shouldPour = diff > 0;
          if (pouringRef.current !== shouldPour) {
            pouringRef.current = shouldPour;
            setPouring(shouldPour);
          }
        }
      } else if (pouringRef.current && !completedRef.current) {
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
      name: `Work ${count}`,
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
        // Set ref immediately so RAF starts pouring before React re-renders
        pouringRef.current = true;
        setPouring(true);
      }
    } catch (err) {
      setApiError(err.message);
    }
  };

  const stopPour = () => {
    pourIntentRef.current = false;
    pouringRef.current = false;
    setPouring(false);
    saveCurrent(true);
  };

  const handleCreate = async () => {
    try {
      await saveCurrent(false);
      const count = projectsRef.current.length + 1;
      const name = newName.trim() || `Work ${count}`;
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

  const progress =
    durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0;
  const shareProject =
    (shareSeed?.projectId &&
      projects.find((p) => p._id === shareSeed.projectId)) ||
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

    pourTargetRef.current = null;
    pouringRef.current = false;
    setPouring(false);
    applyProject(project);

    worksPourBaselineRef.current = {
      projectId: project._id,
      fromElapsed: elapsedRef.current,
    };

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

  const startWorksPour = useCallback((projectId) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;

    let duration = projectDuration(project);
    if (!duration || duration <= 0 || duration === 30 * 60 * 1000) {
      duration = 30_000;
    }
    const topics = Array.isArray(project.topics) ? project.topics : [];
    const target = elapsedFromWorks(topics, duration);
    const baseline = worksPourBaselineRef.current;
    const fromElapsed =
      baseline?.projectId === projectId
        ? baseline.fromElapsed
        : activeIdRef.current === projectId
          ? elapsedRef.current
          : Number(project.elapsedMs) || 0;

    worksPourBaselineRef.current = null;
    pourTargetRef.current = null;
    pouringRef.current = false;
    setPouring(false);

    activeIdRef.current = projectId;
    durationRef.current = duration;
    elapsedRef.current = fromElapsed;
    completedRef.current = false;
    setActiveId(projectId);
    setActiveName(project.name);
    setDurationMs(duration);
    setElapsedMs(fromElapsed);
    setCompleted(false);

    if (Math.abs(target - fromElapsed) < 1) {
      elapsedRef.current = target;
      setElapsedMs(target);
      const done = topics.length > 0 && target >= duration - 0.5;
      completedRef.current = done;
      setCompleted(done);
      return;
    }

    pourTargetRef.current = target;
  }, []);

  const closeTopicPopup = useCallback(() => {
    const id = topicPopupRef.current?.projectId;
    setTopicPopup(null);
    if (id) startWorksPour(id);
  }, [startWorksPour]);

  const applyWorksProgress = useCallback(
    async (projectId, topics) => {
      const project = projectsRef.current.find((p) => p._id === projectId);
      if (!project) return null;
      const duration = projectDuration(project) || durationRef.current || 30_000;
      const elapsedMs = elapsedFromWorks(topics, duration);
      const completed = topics.length > 0 && elapsedMs >= duration;
      const popupOpen = topicPopupRef.current?.projectId === projectId;
      try {
        const topicsForSave = await prepareTopicsForSave(topics);
        const updated = await updateProject(projectId, {
          topics: topicsForSave,
          durationMs: duration,
          elapsedMs,
          completed,
        });
        // Keep in-memory source file dataUrls for instant open
        const mergedTopics = (updated.topics || topicsForSave).map((t) => {
          const local = topics.find((x) => x.id === t.id);
          if (local?.sourceProof?.dataUrl) {
            return { ...t, sourceProof: { ...t.sourceProof, ...local.sourceProof } };
          }
          return t;
        });
        const merged = { ...updated, topics: mergedTopics };
        setProjects((list) => patchProject(list, merged));
        setApiError("");

        // While the works popup is open, keep the glass still — pour on close
        if (activeIdRef.current === projectId && !popupOpen) {
          pourTargetRef.current = null;
          pouringRef.current = false;
          elapsedRef.current = elapsedMs;
          durationRef.current = duration;
          completedRef.current = completed;
          setPouring(false);
          setElapsedMs(elapsedMs);
          setDurationMs(duration);
          setCompleted(completed);
        }
        return merged;
      } catch (err) {
        setApiError(err.message);
        return null;
      }
    },
    []
  );
  const handleAddTopic = async (projectId, text, sourceInfo = {}) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const source =
      typeof sourceInfo === "string"
        ? sourceInfo
        : String(sourceInfo?.source || "").trim();
    const sourceProof =
      typeof sourceInfo === "object" && sourceInfo?.sourceProof
        ? sourceInfo.sourceProof
        : null;
    const topics = [
      ...(project.topics || []),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        done: false,
        source: source.slice(0, 500),
        sourceProof,
      },
    ];
    await applyWorksProgress(projectId, topics);
  };

  const handleSetTopicSource = async (projectId, topicId, sourceInfo = {}) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const source =
      typeof sourceInfo === "string"
        ? sourceInfo
        : String(sourceInfo?.source || "").trim();
    const sourceProof =
      typeof sourceInfo === "object" ? sourceInfo?.sourceProof ?? null : null;
    const topics = (project.topics || []).map((t) =>
      t.id === topicId
        ? {
            ...t,
            source: source.slice(0, 500),
            sourceProof,
          }
        : t
    );
    await applyWorksProgress(projectId, topics);
  };

  const handleToggleTopic = async (projectId, topicId) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const current = (project.topics || []).find((t) => t.id === topicId);
    if (!current) return;
    const markingDone = !current.done;

    if (!markingDone) {
      const shareCount = countSharesForTopic(topicId);
      const ok = window.confirm(
        shareCount > 0
          ? "Delete the post uploaded while ticking this topic? The topic will only be unticked after that post is deleted."
          : "No shared post was found for this topic. Untick it anyway?"
      );
      if (!ok) return;
      if (shareCount > 0) deleteSharesForTopic(topicId);
    }

    const topics = (project.topics || []).map((t) =>
      t.id === topicId ? { ...t, done: !t.done } : t
    );
    const updated = await applyWorksProgress(projectId, topics);
    if (updated && markingDone) {
      const topic = (updated.topics || topics).find((t) => t.id === topicId);
      setTopicShare({
        projectId,
        topic: topic || { ...current, done: true },
      });
    }
  };

  const handleRemoveTopic = async (projectId, topicId) => {
    const project = projectsRef.current.find((p) => p._id === projectId);
    if (!project) return;
    const topics = (project.topics || []).filter((t) => t.id !== topicId);
    await applyWorksProgress(projectId, topics);
  };

  const popupProject = topicPopup
    ? projects.find((p) => p._id === topicPopup.projectId)
    : null;
  const topicShareProject = topicShare
    ? projects.find((p) => p._id === topicShare.projectId)
    : null;
  const worksPickerProject = worksPickerId
    ? projects.find((p) => p._id === worksPickerId)
    : null;

  if (!authReady) {
    return (
      <div className="app auth-boot" aria-busy="true">
        <p className="auth-boot-text">Loading…</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthPage
        busy={authBusy}
        error={authError}
        onClearError={() => setAuthError("")}
        onAuthed={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="app">
      <Navbar
        storage={storage}
        activeName={activeName}
        page={page}
        userName={authUser.name}
        onLogout={handleLogout}
        onNavigate={(next) => {
          if (next !== "social") setSocialGroupId(null);
          if (next !== "messages") setMessagesThreadId(null);
          setPage(next);
        }}
      />

      {page === "social" ? (
        <SocialPage
          key={socialGroupId || "social"}
          initialGroupId={socialGroupId}
          onAddSharedProject={async (template) => {
            const durationMs = durationRef.current || 30_000;
            const topics = Array.isArray(template.works)
              ? template.works.map((w, index) => ({
                  id: w.id || `t-${Date.now()}-${index}`,
                  text: w.text,
                  done: false,
                  source: String(w.source || "").trim().slice(0, 500),
                  sourceProof: w.sourceProof || null,
                }))
              : [];
            for (const t of topics) {
              if (t.sourceProof?.dataUrl) {
                await persistTopicSourceProof(t.sourceProof);
              }
            }
            const created = await createProject({
              name: template.name,
              durationMs,
              elapsedMs: 0,
              completed: false,
              topics: await prepareTopicsForSave(topics),
            });
            const merged = {
              ...created,
              topics: (created.topics || []).map((t) => {
                const local = topics.find((x) => x.id === t.id || x.text === t.text);
                if (local?.sourceProof?.dataUrl) {
                  return {
                    ...t,
                    sourceProof: { ...t.sourceProof, ...local.sourceProof },
                  };
                }
                return t;
              }),
            };
            setProjects((list) => upsertProject(list, merged));
            applyProject(merged);
            setPage("progress");
          }}
        />
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
        <div id="selected-panel" className="layout-selected">
          <SelectedStack
            projects={selectedProjects}
            activeId={activeId}
            onSelect={handleSelect}
            onOpenTopics={(project, rect) => handleOpenTopics(project, rect, "today")}
          />
        </div>

        <main className="stage layout-stage" id="stage">
          <p className="active-project">
            {activeName ? `Working on ${activeName}` : "No work yet — pour or save one"}
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
                onClick={() => {
                  setShareSeed(null);
                  setShareOpen(true);
                }}
              >
                Share
              </button>
            )}
          </div>

          <p className="status">
            {completed
              ? `${activeName || "This work"} is finished.`
              : pouring
                ? `Marking progress on ${activeName || "a new work"}…`
                : elapsedMs > 0
                  ? "Paused — progress is saved. Hold POUR to continue."
                  : "Idle — hold POUR to mark progress on this work."}
          </p>
          {apiError && <p className="api-error">{apiError}</p>}
        </main>

        <div id="projects-panel" className="layout-projects">
          <ProjectPanel
            title="Works"
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
            emptyText="Create a work, pour as you go, then save another. Star a work to move it to Important. Double-click a work to list what to do."
            onOpenTopics={(project, rect) => handleOpenTopics(project, rect, "all")}
          />
        </div>

        <div className="layout-important" id="important-panel">
          <ProjectPanel
            title="Important"
            projects={importantProjects}
            activeId={activeId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onToggleImportant={handleToggleImportant}
            importantAction="remove"
            emptyText="Star a work to keep it here. Use up to 5 stars to set priority."
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
          onClose={closeTopicPopup}
          onAdd={handleAddTopic}
          onRemove={handleRemoveTopic}
          onToggle={handleToggleTopic}
          onSetSource={handleSetTopicSource}
        />
      )}
      {topicShareProject && topicShare && (
        <TopicShareModal
          topic={topicShare.topic}
          onClose={() => setTopicShare(null)}
          onShare={(proof) => {
            const topicText = topicShare.topic?.text || "a work item";
            const projectId = topicShare.projectId;
            setShareSeed({
              projectId,
              topicId: topicShare.topic?.id || null,
              proof: proof || null,
              caption: `Finished: ${topicText}`,
            });
            setTopicShare(null);
            setTopicPopup(null);
            setShareOpen(true);
            if (projectId) startWorksPour(projectId);
          }}
        />
      )}
      {shareOpen && (
        <ShareProjectModal
          project={shareProject}
          initialProof={shareSeed?.proof || null}
          initialCaption={shareSeed?.caption || null}
          topicId={shareSeed?.topicId || null}
          onClose={() => {
            setShareOpen(false);
            setShareSeed(null);
          }}
          onPosted={(post, meta) => {
            setShareOpen(false);
            setShareSeed(null);
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

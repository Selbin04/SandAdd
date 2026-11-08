/**
 * Scheduled Progress Files & AI Workspace Store
 * Manages drafts, scheduled auto-pushes, and cover presets.
 */

const STORAGE_KEY = "sandadd.workspace_drafts";

export const COVER_PRESETS = [
  {
    id: "space",
    name: "Deep Cosmos",
    gradient: "linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #0369a1 100%)",
    textColor: "#38bdf8",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_space" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="50%" stop-color="#1e1b4b" />
          <stop offset="100%" stop-color="#0369a1" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_space)" />
      <circle cx="120" cy="80" r="1.5" fill="#ffffff" opacity="0.85" />
      <circle cx="480" cy="140" r="2.2" fill="#38bdf8" opacity="0.95" />
      <circle cx="280" cy="220" r="1.5" fill="#ffffff" opacity="0.7" />
      <circle cx="510" cy="60" r="1.8" fill="#e0e7ff" opacity="0.8" />
      <circle cx="90" cy="240" r="2" fill="#38bdf8" opacity="0.75" />
      <path d="M-50,260 Q150,180 300,240 T650,200" fill="none" stroke="rgba(56,189,248,0.3)" stroke-width="2" />
    </svg>`,
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    gradient: "linear-gradient(135deg, #831843 0%, #b45309 50%, #ea580c 100%)",
    textColor: "#fdba74",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_sunset" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#831843" />
          <stop offset="50%" stop-color="#b45309" />
          <stop offset="100%" stop-color="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_sunset)" />
      <circle cx="490" cy="75" r="50" fill="rgba(254,215,170,0.18)" />
      <circle cx="490" cy="75" r="28" fill="rgba(254,215,170,0.32)" />
      <path d="M0,250 C180,210 320,280 600,220 L600,300 L0,300 Z" fill="rgba(0,0,0,0.22)" />
    </svg>`,
  },
  {
    id: "neon",
    name: "Cyber Emerald",
    gradient: "linear-gradient(135deg, #022c22 0%, #065f46 50%, #059669 100%)",
    textColor: "#34d399",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_neon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#022c22" />
          <stop offset="50%" stop-color="#065f46" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_neon)" />
      <path d="M50,290 L120,160 L190,290 Z" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="2" />
      <path d="M420,290 L480,180 L540,290 Z" fill="none" stroke="rgba(52,211,153,0.3)" stroke-width="2" />
      <circle cx="300" cy="120" r="40" fill="none" stroke="rgba(52,211,153,0.2)" stroke-width="1.5" />
    </svg>`,
  },
  {
    id: "forest",
    name: "Forest Mist",
    gradient: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)",
    textColor: "#a7f3d0",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_forest" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#064e3b" />
          <stop offset="50%" stop-color="#047857" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_forest)" />
      <circle cx="150" cy="180" r="60" fill="rgba(167,243,208,0.14)" />
      <circle cx="380" cy="110" r="90" fill="rgba(167,243,208,0.1)" />
      <path d="M0,280 Q300,200 600,280" fill="none" stroke="rgba(167,243,208,0.2)" stroke-width="2" />
    </svg>`,
  },
  {
    id: "royal",
    name: "Royal Violet",
    gradient: "linear-gradient(135deg, #3b0764 0%, #6b21a8 50%, #a21caf 100%)",
    textColor: "#e879f9",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_royal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b0764" />
          <stop offset="50%" stop-color="#6b21a8" />
          <stop offset="100%" stop-color="#a21caf" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_royal)" />
      <rect x="80" y="50" width="120" height="120" rx="20" fill="none" stroke="rgba(232,121,249,0.25)" stroke-width="2" transform="rotate(25 140 110)" />
      <circle cx="460" cy="170" r="50" fill="none" stroke="rgba(232,121,249,0.28)" stroke-width="2" />
    </svg>`,
  },
  {
    id: "midnight",
    name: "Midnight Tech",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    textColor: "#94a3b8",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs>
        <linearGradient id="g_midnight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="50%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
      </defs>
      <rect width="600" height="300" fill="url(#g_midnight)" />
      <line x1="0" y1="50" x2="600" y2="50" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
      <line x1="0" y1="150" x2="600" y2="150" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
      <line x1="0" y1="250" x2="600" y2="250" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
      <line x1="150" y1="0" x2="150" y2="300" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
      <line x1="350" y1="0" x2="350" y2="300" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
    </svg>`,
  },
];

export function getCoverPresetDataUrl(themeId = "space") {
  const preset = COVER_PRESETS.find((p) => p.id === themeId) || COVER_PRESETS[0];
  const svg = preset.svg.trim();
  try {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      const base64 = window.btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {
    // fallback to URI encoding
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getCoverPresetObject(themeId = "space") {
  const preset = COVER_PRESETS.find((p) => p.id === themeId) || COVER_PRESETS[0];
  return {
    dataUrl: getCoverPresetDataUrl(themeId),
    name: preset.name,
    themeId: preset.id,
    hasMedia: true,
    type: "image/svg+xml",
  };
}

export function readAllWorkspaceItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeAllWorkspaceItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("sandadd:workspace-updated"));
  } catch (err) {
    console.warn("Could not save workspace items:", err);
  }
}

export function getWorkspaceItems(projectId) {
  if (!projectId) return [];
  const all = readAllWorkspaceItems();
  const idStr = String(projectId);
  return all.filter((item) => String(item.projectId) === idStr);
}

export function saveWorkspaceItem(projectId, item) {
  if (!projectId || !item) return null;
  const all = readAllWorkspaceItems();
  const idStr = String(projectId);
  const newItem = {
    id: item.id || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    projectId: idStr,
    text: String(item.text || "Untitled Progress File").trim(),
    description: String(item.description || "").trim(),
    source: String(item.source || "").trim(),
    sourceTitle: String(item.sourceTitle || "").trim(),
    coverImage: item.coverImage || null,
    coverMode: item.coverMode === "full" ? "full" : "top",
    coverTheme: item.coverTheme || "space",
    scheduledAt: item.scheduledAt || null,
    status: item.scheduledAt ? "scheduled" : item.status || "draft",
    createdAt: item.createdAt || new Date().toISOString(),
    pushedAt: item.pushedAt || null,
  };

  const existingIdx = all.findIndex((x) => x.id === newItem.id);
  if (existingIdx >= 0) {
    all[existingIdx] = { ...all[existingIdx], ...newItem };
  } else {
    all.push(newItem);
  }
  writeAllWorkspaceItems(all);
  return newItem;
}

export function updateWorkspaceItem(id, updates) {
  if (!id) return null;
  const all = readAllWorkspaceItems();
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  const current = all[idx];
  const nextStatus = updates.scheduledAt
    ? "scheduled"
    : updates.scheduledAt === null
      ? "draft"
      : updates.status || current.status;

  const updated = {
    ...current,
    ...updates,
    status: nextStatus,
  };
  all[idx] = updated;
  writeAllWorkspaceItems(all);
  return updated;
}

export function deleteWorkspaceItem(id) {
  if (!id) return;
  const all = readAllWorkspaceItems();
  const filtered = all.filter((x) => x.id !== id);
  writeAllWorkspaceItems(filtered);
}

/**
 * Check and auto-push scheduled items whose scheduledAt <= now
 */
export function checkAndTriggerScheduled(projectId, onPushCallback) {
  if (!projectId || typeof onPushCallback !== "function") return [];
  const all = readAllWorkspaceItems();
  const idStr = String(projectId);
  const now = Date.now();
  const pushedItems = [];

  const nextItems = all.map((item) => {
    if (
      String(item.projectId) === idStr &&
      item.status === "scheduled" &&
      item.scheduledAt
    ) {
      const scheduledTime = new Date(item.scheduledAt).getTime();
      if (!isNaN(scheduledTime) && scheduledTime <= now) {
        // Trigger auto-push
        try {
          let coverPayload = item.coverImage;
          if (!coverPayload && item.coverTheme) {
            coverPayload = getCoverPresetObject(item.coverTheme);
          } else if (typeof coverPayload === "string") {
            const isPreset = COVER_PRESETS.some((p) => p.id === coverPayload);
            coverPayload = isPreset
              ? getCoverPresetObject(coverPayload)
              : {
                  dataUrl: coverPayload,
                  name: "Cover",
                  hasMedia: true,
                  type: coverPayload.startsWith("data:image/svg") ? "image/svg+xml" : "image/jpeg",
                  themeId: item.coverTheme || undefined,
                };
          } else if (coverPayload && typeof coverPayload === "object" && !coverPayload.dataUrl && (coverPayload.themeId || item.coverTheme)) {
            coverPayload = {
              ...coverPayload,
              dataUrl: getCoverPresetDataUrl(coverPayload.themeId || item.coverTheme),
              themeId: coverPayload.themeId || item.coverTheme,
            };
          }

          const desc = String(item.description || "").trim();
          const ref = String(item.source || "").trim();
          const scheduledSources = [];
          if (desc) {
            scheduledSources.push({
              id: `src-sched-desc-${item.id}`,
              title: "Description & Action Plan",
              type: "text",
              content: desc,
              proof: null,
            });
          }
          if (ref) {
            const isUrl = /^https?:\/\//i.test(ref) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(ref);
            scheduledSources.push({
              id: `src-sched-ref-${item.id}`,
              title: "Reference Resource",
              type: isUrl ? "link" : "text",
              content: ref,
              proof: null,
            });
          }
          const combinedSource = desc && ref
            ? `${desc}\n\nReference: ${ref}`
            : desc || ref;

          onPushCallback(item.text, {
            source: combinedSource,
            sourceTitle: item.sourceTitle || item.text,
            description: desc,
            sources: scheduledSources,
            coverImage: coverPayload,
            coverMode: item.coverMode || "top",
            hasCheckbox: true,
          });

          pushedItems.push(item);

          return {
            ...item,
            status: "pushed",
            pushedAt: new Date().toISOString(),
          };
        } catch (err) {
          console.error("Auto-push callback failed:", err);
          return item;
        }
      }
    }
    return item;
  });

  if (pushedItems.length > 0) {
    writeAllWorkspaceItems(nextItems);
    window.dispatchEvent(
      new CustomEvent("sandadd:scheduled-auto-pushed", {
        detail: { projectId: idStr, pushed: pushedItems },
      })
    );
  }

  return pushedItems;
}


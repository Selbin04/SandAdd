const TOKEN_KEY = "sandadd.authToken";
const USER_KEY = "sandadd.authUser";
const PROFILE_KEY = "sandadd.userProfile";

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function syncProfileFromUser(user) {
  if (!user) return;
  try {
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      } catch {
        return {};
      }
    })();
    const next = {
      name:
        typeof user.name === "string" && user.name.trim()
          ? user.name.trim()
          : existing.name || "SandAdd User",
      handle:
        typeof user.handle === "string" && user.handle.trim()
          ? user.handle.trim().replace(/^@/, "")
          : existing.handle || "sandadduser",
      bio: typeof existing.bio === "string" ? existing.bio : "I pour into what matters.",
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function saveAuthSession({ token, user }) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      syncProfileFromUser(user);
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sandadd:auth-cleared"));
  }
}

export function authHeaders(extra = {}) {
  const token = getAuthToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

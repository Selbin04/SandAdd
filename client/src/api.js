import { authHeaders, clearAuthSession } from "./lib/auth.js";

const API = "/api";

async function readJson(res, fallbackMessage, { clearOn401 = true } = {}) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && clearOn401) {
      // Stale / missing session — drop local token so the gate can show login
      clearAuthSession();
    }
    throw new Error(data.error || fallbackMessage);
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}

export async function registerAccount({ name, email, password }) {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return readJson(res, "Could not create account", { clearOn401: false });
}

export async function loginAccount({ email, password }) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return readJson(res, "Could not sign in", { clearOn401: false });
}

export async function fetchMe() {
  const res = await fetch(`${API}/auth/me`, {
    headers: authHeaders(),
  });
  return readJson(res, "Could not load session");
}

export async function logoutAccount() {
  const res = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  // Always clear local session even if the network call fails
  clearAuthSession();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not sign out");
  }
  return res.json().catch(() => ({ ok: true }));
}

export async function fetchProjects() {
  const res = await fetch(`${API}/projects`, {
    headers: authHeaders(),
  });
  return readJson(res, "Could not load works");
}

export async function createProject(payload) {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(res, "Could not create project");
}

export async function updateProject(id, payload) {
  const res = await fetch(`${API}/projects/${id}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return readJson(res, "Could not save project");
}

export async function deleteProject(id) {
  const res = await fetch(`${API}/projects/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return readJson(res, "Could not delete project");
}

export async function fetchLiveWorks(ids) {
  const list = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (list.length === 0) return { works: {}, progress: {} };
  const params = new URLSearchParams({ ids: list.join(",") });
  const res = await fetch(`${API}/live-works?${params}`, {
    headers: authHeaders(),
  });
  return readJson(res, "Could not load live works");
}

export async function putLiveWork(originId, payload) {
  const res = await fetch(`${API}/live-works/${encodeURIComponent(originId)}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload || {}),
  });
  return readJson(res, "Could not publish live work");
}

export async function deleteLiveWork(originId) {
  const res = await fetch(`${API}/live-works/${encodeURIComponent(originId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return readJson(res, "Could not remove live work");
}

export async function putLiveWorkProgress(originId, payload) {
  const res = await fetch(
    `${API}/live-works/${encodeURIComponent(originId)}/progress`,
    {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload || {}),
    }
  );
  return readJson(res, "Could not sync live progress");
}

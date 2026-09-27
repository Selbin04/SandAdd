import { Router } from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { memoryAuth } from "../authStore.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toHandle(name, email) {
  const fromName = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  if (fromName) return fromName;
  const fromEmail = String(email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return fromEmail || "sandadduser";
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name,
    handle: user.handle,
  };
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

export default function authRoutes(useMemory) {
  const router = Router();

  async function findByEmail(email) {
    const key = normalizeEmail(email);
    if (!key) return null;
    if (useMemory) return memoryAuth.findByEmail(key);
    return User.findOne({ email: key });
  }

  async function findById(id) {
    if (!id) return null;
    if (useMemory) return memoryAuth.findById(id);
    return User.findById(id);
  }

  async function createUser({ email, passwordHash, name, handle }) {
    if (useMemory) {
      return memoryAuth.create({ email, passwordHash, name, handle });
    }
    return User.create({ email, passwordHash, name, handle });
  }

  async function createSession(userId) {
    return memoryAuth.createSession(userId);
  }

  async function userFromToken(token) {
    const userId = await memoryAuth.sessionUserId(token);
    if (!userId) return null;
    return findById(userId);
  }

  router.post("/register", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");

      if (!name || name.length < 2) {
        return res.status(400).json({ error: "Enter a name (at least 2 characters)." });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Enter a valid email." });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }

      const existing = await findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const handle = toHandle(name, email);
      const user = await createUser({ email, passwordHash, name, handle });
      const token = await createSession(user._id || user.id);

      return res.status(201).json({ token, user: publicUser(user) });
    } catch (err) {
      console.error("register failed", err);
      return res.status(500).json({ error: "Could not create account." });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");

      if (!EMAIL_RE.test(email) || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const user = await findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const token = await createSession(user._id || user.id);
      return res.json({ token, user: publicUser(user) });
    } catch (err) {
      console.error("login failed", err);
      return res.status(500).json({ error: "Could not sign in." });
    }
  });

  router.get("/me", async (req, res) => {
    try {
      const token = readBearer(req);
      if (!token) {
        return res.status(401).json({ error: "Not signed in." });
      }
      const user = await userFromToken(token);
      if (!user) {
        return res.status(401).json({ error: "Session expired. Sign in again." });
      }
      return res.json({ user: publicUser(user) });
    } catch (err) {
      console.error("me failed", err);
      return res.status(500).json({ error: "Could not load session." });
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      const token = readBearer(req);
      if (token) await memoryAuth.destroySession(token);
      return res.json({ ok: true });
    } catch (err) {
      console.error("logout failed", err);
      return res.status(500).json({ error: "Could not sign out." });
    }
  });

  return router;
}

/** Express middleware — attach req.user when Bearer token is valid. */
export function requireAuth(useMemory) {
  return async (req, res, next) => {
    try {
      const token = readBearer(req);
      if (!token) {
        return res.status(401).json({ error: "Sign in required." });
      }
      const userId = await memoryAuth.sessionUserId(token);
      if (!userId) {
        return res.status(401).json({ error: "Session expired. Sign in again." });
      }
      let user = null;
      if (useMemory) {
        user = await memoryAuth.findById(userId);
      } else {
        user = await User.findById(userId);
      }
      if (!user) {
        return res.status(401).json({ error: "Session expired. Sign in again." });
      }
      req.user = publicUser(user);
      req.authToken = token;
      next();
    } catch (err) {
      console.error("auth middleware failed", err);
      return res.status(500).json({ error: "Auth check failed." });
    }
  };
}

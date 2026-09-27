import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(serverDir, process.env.DATA_DIR || "data");
const dataFile = path.join(dataDir, "users.json");

function load() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions:
        parsed.sessions && typeof parsed.sessions === "object"
          ? parsed.sessions
          : {},
      nextId: Number(parsed.nextId) || 1,
    };
  } catch {
    return { users: [], sessions: {}, nextId: 1 };
  }
}

function save(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        nextId: state.nextId,
        users: state.users,
        sessions: state.sessions,
      },
      null,
      2
    ),
    "utf8"
  );
}

const state = load();

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name,
    handle: user.handle,
  };
}

export const memoryAuth = {
  publicUser,

  async findByEmail(email) {
    const key = String(email || "").trim().toLowerCase();
    return state.users.find((u) => u.email === key) || null;
  },

  async findById(id) {
    const key = String(id);
    return state.users.find((u) => String(u._id) === key) || null;
  },

  async create({ email, passwordHash, name, handle }) {
    const now = new Date().toISOString();
    const user = {
      _id: String(state.nextId++),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      name: String(name).trim(),
      handle: String(handle).trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    state.users.push(user);
    save(state);
    return user;
  },

  async createSession(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    state.sessions[token] = {
      userId: String(userId),
      createdAt: new Date().toISOString(),
    };
    save(state);
    return token;
  },

  async sessionUserId(token) {
    if (!token) return null;
    const session = state.sessions[token];
    return session?.userId ? String(session.userId) : null;
  },

  async userFromToken(token) {
    const userId = await this.sessionUserId(token);
    if (!userId) return null;
    return this.findById(userId);
  },

  async destroySession(token) {
    if (!token || !state.sessions[token]) return;
    delete state.sessions[token];
    save(state);
  },
};

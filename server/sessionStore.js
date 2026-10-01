import { createHash, randomBytes } from "crypto";
import Session from "./models/Session.js";
import { memoryAuth } from "./authStore.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId, useMemory) {
  if (useMemory) return memoryAuth.createSession(userId);

  const token = randomBytes(32).toString("hex");
  await Session.create({
    userId: String(userId),
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function findSessionUserId(token, useMemory) {
  if (!token) return null;
  if (useMemory) return memoryAuth.sessionUserId(token);

  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
    .select("userId")
    .lean();
  return session?.userId || null;
}

export async function destroySession(token, useMemory) {
  if (!token) return;
  if (useMemory) return memoryAuth.destroySession(token);
  await Session.deleteOne({ tokenHash: hashToken(token) });
}
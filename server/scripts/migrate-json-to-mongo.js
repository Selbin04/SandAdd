import "dotenv/config";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import LiveWork from "../models/LiveWork.js";
import Project from "../models/Project.js";
import Session from "../models/Session.js";
import User from "../models/User.js";

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.resolve(serverDir, process.env.DATA_DIR || "data");
const projectFile = path.join(
  dataDir,
  path.basename(process.env.PROJECTS_FILE || "projects.json")
);
const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI;
const applyChanges = process.argv.includes("--apply");
const checkTarget = applyChanges || process.argv.includes("--check-target");
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`Could not read ${path.basename(filePath)}: ${error.message}`);
  }
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function projectImportKey(project) {
  return `${String(project.ownerId || "unowned")}:${String(project._id || "")}`;
}

function sessionHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function prepareTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((topic, index) => {
      const text = String(topic?.text || "").trim().slice(0, 80);
      if (!text) return null;
      const proof = topic?.sourceProof;
      return {
        id: String(topic?.id || `${Date.now()}-${index}`),
        text,
        done: Boolean(topic?.done),
        source: String(topic?.source || "").trim().slice(0, 500),
        sourceProof: proof && typeof proof === "object"
          ? {
              mediaId: proof.mediaId || null,
              name: String(proof.name || "").slice(0, 120),
              type: String(proof.type || "").slice(0, 80),
              size: Number(proof.size) || 0,
              hasMedia: Boolean(proof.hasMedia || proof.mediaId || proof.dataUrl),
            }
          : null,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

async function main() {
  const usersData = readJson(path.join(dataDir, "users.json"), {});
  const projectsData = readJson(projectFile, {});
  const liveData = readJson(path.join(dataDir, "liveWorks.json"), {});
  const users = Array.isArray(usersData.users) ? usersData.users : [];
  const projects = Array.isArray(projectsData.projects) ? projectsData.projects : [];
  const sessions = Object.entries(usersData.sessions || {});
  const liveWorks = liveData.works && typeof liveData.works === "object"
    ? Object.entries(liveData.works)
    : [];
  const liveProgress = liveData.progress && typeof liveData.progress === "object"
    ? Object.entries(liveData.progress)
    : [];

  for (const model of [LiveWork, Project, Session, User]) {
    model.schema.set("autoIndex", false);
  }

  if (!users.length && !projects.length && !sessions.length && !liveWorks.length) {
    throw new Error("No legacy JSON data was found to migrate.");
  }

  if (checkTarget) {
    if (!mongoUri) {
      throw new Error("Set MONGODB_URL or MONGO_URI before checking or importing MongoDB.");
    }
    const mongoOptions = { serverSelectionTimeoutMS: 8000 };
    if (process.env.MONGODB_DATABASE) {
      mongoOptions.dbName = process.env.MONGODB_DATABASE;
    }
    await mongoose.connect(mongoUri, mongoOptions);
  }

  const targetUsers = checkTarget
    ? await User.find().select("email").lean()
    : [];
  const targetUsersByEmail = new Map(
    targetUsers.map((user) => [normalizedEmail(user.email), user])
  );
  const userIdMap = new Map();
  let existingUsers = checkTarget ? 0 : null;
  for (const user of users) {
    const existing = targetUsersByEmail.get(normalizedEmail(user.email));
    if (existing) {
      existingUsers += 1;
      userIdMap.set(String(user._id || user.id || ""), String(existing._id));
    }
  }

  const validSourceUserIds = new Set(
    users.map((user) => String(user._id || user.id || "")).filter(Boolean)
  );
  const eligibleProjects = projects.filter(
    (project) => !project.ownerId || validSourceUserIds.has(String(project.ownerId))
  );
  const unmappedOwnedProjects = projects.length - eligibleProjects.length;
  const importedProjectKeys = eligibleProjects.map(projectImportKey);
  const existingProjectCount = checkTarget && importedProjectKeys.length
    ? await Project.countDocuments({ legacyImportKey: { $in: importedProjectKeys } })
    : checkTarget ? 0 : null;
  const sourceLiveIds = [...new Set([
    ...liveWorks.map(([id]) => id),
    ...liveProgress.map(([id]) => id),
  ])];
  const existingLiveWorkCount = checkTarget && sourceLiveIds.length
    ? await LiveWork.countDocuments({ originId: { $in: sourceLiveIds } })
    : checkTarget ? 0 : null;
  const hashedSessions = sessions.map(([token]) => sessionHash(token));
  const existingSessionCount = checkTarget && hashedSessions.length
    ? await Session.countDocuments({ tokenHash: { $in: hashedSessions } })
    : checkTarget ? 0 : null;

  const summary = {
    mode: applyChanges ? "apply" : "dry-run",
    database: checkTarget ? mongoose.connection.name : "not checked (offline dry-run)",
    source: {
      users: users.length,
      projects: projects.length,
      sessions: sessions.length,
      liveWorks: liveWorks.length,
      liveProgress: liveProgress.length,
    },
    targetMatches: checkTarget
      ? {
          usersByEmail: existingUsers,
          projectsByImportKey: existingProjectCount,
          liveWorksByOriginId: existingLiveWorkCount,
          sessionsByTokenHash: existingSessionCount,
        }
      : "not checked",
    skipped: {
      projectsWithUnknownOwner: unmappedOwnedProjects,
    },
  };

  if (!applyChanges) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("No data was changed. Use --check-target for a read-only Mongo check, or --apply to import. Local JSON files remain unchanged.");
    return;
  }

  let usersCreated = 0;
  for (const user of users) {
    const legacyId = String(user._id || user.id || "");
    const email = normalizedEmail(user.email);
    if (!email || !user.passwordHash) continue;
    let targetUser = targetUsersByEmail.get(email);
    if (!targetUser) {
      targetUser = await User.create({
        email,
        passwordHash: user.passwordHash,
        name: String(user.name || "Progress user").trim(),
        handle: String(user.handle || email.split("@")[0]).trim().toLowerCase(),
      });
      targetUsersByEmail.set(email, targetUser);
      usersCreated += 1;
    }
    if (legacyId) userIdMap.set(legacyId, String(targetUser._id));
  }

  const projectIdMap = new Map();
  const projectPlans = [];
  for (const project of eligibleProjects) {
    const legacyKey = projectImportKey(project);
    const existing = await Project.findOne({ legacyImportKey: legacyKey })
      .select("_id")
      .lean();
    const id = existing?._id || new mongoose.Types.ObjectId();
    projectIdMap.set(String(project._id || ""), String(id));
    projectPlans.push({ project, legacyKey, id, exists: Boolean(existing) });
  }

  let projectsCreated = 0;
  for (const plan of projectPlans) {
    if (plan.exists) continue;
    const { project } = plan;
    const oldOriginId = String(project.originId || "");
    const ownerId = project.ownerId
      ? userIdMap.get(String(project.ownerId))
      : "";
    if (project.ownerId && !ownerId) continue;
    const originId = projectIdMap.get(oldOriginId) || (oldOriginId || null);
    await Project.create({
      _id: plan.id,
      legacyImportKey: plan.legacyKey,
      ownerId,
      name: String(project.name || "Progress").trim().slice(0, 80),
      durationMs: Math.max(1, Number(project.durationMs || project.timeoutMs) || 30_000),
      elapsedMs: Math.max(0, Number(project.elapsedMs) || 0),
      completed: Boolean(project.completed),
      important: Boolean(project.important),
      stars: Math.min(5, Math.max(0, Number(project.stars) || 0)),
      topics: prepareTopics(project.topics),
      originId,
      originMode: project.originMode === "assign" || project.originMode === "follow"
        ? project.originMode
        : null,
      tasksLocked: Boolean(project.tasksLocked || originId),
      sharedTemplateId: project.sharedTemplateId || null,
      folderId: project.folderId || null,
      lastWorkedAt: project.lastWorkedAt || project.updatedAt || project.createdAt || new Date(),
      createdAt: project.createdAt || new Date(),
      updatedAt: project.updatedAt || new Date(),
    });
    projectsCreated += 1;
  }

  let sessionsCreated = 0;
  for (const [token, session] of sessions) {
    const userId = userIdMap.get(String(session?.userId || ""));
    if (!userId) continue;
    const tokenHash = sessionHash(token);
    const exists = await Session.exists({ tokenHash });
    if (exists) continue;
    await Session.create({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + sessionTtlMs),
    });
    sessionsCreated += 1;
  }

  let liveWorksCreated = 0;
  const liveById = new Map(liveWorks);
  const progressById = new Map(liveProgress);
  for (const originId of sourceLiveIds) {
    const source = liveById.get(originId) || {};
    const progress = progressById.get(originId) || null;
    const ownerId = source.ownerId
      ? userIdMap.get(String(source.ownerId))
      : "";
    if (source.ownerId && !ownerId) continue;
    const mappedOriginId = projectIdMap.get(String(originId)) || String(originId);
    const existing = await LiveWork.exists({ originId: mappedOriginId });
    if (existing) continue;
    await LiveWork.create({
      originId: mappedOriginId,
      ownerId,
      name: String(source.name || "Progress").slice(0, 80),
      mode: source.mode === "assign" ? "assign" : "follow",
      works: prepareTopics(source.works),
      durationMs: Number(source.durationMs) || 30_000,
      updatedAt: Number(source.updatedAt) || Date.now(),
      deleted: Boolean(source.deleted),
      deletedAt: source.deletedAt || null,
      progress,
      author: source.author || null,
    });
    liveWorksCreated += 1;
  }

  console.log(JSON.stringify({
    ...summary,
    imported: {
      usersCreated,
      projectsCreated,
      sessionsCreated,
      liveWorksCreated,
    },
    sourceFilesChanged: false,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`Legacy data migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });

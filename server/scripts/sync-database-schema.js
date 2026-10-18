import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import User from "../models/User.js";
import LiveWork from "../models/LiveWork.js";
import Session from "../models/Session.js";
import Folder from "../models/Folder.js";

// Ensure public DNS resolver for Atlas SRV
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  /* ignore */
}

const mongoUri =
  process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error("No MongoDB URI configured in environment.");
  process.exit(1);
}

async function syncDatabase() {
  console.log("Connecting to MongoDB Atlas...");
  const options = { serverSelectionTimeoutMS: 15000 };
  if (process.env.MONGODB_DATABASE) {
    options.dbName = process.env.MONGODB_DATABASE;
  }
  await mongoose.connect(mongoUri, options);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  // 1. Build and sync indexes for all models
  console.log("Syncing indexes for all collections...");
  await Promise.all([
    Project.syncIndexes(),
    User.syncIndexes(),
    LiveWork.syncIndexes(),
    Session.syncIndexes(),
    Folder.syncIndexes(),
  ]);
  console.log("Indexes successfully synchronized.");

  // 2. Normalize and update existing Projects in MongoDB
  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects in database to verify.`);

  let updatedCount = 0;
  for (const project of projects) {
    let changed = false;

    // Ensure about field exists
    if (project.about === undefined || project.about === null) {
      project.about = "";
      changed = true;
    }

    // Ensure folderId is valid string or null
    if (project.folderId === undefined) {
      project.folderId = null;
      changed = true;
    }

    // Normalize topics
    if (Array.isArray(project.topics)) {
      const normalizedTopics = project.topics.map((t) => {
        const hasCheckbox =
          t.hasCheckbox !== false && t.checkboxEnabled !== false;
        const sourceTitle = String(t.sourceTitle || "");
        const sources = Array.isArray(t.sources) ? t.sources : [];
        const aiSummary = String(t.aiSummary || "");
        const likeCount = Math.max(0, Number(t.likeCount) || 0);
        const likes = t.likes && typeof t.likes === "object" ? t.likes : {};
        const comments = Array.isArray(t.comments) ? t.comments : [];
        const reports = Array.isArray(t.reports) ? t.reports : [];
        const asks = Array.isArray(t.asks) ? t.asks : [];

        if (
          t.hasCheckbox !== hasCheckbox ||
          t.checkboxEnabled !== hasCheckbox ||
          t.sourceTitle !== sourceTitle ||
          !Array.isArray(t.sources) ||
          t.likeCount !== likeCount
        ) {
          changed = true;
        }

        return {
          id: String(t.id || ""),
          text: String(t.text || "").trim(),
          done: Boolean(t.done),
          hasCheckbox,
          checkboxEnabled: hasCheckbox,
          source: String(t.source || "").trim(),
          sourceTitle,
          sourceProof: t.sourceProof || null,
          sources,
          aiSummary,
          likeCount,
          likes,
          comments,
          reports,
          asks,
        };
      });

      if (changed) {
        project.topics = normalizedTopics;
      }
    }

    if (changed) {
      project.markModified("topics");
      await project.save();
      updatedCount++;
    }
  }

  console.log(`Updated and normalized ${updatedCount} projects in MongoDB.`);

  // 3. Print collection stats
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("\n--- MongoDB Collection Summary ---");
  for (const col of collections) {
    const count = await mongoose.connection.db
      .collection(col.name)
      .countDocuments();
    console.log(`- ${col.name}: ${count} documents`);
  }

  console.log("\nDatabase schema synchronization COMPLETE.");
  process.exit(0);
}

syncDatabase().catch((err) => {
  console.error("Database sync failed:", err);
  process.exit(1);
});

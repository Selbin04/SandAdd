import mongoose from "mongoose";

const sourceItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["link", "text", "file"], default: "text" },
    title: { type: String, default: "", trim: true, maxlength: 120 },
    content: { type: String, default: "", trim: true, maxlength: 1000 },
    proof: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: mongoose.Schema.Types.Mixed, default: Date.now },
  },
  { _id: false }
);

const topicCommentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    author: { type: String, default: "User", maxlength: 80 },
    authorId: { type: String, default: "" },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: mongoose.Schema.Types.Mixed, default: () => new Date().toISOString() },
  },
  { _id: false }
);

const topicSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 120 },
    done: { type: Boolean, default: false },
    hasCheckbox: { type: Boolean, default: true },
    checkboxEnabled: { type: Boolean, default: true },
    source: { type: String, default: "", trim: true, maxlength: 1000 },
    sourceTitle: { type: String, default: "", trim: true, maxlength: 120 },
    sourceProof: { type: mongoose.Schema.Types.Mixed, default: null },
    sources: { type: [sourceItemSchema], default: [] },
    aiSummary: { type: String, default: "", maxlength: 2000 },
    likeCount: { type: Number, default: 0, min: 0 },
    likes: { type: mongoose.Schema.Types.Mixed, default: {} },
    comments: { type: [topicCommentSchema], default: [] },
    reports: { type: [mongoose.Schema.Types.Mixed], default: [] },
    asks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    legacyImportKey: { type: String, unique: true, sparse: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    durationMs: { type: Number, required: true, min: 1 },
    elapsedMs: { type: Number, required: true, min: 0, default: 0 },
    completed: { type: Boolean, default: false },
    important: { type: Boolean, default: false },
    stars: { type: Number, min: 0, max: 5, default: 0 },
    topics: {
      type: [topicSchema],
      default: [],
    },
    originId: { type: String, default: null, index: true },
    originMode: { type: String, default: null },
    tasksLocked: { type: Boolean, default: false },
    sharedTemplateId: { type: String, default: null },
    creatorName: { type: String, default: null },
    creatorHandle: { type: String, default: null },
    folderId: { type: String, default: null, index: true },
    about: { type: String, default: "", trim: true, maxlength: 2000 },
    lastWorkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);

import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    durationMs: { type: Number, required: true, min: 1 },
    elapsedMs: { type: Number, required: true, min: 0, default: 0 },
    completed: { type: Boolean, default: false },
    important: { type: Boolean, default: false },
    stars: { type: Number, min: 0, max: 5, default: 0 },
    topics: {
      type: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true, trim: true, maxlength: 80 },
          done: { type: Boolean, default: true },
          source: { type: String, default: "", trim: true, maxlength: 500 },
          sourceProof: { type: mongoose.Schema.Types.Mixed, default: null },
        },
      ],
      default: [],
    },
    originId: { type: String, default: null, index: true },
    originMode: { type: String, default: null },
    tasksLocked: { type: Boolean, default: false },
    sharedTemplateId: { type: String, default: null },
    folderId: { type: String, default: null, index: true },
    lastWorkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);

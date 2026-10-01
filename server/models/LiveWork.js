import mongoose from "mongoose";

const liveWorkSchema = new mongoose.Schema(
  {
    originId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, default: "", index: true },
    name: { type: String, default: "Work", maxlength: 80 },
    mode: { type: String, enum: ["follow", "assign"], default: "follow" },
    works: { type: [mongoose.Schema.Types.Mixed], default: [] },
    durationMs: { type: Number, default: 30_000 },
    updatedAt: { type: Number, default: Date.now },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Number, default: null },
    progress: { type: mongoose.Schema.Types.Mixed, default: null },
    author: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: false }
);

export default mongoose.model("LiveWork", liveWorkSchema);
import mongoose from "mongoose";

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, default: "User", maxlength: 80 },
    handle: { type: String, default: "", maxlength: 40 },
    initial: { type: String, default: "", maxlength: 2 },
  },
  { _id: false }
);

const socialPostSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, maxlength: 120 },
    authorId: { type: String, ref: "User", required: true, index: true },
    author: { type: authorSchema, default: () => ({}) },
    scope: { type: String, enum: ["view", "group"], default: "view", index: true },
    groupId: { type: String, ref: "SocialGroup", default: null, index: true },
    groupName: { type: String, default: "", maxlength: 60 },
    body: { type: String, default: "", maxlength: 280 },
    meta: { type: String, default: "", maxlength: 160 },
    projectId: { type: String, default: null, maxlength: 120 },
    projectName: { type: String, default: "", maxlength: 80 },
    topicId: { type: String, default: null, maxlength: 120 },
    works: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sharedProject: { type: mongoose.Schema.Types.Mixed, default: null },
    proof: { type: mongoose.Schema.Types.Mixed, default: null },
    kind: { type: String, enum: ["post", "finished"], default: "post" },
  },
  { timestamps: true }
);

socialPostSchema.index({ scope: 1, groupId: 1, createdAt: -1 });
socialPostSchema.index({ authorId: 1, createdAt: -1 });
socialPostSchema.index({ authorId: 1, clientId: 1 }, { unique: true });

socialPostSchema.pre("validate", function validateGroupScope(next) {
  if (this.scope === "group" && !this.groupId) {
    this.invalidate("groupId", "Group posts require a group ID.");
  }
  next();
});

export default mongoose.model("SocialPost", socialPostSchema);

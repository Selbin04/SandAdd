import mongoose from "mongoose";

const socialGroupSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    creatorId: { type: String, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    blurb: { type: String, default: "", trim: true, maxlength: 120 },
    memberIds: [{ type: String, ref: "User" }],
    visibility: {
      type: String,
      enum: ["private", "public"],
      default: "private",
      index: true,
    },
  },
  { timestamps: true }
);

socialGroupSchema.index({ memberIds: 1, updatedAt: -1 });

export default mongoose.model("SocialGroup", socialGroupSchema);

import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    clientId: { type: String, default: null, maxlength: 120 },
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    participantIds: {
      type: [{ type: String, ref: "User" }],
      required: true,
      validate: {
        validator: (ids) => Array.isArray(ids) && ids.length >= 2,
        message: "A conversation requires at least two participants.",
      },
    },
    directKey: { type: String, default: null, unique: true, sparse: true },
    groupId: { type: String, ref: "SocialGroup", default: null },
    title: { type: String, default: "", maxlength: 80 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });
conversationSchema.index({ groupId: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);

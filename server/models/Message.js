import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, maxlength: 120 },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: String, ref: "User", required: true, index: true },
    text: { type: String, default: "", maxlength: 5000 },
    projectName: { type: String, default: "", maxlength: 80 },
    topicId: { type: String, default: null, maxlength: 120 },
    works: { type: [mongoose.Schema.Types.Mixed], default: [] },
    sharedProject: { type: mongoose.Schema.Types.Mixed, default: null },
    proof: { type: mongoose.Schema.Types.Mixed, default: null },
    kind: { type: String, default: "message", maxlength: 40 },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, senderId: 1, clientId: 1 }, { unique: true });

export default mongoose.model("Message", messageSchema);

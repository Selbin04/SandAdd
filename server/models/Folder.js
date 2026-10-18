import mongoose from "mongoose";

const folderSchema = new mongoose.Schema(
  {
    clientId: { type: String, default: null, index: true },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

folderSchema.index({ ownerId: 1, name: 1 });

export default mongoose.model("Folder", folderSchema);

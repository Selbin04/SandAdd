import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    handle: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

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
    bio: { type: String, default: "", maxlength: 300 },
    avatar: { type: String, default: "" },
    initial: { type: String, default: "", maxlength: 4 },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);

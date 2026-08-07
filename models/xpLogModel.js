import mongoose from "mongoose";

/**
 * XP Audit Log Schema
 * Tracks every XP award and enforces unique reward rules per action & reference ID.
 */
const xpLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    xpEarned: {
      type: Number,
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Audit log index for query optimization
xpLogSchema.index({ userId: 1, action: 1, referenceId: 1 });

const XPLog = mongoose.models.XPLog || mongoose.model("XPLog", xpLogSchema);
export default XPLog;

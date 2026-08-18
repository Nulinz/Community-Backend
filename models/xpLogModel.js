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
xpLogSchema.index({ userId: 1, action: 1, createdAt: -1 });

const XPLog = mongoose.models.XPLog || mongoose.model("XPLog", xpLogSchema);

/**
 * Drops legacy unique indexes that block daily recurring mission claims.
 */
export const dropStaleXPLogUniqueIndexes = async () => {
  try {
    const indexes = await XPLog.collection.indexes();
    for (const index of indexes) {
      if (index.name !== "_id_" && index.unique) {
        await XPLog.collection.dropIndex(index.name);
        console.log(`[XPLog] Dropped stale unique index: ${index.name}`);
      }
    }
  } catch (err) {
    // Collection or index might not exist yet; safe to ignore
  }
};

export default XPLog;

import mongoose from "mongoose";

/**
 * Lightweight, schema-flexible mission progress tracker per user.
 * Stores daily view timestamps and unique target IDs in maps so new
 * level-specific missions can be added without modifying User schema.
 */
const userMissionProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    dailyViews: {
      type: Map,
      of: Date,
      default: {},
    },
    uniqueTargets: {
      type: Map,
      of: [mongoose.Schema.Types.ObjectId],
      default: {},
    },
  },
  { timestamps: true }
);

const UserMissionProgress =
  mongoose.models.UserMissionProgress ||
  mongoose.model("UserMissionProgress", userMissionProgressSchema);

/**
 * Records a daily view timestamp for a given mission activity key (non-blocking).
 */
export const trackDailyView = (userId, key) => {
  if (!userId || !key) return;
  UserMissionProgress.updateOne(
    { userId },
    { $set: { [`dailyViews.${key}`]: new Date() } },
    { upsert: true }
  ).catch(() => {});
};

/**
 * Records a unique target entity ID (e.g., viewed job/internship) for count-based missions (non-blocking).
 */
export const trackUniqueTarget = (userId, key, targetId) => {
  if (!userId || !key || !targetId) return;
  UserMissionProgress.updateOne(
    { userId },
    { $addToSet: { [`uniqueTargets.${key}`]: targetId } },
    { upsert: true }
  ).catch(() => {});
};

export default UserMissionProgress;


import User from "../models/userModel.js";
import XPLog from "../models/xpLogModel.js";
import { XP_ACTIONS, calculateLevelInfo } from "../config/xpConfig.js";

/**
 * Awards XP to a user defensively, updates total level, and prevents duplicates.
 * For DAILY_LOGIN actions, enforces a single claim per calendar day.
 * 
 * @param {Object} params
 * @param {string} params.userId - Target user ObjectId
 * @param {string} params.actionKey - Key from XP_ACTIONS
 * @param {string} [params.referenceId] - Optional reference ID
 */
export const awardXP = async ({ userId, actionKey, referenceId = null }) => {
  if (!userId) {
    return { success: false, reason: "MISSING_USER_ID" };
  }

  const actionConfig = XP_ACTIONS[actionKey];
  if (!actionConfig) {
    return { success: false, reason: "INVALID_ACTION_KEY" };
  }

  // 1A. Daily Login Guard: Check if XP was already awarded today
  if (actionKey === "DAILY_LOGIN") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existingDailyLog = await XPLog.findOne({
      userId,
      action: actionKey,
      createdAt: { $gte: startOfToday },
    });

    if (existingDailyLog) {
      return { success: false, reason: "ALREADY_CLAIMED_TODAY" };
    }
  } 
  // 1B. Reference ID Guard for non-daily actions
  else if (referenceId) {
    const existingLog = await XPLog.findOne({ userId, action: actionKey, referenceId });
    if (existingLog) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
  }

  // 2. Log XP transaction
  await XPLog.create({
    userId,
    action: actionKey,
    xpEarned: actionConfig.xp,
    referenceId,
  });

  // 3. Update User total XP and Level
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  const previousXP = user.xp || 0;
  const newXP = previousXP + actionConfig.xp;
  
  const levelInfo = calculateLevelInfo(newXP);
  const isLevelUp = levelInfo.currentLevel > (user.level || 1);

  user.xp = newXP;
  user.level = levelInfo.currentLevel;
  await user.save();

  return {
    success: true,
    xpAwarded: actionConfig.xp,
    totalXP: newXP,
    level: user.level,
    isLevelUp,
    levelInfo,
  };
};

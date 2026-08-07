import User from "../models/userModel.js";
import XPLog from "../models/xpLogModel.js";
import { XP_ACTIONS, calculateLevelInfo } from "../config/xpConfig.js";

/**
 * Awards XP to a user defensively, updates total level atomically, and prevents duplicates.
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

  // 1A. Daily Guard: Check if XP was already awarded today for daily actions
  if (["DAILY_LOGIN", "AI_STATION", "ACTIVE_30_MIN", "ACTIVE_60_MIN", "ACTIVE_180_MIN"].includes(actionKey)) {
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
  // 1B. One-time lifetime action guard
  else if ([
    "FIRST_REGISTERATION",
    "FIRST_SUBSCRIPTION",
    "FIRST_COMPANY_FOLLOW",
    "FIRST_EVENT_REGISTRATION",
    "FIRST_EVENT_ATTENDANCE",
    "FIRST_FREELANCE_APPLICATION",
    "FIRST_COMPETITION_REGISTRATION",
    "LEVEL_1_BONUS",
    "LEVEL_2_BONUS"
  ].includes(actionKey)) {
    const existingLog = await XPLog.findOne({ userId, action: actionKey });
    if (existingLog) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
  }
  // 1C. Reference ID Guard for non-daily actions with reference ID
  else if (referenceId) {
    const existingLog = await XPLog.findOne({ userId, action: actionKey, referenceId });
    if (existingLog) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
  }

  // 2. Log XP transaction defensively
  try {
    await XPLog.create({
      userId,
      action: actionKey,
      xpEarned: actionConfig.xp,
      referenceId,
    });
  } catch (err) {
    if (err.code === 11000) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
    throw err;
  }

  // 3. Atomically update User total XP and recalculate Level
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  // Level-based activity guards
  if (actionKey === "ACTIVE_30_MIN" && user.level !== 1) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }
  if (actionKey === "ACTIVE_60_MIN" && user.level !== 2) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }
  if (actionKey === "ACTIVE_180_MIN" && user.level !== 3) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }

  // Calculate sum of ALL XP earned from XPLog for 100% data integrity
  const xpLogs = await XPLog.find({ userId }).select("xpEarned").lean();
  let totalXP = xpLogs.reduce((sum, log) => sum + (log.xpEarned || 0), 0);

  let levelInfo = calculateLevelInfo(totalXP);
  const isLevelUp = levelInfo.currentLevel > (user.level || 0);

  // Check for Level 2 & Level 3 reach bonuses (+25 XP each)
  if (levelInfo.currentLevel >= 2) {
    const level1BonusLogged = await XPLog.findOne({ userId, action: "LEVEL_1_BONUS" });
    if (!level1BonusLogged) {
      await XPLog.create({
        userId,
        action: "LEVEL_1_BONUS",
        xpEarned: XP_ACTIONS.LEVEL_1_BONUS.xp,
      });
      totalXP += XP_ACTIONS.LEVEL_1_BONUS.xp;
    }
  }

  if (levelInfo.currentLevel >= 3) {
    const level2BonusLogged = await XPLog.findOne({ userId, action: "LEVEL_2_BONUS" });
    if (!level2BonusLogged) {
      await XPLog.create({
        userId,
        action: "LEVEL_2_BONUS",
        xpEarned: XP_ACTIONS.LEVEL_2_BONUS.xp,
      });
      totalXP += XP_ACTIONS.LEVEL_2_BONUS.xp;
    }
  }

  levelInfo = calculateLevelInfo(totalXP);

  // Atomically update user document in MongoDB
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        xp: totalXP,
        level: levelInfo.currentLevel,
      },
    },
    { new: true }
  );

  return {
    success: true,
    xpAwarded: actionConfig.xp,
    totalXP: updatedUser?.xp || totalXP,
    level: updatedUser?.level || levelInfo.currentLevel,
    isLevelUp,
    levelInfo,
  };
};
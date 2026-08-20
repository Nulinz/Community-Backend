import User from "../models/userModel.js";
import XPLog from "../models/xpLogModel.js";
import Notification from "../models/notificationModel.js";
import { XP_ACTIONS, calculateLevelInfo } from "../config/xpConfig.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

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

  // 1. Fetch user FIRST and validate level eligibility before creating log entries
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  const userLevel = user.level || 1;

  // Level-based activity guards
  if (actionKey === "ACTIVE_30_MIN" && userLevel !== 1) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }
  if (actionKey === "ACTIVE_60_MIN" && userLevel !== 2) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }
  if (actionKey === "ACTIVE_180_MIN" && userLevel < 3) {
    return { success: false, reason: "NOT_ELIGIBLE_LEVEL" };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const isDaily = actionConfig.isDaily !== false;

  // 2A. Daily Guard: Check if XP was already awarded today for daily actions
  if (isDaily || ["DAILY_LOGIN", "AI_STATION", "ACTIVE_30_MIN", "ACTIVE_60_MIN", "ACTIVE_180_MIN"].includes(actionKey)) {
    const existingDailyLog = await XPLog.findOne({
      userId,
      action: actionKey,
      createdAt: { $gte: startOfToday },
    });

    if (existingDailyLog) {
      return { success: false, reason: "ALREADY_CLAIMED_TODAY" };
    }
  }
  // 2B. One-time lifetime action guard
  else if (!referenceId) {
    const existingLog = await XPLog.findOne({ userId, action: actionKey });
    if (existingLog) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
  }
  // 2C. Reference ID Guard for non-daily actions with reference ID
  else {
    const existingLog = await XPLog.findOne({ userId, action: actionKey, referenceId });
    if (existingLog) {
      return { success: false, reason: "ALREADY_CLAIMED" };
    }
  }

  // 3. Log XP transaction
  await XPLog.create({
    userId,
    action: actionKey,
    xpEarned: actionConfig.xp,
    referenceId,
  });

  // 4. Atomically recalculate User total XP and Level from all audit logs
  const updatedLogs = await XPLog.find({ userId }).select("xpEarned").lean();
  let totalXP = updatedLogs.reduce((sum, log) => sum + (log.xpEarned || 0), 0);

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
    totalXP: updatedUser?.xp ?? totalXP,
    level: updatedUser?.level ?? levelInfo.currentLevel,
    isLevelUp,
    levelInfo,
  };
};

/**
 * Triggers an FCM notification and saves a Notification record immediately when
 * a mission action is completed and becomes ready to claim.
 * Performs strict deduplication to ensure notifications are only sent once per day
 * (for daily missions) or once ever (for lifetime missions), and only if unclaimed.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Target user ObjectId
 * @param {string} actionKey - Key from XP_ACTIONS (e.g. "AI_STATION", "DAILY_LOGIN", "ACTIVE_30_MIN", etc.)
 */
export const triggerMissionNotification = async (userId, actionKey) => {
  try {
    if (!userId || !actionKey) return;
    const config = XP_ACTIONS[actionKey];
    if (!config) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isDaily = config.isDaily !== false;

    // 1. Check if already claimed in XPLog
    if (isDaily) {
      const alreadyClaimed = await XPLog.exists({
        userId,
        action: actionKey,
        createdAt: { $gte: startOfToday },
      });
      if (alreadyClaimed) return;
    } else {
      const alreadyClaimed = await XPLog.exists({
        userId,
        action: actionKey,
      });
      if (alreadyClaimed) return;
    }

    // 2. Check if notification was already sent/saved
    if (isDaily) {
      const alreadyNotified = await Notification.exists({
        receiver: userId,
        type: "Claim XP",
        "metadata.action": actionKey,
        createdAt: { $gte: startOfToday },
      });
      if (alreadyNotified) return;
    } else {
      const alreadyNotified = await Notification.exists({
        receiver: userId,
        type: "Claim XP",
        "metadata.action": actionKey,
      });
      if (alreadyNotified) return;
    }

    // 3. Send FCM push notification & save to Notification collection in DB
    await sendAndSaveNotification({
      senderId: userId,
      receiverId: userId,
      title: `${config.label} Ready to Claim! 🎁`,
      message: `You've completed "${config.label}"! Claim +${config.xp} XP now.`,
      body: `Your +${config.xp} XP reward is ready to claim in Missions!`,
      type: "Claim XP",
      metadata: {
        action: actionKey,
        status: "READY_TO_CLAIM",
        xpReward: String(config.xp),
      },
    });
  } catch (error) {
    console.error(`triggerMissionNotification error for ${actionKey}:`, error.message);
  }
};
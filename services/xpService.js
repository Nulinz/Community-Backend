import User from "../models/userModel.js";
import XPLog from "../models/xpLogModel.js";
import Notification from "../models/notificationModel.js";
import { XP_ACTIONS, LEVEL_REQUIREMENTS, calculateLevelInfo } from "../config/xpConfig.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

/**
 * Awards XP to a user defensively, updates total level atomically, and prevents duplicates.
 * Implements level-specific XP reset (resets to 0 upon level up) with rollover deduction,
 * while atomically incrementing lifetime_xp so historical totals are never lost.
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

  // Active level evaluated directly from user.level to prevent false level-1 fallbacks when xp resets
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

  // 4. Calculate current level progress and increment lifetime XP
  let currentLevel = user.level || 1;
  let currentXP = (user.xp || 0) + actionConfig.xp;
  let lifetimeXP = (user.lifetime_xp || user.xp || 0) + actionConfig.xp;
  let hasLeveledUp = false;

  // Rollover loop: subtracts required threshold when level advances
  while (true) {
    const xpNeeded = LEVEL_REQUIREMENTS[currentLevel] || (currentLevel * 200);
    if (currentXP < xpNeeded) {
      break;
    }
    currentXP -= xpNeeded;
    currentLevel += 1;
    hasLeveledUp = true;
  }

  // Check for Level 2 & Level 3 reach bonuses (+25 XP each)
  if (currentLevel >= 2) {
    const level1BonusLogged = await XPLog.findOne({ userId, action: "LEVEL_1_BONUS" });
    if (!level1BonusLogged) {
      await XPLog.create({
        userId,
        action: "LEVEL_1_BONUS",
        xpEarned: XP_ACTIONS.LEVEL_1_BONUS.xp,
      });
      currentXP += XP_ACTIONS.LEVEL_1_BONUS.xp;
      lifetimeXP += XP_ACTIONS.LEVEL_1_BONUS.xp;
    }
  }

  if (currentLevel >= 3) {
    const level2BonusLogged = await XPLog.findOne({ userId, action: "LEVEL_2_BONUS" });
    if (!level2BonusLogged) {
      await XPLog.create({
        userId,
        action: "LEVEL_2_BONUS",
        xpEarned: XP_ACTIONS.LEVEL_2_BONUS.xp,
      });
      currentXP += XP_ACTIONS.LEVEL_2_BONUS.xp;
      lifetimeXP += XP_ACTIONS.LEVEL_2_BONUS.xp;
    }
  }

  // Re-check rollover in the rare event that level-up bonus pushed user past the next threshold
  while (true) {
    const xpNeeded = LEVEL_REQUIREMENTS[currentLevel] || (currentLevel * 200);
    if (currentXP < xpNeeded) {
      break;
    }
    currentXP -= xpNeeded;
    currentLevel += 1;
    hasLeveledUp = true;
  }

  const levelInfo = calculateLevelInfo(currentXP, currentLevel, lifetimeXP);
  const finalIsLevelUp = hasLeveledUp || (currentLevel > (user.level || 0));

  // Atomically update user document in MongoDB
  const updateFields = {
    xp: currentXP,
    lifetime_xp: lifetimeXP,
    level: currentLevel,
  };
  if (finalIsLevelUp) {
    updateFields.show_levelup_animation = true;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: updateFields,
    },
    { new: true }
  );

  return {
    success: true,
    xpAwarded: actionConfig.xp,
    currentXP: updatedUser?.xp ?? currentXP,
    totalXP: updatedUser?.lifetime_xp ?? lifetimeXP,
    lifetimeXP: updatedUser?.lifetime_xp ?? lifetimeXP,
    level: updatedUser?.level ?? currentLevel,
    isLevelUp: finalIsLevelUp,
    levelInfo,
  };
};

// In-memory set to prevent concurrent race conditions from dashboard and mission calls
const pendingMissionNotifications = new Set();

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
  if (!userId || !actionKey) return;

  const lockKey = `${userId.toString()}:${actionKey}`;
  if (pendingMissionNotifications.has(lockKey)) return;
  pendingMissionNotifications.add(lockKey);

  try {
    const config = XP_ACTIONS[actionKey];
    if (!config) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isDaily = config.isDaily !== false;

    // 1. Check if already claimed in XPLog
    if (config.isRepeatable) {
      // Repeatable actions (e.g. REFERRAL): allow notifications whenever an unclaimed referral is waiting
      const referredCount = await User.countDocuments({ referredBy: userId });
      const claimedCount = await XPLog.countDocuments({ userId, action: actionKey });
      if (claimedCount >= referredCount) return;
    } else if (isDaily) {
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

    // 2. Check if notification was already created in DB
    // Deduplication should NOT require metadata.fcm_sent: true, because web users or users without
    // active FCM tokens will have fcm_sent: false, which previously caused infinite duplicate notifications on refresh.
    if (config.isRepeatable) {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const recentlyNotified = await Notification.exists({
        receiver: userId,
        type: "Claim XP",
        "metadata.action": actionKey,
        createdAt: { $gte: oneMinuteAgo },
      });
      if (recentlyNotified) return;
    } else if (isDaily) {
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
  } finally {
    pendingMissionNotifications.delete(lockKey);
  }
};
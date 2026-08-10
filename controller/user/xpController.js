import User from "../../models/userModel.js";
import XPLog from "../../models/xpLogModel.js";
import { XP_ACTIONS, calculateLevelInfo } from "../../config/xpConfig.js";
import { awardXP } from "../../services/xpService.js";

/**
 * Get simple user XP summary (current XP, current level, XP needed for next level).
 * Uses Bearer token authentication (req.user).
 */
export const getUserXpSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("name email xp level").lean();
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const levelInfo = calculateLevelInfo(user.xp || 0);

    return res.status(200).json({
      status: true,
      data: {
        userId: user._id,
        name: user.name || "",
        email: user.email || "",
        currentXP: levelInfo.totalXP,
        currentLevel: levelInfo.currentLevel,
        xpForCurrentLevel: levelInfo.xpForCurrentLevel,
        xpForNextLevel: levelInfo.xpForNextLevel,
        xpNeededForNextLevel: levelInfo.xpNeeded,
        progressPercentage: levelInfo.progressPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available missions with user progress and claim status.
 * Daily missions auto-reset at midnight (00:00).
 * Active time mission is dynamically selected based on user level:
 * - Level 1: 30 minutes (10 XP)
 * - Level 2: 60 minutes (15 XP)
 * - Level 3+: 180 minutes (20 XP)
 */
export const getMissions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const userLevel = user.level || 1;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Calculate today's active minutes based on calendar day boundary
    const isNewDay = !user.lastActiveDate || new Date(user.lastActiveDate) < startOfToday;
    const dailyMins = isNewDay ? 0 : user.dailyActiveMinutes || 0;

    // Fetch XP logs for today and lifetime
    const todayLogs = await XPLog.find({
      userId,
      createdAt: { $gte: startOfToday },
    }).lean();

    const lifetimeLogs = await XPLog.find({ userId }).select("action").lean();

    const todayClaimedKeys = new Set(todayLogs.map((log) => log.action));
    const lifetimeClaimedKeys = new Set(lifetimeLogs.map((log) => log.action));

    // Select the single active time mission matching the user's current level
    let activeTimeMissionKey = "ACTIVE_30_MIN";
    if (userLevel === 2) {
      activeTimeMissionKey = "ACTIVE_60_MIN";
    } else if (userLevel >= 3) {
      activeTimeMissionKey = "ACTIVE_180_MIN";
    }

    // Build missions list
    const missionKeys = [
      "DAILY_LOGIN",
      activeTimeMissionKey,
      "AI_STATION",
      "FIRST_REGISTERATION",
      "FIRST_COMPANY_FOLLOW",
      "FIRST_EVENT_REGISTRATION",
      "FIRST_COMPETITION_REGISTRATION",
      "FIRST_FREELANCE_APPLICATION",
      "FIRST_SUBSCRIPTION",
    ];

    const missions = missionKeys.map((key) => {
      const config = XP_ACTIONS[key];
      if (!config) return null;

      const isDaily = config.isDaily !== false;
      const isClaimed = isDaily
        ? todayClaimedKeys.has(key)
        : lifetimeClaimedKeys.has(key);

      // Compute current numerical progress
      let currentProgress = 0;

      if (key === "DAILY_LOGIN") {
        currentProgress = user.last_login && new Date(user.last_login) >= startOfToday ? 1 : 0;
      } else if (key.startsWith("ACTIVE_")) {
        currentProgress = Math.min(dailyMins, config.target);
      } else if (isClaimed) {
        currentProgress = config.target;
      } else {
        currentProgress = 0;
      }

      const progressPercentage = Math.min(
        100,
        Math.round((currentProgress / config.target) * 100)
      );

      let status = "IN_PROGRESS";
      if (isClaimed) {
        status = "CLAIMED";
      } else if (config.requiredLevel && userLevel < config.requiredLevel) {
        status = "LOCKED";
      } else if (currentProgress >= config.target) {
        status = "READY_TO_CLAIM";
      }

      return {
        key,
        title: config.label,
        xpReward: config.xp,
        isDaily,
        unit: config.unit || "count",
        currentProgress,
        targetProgress: config.target,
        progressPercentage,
        requiredLevel: config.requiredLevel || null,
        status, // "IN_PROGRESS" | "READY_TO_CLAIM" | "CLAIMED" | "LOCKED"
      };
    }).filter(Boolean);

    return res.status(200).json({
      status: true,
      userSummary: {
        totalXP: user.xp || 0,
        level: userLevel,
        dailyActiveMinutes: dailyMins,
      },
      missions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually claim XP for a completed mission.
 */
export const claimMission = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { actionKey } = req.body;

    if (!actionKey || !XP_ACTIONS[actionKey]) {
      return res.status(400).json({
        status: false,
        message: "Invalid or missing actionKey",
      });
    }

    const config = XP_ACTIONS[actionKey];
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const userLevel = user.level || 1;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isNewDay = !user.lastActiveDate || new Date(user.lastActiveDate) < startOfToday;
    const dailyMins = isNewDay ? 0 : user.dailyActiveMinutes || 0;

    // Check level eligibility for active minute missions
    if (actionKey === "ACTIVE_30_MIN" && userLevel !== 1) {
      return res.status(400).json({
        status: false,
        message: "This active minute mission is only for Level 1 users",
      });
    }
    if (actionKey === "ACTIVE_60_MIN" && userLevel !== 2) {
      return res.status(400).json({
        status: false,
        message: "This active minute mission is only for Level 2 users",
      });
    }
    if (actionKey === "ACTIVE_180_MIN" && userLevel < 3) {
      return res.status(400).json({
        status: false,
        message: "This active minute mission is only for Level 3 users",
      });
    }

    // Check if target is satisfied for active minute missions
    if (actionKey === "ACTIVE_30_MIN" && dailyMins < 30) {
      return res.status(400).json({
        status: false,
        message: "Target of 30 active minutes not reached yet",
      });
    }
    if (actionKey === "ACTIVE_60_MIN" && dailyMins < 60) {
      return res.status(400).json({
        status: false,
        message: "Target of 60 active minutes not reached yet",
      });
    }
    if (actionKey === "ACTIVE_180_MIN" && dailyMins < 180) {
      return res.status(400).json({
        status: false,
        message: "Target of 180 active minutes not reached yet",
      });
    }

    // Award XP using defensive service
    const xpResult = await awardXP({ userId, actionKey });

    if (!xpResult.success) {
      return res.status(400).json({
        status: false,
        message: xpResult.reason === "ALREADY_CLAIMED_TODAY" || xpResult.reason === "ALREADY_CLAIMED"
          ? "XP already claimed for this mission"
          : xpResult.reason || "Failed to claim XP",
      });
    }

    return res.status(200).json({
      status: true,
      message: "XP claimed successfully!",
      xpAwarded: xpResult.xpAwarded,
      totalXP: xpResult.totalXP,
      level: xpResult.level,
      isLevelUp: xpResult.isLevelUp,
      levelInfo: xpResult.levelInfo,
    });
  } catch (error) {
    next(error);
  }
};

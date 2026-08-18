import User from "../../models/userModel.js";
import XPLog from "../../models/xpLogModel.js";
import CompanyFollow from "../../models/companyFollowModel.js";
import EventRegistration from "../../models/eventRegistrationModel.js";
import AppliedJob from "../../models/appliedJobModel.js";
import Notification from "../../models/notificationModel.js";
import { XP_ACTIONS, calculateLevelInfo } from "../../config/xpConfig.js";
import { awardXP } from "../../services/xpService.js";
import { sendAndSaveNotification } from "../../helper/sendAndSaveNotification.js";

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

    // Calculate today's active minutes based on calendar day boundary & record activity if new day
    const isNewDay = !user.lastActiveDate || new Date(user.lastActiveDate) < startOfToday;
    if (isNewDay) {
      user.lastActiveDate = new Date();
      await User.findByIdAndUpdate(userId, { lastActiveDate: user.lastActiveDate });
    }
    const dailyMins = isNewDay ? 0 : user.dailyActiveMinutes || 0;

    // Fetch XP logs for today and lifetime
    const todayLogs = await XPLog.find({
      userId,
      createdAt: { $gte: startOfToday },
    }).lean();

    const lifetimeLogs = await XPLog.find({ userId }).select("action").lean();

    const todayClaimedKeys = new Set(todayLogs.map((log) => log.action));
    const lifetimeClaimedKeys = new Set(lifetimeLogs.map((log) => log.action));

    // 🔔 Trigger FCM when DAILY_LOGIN is in READY_TO_CLAIM status
    if (!todayClaimedKeys.has("DAILY_LOGIN") && user.fcm_token) {
      sendAndSaveNotification({
        senderId: userId,
        receiverId: userId,
        title: "Daily Login Ready to Claim! 🎁",
        message: "You've unlocked your Daily Login mission! Claim +5 XP now.",
        body: "Your +5 XP daily reward is ready to claim in Missions!",
        type: "reminder",
        metadata: { action: "DAILY_LOGIN", status: "READY_TO_CLAIM", xpReward: "5" },
      }).catch((err) => console.error("FCM Daily Login error:", err.message));
    }

    // Select the single active time mission matching the user's current level
    let activeTimeMissionKey = "ACTIVE_30_MIN";
    if (userLevel === 2) {
      activeTimeMissionKey = "ACTIVE_60_MIN";
    } else if (userLevel >= 3) {
      activeTimeMissionKey = "ACTIVE_180_MIN";
    }

    // Pre-query database for real user activity completion status
    const [hasFollowedCompany, hasEventRegistration, hasCompetitionRegistration, hasFreelanceApp] = await Promise.all([
      CompanyFollow.exists({ userId }),
      EventRegistration.exists({ userId }),
      EventRegistration.exists({ userId, eventType: "Competition" }),
      AppliedJob.exists({ userId, jobType: "Freelance" }),
    ]);

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

      // Compute current numerical progress dynamically based on user activity
      let currentProgress = 0;

      if (isClaimed) {
        currentProgress = config.target;
      } else if (key === "DAILY_LOGIN") {
        currentProgress = user.lastActiveDate && new Date(user.lastActiveDate) >= startOfToday ? 1 : 0;
      } else if (key === "AI_STATION") {
        currentProgress = user.lastAiStationDate && new Date(user.lastAiStationDate) >= startOfToday ? 1 : 0;
      } else if (key.startsWith("ACTIVE_")) {
        currentProgress = Math.min(dailyMins, config.target);
      } else if (key === "FIRST_REGISTERATION") {
        currentProgress = 1;
      } else if (key === "FIRST_COMPANY_FOLLOW") {
        currentProgress = hasFollowedCompany ? 1 : 0;
      } else if (key === "FIRST_EVENT_REGISTRATION") {
        currentProgress = hasEventRegistration ? 1 : 0;
      } else if (key === "FIRST_COMPETITION_REGISTRATION") {
        currentProgress = hasCompetitionRegistration ? 1 : 0;
      } else if (key === "FIRST_FREELANCE_APPLICATION") {
        currentProgress = hasFreelanceApp ? 1 : 0;
      } else if (key === "FIRST_SUBSCRIPTION") {
        currentProgress = user.subscription?.status === "active" ? 1 : 0;
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
    const body = req.body || {};
    const actionKey = body.actionKey || req.query?.actionKey;

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

    // Level guards for active minute missions
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

    // Validate mission criteria completion before manual claim
    if (actionKey === "DAILY_LOGIN") {
      const hasBeenActiveToday = user.lastActiveDate && new Date(user.lastActiveDate) >= startOfToday;
      if (!hasBeenActiveToday) {
        return res.status(400).json({ status: false, message: "Daily login mission not completed today" });
      }
    } else if (actionKey === "AI_STATION") {
      const hasUsedAiToday = user.lastAiStationDate && new Date(user.lastAiStationDate) >= startOfToday;
      if (!hasUsedAiToday) {
        return res.status(400).json({ status: false, message: "AI Station mission not completed today yet" });
      }
    } else if (actionKey === "ACTIVE_30_MIN" && dailyMins < 30) {
      return res.status(400).json({ status: false, message: "Target of 30 active minutes not reached yet" });
    } else if (actionKey === "ACTIVE_60_MIN" && dailyMins < 60) {
      return res.status(400).json({ status: false, message: "Target of 60 active minutes not reached yet" });
    } else if (actionKey === "ACTIVE_180_MIN" && dailyMins < 180) {
      return res.status(400).json({ status: false, message: "Target of 180 active minutes not reached yet" });
    } else if (actionKey === "FIRST_COMPANY_FOLLOW") {
      const hasFollowed = await CompanyFollow.exists({ userId });
      if (!hasFollowed) {
        return res.status(400).json({ status: false, message: "First company follow mission not completed yet" });
      }
    } else if (actionKey === "FIRST_EVENT_REGISTRATION") {
      const hasReg = await EventRegistration.exists({ userId });
      if (!hasReg) {
        return res.status(400).json({ status: false, message: "First event registration mission not completed yet" });
      }
    } else if (actionKey === "FIRST_COMPETITION_REGISTRATION") {
      const hasCompReg = await EventRegistration.exists({ userId, eventType: "Competition" });
      if (!hasCompReg) {
        return res.status(400).json({ status: false, message: "First competition registration mission not completed yet" });
      }
    } else if (actionKey === "FIRST_FREELANCE_APPLICATION") {
      const hasFreelanceApp = await AppliedJob.exists({ userId, jobType: "Freelance" });
      if (!hasFreelanceApp) {
        return res.status(400).json({ status: false, message: "First freelance application mission not completed yet" });
      }
    } else if (actionKey === "FIRST_SUBSCRIPTION") {
      const isSubscribed = user.subscription?.status === "active";
      if (!isSubscribed) {
        return res.status(400).json({ status: false, message: "First subscription mission not completed yet" });
      }
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

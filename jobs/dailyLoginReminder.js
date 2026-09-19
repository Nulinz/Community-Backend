/**
 * Daily Login Reminder Cron Service
 *
 * Automated recurring cron scheduled daily at 11:00 AM IST.
 * Identifies active users who have not logged in or opened the app today
 * (i.e. lastActiveDate < startOfToday in IST or null) and dispatches a
 * push notification and in-app reminder to encourage login and claim daily XP.
 *
 * Implements strict daily deduplication to avoid redundant alerts and dispatches
 * notifications in controlled batches of 25.
 */

import cron from "node-cron";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

/**
 * Returns a Date object representing the start of the current day (00:00:00.000)
 * in Indian Standard Time (IST, UTC+05:30).
 */
const getStartOfTodayIST = () => {
  const istDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD

  const [year, month, day] = istDateString.split("-").map(Number);
  // Convert 00:00:00 IST to UTC by subtracting 5 hours and 30 minutes
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
};

/**
 * Core execution routine that discovers inactive users today and dispatches reminders.
 */
export const runDailyLoginReminder = async () => {
  console.log("[DailyLoginCron] Running daily login reminder check at 11:00 AM IST...");

  try {
    const startOfTodayIST = getStartOfTodayIST();

    // ── Step 1: Query active candidates who have not logged in today ──────────
    const inactiveUsers = await User.find({
      role: "user",
      is_active: { $ne: false },
      $or: [
        { lastActiveDate: { $lt: startOfTodayIST } },
        { lastActiveDate: null },
        { lastActiveDate: { $exists: false } },
      ],
    })
      .select("_id name")
      .lean();

    if (inactiveUsers.length === 0) {
      console.log("[DailyLoginCron] All active users have already logged in today. No reminders needed.");
      return;
    }

    const candidateIds = inactiveUsers.map((u) => u._id);

    // ── Step 2: Deduplicate against existing reminders sent today ─────────────
    const alreadyNotified = await Notification.find({
      receiver: { $in: candidateIds },
      type: "reminder",
      "metadata.category": "daily_login_reminder",
      createdAt: { $gte: startOfTodayIST },
    })
      .select("receiver")
      .lean();

    const alreadyNotifiedSet = new Set(alreadyNotified.map((n) => String(n.receiver)));
    const eligibleUsers = inactiveUsers.filter((u) => !alreadyNotifiedSet.has(String(u._id)));

    console.log(
      `[DailyLoginCron] Identified ${inactiveUsers.length} un-logged users; ${eligibleUsers.length} eligible after deduplication.`
    );

    if (eligibleUsers.length === 0) return;

    // ── Step 3: Controlled Batch Dispatch (batches of 25) ─────────────────────
    const BATCH_SIZE = 25;
    let sentCount = 0;
    let failedCount = 0;

    const title = "Daily Login Reminder ⏰";
    const message =
      "You haven't logged in to GradEnvy today! Log in now to explore open opportunities and claim your daily XP reward.";

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((user) =>
          sendAndSaveNotification({
            senderId: user._id,
            receiverId: user._id,
            title,
            message,
            body: message,
            type: "reminder",
            reference_id: null,
            metadata: {
              category: "daily_login_reminder",
              action: "DAILY_LOGIN_REMINDER",
            },
          })
        )
      );

      results.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          sentCount += 1;
        } else {
          failedCount += 1;
        }
      });
    }

    console.log(
      `[DailyLoginCron] Completed daily login reminder dispatch: ${sentCount} sent, ${failedCount} failed.`
    );
  } catch (error) {
    console.error("[DailyLoginCron] Error executing daily login reminder:", error.message);
  }
};

/**
 * Initializes the automated cron schedule to run daily at 11:00 AM IST.
 */
export const startDailyLoginReminderCron = () => {
  cron.schedule("0 11 * * *", runDailyLoginReminder, {
    timezone: "Asia/Kolkata",
  });
  console.log("[DailyLoginCron] Scheduled — daily at 11:00 AM IST");
};

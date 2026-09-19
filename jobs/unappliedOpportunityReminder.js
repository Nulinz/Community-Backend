/**
 * Unapplied Opportunity Reminder Cron Service
 *
 * Automated recurring cron scheduled daily at 11:00 AM IST.
 * Enforces a strict 3-day rotating cycle:
 *   - Day 1 (Cycle 0): Open Jobs that haven't reached deadline and user hasn't applied to.
 *   - Day 2 (Cycle 1): Open Internships that haven't reached deadline and user hasn't applied to.
 *   - Day 3 (Cycle 2): Open Envy Freelance projects that haven't reached deadline and user hasn't applied to.
 *   - Day 4+: Repeats cycle indefinitely (day % 3).
 *
 * Calculates per-user unapplied opportunity counts across all active candidates in O(1) in-memory
 * lookups and dispatches in-app notifications and FCM push alerts in controlled batches.
 */

import cron from "node-cron";
import Job from "../models/jobModel.js";
import Internship from "../models/internshipModel.js";
import Freelance from "../models/freelanceModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import User from "../models/userModel.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

/**
 * Resolves the 3-day cycle index (0 = Jobs, 1 = Internships, 2 = Envy)
 * deterministically relative to an anchor date in Indian Standard Time (IST).
 */
const getCycleIndex = (date = new Date()) => {
  const istDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // Format: YYYY-MM-DD

  const [year, month, day] = istDateString.split("-").map(Number);
  // Anchor date: 2026-09-19 is Day 1 (Index 0: Jobs)
  const anchorTime = Date.UTC(2026, 8, 19); // Month is 0-indexed (8 = September)
  const currentTime = Date.UTC(year, month - 1, day);
  const dayDifference = Math.floor((currentTime - anchorTime) / (24 * 60 * 60 * 1000));
  return ((dayDifference % 3) + 3) % 3;
};

/**
 * Opportunity category configuration mapping for the rotating cycle.
 */
const CYCLE_CONFIGS = [
  {
    index: 0,
    label: "Jobs",
    model: Job,
    appliedJobType: "Job",
    title: "Open Jobs Waiting For You 💼",
    getMessage: (count) =>
      count === 1
        ? "You have 1 open job opportunity waiting on GradEnvy that you haven't applied to yet. Apply before the deadline closes!"
        : `You have ${count} open job opportunities waiting on GradEnvy that you haven't applied to yet. Apply before the deadline closes!`,
  },
  {
    index: 1,
    label: "Internships",
    model: Internship,
    appliedJobType: "Internship",
    title: "Internship Openings Available 🎓",
    getMessage: (count) =>
      count === 1
        ? "You have 1 internship opening waiting on GradEnvy that you haven't applied to yet. Explore and apply today!"
        : `You have ${count} internship openings waiting on GradEnvy that you haven't applied to yet. Explore and apply today!`,
  },
  {
    index: 2,
    label: "Envy Projects",
    model: Freelance,
    appliedJobType: "Freelance",
    title: "New Envy Projects Available ⭐",
    getMessage: (count) =>
      count === 1
        ? "You have 1 Envy project opportunity waiting on GradEnvy that you haven't applied to yet. Submit your proposal before the deadline!"
        : `You have ${count} Envy project opportunities waiting on GradEnvy that you haven't applied to yet. Submit your proposal before the deadline!`,
  },
];

/**
 * Main execution handler that computes unapplied counts and dispatches alerts.
 */
export const runUnappliedOpportunityReminder = async () => {
  const cycleIndex = getCycleIndex();
  const config = CYCLE_CONFIGS[cycleIndex];

  console.log(`[UnappliedCron] Starting run for Cycle Day ${cycleIndex + 1}: ${config.label}`);

  try {
    const now = new Date();

    // ── Step 1: Query approved, active opportunities with unexpired deadlines ──
    const activeOpportunities = await config.model
      .find({
        isActive: true,
        status: "approved",
        $or: [
          { applicationDeadline: { $gte: now } },
          { applicationDeadline: null },
          { applicationDeadline: { $exists: false } },
        ],
      })
      .select("_id")
      .lean();

    const totalActiveCount = activeOpportunities.length;
    if (totalActiveCount === 0) {
      console.log(`[UnappliedCron] No active ${config.label} found with open deadlines. Skipping dispatch.`);
      return;
    }

    const activeOpportunityIds = activeOpportunities.map((item) => item._id);

    // ── Step 2: Concurrently query active candidates and their applications ────
    const [applications, activeUsers] = await Promise.all([
      AppliedJob.find({
        jobId: { $in: activeOpportunityIds },
        jobType: config.appliedJobType,
      })
        .select("userId jobId")
        .lean(),
      User.find({
        role: "user",
        is_active: { $ne: false },
      })
        .select("_id")
        .lean(),
    ]);

    if (activeUsers.length === 0) {
      console.log("[UnappliedCron] No active candidate users found to notify.");
      return;
    }

    // ── Step 3: Index applications per candidate for O(1) lookup ───────────────
    const userAppliedCountMap = new Map();
    applications.forEach((app) => {
      const uId = String(app.userId);
      userAppliedCountMap.set(uId, (userAppliedCountMap.get(uId) || 0) + 1);
    });

    // ── Step 4: Build eligible recipients with unapplied counts ────────────────
    const targets = [];
    activeUsers.forEach((user) => {
      const appliedCount = userAppliedCountMap.get(String(user._id)) || 0;
      const unappliedCount = totalActiveCount - appliedCount;

      if (unappliedCount > 0) {
        targets.push({
          userId: user._id,
          unappliedCount,
          message: config.getMessage(unappliedCount),
        });
      }
    });

    console.log(
      `[UnappliedCron] Found ${totalActiveCount} active ${config.label}; notifying ${targets.length} eligible candidates.`
    );

    if (targets.length === 0) return;

    // ── Step 5: Controlled Batch Dispatch (batches of 25) ─────────────────────
    const BATCH_SIZE = 25;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((target) =>
          sendAndSaveNotification({
            senderId: target.userId,
            receiverId: target.userId,
            title: config.title,
            message: target.message,
            body: target.message,
            type: "reminder",
            reference_id: activeOpportunityIds[0] || null,
            metadata: {
              category: "unapplied_opportunity_cron",
              opportunityType: config.label,
              unappliedCount: target.unappliedCount,
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
      `[UnappliedCron] Completed ${config.label} dispatch: ${sentCount} sent, ${failedCount} failed.`
    );
  } catch (error) {
    console.error(`[UnappliedCron] Error executing ${config.label} reminder cron:`, error.message);
  }
};

/**
 * Initializes the automated cron schedule to run daily at 11:00 AM IST.
 */
export const startUnappliedOpportunityReminderCron = () => {
  // Cron expression: minute 0, hour 11, every day, every month, every day of week
  cron.schedule("0 11 * * *", runUnappliedOpportunityReminder, {
    timezone: "Asia/Kolkata",
  });
  console.log("[UnappliedCron] Scheduled — daily at 11:00 AM IST (3-day cycle: Jobs → Internships → Envy)");
};

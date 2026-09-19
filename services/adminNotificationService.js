/**
 * Admin Notification Service
 *
 * Centralized business logic layer responsible for:
 * 1. Discovering target audiences across four distinct categories:
 *    - Events reminders (upcoming registered events, seminars, conferences, competitions)
 *    - Subscription opportunity nudges (unsubscribed / expired active users)
 *    - Saved opportunities reminders (unapplied saved jobs, internships, freelance)
 *    - Targeted application viewed alerts (all applicants of a specific job / internship)
 * 2. Consolidating multiple saved items into a single high-impact user notification.
 * 3. Dispatching in-app alerts and FCM push notifications on demand via sendAndSaveNotification.
 */

import mongoose from "mongoose";
import EventRegistration from "../models/eventRegistrationModel.js";
import Event from "../models/eventModel.js";
import Seminar from "../models/seminarModel.js";
import Conference from "../models/conferenceModel.js";
import Competition from "../models/competitionModel.js";
import SavedJob from "../models/savedJobModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import Job from "../models/jobModel.js";
import Internship from "../models/internshipModel.js";
import Freelance from "../models/freelanceModel.js";
import User from "../models/userModel.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

/**
 * Format a Date object or ISO string into a human-friendly date (e.g., "24 Sep 2026").
 */
const formatDisplayDate = (dateValue) => {
  if (!dateValue) return "an upcoming date";
  const dateObj = new Date(dateValue);
  if (Number.isNaN(dateObj.getTime())) return "an upcoming date";
  return dateObj.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/**
 * Retrieves targets for upcoming registered events.
 * Identifies events happening today or in the future across all four event models,
 * then maps registrations to a personalized schedule reminder.
 */
export const getEventReminderTargets = async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Concurrently fetch upcoming event IDs across all 4 event types
  const [upcomingEvents, upcomingSeminars, upcomingConferences, upcomingCompetitions] =
    await Promise.all([
      Event.find({ eventDate: { $gte: todayStart } }).select("_id eventName eventDate").lean(),
      Seminar.find({ eventDate: { $gte: todayStart } }).select("_id eventName eventDate").lean(),
      Conference.find({ eventDate: { $gte: todayStart } }).select("_id eventName eventDate").lean(),
      Competition.find({ eventDate: { $gte: todayStart } }).select("_id eventName eventDate").lean(),
    ]);

  // Index event metadata by ObjectId string for fast O(1) retrieval
  const eventLookup = new Map();
  [...upcomingEvents, ...upcomingSeminars, ...upcomingConferences, ...upcomingCompetitions].forEach(
    (ev) => {
      eventLookup.set(String(ev._id), {
        eventName: ev.eventName || "Event",
        eventDate: ev.eventDate,
      });
    }
  );

  const eligibleEventIds = Array.from(eventLookup.keys());
  if (eligibleEventIds.length === 0) return [];

  // Query registrations linked to these upcoming events
  const registrations = await EventRegistration.find({
    eventId: { $in: eligibleEventIds },
  })
    .select("userId eventId eventType")
    .lean();

  const regUserIds = Array.from(
    new Set(
      registrations
        .map((r) => String(r.userId))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  if (regUserIds.length === 0) return [];

  const existingUsers = await User.find({ _id: { $in: regUserIds } })
    .select("_id")
    .lean();

  if (existingUsers.length === 0) return [];

  const existingUserSet = new Set(existingUsers.map((u) => String(u._id)));

  // Group by userId to guarantee each attendee receives at most one reminder per dispatch
  const userEventMap = new Map();
  registrations.forEach((reg) => {
    const uId = String(reg.userId);
    if (
      existingUserSet.has(uId) &&
      !userEventMap.has(uId) &&
      eventLookup.has(String(reg.eventId))
    ) {
      userEventMap.set(uId, {
        userId: reg.userId,
        eventId: reg.eventId,
        eventType: reg.eventType,
        ...eventLookup.get(String(reg.eventId)),
      });
    }
  });

  return Array.from(userEventMap.values()).map((target) => {
    const formattedDate = formatDisplayDate(target.eventDate);
    const message = `Your registered event, ${target.eventName}, is scheduled for ${formattedDate}. Make sure you are ready to attend.`;

    return {
      userId: target.userId,
      title: "Upcoming Event Reminder 📅",
      message,
      body: message,
      reference_id: target.eventId,
      metadata: {
        category: "events",
        eventId: target.eventId,
        eventType: target.eventType,
      },
    };
  });
};

/**
 * Retrieves targets for active users without an active subscription plan.
 * Delivers the high-value promotional opportunity call-to-action.
 */
export const getSubscriptionReminderTargets = async () => {
  const unsubscribedUsers = await User.find({
    role: "user",
    is_active: { $ne: false },
    "subscription.isPlanActive": { $ne: true },
  })
    .select("_id name")
    .lean();

  const message =
    "A new Envy project with a Worth of ₹30,000 is currently available and matches the skills or interests you have shown on GradEnvy. View the project to see the requirements and application details.";

  return unsubscribedUsers.map((user) => ({
    userId: user._id,
    title: "New Project Opportunity Available ⭐",
    message,
    body: message,
    reference_id: null,
    metadata: {
      category: "subscriptions",
    },
  }));
};

/**
 * Retrieves targets for users who saved jobs, internships, or freelances but have not applied.
 * Evaluates in-memory diffs against AppliedJob and consolidates multiple saved items into
 * a single notification per candidate.
 */
export const getUnappliedJobTargets = async () => {
  const savedJobs = await SavedJob.find()
    .select("userId jobId jobType")
    .lean();

  if (savedJobs.length === 0) return [];

  // Extract unique candidate and job IDs to limit the applied job search space
  const candidateIds = Array.from(new Set(savedJobs.map((s) => String(s.userId))));
  const savedJobIds = Array.from(new Set(savedJobs.map((s) => String(s.jobId))));

  const appliedList = await AppliedJob.find({
    userId: { $in: candidateIds },
    jobId: { $in: savedJobIds },
  })
    .select("userId jobId")
    .lean();

  const appliedKeySet = new Set(
    appliedList.map((app) => `${String(app.userId)}_${String(app.jobId)}`)
  );

  // Verify candidate accounts actually exist in the User collection
  const validUsers = await User.find({
    _id: { $in: candidateIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) },
  })
    .select("_id")
    .lean();

  if (validUsers.length === 0) return [];

  const validUserIdSet = new Set(validUsers.map((u) => String(u._id)));

  // Filter for saved items where user exists and has not applied yet
  const unappliedSaved = savedJobs.filter(
    (item) =>
      validUserIdSet.has(String(item.userId)) &&
      !appliedKeySet.has(`${String(item.userId)}_${String(item.jobId)}`)
  );

  if (unappliedSaved.length === 0) return [];

  // Consolidate unapplied opportunities by candidate
  const userSavedMap = new Map();
  unappliedSaved.forEach((item) => {
    const uId = String(item.userId);
    if (!userSavedMap.has(uId)) {
      userSavedMap.set(uId, []);
    }
    userSavedMap.get(uId).push(item);
  });

  return Array.from(userSavedMap.entries()).map(([userId, items]) => {
    const count = items.length;
    const message =
      count === 1
        ? "You have 1 saved opportunity waiting on Gradenvy. Don't miss out, complete your application today!"
        : `You have ${count} saved opportunities waiting on Gradenvy. Don't miss out, complete your applications today!`;

    return {
      userId,
      title: "Complete Your Application 💼",
      message,
      body: message,
      reference_id: items[0]?.jobId || null,
      metadata: {
        category: "jobs",
        unappliedCount: count,
      },
    };
  });
};

/**
 * Retrieves targets for candidates who applied to a specific Job or Internship.
 * Triggered directly from the Job/Internship Profile Applied List tab.
 */
export const getJobApplicationViewedTargets = async (jobId, jobType = "Job") => {
  if (!jobId) {
    throw new Error("Job or Internship ID is required to dispatch application viewed alerts.");
  }

  // Resolve opportunity title across Job, Internship, or Freelance models
  let jobRecord = null;
  if (jobType === "Internship") {
    jobRecord = await Internship.findById(jobId).select("jobTitle companyName").lean();
  } else if (jobType === "Freelance") {
    jobRecord = await Freelance.findById(jobId).select("jobTitle companyName").lean();
  } else {
    jobRecord = await Job.findById(jobId).select("jobTitle companyName").lean();
  }

  const jobTitle = jobRecord?.jobTitle || "the position";

  // Query all applicants for this opportunity
  const applications = await AppliedJob.find({ jobId })
    .select("userId")
    .lean();

  if (applications.length === 0) return [];

  // Deduplicate candidates and verify they exist in User collection
  const rawCandidateIds = Array.from(
    new Set(
      applications
        .map((app) => app.userId)
        .filter((uId) => Boolean(uId) && mongoose.Types.ObjectId.isValid(uId))
        .map((uId) => String(uId))
    )
  );

  if (rawCandidateIds.length === 0) return [];

  // Ensure candidate users exist in User collection
  const existingUsers = await User.find({ _id: { $in: rawCandidateIds } })
    .select("_id")
    .lean();

  if (existingUsers.length === 0) {
    console.warn(
      `getJobApplicationViewedTargets: No matching user documents found for candidate IDs: ${rawCandidateIds.join(", ")}`
    );
    return [];
  }

  const validCandidateIds = existingUsers.map((u) => String(u._id));
  const message = `Your application for ${jobTitle} has been viewed by the recruitment team. Check your dashboard for updates.`;

  return validCandidateIds.map((userId) => ({
    userId,
    title: "Application Viewed 👀",
    message,
    body: message,
    reference_id: mongoose.Types.ObjectId.isValid(jobId) ? jobId : null,
    metadata: {
      category: "application_viewed",
      jobId: String(jobId),
      jobType,
    },
  }));
};

/**
 * Core dispatch coordinator.
 * Resolves targets and dispatches notifications on demand in controlled batches.
 */
export const dispatchNotifications = async (
  adminUserId,
  type,
  options = {}
) => {
  let targets = [];

  switch (type) {
    case "events":
      targets = await getEventReminderTargets();
      break;
    case "subscriptions":
      targets = await getSubscriptionReminderTargets();
      break;
    case "jobs":
      targets = await getUnappliedJobTargets();
      break;
    case "application_viewed":
      targets = await getJobApplicationViewedTargets(options.jobId, options.jobType);
      break;
    default:
      throw new Error(`Unsupported notification dispatch type: ${type}`);
  }

  if (targets.length === 0) {
    return {
      success: true,
      type,
      totalEligible: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  // ── Controlled Batch Dispatch (batches of 25) ───────────────────────────
  const BATCH_SIZE = 25;
  const failureDetails = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((target) => {
        // Fallback to target.userId if adminUserId is undefined or not a valid ObjectId
        const effectiveSenderId =
          adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)
            ? adminUserId
            : target.userId;

        const effectiveRefId =
          target.reference_id && mongoose.Types.ObjectId.isValid(target.reference_id)
            ? target.reference_id
            : null;

        return sendAndSaveNotification({
          senderId: effectiveSenderId,
          receiverId: target.userId,
          title: target.title,
          message: target.message,
          body: target.body,
          type: "reminder",
          reference_id: effectiveRefId,
          metadata: target.metadata,
        });
      })
    );

    batchResults.forEach((res, idx) => {
      if (res.status === "fulfilled" && res.value) {
        sentCount += 1;
      } else {
        failedCount += 1;
        const reason =
          res.status === "rejected"
            ? res.reason?.message || String(res.reason)
            : "User not found or notification could not be saved";
        failureDetails.push({
          targetUserId: String(batch[idx]?.userId),
          error: reason,
        });
        console.error(
          `[AdminNotification] Dispatch failed for recipient ${batch[idx]?.userId}:`,
          reason
        );
      }
    });
  }

  return {
    success: true,
    type,
    totalEligible: targets.length,
    sentCount,
    failedCount,
    ...(failureDetails.length > 0 && { failureDetails }),
  };
};

/**
 * Returns estimated audience counts across the 3 global categories for preview cards.
 */
export const getAudiencePreviewCounts = async () => {
  const [eventTargets, subscriptionTargets, jobTargets] = await Promise.all([
    getEventReminderTargets().catch((err) => {
      console.warn("Error estimating event reminder audience:", err.message);
      return [];
    }),
    User.countDocuments({
      role: "user",
      is_active: { $ne: false },
      "subscription.isPlanActive": { $ne: true },
    }).catch((err) => {
      console.warn("Error estimating subscription audience:", err.message);
      return 0;
    }),
    getUnappliedJobTargets().catch((err) => {
      console.warn("Error estimating unapplied job audience:", err.message);
      return [];
    }),
  ]);

  return {
    events: eventTargets.length,
    subscriptions: typeof subscriptionTargets === "number" ? subscriptionTargets : 0,
    jobs: jobTargets.length,
  };
};

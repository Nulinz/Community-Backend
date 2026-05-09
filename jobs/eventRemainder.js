// cron/eventReminder.cron.js

import cron from "node-cron";


import Competition from "../models/competitionModel.js";
import EventRegistration from "../models/eventRegistrationModel.js";
import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import Event from "../models/eventModel.js"
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

// ── Map eventType to its Mongoose model ──
const EVENT_MODEL_MAP = {
  Conference,
  Competition,
  Seminar,
  Event,
};

// ── How many hours before event to send reminder ──
const REMINDER_HOURS_BEFORE = 24;

// ── Batch size to avoid memory overload ──
const BATCH_SIZE = 100;

/**
 * Fetch upcoming events from a single model
 * that are ~24 hours away and not yet reminded
 */
const getUpcomingEventIds = async (Model, eventType) => {
  try {
    const now = new Date();

    // ── Tomorrow: full day from 00:00:00 to 23:59:59 ──
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    console.log(`[EventReminder] Checking ${eventType} between`, tomorrowStart, "→", tomorrowEnd);

    const events = await Model.find({
      eventDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
    }).select("_id eventDate").lean();

    console.log(`[EventReminder] ${eventType} found:`, events.length);

    return events.map((e) => ({
      eventId: e._id,
      eventType,
      eventDate: e.eventDate,
    }));
  } catch (error) {
    console.error(`getUpcomingEventIds [${eventType}] error:`, error.message);
    return [];
  }
};

/**
 * Process one batch of registrations and send notifications
 */
const processBatch = async (registrations) => {
  const promises = registrations.map(async (reg) => {
    try {
      await sendAndSaveNotification({
        senderId:   reg.userId,
        receiverId: reg.userId,
        title: "Event Reminder 🔔",
        message: `Your registered ${reg.eventType} is starting tomorrow. Don't miss it!`,
        body:    `Your registered ${reg.eventType} is starting tomorrow. Don't miss it!`,
        type: "reminder",
        reference_id: reg.eventId,
        metadata: {
          eventType: reg.eventType,
          eventDate: reg.eventDate,
          registrationId: reg._id,
        },
      });

      // ── Mark as reminded so we never send twice ──
      await EventRegistration.findByIdAndUpdate(reg._id, { remainder: true });

    } catch (error) {
      console.error(`processBatch: failed for registration ${reg._id}:`, error.message);
      // ⭐ Don't throw — let other registrations in batch continue
    }
  });

  await Promise.allSettled(promises); // allSettled = never blocks on one failure
};

/**
 * Main reminder job logic
 */
const runEventReminderJob = async () => {
  console.log(`[EventReminder] Job started at ${new Date().toISOString()}`);

  try {
    // ── Step 1: Collect upcoming event IDs from all 4 models in parallel ──
    const [conferences, competitions, seminars, events] = await Promise.all([
      getUpcomingEventIds(Conference,  "Conference"),
      getUpcomingEventIds(Competition, "Competition"),
      getUpcomingEventIds(Seminar,     "Seminar"),
      getUpcomingEventIds(Event,       "Event"),
    ]);

    const upcomingEvents = [...conferences, ...competitions, ...seminars, ...events];

    if (upcomingEvents.length === 0) {
      console.log("[EventReminder] No upcoming events found. Job done.");
      return;
    }

    console.log(`[EventReminder] Found ${upcomingEvents.length} upcoming event(s)`);

    // ── Step 2: For each event, fetch registrations in batches ──
    for (const { eventId, eventType, eventDate } of upcomingEvents) {
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        // ── Only fetch registrations not yet reminded ──
        const registrations = await EventRegistration.find({
          eventId,
          eventType,
          remainder: false,   // ⭐ skip already reminded
        })
          .select("_id userId eventId eventType")
          .populate("userId", "fcm_token")
          .skip(skip)
          .limit(BATCH_SIZE)
          .lean();

        if (registrations.length === 0) {
          hasMore = false;
          break;
        }

        // ── Attach eventDate for metadata ──
        const enriched = registrations.map((r) => ({ ...r, eventDate }));

        // ── Process this batch ──
        await processBatch(enriched);

        skip += BATCH_SIZE;

        // ── If less than batch size returned, we're done ──
        if (registrations.length < BATCH_SIZE) hasMore = false;
      }
    }

    console.log(`[EventReminder] Job completed at ${new Date().toISOString()}`);

  } catch (error) {
    console.error("[EventReminder] Job failed:", error.message);
  }
};

/**
 * Schedule: runs every hour
 * ┌─── minute (0)
 * │ ┌─── hour (every hour → *)
 * │ │ ┌─── day of month
 * │ │ │ ┌─── month
 * │ │ │ │ ┌─── day of week
 * 0 * * * *
 */
export const startEventReminderCron = () => {
  cron.schedule("* * * * *", async () => {
    await runEventReminderJob();
  });

  console.log("[EventReminder] Cron job scheduled — runs every hour");
};
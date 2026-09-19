/**
 * Admin Notification Controller
 *
 * Exposes administrative HTTP endpoints to:
 * 1. Fetch real-time audience preview counts for UI cards.
 * 2. Trigger bulk dispatch for global categories (events, subscriptions, unapplied jobs).
 * 3. Trigger targeted application viewed alerts for candidates of a specific job/internship.
 *
 * Implements defensive parameter validation and consistent error responses.
 */

import {
  dispatchNotifications,
  getAudiencePreviewCounts,
} from "../services/adminNotificationService.js";

/**
 * Dispatches bulk notifications for a selected global category.
 * Enforces valid category types: 'events', 'subscriptions', 'jobs'.
 */
export const triggerNotificationDispatch = async (req, res) => {
  try {
    const { type } = req.body;
    const allowedTypes = ["events", "subscriptions", "jobs"];

    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification type. Must be one of: ${allowedTypes.join(", ")}`,
      });
    }

    const adminUserId = req.user?._id;
    const result = await dispatchNotifications(adminUserId, type);

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${type} notification dispatch`,
      data: result,
    });
  } catch (error) {
    console.error("triggerNotificationDispatch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dispatch notifications",
    });
  }
};

/**
 * Dispatches targeted application viewed alerts to candidates of a specific job/internship.
 * Invoked from the Applied List tab on Job or Internship profile views.
 */
export const triggerApplicationViewedDispatch = async (req, res) => {
  try {
    const { jobId, jobType = "Job" } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required to trigger application viewed notifications",
      });
    }

    const validJobTypes = ["Job", "Internship", "Freelance"];
    if (!validJobTypes.includes(jobType)) {
      return res.status(400).json({
        success: false,
        message: `jobType must be one of: ${validJobTypes.join(", ")}`,
      });
    }

    const adminUserId = req.user?._id;
    const result = await dispatchNotifications(adminUserId, "application_viewed", {
      jobId,
      jobType,
    });

    return res.status(200).json({
      success: true,
      message: "Application viewed notifications processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("triggerApplicationViewedDispatch error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dispatch application viewed notifications",
    });
  }
};

/**
 * Returns estimated audience counts for the Admin Dashboard Notification Hub modal.
 */
export const getNotificationAudienceStats = async (req, res) => {
  try {
    const counts = await getAudiencePreviewCounts();

    return res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    console.error("getNotificationAudienceStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notification audience stats",
    });
  }
};

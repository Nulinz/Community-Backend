// helpers/notification.helper.js

import Notification from "../models/notificationModel.js";

/**
 * Save a notification to the database
 * @param {Object} params
 * @param {string} params.sender - Sender user ID
 * @param {string} params.receiver - Receiver user ID
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.type - Notification type (must match enum)
 * @param {string} [params.body] - Optional body
 * @param {string} [params.reference_id] - Optional reference document ID
 * @param {Object} [params.metadata] - Optional extra data
 * @returns {Promise<Object>} - Saved notification document
 */
export const saveNotification = async ({
  sender,
  receiver,
  title,
  message,
  type,
  body = null,
  reference_id = null,
  metadata = {},
}) => {
  try {
    const notification = await Notification.create({
      sender,
      receiver,
      title,
      message,
      type,
      ...(body && { body }),
      ...(reference_id && { reference_id }),
      metadata,
    });

    return notification;
  } catch (error) {
    console.error("saveNotification error:", error.message);
    throw error;
  }
};
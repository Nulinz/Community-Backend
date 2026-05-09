// helpers/notification.helper.js

import { sendNotification } from "../config/notification.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";

/**
 * Save a notification to the database
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


/**
 * Send push notification + save to DB
 * @param {Object} params
 * @param {string} params.senderId   - User ID of the sender
 * @param {string} params.receiverId - User ID of the receiver
 * @param {string} params.title      - Notification title
 * @param {string} params.message    - Notification message (saved to DB)
 * @param {string} params.body       - Push notification body text (shown on device)
 * @param {string} params.type       - Notification type (must match enum)
 * @param {string} [params.reference_id] - Optional reference document ID
 * @param {Object} [params.metadata]     - Optional extra data
 */
export const sendAndSaveNotification = async ({
  senderId,
  receiverId,
  title,
  message,
  body,
  type,
  reference_id = null,
  metadata = {},
}) => {
  try {
    // ── Step 1: Fetch receiver's FCM token from DB ──
    const receiver = await User.findById(receiverId).select("fcm_token");

    if (!receiver) {
      console.warn(`sendAndSaveNotification: Receiver ${receiverId} not found`);
      return null;
    }

    // ── Step 2: Send push notification if FCM token exists ──
    if (receiver.fcm_token) {
      await sendNotification({
        token: receiver.fcm_token,
        title,
        body: body || message,   // fallback to message if body not provided
        type,
        id: String(reference_id || ""),
        ...metadata,
      });
    } else {
      console.warn(`sendAndSaveNotification: No FCM token for receiver ${receiverId}`);
    }

    // ── Step 3: Save notification to DB regardless of FCM result ──
    const saved = await saveNotification({
      sender: senderId,
      receiver: receiverId,
      title,
      message,
      type,
      body: body || null,
      reference_id,
      metadata,
    });

    return saved;

  } catch (error) {
    console.error("sendAndSaveNotification error:", error.message);
    throw error;
  }
};
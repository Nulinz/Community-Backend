import Notification from "../models/notificationModel";

/**
 * Create a notification
 * @param {Object} options
 * @param {ObjectId} options.sender       - who triggered the action
 * @param {ObjectId} options.receiver     - who receives the notification
 * @param {String}   options.title        - notification title
 * @param {String}   options.message      - notification message
 * @param {String}   options.type         - notification type enum
 * @param {ObjectId} options.reference_id - related document id (optional)
 * @param {String}   options.body         - extra body text (optional)
 * @param {Object}   options.metadata     - extra data (optional)
 * @returns {Promise<Notification>}
 */
export const sendNotification = async ({
  sender,
  receiver,
  title,
  message,
  type,
  reference_id = null,
  body = "",
  metadata = {},
}) => {
  try {
    const notification = await Notification.create({
      sender,
      receiver,
      title,
      message,
      body,
      type,
      reference_id,
      metadata,
    });
    return notification;
  } catch (error) {
    console.error("Send Notification Error:", error.message);
  }
};
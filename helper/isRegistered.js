import EventRegistration from "../models/eventRegistrationModel.js";
 
/**
 * Check if a user is already registered for an event
 * @param {ObjectId} userId  - req.user._id
 * @param {ObjectId} eventId - conference, competition, seminar or event _id
 * @returns {Boolean}
 */
export const checkIsRegistered = async (userId, eventId) => {
  if (!userId || !eventId) return false;
  const registered = await EventRegistration.findOne({ userId, eventId });
  return !!registered;
};
 
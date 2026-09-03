import mongoose from "mongoose";
import SavedJob from "../models/savedJobModel.js";

/**
 * Checks whether a specific job, internship, or freelance post is saved by the user.
 */
export const checkIsSaved = async (userId, jobId, jobType = null) => {
  if (!userId || !jobId) return false;
  try {
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(String(userId))
      : userId;
    const jobObjectId = mongoose.Types.ObjectId.isValid(jobId)
      ? new mongoose.Types.ObjectId(String(jobId))
      : jobId;

    // Check with direct query first
    const saved = await SavedJob.findOne({
      userId: userObjectId,
      jobId: jobObjectId,
    }).lean();

    return !!saved;
  } catch (err) {
    const fallback = await SavedJob.findOne({ userId, jobId }).lean();
    return !!fallback;
  }
};

 

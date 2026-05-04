import SavedJob from "../models/savedJobModel.js";
export const checkIsSaved = async (userId, jobId, jobType=null) => {
  if (!userId || !jobId) return false;
  const saved = await SavedJob.findOne({ userId, jobId });
  return !!saved;
};
 

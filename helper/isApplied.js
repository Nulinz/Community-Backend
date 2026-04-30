import AppliedJob from "../models/appliedJobModel.js";


export const checkIsApplied = async (userId, jobId) => {
  if (!userId || !jobId) return false;
  const applied = await AppliedJob.findOne({ userId, jobId });
  return !!applied;
};
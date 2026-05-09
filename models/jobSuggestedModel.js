// models/jobSuggestedModel.js
import mongoose from "mongoose";

const jobSuggestedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "jobType",
    },
    jobType: {
      type: String,
      enum: ["Internship", "Freelance"],
      required: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    organizer: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      enum: ["follower", "skill_match", "job_title_match", "similar_applied", "most_applied"],
      default: "skill_match",
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ── Prevent duplicate suggestions ──────────────────────────────────────
jobSuggestedSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const JobSuggested =
  mongoose.models.JobSuggested ||
  mongoose.model("JobSuggested", jobSuggestedSchema);

export default JobSuggested;
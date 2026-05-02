import mongoose from "mongoose";

const appliedJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  },
  { timestamps: true }
);

// Prevent duplicate applications — same user can't apply to same job twice
appliedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const AppliedJob = mongoose.model("AppliedJob", appliedJobSchema);

export default AppliedJob;
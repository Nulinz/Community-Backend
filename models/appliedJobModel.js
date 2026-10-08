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
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    jobType: {
      type: String,
      enum: ["Job", "Internship", "Freelance"],
      default: "Job",
    },
    status: {
      type: String,
      enum: ["applied", "selected", "rejected"],
      default: "applied",
    },
    portfolios: [
      {
        field_name: {
          type: String,
          trim: true,
          default: "Portfolio",
        },
        portfolio: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
    portfolio: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate applications — same user can't apply to same job twice
appliedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const AppliedJob = mongoose.model("AppliedJob", appliedJobSchema);

export default AppliedJob;
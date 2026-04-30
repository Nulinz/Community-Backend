import mongoose from "mongoose";

const savedJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    jobType: {
      type: String,
      enum: ["internship", "freelance"],
      required: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "jobType", // dynamically refs internship or freelance model
    },
  },
  { timestamps: true }
);

// Prevent duplicate saves — same user can't save same job twice
savedJobSchema.index({ userId: 1, jobId: 1, jobType: 1 }, { unique: true });

const SavedJob = mongoose.model("SavedJob", savedJobSchema);

export default SavedJob;
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "jobType",
    },
    jobType: {
      type: String,
      enum: ["Job", "Internship", "Freelance"],
      default: "Job",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      default: "present",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate attendance records for the same candidate on the same date for a job
attendanceSchema.index({ jobId: 1, userId: 1, date: 1 }, { unique: true });

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;

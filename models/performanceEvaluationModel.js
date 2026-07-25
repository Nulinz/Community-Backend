import mongoose from "mongoose";

const performanceEvaluationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppliedJob",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Internship",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    evaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ratings: {
      communication: { type: Number, min: 0, max: 5, default: 0 },
      technicalSkills: { type: Number, min: 0, max: 5, default: 0 },
      problemSolving: { type: Number, min: 0, max: 5, default: 0 },
      teamwork: { type: Number, min: 0, max: 5, default: 0 },
      professionalism: { type: Number, min: 0, max: 5, default: 0 },
      learningAbility: { type: Number, min: 0, max: 5, default: 0 },
    },
    remarks: {
      communication: { type: String, default: "" },
      technicalSkills: { type: String, default: "" },
      problemSolving: { type: String, default: "" },
      teamwork: { type: String, default: "" },
      professionalism: { type: String, default: "" },
      learningAbility: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

performanceEvaluationSchema.index({ applicationId: 1 }, { unique: true });

export default mongoose.model("PerformanceEvaluation", performanceEvaluationSchema);

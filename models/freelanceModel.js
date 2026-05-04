import mongoose from "mongoose";

const freelanceSchema = new mongoose.Schema(
  {
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobTitle: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    mode: { type: String, required: true },
    totalOpenings: { type: Number, default: 0 },
    duration: { type: String },
    applicationDeadline: { type: Date },
    jobStartDate: { type: Date },
    salary: { type: Number, default: 0 },
    projectNeeds: [{ type: String, trim: true }],
    eligibility: [{ type: String, trim: true }],
    security: [{ type: String, trim: true }],
    referenceWebsite: [{ type: String, trim: true }],
    rules: [{ type: String, trim: true }],
    payment_structure: [{ type: String, trim: true }],
    supporting_files: [{ type: String, trim: true }],
    eligibility_criteria:[{ type: String, trim: true }],
    learning: { type: String, trim: true },
    certificateAvailability: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Freelance = mongoose.models.Freelance || mongoose.model("Freelance", freelanceSchema);
export default Freelance;

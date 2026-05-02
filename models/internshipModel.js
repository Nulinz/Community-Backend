import mongoose from "mongoose";

const internshipSchema = new mongoose.Schema(
  {
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    internshipType: { type: String, required: true },
    jobTitle: { type: String, required: true, trim: true },
    organizer: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    mode: { type: String, required: true },
    totalOpenings: { type: Number, default: 0 },
    duration: { type: String },
    internStartDate: { type: Date },
    applicationDeadline: { type: Date },
    salary: { type: Number, default: 0 },
    responsibilities: [{ type: String, trim: true }],
    skill_set: [{ type: String, trim: true }],
    benefits: [{ type: String, trim: true }],
    learning_outcomes: [{ type: String, trim: true }],
    development_benefits: [{ type: String, trim: true }],
   development_resources: [{ type: String, trim: true }],
    // skill_set
    eligibility: [{ type: String, trim: true }],
    description: { type: String, trim: true },
    certificateAvailability: { type: String, trim: true },
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

const Internship = mongoose.models.Internship || mongoose.model("Internship", internshipSchema);
export default Internship;

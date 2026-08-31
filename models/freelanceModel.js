import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema({
  milestoneName: { type: String, trim: true },
  amount: { type: Number, default: 0 },
  dueDate: { type: Date },
});

const freelanceSchema = new mongoose.Schema(
  {
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rejected_reason: { type: String },
    status: {
  type: String,
  required: true,
  enum: ["pending", "approved", "rejected"],
  default: "pending"
},
    jobTitle: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    mode: { type: String, required: true },
    duration: { type: String },
    location: {
      type: String,
      trim: true,
      required: function () {
        return this.mode === "Offline" || this.mode === "Hybrid";
      },
    },
    applicationDeadline: { type: Date },
    jobStartDate: { type: Date },
    jobEndDate: { type: Date },
    salary: { type: Number, default: 0 },
    budgetType: { type: String, trim: true, default: "Fixed" },
    budget: { type: String, trim: true },
    paymentMethod: { type: String, trim: true },
    paymentStructure: { type: String, trim: true, default: "Full Payment" },
    milestones: [milestoneSchema],
    projectNeeds: [{ type: String, trim: true }],
    eligibility: [{ type: String, trim: true }],
    security: [{ type: String, trim: true }],
    referenceWebsite: [{ type: String, trim: true }],
    skill_set: [{ type: String, trim: true }],
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

import mongoose from "mongoose";

const companyFollowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate follows
companyFollowSchema.index({ userId: 1, companyId: 1 }, { unique: true });

const CompanyFollow =
  mongoose.models.CompanyFollow ||
  mongoose.model("CompanyFollow", companyFollowSchema);

export default CompanyFollow;
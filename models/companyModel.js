import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    companyType: {
      type: String,
      required: true,
      trim: true,
    },
    companyTagLine: {
      type: String,
      required: true,
      trim: true,
    },
    companyCultureTags: {
      type: String,
      default: "",
      trim: true,
    },
    yearFounded: {
      type: String,
      default: "",
      trim: true,
    },
    websiteLink: {
      type: String,
      default: "",
      trim: true,
    },
    companyLogo: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String,
      required: true,
      trim: true,
    },
    contactPersonName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    technologies: {
      type: [String],
      default: [],
    },
    whatWeDo: {
      type: [String],
      default: [],
    },
    learningBenefits: {
      type: [String],
      default: [],
    },
    learningOutcomes: {
      type: [String],
      default: [],
    },
    aboutUs: {
      type: String,
      default: "",
      trim: true,
    },
    certificateAvailability: {
      type: String,
      default: "",
      trim: true,
    },
    posts: {
      type: [String],
      default: [],
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


const Company = mongoose.models.Company || mongoose.model("Company", companySchema);

export default Company;

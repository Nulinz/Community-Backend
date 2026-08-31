import mongoose from "mongoose";

const roundSchema = new mongoose.Schema({
  roundNumber: { type: String, trim: true },
  roundName: { type: String, trim: true },
  roundDescription: { type: String, trim: true },
});

const scheduleSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  startTime: { type: String, trim: true },
  endTime: { type: String, trim: true },
});

const inchargeSchema = new mongoose.Schema({
  type: { type: String, trim: true },
  name: { type: String, trim: true },
  phoneNumber: { type: String, trim: true },
  mailId: { type: String, trim: true },
});

const competitionSchema = new mongoose.Schema(
  {
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Basic Details
    rejected_reason: { type: String },
    status: {
  type: String,
  required: true,
  enum: ["pending", "approved", "rejected"],
  default: "pending"
},
    eventName: { type: String, required: true, trim: true },
    organizer: { type: String, required: true, trim: true },
    mode: { type: String, required: true, enum: ["Online", "Offline", "Hybrid"] },
    eventDate: { type: Date, required: true },
    eventStartTime: { type: String, trim: true },
    eventEndDate: { type: Date },
    eventEndTime: { type: String, trim: true },
    onlinePlatformLink: { type: String, trim: true },
    registrationType: {
  type: String,
  enum: ["Free", "Paid"],
  required: true,
  default: "Free",
},
    registrationStartDate: { type: Date },
    registrationEndDate: { type: Date },
    totalSeats: { type: Number },
    coverImage: { type: String, required: true },
    // Advanced Details
    rounds: [roundSchema],
    schedule: [scheduleSchema],

    // Fees
    individualFees: { type: Number, default: 0 },
    teamFees: { type: Number, default: 0 },
    lateFees: { type: Number, default: 0 },

    // Opportunities
    internshipOpportunity: { type: String },
    internshipOpportunityDetails: { type: String, trim: true },
    placementOpportunity: { type: String },
    placementOpportunityDetails: { type: String, trim: true },
    industryExposure: { type: String },
    industryExposureDetails: { type: String, trim: true },
    industryPartners: { type: String },
    certificateAvailability: { type: String, trim: true, default: "No" },
    signatoryName: { type: String, trim: true, default: "" },
    signatoryDesignation: { type: String, trim: true, default: "" },
    signatureUrl: { type: String, trim: true, default: "" },
    certificateContentBody: { type: String, trim: true, default: "" },
    // Prizes
    prizesAvailable: { type: String, trim: true, default: "No" },
    firstPrize: { type: String, trim: true },
    secondPrize: { type: String, trim: true },
    thirdPrize: { type: String, trim: true },
    participationPrize: { type: String, trim: true },

    // Venue
    venueName: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    geoLocation: { type: String, trim: true },

    // Food & Accommodation
    foodProvide: { type: String },
    vegNonVeg: { type: String },
    midnightSnacks: { type: String },
    accommodationProvide: { type: String },
    separatedForBoysGirls: { type: String },
    onlyForOutstationParticipants: { type: String },

    // Team & Eligibility
    incharges: [inchargeSchema],
    eligibilityDetails: { type: String, trim: true },
    allowedDepartments: {
  type: [String],
},
    teamOrIndividualEvent: {
  type: String,
  enum: ["Team", "Individual", "Both"],
  required: true,
  default: "Individual",
},
    teamSizeMinimum: { type: Number },
    teamSizeMaximum: { type: Number },

    // Rules & Description
    ruleBook: { type: String, required: true },
    additionalRules: { type: String, trim: true },
    description: { type: String, trim: true },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    posts: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

const Competition = mongoose.models.Competition || mongoose.model("Competition", competitionSchema);
export default Competition;

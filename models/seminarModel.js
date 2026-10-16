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
  countryCode: { type: String, trim: true, default: "+91" },
  phoneNumber: { type: String, trim: true },
  mailId: { type: String, trim: true },
});

const customFeeSchema = new mongoose.Schema({
  feeLabel: { type: String, trim: true },
  feeAmount: { type: Number, default: 0 },
});

const seminarSchema = new mongoose.Schema(
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
    eventType: { type: String },
    eventName: { type: String, trim: true },
    organizer: { type: String, trim: true },
    mode: { type: String },
    onlinePlatformLink: { type: String, trim: true },
    eventDate: { type: Date },
    eventEndDate: { type: Date },
    registrationType: {
      type: String,
      enum: ["Free", "Paid"],
      default: "Free",
    },
    registrationStartDate: { type: Date },
    registrationEndDate: { type: Date },
    totalSeats: { type: Number },
    externalRegistrationLink: { type: String, trim: true, default: "" },
    coverImage: { type: String },

    // Advanced Details
    rounds: [roundSchema],
    schedule: [scheduleSchema],

    // Fees
    individualFees: { type: Number, default: 0 },
    teamFees: { type: Number, default: 0 },
    lateFees: { type: Number, default: 0 },
    gst: { type: String, trim: true, default: "No" },
    customFees: [customFeeSchema],

    // Prizes
    firstPrize: { type: String, trim: true },
    secondPrize: { type: String, trim: true },
    thirdPrize: { type: String, trim: true },
    participationPrize: { type: String, trim: true },

    // Opportunity
    internshipOpportunity: { type: String },
    placementOpportunity: { type: String },
    industryExposure: { type: String },
    industryPartners: { type: String },

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
    eventStartTime: { type: String, trim: true },
    eventEndTime: { type: String, trim: true },
    // Team & Eligibility
    incharges: [inchargeSchema],
    eligibilityDetails: { type: String, trim: true },
    allowedDepartments: {
      type: [String],
    },
    teamOrIndividualEvent: {
      type: String,
      enum: ["Team", "Individual", "Both"],
      default: "Individual",
    },
    teamSizeMinimum: { type: Number },
    teamSizeMaximum: { type: Number },
    certificateAvailability: { type: String, trim: true, default: "No" },
    signatoryName: { type: String, trim: true, default: "" },
    signatoryDesignation: { type: String, trim: true, default: "" },
    signatureUrl: { type: String, trim: true, default: "" },
    certificateContentBody: { type: String, trim: true, default: "" },
    // Rules & Description
    description: { type: String, trim: true },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Gallery
    posts: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

const Seminar = mongoose.models.Seminar || mongoose.model("Seminar", seminarSchema);
export default Seminar;

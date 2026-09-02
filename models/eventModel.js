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

const eventSchema = new mongoose.Schema(
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
    // Basic Details
    eventType: { type: String, required: true },
    eventCategory: { type: String, trim: true },
    eventName: { type: String, required: true, trim: true },
    organizer: { type: String, required: true, trim: true },
    mode: { type: String, required: true },
    eventDate: { type: Date, required: true },
    eventStartTime: { type: String, trim: true },
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
    externalRegistrationLink: { type: String, trim: true, default: "" },
    coverImage: { type: String, required: true },
    certificateAvailability: { type: String, trim: true, default: "No" },
    signatoryName: { type: String, trim: true, default: "" },
    signatoryDesignation: { type: String, trim: true, default: "" },
    signatureUrl: { type: String, trim: true, default: "" },
    certificateContentBody: { type: String, trim: true, default: "" },
    // Advanced Details
    rounds: [roundSchema],
    schedule: [scheduleSchema],

    // Fees
    individualFees: { type: Number, default: 0 },
    teamFees: { type: Number, default: 0 },
    lateFees: { type: Number, default: 0 },

    // Prizes
    prizesAvailable: { type: String, trim: true, default: "No" },
    firstPrize: { type: String, trim: true },
    secondPrize: { type: String, trim: true },
    thirdPrize: { type: String, trim: true },
    participationPrize: { type: String, trim: true },

    // Opportunities
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

const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
export default Event;

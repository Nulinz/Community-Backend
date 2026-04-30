import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema(
  {
    // Event Reference
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    eventType: {
      type: String,
      enum: ["conference", "competition", "seminar", "event"],
      required: true,
    },

    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Personal Details
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    collegeName: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    mailId: {
      type: String,
      required: true,
      trim: true,
    },

    // Food
    food: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    foodType: {
      type: String,
      enum: ["veg", "non-veg"],
      default: null,
    },

    // Accommodation
    accommodation: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    accommodationType: {
      type: String,
      enum: ["boys", "girls"],
      default: null,
    },
  },
  { timestamps: true }
);

// Prevent duplicate registration — same user can't register for same event twice
eventRegistrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

const EventRegistration =
  mongoose.models.EventRegistration ||
  mongoose.model("EventRegistration", eventRegistrationSchema);

export default EventRegistration;
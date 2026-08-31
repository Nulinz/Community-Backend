import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    eventType: {
      type: String,
      trim: true,
    },
    signatoryName: {
      type: String,
      trim: true,
    },
    signatoryDesignation: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    issuedDate: {
      type: Date,
      default: Date.now,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    verified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Certificate", certificateSchema);

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Common Reference
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    referenceType: {
      type: String,
      required: true,
      enum: [
        "EventRegistration",
        "Course",
        "Subscription",
        "Product",
        "Membership",
        "Donation",
      ],
      index: true,
    },

    // Event / Resource
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      refPath: "eventType",
    },

    eventType: {
      type: String,
      enum: ["Conference", "Competition", "Seminar", "Event"],
      default: null,
    },

    // Creator
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Amount
    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    // Payment Method
    paymentMethod: {
      type: String,
      enum: [
        "UPI",
        "Card",
        "NetBanking",
        "Wallet",
        "Cash",
      ],
      required: true,
    },

    // Status
    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Success",
        "Failed",
        "Cancelled",
        "Refunded",
      ],
      default: "Pending",
      index: true,
    },

    // Gateway
    paymentGateway: {
      type: String,
      enum: [
        "Razorpay",
        "Stripe",
        "Cashfree",
        "PhonePe",
        "Offline",
      ],
      default: "Razorpay",
    },

    transactionId: {
      type: String,
      trim: true,
      default: null,
    },

    orderId: {
      type: String,
      trim: true,
      default: null,
    },

    paymentId: {
      type: String,
      trim: true,
      default: null,
    },

    signature: {
      type: String,
      trim: true,
      default: null,
    },

    // Refund
    refundStatus: {
      type: String,
      enum: [
        "NotRequested",
        "Requested",
        "Processed",
      ],
      default: "NotRequested",
    },

    refundAmount: {
      type: Number,
      default: 0,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    // Extra Data
    remarks: {
      type: String,
      trim: true,
      default: null,
    },

    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({
  userId: 1,
  referenceId: 1,
  referenceType: 1,
});

const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);

export default Payment;
import mongoose from "mongoose";

/**
 * Payment Transaction Schema:
 * Serves as the single source of truth for all transactional audit logs across
 * the platform, including Android (Razorpay) and iOS (Apple StoreKit 2) subscriptions,
 * event registrations, and external checkout lifecycles.
 */
const paymentSchema = new mongoose.Schema(
  {
    // User identifier associated with the transaction
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Reference ID pointing to the subscribed entity or registered event
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

    // Creator / Performer ID
    c_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Transaction amount (stored in major currency units, e.g., INR 499)
    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    // Payment Method (e.g. "UPI", "Card", "In-App Purchase")
    paymentMethod: {
      type: String,
      default: null,
      trim: true,
    },

    // Status: Unified lifecycle across Android (Razorpay) & iOS (Apple StoreKit)
    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Success",
        "Failed",
        "Cancelled",
        "Refunded",
        "pending",
        "captured",
        "failed",
        "paid",
      ],
      default: "Pending",
      index: true,
    },

    // Gateway identifier supporting both Android (Razorpay) and iOS (Apple StoreKit)
    paymentGateway: {
      type: String,
      enum: [
        "Razorpay",
        "Stripe",
        "Cashfree",
        "PhonePe",
        "Offline",
        "Apple StoreKit",
        "Apple",
      ],
      default: "Razorpay",
      index: true,
    },

    transactionId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    orderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
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

    // ── Apple In-App Purchase (StoreKit 2) Specific Properties ────────
    receipt: {
      type: String,
      default: null,
    },

    productId: {
      type: String,
      trim: true,
      default: null,
    },

    originalTransactionId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    failureReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Refund Tracking
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

    // Webhook Audit & Lifecycle Tracking
    webhookStatus: {
      type: String,
      enum: [
        "NotReceived",
        "Received",
        "Processed",
        "Failed",
        "Skipped",
      ],
      default: "NotReceived",
      index: true,
    },

    webhookEvent: {
      type: String,
      trim: true,
      default: null,
    },

    webhookReceivedAt: {
      type: Date,
      default: null,
    },

    webhookDetails: {
      type: Object,
      default: {},
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

    // Payment execution date (stored in IST, UTC+05:30)
    paymentDate: {
      type: Date,
      default: () => new Date(Date.now() + 5.5 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: {
      currentTime: () => new Date(Date.now() + 5.5 * 60 * 60 * 1000),
    },
  }
);

// Query optimization indexes
paymentSchema.index({
  userId: 1,
  referenceId: 1,
  referenceType: 1,
});
paymentSchema.index({ orderId: 1, paymentGateway: 1 });
paymentSchema.index({ originalTransactionId: 1 });

const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);

export default Payment;

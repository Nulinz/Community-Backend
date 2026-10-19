import crypto from "crypto";
import Razorpay from "razorpay";
import User from "../../models/userModel.js";
import Payment from "../../models/paymentModel.js";
import SubscriptionPlan from "../../models/subscriptionPlanModel.js";
import { triggerMissionNotification } from "../../services/xpService.js";
import {
  fulfillSubscriptionPayment,
  expireStalePendingPayments,
} from "../../services/paymentFulfillmentService.js";

/**
 * Initializes and returns a Razorpay client instance.
 * Returns null if API credentials are not set in environment variables.
 */
export const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Indian Standard Time (IST, UTC+05:30) offset in milliseconds (5.5 hours)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getNowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Fetch available active subscription plans.
 */
export const getSubscriptionPlans = async (req, res, next) => {
  try {
    let plans = await SubscriptionPlan.find({ isActive: true }).select("-__v");

    // Fallback default plans if DB hasn't been seeded yet
    if (!plans || plans.length === 0) {
      plans = [
        {
          planKey: "pro_quarterly",
          name: "Pro Quarterly",
          tier: "pro",
          billingCycle: "90 days",
          durationDays: 90,
          price: 499,
          currency: "INR",
          features: ["Access all events & courses", "Priority support", "Pro badge"],
          isActive: true,
        },
      ];
    }

    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 1: Pre-Payment Order Creation
 * Requests an order from Razorpay and logs a Pending payment record in MongoDB.
 * Attaches userId and planKey inside notes for background webhook recovery.
 */
export const createSubscriptionOrder = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    const { planKey = "pro_quarterly", amount } = req.body;
    const finalAmount = Number(amount) || (planKey === "pro_yearly" ? 2999 : 499);

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway is not properly configured.",
      });
    }

    // Amount passed to Razorpay must be in paise (INR * 100)
    const options = {
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `sub_${userId.toString().slice(-6)}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        planKey,
      },
    };

    const rzpOrder = await razorpay.orders.create(options);

    // Record the initiated transaction in MongoDB as Pending
    const nowIST = getNowIST();
    const paymentRecord = await Payment.create({
      userId,
      referenceId: userId,
      referenceType: "Subscription",
      c_by: userId,
      amount: finalAmount,
      currency: "INR",
      paymentStatus: "Pending",
      paymentGateway: "Razorpay",
      orderId: rzpOrder.id,
      remarks: `Subscription Initiated: ${planKey}`,
      paymentDate: nowIST,
      createdAt: nowIST,
      updatedAt: nowIST,
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentRecordId: paymentRecord._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Instant Client-Side Verification Callback
 * Called by frontend when the Razorpay modal completes payment.
 * Employs cryptographic signature verification and idempotent fulfillment.
 */
export const verifySubscriptionPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
      transactionId,
      orderId,
      signature,
      planKey = "pro_quarterly",
      amount,
    } = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    const actualOrderId = razorpay_order_id || orderId;
    const actualPaymentId = razorpay_payment_id || paymentId || transactionId;
    const actualSignature = razorpay_signature || signature;

    if (!actualOrderId) {
      return res.status(400).json({ success: false, message: "Missing order identifier." });
    }

    // Cryptographic validation of the payment signature when provided
    if (actualSignature && process.env.RAZORPAY_KEY_SECRET) {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${actualOrderId}|${actualPaymentId}`)
        .digest("hex");

      if (generatedSignature !== actualSignature) {
        return res.status(400).json({
          success: false,
          message: "Payment signature validation failed. Potential tampering detected.",
        });
      }
    }

    // Delegate to shared idempotent fulfillment service
    const result = await fulfillSubscriptionPayment({
      orderId: actualOrderId,
      paymentId: actualPaymentId,
      signature: actualSignature,
      planKey,
      amount,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "Subscription is already active."
        : "Subscription activated successfully!",
      data: {
        paymentId: result.payment._id,
        subscription: result.subscription,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 3: Smart Check-Status API
 * Allows the frontend to verify an order's status on demand.
 * If the database record is still Pending, queries Razorpay API directly
 * to self-heal and fulfill the order on the spot.
 */
export const checkSubscriptionPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?._id;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    // 1. Check local database record first
    await expireStalePendingPayments(userId);
    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Order record not found." });
    }

    // Fast-path: Webhook or verify-payment already completed fulfillment
    if (payment.paymentStatus === "Success") {
      const userDoc = await User.findById(payment.userId).select("subscription").lean();
      return res.status(200).json({
        success: true,
        status: "Success",
        subscription: userDoc?.subscription,
      });
    }

    // 2. On-demand self-healing: Query Razorpay API directly
    const razorpay = getRazorpayInstance();
    if (razorpay) {
      const rzpOrder = await razorpay.orders.fetch(orderId);

      if (rzpOrder && rzpOrder.status === "paid") {
        // Query payments linked to this order to retrieve the captured paymentId
        const paymentsList = await razorpay.orders.fetchPayments(orderId);
        const capturedPayment = paymentsList.items?.find((p) => p.status === "captured");

        const planKey = rzpOrder.notes?.planKey || "pro_quarterly";
        const fulfilled = await fulfillSubscriptionPayment({
          orderId,
          paymentId: capturedPayment?.id || null,
          planKey,
          amount: payment.amount,
          userId: userId || payment.userId,
        });

        return res.status(200).json({
          success: true,
          status: "Success",
          subscription: fulfilled.subscription,
        });
      }
    }

    // Order is still pending or was not successfully paid
    return res.status(200).json({
      success: true,
      status: payment.paymentStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Fetch all users with active subscriptions (isPlanActive = true)
 */
export const getActiveSubscribedUsers = async (req, res, next) => {
  try {
    const search = req.query.search || "";

    const query = {
      "subscription.isPlanActive": true,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("name email phone subscription createdAt")
      .lean();

    // In-memory sort by subscription start date descending for Cosmos DB compatibility
    users.sort((a, b) => {
      const dateA = new Date(a.subscription?.startDate || a.createdAt || 0);
      const dateB = new Date(b.subscription?.startDate || b.createdAt || 0);
      return dateB - dateA;
    });

    const userIds = users.map((u) => u._id);

    // Fetch latest payment records for exact transaction amounts
    const payments = await Payment.find({
      userId: { $in: userIds },
      referenceType: "Subscription",
      paymentStatus: "Success",
    }).sort({ createdAt: -1 });

    const paymentMap = {};
    payments.forEach((p) => {
      const uIdStr = p.userId?.toString();
      if (uIdStr && !paymentMap[uIdStr]) {
        paymentMap[uIdStr] = p.amount;
      }
    });

    // Fallback plan prices map
    const plans = await SubscriptionPlan.find({});
    const planPriceMap = {};
    plans.forEach((p) => {
      planPriceMap[p.name] = p.price;
      planPriceMap[p.planKey] = p.price;
    });

    // Calculate plan duration, remaining days, and amount for each user
    const formattedUsers = users.map((user) => {
      const sub = user?.subscription || {};

      let durationDays = 0;
      let remainingDays = 0;

      if (sub.startDate && sub.expiryDate) {
        const start = new Date(sub.startDate);
        const expiry = new Date(sub.expiryDate);
        expiry.setHours(23, 59, 59, 999);
        const now = getNowIST();

        durationDays = Math.max(0, Math.round((expiry - start) / (1000 * 60 * 60 * 24)));
        remainingDays = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
      }

      const amount =
        paymentMap[user._id.toString()] ??
        planPriceMap[sub.planName] ??
        299;

      return {
        ...user,
        subscription: {
          ...sub,
          amount,
          durationDays,
          remainingDays,
        },
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetches user subscription plan tenure and complete transaction history.
 * Decouples active plan validity (computed strictly from verified 'Success' payments)
 * from transaction audit records so that newly initiated orders ('Pending' order IDs)
 * are immediately visible in transaction history without corrupting active plan state.
 */
export const getUserPlanHistory = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const userDoc = await User.findById(userId).select("subscription");

    // Automatically transition any pending payments older than 5 minutes to Failed
    await expireStalePendingPayments(userId);

    // Fetch all subscription payment attempts (Pending, Success, Failed) sorted newest first
    const allPayments = await Payment.find({
      userId,
      referenceType: "Subscription",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Isolate verified payments for determining active plan start dates & payment details
    const successfulPayments = allPayments.filter(
      (p) => p.paymentStatus === "Success"
    );

    const rawExpiry = userDoc?.subscription?.expiryDate;
    const expiryDate = rawExpiry ? new Date(rawExpiry) : null;
    const endOfDayExpiry = expiryDate ? new Date(expiryDate) : null;
    if (endOfDayExpiry) {
      endOfDayExpiry.setHours(23, 59, 59, 999);
    }

    const nowIST = getNowIST();
    const isExpired = endOfDayExpiry ? (nowIST > endOfDayExpiry && new Date() > endOfDayExpiry) : false;

    const isCurrentlyActive = Boolean(
      userDoc?.subscription?.isPlanActive && !isExpired
    );

    let currentPlan = [];
    let previousPlans = [];

    // Helper to format date only (YYYY-MM-DD)
    const formatDateOnly = (d) => {
      if (!d) return null;
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return null;
      return `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
    };

    const extractPlanName = (payment, defaultName = "Pro Quarterly") => {
      if (payment?.remarks) {
        if (payment.remarks.startsWith("Subscription activated: ")) {
          return payment.remarks.replace("Subscription activated: ", "").trim();
        }
        if (payment.remarks.startsWith("Subscription extended: ")) {
          return payment.remarks.replace("Subscription extended: ", "").trim();
        }
        if (payment.remarks.startsWith("Subscription Initiated: ")) {
          return payment.remarks.replace("Subscription Initiated: ", "").trim();
        }
      }
      if (payment?.metadata?.planName) {
        return payment.metadata.planName;
      }
      return defaultName;
    };

    let planDetails = null;

    if (isCurrentlyActive && userDoc?.subscription) {
      planDetails = {
        planName: userDoc.subscription.planName || "Pro Quarterly",
        startDate: formatDateOnly(userDoc.subscription.startDate) || formatDateOnly(successfulPayments[0]?.createdAt),
        expiryDate: formatDateOnly(endOfDayExpiry),
        isPlanActive: true,
        isExpired: false,
      };

      // Set current plan
      currentPlan = [
        {
          planName: userDoc.subscription.planName || "Pro",
          startDate: userDoc.subscription.startDate,
          expiryDate: userDoc.subscription.expiryDate,
          isPlanActive: true,
          paymentDetails: successfulPayments[0] || null,
        },
      ];

      // Exclude only the currently active successful payment from previous plans
      const activePaymentId = successfulPayments[0]?._id?.toString();
      previousPlans = allPayments.filter(
        (p) => p._id?.toString() !== activePaymentId
      );
    } else if (isExpired && (rawExpiry || successfulPayments.length > 0)) {
      planDetails = {
        planName: userDoc?.subscription?.planName || (successfulPayments[0] ? extractPlanName(successfulPayments[0]) : "Pro Quarterly"),
        startDate: formatDateOnly(userDoc?.subscription?.startDate) || formatDateOnly(successfulPayments[0]?.createdAt),
        expiryDate: formatDateOnly(endOfDayExpiry),
        isPlanActive: false,
        isExpired: true,
      };
      currentPlan = [];
      previousPlans = allPayments;
    } else {
      planDetails = {
        planName: "Free",
        startDate: null,
        expiryDate: null,
        isPlanActive: false,
        isExpired: false,
      };
      currentPlan = [];
      previousPlans = allPayments;
    }

    return res.status(200).json({
      success: true,
      data: {
        planDetails,
        currentPlan,
        previousPlans,
        transactions: allPayments,
      },
    });
  } catch (error) {
    next(error);
  }
};

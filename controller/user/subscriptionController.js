import crypto from "crypto";
import Razorpay from "razorpay";
import User from "../../models/userModel.js";
import Payment from "../../models/paymentModel.js";
import SubscriptionPlan from "../../models/subscriptionPlanModel.js";
import { awardXP } from "../../services/xpService.js";

/**
 * Initializes and returns a Razorpay client instance.
 * Returns null if API credentials are not set in environment variables.
 */
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

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
        // {
        //   planKey: "pro_yearly",
        //   name: "Pro Annual",
        //   tier: "pro",
        //   billingCycle: "yearly",
        //   durationDays: 365,
        //   price: 2999,
        //   currency: "INR",
        //   features: ["All Monthly features", "Save 16%", "Exclusive webinars"],
        //   isActive: true,
        // },
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
 * Store payment details sent from the client and activate the user subscription.
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
      paymentGateway = "Razorpay",
      planKey = "pro_quarterly",
      planName,
      durationDays,
      amount,
    } = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    const actualPaymentId = razorpay_payment_id || paymentId || transactionId || `PAY_${Date.now()}`;
    const actualOrderId = razorpay_order_id || orderId || null;
    const actualSignature = razorpay_signature || signature || null;

    // Calculate duration, amount, and plan name from client request with fallbacks
    const activeDays =
      Number(durationDays) ||
      (planKey === "pro_yearly" ? 365 : planKey === "pro_monthly" ? 30 : 90);
    const finalAmount = Number(amount) || (planKey === "pro_yearly" ? 2999 : 499);
    const finalPlanName =
      planName ||
      (planKey === "pro_yearly"
        ? "Pro Annual"
        : planKey === "pro_monthly"
          ? "Pro Monthly"
          : "Pro Quarterly");

    // ── Plan Extension / Stacking Logic ──────────────────────────────
    // Check if the user currently possesses an active, unexpired subscription.
    // If active days remain, stack the new duration directly onto the existing expiry date.
    // Otherwise, start fresh from the current moment.
    const existingUser = await User.findById(userId).select("subscription").lean();
    const currentSub = existingUser?.subscription;

    const now = new Date();
    const isCurrentlyActive = Boolean(
      currentSub?.isPlanActive &&
      currentSub?.expiryDate &&
      new Date(currentSub.expiryDate) > now
    );

    // If active, anchor on existing expiryDate; otherwise anchor on now
    const baseDate = isCurrentlyActive ? new Date(currentSub.expiryDate) : now;
    const expiryDate = new Date(baseDate.getTime() + activeDays * 24 * 60 * 60 * 1000);
    expiryDate.setHours(23, 59, 59, 999);

    // Preserve initial startDate if extending active membership; else start now
    const startDate = isCurrentlyActive && currentSub?.startDate
      ? new Date(currentSub.startDate)
      : now;

    const actionText = isCurrentlyActive ? "extended" : "activated";

    // 1. Save Payment record directly to DB
    const paymentRecord = await Payment.create({
      userId,
      referenceId: userId,
      referenceType: "Subscription",
      c_by: userId,
      amount: finalAmount,
      currency: "INR",
      paymentStatus: "Success",
      paymentGateway,
      orderId: actualOrderId,
      paymentId: actualPaymentId,
      signature: actualSignature,
      transactionId: actualPaymentId,
      remarks: `Subscription ${actionText}: ${finalPlanName}`,
    });

    // 2. Update User's active subscription status in DB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          subscription: {
            planName: finalPlanName,
            isPlanActive: true,
            startDate,
            expiryDate,
          },
        },
      },
      { new: true }
    ).select("name email subscription");

    return res.status(200).json({
      success: true,
      message: `Subscription ${actionText} successfully!`,
      data: {
        paymentId: paymentRecord._id,
        subscription: updatedUser?.subscription,
      },
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
        const now = new Date();

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
 * User: Fetch plan history with currentPlan and previousPlans (current plan excluded from previousPlans)
 */
export const getUserPlanHistory = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const userDoc = await User.findById(userId).select("subscription");

    // Fetch all successful subscription payments sorted by newest first
    const paymentHistory = await Payment.find({
      userId,
      referenceType: "Subscription",
      paymentStatus: "Success",
    }).sort({ createdAt: -1 });

    const rawExpiry = userDoc?.subscription?.expiryDate;
    const expiryDate = rawExpiry ? new Date(rawExpiry) : null;
    const endOfDayExpiry = expiryDate ? new Date(expiryDate) : null;
    if (endOfDayExpiry) {
      endOfDayExpiry.setHours(23, 59, 59, 999);
    }

    const isExpired = endOfDayExpiry ? new Date() > endOfDayExpiry : false;

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
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
    };

    const extractPlanName = (payment, defaultName = "Pro Quarterly") => {
      if (payment?.remarks) {
        if (payment.remarks.startsWith("Subscription activated: ")) {
          return payment.remarks.replace("Subscription activated: ", "").trim();
        }
        if (payment.remarks.startsWith("Subscription extended: ")) {
          return payment.remarks.replace("Subscription extended: ", "").trim();
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
        startDate: formatDateOnly(userDoc.subscription.startDate) || formatDateOnly(paymentHistory[0]?.createdAt),
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
          paymentDetails: paymentHistory[0] || null,
        },
      ];

      // Exclude current plan's payment from previous plans
      previousPlans = paymentHistory.slice(1);
    } else if (isExpired && (rawExpiry || paymentHistory.length > 0)) {
      planDetails = {
        planName: userDoc?.subscription?.planName || (paymentHistory[0] ? extractPlanName(paymentHistory[0]) : "Pro Quarterly"),
        startDate: formatDateOnly(userDoc?.subscription?.startDate) || formatDateOnly(paymentHistory[0]?.createdAt),
        expiryDate: formatDateOnly(endOfDayExpiry),
        isPlanActive: false,
        isExpired: true,
      };
      currentPlan = [];
      previousPlans = paymentHistory;
    } else {
      planDetails = {
        planName: "Free",
        startDate: null,
        expiryDate: null,
        isPlanActive: false,
        isExpired: false,
      };
      currentPlan = [];
      previousPlans = paymentHistory;
    }

    return res.status(200).json({
      success: true,
      data: {
        planDetails,
        currentPlan,
        previousPlans,
      },
    });
  } catch (error) {
    next(error);
  }
};

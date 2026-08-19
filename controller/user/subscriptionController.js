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
          planKey: "pro_monthly",
          name: "Pro Monthly",
          tier: "pro",
          billingCycle: "monthly",
          durationDays: 30,
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
 * Saves whatever is passed from the client directly into MongoDB without backend validation.
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
      planKey = "pro_monthly",
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
    const activeDays = Number(durationDays) || (planKey === "pro_yearly" ? 365 : 30);
    const finalAmount = Number(amount) || (planKey === "pro_yearly" ? 2999 : 499);
    const finalPlanName =
      planName ||
      (planKey === "pro_yearly" ? "Pro Annual" : "Pro Monthly");

    const startDate = new Date();
    const expiryDate = new Date(Date.now() + activeDays * 24 * 60 * 60 * 1000);

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
      remarks: `Subscription activated: ${finalPlanName}`,
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
      message: "Subscription activated successfully!",
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
      .sort({ "subscription.startDate": -1 });

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
    const formattedUsers = users.map((userDoc) => {
      const user = userDoc.toObject();
      const sub = user.subscription || {};

      let durationDays = 0;
      let remainingDays = 0;

      if (sub.startDate && sub.expiryDate) {
        const start = new Date(sub.startDate);
        const expiry = new Date(sub.expiryDate);
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

    const isExpired = userDoc?.subscription?.expiryDate
      ? new Date() > new Date(userDoc.subscription.expiryDate)
      : false;

    const isCurrentlyActive = Boolean(
      userDoc?.subscription?.isPlanActive && !isExpired
    );

    let currentPlan = [];
    let previousPlans = [];

    if (isCurrentlyActive && userDoc?.subscription) {
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
    } else {
      currentPlan = [];
      previousPlans = paymentHistory;
    }

    return res.status(200).json({
      success: true,
      data: {
        currentPlan,
        previousPlans,
      },
    });
  } catch (error) {
    next(error);
  }
};

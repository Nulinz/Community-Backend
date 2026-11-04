import crypto from "crypto";
import Razorpay from "razorpay";
import User from "../../models/userModel.js";
import Payment from "../../models/paymentModel.js";
import SubscriptionPlan from "../../models/subscriptionPlanModel.js";
import {
  fulfillSubscriptionPayment,
  expireStalePendingPayments,
} from "../../services/paymentFulfillmentService.js";
import {
  decodeAppleJWS,
  parseStoreKitTransaction,
} from "../../services/appleSubscriptionService.js";

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
 * Handles order pre-registration for both iOS (Apple StoreKit) and Android/Web (Razorpay).
 * Registers a pending transaction in MongoDB prior to opening the client checkout sheet.
 */
export const createSubscriptionOrder = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    const { planKey = "pro_quarterly", amount, platform, productId } = req.body;
    const finalAmount = Number(amount) || (planKey === "pro_yearly" ? 2999 : 499);
    const nowIST = getNowIST();

    // ==========================================
    // 1. FOR IOS (StoreKit 2)
    // ==========================================
    if (platform === "ios") {
      const iosOrderId = `ios_ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const planName = planKey === "pro_yearly" ? "Pro Annual" : "Pro Quarterly";

      const paymentRecord = await Payment.create({
        userId,
        referenceId: userId,
        referenceType: "Subscription",
        c_by: userId,
        amount: finalAmount,
        currency: "INR",
        paymentGateway: "Apple StoreKit",
        paymentStatus: "pending",
        orderId: iosOrderId,
        productId: productId || "gradenvy_pro_quarterly",
        remarks: `Subscription Initiated (iOS): ${planName}`,
        paymentDate: nowIST,
        createdAt: nowIST,
        updatedAt: nowIST,
      });

      return res.status(200).json({
        success: true,
        data: {
          orderId: iosOrderId,
          amount: finalAmount,
          currency: "INR",
          platform: "ios",
          paymentRecordId: paymentRecord._id,
        },
      });
    }

    // ==========================================
    // 2. FOR ANDROID / WEB (Razorpay)
    // ==========================================
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
 * Step 2: Instant Client-Side Verification Callback (Pure Webhook-Only Mode)
 * Records transaction identifiers, JWS receipt, or cryptographic signatures into the database,
 * but DOES NOT activate the subscription or mark the status as Success/captured.
 * Status remains "pending" / "Pending" until the authoritative Server-to-Server Webhook arrives.
 */
export const verifySubscriptionPayment = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    const {
      platform,
      orderId,
      transactionId,
      planKey = "pro_quarterly",
      receipt,
      productId,
      amount,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
      signature,
    } = req.body;

    const nowIST = getNowIST();

    // ==========================================
    // 1. APPLE IN-APP PURCHASE (iOS) - PURE WEBHOOK MODE
    // ==========================================
    if (platform === "ios" || receipt || productId === "gradenvy_pro_quarterly") {
      const txData = parseStoreKitTransaction(receipt, req.body);
      const activeOrderId = orderId || txData.transactionId || txData.originalTransactionId;

      if (!activeOrderId) {
        return res.status(400).json({
          success: false,
          message: "Missing order identifier for iOS transaction.",
        });
      }

      // Check if the Apple Webhook already arrived and completed fulfillment in background
      const existingPayment = await Payment.findOne({
        $or: [
          { orderId: activeOrderId },
          { originalTransactionId: txData.originalTransactionId },
          { transactionId: txData.transactionId },
        ],
      });

      if (
        existingPayment &&
        (existingPayment.paymentStatus === "captured" ||
          existingPayment.paymentStatus === "Success" ||
          existingPayment.paymentStatus === "paid")
      ) {
        const userDoc = await User.findById(existingPayment.userId).select("subscription isPlanActive planName").lean();
        return res.status(200).json({
          success: true,
          message: "Subscription is verified and active via server webhook confirmation.",
          data: {
            orderId: activeOrderId,
            status: existingPayment.paymentStatus,
            isPlanActive: true,
            planName: userDoc?.subscription?.planName || "Pro Quarterly",
            startDate: userDoc?.subscription?.startDate,
            expiryDate: userDoc?.subscription?.expiryDate,
          },
        });
      }

      // Pure Webhook Mode: Record the transaction receipt and identifiers, but leave status as 'pending'
      const updatedPayment = await Payment.findOneAndUpdate(
        { orderId: activeOrderId },
        {
          $set: {
            userId,
            referenceId: userId,
            referenceType: "Subscription",
            c_by: userId,
            amount: Number(amount) || 499,
            currency: "INR",
            paymentGateway: "Apple StoreKit",
            paymentStatus: "pending", // Remains pending until Apple Server-to-Server Webhook confirms
            transactionId: txData.transactionId || activeOrderId,
            originalTransactionId: txData.originalTransactionId || activeOrderId,
            receipt: receipt || null,
            productId: txData.productId || productId || "gradenvy_pro_quarterly",
            remarks: "Receipt received on client; awaiting Apple V2 Server Webhook fulfillment",
            updatedAt: nowIST,
          },
        },
        { new: true, upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: "Receipt received successfully. Membership will activate upon server webhook confirmation.",
        data: {
          orderId: activeOrderId,
          status: "pending",
          isPlanActive: false,
          paymentRecordId: updatedPayment._id,
        },
      });
    }

    // ==========================================
    // 2. RAZORPAY (Android / Web) - PURE WEBHOOK MODE
    // ==========================================
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

    // Check if the Razorpay Webhook already arrived and completed fulfillment
    const existingPayment = await Payment.findOne({ orderId: actualOrderId });
    if (
      existingPayment &&
      (existingPayment.paymentStatus === "Success" ||
        existingPayment.paymentStatus === "captured" ||
        existingPayment.paymentStatus === "paid")
    ) {
      const userDoc = await User.findById(existingPayment.userId).select("subscription isPlanActive planName").lean();
      return res.status(200).json({
        success: true,
        message: "Subscription is verified and active via server webhook confirmation.",
        data: {
          orderId: actualOrderId,
          status: existingPayment.paymentStatus,
          isPlanActive: true,
          planName: userDoc?.subscription?.planName || "Pro Quarterly",
          startDate: userDoc?.subscription?.startDate,
          expiryDate: userDoc?.subscription?.expiryDate,
        },
      });
    }

    // Pure Webhook Mode: Record verified payment identifiers, but leave status as 'Pending'
    const updatedPayment = await Payment.findOneAndUpdate(
      { orderId: actualOrderId },
      {
        $set: {
          paymentId: actualPaymentId || null,
          transactionId: actualPaymentId || null,
          signature: actualSignature || null,
          paymentStatus: "Pending", // Remains Pending until Razorpay Webhook (order.paid/payment.captured) confirms
          remarks: "Signature verified on client; awaiting Razorpay webhook fulfillment",
          updatedAt: nowIST,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Signature verified successfully. Membership will activate upon server webhook confirmation.",
      data: {
        orderId: actualOrderId,
        status: "Pending",
        isPlanActive: false,
        paymentRecordId: updatedPayment?._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 3: Order Status Update (Client cancellation or failure hook)
 * Updates transaction status to "failed" or "Cancelled" when checkout sheet is dismissed.
 * Ensures cancelled and failed attempts are recorded and rendered in Subscription History.
 */
export const updateSubscriptionOrderStatus = async (req, res, next) => {
  try {
    const { orderId, status = "failed", reason = "Transaction cancelled or failed." } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing orderId identifier." });
    }

    const updated = await Payment.findOneAndUpdate(
      { orderId },
      {
        $set: {
          paymentStatus: status || "failed",
          failureReason: reason || "Transaction cancelled or failed.",
          remarks: reason || "Transaction cancelled or failed.",
          updatedAt: getNowIST(),
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Status updated successfully.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 4: Apple Server-to-Server V2 Webhook Notification Handler (Authoritative Fulfillment Engine)
 * Exclusively responsible for activating subscriptions, auto-renewals, expirations, and refunds in Pure Webhook Mode.
 */
export const appleSubscriptionWebhookHandler = async (req, res, next) => {
  try {
    const { signedPayload } = req.body;

    if (!signedPayload) {
      return res.status(400).send("signedPayload is required");
    }

    // Decode outer JWS notification payload
    const decodedPayload = decodeAppleJWS(signedPayload);
    if (!decodedPayload) {
      return res.status(400).send("Unable to decode signedPayload");
    }

    const notificationType = decodedPayload.notificationType; // e.g. SUBSCRIBED, DID_RENEW, EXPIRED, REFUND, REVOKE, TEST
    const signedTxInfo = decodedPayload.data?.signedTransactionInfo;

    // Handle Apple App Store Connect "Test Notification" ping
    if (notificationType === "TEST") {
      console.log("[AppleWebhook] Test notification received from App Store Connect successfully.");
      return res.status(200).send("OK");
    }

    let transactionInfo = {};
    if (signedTxInfo) {
      transactionInfo = decodeAppleJWS(signedTxInfo) || {};
    }

    const originalTransactionId =
      transactionInfo.originalTransactionId || transactionInfo.transactionId;

    if (originalTransactionId) {
      // ── 1. INITIAL SUBSCRIPTION PURCHASE & AUTO-RENEWAL EVENTS ─────────────────
      if (
        notificationType === "SUBSCRIBED" ||
        notificationType === "DID_RENEW" ||
        notificationType === "OFFER_REDEEMED"
      ) {
        // Find existing initiated or pending payment document
        let prevPayment = await Payment.findOne({
          $or: [
            { originalTransactionId },
            { orderId: originalTransactionId },
            { transactionId: originalTransactionId },
            { transactionId: transactionInfo.transactionId },
          ],
        }).sort({ createdAt: -1 });

        // Fallback: If originalTransactionId was not yet linked, match the most recent pending iOS payment
        if (!prevPayment) {
          prevPayment = await Payment.findOne({
            paymentGateway: "Apple StoreKit",
            paymentStatus: "pending",
          }).sort({ createdAt: -1 });
        }

        if (prevPayment && prevPayment.userId) {
          const effectiveOrderId = prevPayment.orderId || `ios_webhook_${originalTransactionId}`;
          await fulfillSubscriptionPayment({
            orderId: effectiveOrderId,
            paymentId: transactionInfo.transactionId || originalTransactionId,
            planKey: prevPayment.remarks?.includes("Annual") ? "pro_yearly" : "pro_quarterly",
            amount: prevPayment.amount || 499,
            userId: prevPayment.userId,
            paymentGateway: "Apple StoreKit",
            productId: transactionInfo.productId || prevPayment.productId || "gradenvy_pro_quarterly",
            originalTransactionId,
            status: "captured", // Authoritatively marks payment captured in DB
          });

          console.log(`[AppleWebhook] Successfully fulfilled subscription for user ${prevPayment.userId} (Event: ${notificationType})`);
        } else {
          console.warn(`[AppleWebhook] Notification received (${notificationType}) but no matching pending payment record found for tx: ${originalTransactionId}`);
        }
      }
      // ── 2. SUBSCRIPTION EXPIRY, REFUND & REVOCATION EVENTS ──────────────────────
      else if (
        notificationType === "EXPIRED" ||
        notificationType === "REFUND" ||
        notificationType === "REVOKE"
      ) {
        const prevPayment = await Payment.findOne({
          $or: [
            { originalTransactionId },
            { orderId: originalTransactionId },
            { transactionId: originalTransactionId },
          ],
        });

        if (prevPayment && prevPayment.userId) {
          await User.findByIdAndUpdate(prevPayment.userId, {
            $set: {
              isPlanActive: false,
              isSubscribed: false,
              "subscription.isPlanActive": false,
            },
          });

          await Payment.updateMany(
            {
              $or: [
                { originalTransactionId },
                { orderId: originalTransactionId },
              ],
            },
            {
              $set: {
                paymentStatus: notificationType === "REFUND" ? "Refunded" : "Failed",
                remarks: `Apple App Store Notification: ${notificationType}`,
                updatedAt: getNowIST(),
              },
            }
          );

          console.log(`[AppleWebhook] Deactivated subscription for user ${prevPayment.userId} (Event: ${notificationType})`);
        }
      }
    }

    // Always return HTTP 200 OK to acknowledge Apple delivery
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Apple webhook processing error:", err);
    return res.status(500).send("ERROR");
  }
};

/**
 * Smart Check-Status API
 * Allows the frontend to poll and verify whether the background Webhook has settled the order.
 * If settled, returns status: "captured" / "Success" and isPlanActive: true.
 * If still pending, returns status: "pending" / "Pending" and isPlanActive: false.
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

    // Webhook already completed fulfillment
    if (
      payment.paymentStatus === "Success" ||
      payment.paymentStatus === "captured" ||
      payment.paymentStatus === "paid"
    ) {
      const userDoc = await User.findById(payment.userId).select("subscription isPlanActive planName").lean();
      return res.status(200).json({
        success: true,
        status: payment.paymentStatus,
        isPlanActive: true,
        subscription: userDoc?.subscription,
      });
    }

    // 2. On-demand self-healing for Razorpay if webhook experienced unexpected delay
    if (payment.paymentGateway === "Razorpay") {
      const razorpay = getRazorpayInstance();
      if (razorpay) {
        const rzpOrder = await razorpay.orders.fetch(orderId);

        if (rzpOrder && rzpOrder.status === "paid") {
          const paymentsList = await razorpay.orders.fetchPayments(orderId);
          const capturedPayment = paymentsList.items?.find((p) => p.status === "captured");

          const planKey = rzpOrder.notes?.planKey || "pro_quarterly";
          const fulfilled = await fulfillSubscriptionPayment({
            orderId,
            paymentId: capturedPayment?.id || null,
            planKey,
            amount: payment.amount,
            userId: userId || payment.userId,
            paymentGateway: "Razorpay",
          });

          return res.status(200).json({
            success: true,
            status: "Success",
            isPlanActive: true,
            subscription: fulfilled.subscription,
          });
        }
      }
    }

    // Order is still pending webhook delivery
    return res.status(200).json({
      success: true,
      status: payment.paymentStatus,
      isPlanActive: false,
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
      paymentStatus: { $in: ["Success", "captured", "paid"] },
    }).sort({ createdAt: -1 });

    const paymentMap = {};
    payments.forEach((p) => {
      const uIdStr = p.userId?.toString();
      if (uIdStr && !paymentMap[uIdStr]) {
        paymentMap[uIdStr] = p.amount;
      }
    });

    const plans = await SubscriptionPlan.find({});
    const planPriceMap = {};
    plans.forEach((p) => {
      planPriceMap[p.name] = p.price;
      planPriceMap[p.planKey] = p.price;
    });

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
 * Unifies Apple StoreKit (captured/failed/pending) and Razorpay (Success/Failed/Pending)
 * for the mobile app's SubscriptionHistoryController.
 */
export const getUserPlanHistory = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const userDoc = await User.findById(userId).select("subscription");

    // Automatically transition any pending payments older than 15 minutes to Failed
    await expireStalePendingPayments(userId);

    // Fetch all subscription payment attempts sorted newest first
    const allPayments = await Payment.find({
      userId,
      referenceType: "Subscription",
    })
      .sort({ createdAt: -1 })
      .lean();

    // Isolate verified payments for determining active plan start dates & payment details
    const successfulPayments = allPayments.filter(
      (p) =>
        p.paymentStatus === "Success" ||
        p.paymentStatus === "captured" ||
        p.paymentStatus === "paid"
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

      currentPlan = [
        {
          planName: userDoc.subscription.planName || "Pro",
          startDate: userDoc.subscription.startDate,
          expiryDate: userDoc.subscription.expiryDate,
          isPlanActive: true,
          paymentDetails: successfulPayments[0] || null,
        },
      ];

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

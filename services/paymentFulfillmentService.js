import User from "../models/userModel.js";
import Payment from "../models/paymentModel.js";
import { triggerMissionNotification } from "./xpService.js";

// Indian Standard Time (IST, UTC+05:30) offset in milliseconds (5.5 hours)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getNowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Core Payment Fulfillment Service:
 * Centralizes payment settlement and subscription activation logic.
 * Ensures strict idempotency across multiple channels (Webhooks, Client Verify,
 * and On-Demand Status Checks) so a user is never double-billed, double-credited,
 * or granted duplicate mission XP rewards.
 */
export const fulfillSubscriptionPayment = async ({
  orderId,
  paymentId,
  signature = null,
  planKey = "pro_quarterly",
  amount,
  userId,
}) => {
  if (!orderId) {
    throw new Error("Cannot fulfill subscription without an orderId.");
  }

  // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────────
  // Check if an existing payment record for this orderId is already marked "Success".
  // If true, exit immediately to prevent re-stacking days or triggering duplicate rewards.
  const existingPayment = await Payment.findOne({ orderId });
  if (existingPayment && existingPayment.paymentStatus === "Success") {
    const existingUser = await User.findById(existingPayment.userId).select("subscription").lean();
    return {
      alreadyProcessed: true,
      payment: existingPayment,
      subscription: existingUser?.subscription,
    };
  }

  const effectiveUserId = userId || existingPayment?.userId;
  if (!effectiveUserId) {
    throw new Error(`Unable to resolve user identifier for orderId: ${orderId}`);
  }

  const nowIST = getNowIST();

  // Resolve plan duration and human-readable plan name
  const activeDays = planKey === "pro_yearly" ? 365 : planKey === "pro_monthly" ? 30 : 90;
  const planName =
    planKey === "pro_yearly"
      ? "Pro Annual"
      : planKey === "pro_monthly"
        ? "Pro Monthly"
        : "Pro Quarterly";
  const finalAmount = Number(amount) || existingPayment?.amount || (planKey === "pro_yearly" ? 2999 : 499);

  // ── SUBSCRIPTION STACKING LOGIC (IST) ──────────────────────────────────────────
  // If the user currently has an active subscription that hasn't expired, stack the new
  // duration on top of their existing expiry date. Otherwise, start fresh from now in IST.
  const userRecord = await User.findById(effectiveUserId).select("subscription").lean();
  const currentSub = userRecord?.subscription;

  const isCurrentlyActive = Boolean(
    currentSub?.isPlanActive &&
    currentSub?.expiryDate &&
    new Date(currentSub.expiryDate) > nowIST
  );

  const baseDate = isCurrentlyActive ? new Date(currentSub.expiryDate) : nowIST;
  const expiryDate = new Date(baseDate.getTime() + activeDays * 24 * 60 * 60 * 1000);
  expiryDate.setUTCHours(23, 59, 59, 999);

  const startDate = isCurrentlyActive && currentSub?.startDate
    ? new Date(currentSub.startDate)
    : nowIST;

  const actionText = isCurrentlyActive ? "extended" : "activated";

  // ── 1. UPDATE PAYMENT RECORD TO SUCCESS ─────────────────────────────────────────
  const paymentRecord = await Payment.findOneAndUpdate(
    { orderId },
    {
      $set: {
        userId: effectiveUserId,
        referenceId: effectiveUserId,
        referenceType: "Subscription",
        c_by: effectiveUserId,
        amount: finalAmount,
        currency: "INR",
        paymentStatus: "Success",
        paymentGateway: "Razorpay",
        orderId,
        paymentId: paymentId || existingPayment?.paymentId || null,
        transactionId: paymentId || existingPayment?.paymentId || null,
        signature: signature || existingPayment?.signature || null,
        remarks: `Subscription ${actionText}: ${planName}`,
        paymentDate: nowIST,
        updatedAt: nowIST,
      },
    },
    { new: true, upsert: true }
  );

  // ── 2. ACTIVATE USER MEMBERSHIP IN DB ──────────────────────────────────────────
  const updatedUser = await User.findByIdAndUpdate(
    effectiveUserId,
    {
      $set: {
        subscription: {
          planName,
          isPlanActive: true,
          startDate,
          expiryDate,
        },
      },
    },
    { new: true }
  ).select("name email subscription");

  // ── 3. GAMIFICATION MISSION TRIGGER ───────────────────────────────────────────
  // Notify user that their First Subscription milestone is ready to claim XP
  if (!isCurrentlyActive) {
    triggerMissionNotification(effectiveUserId, "FIRST_SUBSCRIPTION").catch((err) => {
      console.error("FIRST_SUBSCRIPTION mission trigger error:", err?.message);
    });
  }

  return {
    alreadyProcessed: false,
    payment: paymentRecord,
    subscription: updatedUser?.subscription,
  };
};

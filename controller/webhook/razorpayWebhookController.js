import crypto from "crypto";
import Payment from "../../models/paymentModel.js";
import { fulfillSubscriptionPayment } from "../../services/paymentFulfillmentService.js";

// Indian Standard Time (IST, UTC+05:30) offset in milliseconds (5.5 hours)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getNowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Controller for receiving and processing asynchronous Razorpay webhook events.
 * Operates completely server-to-server, guaranteeing payment reconciliation and
 * subscription activation even if the user drops off or closes their browser before
 * the client-side callback executes.
 */
export const razorpayWebhookHandler = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    if (!webhookSecret) {
      console.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured.");
      return res.status(500).json({ success: false, message: "Webhook secret not configured on server." });
    }

    if (!receivedSignature) {
      return res.status(400).json({ success: false, message: "Missing x-razorpay-signature header." });
    }

    // ── 1. CRYPTOGRAPHIC SIGNATURE VERIFICATION ─────────────────────────────────
    // Validates that the request genuinely originated from Razorpay's servers.
    // Uses the raw request body buffer preserved by express.json({ verify }).
    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBodyBuffer)
      .digest("hex");

    if (expectedSignature !== receivedSignature) {
      console.error("Razorpay webhook signature verification mismatch. Rejecting payload.");
      return res.status(400).json({ success: false, message: "Invalid webhook signature." });
    }

    const { event, payload } = req.body || {};

    // ── 2. PROCESS SUCCESSFUL PAYMENT EVENTS ─────────────────────────────────────
    if (event === "order.paid" || event === "payment.captured") {
      const orderEntity = payload.order?.entity;
      const paymentEntity = payload.payment?.entity;

      const orderId = orderEntity?.id || paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const rawAmount = paymentEntity?.amount || orderEntity?.amount;
      const amount = rawAmount ? Number(rawAmount) / 100 : undefined;

      // Metadata passed during order creation inside the notes dictionary
      const userId = orderEntity?.notes?.userId || paymentEntity?.notes?.userId;
      const planKey = orderEntity?.notes?.planKey || paymentEntity?.notes?.planKey || "pro_quarterly";

      if (!orderId) {
        console.warn("Razorpay success webhook skipped: orderId missing in payload.");
        return res.status(200).json({ status: "skipped_no_order_id" });
      }

      await fulfillSubscriptionPayment({
        orderId,
        paymentId,
        userId,
        planKey,
        amount,
      });

      console.log(`Razorpay webhook fulfilled order successfully: ${orderId}`);
    }

    // ── 3. PROCESS FAILED PAYMENT EVENTS ────────────────────────────────────────
    if (event === "payment.failed") {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;

      if (orderId) {
        const failureReason =
          paymentEntity.error_description ||
          paymentEntity.error_reason ||
          "Payment was declined by issuing bank.";

        await Payment.findOneAndUpdate(
          { orderId },
          {
            $set: {
              paymentStatus: "Failed",
              paymentId: paymentEntity.id,
              remarks: `Payment Failed: ${failureReason}`,
              updatedAt: getNowIST(),
            },
          }
        );
        console.warn(`Payment failed recorded for order: ${orderId} - ${failureReason}`);
      }
    }

    // ── 4. ACKNOWLEDGE DELIVERY ─────────────────────────────────────────────────
    // Always return HTTP 200 promptly so Razorpay marks delivery as completed
    // and terminates the automated retry schedule.
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Error encountered while processing Razorpay webhook:", error);
    // Return 500 on unexpected errors so Razorpay retries delivery later
    return res.status(500).json({ success: false, message: "Webhook handler internal failure." });
  }
};

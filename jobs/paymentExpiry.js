import cron from "node-cron";
import { expireStalePendingPayments } from "../services/paymentFulfillmentService.js";

/**
 * Scheduled Payment Expiry Daemon:
 * Runs once every minute to sweep and transition any 'Pending' payment records
 * (for both Subscriptions and EventRegistrations) that have been pending for > 5 minutes
 * into a definitive 'Failed' status.
 */
export const startPaymentExpiryCron = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const result = await expireStalePendingPayments();
      if (result && result.modifiedCount > 0) {
        console.log(`[PaymentExpiry] Successfully expired ${result.modifiedCount} stale pending payment(s) to Failed.`);
      }
    } catch (err) {
      console.error("[PaymentExpiry] Cron execution encountered an error:", err?.message);
    }
  });

  console.log("[PaymentExpiry] Cron job scheduled — sweeps pending payments every minute (5-minute timeout)");
};

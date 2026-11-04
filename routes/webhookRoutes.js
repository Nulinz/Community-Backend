import express from "express";
import { razorpayWebhookHandler } from "../controller/webhook/razorpayWebhookController.js";
import { appleSubscriptionWebhookHandler } from "../controller/user/subscriptionController.js";

const router = express.Router();

/**
 * Public Webhook Router:
 * Server-to-server callbacks are received here.
 * Must NOT be protected with user JWT or session auth middleware.
 */

// Razorpay server notifications
router.post("/razorpay", razorpayWebhookHandler);

// Apple App Store Server Notifications V2 alias
router.post("/apple", appleSubscriptionWebhookHandler);

export default router;

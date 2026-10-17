import express from "express";
import { razorpayWebhookHandler } from "../controller/webhook/razorpayWebhookController.js";

const router = express.Router();

/**
 * Public Webhook Router:
 * Razorpay server-to-server callbacks are received here.
 * Must NOT be protected with user JWT or session auth middleware.
 * Authenticity is instead guaranteed via the x-razorpay-signature header.
 */
router.post("/razorpay", razorpayWebhookHandler);

export default router;

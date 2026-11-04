import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getSubscriptionPlans,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  checkSubscriptionPaymentStatus,
  updateSubscriptionOrderStatus,
  appleSubscriptionWebhookHandler,
  getActiveSubscribedUsers,
  getUserPlanHistory,
} from "../controller/user/subscriptionController.js";

const router = express.Router();

/**
 * Public & Authenticated Plan Information
 * GET /api/subscriptions/plans
 */
router.get("/plans", getSubscriptionPlans);

/**
 * Pre-Payment Order Creation (iOS StoreKit 2 & Android Razorpay)
 * POST /api/subscriptions/create-order
 */
router.post("/create-order", isAuthenticated, createSubscriptionOrder);

/**
 * Instant Client-Side Verification Callback (iOS JWS Token & Android Razorpay Signature)
 * POST /api/subscriptions/verify-payment
 */
router.post("/verify-payment", isAuthenticated, verifySubscriptionPayment);

/**
 * On-demand order status verification and self-healing
 * POST /api/subscriptions/check-status
 */
router.post("/check-status", isAuthenticated, checkSubscriptionPaymentStatus);

/**
 * Order Status Cancellation / Failure Update
 * POST /api/subscriptions/update-order-status
 */
router.post("/update-order-status", isAuthenticated, updateSubscriptionOrderStatus);

/**
 * Apple StoreKit 2 Server-to-Server V2 Webhook
 * POST /api/subscriptions/apple-webhook
 * Note: Must remain unauthenticated so Apple servers can deliver notifications.
 */
router.post("/apple-webhook", appleSubscriptionWebhookHandler);

/**
 * Admin: Fetch all users with isPlanActive = true
 * GET /api/subscriptions/active-users
 */
router.get("/active-users", isAuthenticated, getActiveSubscribedUsers);

/**
 * User: Fetch subscription plan tenure & unified transaction history
 * GET /api/subscriptions/history
 */
router.get("/history", isAuthenticated, getUserPlanHistory);

export default router;

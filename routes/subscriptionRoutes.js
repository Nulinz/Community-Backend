import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getSubscriptionPlans,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  checkSubscriptionPaymentStatus,
  getActiveSubscribedUsers,
  getUserPlanHistory,
} from "../controller/user/subscriptionController.js";

const router = express.Router();

// GET /api/subscriptions/plans (Public/Auth)
router.get("/plans", getSubscriptionPlans);

// POST /api/subscriptions/create-order (Initiates Razorpay order & stores Pending payment record)
router.post("/create-order", isAuthenticated, createSubscriptionOrder);

// POST /api/subscriptions/verify-payment (Instant frontend modal success callback)
router.post("/verify-payment", isAuthenticated, verifySubscriptionPayment);

// POST /api/subscriptions/check-status (On-demand order status verification and self-healing)
router.post("/check-status", isAuthenticated, checkSubscriptionPaymentStatus);

// GET /api/subscriptions/active-users (Admin: Fetch all users with isPlanActive = true)
router.get("/active-users", isAuthenticated, getActiveSubscribedUsers);

// GET /api/subscriptions/history (User: Fetch plan history with currentPlan and previousPlans)
router.get("/history", isAuthenticated, getUserPlanHistory);

export default router;


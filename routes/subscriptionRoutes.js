import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getSubscriptionPlans,
  verifySubscriptionPayment,
  getActiveSubscribedUsers,
  getUserPlanHistory,
} from "../controller/user/subscriptionController.js";

const router = express.Router();

// GET /api/subscriptions/plans (Public/Auth)
router.get("/plans", getSubscriptionPlans);

// POST /api/subscriptions/verify-payment
router.post("/verify-payment", isAuthenticated, verifySubscriptionPayment);

// GET /api/subscriptions/active-users (Admin: Fetch all users with isPlanActive = true)
router.get("/active-users", isAuthenticated, getActiveSubscribedUsers);

// GET /api/subscriptions/history (User: Fetch plan history with currentPlan and previousPlans)
router.get("/history", isAuthenticated, getUserPlanHistory);

export default router;

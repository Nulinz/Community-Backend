import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getInfluencerDashboard,
  getInfluencerReferrals,
  getInfluencerProfile,
  getInfluencerSubscribedUsers,
} from "../controller/influencerController.js";

const router = express.Router();
// influencers routes
router.get("/dashboard", isAuthenticated, getInfluencerDashboard);
router.get("/referrals", isAuthenticated, getInfluencerReferrals);
router.get("/profile", isAuthenticated, getInfluencerProfile);
router.get("/subscribed-users", isAuthenticated, getInfluencerSubscribedUsers);

export default router;

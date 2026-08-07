import express from "express";

import { isAuthenticated } from "../middleware/authMiddleware.js";
import fileUploader from "../middleware/fileUploader.js";
import { adminDashBoard, updateEventStatus, updateJobStatus, createInfluencer, getAllInfluencers, setInfluencerPassword, getInfluencerById, toggleInfluencerStatus } from "../controller/adminController.js";

const router = express.Router();

router.get(
  "/dashboard",
  isAuthenticated,
  adminDashBoard
);

// Influencers
router.post("/influencer", isAuthenticated, fileUploader.single("profileImage"), createInfluencer);
router.get("/influencers", isAuthenticated, getAllInfluencers);
router.get("/influencer/:id", isAuthenticated, getInfluencerById);
router.post("/influencer/set-password", isAuthenticated, setInfluencerPassword);
router.patch("/influencer/toggle-status/:id", isAuthenticated, toggleInfluencerStatus);

// Events
router.patch("/event/status",isAuthenticated, updateEventStatus);

// Jobs
router.patch("/job/status",isAuthenticated, updateJobStatus);

export default router;
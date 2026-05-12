import express from "express";

import { isAuthenticated } from "../middleware/authMiddleware.js";
import { adminDashBoard, updateEventStatus,updateJobStatus } from "../controller/adminController.js";

const router = express.Router();

router.get(
  "/dashboard",
  isAuthenticated,
  adminDashBoard
);

// Events
router.patch("/event/status",isAuthenticated, updateEventStatus);

// Jobs
router.patch("/job/status",isAuthenticated, updateJobStatus);

export default router;
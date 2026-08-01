import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { submitFeedback, getAllFeedbacks } from "../controller/feedbackController.js";

const router = express.Router();

// POST /api/feedback/submit - Submit user feedback
router.post("/submit", isAuthenticated, submitFeedback);

// GET /api/feedback/all - View all feedback (Admin / Future use)
router.get("/all", isAuthenticated, getAllFeedbacks);

export default router;
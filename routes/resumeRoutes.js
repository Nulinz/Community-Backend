import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getResumeTemplates,
  previewResumeTemplate,
  generateResume,
  downloadResume,
} from "../controller/resumeController.js";

const router = express.Router();

// Get list of 7 available resume templates
router.get("/templates", getResumeTemplates);

// Live preview HTML template in browser with sample data
router.get("/preview/:templateId", previewResumeTemplate);

// Generate resume PDF from template and user form data
router.post("/generate", isAuthenticated, generateResume);

// Download generated resume PDF file directly
router.get("/download/:fileName", downloadResume);

export default router;

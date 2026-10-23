import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  getResumeTemplates,
  previewResumeTemplate,
  generateResume,
  downloadResume,
} from "../controller/resumeController.js";

import fileUploader from "../middleware/fileUploader.js";

const router = express.Router();

// Upload middleware allowing profileImage or profile_pic file upload from FE
const uploadResumeImage = (req, res, next) => {
  fileUploader.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "profile_pic", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      console.warn("[fileUploader:resume] File upload notice:", err.message);
    }
    next();
  });
};

// Get list of active resume templates
router.get("/templates", getResumeTemplates);

// Live preview HTML template in browser with sample data
router.get("/preview/:templateId", previewResumeTemplate);

// Generate resume PDF from template and user form data (supports multipart/form-data with file or JSON)
router.post("/generate", isAuthenticated, uploadResumeImage, generateResume);

// Download generated resume PDF file directly
router.get("/download/:fileName", downloadResume);

export default router;

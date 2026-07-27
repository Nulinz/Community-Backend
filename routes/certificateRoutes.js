import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  generateCertificate,
  verifyCertificate,
  downloadCertificate,
  getUserCertificates
} from "../controller/certificateController.js";

const router = express.Router();

// POST /api/certificates/generate - Protected (Requires Auth)
router.post("/generate", isAuthenticated, generateCertificate);

// GET /api/certificates/user/:userId - Fetch all certificates for a user --> mobile
router.get("/user/:userId", getUserCertificates);

// GET /api/certificates/verify/:certificateId - Public verification --> mobile
router.get("/verify/:certificateId", verifyCertificate);

// GET /api/certificates/download/:certificateId - Direct PDF download --> mobile
router.get("/download/:certificateId", downloadCertificate);

export default router;

import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import fileUploader from "../middleware/fileUploader.js";
import {
  generateCertificate,
  verifyCertificate,
  downloadCertificate,
  getUserCertificates,
  uploadCertificate,
  deleteCertificate,
} from "../controller/certificateController.js";

const router = express.Router();

// POST /api/certificates/generate - Protected (Requires Auth)
router.post("/generate", isAuthenticated, generateCertificate);

// POST /api/certificates/upload - Upload certificate from device (Protected)
router.post(
  "/upload",
  isAuthenticated,
  fileUploader.single("certificate"),
  uploadCertificate
);

// GET /api/certificates/user/:userId - Fetch all certificates for a user --> mobile
router.get("/user/:userId", getUserCertificates);

// GET /api/certificates/verify/:certificateId - Public verification --> mobile
router.get("/verify/:certificateId", verifyCertificate);

// GET /api/certificates/download/:certificateId - Direct PDF download --> mobile
router.get("/download/:certificateId", downloadCertificate);

// DELETE /api/certificates/:id - Delete certificate owned by user (Protected)
router.delete(["/:id", "/delete/:id"], isAuthenticated, deleteCertificate);

export default router;



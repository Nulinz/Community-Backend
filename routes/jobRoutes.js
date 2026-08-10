import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import {
  createJobForm,
  getAllJobs,
  getJobById,
  toggleJobStatus,
  updateApplicationStatus,
  getAppliedCandidateProfile,
  getSelectedCandidates,
  saveAttendance,
  getAttendanceHistory,
  getAttendanceDetails,
  savePerformanceEvaluation,
  getPerformanceEvaluation,
} from "../controller/jobController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createJobForm);
router.get("/all", isAuthenticated, getAllJobs);
router.get("/getById/:id", isAuthenticated, getJobById);
router.patch("/toggle-status/:id", isAuthenticated, toggleJobStatus);
router.put("/update/:id", isAuthenticated, createJobForm);

// Candidate Selection, Performance & Attendance Routes
router.get("/candidate-profile/:applicationId", isAuthenticated, getAppliedCandidateProfile);
router.patch("/application-status/:applicationId", isAuthenticated, updateApplicationStatus);
router.get("/selected-candidates/:jobId", isAuthenticated, getSelectedCandidates);

// Attendance routes
router.post("/attendance/:jobId", isAuthenticated, saveAttendance);
router.get("/attendance-history/:jobId", isAuthenticated, getAttendanceHistory);
router.get("/attendance-details/:jobId", isAuthenticated, getAttendanceDetails);

// Performance evaluation routes
router.post("/performance-evaluation", isAuthenticated, savePerformanceEvaluation);
router.get("/performance-evaluation/:applicationId", isAuthenticated, getPerformanceEvaluation);

export default router;

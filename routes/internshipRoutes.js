import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { 
    createInternshipForm, 
    getAllInternships, 
    getInternshipById,
    toggleInternshipStatus,
    updateApplicationStatus,
    getAppliedCandidateProfile,
    getSelectedCandidates,
    saveAttendance,
    getAttendanceHistory,
    getAttendanceDetails,
    savePerformanceEvaluation,
    getPerformanceEvaluation
} from "../controller/internshipController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createInternshipForm);
router.get("/all", isAuthenticated, getAllInternships);
router.get("/getById/:id", isAuthenticated, getInternshipById);
router.patch("/toggle-status/:id", isAuthenticated, toggleInternshipStatus);

// Update the Internship
router.put("/update/:id", isAuthenticated, createInternshipForm);

// Candidate Selection, Performance & Attendance Routes
router.get("/candidate-profile/:applicationId", isAuthenticated, getAppliedCandidateProfile);
// To change the status of job application
router.patch("/application-status/:applicationId", isAuthenticated, updateApplicationStatus);
// list all selected candidates
router.get("/selected-candidates/:jobId", isAuthenticated, getSelectedCandidates);
// Attendance routes
router.post("/attendance/:jobId", isAuthenticated, saveAttendance);
router.get("/attendance-history/:jobId", isAuthenticated, getAttendanceHistory);
router.get("/attendance-details/:jobId", isAuthenticated, getAttendanceDetails);
// Performance evaluation routes
router.post("/performance-evaluation", isAuthenticated, savePerformanceEvaluation);
router.get("/performance-evaluation/:applicationId", isAuthenticated, getPerformanceEvaluation);

export default router;

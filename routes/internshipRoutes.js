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
    getAttendanceDetails
} from "../controller/internshipController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createInternshipForm);
router.get("/all", isAuthenticated, getAllInternships);
router.get("/getById/:id", isAuthenticated, getInternshipById);
router.patch("/toggle-status/:id", isAuthenticated, toggleInternshipStatus);

// Update the Internship
router.put("/update/:id", isAuthenticated, createInternshipForm);

// Candidate Selection & Attendance Routes
router.get("/candidate-profile/:applicationId", isAuthenticated, getAppliedCandidateProfile);
router.patch("/application-status/:applicationId", isAuthenticated, updateApplicationStatus);
router.get("/selected-candidates/:jobId", isAuthenticated, getSelectedCandidates);
router.post("/attendance/:jobId", isAuthenticated, saveAttendance);
router.get("/attendance-history/:jobId", isAuthenticated, getAttendanceHistory);
router.get("/attendance-details/:jobId", isAuthenticated, getAttendanceDetails);

export default router;

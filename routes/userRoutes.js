import express from "express";
import multer from "multer";
import { getAiTools } from "../controller/user/aiToolsController.js";
import { getMissions, claimMission, getUserXpSummary } from "../controller/user/xpController.js";

import {
  // createNewPassword,
  // forgotPassword,
  // loginUser,
  // logoutUser,
  // registerUser,
  // verifyOtp,
  adminLogin,
  adminForgotPassword,
  adminVerifyOtp,
  adminChangePassword,
  adminLogout,
  createAdmin,
  // getCurrentUser,

} from "../controller/userController.js";
import { isAuthenticated, authorizeRoles } from "../middleware/authMiddleware.js";
import { forgotOtpVerify, getCurrentUser, loginUser, forgotPassword, registerUser, resendOtp, resetPassword, verifyOtp, logout, changePassword, webLoginUser } from "../controller/user/authController.js"
import {
  userDashboard,
  getSubscriptionStatus,
  getAllRegisteredUsers,
  getJobs,
  getAllInternships,
  getAllFreelances,
  toggleSavedJob,
  getSavedJobs,
  getSavedFreelances,
  applyJob,
  getAppliedJobs,
  getAppliedFreelances,
  getJobProfile,
  getAllCompetitions,
  getCompetitionProfile,
  createEventRegistration,
  createExternalEventRegistration,
  getAllConferences,
  getConferenceProfile,
  getLocations,
  getEventsPage,
  getSeminarsPage,
  getMyRegistrations,
  getAllNonTechnicalEvents,
  getAllTechnicalEvents,
  getEventProfile,
  getAllTechnicalSeminars,
  getAllNonTechnicalSeminars,
  getSeminarProfile,
  getAllCompanies,
  toggleFollow,
  getCompanyProfile,
  getMySuggestions,
  getJobMetaPage,
  getEventMetaPage,
  getCompanyMetaPage,
  activePing,
} from "../controller/user/userController.js";
import fileUploader from "../middleware/fileUploader.js";
import { getNotifications, getUserResumes, markAsRead, updateProfilePic, updateUserDetails, uploadResume } from "../controller/user/profileController.js";
import { getUserDetails } from "../controller/userDetailController.js";
import {
  markEventAttendance,
  getEventAttendanceStats
} from "../controller/user/eventAttendanceController.js";
import {
  exportEventRegistrationsCSV,
  exportEventAttendanceCSV,
  exportJobCandidatesCSV,
  exportCollegeDashboardRegistrationsCSV
} from "../controller/exportController.js";

const router = express.Router();
const uploader = multer();

// app
// router.post("/register", uploader.none(), registerUser);
// router.post("/login", uploader.none(), loginUser);
// router.post("/forgot-password", uploader.none(), forgotPassword);
// router.post("/verify-otp", uploader.none(), verifyOtp);
// router.post("/create-new-password", uploader.none(), createNewPassword);
// router.post("/logout", isAuthenticated, logoutUser);

router.post("/register", uploader.none(), registerUser);
router.get("/logout", isAuthenticated, logout)
// App login
router.post("/login", uploader.none(), loginUser)
// Web login
router.post("/web-login", uploader.none(), webLoginUser);


// 🔹 VERIFY OTP (after register)
router.post("/verify-otp", uploader.none(), verifyOtp);

// 🔹 RESEND OTP (register / forgot)
router.post("/resend-otp", uploader.none(), resendOtp);

// 🔹 FORGOT PASSWORD (generate OTP)
router.post("/forgot-password", uploader.none(), forgotPassword);

// 🔹 RESET PASSWORD (OTP + new password OR phone + new_password based on your flow)
router.post("/reset-password", uploader.none(), resetPassword);
router.post("/forgot-otp-verify", uploader.none(), forgotOtpVerify);
router.post("/change-password", uploader.none(), isAuthenticated, changePassword);
router.post("/apply-job", uploader.none(), isAuthenticated, applyJob);
router.get("/my-applied-job", isAuthenticated, getAppliedJobs);
router.get("/my-applied-freelance", isAuthenticated, getAppliedFreelances);

router.get("/dashboard", isAuthenticated, userDashboard);
router.post("/active-ping", isAuthenticated, activePing);
router.get("/jobs", isAuthenticated, getJobs)
router.get("/internships", isAuthenticated, getAllInternships)
router.get("/freelances", isAuthenticated, getAllFreelances)
router.post("/job-toggle", uploader.none(), isAuthenticated, toggleSavedJob);
router.post("/job-profile", uploader.none(), isAuthenticated, getJobProfile);
// GET /api/saved-jobs          → get all saved jobs and internships (auth required)
router.get("/my-saved-job", uploader.none(), isAuthenticated, getSavedJobs);
router.get("/my-saved-freelance", uploader.none(), isAuthenticated, getSavedFreelances);

router.get("/competitions", uploader.none(), isAuthenticated, getAllCompetitions);

// GET /api/competitions/:id    → single competition profile
router.post("/Competition-profile", uploader.none(), isAuthenticated, getCompetitionProfile);
router.post("/event-profile", uploader.none(), isAuthenticated, getEventProfile);

// GET  /api/conferences          → all conferences list
router.get("/conferences", uploader.none(), isAuthenticated, getAllConferences);

// POST /api/conferences/profile  → single conference profile (id in body)
router.post("/conference-profile", uploader.none(), isAuthenticated, getConferenceProfile);

router.post("/seminar-profile", uploader.none(), isAuthenticated, getSeminarProfile);


router.get("/events", isAuthenticated, getEventsPage);
router.get("/my-booked", isAuthenticated, getMyRegistrations);

router.get(
  "/all-companies",
  isAuthenticated,
  getAllCompanies
);

// ✅ Follow / Unfollow Company
router.post(
  "/toggle-follow",
  uploader.none(),
  isAuthenticated,
  toggleFollow
);

router.post(
  "/company-profile",
  uploader.none(),
  isAuthenticated,
  getCompanyProfile
);



// Seminars landing page
router.get("/seminars", isAuthenticated, getSeminarsPage);
router.get("/locations", getLocations);
router.post("/event-register", uploader.none(), isAuthenticated, createEventRegistration);
router.post("/external-event-register", uploader.none(), isAuthenticated, createExternalEventRegistration);

router.get(
  "/event-technical",
  isAuthenticated,
  getAllTechnicalEvents
);

// ✅ Non-Technical Events
router.get(
  "/event-non-technical",
  isAuthenticated,
  getAllNonTechnicalEvents
);



router.get(
  "/seminar-technical",
  isAuthenticated,
  getAllTechnicalSeminars
);

// ✅ Non-Technical Events
router.get(
  "/seminar-non-technical",
  isAuthenticated,
  getAllNonTechnicalSeminars
);
router.post(
  "/update-profile-pic",
  isAuthenticated,
  fileUploader.single("profile_pic"),
  updateProfilePic
);
router.post(
  "/upload-resume",
  isAuthenticated,
  fileUploader.single("resume"), // 👈 field name must match
  uploadResume
);

router.post(
  "/update-user-details",
  uploader.none(),
  isAuthenticated,
  updateUserDetails
);
router.get("/my-resume", isAuthenticated, getUserResumes);
router.get("/notifications", isAuthenticated, getNotifications);
router.get(
  "/my-suggestions",
  isAuthenticated,
  getMySuggestions
);

router.get("/share/job", getJobMetaPage);

// ─────────────────────────────────────────────
// Event Share Meta Route
// Example:
// /api/users/share/event?event_id=123
// /api/users/share/event?event_id=123&web=true
// ─────────────────────────────────────────────
router.get("/share/event", getEventMetaPage);
router.get("/share/company", getCompanyMetaPage);
// Mark notification(s) as read
router.post("/notifications/read", uploader.none(), isAuthenticated, markAsRead);
router.get("/user-details", isAuthenticated, getUserDetails)
// admin
router.post("/create-admin", uploader.none(), isAuthenticated, authorizeRoles("admin"), uploader.none(), createAdmin);
router.post("/adminlogin", uploader.none(), adminLogin);
router.post("/adminforgot", uploader.none(), adminForgotPassword);
router.post("/adminverify", uploader.none(), adminVerifyOtp);
router.post("/adminchangepassword", uploader.none(), adminChangePassword);
router.post("/adminlogout", uploader.none(), adminLogout);
router.get("/me", isAuthenticated, getCurrentUser);
router.get("/subscription-status", isAuthenticated, getSubscriptionStatus);

// GET /api/users/all-registered  (role = user)
router.get("/all-registered", isAuthenticated, getAllRegisteredUsers);

// ─────────────────────────────────────────────
// Event & Competition QR Attendance Routes
// ─────────────────────────────────────────────
router.post("/attendance/scan-event-qr", uploader.none(), isAuthenticated, markEventAttendance);
router.get("/attendance/stats/:eventId", isAuthenticated, getEventAttendanceStats);

// ─────────────────────────────────────────────
// CSV Export Routes
// ─────────────────────────────────────────────
router.get("/export/event-registrations/:eventId", isAuthenticated, exportEventRegistrationsCSV);
router.get("/export/event-attendance/:eventId", isAuthenticated, exportEventAttendanceCSV);
router.get("/export/job-candidates/:jobId", isAuthenticated, exportJobCandidatesCSV);
router.get("/export/college-dashboard-registrations", isAuthenticated, exportCollegeDashboardRegistrationsCSV);

// ─────────────────────────────────────────────
// XP Missions & Claim Routes
// ─────────────────────────────────────────────
router.get("/xp/summary", isAuthenticated, getUserXpSummary);
router.get("/xp/missions", isAuthenticated, getMissions);
router.post("/xp/claim", uploader.none(), isAuthenticated, claimMission);

// ─────────────────────────────────────────────
// Static AI Tools Route
// ─────────────────────────────────────────────
router.get("/ai-tools", isAuthenticated, getAiTools);

export default router;

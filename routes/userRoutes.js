import express from "express";
import multer from "multer";

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
import { forgotOtpVerify, getCurrentUser, loginUser, forgotPassword, registerUser, resendOtp, resetPassword, verifyOtp, logout, changePassword } from "../controller/user/authController.js";
import {
  userDashboard,
  getJobs,
  getAllInternships,
  getAllFreelances,
  toggleSavedJob,
  getSavedJobs,
  applyJob,
  getAppliedJobs,
  getJobProfile,
  getAllCompetitions,
  getCompetitionProfile,
  createEventRegistration,
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
  getMySuggestions
} from "../controller/user/userController.js";
import fileUploader from "../middleware/fileUploader.js";
import { getNotifications, getUserResumes, markAsRead, updateProfilePic, updateUserDetails, uploadResume } from "../controller/user/profileController.js";
import { getUserDetails } from "../controller/userDetailController.js";

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
router.get("/logout",isAuthenticated,logout)
router.post("/login", uploader.none(), loginUser)
// 🔹 VERIFY OTP (after register)
router.post("/verify-otp", uploader.none(), verifyOtp);

// 🔹 RESEND OTP (register / forgot)
router.post("/resend-otp", uploader.none(), resendOtp);

// 🔹 FORGOT PASSWORD (generate OTP)
router.post("/forgot-password", uploader.none(), forgotPassword);

// 🔹 RESET PASSWORD (OTP + new password OR phone + new_password based on your flow)
router.post("/reset-password", uploader.none(), resetPassword);
router.post("/forgot-otp-verify", uploader.none(), forgotOtpVerify);
router.post("/change-password", uploader.none(),isAuthenticated,changePassword);
router.post("/apply-job",uploader.none(), isAuthenticated, applyJob);
router.get("/my-applied-job", isAuthenticated, getAppliedJobs);

router.get("/dashboard", isAuthenticated, userDashboard)
router.get("/jobs", isAuthenticated, getJobs)
router.get("/internships", isAuthenticated, getAllInternships)
router.get("/freelances", isAuthenticated, getAllFreelances)
router.post("/job-toggle", uploader.none(),isAuthenticated, toggleSavedJob);
router.post("/job-profile",uploader.none(), isAuthenticated, getJobProfile);
// GET /api/saved-jobs          → get all saved jobs (auth required)
router.get("/my-saved-job", uploader.none(),isAuthenticated, getSavedJobs);

router.get("/competitions",uploader.none(), isAuthenticated, getAllCompetitions);

// GET /api/competitions/:id    → single competition profile
router.post("/Competition-profile",uploader.none(), isAuthenticated, getCompetitionProfile);
router.post("/event-profile",uploader.none(), isAuthenticated, getEventProfile);

// GET  /api/conferences          → all conferences list
router.get("/conferences",uploader.none(), isAuthenticated, getAllConferences);

// POST /api/conferences/profile  → single conference profile (id in body)
router.post("/conference-profile", uploader.none(),isAuthenticated, getConferenceProfile);

router.post("/seminar-profile", uploader.none(),isAuthenticated, getSeminarProfile);


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
router.post("/event-register", uploader.none(),isAuthenticated, createEventRegistration);
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
// Mark notification(s) as read
router.post("/notifications/read",uploader.none(), isAuthenticated, markAsRead);
router.get("/user-details",isAuthenticated,getUserDetails)
// admin
router.post("/create-admin",uploader.none(), isAuthenticated, authorizeRoles("admin"), uploader.none(), createAdmin);
router.post("/adminlogin", uploader.none(), adminLogin);
router.post("/adminforgot", uploader.none(), adminForgotPassword);
router.post("/adminverify", uploader.none(), adminVerifyOtp);
router.post("/adminchangepassword", uploader.none(), adminChangePassword);
router.post("/adminlogout", uploader.none(), adminLogout);
router.get("/me", isAuthenticated, getCurrentUser);




export default router;

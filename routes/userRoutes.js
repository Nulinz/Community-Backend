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
import { forgotOtpVerify, getCurrentUser, loginUser, forgotPassword, registerUser, resendOtp, resetPassword, verifyOtp } from "../controller/user/authController.js";
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
  getConferenceProfile
} from "../controller/user/userController.js";

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

router.post("/apply-job", isAuthenticated, applyJob);
router.get("/my-applied-job", isAuthenticated, getAppliedJobs);

router.get("/dashboard", isAuthenticated, userDashboard)
router.get("/jobs", isAuthenticated, getJobs)
router.get("/internships", isAuthenticated, getAllInternships)
router.get("/freelances", isAuthenticated, getAllFreelances)
router.post("/job-toggle", uploader.none(),isAuthenticated, toggleSavedJob);
router.post("/job-profile", isAuthenticated, getJobProfile);
// GET /api/saved-jobs          → get all saved jobs (auth required)
router.get("/my-saved-job", isAuthenticated, getSavedJobs);

router.get("/competitions", isAuthenticated, getAllCompetitions);

// GET /api/competitions/:id    → single competition profile
router.post("/Competition-profile", isAuthenticated, getCompetitionProfile);


// GET  /api/conferences          → all conferences list
router.get("/conferences", isAuthenticated, getAllConferences);

// POST /api/conferences/profile  → single conference profile (id in body)
router.post("/conference-profile", isAuthenticated, getConferenceProfile);


router.post("/event-register", isAuthenticated, createEventRegistration);
// admin
router.post("/create-admin", isAuthenticated, authorizeRoles("admin"), uploader.none(), createAdmin);
router.post("/adminlogin", uploader.none(), adminLogin);
router.post("/adminforgot", uploader.none(), adminForgotPassword);
router.post("/adminverify", uploader.none(), adminVerifyOtp);
router.post("/adminchangepassword", uploader.none(), adminChangePassword);
router.post("/adminlogout", uploader.none(), adminLogout);
router.get("/me", isAuthenticated, getCurrentUser);




export default router;

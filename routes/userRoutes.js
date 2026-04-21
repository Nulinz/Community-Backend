import express from "express";
import multer from "multer";

import {
  createNewPassword,
  forgotPassword,
  loginUser,
  logoutUser,
  registerUser,
  verifyOtp,
  adminLogin,
  adminForgotPassword,
  adminVerifyOtp,
  adminChangePassword,
  adminLogout,
  createAdmin,
  getCurrentUser,
} from "../controller/userController.js";
import { isAuthenticated, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const uploader = multer();

// app
router.post("/register", uploader.none(), registerUser);
router.post("/login", uploader.none(), loginUser);
router.post("/forgot-password", uploader.none(), forgotPassword);
router.post("/verify-otp", uploader.none(), verifyOtp);
router.post("/create-new-password", uploader.none(), createNewPassword);
router.post("/logout", isAuthenticated, logoutUser);




// admin
router.post("/create-admin", isAuthenticated, authorizeRoles("admin"), uploader.none(), createAdmin);
router.post("/adminlogin", uploader.none(), adminLogin);
router.post("/adminforgot", uploader.none(), adminForgotPassword);
router.post("/adminverify", uploader.none(), adminVerifyOtp);
router.post("/adminchangepassword", uploader.none(), adminChangePassword);
router.post("/adminlogout", uploader.none(), adminLogout);
router.get("/me", isAuthenticated, getCurrentUser);




export default router;

import User from "../../models/userModel.js";
import jwt from "jsonwebtoken";
import UserDetails from "../../models/userDetails.js";
import Company from "../../models/companyModel.js";
import College from "../../models/collegeModel.js";
import otpService from "../../config/sendSMS.js";
import { awardXP, triggerMissionNotification } from "../../services/xpService.js";
import { calculateLevelInfo } from "../../config/xpConfig.js";

// 🔹 Helper function to generate unique 6-8 character referral codes (e.g. JOHN4819)
const generateUniqueReferralCode = async (name = "USER") => {
  const cleanName = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
  const prefix = cleanName.padEnd(4, "GRAD");
  let isUnique = false;
  let code = "";

  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}${randomDigits}`;
    const existing = await User.exists({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

export const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const fcm_token = req.body.fcm_token || req.body.fcmToken || null;

    // 🔹 1. Validate input
    if (!phone || !password) {
      return res.status(400).json({
        message: "Phone and password are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone })

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Invaild user",
      });
    }

    // 🔹 4. Compare password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Password incorrect",
      });
    }
    const userDetails = await UserDetails.findOne({
      userId: user._id,
    });

    if (user.register_status === "pending") {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otp_expire = new Date(Date.now() + 5 * 60 * 1000);
      user.otp = otp;
      user.otp_expire = otp_expire;
      if (fcm_token) {
        user.fcm_token = fcm_token;
      }
      await user.save();
      return res.status(200).json({
        status: false,
        message: "registraction pending",
        data: {
          details_comp: (user.register_status === "completed") ? true : false,
          register_status: user.register_status,
          otp,
          otp_expire
        }
      });
    }

    // 🔹 5. Account status validation
    // Inactive accounts cannot log in until explicitly reactivated via the toggle API.
    if (!user.is_active) {
      return res.status(403).json({
        status: false,
        message: "Your account is inActive. Please reactivate your account.",
        data: {
          accountStatus: "inActive",
          phone: user.phone,
        },
      });
    }

    // 🔹 6. Update FCM token (optional) & record lastActiveDate
    if (fcm_token) {
      user.fcm_token = fcm_token;
    }
    user.lastActiveDate = new Date();
    await user.save();

    // 🔹 7. Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 🔹 Ensure referralCode is available for user
    let userReferralCode = user.referralCode;
    if (!userReferralCode && (!user.role || user.role === "user")) {
      userReferralCode = await generateUniqueReferralCode(user.name);
      user.referralCode = userReferralCode;
      await user.save();
    }

    // 🔹 8. Response
    return res.status(200).json({
      status: true,
      data: {
        accountStatus: "active",
        details_comp: (userDetails && user.register_status === "completed") ? true : false, // 👈 key logic
        register_status: user.register_status,
        referralCode: userReferralCode || "",
        token,
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role || "user",
          // accountStatus: "active",
          profile_pic: userDetails?.profile_pic,
          referralCode: userReferralCode || "",
        },
      },
      message: "Login successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const fcm_token = req.body.fcm_token || req.body.fcmToken || null;
    // 🔹 Validate
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    // 🔹 Check existing (single query)
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }],
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(400).json({ status: false, message: "Email Id already exists" });
      }
      if (existingUser.phone === cleanPhone) {
        return res.status(400).json({ status: false, message: "Mobile Number already exists" });
      }
      return res.status(400).json({ status: false, message: "User with this email or phone already exists" });
    }

    // 🔹 Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 🔹 Expiry (5 minutes)
    const otp_expire = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 Generate Unique Referral Code (Only for role = user)
    const targetRole = req.body.role || "user";
    const referralCode = targetRole === "user" ? await generateUniqueReferralCode(name) : null;

    // 🔹 Process Referral & Influencer Attribution
    // Resolves attribution from shared links (e.g. gradenvy.com/referral?ref=CODE).
    // Prioritizes regular peer-to-peer referral code; if unmatched and no influencer
    // has been bound yet, looks up an active influencer with matching influencerCode.
    let influencerId = null;
    let referredBy = null;

    if (req.body.influencerCode && typeof req.body.influencerCode === "string") {
      const influencer = await User.findOne({
        influencerCode: req.body.influencerCode.trim().toUpperCase(),
        role: "influencer",
      });
      if (influencer) {
        influencerId = influencer._id;
      }
    }

    const incomingReferralCode = req.body.referralCode || req.body.ref || req.body.referral_id;
    if (incomingReferralCode && typeof incomingReferralCode === "string") {
      const cleanReferralCode = incomingReferralCode.trim().toUpperCase();
      const referrer = await User.findOne({
        referralCode: cleanReferralCode,
      });

      // Guard against self-referral
      if (referrer && referrer.email !== email && referrer.phone !== phone) {
        referredBy = referrer._id;
      } else if (!influencerId) {
        // If the code does not belong to a standard peer, check if it belongs to an influencer
        const influencer = await User.findOne({
          influencerCode: cleanReferralCode,
          role: "influencer",
        });
        if (influencer && influencer.email !== email && influencer.phone !== phone) {
          influencerId = influencer._id;
        }
      }
    }

    // 🔹 Prepare user document without null/undefined optional fields to avoid index collisions
    const userData = {
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password,
      otp,
      otp_expire,
    };

    if (referralCode && typeof referralCode === "string" && referralCode.trim()) {
      userData.referralCode = referralCode.trim().toUpperCase();
    }
    if (referredBy) userData.referredBy = referredBy;
    if (influencerId) userData.influencerId = influencerId;
    if (fcm_token) userData.fcm_token = fcm_token;
    if (req.body.device_type) userData.device_type = req.body.device_type;

    // 🔹 Create user
    const user = await User.create(userData);

    await otpService.sendOtp(
      cleanPhone,
      name.trim(),
      otp
    );
    return res.status(200).json({
      status: true,
      message: "User registered. OTP generated",
      data: {
        user_id: user._id,
        pending: true,
        otp_expire,
        otp, // ⚠️ remove this in production (only for testing)
        referralCode: user.referralCode || "",
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === 11000) {
      // Extract the colliding field name across MongoDB Driver v6 errorResponse, Mongoose, and error.message
      const keyPatternObj =
        error.errorResponse?.keyPattern ||
        error.keyPattern ||
        error.errorResponse?.keyValue ||
        error.keyValue;

      let field = keyPatternObj ? Object.keys(keyPatternObj)[0] : null;

      if (!field && error.message) {
        const match = error.message.match(/index:\s+([^\s]+)/);
        if (match && match[1]) {
          field = match[1].replace(/_1$/, "");
        }
      }

      const duplicateField = field || "User detail";

      return res.status(400).json({
        status: false,
        message: `${duplicateField} already exists`,
        field: duplicateField,
        error: error.message,
      });
    }

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const fcm_token = req.body.fcm_token || req.body.fcmToken || null;

    // 🔹 1. Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        status: false,
        message: "Phone and OTP are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Invaild user",
      });
    }

    // 🔹 3. Check OTP match
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({
        status: false,
        message: "OTP is incorrect",
      });
    }

    // 🔹 4. Check OTP expiry
    if (!user.otp_expire || user.otp_expire < new Date()) {
      return res.status(400).json({
        status: false,
        message: "OTP expired",
      });
    }

    // 🔹 5. Update user
    user.otp = null;
    user.otp_expire = null;
    user.register_status = "completed";
    user.is_active = true;

    if (fcm_token) {
      user.fcm_token = fcm_token;
    }

    await user.save();

    // 🔹 First Registration completed. Trigger mission notification.
    triggerMissionNotification(user._id, "FIRST_REGISTERATION").catch((err) =>
      console.error("FIRST_REGISTERATION notification error:", err.message)
    );

    // 🔹 Trigger Referral Claim notification for the referrer so they can claim their 20 XP in Missions
    if (user.referredBy) {
      triggerMissionNotification(user.referredBy, "REFERRAL").catch((err) =>
        console.error("REFERRAL notification error:", err.message)
      );
    }

    // 🔹 6. Generate JWT token
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully",
      token,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        referralCode: user.referralCode,
        register_status: user.register_status,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      status: false,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        status: false,
        message: "Phone is required",
      });
    }

    // 🔹 Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 🔹 Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 🔹 Expiry (5 min)
    const otp_expire = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 Update user
    user.forgot_otp = otp;
    user.forgot_otp_expire = otp_expire;
    user.forgot_status = "otp_pending";

    await user.save();

    await otpService.sendOtp(phone, user.name, otp);

    return res.json({
      status: true,
      message: "Forgot password OTP sent",
      data: {
        otp, otp_expire
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

export const forgotOtpVerify = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // 🔹 1. Validate input
    if (!phone || !otp) {
      return res.status(400).json({
        status: false,
        message: "Phone and OTP are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 🔹 3. Check OTP match
    if (!user.forgot_otp || user.forgot_otp !== otp) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    // 🔹 4. Check expiry
    if (
      !user.forgot_otp_expire ||
      user.forgot_otp_expire < new Date()
    ) {
      return res.status(400).json({
        status: false,
        message: "OTP expired",
      });
    }

    // 🔹 5. Update status only (no password change here)
    user.forgot_status = "otp_verified";

    await user.save();

    return res.json({
      status: true,
      message: "OTP verified successfully",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { phone, new_password } = req.body;

    // 🔹 1. Validate
    if (!phone || !new_password) {
      return res.status(400).json({
        status: false,
        message: "Phone and new password are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 🔹 3. (IMPORTANT) Check if allowed to reset
    if (user.forgot_status !== "otp_verified") {
      return res.status(400).json({
        status: false,
        message: "Unauthorized password reset",
      });
    }

    // 🔹 4. Update password
    user.password = new_password;

    // 🔹 5. Reset forgot flow
    user.forgot_status = "completed";
    user.forgot_otp = null;
    user.forgot_otp_expire = null;

    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password reset successful",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Server error",
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { phone, type } = req.body;

    // 🔹 1. Validate input
    if (!phone || !type) {
      return res.status(400).json({
        status: false,
        message: "Phone and type are required",
      });
    }

    if (!["register", "forgot"].includes(type)) {

      return res.status(400).json({
        status: false,
        message: "Invalid type",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 🔹 3. Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otp_expire = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 4. Handle based on type
    if (type === "register") {
      if (user.register_status === "completed") {
        return res.status(400).json({
          status: false,
          message: "User already registered",
        });
      }
      user.otp = otp;
      user.otp_expire = otp_expire;
      await otpService.sendOtp(phone, user.name, otp);
    }

    if (type === "forgot") {
      user.forgot_otp = otp;
      user.forgot_otp_expire = otp_expire;
      user.forgot_status = "otp_pending";
      await otpService.sendOtp(phone, user.name, otp);
    }

    await user.save();

    return res.status(200).json({
      status: true,
      message: "OTP resent successfully",
      otp,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      status: false,
    });
  }
};
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    let userDetails = null;
    let details_comp = false;

    let userReferralCode = user.referralCode;

    // 🔹 Fetch details and auto-generate referralCode only for role = user
    if (user.role === "user") {
      userDetails = await UserDetails.findOne({
        userId: user._id,
      });
      details_comp = (userDetails && user.register_status === "completed") ? true : false;

      if (!userReferralCode) {
        userReferralCode = await generateUniqueReferralCode(user.name);
        await User.findByIdAndUpdate(user._id, { $set: { referralCode: userReferralCode } });
      }
    }

    let companyLogo = null;
    let companyName = null;
    let collegeLogo = null;
    let collegeName = null;

    if (user.role === "company") {
      const comp = await Company.findOne({ userId: user._id }).select("companyLogo companyName");
      if (comp) {
        companyLogo = comp.companyLogo || null;
        companyName = comp.companyName || null;
      }
    } else if (user.role === "college") {
      const col = await College.findOne({ userId: user._id }).select("collegeLogo collegeName");
      if (col) {
        collegeLogo = col.collegeLogo || null;
        collegeName = col.collegeName || null;
      }
    }

    const levelInfo = calculateLevelInfo(user.xp || 0);

    return res.status(200).json({
      status: true,
      message: "User fetched successfully",
      data: {
        details_comp,
        user: {
          _id: user._id,
          name: companyName || collegeName || user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          companyLogo,
          collegeLogo,
          companyName,
          collegeName,
          accountStatus: user.is_active ? "active" : "inActive",
          referralCode: userReferralCode,
          register_status: user.register_status,
          xp: levelInfo.totalXP,
          level: levelInfo.currentLevel,
          levelInfo: {
            currentLevel: levelInfo.currentLevel,
            totalXP: levelInfo.totalXP,
            xpForCurrentLevel: levelInfo.xpForCurrentLevel,
            xpForNextLevel: levelInfo.xpForNextLevel,
            xpNeededForNextLevel: levelInfo.xpNeeded,
            progressPercentage: levelInfo.progressPercentage,
          },
        },
        userDetails: userDetails || null,
      },
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: false,
      message: "Server error",
      data: {},
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {
      fcm_token: null,
      device_type: null,
      last_login: new Date(),
    });

    return res.status(200).json({
      status: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "currentPassword, newPassword and confirmPassword are required",
      });
    }

    // Check new password and confirm match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "newPassword and confirmPassword do not match",
      });
    }

    // Minimum password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: false,
        message: "New password must be at least 6 characters",
      });
    }

    // Get user with password
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Verify current password using model method
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: false,
        message: "Current password is incorrect",
      });
    }

    // Update password — pre save hook will hash it automatically
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to change password",
      error: error.message,
    });
  }
};

export const webLoginUser = async (req, res) => {
  try {
    // 🔹 1. Identifier (email or phone) and password
    const { phone, email, password } = req.body;
    const fcm_token = req.body.fcm_token || req.body.fcmToken || null;
    const identifier = email || phone;

    if (!identifier || !password)
      return res.status(400).json({ status: false, message: "Email/Phone and password are required" });

    // 🔹 2. Find user by email OR phone
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase().trim() },
        { phone: identifier.trim() },
      ],
    }).select("+password");

    if (!user)
      return res.status(404).json({ status: false, message: "Invalid credentials" });

    // 🔹 3. THE BOUNCER: Check if their actual DB role is allowed on the web
    const allowedRoles = ["admin", "college", "company", "influencer"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ status: false, message: "Access denied. Please use the mobile app." });
    }

    // 🔹 4. Password check
    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ status: false, message: "Invalid credentials" });

    // 🔹 5. Account status validation
    // Inactive accounts cannot log in until explicitly reactivated via the toggle API.
    if (user.is_active === false) {
      return res.status(403).json({
        status: false,
        message: "Your account is inActive. Please reactivate your account.",
        data: {
          accountStatus: "inActive",
        },
      });
    }

    // 🔹 6. JWT with their auto-detected role
    const token = jwt.sign(
      { id: user._id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    if (fcm_token) {
      user.fcm_token = fcm_token;
      await user.save();
    }

    const userDetails = await UserDetails.findOne({ userId: user._id });

    let companyLogo = null;
    let companyName = null;
    let collegeLogo = null;
    let collegeName = null;

    if (user.role === "company") {
      const comp = await Company.findOne({ userId: user._id }).select("companyLogo companyName");
      if (comp) {
        companyLogo = comp.companyLogo || null;
        companyName = comp.companyName || null;
      }
    } else if (user.role === "college") {
      const col = await College.findOne({ userId: user._id }).select("collegeLogo collegeName");
      if (col) {
        collegeLogo = col.collegeLogo || null;
        collegeName = col.collegeName || null;
      }
    }

    return res.status(200).json({
      status: true,
      message: "Login successfully",
      data: {
        accountStatus: "active",
        token,
        user: {
          _id: user._id,
          name: companyName || collegeName || user.name,
          phone: user.phone,
          email: user.email,
          role: user.role, // Sends the correct role back to React
          companyLogo,
          collegeLogo,
          companyName,
          collegeName,
          accountStatus: "active",
          profile_pic: userDetails?.profile_pic
        }
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

/**
 * Toggles user account status between active and inActive.
 * Supports:
 * 1) Authenticated request via Bearer token (when user is logged in, e.g., from Profile / Settings).
 * 2) Unauthenticated request via credentials in body (phone/email + password)
 *    so deactivated users who are logged out can reactivate their account.
 */
export const toggleAccountStatus = async (req, res) => {
  try {
    let user = null;

    // 1. Check if token was provided in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        if (process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          user = await User.findById(decoded.id);
        }
      } catch {
        // Token invalid or expired; proceed to check body credentials
      }
    }

    // 2. If not authenticated via token, check credentials from body
    if (!user) {
      const { phone, email, password } = req.body;
      const identifier = phone || email;

      if (!identifier || !password) {
        return res.status(400).json({
          status: false,
          message: "Please provide either an authorization token or credentials (phone/email and password).",
        });
      }

      user = await User.findOne({
        $or: [
          { phone: identifier.trim() },
          { email: identifier.toLowerCase().trim() },
        ],
      });

      if (!user) {
        return res.status(404).json({
          status: false,
          message: "User not found",
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          status: false,
          message: "Invalid password",
        });
      }
    }

    // 3. Toggle account active/inactive state
    user.is_active = !user.is_active;

    // If account was activated, clear deactivation metadata; if deactivated, clear FCM token
    if (user.is_active) {
      user.deactivation_reason = null;
      user.deactivated_at = null;
    } else {
      user.fcm_token = null;
    }

    await user.save();

    const accountStatus = user.is_active ? "active" : "inActive";

    return res.status(200).json({
      status: true,
      message: `Account ${user.is_active ? "activated" : "deactivated"} successfully`,
      data: {
        accountStatus,
        userId: user._id,
      },
    });
  } catch (error) {
    console.error("Toggle account status error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error toggling account status",
      error: error.message,
    });
  }
};

/**
 * Deactivates the authenticated user's account with an explicit reason.
 * Requires { reason } in request body.
 * Sets is_active = false, records deactivation_reason & deactivated_at timestamp,
 * and clears fcm_token so push notifications are paused.
 */
export const deactivateAccount = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: false,
        message: "Deactivation reason is required",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    user.is_active = false;
    user.deactivation_reason = reason.trim();
    user.deactivated_at = new Date();
    user.fcm_token = null;

    await user.save();

    return res.status(200).json({
      status: true,
      message: "Account deactivated successfully",
      data: {
        accountStatus: "inActive",
        userId: user._id,
        reason: user.deactivation_reason,
        deactivatedAt: user.deactivated_at,
      },
    });
  } catch (error) {
    console.error("Deactivate account error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error deactivating account",
      error: error.message,
    });
  }
};



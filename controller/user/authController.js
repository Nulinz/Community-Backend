import User from "../../models/userModel.js"
import jwt from "jsonwebtoken";
import UserDetails from "../../models/userDetails.js";

export const loginUser = async (req, res) => {
  try {
    const { phone, password, fcm_token } = req.body;

    // 🔹 1. Validate input
    if (!phone || !password) {
      return res.status(400).json({
        message: "Phone and password are required",
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

    // 🔹 3. Check user active
    if (!user.register_status==="pending") {
          // 🔹 Generate 4-digit OTP
 

      return res.status(400).json({
        status: false,
        message: "Your Account is deactive",
        pending:(user.register_status==="completed" )? false : true, // 👈 key logic
        register_status:user.register_status
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



      if (user.register_status==="pending") {
           const otp = Math.floor(1000 + Math.random() * 9000).toString();
           const otp_expire = new Date(Date.now() + 5 * 60 * 1000);
           user.otp = otp;
           user.otp_expire = otp_expire;
           await user.save();
      return res.status(200).json({
        status: false,
        message: "registraction pending",
        data:{
          details_comp:(user.register_status==="completed" )? true : false,
          register_status:user.register_status,
          otp,
          otp_expire
        }
      });
    }

    // 🔹 5. Update FCM token (optional)
    if (fcm_token) {
      user.fcm_token = fcm_token;
      await user.save();
    }

    // 🔹 6. Check UserDetails exists

    // 🔹 7. Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        phone: user.phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 🔹 8. Response
    return res.status(200).json({
      status: true,
      data:{
        details_comp:(userDetails && user.register_status==="completed" )? true : false, // 👈 key logic
        register_status: user.register_status,
        token,
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
        },
      },
      message:"Login successfully"
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
    // 🔹 Validate
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        status:false,
        message: "All fields are required",
      });
    }
    // 🔹 Check existing (single query)
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ status:false, message: "Email Id already exists" });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ status:false, message: "Mobile Number already exists" });
      }
    }

    // 🔹 Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 🔹 Expiry (5 minutes)
    const otp_expire = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      otp,
      otp_expire,
    });
    return res.status(200).json({
       status:true,
       message: "User registered. OTP generated",
       data:{
        user_id: user._id,
        pending:true,
        otp_expire,
        otp, // ⚠️ remove this in production (only for testing)
      }
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
         status:false,
        message: `${field} already exists`,
      });
    }

    return res.status(500).json({
      status:false,
      message: "Server error",
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, fcm_token } = req.body;

    // 🔹 1. Validate input
    if (!phone || !otp) {
      return res.status(400).json({
         status:false,
        message: "Phone and OTP are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
         status:false,
        message: "Invaild user",
      });
    }

    // 🔹 3. Check OTP match
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({
         status:false,
        message: "OTP is incorrect",
      });
    }

    // 🔹 4. Check OTP expiry
    if (!user.otp_expire || user.otp_expire < new Date()) {
      return res.status(400).json({
         status:false,
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

    // 🔹 6. Generate JWT token
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      status:true,
      message: "OTP verified successfully",
      token,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        register_status: user.register_status,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
      status:false,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
         status:false,
        message: "Phone is required",
      });
    }

    // 🔹 Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status:false,
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

    return res.json({
      status:true,
      message: "Forgot password OTP sent",
      data:{
        otp,otp_expire
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
       status:false,
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
         status:false,
        message: "Phone and OTP are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
         status:false,
        message: "User not found",
      });
    }

    // 🔹 3. Check OTP match
    if (!user.forgot_otp || user.forgot_otp !== otp) {
      return res.status(400).json({
         status:false,
        message: "Invalid OTP",
      });
    }

    // 🔹 4. Check expiry
    if (
      !user.forgot_otp_expire ||
      user.forgot_otp_expire < new Date()
    ) {
      return res.status(400).json({
         status:false,
        message: "OTP expired",
      });
    }

    // 🔹 5. Update status only (no password change here)
    user.forgot_status = "otp_verified";

    await user.save();

    return res.json({
       status:true,
      message: "OTP verified successfully",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
       status:false,
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
         status:false,
        message: "Phone and new password are required",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
         status:false,
        message: "User not found",
      });
    }

    // 🔹 3. (IMPORTANT) Check if allowed to reset
    if (user.forgot_status !== "otp_verified") {
      return res.status(400).json({
         status:false,
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
       status:true,
      message: "Password reset successful",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
       status:false,
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
         status:false,
        message: "Phone and type are required",
      });
    }

    if (!["register", "forgot"].includes(type)) {

      return res.status(400).json({
       status:false,
        message: "Invalid type",
      });
    }

    // 🔹 2. Find user
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
         status:false,
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
           status:false,
          message: "User already registered",
        });
      }

      user.otp = otp;
      user.otp_expire = otp_expire;
    }

    if (type === "forgot") {
      user.forgot_otp = otp;
      user.forgot_otp_expire = otp_expire;
      user.forgot_status = "otp_pending";
    }

    await user.save();

    return res.status(200).json({
      status:true,
      message: "OTP resent successfully",
      otp, 
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error",
       status:false,
    });
  }
};
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    let userDetails = null;
    let details_comp = false;

    // 🔹 Fetch details only for role = user
    if (user.role === "user") {
      userDetails = await UserDetails.findOne({
        userId: user._id,
      });
      details_comp = (userDetails && user.register_status==="completed") ? true : false;
    }
    return res.status(200).json({
      status: true,
      message: "User fetched successfully",
      data: {
        details_comp,
        user: {
          _id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          register_status:user.register_status
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


import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();
const sanitizeInput = (value) =>
    typeof value === "string" ? value.trim() : "";

const generateToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });




export const registerUser = async (req, res, next) => {
    try {
        const name = sanitizeInput(req.body.name);
        const email = sanitizeInput(req.body.email).toLowerCase();
        const password = sanitizeInput(req.body.password);
        const phone = sanitizeInput(req.body.phone);

        if (!name) {
            const error = new Error("Name is required");
            error.status = 400;
            throw error;
        }

        if (!email) {
            const error = new Error("Email is required");
            error.status = 400;
            throw error;
        }

        if (!password) {
            const error = new Error("Password is required");
            error.status = 400;
            throw error;
        }

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        const existingUser = await User.findOne({ email });
        const existingPhone = await User.findOne({ phone });

        if (existingUser) {
            const error = new Error("User already exists with this email");
            error.status = 409;
            throw error;
        }

        if (existingPhone) {
            const error = new Error("User already exists with this phone number");
            error.status = 409;
            throw error;
        }

        const user = await User.create({
            name,
            email,
            password,
            phone,
        });

        const otp = generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpStatus = "otp generated";

        await user.save();

        res.status(200).json({
            success: true,
            message: "User registered successfully",
            otp,
            otpExpiresAt,
            otpStatus: user.otpStatus,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
            },
        });
    } catch (error) {
        next(error);
    }
};


export const loginUser = async (req, res, next) => {
    try {
        const email = sanitizeInput(req.body.email).toLowerCase();
        const phone = sanitizeInput(req.body.phone);
        const password = sanitizeInput(req.body.password);
        const fcmToken = sanitizeInput(req.body.fcmToken);

        if (!email && !phone) {
            const error = new Error("Email or phone is required");
            error.status = 400;
            throw error;
        }

        if (!password) {
            const error = new Error("Password is required");
            error.status = 400;
            throw error;
        }

        const user = await User.findOne(email ? { email } : { phone }).select(
            "+password"
        );

        if (!user) {
            const error = new Error("Invalid email/phone or password");
            error.status = 401;
            throw error;
        }

        const isPasswordMatched = await user.comparePassword(password);

        if (!isPasswordMatched) {
            const error = new Error("Invalid email/phone or password");
            error.status = 401;
            throw error;
        }

        if (user.isActive === false) {
            const error = new Error("Your account has been deactivated. Please contact support.");
            error.status = 403;
            throw error;
        }

        if (!process.env.JWT_SECRET) {
            const error = new Error("JWT_SECRET is not configured");
            error.status = 500;
            throw error;
        }

        if (!fcmToken) {
            const error = new Error("fcmToken is required");
            error.status = 400;
            throw error;
        }

        user.fcmToken = fcmToken;
        await user.save();

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const forgotPassword = async (req, res, next) => {
    try {
        const phone = sanitizeInput(req.body.phone);

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        const user = await User.findOne({ phone });

        if (!user) {
            const error = new Error("User not found with this phone number");
            error.status = 404;
            throw error;
        }

        const otp = generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpStatus = "otp generated";

        await user.save();

        res.status(200).json({
            success: true,
            message: "OTP generated successfully",
            otp,
            otpExpiresAt,
            otpStatus: user.otpStatus,
        });
    } catch (error) {
        next(error);
    }
};


export const verifyOtp = async (req, res, next) => {
    try {
        const phone = sanitizeInput(req.body.phone);
        const otp = sanitizeInput(req.body.otp);
        const type = sanitizeInput(req.body.type).toLowerCase();
        const fcmToken = sanitizeInput(req.body.fcmToken);

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        if (!otp) {
            const error = new Error("OTP is required");
            error.status = 400;
            throw error;
        }

        const user = await User.findOne({ phone });

        if (!user) {
            const error = new Error("User not found with this phone number");
            error.status = 404;
            throw error;
        }

        if (user.otpStatus !== "otp generated") {
            const error = new Error("OTP is not available for verification");
            error.status = 400;
            throw error;
        }

        if (!user.otp || user.otp !== otp) {
            const error = new Error("Invalid OTP");
            error.status = 400;
            throw error;
        }

        if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
            user.otpStatus = "otp expired";
            await user.save();

            const error = new Error("OTP has expired");
            error.status = 400;
            throw error;
        }

        user.otpStatus = "otp verified";
        await user.save();

        const response = {
            success: true,
            message: "OTP verified successfully",
            otpStatus: user.otpStatus,
        };

        if (type === "register") {
            if (!process.env.JWT_SECRET) {
                const error = new Error("JWT_SECRET is not configured");
                error.status = 500;
                throw error;
            }

            if (!fcmToken) {
                const error = new Error("fcmToken is required");
                error.status = 400;
                throw error;
            }

            user.fcmToken = fcmToken;
            await user.save();

            response.token = generateToken(user._id);
        }

        res.status(200).json({
            ...response,
        });
    } catch (error) {
        next(error);
    }
};


export const createNewPassword = async (req, res, next) => {
    try {
        const phone = sanitizeInput(req.body.phone);
        const newPassword = sanitizeInput(req.body.newPassword);
        const confirmPassword = sanitizeInput(req.body.confirmPassword);

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        if (!newPassword) {
            const error = new Error("New password is required");
            error.status = 400;
            throw error;
        }

        if (!confirmPassword) {
            const error = new Error("Confirm password is required");
            error.status = 400;
            throw error;
        }

        if (newPassword !== confirmPassword) {
            const error = new Error("New password and confirm password do not match");
            error.status = 400;
            throw error;
        }

        const user = await User.findOne({ phone }).select("+password");

        if (!user) {
            const error = new Error("User not found with this phone number");
            error.status = 404;
            throw error;
        }

        if (user.otpStatus !== "otp verified") {
            const error = new Error("OTP is not verified");
            error.status = 400;
            throw error;
        }

        user.password = newPassword;
        user.otp = null;
        user.otpExpiresAt = null;
        user.otpStatus = "password updated";

        await user.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully",
            otpStatus: user.otpStatus,
        });
    } catch (error) {
        next(error);
    }
};


export const logoutUser = async (req, res, next) => {
    try {
        req.user.fcmToken = null;
        await req.user.save();

        res.status(200).json({
            success: true,
            message: "Logout successful",
        });
    } catch (error) {
        next(error);
    }
};






// website

export const createAdmin = async (req, res, next) => {
    try {
        const name = sanitizeInput(req.body.name);
        const email = sanitizeInput(req.body.email).toLowerCase();
        const password = sanitizeInput(req.body.password);
        const phone = sanitizeInput(req.body.phone);

        if (!name) {
            const error = new Error("Name is required");
            error.status = 400;
            throw error;
        }
  
        if (!email) {
            const error = new Error("Email is required");
            error.status = 400;
            throw error;
        }

        if (!password) {
            const error = new Error("Password is required");
            error.status = 400;
            throw error;
        }

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        const existingUser = await User.findOne({ email });
        const existingPhone = await User.findOne({ phone });

        if (existingUser) {
            const error = new Error("User already exists with this email");
            error.status = 409;
            throw error;
        }

        if (existingPhone) {
            const error = new Error("User already exists with this phone number");
            error.status = 409;
            throw error;
        }

        const role = sanitizeInput(req.body.role) || "admin";

        const admin = await User.create({
            name,
            email,
            password,
            phone,
            role,
        });

        res.status(201).json({
            success: true,
            message: "Admin created successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
            },
        });
    } catch (error) {
        next(error);
    }
};


// admin login
export const adminLogin = async (req, res, next) => {
    try {
        const phone = sanitizeInput(req.body.phone);
        const password = sanitizeInput(req.body.password);

        if (!phone) {
            const error = new Error("Phone is required");
            error.status = 400;
            throw error;
        }

        if (!password) {
            const error = new Error("Password is required");
            error.status = 400;
            throw error;
        }

        const admin = await User.findOne({ phone }).select("+password");


        if(!admin){
            const error = new Error("Invaild User");
            error.status = 500;
            throw error;
        }

// , role: "admin"

        // if (!admin) {
        //     const error = new Error("Only Admin can access");
        //     error.status = 401;
        //     throw error;
        // }

        const isPasswordMatched = await admin.comparePassword(password);

        if (!isPasswordMatched) {
            const error = new Error("Invalid password");
            error.status = 401;
            throw error;
        }

        if (!process.env.JWT_SECRET) {
            const error = new Error("JWT_SECRET is not configured");
            error.status = 500;
            throw error;
        }

        const token = generateToken(admin._id);

        res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
            },
        });
    } catch (error) {
        next(error);
    }
}


export const adminForgotPassword = async (req,res,next) =>{
    try {
        const phone =
            sanitizeInput(req.body.mobilenumber) ||
            sanitizeInput(req.body.mobileNumber) ||
            sanitizeInput(req.body.phone); 

        if (!phone) {
            const error = new Error("Mobile number is required");
            error.status = 400;
            throw error;
        }

        const admin = await User.findOne({ phone, role: "admin" });

        if (!admin) {
            const error = new Error("Admin not found with this mobile number");
            error.status = 404;
            throw error;
        }

        const otp = generateOtp();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        admin.otp = otp;
        admin.otpExpiresAt = otpExpiresAt;
        admin.otpStatus = "otp generated";

        await admin.save();

        res.status(200).json({
            success: true,
            message: "OTP generated successfully",
            otp,
            otpExpiresAt,
            otpStatus: admin.otpStatus,
        });
    } catch (error) {
        next(error);
    }
}


export const adminVerifyOtp = async (req,res,next) =>{
    try {
        const phone =
            sanitizeInput(req.body.mobilenumber) ||
            sanitizeInput(req.body.mobileNumber) ||
            sanitizeInput(req.body.phone);
        const otp = sanitizeInput(req.body.otp);

        if (!phone) {
            const error = new Error("Mobile number is required");
            error.status = 400;
            throw error;
        }

        if (!otp) {
            const error = new Error("OTP is required");
            error.status = 400;
            throw error;
        }

        const admin = await User.findOne({ phone, role: "admin" });

        if (!admin) {
            const error = new Error("Admin not found with this mobile number");
            error.status = 404;
            throw error;
        }

        if (admin.otpStatus !== "otp generated") {
            const error = new Error("OTP is not available for verification");
            error.status = 400;
            throw error;
        }

        if (!admin.otp || admin.otp !== otp) {
            const error = new Error("Invalid OTP");
            error.status = 400;
            throw error;
        }

        if (!admin.otpExpiresAt || admin.otpExpiresAt < new Date()) {
            admin.otpStatus = "otp expired";
            await admin.save();

            const error = new Error("OTP has expired");
            error.status = 400;
            throw error;
        }

        admin.otpStatus = "otp verified";
        await admin.save();

        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            otpStatus: admin.otpStatus,
        });
    } catch (error) {
        next(error);
    }
}

export const adminChangePassword = async (req,res,next) =>{
    try {
        const phone =
            sanitizeInput(req.body.mobilenumber) ||
            sanitizeInput(req.body.mobileNumber) ||
            sanitizeInput(req.body.phone);
        const newPassword = sanitizeInput(req.body.newPassword);
        const confirmPassword = sanitizeInput(req.body.confirmPassword);

        if (!phone) {
            const error = new Error("Mobile number is required");
            error.status = 400;
            throw error;
        }

        if (!newPassword) {
            const error = new Error("New password is required");
            error.status = 400;
            throw error;
        }

        if (!confirmPassword) {
            const error = new Error("Confirm password is required");
            error.status = 400;
            throw error;
        }

        if (newPassword !== confirmPassword) {
            const error = new Error("New password and confirm password do not match");
            error.status = 400;
            throw error;
        }

        const admin = await User.findOne({ phone, role: "admin" }).select("+password");

        if (!admin) {
            const error = new Error("Admin not found with this mobile number");
            error.status = 404;
            throw error;
        }

        if (admin.otpStatus !== "otp verified") {
            const error = new Error("OTP is not verified");
            error.status = 400;
            throw error;
        }

        admin.password = newPassword;
        admin.otp = null;
        admin.otpExpiresAt = null;
        admin.otpStatus = "password updated";

        await admin.save();

        res.status(200).json({
            success: true,
            message: "Admin password updated successfully",
            otpStatus: admin.otpStatus,
        });
    } catch (error) {
        next(error);
    }
}


export const adminLogout = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const getCurrentUser = async (req,res, next) =>{
    try{
        if (!req.user) {
            const error = new Error("User not authenticated");
            error.status = 401;
            throw error;
        }

        if (req.user.isActive === false) {
            const error = new Error("User account is inactive");
            error.status = 403;
            throw error;
        }

        res.status(200).json({
            success: true,
            message: "Current user fetched successfully",
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
                role: req.user.role,
                isActive: req.user.isActive,
            },
        });

    }
    catch(error){
        next(error);
    }
}

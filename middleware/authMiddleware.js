import jwt from "jsonwebtoken";

import User from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error = new Error("Authorization token is missing or invalid");
      error.status = 401;
      throw error;
    }

    if (!process.env.JWT_SECRET) {
      const error = new Error("JWT_SECRET is not configured");
      error.status = 500;
      throw error;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error("User not found");
      error.status = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      error.status = 401;
      error.message = "Invalid or expired token";
    }

    next(error);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const error = new Error(`Role (${req.user.role}) is not allowed to access this resource`);
      error.status = 403;
      return next(error);
    }
    next();
  };
};

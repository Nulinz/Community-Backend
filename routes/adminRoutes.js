import express from "express";

import { isAuthenticated } from "../middleware/authMiddleware.js";
import { adminDashBoard } from "../controller/adminController.js";

const router = express.Router();

router.get(
  "/dashboard",
  isAuthenticated,
  adminDashBoard
);

export default router;
import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { deleteModuleItem } from "../controller/commonController.js";

const router = express.Router();

/**
 * Universal deletion route serving all client modules (Events, Competitions,
 * Seminars, Conferences, Jobs, Internships, Freelance).
 * Enforces JWT authentication, role/ownership verification, cascade cleanup,
 * and media unlinking uniformly across all platform roles (Admin, College, Company).
 */
router.delete("/module/:moduleType/:id", isAuthenticated, deleteModuleItem);

export default router;

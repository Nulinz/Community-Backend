import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { 
    createInternshipForm, 
    getAllInternships, 
    getInternshipById,
    toggleInternshipStatus
} from "../controller/internshipController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createInternshipForm);
router.get("/all", isAuthenticated, getAllInternships);
router.get("/getById/:id", isAuthenticated, getInternshipById);
router.patch("/toggle-status/:id", isAuthenticated, toggleInternshipStatus);




export default router;

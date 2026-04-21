import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { 
    createFreelanceForm, 
    getAllFreelances, 
    getFreelanceById,
    toggleFreelanceStatus
} from "../controller/freelanceController.js";

const router = express.Router();

router.post("/create", isAuthenticated, createFreelanceForm);
router.get("/all", isAuthenticated, getAllFreelances);
router.get("/getById/:id", isAuthenticated, getFreelanceById);
router.patch("/toggle-status/:id", isAuthenticated, toggleFreelanceStatus);

export default router;

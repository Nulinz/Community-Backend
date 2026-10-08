import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { 
    createFreelanceForm, 
    getAllFreelances, 
    getFreelanceById,
    toggleFreelanceStatus
} from "../controller/freelanceController.js";
import { createUpload } from "../middleware/upload.js";

const router = express.Router();
const opportunityUpload = createUpload("opportunity");
const freelanceUploader = opportunityUpload.fields([{ name: "companyLogo", maxCount: 1 }]);

router.post("/create", isAuthenticated, freelanceUploader, createFreelanceForm);
router.put("/update/:id", isAuthenticated, freelanceUploader, createFreelanceForm);
router.get("/all", isAuthenticated, getAllFreelances);
router.get("/getById/:id", isAuthenticated, getFreelanceById);
router.patch("/toggle-status/:id", isAuthenticated, toggleFreelanceStatus);

export default router;

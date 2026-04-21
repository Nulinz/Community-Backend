import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createUpload } from "../middleware/upload.js";
import { createCollegeForm, getAllCollege, getCollegeById, toggleCollegeStatus, setPassword } from "../controller/collegeController.js";


const router = express.Router();
const collegeUpload = createUpload("college");

const uploader = collegeUpload.fields([
  { name: "collegeLogo", maxCount: 1 },
])


router.post("/create", isAuthenticated, uploader, createCollegeForm);
router.get("/all", isAuthenticated, getAllCollege);
router.get("/getById/:id", isAuthenticated, getCollegeById);
router.patch("/toggle-status/:id", isAuthenticated, toggleCollegeStatus);
router.post("/set-password", isAuthenticated, setPassword);


export default router;

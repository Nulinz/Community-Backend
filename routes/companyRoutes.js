import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createCompanyForm, getAllCompany, getCompanyById, addPost, setPassword, getMyCompany, toggleCompanyStatus, getCompanyNames } from "../controller/companyController.js";
import { createUpload } from "../middleware/upload.js";

const router = express.Router();
const companyUpload = createUpload("company");

const uploader = companyUpload.fields([
  { name: "companyLogo", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
])

router.post("/create", isAuthenticated, uploader, createCompanyForm);
router.get("/get-mine", isAuthenticated, getMyCompany);
router.get("/all", isAuthenticated, getAllCompany);
router.get("/names", isAuthenticated, getCompanyNames);
router.get("/getById/:id", isAuthenticated, getCompanyById);
router.post("/add-post/:id", isAuthenticated, companyUpload.array("images", 10), addPost);
router.post("/set-password", isAuthenticated, setPassword);
router.patch("/toggle-status/:id", isAuthenticated, toggleCompanyStatus);




export default router;

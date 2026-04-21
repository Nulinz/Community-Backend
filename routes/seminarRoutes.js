import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createUpload } from "../middleware/upload.js";
import { 
    createSeminarForm, 
    getAllSeminars, 
    getSeminarById,
    toggleSeminarStatus,
    addSeminarPosts
} from "../controller/seminarController.js";

const router = express.Router();
const seminarUpload = createUpload("seminar");

const uploader = seminarUpload.fields([
  { name: "coverImage", maxCount: 1 },
]);

const postsUploader = seminarUpload.fields([
    { name: "posts", maxCount: 10 }
]);

router.post("/create", isAuthenticated, uploader, createSeminarForm);
router.get("/all", getAllSeminars);
router.get("/getById/:id", getSeminarById);
router.patch("/toggle-status/:id", isAuthenticated, toggleSeminarStatus);
router.post("/add-posts/:id", isAuthenticated, postsUploader, addSeminarPosts);

export default router;

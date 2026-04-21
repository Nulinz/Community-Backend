import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createUpload } from "../middleware/upload.js";
import { 
    createCompetitionForm, 
    getAllCompetition, 
    getCompetitionById,
    toggleCompetitionStatus,
    addCompetitionPosts
} from "../controller/competitionController.js";

const router = express.Router();
const competitionUpload = createUpload("competition");

const uploader = competitionUpload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "ruleBook", maxCount: 1 },
]);

router.post("/create", isAuthenticated, uploader, createCompetitionForm);
router.get("/all", getAllCompetition);
router.get("/getById/:id", getCompetitionById);
router.patch("/toggle-status/:id", isAuthenticated, toggleCompetitionStatus);
router.post("/add-posts/:id", isAuthenticated, competitionUpload.array("posts", 10), addCompetitionPosts);

export default router;

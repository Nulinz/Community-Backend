import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createUpload } from "../middleware/upload.js";
import { 
    createConferenceForm, 
    getAllConference, 
    getConferenceById,
    toggleConferenceStatus,
    addConferencePosts
} from "../controller/conferenceController.js";

const router = express.Router();
const conferenceUpload = createUpload("conference");

const uploader = conferenceUpload.fields([
  { name: "coverImage", maxCount: 1 },
]);

router.post("/create", isAuthenticated, uploader, createConferenceForm);
router.get("/all", getAllConference);
router.get("/getById/:id", getConferenceById);
router.patch("/toggle-status/:id", isAuthenticated, toggleConferenceStatus);
router.post("/add-posts/:id", isAuthenticated, conferenceUpload.fields([{ name: "posts", maxCount: 10 }]), addConferencePosts);




export default router;
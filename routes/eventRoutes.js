import express from "express";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { createUpload } from "../middleware/upload.js";
import {
    createEventForm,
    getAllEvents,
    getEventById,
    toggleEventStatus,
    addEventPosts,
} from "../controller/eventController.js";

const router = express.Router();
const eventUpload = createUpload("event");

const uploader = eventUpload.fields([
  { name: "coverImage", maxCount: 1 },
]);

router.post("/create", isAuthenticated, uploader, createEventForm);
router.get("/all", getAllEvents);
router.get("/getById/:id", getEventById);
router.patch("/toggle-status/:id", isAuthenticated, toggleEventStatus);
router.post("/add-posts/:id", isAuthenticated, eventUpload.fields([{ name: "posts", maxCount: 10 }]), addEventPosts);

export default router;

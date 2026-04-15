import express from "express"
import multer from "multer"

import { isAuthenticated } from "../middleware/authMiddleware.js"
import {
  createUserDetails,
  getUserDetails,
  updateUserDetails,
} from "../controller/userDetailController.js"


const router = express.Router();
const uploader = multer();



router.post("/createUserDetails",isAuthenticated,uploader.none(),createUserDetails)
router.get("/getUserDetails",isAuthenticated,getUserDetails)
router.put("/updateUserDetails",isAuthenticated,uploader.none(),updateUserDetails)



export default router;

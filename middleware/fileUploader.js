import multer from "multer";
import path from "path";
import fs from "fs";

// Folder mapping
const folderMap = {
  profile_pic: "uploads/profile",
  resume: "uploads/resume",
  documents: "uploads/documents",
  default: "uploads/others",
};

// Ensure directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = folderMap[file.fieldname] || folderMap.default;
    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.fieldname + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const fileUploader = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export default fileUploader;
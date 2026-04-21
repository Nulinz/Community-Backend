import fs from "fs";
import path from "path";
import multer from "multer";

/**
 * Creates an instance of multer configured for a specific sub-directory.
 * @param {string} subDirectory - The folder within 'uploads/' where files should be saved.
 * @returns {import("multer").Multer} - Configured multer instance.
 */
export const createUpload = (subDirectory) => {
  const uploadDir = path.join(process.cwd(), "uploads", subDirectory);
  
  // Ensure the directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const safeExt = ext || ".jpg";
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e5)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${safeExt}`);
    },
  });

  const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ]);

  const fileFilter = (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Only JPG, JPEG, PNG, and WEBP image files are allowed");
      error.status = 400;
      cb(error);
      return;
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  });
};

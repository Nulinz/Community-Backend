import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import AppError from "../helper/appError.js";

// Core entity models
import Event from "../models/eventModel.js";
import Competition from "../models/competitionModel.js";
import Seminar from "../models/seminarModel.js";
import Conference from "../models/conferenceModel.js";
import Job from "../models/jobModel.js";
import Internship from "../models/internshipModel.js";
import Freelance from "../models/freelanceModel.js";
import Company from "../models/companyModel.js";
import College from "../models/collegeModel.js";

// Cascade relational models
import EventRegistration from "../models/eventRegistrationModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import SavedJob from "../models/savedJobModel.js";
import Attendance from "../models/attendanceModel.js";
import JobSuggested from "../models/jobSuggestedModel.js";
import CompanyFollow from "../models/companyFollowModel.js";

/**
 * Safely unlinks a file stored on the local filesystem.
 * Guards against directory traversal exploits by asserting that the target 
 * path resolves strictly inside the project root's uploads directory.
 * Ignores remote URLs (CDN/HTTP) and default static asset placeholders.
 */
const safeUnlink = (relativePath) => {
  if (!relativePath || typeof relativePath !== "string") return;

  // Skip external URLs and static referral placeholders
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) return;
  if (relativePath.includes("referral/") || relativePath.includes("public/")) return;

  const normalized = relativePath.replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return;

  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(process.cwd(), normalized);

  // Prevent path traversal attack
  if (!absolutePath.startsWith(uploadsRoot)) return;

  fs.unlink(absolutePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error(`[File Cleanup Error] Failed to delete ${absolutePath}:`, err.message);
    }
  });
};

/**
 * Cleans up media assets associated with an entity.
 * Handles both scalar paths (e.g. coverImage, companyLogo) and arrays (e.g. posts).
 */
const cleanupEntityFiles = (entity, fields = []) => {
  fields.forEach((field) => {
    const value = entity?.[field];
    if (Array.isArray(value)) {
      value.forEach((file) => safeUnlink(file));
    } else if (typeof value === "string") {
      safeUnlink(value);
    }
  });
};

/**
 * Centralized registry mapping module keys to their respective Mongoose model,
 * human-readable labels, file attachments, and cascading cleanup logic.
 * Encapsulates module-specific deletion rules inside a unified strategy pattern.
 */
const MODULE_REGISTRY = {
  event: {
    model: Event,
    displayName: "Event",
    category: "event",
    fileFields: ["coverImage", "signatureUrl", "posts"],
    cascade: async (id) => {
      await EventRegistration.deleteMany({ eventId: id });
    },
  },
  competition: {
    model: Competition,
    displayName: "Competition",
    category: "event",
    fileFields: ["coverImage", "signatureUrl", "posts"],
    cascade: async (id) => {
      await EventRegistration.deleteMany({ eventId: id });
    },
  },
  seminar: {
    model: Seminar,
    displayName: "Seminar",
    category: "event",
    fileFields: ["coverImage", "posts"],
    cascade: async (id) => {
      await EventRegistration.deleteMany({ eventId: id });
    },
  },
  conference: {
    model: Conference,
    displayName: "Conference",
    category: "event",
    fileFields: ["coverImage", "posts"],
    cascade: async (id) => {
      await EventRegistration.deleteMany({ eventId: id });
    },
  },
  job: {
    model: Job,
    displayName: "Job",
    category: "opportunity",
    fileFields: ["companyLogo"],
    cascade: async (id) => {
      await Promise.allSettled([
        AppliedJob.deleteMany({ jobId: id }),
        SavedJob.deleteMany({ jobId: id }),
        Attendance.deleteMany({ jobId: id }),
        JobSuggested.deleteMany({ jobId: id }),
      ]);
    },
  },
  internship: {
    model: Internship,
    displayName: "Internship",
    category: "opportunity",
    fileFields: ["companyLogo"],
    cascade: async (id) => {
      await Promise.allSettled([
        AppliedJob.deleteMany({ jobId: id }),
        SavedJob.deleteMany({ jobId: id }),
        Attendance.deleteMany({ jobId: id }),
        JobSuggested.deleteMany({ jobId: id }),
      ]);
    },
  },
  freelance: {
    model: Freelance,
    displayName: "Freelance",
    category: "opportunity",
    fileFields: ["companyLogo"],
    cascade: async (id) => {
      await Promise.allSettled([
        AppliedJob.deleteMany({ jobId: id }),
        SavedJob.deleteMany({ jobId: id }),
        Attendance.deleteMany({ jobId: id }),
        JobSuggested.deleteMany({ jobId: id }),
      ]);
    },
  },
  company: {
    model: Company,
    displayName: "Company",
    category: "organization",
    fileFields: ["companyLogo", "coverImage", "signatureUrl", "posts"],
    cascade: async (id) => {
      await Promise.allSettled([
        CompanyFollow.deleteMany({ companyId: id }),
      ]);
    },
  },
  college: {
    model: College,
    displayName: "College",
    category: "organization",
    fileFields: ["collegeLogo", "signatureUrl"],
    cascade: async (_id) => {
      // Reserved for college-specific cascading operations
    },
  },
};

/**
 * Normalizes user-supplied module type strings to canonical registry keys.
 * Accommodates plural and singular variations (e.g. "events" -> "event").
 */
const normalizeModuleType = (type = "") => {
  const clean = type.toLowerCase().trim();
  const aliasMap = {
    events: "event",
    event: "event",
    competitions: "competition",
    competition: "competition",
    seminars: "seminar",
    seminar: "seminar",
    conferences: "conference",
    conference: "conference",
    jobs: "job",
    job: "job",
    internships: "internship",
    internship: "internship",
    freelance: "freelance",
    freelances: "freelance",
    company: "company",
    companies: "company",
    college: "college",
    colleges: "college",
  };
  return aliasMap[clean] || null;
};

/**
 * Universal deletion handler for any registered entity (events, competitions, jobs, etc.).
 * Validates permissions: Super-admins may delete any record; creators (companies, colleges,
 * individuals) may only delete entities where item.c_by matches their authenticated user ID.
 * Cascades foreign references and securely removes associated uploads from disk.
 */
export const deleteModuleItem = async (req, res, next) => {
  try {
    const { moduleType, id } = req.params;

    // 1. Validate module type against the whitelist registry
    const canonicalKey = normalizeModuleType(moduleType);
    if (!canonicalKey || !MODULE_REGISTRY[canonicalKey]) {
      const allowed = Object.keys(MODULE_REGISTRY).join(", ");
      throw new AppError(
        `Invalid module type "${moduleType}". Allowed modules are: ${allowed}`,
        400
      );
    }

    // 2. Validate MongoDB ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid or malformed ID parameter", 400);
    }

    const config = MODULE_REGISTRY[canonicalKey];

    // 3. Locate target entity
    const item = await config.model.findById(id);
    if (!item) {
      throw new AppError(`${config.displayName} not found or has already been removed`, 404);
    }

    // 4. Role & Ownership Authorization
    // Admins have global deletion rights; other authenticated roles (company, college, user)
    // can only delete resources they authored (tracked via `c_by` or `userId`).
    const isAdmin = req.user?.role === "admin";
    const itemCreatorId = item.c_by?.toString();
    const itemUserId = item.userId?.toString();
    const currentUserId = req.user?._id?.toString();
    const isOwner = (itemCreatorId && itemCreatorId === currentUserId) || (itemUserId && itemUserId === currentUserId);

    if (!isAdmin && !isOwner) {
      throw new AppError(
        `You do not have permission to delete this ${config.displayName.toLowerCase()}`,
        403
      );
    }

    // 5. Cascade cleanup: remove orphaned registrations, applications, and logs
    if (typeof config.cascade === "function") {
      try {
        await config.cascade(item._id);
      } catch (cascadeError) {
        console.error(
          `[Cascade Cleanup Warning] Failed partial cascade for ${config.displayName} ${id}:`,
          cascadeError.message
        );
      }
    }

    // 6. Media cleanup: unlink files from disk
    cleanupEntityFiles(item, config.fileFields);

    // 7. Atomic hard-delete of the root document
    await config.model.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `${config.displayName} deleted successfully`,
      data: {
        id,
        moduleType: canonicalKey,
      },
    });
  } catch (error) {
    next(error);
  }
};

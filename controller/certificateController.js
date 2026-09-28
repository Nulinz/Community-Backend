import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import Certificate from "../models/certificateModel.js";
import User from "../models/userModel.js";
import Company from "../models/companyModel.js";
import College from "../models/collegeModel.js";
import Event from "../models/eventModel.js";
import Conference from "../models/conferenceModel.js";
import Competition from "../models/competitionModel.js";
import Seminar from "../models/seminarModel.js";
import { generateCertificatePDFBuffer } from "../services/pdfService.js";
import mongoose from "mongoose";

/**
 * Helper function to convert local image files to Base64 data URIs for Puppeteer PDF rendering.
 */
const getBase64Image = async (filePath) => {
  if (!filePath || typeof filePath !== "string") return "";
  try {
    if (filePath.startsWith("data:")) return filePath;

    // Convert local /uploads/... URLs and relative paths directly to disk paths
    let localRelativePath = null;
    if (filePath.includes("/uploads/")) {
      localRelativePath = filePath.substring(filePath.indexOf("/uploads/") + 1);
    } else if (!filePath.startsWith("http://") && !filePath.startsWith("https://")) {
      localRelativePath = filePath.replace(/^\//, "");
    }

    if (localRelativePath) {
      const cleanPath = path.resolve(process.cwd(), localRelativePath);
      const imageBuffer = await fs.readFile(cleanPath);
      const ext = path.extname(cleanPath).toLowerCase().replace(".", "");
      const mimeType = ext === "svg" ? "image/svg+xml" : `image/${ext || "png"}`;
      return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    }

    return filePath;
  } catch (err) {
    return "";
  }
};

/**
 * POST /api/certificates/generate
 * Generates PDF certificate, uploads to local storage, saves DB record, and returns file URL.
 * Handles validation defensively to prevent uncaught runtime errors and 500 status crashes.
 */
export const generateCertificate = async (req, res, next) => {
  try {
    const {
      userId,
      name,
      domain,
      domains,
      course,
      companyName,
      companyId,
      issuedDate,
      recipientEmail,
      eventId,
      eventType,
      conferenceId,
      competitionId,
      seminarId,
      itemId,
      signatoryName,
      signatoryDesignation,
      signatureUrl,
      signature,
      customContentBody: bodyCustomContent,
      certificateContentBody: bodyCertContent,
      companyLogo: bodyCompanyLogo,
    } = req.body || {};

    // Safely resolve the internship / event domain from all possible payload variations
    const internshipDomain =
      (typeof domain === "string" && domain.trim()) ||
      (Array.isArray(domains) ? domains.filter(Boolean).join(", ") : (typeof domains === "string" ? domains.trim() : "")) ||
      (typeof course === "string" && course.trim()) ||
      "";

    if (!name || typeof name !== "string" || !name.trim() || !internshipDomain) {
      return res.status(400).json({
        success: false,
        message: "Recipient name and internship domain are required fields."
      });
    }

    // Resolve target userId (from payload or lookup via recipientEmail)
    let targetUserId = userId || req.body?.candidateId || req.body?.applicantId || null;
    const cleanEmail = typeof recipientEmail === "string" && recipientEmail.trim()
      ? recipientEmail.trim().toLowerCase()
      : "";

    if (!targetUserId && cleanEmail) {
      const recipientUser = await User.findOne({ email: cleanEmail }).select("_id").lean();
      if (recipientUser) {
        targetUserId = recipientUser._id;
      }
    }

    const safeUserId = targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;

    // 1. Resolve Event/Conference/Competition/Seminar document if an ID was provided
    let itemRecord = null;
    const targetItemId = eventId || conferenceId || competitionId || seminarId || itemId || req.body?.event_id;
    const normalizedType = String(eventType || "").toLowerCase();

    if (targetItemId && mongoose.Types.ObjectId.isValid(targetItemId)) {
      if (normalizedType.includes("conference") || conferenceId) {
        itemRecord = await Conference.findById(targetItemId).lean();
      } else if (normalizedType.includes("competition") || competitionId) {
        itemRecord = await Competition.findById(targetItemId).lean();
      } else if (normalizedType.includes("seminar") || seminarId) {
        itemRecord = await Seminar.findById(targetItemId).lean();
      } else if (normalizedType.includes("event") || eventId) {
        itemRecord = await Event.findById(targetItemId).lean();
      }

      // If not yet resolved by specific type, query collections
      if (!itemRecord) {
        itemRecord =
          (await Event.findById(targetItemId).lean()) ||
          (await Conference.findById(targetItemId).lean()) ||
          (await Competition.findById(targetItemId).lean()) ||
          (await Seminar.findById(targetItemId).lean());
      }
    }

    // 2. Fetch Company or College profile details (for global fallback)
    let companyRecord = null;
    const creatorId = itemRecord?.c_by || null;

    if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
      companyRecord = (await Company.findById(companyId).lean()) || (await College.findById(companyId).lean());
    } else if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) {
      companyRecord =
        (await Company.findOne({ $or: [{ userId: creatorId }, { c_by: creatorId }, { _id: creatorId }] }).lean()) ||
        (await College.findOne({ $or: [{ userId: creatorId }, { c_by: creatorId }, { _id: creatorId }] }).lean());
    }

    if (!companyRecord && req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
      companyRecord =
        (await Company.findOne({ $or: [{ userId: req.user._id }, { c_by: req.user._id }] }).lean()) ||
        (await College.findOne({ $or: [{ userId: req.user._id }, { c_by: req.user._id }] }).lean());
    }

    const rawSearchName = (companyName || itemRecord?.organizer || "").trim();
    if (!companyRecord && rawSearchName) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const namePattern = new RegExp(`^${escapeRegex(rawSearchName)}$`, "i");
      companyRecord =
        (await Company.findOne({ companyName: namePattern }).lean()) ||
        (await College.findOne({ collegeName: namePattern }).lean());
    }

    let company = itemRecord?.organizer || companyRecord?.companyName || companyRecord?.collegeName || companyName || "Nulinz Community";

    // 3. Resolve Signatory, Signature, and Content Body (Priority: Direct Payload > Item-specific > Profile-level > Default)
    const finalSignatoryName = signatoryName || itemRecord?.signatoryName || companyRecord?.signatoryName || "";
    const finalSignatoryDesignation = signatoryDesignation || itemRecord?.signatoryDesignation || companyRecord?.signatoryDesignation || "";
    const finalSignatureUrl = signatureUrl || signature || itemRecord?.signatureUrl || companyRecord?.signatureUrl || "";

    const logoFile = bodyCompanyLogo || companyRecord?.companyLogo || companyRecord?.collegeLogo || itemRecord?.coverImage || "";
    const companyLogoDataUri = logoFile ? await getBase64Image(logoFile) : "";
    const signatureImgDataUri = finalSignatureUrl ? await getBase64Image(finalSignatureUrl) : "";
    const gradenvyLogoDataUri = await getBase64Image("templates/gradenvyLogo.png");

    let customContentBody = bodyCustomContent || bodyCertContent || itemRecord?.certificateContentBody || companyRecord?.certificateContentBody || "";
    if (customContentBody) {
      customContentBody = customContentBody
        .replace(/\{\{\s*domain\s*\}\}/gi, internshipDomain)
        .replace(/\{\s*domain\s*\}/gi, internshipDomain)
        .replace(/\{\{\s*name\s*\}\}/gi, name.trim())
        .replace(/\{\s*name\s*\}/gi, name.trim());

      if (!customContentBody.toLowerCase().includes(internshipDomain.toLowerCase())) {
        customContentBody = `${customContentBody}<br /><span class="course-title">${internshipDomain}</span>`;
      }
    }

    // 3.5 Validate required fields specifically in college context
    const isCollegeContext = req.user?.role === "college" || Boolean(companyRecord?.collegeName);
    if (isCollegeContext) {
      const missingCertFields = [];
      if (!finalSignatoryName || !finalSignatoryName.trim()) {
        missingCertFields.push("Authorized Signatory Name");
      }
      if (!finalSignatoryDesignation || !finalSignatoryDesignation.trim()) {
        missingCertFields.push("Signatory Designation");
      }
      if (!finalSignatureUrl || !finalSignatureUrl.trim()) {
        missingCertFields.push("Signature");
      }
      if (!customContentBody || !customContentBody.trim()) {
        missingCertFields.push("Certificate Body");
      }

      if (missingCertFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Please fill in the required certificate field(s) in College Certificate Settings first: ${missingCertFields.join(", ")} and try again.`,
          missingFields: missingCertFields
        });
      }
    }

    // Fallbacks for non-college entities or standard certificates
    const resolvedSignatoryName = finalSignatoryName || company || "Authorized Signatory";
    const resolvedSignatoryDesignation = finalSignatoryDesignation || "";
    if (!customContentBody || !customContentBody.trim()) {
      customContentBody = `has successfully completed the program in<br /><span class="course-title">${internshipDomain}</span>`;
    }

    // Generate unique Certificate ID (e.g. CERT-A8F92B10)
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const certificateId = `CERT-${randomHex}`;

    const validDate = issuedDate && !isNaN(new Date(issuedDate).getTime())
      ? new Date(issuedDate)
      : new Date();
    const formattedDate = validDate.toLocaleDateString("en-GB");

    // 4. Generate PDF Buffer via Puppeteer service
    const pdfBuffer = await generateCertificatePDFBuffer({
      name: name.trim(),
      domain: internshipDomain,
      companyName: company,
      companyLogo: companyLogoDataUri,
      gradenvyLogo: gradenvyLogoDataUri,
      signatureImg: signatureImgDataUri,
      signatoryName: resolvedSignatoryName,
      signatoryDesignation: resolvedSignatoryDesignation,
      customContentBody: customContentBody,
      issuedDate: formattedDate,
      certificateId
    });

    // 5. Define upload destination
    const fileName = `${certificateId}.pdf`;
    const uploadsDir = path.resolve(process.cwd(), "uploads", "certificates");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    // 6. Construct relative accessible URL
    const fileUrl = `/uploads/certificates/${fileName}`;

    const safeCreatedBy = req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)
      ? req.user._id
      : null;

    const safeEventId = itemRecord?._id || (targetItemId && mongoose.Types.ObjectId.isValid(targetItemId) ? new mongoose.Types.ObjectId(targetItemId) : null);

    // 7. Save to MongoDB
    const certificateRecord = await Certificate.create({
      certificateId,
      userId: safeUserId,
      createdBy: safeCreatedBy,
      eventId: safeEventId,
      eventType: eventType || (itemRecord?.eventName ? "Event" : null),
      signatoryName: resolvedSignatoryName,
      signatoryDesignation: resolvedSignatoryDesignation,
      name: name.trim(),
      domain: internshipDomain,
      companyName: company,
      issuedDate: validDate,
      fileUrl,
      filePath,
      recipientEmail: cleanEmail,
      verified: true
    });

    return res.status(201).json({
      success: true,
      message: "Certificate generated successfully",
      data: {
        certificateId: certificateRecord.certificateId,
        userId: certificateRecord.userId,
        name: certificateRecord.name,
        domain: certificateRecord.domain,
        companyName: certificateRecord.companyName,
        issuedDate: certificateRecord.issuedDate,
        fileUrl: certificateRecord.fileUrl,
        verified: certificateRecord.verified,
        createdAt: certificateRecord.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/certificates/verify/:certificateId
 * Public endpoint to verify certificate authenticity.
 */
export const verifyCertificate = async (req, res, next) => {
  try {
    const { certificateId } = req.params;

    const record = await Certificate.findOne({ certificateId });

    if (!record) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Certificate not found or invalid."
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      data: {
        certificateId: record.certificateId,
        name: record.name,
        domain: record.domain,
        companyName: record.companyName,
        issuedDate: record.issuedDate,
        fileUrl: record.fileUrl,
        verified: record.verified,
        createdAt: record.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/certificates/download/:certificateId
 * Downloads or streams the PDF file directly.
 */
export const downloadCertificate = async (req, res, next) => {
  try {
    const { certificateId } = req.params;

    const record = await Certificate.findOne({ certificateId });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Certificate record not found."
      });
    }

    const absolutePath = path.resolve(record.filePath);

    // Verify file existence on disk
    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: "Certificate PDF file does not exist on disk."
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Certificate-${certificateId}.pdf"`
    );

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/certificates/user/:userId
 * Fetch all certificates belonging to a specific user or email.
 */
export const getUserCertificates = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID parameter is required"
      });
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(userId);
    const orConditions = [
      { recipientEmail: userId }
    ];

    if (isObjectId) {
      const objId = new mongoose.Types.ObjectId(userId);
      orConditions.push({ userId: objId }, { createdBy: objId });
    }

    const certificates = await Certificate.find({ $or: orConditions }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });
  } catch (error) {
    next(error);
  }
};

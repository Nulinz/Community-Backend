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
  if (!filePath) return "";
  try {
    const cleanPath = filePath.startsWith("http") || filePath.startsWith("data:")
      ? null
      : path.resolve(process.cwd(), filePath.replace(/^\//, ""));

    if (!cleanPath) return filePath; // Already a URL or base64
    const imageBuffer = await fs.readFile(cleanPath);
    const ext = path.extname(cleanPath).toLowerCase().replace(".", "");
    const mimeType = ext === "svg" ? "image/svg+xml" : `image/${ext || "png"}`;
    return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  } catch (err) {
    return "";
  }
};

/**
 * POST /api/certificates/generate
 * Generates PDF certificate, uploads to local storage, saves DB record, and returns file URL.
 */
export const generateCertificate = async (req, res, next) => {
  try {
    const {
      userId,
      name,
      domain,
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
    } = req.body;

    const internshipDomain = domain || course;
    let company = companyName || "Nulinz Community";

    if (!name || !internshipDomain) {
      return res.status(400).json({
        success: false,
        message: "Recipient name and internship domain are required fields."
      });
    }

    // Resolve target userId (from payload or lookup via recipientEmail)
    let targetUserId = userId || req.body.candidateId || req.body.applicantId || null;
    if (!targetUserId && recipientEmail) {
      const recipientUser = await User.findOne({ email: recipientEmail.trim().toLowerCase() }).select("_id").lean();
      if (recipientUser) {
        targetUserId = recipientUser._id;
      }
    }

    // 1. Resolve Event/Conference/Competition/Seminar document if an ID was provided
    let itemRecord = null;
    const targetItemId = eventId || conferenceId || competitionId || seminarId || itemId || req.body.event_id;
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

    if (companyId) {
      companyRecord = (await Company.findById(companyId).lean()) || (await College.findById(companyId).lean());
    } else if (creatorId) {
      companyRecord =
        (await Company.findOne({ $or: [{ userId: creatorId }, { c_by: creatorId }, { _id: creatorId }] }).lean()) ||
        (await College.findOne({ $or: [{ userId: creatorId }, { c_by: creatorId }, { _id: creatorId }] }).lean());
    }

    if (!companyRecord && req.user?._id) {
      companyRecord = (await Company.findOne({
        $or: [{ userId: req.user._id }, { c_by: req.user._id }]
      }).lean()) || (await College.findOne({
        $or: [{ userId: req.user._id }, { c_by: req.user._id }]
      }).lean());
    }

    if (!companyRecord && (companyName || itemRecord?.organizer)) {
      const searchName = companyName || itemRecord?.organizer;
      companyRecord = (await Company.findOne({
        companyName: new RegExp(`^${searchName.trim()}$`, "i")
      }).lean()) || (await College.findOne({
        collegeName: new RegExp(`^${searchName.trim()}$`, "i")
      }).lean());
    }

    if (itemRecord?.organizer || companyRecord?.companyName || companyRecord?.collegeName) {
      company = itemRecord?.organizer || companyRecord?.companyName || companyRecord?.collegeName || company;
    }

    // 3. Resolve Signatory, Signature, and Content Body (Priority: Item-specific > Profile-level > Default)
    const finalSignatoryName = itemRecord?.signatoryName || companyRecord?.signatoryName || "";
    const finalSignatoryDesignation = itemRecord?.signatoryDesignation || companyRecord?.signatoryDesignation || "";
    const finalSignatureUrl = itemRecord?.signatureUrl || companyRecord?.signatureUrl || "";

    const logoFile = companyRecord?.companyLogo || companyRecord?.collegeLogo || itemRecord?.coverImage || "";
    const companyLogoDataUri = logoFile ? await getBase64Image(logoFile) : "";
    const signatureImgDataUri = finalSignatureUrl ? await getBase64Image(finalSignatureUrl) : "";
    const gradenvyLogoDataUri = await getBase64Image("templates/gradenvyLogo.png");

    let customContentBody = itemRecord?.certificateContentBody || companyRecord?.certificateContentBody || "";
    if (customContentBody) {
      customContentBody = customContentBody
        .replace(/\{\{\s*domain\s*\}\}/gi, internshipDomain)
        .replace(/\{\s*domain\s*\}/gi, internshipDomain)
        .replace(/\{\{\s*name\s*\}\}/gi, name)
        .replace(/\{\s*name\s*\}/gi, name);

      if (!customContentBody.toLowerCase().includes(internshipDomain.toLowerCase())) {
        customContentBody = `${customContentBody}<br /><span class="course-title">${internshipDomain}</span>`;
      }
    }

    // Generate unique Certificate ID (e.g. CERT-A8F92B10)
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const certificateId = `CERT-${randomHex}`;

    const formattedDate = issuedDate
      ? new Date(issuedDate).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // 4. Generate PDF Buffer via Puppeteer service
    const pdfBuffer = await generateCertificatePDFBuffer({
      name,
      domain: internshipDomain,
      companyName: company,
      companyLogo: companyLogoDataUri,
      gradenvyLogo: gradenvyLogoDataUri,
      signatureImg: signatureImgDataUri,
      signatoryName: finalSignatoryName,
      signatoryDesignation: finalSignatoryDesignation,
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

    // 7. Save to MongoDB
    const certificateRecord = await Certificate.create({
      certificateId,
      userId: targetUserId,
      createdBy: req.user?._id || null,
      eventId: itemRecord?._id || (targetItemId && mongoose.Types.ObjectId.isValid(targetItemId) ? targetItemId : null),
      eventType: eventType || (itemRecord?.eventName ? "Event" : null),
      signatoryName: finalSignatoryName,
      signatoryDesignation: finalSignatoryDesignation,
      name,
      domain: internshipDomain,
      companyName: company,
      issuedDate: issuedDate ? new Date(issuedDate) : new Date(),
      fileUrl,
      filePath,
      recipientEmail,
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

    const query = {
      $or: [
        { userId: userId },
        { recipientEmail: userId },
        { createdBy: userId }
      ]
    };

    // If userId is a valid MongoDB ObjectId hex string, add ObjectId matches
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const objId = new mongoose.Types.ObjectId(userId);
      query.$or.push({ userId: objId }, { createdBy: objId });
    }

    const certificates = await Certificate.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });
  } catch (error) {
    next(error);
  }
};

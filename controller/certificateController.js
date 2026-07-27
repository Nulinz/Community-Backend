import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import Certificate from "../models/certificateModel.js";
import User from "../models/userModel.js";
import Company from "../models/companyModel.js";
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
    const { userId, name, domain, course, companyName, companyId, issuedDate, recipientEmail } = req.body;
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

    // Fetch Company profile details (Logo, Signature, Signatory details, Custom Content)
    let companyRecord = null;
    if (companyId) {
      companyRecord = await Company.findById(companyId).lean();
    } else if (req.user?._id) {
      companyRecord = await Company.findOne({
        $or: [{ userId: req.user._id }, { c_by: req.user._id }]
      }).lean();
    }
    if (!companyRecord && companyName) {
      companyRecord = await Company.findOne({
        companyName: new RegExp(`^${companyName.trim()}$`, "i")
      }).lean();
    }

    if (companyRecord?.companyName) {
      company = companyRecord.companyName;
    }

    const companyLogoDataUri = companyRecord?.companyLogo ? await getBase64Image(companyRecord.companyLogo) : "";
    const signatureImgDataUri = companyRecord?.signatureUrl ? await getBase64Image(companyRecord.signatureUrl) : "";
    const gradenvyLogoDataUri = await getBase64Image("templates/gradenvyLogo.png");

    // Generate unique Certificate ID (e.g. CERT-A8F92B10)
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const certificateId = `CERT-${randomHex}`;

    const formattedDate = issuedDate
      ? new Date(issuedDate).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // 1. Generate PDF Buffer via Puppeteer service
    const pdfBuffer = await generateCertificatePDFBuffer({
      name,
      domain: internshipDomain,
      companyName: company,
      companyLogo: companyLogoDataUri,
      gradenvyLogo: gradenvyLogoDataUri,
      signatureImg: signatureImgDataUri,
      signatoryName: companyRecord?.signatoryName || "",
      signatoryDesignation: companyRecord?.signatoryDesignation || "",
      customContentBody: companyRecord?.certificateContentBody || "",
      issuedDate: formattedDate,
      certificateId
    });

    // 2. Define upload destination
    const fileName = `${certificateId}.pdf`;
    const uploadsDir = path.resolve(process.cwd(), "uploads", "certificates");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    // 3. Construct relative accessible URL
    const fileUrl = `/uploads/certificates/${fileName}`;

    // 4. Save to MongoDB
    const certificateRecord = await Certificate.create({
      certificateId,
      userId: targetUserId,
      createdBy: req.user?._id || null,
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

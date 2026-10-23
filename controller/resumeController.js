import path from "path";
import fs from "fs/promises";
import { RESUME_TEMPLATES } from "../config/resumeTemplates.js";
import { generateResumePDFBuffer, renderResumeHTML } from "../services/pdfService.js";
import UserDetails from "../models/userDetails.js";
import Resume from "../models/resumeModel.js";
import XPLog from "../models/xpLogModel.js";
import { triggerMissionNotification } from "../services/xpService.js";

const DUMMY_RESUME_DATA = {
  personalInfo: {
    fullName: "Alex Morgan",
    jobTitle: "Senior Software Engineer",
    email: "alex.morgan@email.com",
    phone: "(555) 234-9981",
    location: "San Francisco, CA",
    website: "alexmorgan.dev",
    linkedin: "linkedin.com/in/alexmorgan",
    github: "github.com/alexmorgan",
    summary: "Senior software engineer with 8+ years building reliable, high-scale web platforms. I turn ambiguous product goals into shipped features, mentor engineers, and care deeply about developer experience and clean, well-tested systems."
  },
  experience: [
    {
      jobTitle: "Senior Software Engineer",
      companyName: "Vertex Labs",
      location: "San Francisco, CA",
      startDate: "Mar 2021",
      endDate: "Present",
      description: "Led the rebuild of the billing platform serving 2.4M customers, cutting payment failures by 38% and reclaiming $4.1M in annual revenue.",
      highlights: [
        "Architected an event-driven services layer (Kafka + TypeScript) that reduced p95 checkout latency from 820ms to 190ms.",
        "Mentored 6 engineers; introduced a code-review playbook that lifted PR throughput 27% without raising defect rate."
      ]
    },
    {
      jobTitle: "Software Engineer",
      companyName: "Northwind Software",
      location: "Austin, TX",
      startDate: "Jun 2018",
      endDate: "Feb 2021",
      description: "Built the company's first design-system component library (React + Storybook), adopted by 9 product teams.",
      highlights: [
        "Shipped a real-time analytics dashboard handling 40k events/sec with sub-second refresh.",
        "Reduced CI pipeline time 64% by parallelizing test suites and adding intelligent caching."
      ]
    }
  ],
  education: [
    {
      degree: "B.S., Computer Science",
      institution: "University of California, Berkeley",
      location: "Berkeley, CA",
      startDate: "Aug 2012",
      endDate: "May 2016",
      grade: "3.8 GPA",
      details: "Distributed Systems · Machine Learning · Databases · Algorithms"
    }
  ],
  projects: [
    {
      title: "Pulse — Open-source observability",
      link: "github.com/alexmorgan/pulse",
      year: "2022 — Present",
      description: "A lightweight metrics + tracing toolkit for small teams. 3.2k GitHub stars, 40+ contributors.",
      technologies: ["Go", "OpenTelemetry", "React"]
    }
  ],
  skills: [
    { category: "Languages", items: ["TypeScript", "Go", "Python", "SQL", "Rust"] },
    { category: "Frontend", items: ["React", "Next.js", "Redux", "Tailwind", "Vite"] },
    { category: "Backend", items: ["Node.js", "PostgreSQL", "Kafka", "gRPC", "Redis"] },
    { category: "Cloud & DevOps", items: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"] }
  ],
  languages: [
    { name: "English", rating: 5 },
    { name: "Spanish", rating: 4 }
  ],
  certifications: [
    { title: "AWS Certified Solutions Architect — Professional", issuer: "Amazon Web Services", year: "2022" }
  ],
  awards: [
    { title: "Engineering Excellence Award", issuer: "Vertex Labs", year: "2023", description: "Top 2% of engineering org for impact and leadership." }
  ]
};

/**
 * Get all 7 available resume templates
 * GET /api/resume/templates
 */
export const getResumeTemplates = async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const templatesWithUrls = RESUME_TEMPLATES.map((tmpl) => {
      const pdfFileName = `${tmpl.id}.pdf`;

      return {
        ...tmpl,
        previewUrl: `/resume/${pdfFileName}`,
        previewPdfUrl: `${baseUrl}/resume/${pdfFileName}`,
        previewHtmlUrl: `${baseUrl}/api/resume/preview/${tmpl.id}`,
      };
    });

    return res.status(200).json({
      success: true,
      status: true,
      count: templatesWithUrls.length,
      data: templatesWithUrls,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview saved resume PDF template live in browser
 * Supports ?html=true query to return live compiled HTML directly
 * GET /api/resume/preview/:templateId
 */
export const previewResumeTemplate = async (req, res, next) => {
  try {
    const { templateId = 2 } = req.params;

    // Direct HTML preview bypass if query param is set
    if (req.query.html === "true") {
      const htmlContent = await renderResumeHTML(templateId, DUMMY_RESUME_DATA);
      res.setHeader("Content-Type", "text/html");
      return res.send(htmlContent);
    }

    const pdfFilePath = path.resolve(process.cwd(), "resume", `${templateId}.pdf`);

    try {
      await fs.access(pdfFilePath);
      res.setHeader("Content-Type", "application/pdf");
      return res.sendFile(pdfFilePath);
    } catch {
      // Fallback to HTML compiled view if PDF file is missing
      const htmlContent = await renderResumeHTML(templateId, DUMMY_RESUME_DATA);
      res.setHeader("Content-Type", "text/html");
      return res.send(htmlContent);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Generate resume PDF from template and form data
 * Accepts either nested `{ templateId, formData: { ... } }` or root-level `{ templateId, ...fields }`
 * POST /api/resume/generate
 */
export const generateResume = async (req, res, next) => {
  try {
    const templateId = Number(req.body?.templateId) || 2;
    let rawFormData = req.body?.formData || req.body || {};

    // 1. If sent via multipart/form-data, parse the JSON string
    if (typeof rawFormData === "string") {
      try {
        rawFormData = JSON.parse(rawFormData);
      } catch (jsonErr) {
        console.warn("[generateResume] Failed to parse stringified formData:", jsonErr.message);
      }
    }

    // 2. Resolve uploaded profile image file (if sent as a file by FE)
    const uploadedFile =
      req.file ||
      req.files?.profileImage?.[0] ||
      req.files?.profilePicture?.[0] ||
      req.files?.profile_pic?.[0] ||
      req.files?.image?.[0] ||
      req.files?.photo?.[0] ||
      req.files?.avatar?.[0] ||
      req.files?.file?.[0];

    if (!rawFormData.personalInformation) {
      rawFormData.personalInformation = {};
    }

    // Ensure root-level image properties are mapped into personalInformation.profileImage
    const rootImage =
      rawFormData.profileImage ||
      rawFormData.profilePicture ||
      rawFormData.profile_pic ||
      rawFormData.photo ||
      rawFormData.avatar ||
      rawFormData.image;

    if (rootImage && !rawFormData.personalInformation.profileImage) {
      rawFormData.personalInformation.profileImage = rootImage;
    }

    if (uploadedFile) {
      try {
        const fileBuffer = await fs.readFile(uploadedFile.path);
        const mimeType = uploadedFile.mimetype || "image/jpeg";
        const base64DataUri = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
        const relativePath = uploadedFile.path.replace(/\\/g, "/");
        const fullImageUrl = `${req.protocol}://${req.get("host")}/${relativePath}`;

        // Set strictly inside personalInformation
        rawFormData.personalInformation.profileImage = base64DataUri;
        rawFormData.personalInformation.profileImageUrl = fullImageUrl;
      } catch (fileErr) {
        console.warn("[generateResume] Notice reading uploaded image file:", fileErr.message);
      }
    }

    // Auto-fill from UserDetails database model if user is logged in
    let mergedPayload = { ...rawFormData };
    if (req.user?._id) {
      const userProfile = await UserDetails.findOne({ userId: req.user._id }).lean();
      if (userProfile) {
        const currentPersonalInfo = mergedPayload.personalInformation || mergedPayload.personalInfo || {};
        mergedPayload.personalInformation = {
          ...currentPersonalInfo,
          fullName: currentPersonalInfo.fullName || req.user.name || "",
          profileImage: currentPersonalInfo.profileImage || userProfile.profilePicture || userProfile.avatar || req.user.avatar || "",
          email: currentPersonalInfo.email || req.user.email || "",
          phoneNumber: currentPersonalInfo.phoneNumber || currentPersonalInfo.phone || req.user.phone || "",
          city: currentPersonalInfo.city || currentPersonalInfo.location || userProfile.location || "",
          linkedin: currentPersonalInfo.linkedin || userProfile.linkedin || "",
          portfolio: currentPersonalInfo.portfolio || currentPersonalInfo.website || userProfile.website || "",
          jobTitle: currentPersonalInfo.jobTitle || currentPersonalInfo.title || userProfile.jobTitle || "",
        };

        if (!mergedPayload.professionalSummary && userProfile.bio) {
          mergedPayload.professionalSummary = userProfile.bio;
        }

        if ((!mergedPayload.skills || mergedPayload.skills.length === 0) && userProfile.skills?.length) {
          mergedPayload.skills = userProfile.skills.map((s) => ({ skill: typeof s === "string" ? s : s.name }));
        }

        if ((!mergedPayload.education || mergedPayload.education.length === 0) && userProfile.education) {
          mergedPayload.education = [
            {
              courseName: userProfile.ugDegree || userProfile.pgDegree || userProfile.education,
              instituteName: userProfile.collegeName || "",
              academicYear: userProfile.ugYear || userProfile.pgYear || "",
            },
          ];
        }
      }
    }

    let pdfBuffer;
    try {
      pdfBuffer = await generateResumePDFBuffer(templateId, mergedPayload);
    } catch (pdfErr) {
      console.error("[generateResume] PDF generation engine failure:", pdfErr);
      throw new AppError(
        `PDF generation failed: ${pdfErr.message || "Browser engine unavailable on server."}`,
        500
      );
    }

    const outputDir = path.resolve(process.cwd(), "uploads", "resumes");
    await fs.mkdir(outputDir, { recursive: true });

    const fileName = `resume-${Date.now()}-${Math.round(Math.random() * 1e4)}.pdf`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, pdfBuffer);

    const relativeUrl = `uploads/resumes/${fileName}`;
    const downloadUrl = `${req.protocol}://${req.get("host")}/${relativeUrl}`;

    const userId = req.user?._id || req.user?.id;
    let savedResume = null;
    let xpStatus = null;

    if (userId) {
      try {
        savedResume = await Resume.create({
          userId,
          fileName,
          fileUrl: relativeUrl,
          pdfUrl: relativeUrl,
          fileSize: pdfBuffer.length,
          mimeType: "application/pdf",
        });

        // Check lifetime claim status for "Create Your First Professional Resume" mission
        const alreadyClaimed = await XPLog.exists({
          userId,
          action: "FIRST_RESUME_CREATE",
        });

        xpStatus = {
          actionKey: "FIRST_RESUME_CREATE",
          xpReward: 10,
          alreadyClaimed: Boolean(alreadyClaimed),
          readyToClaim: !alreadyClaimed,
        };

        // Notify user via FCM push and in-app notification that 10 XP is ready to claim in Missions
        if (!alreadyClaimed) {
          triggerMissionNotification(userId, "FIRST_RESUME_CREATE").catch((err) =>
            console.error("FIRST_RESUME_CREATE triggerMissionNotification error:", err.message)
          );
        }
      } catch (dbErr) {
        console.error("[generateResume] Failed to record resume or award XP in DB:", dbErr);
      }
    } else {
      console.warn("generateResume: req.user._id is missing, unable to persist resume to database collection.");
    }

    // If client requested PDF file binary stream directly
    if (req.query.stream === "true" || req.query.download === "true") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(pdfBuffer);
    }

    const responseData = savedResume
      ? {
        ...savedResume.toObject(),
        fileUrl: relativeUrl,
        pdfUrl: relativeUrl,
        downloadUrl,
      }
      : {
        fileName,
        fileUrl: relativeUrl,
        pdfUrl: relativeUrl,
        downloadUrl,
        fileSize: pdfBuffer.length,
        mimeType: "application/pdf",
      };

    return res.status(200).json({
      success: true,
      status: true,
      message: "Resume generated successfully",
      fileName,
      fileUrl: relativeUrl,
      downloadUrl,
      data: responseData,
      xp: xpStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download generated resume PDF by file name
 * GET /api/resume/download/:fileName
 */
export const downloadResume = async (req, res, next) => {
  try {
    const { fileName } = req.params;
    const filePath = path.resolve(process.cwd(), "uploads", "resumes", fileName);

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        status: false,
        message: "Resume PDF file not found",
      });
    }

    return res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
};

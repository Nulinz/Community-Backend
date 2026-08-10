import path from "path";
import fs from "fs/promises";
import { RESUME_TEMPLATES } from "../config/resumeTemplates.js";
import { generateResumePDFBuffer, renderResumeHTML } from "../services/pdfService.js";
import UserDetails from "../models/userDetails.js";

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
      const pdfFileName = `preview-template${tmpl.id}.pdf`;

      return {
        ...tmpl,
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
 * GET /api/resume/preview/:templateId
 */
export const previewResumeTemplate = async (req, res, next) => {
  try {
    const { templateId = 1 } = req.params;
    const pdfFilePath = path.resolve(process.cwd(), "resume", `preview-template${templateId}.pdf`);

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
 * POST /api/resume/generate
 */
export const generateResume = async (req, res, next) => {
  try {
    const { templateId = 1, formData = {} } = req.body;

    // Auto-fill from UserDetails database model if user is logged in
    let mergedPayload = { ...formData };
    if (req.user?._id) {
      const userProfile = await UserDetails.findOne({ userId: req.user._id }).lean();
      if (userProfile) {
        mergedPayload.personalInformation = {
          fullName: req.user.name || "",
          email: req.user.email || "",
          phoneNumber: req.user.phone || "",
          city: userProfile.location || "",
          linkedin: userProfile.linkedin || "",
          portfolio: userProfile.website || "",
          jobTitle: userProfile.jobTitle || "",
          ...mergedPayload.personalInformation,
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

    const pdfBuffer = await generateResumePDFBuffer(templateId, mergedPayload);

    const outputDir = path.resolve(process.cwd(), "uploads", "resumes");
    await fs.mkdir(outputDir, { recursive: true });

    const fileName = `resume-${Date.now()}-${Math.round(Math.random() * 1e4)}.pdf`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, pdfBuffer);

    const downloadUrl = `${req.protocol}://${req.get("host")}/uploads/resumes/${fileName}`;

    return res.status(200).json({
      success: true,
      status: true,
      message: "Resume generated successfully",
      fileName,
      downloadUrl,
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

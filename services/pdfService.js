import fs from "fs/promises";
import path from "path";
import handlebars from "handlebars";
import puppeteer from "puppeteer";

// Register Handlebars Helpers
handlebars.registerHelper("renderDots", (rating) => {
  const max = 5;
  const count = Math.min(Math.max(0, Number(rating) || 5), max);
  let dots = "";
  for (let i = 0; i < count; i++) {
    dots += "●";
  }
  if (count < max) {
    dots += `<span class="empty">`;
    for (let i = count; i < max; i++) {
      dots += "●";
    }
    dots += `</span>`;
  }
  return dots;
});

handlebars.registerHelper("joinArray", (arr) => {
  if (Array.isArray(arr)) {
    return arr.join(", ");
  }
  return arr || "";
});

handlebars.registerHelper("or", (...args) => {
  const values = args.slice(0, -1);
  return values.some(Boolean);
});

handlebars.registerHelper("and", (...args) => {
  const values = args.slice(0, -1);
  return values.every(Boolean);
});

handlebars.registerHelper("eq", (a, b) => a === b);

handlebars.registerHelper("not", (val) => !val);

/**
 * Normalizes Mobile app & Web payload schemas into unified Handlebars fields.
 * Includes smart bullet splitting and robust field fallback.
 */
export const normalizeResumeFormData = (input = {}) => {
  const pInfo = input.personalInformation || input.personalInfo || {};

  const locationParts = [
    pInfo.address,
    pInfo.city,
    pInfo.state,
    pInfo.pincode,
  ].filter(Boolean);
  const derivedLocation = locationParts.length > 0 ? locationParts.join(", ") : (pInfo.location || "");

  const personalInfo = {
    fullName: pInfo.fullName || pInfo.name || "",
    jobTitle: pInfo.jobTitle || pInfo.title || "",
    email: pInfo.email || "",
    phone: pInfo.phoneNumber || pInfo.phone || "",
    location: derivedLocation,
    website: pInfo.portfolio || pInfo.website || "",
    linkedin: pInfo.linkedin || "",
    github: pInfo.github || "",
    summary: input.professionalSummary || pInfo.summary || "",
    gender: pInfo.gender || "",
    dateOfBirth: pInfo.dateOfBirth || "",
  };

  // ── Map Work Experience & Smart Bullet Splitter ────────────
  const rawExp = input.workExperience || input.experience || [];
  const experience = Array.isArray(rawExp) ? rawExp.map((item) => {
    let highlights = [];
    if (Array.isArray(item.highlights) && item.highlights.length > 0) {
      highlights = item.highlights;
    } else if (item.description) {
      highlights = item.description
        .split(/\r?\n|;|\. /)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter((s) => s.length > 3);
    }

    return {
      jobTitle: item.jobTitle || item.title || "",
      companyName: item.companyName || item.company || "",
      location: item.location || "",
      jobType: item.jobType || "",
      startDate: item.startDate || "",
      endDate: item.currentlyWorking ? "Present" : (item.endDate || ""),
      description: item.description || "",
      highlights,
    };
  }) : [];

  // ── Map Education ──────────────────────────────────────────
  const rawEdu = input.education || [];
  const education = Array.isArray(rawEdu) ? rawEdu.map((item) => ({
    degree: item.courseName || item.educationLevel || item.degree || "",
    institution: item.instituteName || item.universityOrBoard || item.institution || "",
    location: item.location || "",
    startDate: item.startDate || "",
    endDate: item.currentlyStudying ? "Present" : (item.endDate || item.academicYear || ""),
    grade: item.cgpaOrPercentage || item.grade || "",
    details: item.universityOrBoard && item.instituteName ? `Board: ${item.universityOrBoard}` : (item.details || ""),
  })) : [];

  // ── Map Skills ─────────────────────────────────────────────
  const rawSkills = input.skills || [];
  let skills = [];
  if (Array.isArray(rawSkills)) {
    if (rawSkills.length > 0 && typeof rawSkills[0] === 'object' && 'skill' in rawSkills[0]) {
      const items = rawSkills.map(s => s.skill).filter(Boolean);
      skills = [{ category: "Key Skills", items }];
    } else if (rawSkills.length > 0 && typeof rawSkills[0] === 'object' && 'category' in rawSkills[0]) {
      skills = rawSkills;
    } else if (rawSkills.length > 0 && typeof rawSkills[0] === 'string') {
      skills = [{ category: "Key Skills", items: rawSkills }];
    }
  }

  // ── Map Projects ───────────────────────────────────────────
  const rawProjects = input.projects || [];
  const projects = Array.isArray(rawProjects) ? rawProjects.map((item) => ({
    title: item.projectTitle || item.title || item.projectName || "",
    link: item.projectLink || item.link || item.githubLink || "",
    year: item.duration || item.year || item.projectYear || "",
    description: item.description || item.projectDescription || "",
    technologies: Array.isArray(item.technologies)
      ? item.technologies
      : (item.techStack ? item.techStack.split(",").map(t => t.trim()) : [])
  })) : [];

  // ── Map Certifications ─────────────────────────────────────
  const rawCerts = input.certifications || [];
  const certifications = Array.isArray(rawCerts) ? rawCerts.map((item) => ({
    title: item.courseOrCertificationName || item.title || "",
    issuer: item.issuingOrganization || item.issuer || "",
    year: item.issueDate || item.year || "",
    description: item.description || "",
  })) : [];

  // ── Map Languages ──────────────────────────────────────────
  const rawLanguages = input.languages || [];
  const languages = Array.isArray(rawLanguages) ? rawLanguages.map((item) => {
    if (typeof item === 'string') return { name: item, rating: 5 };
    return {
      name: item.name || item.language || item.languageName || "",
      rating: Number(item.rating || item.proficiencyLevel || 5)
    };
  }) : [];

  // ── Map Awards ─────────────────────────────────────────────
  const rawAwards = input.awards || [];
  const awards = Array.isArray(rawAwards) ? rawAwards.map((item) => ({
    title: item.awardTitle || item.title || item.name || "",
    issuer: item.organization || item.issuer || item.issuingBody || "",
    year: item.year || item.date || "",
    description: item.description || ""
  })) : [];

  return {
    personalInfo,
    experience,
    education,
    skills,
    projects,
    certifications,
    languages,
    awards,
  };
};

/**
 * Compiles Handlebars HTML string for a given template and data.
 */
export const renderResumeHTML = async (templateId, formData) => {
  const normalizedData = normalizeResumeFormData(formData);
  const safeId = Math.min(Math.max(1, Number(templateId) || 1), 7);
  const templatePath = path.resolve(process.cwd(), "templates", "resumes", `template${safeId}.html`);
  const templateContent = await fs.readFile(templatePath, "utf8");

  const compiledTemplate = handlebars.compile(templateContent);
  return compiledTemplate(normalizedData);
};

/**
 * Helper to dynamically locate an installed Chromium-compatible browser binary
 * (Chrome, Microsoft Edge, Brave) across Windows, Linux, and macOS.
 * Eliminates missing Chrome cache errors without requiring separate CLI browser installs.
 */
const getSystemBrowserExecutable = async () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      await fs.access(process.env.PUPPETEER_EXECUTABLE_PATH);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    } catch {}
  }

  const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Admin\\AppData\\Local";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  const candidatePaths = [
    // Standard Google Chrome locations
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    // Microsoft Edge locations (standard on all Windows 10/11 environments)
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    // Brave Browser
    path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    // Linux and macOS system paths
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ];

  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  return null;
};

/**
 * Resilient Puppeteer browser launcher that attempts multiple discovery strategies:
 * 1. Explicitly discovered system executable (Chrome, Edge, Brave).
 * 2. Puppeteer native channel detection ('chrome', 'msedge').
 * 3. Default Puppeteer cache resolution.
 */
export const launchPuppeteerBrowser = async (extraArgs = []) => {
  const commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    ...extraArgs
  ];

  // 1. Try system executable path if found
  const execPath = await getSystemBrowserExecutable();
  if (execPath) {
    try {
      return await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: commonArgs
      });
    } catch (err) {
      console.warn(`[Puppeteer] Direct launch with ${execPath} failed:`, err.message);
    }
  }

  // 2. Try Puppeteer channels (queries OS registry/PATH for installed browsers)
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await puppeteer.launch({
        channel,
        headless: true,
        args: commonArgs
      });
    } catch (channelErr) {
      // Continue to next channel
    }
  }

  // 3. Fallback to default Puppeteer bundled browser
  try {
    return await puppeteer.launch({
      headless: "shell",
      args: commonArgs
    });
  } catch (shellErr) {
    return await puppeteer.launch({
      headless: true,
      args: commonArgs
    });
  }
};

/**
 * Compiles HTML template with certificate data and renders a PDF Buffer via Puppeteer.
 */
export const generateCertificatePDFBuffer = async (data) => {
  const templatePath = path.resolve(process.cwd(), "templates", "certificateTemplate.html");
  const templateContent = await fs.readFile(templatePath, "utf8");

  const compiledTemplate = handlebars.compile(templateContent);
  const htmlContent = compiledTemplate(data);

  const browser = await launchPuppeteerBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Compiles HTML template with resume data and renders a PDF Buffer via Puppeteer.
 */
export const generateResumePDFBuffer = async (templateId, formData) => {
  const htmlContent = await renderResumeHTML(templateId, formData);

  const browser = await launchPuppeteerBrowser(["--font-render-hinting=none"]);

  try {
    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" }
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Generates sample PDF files for all templates 1 to 7 in uploads/templates/
 */
export const generateTemplatePreviews = async (dummyData) => {
  const outputDir = path.resolve(process.cwd(), "uploads", "templates");
  await fs.mkdir(outputDir, { recursive: true });

  for (let id = 1; id <= 7; id++) {
    const pdfBuffer = await generateResumePDFBuffer(id, dummyData);
    const pdfPath = path.join(outputDir, `preview-template${id}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
  }
};

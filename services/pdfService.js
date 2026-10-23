import fs from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import handlebars from "handlebars";
import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium, { setupLambdaEnvironment, inflate } from "@sparticuz/chromium";

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

handlebars.registerHelper("joinArray", (arr, delimiter) => {
  const sep = typeof delimiter === "string" ? delimiter : ", ";
  if (Array.isArray(arr)) {
    return arr.join(sep);
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
 * Universal Single-Pass Domain Normalizer for all Resume Templates.
 * Standardizes incoming payload variants (Frontend form, mobile app, DB models)
 * into a single unified schema that satisfies all Handlebars templates (2 through 7).
 *
 * Responsibilities:
 * 1. Computes initials for avatar headers (Templates 4 & 6)
 * 2. Unifies experience highlights and bullets (Templates 2, 4, 5, 6, 7)
 * 3. Bridges education institution/schoolName and grade/gpa/coursework variants
 * 4. Generates both 'skills' and 'skillGroups' (Templates 6 & 7)
 * 5. Provides dual key naming for project titles (title/name) and tags (technologies/tags)
 * 6. Generates language rating, level text, dot arrays, and dot strings
 * 7. Unifies certifications and awards (title/name, year/date)
 */
export const normalizeResumeFormData = (input = {}) => {
  const pInfo = input.personalInformation || input.personalInfo || {};

  // Derive location from individual fields or fallback to location string
  const locationParts = [
    pInfo.address,
    pInfo.city,
    pInfo.state,
    pInfo.pincode,
  ].filter(Boolean);
  const derivedLocation = locationParts.length > 0 ? locationParts.join(", ") : (pInfo.location || "");

  // Generate initials for avatar badges (used in Templates 4 & 6)
  const rawFullName = (pInfo.fullName || pInfo.name || "").trim();
  const nameParts = rawFullName.split(/\s+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : nameParts.length === 1
      ? nameParts[0].slice(0, 2).toUpperCase()
      : "CV";

  const personalInfo = {
    fullName: rawFullName,
    initials,
    profileImage:
      pInfo.profileImage ||
      pInfo.profilePicture ||
      pInfo.profileImageUrl ||
      pInfo.photoUrl ||
      pInfo.photo ||
      pInfo.avatarUrl ||
      pInfo.avatar ||
      pInfo.image ||
      input.profileImage ||
      input.profilePicture ||
      input.profileImageUrl ||
      input.image ||
      input.avatar ||
      "",
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

  // ── Work Experience ─────────────────────────────────────────
  const rawExp = input.workExperience || input.experience || [];
  const experience = Array.isArray(rawExp) ? rawExp.map((item) => {
    let highlights = [];
    if (Array.isArray(item.highlights) && item.highlights.length > 0) {
      highlights = item.highlights.filter(Boolean);
    } else if (Array.isArray(item.bullets) && item.bullets.length > 0) {
      highlights = item.bullets.filter(Boolean);
    } else if (item.description) {
      highlights = item.description
        .split(/\r?\n|;|\. /)
        .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
        .filter((s) => s.length > 3);
    }

    const start = item.startDate || "";
    const end = item.currentlyWorking ? "Present" : (item.endDate || "");

    return {
      jobTitle: item.jobTitle || item.title || item.role || "",
      companyName: item.companyName || item.company || "",
      location: item.location || "",
      jobType: item.jobType || "",
      startDate: start,
      endDate: end,
      dates: start && end ? `${start} — ${end}` : (start || end || ""),
      description: item.description || "",
      highlights,
      bullets: highlights, // Template 6 & 7 use 'bullets'
    };
  }) : [];

  // ── Education ───────────────────────────────────────────────
  const rawEdu = input.education || [];
  const education = Array.isArray(rawEdu) ? rawEdu.map((item) => {
    const institution = item.instituteName || item.universityOrBoard || item.institution || item.schoolName || "";
    const grade = item.cgpaOrPercentage || item.grade || item.gpa || "";

    // Convert details / coursework into both string and array formats
    let courseworkArr = [];
    let courseworkStr = "";
    if (Array.isArray(item.coursework)) {
      courseworkArr = item.coursework.filter(Boolean);
      courseworkStr = courseworkArr.join(", ");
    } else if (item.coursework && typeof item.coursework === "string") {
      courseworkStr = item.coursework;
      courseworkArr = item.coursework.split(/[,•|·]/).map((s) => s.trim()).filter(Boolean);
    } else if (item.details && typeof item.details === "string") {
      courseworkStr = item.details;
      courseworkArr = item.details.split(/[,•|·]/).map((s) => s.trim()).filter(Boolean);
    }

    const start = item.startDate || "";
    const end = item.currentlyStudying ? "Present" : (item.endDate || item.academicYear || "");

    return {
      degree: item.courseName || item.educationLevel || item.degree || "",
      institution,
      schoolName: institution, // Template 6 uses 'schoolName'
      location: item.location || "",
      startDate: start,
      endDate: end,
      dates: start && end ? `${start} — ${end}` : (start || end || ""),
      grade,
      gpa: grade, // Templates 4, 5, 6, 7 use 'gpa'
      details: courseworkStr,
      coursework: courseworkArr.length > 0 ? courseworkArr : (courseworkStr ? [courseworkStr] : []),
    };
  }) : [];

  // ── Skills & Skill Groups ───────────────────────────────────
  const rawSkills = input.skills || input.skillGroups || [];
  let skills = [];
  if (Array.isArray(rawSkills)) {
    // Check for categorized structures first (payloads with category, groupName, or an items array).
    // Incoming payloads may contain both "category" and a fallback "skill" string; prioritizing
    // category ensures skills are properly segmented into sections (e.g. Tools, Frameworks)
    // rather than collapsing into a single generic "Key Skills" group.
    if (
      rawSkills.length > 0 &&
      typeof rawSkills[0] === "object" &&
      ("category" in rawSkills[0] || "groupName" in rawSkills[0] || "items" in rawSkills[0])
    ) {
      skills = rawSkills.map((g) => ({
        category: g.category || g.groupName || "Skills",
        items: Array.isArray(g.items) && g.items.length > 0
          ? g.items.filter(Boolean)
          : typeof g.items === "string" && g.items.trim()
            ? g.items.split(",").map((s) => s.trim()).filter(Boolean)
            : typeof g.skill === "string" && g.skill.trim()
              ? g.skill.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
      }));
    } else if (rawSkills.length > 0 && typeof rawSkills[0] === "object" && "skill" in rawSkills[0]) {
      // Flat list variant from mobile clients or user profile [{ skill: "React" }]
      const items = rawSkills.map((s) => s.skill).filter(Boolean);
      skills = [{ category: "Key Skills", items }];
    } else if (rawSkills.length > 0 && typeof rawSkills[0] === "string") {
      // Flat string array ["React", "Node.js"]
      skills = [{ category: "Key Skills", items: rawSkills.filter(Boolean) }];
    }
  }

  // Dual format: 'skills' (category) and 'skillGroups' (groupName) for Template 6 & 7
  const skillGroups = skills.map((s) => ({
    groupName: s.category,
    category: s.category,
    items: s.items,
  }));

  // ── Projects ────────────────────────────────────────────────
  const rawProjects = input.projects || [];
  const projects = Array.isArray(rawProjects) ? rawProjects.map((item) => {
    const title = item.projectTitle || item.title || item.projectName || item.name || "";
    const tech = Array.isArray(item.technologies)
      ? item.technologies.filter(Boolean)
      : Array.isArray(item.tags)
        ? item.tags.filter(Boolean)
        : item.techStack
          ? item.techStack.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

    let highlights = [];
    if (Array.isArray(item.highlights) && item.highlights.length > 0) {
      highlights = item.highlights.filter(Boolean);
    } else if (Array.isArray(item.bullets) && item.bullets.length > 0) {
      highlights = item.bullets.filter(Boolean);
    }

    const duration = item.duration || item.year || item.projectYear || item.dates || "";

    return {
      title,
      name: title, // Template 6 & 7 use 'name'
      link: item.projectLink || item.link || item.githubLink || "",
      year: duration,
      duration,
      dates: duration,
      startDate: item.startDate || duration,
      endDate: item.endDate || "",
      description: item.description || item.projectDescription || "",
      technologies: tech,
      tags: tech, // Template 6 & 7 use 'tags'
      highlights,
      bullets: highlights, // Template 6 uses 'bullets'
    };
  }) : [];

  // ── Certifications ──────────────────────────────────────────
  const rawCerts = input.certifications || [];
  const certifications = Array.isArray(rawCerts) ? rawCerts.map((item) => {
    const title = item.courseOrCertificationName || item.title || item.name || "";
    const year = item.issueDate || item.year || item.date || "";

    return {
      title,
      name: title, // Template 6 & 7 use 'name'
      issuer: item.issuingOrganization || item.issuer || "",
      year,
      date: year, // Template 6 & 7 use 'date'
      description: item.description || "",
    };
  }) : [];

  // ── Languages ───────────────────────────────────────────────
  const rawLanguages = input.languages || [];
  const languages = Array.isArray(rawLanguages) ? rawLanguages.map((item) => {
    let name = "";
    let rating = 5;
    let level = "Fluent";

    if (typeof item === "string") {
      name = item;
    } else {
      name = item.name || item.language || item.languageName || "";
      rating = Number(item.rating || item.proficiencyLevel || 5);
      level = item.level || (
        rating >= 5 ? "Native / Fluent" :
        rating >= 4 ? "Advanced" :
        rating >= 3 ? "Intermediate" : "Basic"
      );
    }

    const clampedRating = Math.min(Math.max(1, rating), 5);
    // Dots boolean array for Template 5: [true, true, true, false, false]
    const dotsArray = Array.from({ length: 5 }, (_, i) => i < clampedRating);
    // Proficiency dots string for Template 6: "●●●●○"
    const proficiencyDots = "●".repeat(clampedRating) + "○".repeat(5 - clampedRating);

    return {
      name,
      rating: clampedRating,
      level,
      dotsArray,
      proficiencyDots,
    };
  }) : [];

  // ── Awards ──────────────────────────────────────────────────
  const rawAwards = input.awards || [];
  const awards = Array.isArray(rawAwards) ? rawAwards.map((item) => {
    const title = item.awardTitle || item.title || item.name || "";
    const year = item.year || item.date || "";
    const desc = item.description || item.note || "";

    return {
      title,
      name: title, // Template 6 & 7 use 'name'
      issuer: item.organization || item.issuer || item.issuingBody || "",
      year,
      date: year, // Template 6 & 7 use 'date'
      description: desc,
      note: desc, // Template 7 uses 'note'
    };
  }) : [];

  return {
    personalInfo,
    experience,
    education,
    skills,
    skillGroups, // For Template 6 & 7
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
  const safeId = Math.min(Math.max(1, Number(templateId) || 2), 7);
  const primaryPath = path.resolve(process.cwd(), "templates", "resumes", `template${safeId}.html`);
  let templateContent;
  try {
    templateContent = await fs.readFile(primaryPath, "utf8");
  } catch (err) {
    const fallbackPath = path.resolve(process.cwd(), "templates", `template${safeId}.html`);
    templateContent = await fs.readFile(fallbackPath, "utf8");
  }

  const compiledTemplate = handlebars.compile(templateContent);
  return compiledTemplate(normalizedData);
};

/**
 * Helper to dynamically locate an installed Chromium-compatible browser binary
 * (Chrome, Microsoft Edge, Brave) across Windows, Linux, and macOS.
/**
 * Helper to dynamically locate all installed Chromium-compatible browser binaries
 * (Edge, Chrome, Brave) across Windows, Linux, and macOS.
 * Returns an array of valid paths so if one fails, the launcher tries the next.
 */
const getSystemBrowserExecutables = async () => {
  const list = [];

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      await fs.access(process.env.PUPPETEER_EXECUTABLE_PATH);
      list.push(process.env.PUPPETEER_EXECUTABLE_PATH);
    } catch {}
  }

  const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Admin\\AppData\\Local";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  const candidatePaths = [
    // Microsoft Edge locations (first on Windows: standard, stable & preinstalled)
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    // Standard Google Chrome locations
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    // Brave Browser
    path.join(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    // Linux and macOS system paths
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];

  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate);
      list.push(candidate);
    } catch {}
  }

  return list;
};

/**
 * Cross-platform resilient Puppeteer browser launcher:
 * 1. Linux Cloud Environment (Azure App Service / AWS / Docker):
 *    Uses @sparticuz/chromium + puppeteer-core with precompiled static Chromium
 *    and built-in graphics libraries, bypassing missing libnss3 / OS package issues.
 * 2. Explicitly discovered system executables (Edge, Chrome, Brave on Windows/macOS).
 * 3. Puppeteer native channel detection ('msedge', 'chrome').
 * 4. Default Puppeteer cache resolution for local dev.
 */
export const launchPuppeteerBrowser = async (extraArgs = []) => {
  const commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    ...extraArgs
  ];

  // 1. Linux Cloud Environment (Azure App Service / Ubuntu container)
  if (process.platform === "linux") {
    try {
      // Force @sparticuz/chromium to unpack Amazon Linux 2023 shared libraries (libnss3, libatk, etc.)
      // which is otherwise skipped on Azure App Service because it does not have AWS/Vercel env vars.
      process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs22.x";
      chromium.setGraphicsMode = false;

      const al2023LibPath = path.join(tmpdir(), "al2023", "lib");
      setupLambdaEnvironment(al2023LibPath);

      // Ensure al2023 shared libraries are uncompressed to /tmp/al2023/lib
      if (!existsSync(al2023LibPath)) {
        try {
          const binDir = path.resolve(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
          const al2023TarBr = path.join(binDir, "al2023.tar.br");
          if (existsSync(al2023TarBr)) {
            await inflate(al2023TarBr);
          }
        } catch (inflateErr) {
          console.warn("[Chromium] Manual al2023 inflate notice:", inflateErr.message);
        }
      }

      const execPath = await chromium.executablePath();
      if (execPath) {
        return await puppeteerCore.launch({
          args: [
            ...chromium.args,
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            ...extraArgs,
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath: execPath,
          headless: chromium.headless,
        });
      }
    } catch (sparticuzErr) {
      console.warn("[Chromium] @sparticuz/chromium launch error:", sparticuzErr.message);
    }
  }

  // 2. Try candidate system executable paths (loops through Edge, Chrome, Brave)
  const candidateExecutables = await getSystemBrowserExecutables();
  for (const execPath of candidateExecutables) {
    try {
      return await puppeteerCore.launch({
        executablePath: execPath,
        headless: true,
        args: commonArgs
      });
    } catch (err) {
      console.warn(`[Puppeteer] Direct launch with ${execPath} failed, trying next candidate...`);
    }
  }

  // 3. Try Puppeteer channels (queries OS registry/PATH for installed browsers)
  for (const channel of ["msedge", "chrome"]) {
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

  // 4. Fallback to default Puppeteer bundled browser
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

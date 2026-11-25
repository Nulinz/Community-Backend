import mongoose from "mongoose";
import path from "path";
import * as XLSX from "xlsx";
import Job from "../models/jobModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import Attendance from "../models/attendanceModel.js";
import UserDetails from "../models/userDetails.js";
import PerformanceEvaluation from "../models/performanceEvaluationModel.js";
import Company from "../models/companyModel.js";
import User from "../models/userModel.js";
import Resume from "../models/resumeModel.js";
import { formatJobSalary } from "../helper/salaryHelper.js";
import { notifyCompanyFollowers } from "../helper/companyFollowNotification.js";
import { applyOrderCount, buildStatusQuery, sortByOrderCount } from "../helper/orderCountHelper.js";

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const getUploadedFilePath = (file) => {
  if (!file?.path) return "";
  return path.relative(process.cwd(), file.path).replace(/\\/g, "/");
};

/**
 * Normalizes input arrays that may arrive either as native arrays,
 * serialized JSON strings, or single raw values.
 */
const parseArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch (e) {
      return [val];
    }
  }
  return [];
};

export const createJobForm = async (req, res, next) => {
  try {
    const { id, _id, ...rest } = req.body;
    const targetId = id || _id || req.params?.id;
    const isUpdate = !!targetId;
    const status = req?.user?.role === "admin" ? "approved" : "pending";
    const {
      jobCategory,
      domain,
      domains,
      jobType,
      jobTitle,
      organizer,
      companyName,
      location,
      mode,
      totalOpenings,
      duration,
      jobStartDate,
      applicationDeadline,
      salary,
      salaryType,
      salaryMin,
      salaryMax,
      responsibilities,
      eligibility,
      description,
      certificateAvailability,
      skill_set,
      benefits,
      learning_outcomes,
      development_benefits,
      development_resources,
      experienceFrom,
      experienceTo,
      experienceRange,
      externalRegistrationLink,
    } = rest;

    if (!jobTitle) throw Object.assign(new Error("Job Title is required"), { status: 400 });
    const resolvedOrganizer = toCleanString(organizer || companyName);
    if (!resolvedOrganizer) throw Object.assign(new Error("Organizer / Company Name is required"), { status: 400 });
    const cleanMode = toCleanString(mode);
    if (!cleanMode) throw Object.assign(new Error("Mode is required"), { status: 400 });
    if ((cleanMode === "Offline" || cleanMode === "Hybrid" || cleanMode === "On-site") && !location) {
      throw Object.assign(new Error("Location is required for Offline or Hybrid mode"), { status: 400 });
    }

    let job;

    if (isUpdate) {
      job = await Job.findById(targetId);
      if (!job) {
        throw Object.assign(new Error("Job not found"), { status: 404 });
      }
      if (req.user?.role === "company" && job.c_by?.toString() !== req.user._id?.toString()) {
        throw Object.assign(new Error("Not authorized to update this job"), { status: 403 });
      }
    } else {
      job = new Job({ c_by: req.user._id });
      job.status = status;
    }

    const cleanSalaryType = toCleanString(salaryType) || "Fixed amount";

    const resolvedDomains = parseArray(domains || domain);

    job.status = status;
    job.jobCategory = toCleanString(jobCategory);
    job.domains = resolvedDomains;
    job.jobType = toCleanString(jobType || "Job");
    job.jobTitle = toCleanString(jobTitle);
    job.organizer = resolvedOrganizer;
    job.companyName = resolvedOrganizer;

    // ── Handle Custom Company Logo / Dropdown Selection ──────────
    let customCompanyLogo = job.companyLogo || null;
    if (req.files?.companyLogo?.[0]) {
      const relPath = getUploadedFilePath(req.files.companyLogo[0]);
      customCompanyLogo = relPath ? (relPath.startsWith("/") ? relPath : `/${relPath}`) : null;
    } else if (req.body.companyLogo && typeof req.body.companyLogo === "string" && req.body.companyLogo.trim()) {
      customCompanyLogo = req.body.companyLogo.trim();
    } else if (resolvedOrganizer) {
      const matchingCompany = await Company.findOne({
        companyName: new RegExp(`^${resolvedOrganizer}$`, "i"),
      }).select("companyLogo").lean();
      if (matchingCompany?.companyLogo) {
        customCompanyLogo = matchingCompany.companyLogo;
      }
    }

    if (customCompanyLogo) {
      job.companyLogo = customCompanyLogo;
    }
    job.location = toCleanString(location) || (cleanMode === "Online" || cleanMode === "Remote" ? cleanMode : "");
    job.mode = cleanMode;
    job.totalOpenings = Number(totalOpenings) || 0;

    // Resolve dragging range experience values (supports separate fields or composite object)
    let resolvedExpFrom = experienceFrom;
    let resolvedExpTo = experienceTo;
    if (experienceRange) {
      const parsedExp = typeof experienceRange === "string" ? (() => { try { return JSON.parse(experienceRange); } catch { return null; } })() : experienceRange;
      if (parsedExp && typeof parsedExp === "object") {
        if (parsedExp.from !== undefined) resolvedExpFrom = parsedExp.from;
        if (parsedExp.to !== undefined) resolvedExpTo = parsedExp.to;
      }
    }
    const numExpFrom = resolvedExpFrom !== undefined && resolvedExpFrom !== null && resolvedExpFrom !== "" ? Number(resolvedExpFrom) : 0;
    const numExpTo = resolvedExpTo !== undefined && resolvedExpTo !== null && resolvedExpTo !== "" ? Number(resolvedExpTo) : 0;
    if (numExpFrom < 0 || numExpTo < 0 || numExpFrom > numExpTo) {
      throw Object.assign(new Error("Invalid experience range. 'From' must be less than or equal to 'To'"), { status: 400 });
    }
    job.experienceFrom = numExpFrom;
    job.experienceTo = numExpTo;
    job.externalRegistrationLink = toCleanString(externalRegistrationLink);

    job.duration = toCleanString(jobType) === "Contract" ? toCleanString(duration) : "";
    job.jobStartDate = jobStartDate || undefined;
    job.applicationDeadline = applicationDeadline || undefined;
    job.salaryType = cleanSalaryType;
    job.salaryMin = cleanSalaryType === "Range" ? (Number(salaryMin) || 0) : 0;
    job.salaryMax = cleanSalaryType === "Range" ? (Number(salaryMax) || 0) : 0;
    job.salary = cleanSalaryType === "Fixed amount" ? (Number(salary) || 0) : (cleanSalaryType === "Range" ? (Number(salaryMin) || 0) : 0);
    job.description = toCleanString(description);
    job.certificateAvailability = toCleanString(certificateAvailability);

    job.responsibilities = parseArray(responsibilities);
    job.eligibility = parseArray(eligibility);
    job.skill_set = parseArray(skill_set);
    job.benefits = parseArray(benefits);
    job.learning_outcomes = parseArray(learning_outcomes);
    job.development_benefits = parseArray(development_benefits);
    job.development_resources = parseArray(development_resources);
    applyOrderCount(job, rest.order_count, req.user?.role);

    const savedJob = await job.save();
    const jobObj = savedJob.toObject();
    delete jobObj.domain;
    jobObj.domains = Array.isArray(jobObj.domains) && jobObj.domains.length
      ? jobObj.domains
      : resolvedDomains;
    jobObj.salary = formatJobSalary(jobObj);
    delete jobObj.salaryMin;
    delete jobObj.salaryMax;

    // Asynchronously notify followers of this company when a new job is posted
    if (!isUpdate) {
      notifyCompanyFollowers({
        opportunity: jobObj,
        opportunityType: "Job",
        senderId: req.user._id,
        organizerName: resolvedOrganizer,
      }).catch((err) => console.error("Error triggering follower job notification:", err.message));
    }

    return res.status(isUpdate ? 200 : 201).json({
      status: true,
      message: isUpdate ? "Job updated successfully" : "Job created successfully",
      data: jobObj,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllJobs = async (req, res, next) => {
  try {
    const user = req.user;
    const { status } = req.query;

    const query = buildStatusQuery(user, status, { forceOwnForCompany: true });

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const data = await Promise.all(
      jobs.map(async (item) => {
        const appliedCount = await AppliedJob.countDocuments({
          jobId: item._id,
          jobType: "Job",
        });
        const { domain, salaryMin, salaryMax, ...itemRest } = item;
        const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
        return {
          ...itemRest,
          domains: itemDomains,
          salary: formatJobSalary(item),
          appliedCount,
        };
      })
    );

    sortByOrderCount(data);

    return res.status(200).json({
      success: true,
      status: true,
      message: "Jobs fetched successfully",
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id).lean();

    if (!job) {
      throw Object.assign(new Error("Job not found"), { status: 404 });
    }

    if (
      req.user?.role === "company" &&
      job.c_by?.toString() !== req.user._id?.toString()
    ) {
      throw Object.assign(new Error("Job not found"), { status: 404 });
    }

    // ── Get Applied List ────────────────────────────────────
    const applications = await AppliedJob.find({
      jobId: id,
      jobType: "Job",
    })
      .populate("userId", "email phone name")
      .populate("resumeId", "fileName fileUrl pdfUrl")
      .sort({ createdAt: -1 })
      .lean();

    // ── Enrich with UserDetails ─────────────────────────────
    const appliedList = await Promise.all(
      applications.map(async (app, index) => {
        const userDetails = await UserDetails.findOne({
          userId: app.userId?._id,
        })
          .select(
            "profile_pic gender dob location currentStatus education ugDegree ugFieldOfStudy ugYear pgDegree pgFieldOfStudy pgYear companyName jobTitle yearOfExperience"
          )
          .lean();

        let resumeUrl = app.resumeId?.fileUrl || app.resumeId?.pdfUrl || "";
        let resumeName = app.resumeId?.fileName || "Resume.pdf";
        if (!resumeUrl && app.userId?._id) {
          const userResume = await Resume.findOne({ userId: app.userId._id }).sort({ createdAt: -1 }).lean();
          if (userResume) {
            resumeUrl = userResume.fileUrl || userResume.pdfUrl || "";
            resumeName = userResume.fileName || "Resume.pdf";
          }
        }

        const rawPortfolios = Array.isArray(app.portfolios) && app.portfolios.length > 0
          ? app.portfolios
          : (Array.isArray(app.portfolio) && app.portfolio.length > 0
            ? app.portfolio
            : (typeof app.portfolio === "string" && app.portfolio.trim()
              ? [{ field_name: "Portfolio", portfolio: app.portfolio.trim() }]
              : []));

        return {
          sNo: index + 1,
          applicationId: app._id,
          userId: app.userId?._id,
          name: app.userId?.name,
          mail: app.userId?.email || "",
          contact: app.userId?.phone || "",
          appliedAt: app.createdAt,
          location: app.location,
          status: app.status || "applied",
          portfolios: rawPortfolios,
          portfolio: rawPortfolios.length > 0 ? rawPortfolios : null,
          resumeUrl,
          resumeName,
          profile_pic: userDetails?.profile_pic || null,
          gender: userDetails?.gender || "",
          currentStatus: userDetails?.currentStatus || "",
          education: userDetails?.education || "",
          ugFieldOfStudy: userDetails?.ugFieldOfStudy || "",
          year: userDetails?.ugYear || userDetails?.pgYear,
          department: userDetails?.pgDegree || userDetails?.ugDegree,
          pgFieldOfStudy: userDetails?.pgFieldOfStudy || "",
          companyName: userDetails?.companyName || "",
          jobTitle: userDetails?.jobTitle || "",
          yearOfExperience: userDetails?.yearOfExperience || null,
        };
      })
    );

    // Resolve company logo from job, company profile or admin
    let companyLogo = job.companyLogo || null;
    if (!companyLogo && job.c_by) {
      const company = await Company.findOne({
        $or: [{ userId: job.c_by }, { c_by: job.c_by }],
      })
        .select("companyLogo")
        .lean();
      if (company?.companyLogo) {
        companyLogo = company.companyLogo;
      }
    }
    if (!companyLogo && job.companyName) {
      const companyByName = await Company.findOne({
        companyName: new RegExp(`^${job.companyName.trim()}$`, "i"),
      })
        .select("companyLogo")
        .lean();
      if (companyByName?.companyLogo) {
        companyLogo = companyByName.companyLogo;
      }
    }
    if (!companyLogo && job.c_by) {
      const creator = await User.findById(job.c_by).select("role").lean();
      if (creator?.role === "admin") {
        companyLogo = "referral/assets/index_icon.png";
      }
    }

    const { domain, salaryMin, salaryMax, ...jobRest } = job;
    const itemDomains = Array.isArray(jobRest.domains) && jobRest.domains.length ? jobRest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
    const enrichedJob = {
      ...jobRest,
      domains: itemDomains,
      salary: formatJobSalary(job),
      companyLogo: companyLogo || "",
      companyImage: companyLogo || "",
    };

    return res.status(200).json({
      success: true,
      status: true,
      message: "Job fetched successfully",
      data: {
        internship: enrichedJob,
        job: enrichedJob,
        companyLogo: companyLogo || "",
        companyImage: companyLogo || "",
        applications: {
          count: appliedList.length,
          list: appliedList,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleJobStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      throw Object.assign(new Error("Job not found"), { status: 404 });
    }

    job.isActive = !job.isActive;
    await job.save();

    const jobObj = job.toObject();
    const resolvedDomains = Array.isArray(jobObj.domains) && jobObj.domains.length
      ? jobObj.domains
      : (jobObj.domain ? jobObj.domain.split(",").map((s) => s.trim()).filter(Boolean) : []);
    delete jobObj.domain;
    jobObj.domains = resolvedDomains;
    jobObj.salary = formatJobSalary(jobObj);
    delete jobObj.salaryMin;
    delete jobObj.salaryMax;

    return res.status(200).json({
      status: true,
      message: `Job status updated to ${job.isActive ? "Active" : "Inactive"}`,
      data: jobObj,
    });
  } catch (error) {
    next(error);
  }
};

export const getAppliedCandidateProfile = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const application = await AppliedJob.findById(applicationId)
      .populate("userId", "name email phone profileImage role")
      .populate("resumeId", "fileName fileUrl pdfUrl fileSize mimeType")
      .lean();

    if (!application) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }

    const userDetails = await UserDetails.findOne({
      userId: application.userId?._id,
    }).lean();

    let resumeUrl = application.resumeId?.fileUrl || application.resumeId?.pdfUrl || "";
    let resumeName = application.resumeId?.fileName || "Resume.pdf";
    if (!resumeUrl && application.userId?._id) {
      const userResume = await Resume.findOne({ userId: application.userId._id })
        .sort({ createdAt: -1 })
        .lean();
      if (userResume) {
        resumeUrl = userResume.fileUrl || userResume.pdfUrl || "";
        resumeName = userResume.fileName || "Resume.pdf";
      }
    }

    const rawPortfolios = Array.isArray(application.portfolios) && application.portfolios.length > 0
      ? application.portfolios
      : (Array.isArray(application.portfolio) && application.portfolio.length > 0
        ? application.portfolio
        : (typeof application.portfolio === "string" && application.portfolio.trim()
          ? [{ field_name: "Portfolio", portfolio: application.portfolio.trim() }]
          : []));

    const candidateProfile = {
      userId: application.userId?._id || application.userId,
      applicationId: application._id,
      jobId: application.jobId,
      jobType: application.jobType,
      status: application.status || "applied",
      appliedAt: application.createdAt,
      portfolios: rawPortfolios,
      portfolio: rawPortfolios.length > 0 ? rawPortfolios : null,

      // Personal Info
      name: userDetails?.name || application.userId?.name || "",
      email: application.userId?.email || "",
      mail: application.userId?.email || "",
      contact: application.userId?.phone || "",
      phoneNumber: application.userId?.phone || "",
      profilePic: userDetails?.profile_pic || application.userId?.profileImage || null,
      profile_pic: userDetails?.profile_pic || application.userId?.profileImage || null,
      gender: userDetails?.gender || "",
      dob: userDetails?.dob || null,
      address: userDetails?.address || "",
      city: userDetails?.city || "",
      currentStatus: userDetails?.currentStatus || "",
      education: userDetails?.education || "",
      highestQualification: userDetails?.highQualification || userDetails?.education || "",

      // Educational Details
      college: userDetails?.ugCollegeName || userDetails?.pgCollegeName || "",
      collegeName: userDetails?.ugCollegeName || userDetails?.pgCollegeName || "",
      department: userDetails?.ugFieldOfStudy || userDetails?.pgFieldOfStudy || "",
      degree: userDetails?.ugDegree || userDetails?.pgDegree || "",
      ugDegree: userDetails?.ugDegree || "",
      ugFieldOfStudy: userDetails?.ugFieldOfStudy || "",
      ugYear: userDetails?.ugYear || null,
      year: userDetails?.ugYear || userDetails?.pgYear || "",
      ugCollegeName: userDetails?.ugCollegeName || "",
      ugModeOfStudy: userDetails?.ugModeOfstudy || "",
      ugPercentage: userDetails?.ugPercentage || "",
      pgDegree: userDetails?.pgDegree || "",
      pgFieldOfStudy: userDetails?.pgFieldOfStudy || "",
      pgYear: userDetails?.pgYear || null,
      pgCollegeName: userDetails?.pgCollegeName || "",
      pgModeOfStudy: userDetails?.pgModeOfstudy || "",
      pgPercentage: userDetails?.pgPercentage || "",
      academicAchievement: Array.isArray(userDetails?.academicAchievements)
        ? userDetails.academicAchievements.join(", ")
        : userDetails?.academicAchievements || "",

      // Skills
      primarySkills: userDetails?.skills?.primary_skills?.length
        ? userDetails.skills.primary_skills
        : [],
      toolsAndTechnologies: userDetails?.skills?.tools?.length
        ? userDetails.skills.tools
        : [],
      languagesKnown: userDetails?.skills?.languages?.length
        ? userDetails.skills.languages
        : [],

      // Resume
      resumeUrl,
      resumeName,
    };

    return res.status(200).json({
      success: true,
      status: true,
      data: candidateProfile,
    });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!["applied", "selected", "rejected"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { status: 400 });
    }

    const application = await AppliedJob.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true }
    );

    if (!application) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }

    return res.status(200).json({
      success: true,
      status: true,
      message: "Application status updated successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

export const getSelectedCandidates = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const applications = await AppliedJob.find({ jobId, status: "selected" })
      .populate("userId", "name email phone profileImage")
      .populate("resumeId", "fileName fileUrl pdfUrl")
      .sort({ createdAt: -1 })
      .lean();

    const selectedList = await Promise.all(
      applications.map(async (app, index) => {
        const userDetails = await UserDetails.findOne({
          userId: app.userId?._id,
        })
          .select("collegeName ugCollegeName pgCollegeName location city ugDegree ugYear pgDegree pgYear")
          .lean();

        let resumeUrl = app.resumeId?.fileUrl || app.resumeId?.pdfUrl || "";
        let resumeName = app.resumeId?.fileName || "Resume.pdf";
        if (!resumeUrl && app.userId?._id) {
          const userResume = await Resume.findOne({ userId: app.userId._id }).sort({ createdAt: -1 }).lean();
          if (userResume) {
            resumeUrl = userResume.fileUrl || userResume.pdfUrl || "";
            resumeName = userResume.fileName || "Resume.pdf";
          }
        }

        const candidateCity = userDetails?.city || app.location || userDetails?.location || "-";

        return {
          userId: app.userId?._id,
          id: app.userId?._id || app._id,
          applicationId: app._id,
          sNo: String(index + 1).padStart(2, "0"),
          name: app.userId?.name || "Candidate",
          mail: app.userId?.email || "",
          contact: app.userId?.phone || "",
          college: userDetails?.collegeName || userDetails?.ugCollegeName || userDetails?.pgCollegeName || "-",
          location: candidateCity,
          city: candidateCity,
          department: userDetails?.pgDegree || userDetails?.ugDegree || "-",
          year: userDetails?.ugYear || userDetails?.pgYear || "-",
          resumeUrl,
          resumeName,
        };
      })
    );

    return res.status(200).json({
      success: true,
      status: true,
      count: selectedList.length,
      data: selectedList,
    });
  } catch (error) {
    next(error);
  }
};

export const saveAttendance = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { date, attendanceList } = req.body;
    const items = Array.isArray(attendanceList) ? attendanceList : (Array.isArray(req.body.records) ? req.body.records : null);

    if (!date || !items || items.length === 0) {
      throw Object.assign(new Error("Date and a non-empty attendance list are required"), { status: 400 });
    }

    // Ensure all candidate records have an explicit present or absent status
    const hasUnmarked = items.some(
      (item) => !item.status || (item.status.toLowerCase() !== "present" && item.status.toLowerCase() !== "absent")
    );
    if (hasUnmarked) {
      throw Object.assign(
        new Error("Attendance must be marked (Present or Absent) for all candidates before saving"),
        { status: 400 }
      );
    }

    const records = await Promise.all(
      items.map((item) =>
        Attendance.findOneAndUpdate(
          { jobId, userId: item.userId, date: new Date(date) },
          {
            jobId,
            jobType: "Job",
            userId: item.userId,
            c_by: req.user._id,
            date: new Date(date),
            status: item.status,
          },
          { upsert: true, new: true }
        )
      )
    );

    return res.status(200).json({
      status: true,
      message: "Attendance saved successfully",
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const history = await Attendance.find({ jobId }).sort({ date: -1 });

    return res.status(200).json({
      status: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceDetails = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { date } = req.query;

    const query = { jobId };
    if (date) {
      query.date = new Date(date);
    }

    const details = await Attendance.find(query).populate("userId", "name email phone");

    return res.status(200).json({
      status: true,
      data: details,
    });
  } catch (error) {
    next(error);
  }
};

export const savePerformanceEvaluation = async (req, res, next) => {
  try {
    const { applicationId, ratings, feedback } = req.body;

    const evaluation = await PerformanceEvaluation.findOneAndUpdate(
      { applicationId },
      { applicationId, ratings, feedback, c_by: req.user._id },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      status: true,
      message: "Performance evaluation saved successfully",
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
};

export const getPerformanceEvaluation = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const evaluation = await PerformanceEvaluation.findOne({ applicationId });

    return res.status(200).json({
      status: true,
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk upload jobs from an Excel (.xlsx / .xls) or CSV spreadsheet.
 * Parses headers flexibly, validates rows, and bulk-inserts valid records.
 */
export const bulkUploadJobs = async (req, res, next) => {
  try {
    const file = req.file || req.files?.file?.[0];
    if (!file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel (.xlsx, .xls) or CSV file under field 'file'",
      });
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "Uploaded workbook does not contain any sheets",
      });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The uploaded sheet is empty",
      });
    }

    const userId = req.user._id;
    const defaultStatus = req.user?.role === "admin" ? "approved" : "pending";

    // Helper to find column values with flexible case & spacing aliases
    const getField = (row, ...aliases) => {
      const keys = Object.keys(row);
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[\s_-]/g, "");
        const matchedKey = keys.find(
          (k) => k.toLowerCase().replace(/[\s_-]/g, "") === cleanAlias
        );
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
          const val = String(row[matchedKey]).trim();
          if (val) return val;
        }
      }
      return "";
    };

    // Split multi-value cells on " # " (and real newlines) instead of commas/semicolons
    // so in-sentence punctuation and tokens like "C#" are preserved.
    const parseList = (val) => {
      if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
      if (typeof val === "string") {
        return val.split(/[ \t]+#[ \t]+|\r?\n/).map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    const parseDateVal = (val) => {
      if (!val) return undefined;
      if (val instanceof Date && !isNaN(val.getTime())) return val;
      const d = new Date(val);
      return !isNaN(d.getTime()) ? d : undefined;
    };

    const validJobs = [];
    const errors = [];

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // Row 1 is header

      const jobTitle = getField(row, "jobTitle", "Job Title", "Title", "role");
      const companyName = getField(row, "companyName", "Company Name", "Company", "organizer", "Organizer");
      let mode = getField(row, "mode", "Mode", "Work Mode") || "Offline";
      mode = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
      if (!["Online", "Offline", "Hybrid"].includes(mode)) {
        mode = "Offline";
      }

      const location = getField(row, "location", "Location", "City", "Job Location");

      // Validations
      if (!jobTitle) {
        errors.push({ row: rowNumber, error: "Job Title is required" });
        return;
      }
      if (!companyName) {
        errors.push({ row: rowNumber, error: "Company Name is required" });
        return;
      }
      if ((mode === "Offline" || mode === "Hybrid") && !location) {
        errors.push({ row: rowNumber, error: `Location is required for ${mode} mode` });
        return;
      }

      const salaryMin = Number(getField(row, "salaryMin", "Salary Min", "Min Salary")) || 0;
      const salaryMax = Number(getField(row, "salaryMax", "Salary Max", "Max Salary")) || 0;
      const salary = Number(getField(row, "salary", "Salary", "Fixed Salary")) || 0;
      const salaryType = getField(row, "salaryType", "Salary Type") || "Fixed amount";

      const experienceFrom = Number(getField(row, "experienceFrom", "Experience From", "Min Experience")) || 0;
      const experienceTo = Number(getField(row, "experienceTo", "Experience To", "Max Experience")) || 0;
      const totalOpenings = Number(getField(row, "totalOpenings", "Total Openings", "Openings", "Vacancies")) || 1;

      const skills = parseList(getField(row, "skills", "Skill Set", "skill_set", "Skill"));
      const domains = parseList(getField(row, "domains", "Domains", "Domain"));
      const responsibilities = parseList(getField(row, "responsibilities", "Responsibilities", "Job Responsibilities"));
      const eligibility = parseList(getField(row, "eligibility", "Eligibility", "Eligibility Criteria"));

      const jobType = getField(row, "jobType", "Job Type", "Type", "Employment Type") || "Full Time";
      const jobCategory = getField(row, "jobCategory", "Job Category", "Category") || "Jobs";
      const description = getField(row, "description", "Description", "Job Description")
        .replace(/[ \t]+#[ \t]+/g, "\n")
        .trim();
      const externalLink = getField(row, "externalRegistrationLink", "External Link", "Apply Link", "Registration Link");

      const deadline = parseDateVal(row["Application Deadline"] || row["applicationDeadline"] || row["Deadline"] || getField(row, "deadline"));
      const startDate = parseDateVal(row["Job Start Date"] || row["jobStartDate"] || row["Start Date"] || getField(row, "startDate"));

      validJobs.push({
        c_by: userId,
        status: defaultStatus,
        jobTitle,
        companyName,
        organizer: companyName,
        jobType,
        jobCategory,
        mode,
        location: location || "N/A",
        totalOpenings,
        experienceFrom,
        experienceTo,
        salary,
        salaryMin,
        salaryMax,
        salaryType,
        applicationDeadline: deadline,
        jobStartDate: startDate,
        skill_set: skills,
        domains,
        responsibilities,
        eligibility,
        description,
        externalRegistrationLink: externalLink,
        isActive: true,
      });
    });

    let createdJobs = [];
    if (validJobs.length > 0) {
      // Resolve existing company logos if company exists in DB
      const distinctNames = [...new Set(validJobs.map((j) => j.companyName).filter(Boolean))];
      if (distinctNames.length > 0) {
        const matchedCompanies = await Company.find({
          companyName: { $in: distinctNames.map((n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) },
        })
          .select("companyName companyLogo")
          .lean();

        const logoMap = new Map();
        matchedCompanies.forEach((c) => {
          if (c.companyName && c.companyLogo) {
            logoMap.set(c.companyName.toLowerCase().trim(), c.companyLogo);
          }
        });

        validJobs.forEach((job) => {
          const cleanName = job.companyName ? job.companyName.toLowerCase().trim() : "";
          if (!job.companyLogo && logoMap.has(cleanName)) {
            job.companyLogo = logoMap.get(cleanName);
          }
        });
      }

      createdJobs = await Job.insertMany(validJobs);
    }

    return res.status(200).json({
      success: true,
      message: `Bulk upload completed: ${createdJobs.length} jobs created successfully.${errors.length ? ` ${errors.length} rows had errors.` : ""}`,
    });
  } catch (error) {
    next(error);
  }
};

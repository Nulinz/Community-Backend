import mongoose from "mongoose";
import Job from "../models/jobModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import Attendance from "../models/attendanceModel.js";
import UserDetails from "../models/userDetails.js";
import PerformanceEvaluation from "../models/performanceEvaluationModel.js";

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

export const createJobForm = async (req, res, next) => {
  try {
    const { id, _id, ...rest } = req.body;
    const targetId = id || _id || req.params?.id;
    const isUpdate = !!targetId;
    const status = req?.user?.role === "admin" ? "approved" : "pending";
    const {
      jobCategory,
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
      responsibilities,
      eligibility,
      description,
      certificateAvailability,
      skill_set,
      benefits,
      learning_outcomes,
      development_benefits,
      development_resources,
    } = rest;

    if (!jobTitle) throw Object.assign(new Error("Job Title is required"), { status: 400 });
    const resolvedOrganizer = toCleanString(organizer || companyName);
    if (!resolvedOrganizer) throw Object.assign(new Error("Organizer / Company Name is required"), { status: 400 });
    if (!location) throw Object.assign(new Error("Location is required"), { status: 400 });
    if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });

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

    job.status = status;
    job.jobCategory = toCleanString(jobCategory || jobType || "Job");
    job.jobType = toCleanString(jobType || "Job");
    job.jobTitle = toCleanString(jobTitle);
    job.organizer = resolvedOrganizer;
    job.companyName = resolvedOrganizer;
    job.location = toCleanString(location);
    job.mode = toCleanString(mode);
    job.totalOpenings = Number(totalOpenings) || 0;
    job.duration = toCleanString(duration);
    job.jobStartDate = jobStartDate || undefined;
    job.applicationDeadline = applicationDeadline || undefined;
    job.salary = Number(salary) || 0;
    job.description = toCleanString(description);
    job.certificateAvailability = toCleanString(certificateAvailability);

    const parseArray = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch (e) { return [val]; }
      }
      return [];
    };

    job.responsibilities = parseArray(responsibilities);
    job.eligibility = parseArray(eligibility);
    job.skill_set = parseArray(skill_set);
    job.benefits = parseArray(benefits);
    job.learning_outcomes = parseArray(learning_outcomes);
    job.development_benefits = parseArray(development_benefits);
    job.development_resources = parseArray(development_resources);

    const savedJob = await job.save();

    return res.status(isUpdate ? 200 : 201).json({
      status: true,
      message: isUpdate ? "Job updated successfully" : "Job created successfully",
      data: savedJob,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllJobs = async (req, res, next) => {
  try {
    const user = req.user;
    const { status } = req.query;

    let query = {};

    if (user?.role === "company") {
      query.c_by = user._id;
    } else {
      switch (status) {
        case "community":
          query.c_by = user._id;
          break;
        case "pending":
        case "approved":
        case "rejected":
          query.status = status;
          break;
        default:
          query.status = "pending";
      }
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const data = await Promise.all(
      jobs.map(async (item) => {
        const appliedCount = await AppliedJob.countDocuments({
          jobId: item._id,
          jobType: "Job",
        });
        return { ...item, appliedCount };
      })
    );

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

    return res.status(200).json({
      success: true,
      status: true,
      message: "Job fetched successfully",
      data: {
        internship: job,
        job,
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

    return res.status(200).json({
      status: true,
      message: `Job status updated to ${job.isActive ? "Active" : "Inactive"}`,
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

export const getAppliedCandidateProfile = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const application = await AppliedJob.findById(applicationId)
      .populate("userId", "name email phone profileImage")
      .populate("resumeId");

    if (!application) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }

    const userDetails = await UserDetails.findOne({ userId: application.userId._id });

    return res.status(200).json({
      status: true,
      data: {
        application,
        userDetails,
      },
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
    const candidates = await AppliedJob.find({ jobId, status: "selected" })
      .populate("userId", "name email phone profileImage")
      .populate("resumeId");

    return res.status(200).json({
      status: true,
      data: candidates,
    });
  } catch (error) {
    next(error);
  }
};

export const saveAttendance = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { date, attendanceList } = req.body;

    if (!date || !Array.isArray(attendanceList)) {
      throw Object.assign(new Error("Date and attendance list are required"), { status: 400 });
    }

    const records = await Promise.all(
      attendanceList.map((item) =>
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

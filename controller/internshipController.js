import mongoose from "mongoose";
import Internship from "../models/internshipModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import Attendance from "../models/attendanceModel.js";
import UserDetails from "../models/userDetails.js";
import { notifyJobAudience } from "../helper/jobNotification.js";

const toCleanString = (value) =>
    typeof value === "string" ? value.trim() : "";




export const createInternshipForm = async (req, res, next) => {
    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id || req.params?.id;;
        const isUpdate = !!targetId;
        const status=req?.user?.role==="admin"?"approved":"pending"
        const {
            internshipType,
            jobTitle,
            organizer,
            companyName,
            location,
            mode,
            totalOpenings,
            duration,
            internStartDate,
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
            development_resources
        } = rest;

        // Validation
        if (!internshipType) throw Object.assign(new Error("Internship Type is required"), { status: 400 });
        if (!jobTitle) throw Object.assign(new Error("Job Title is required"), { status: 400 });
        const resolvedOrganizer = toCleanString(organizer || companyName);

        if (!resolvedOrganizer) throw Object.assign(new Error("Organizer is required"), { status: 400 });
        if (!location) throw Object.assign(new Error("Location is required"), { status: 400 });
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });

        let internship;

        if (isUpdate) {
            internship = await Internship.findById(targetId);
            if (!internship) {
                throw Object.assign(new Error("Internship not found"), { status: 404 });
            }
            if (req.user?.role === "company" && internship.c_by?.toString() !== req.user._id?.toString()) {
                throw Object.assign(new Error("Not authorized to update this internship"), { status: 403 });
            }
        } else {
            internship = new Internship({ c_by: req.user._id });
            internship.status=status
        }
internship.status=status
        // Update fields
        internship.internshipType = toCleanString(internshipType);
        internship.jobTitle = toCleanString(jobTitle);
        internship.organizer = resolvedOrganizer;
        internship.companyName = resolvedOrganizer;
        internship.location = toCleanString(location);
        internship.mode = toCleanString(mode);
        internship.totalOpenings = Number(totalOpenings) || 0;
        internship.duration = toCleanString(duration);
        internship.internStartDate = internStartDate || undefined;
        internship.applicationDeadline = applicationDeadline || undefined;
        internship.salary = Number(salary) || 0;
        internship.description = toCleanString(description);
        internship.certificateAvailability = toCleanString(certificateAvailability);
        
        // Handle dynamic arrays (sent as JSON strings or raw arrays depending on frontend)
        const parseArray = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === "string") {
                try { return JSON.parse(val); } catch (e) { return [val]; }
            }
            return [];
        };

        internship.responsibilities = parseArray(responsibilities);
        internship.eligibility = parseArray(eligibility);
        internship.skill_set=parseArray(skill_set)
        internship.benefits=parseArray(benefits)
        internship.learning_outcomes=parseArray(learning_outcomes)
        internship.development_benefits=parseArray(development_benefits)
        internship.development_resources=parseArray(development_resources)


        await internship.save();
  //       if(!isUpdate){
  //         notifyJobAudience(internship, req.user._id, isUpdate, "Internship").catch((e) =>
  //   console.error("Freelance notification error:", e.message)
  // );
        // }
        
        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Internship ${isUpdate ? "updated" : "created"} successfully`,
            data: internship,
        });

    } catch (error) {
        next(error);
    }
};

export const getAllInternships = async (req, res, next) => {
  try {
    const user = req.user;
    const { status } = req.query;

    let query = {};

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

    const internships = await Internship.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // ── Attach appliedCount to each internship ──────────────
    const data = await Promise.all(
      internships.map(async (item) => {
        const appliedCount = await AppliedJob.countDocuments({
          jobId: item._id,
          jobType: "Internship",
        });
        return { ...item, appliedCount };
      })
    );

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};



export const getInternshipById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const internship = await Internship.findById(id).lean();

    if (!internship) {
      throw Object.assign(new Error("Internship not found"), { status: 404 });
    }

    if (
      req.user?.role === "company" &&
      internship.c_by?.toString() !== req.user._id?.toString()
    ) {
      throw Object.assign(new Error("Internship not found"), { status: 404 });
    }

    // ── Get Applied List ────────────────────────────────────
    const applications = await AppliedJob.find({
      jobId: id,
      jobType: "Internship",
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
          name:app.userId?.name,
          mail: app.userId?.email || "",
          contact: app.userId?.phone || "",
          appliedAt: app.createdAt,
          location:app.location,
          status: app.status || "applied",
          // UserDetails
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
      data: {
        internship,
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

export const toggleInternshipStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const internship = await Internship.findById(id);

        if (!internship) {
            throw Object.assign(new Error("Internship not found"), { status: 404 });
        }
        if (req.user?.role === "company" && internship.c_by?.toString() !== req.user._id?.toString()) {
            throw Object.assign(new Error("Not authorized to update this internship"), { status: 403 });
        }

        internship.isActive = !internship.isActive;
        await internship.save();

        res.status(200).json({
            success: true,
            message: `Internship ${internship.isActive ? "activated" : "deactivated"} successfully`,
            data: internship,
        });
    } catch (error) {
        next(error);
    }
};

// ── Update Application Status (Select Candidate) ────────────────
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!["applied", "selected", "rejected"].includes(status)) {
      throw Object.assign(new Error("Invalid status value"), { status: 400 });
    }

    const application = await AppliedJob.findById(applicationId);
    if (!application) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }

    application.status = status;
    await application.save();

    res.status(200).json({
      success: true,
      message: `Candidate status updated to ${status}`,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get Selected Candidates for Internship ──────────────────────
export const getSelectedCandidates = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const applications = await AppliedJob.find({
      jobId,
      status: "selected",
    })
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    const selectedList = await Promise.all(
      applications.map(async (app, index) => {
        const userDetails = await UserDetails.findOne({
          userId: app.userId?._id,
        })
          .select("collegeName ugDegree ugYear pgDegree pgYear")
          .lean();

        return {
          id: app.userId?._id || app._id,
          applicationId: app._id,
          sNo: String(index + 1).padStart(2, "0"),
          name: app.userId?.name || "Candidate",
          mail: app.userId?.email || "",
          contact: app.userId?.phone || "",
          college: userDetails?.collegeName || "-",
          department: userDetails?.pgDegree || userDetails?.ugDegree || "-",
          year: userDetails?.ugYear || userDetails?.pgYear || "-",
        };
      })
    );

    res.status(200).json({
      success: true,
      count: selectedList.length,
      data: selectedList,
    });
  } catch (error) {
    next(error);
  }
};

// ── Save / Update Daily Attendance ─────────────────────────────
export const saveAttendance = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { date, records } = req.body;

    if (!date || !Array.isArray(records)) {
      throw Object.assign(new Error("Date and records array are required"), { status: 400 });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const operations = records.map((record) => {
      const recordStatus = (record.status || "").toLowerCase();
      const validStatus = recordStatus === "absent" ? "absent" : "present";

      return {
        updateOne: {
          filter: { jobId, userId: record.userId, date: attendanceDate },
          update: {
            $set: {
              jobId,
              jobType: "Internship",
              userId: record.userId,
              c_by: req.user._id,
              date: attendanceDate,
              status: validStatus,
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
    }

    res.status(200).json({
      success: true,
      message: "Attendance saved successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ── Get Attendance History List (Grouped by Date) ─────────────
export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const history = await Attendance.aggregate([
      { $match: { jobId: new mongoose.Types.ObjectId(jobId) } },
      {
        $group: {
          _id: { $dateToString: { format: "%d/%m/%Y", date: "$date" } },
          rawDate: { $first: "$date" },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
        },
      },
      { $sort: { rawDate: -1 } },
    ]);

    const formattedHistory = history.map((item, index) => ({
      id: item._id,
      sNo: String(index + 1).padStart(2, "0"),
      date: item._id,
      rawDate: item.rawDate,
      presentCount: item.presentCount,
      absentCount: item.absentCount > 0 ? item.absentCount : null,
    }));

    res.status(200).json({
      success: true,
      count: formattedHistory.length,
      data: formattedHistory,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get Date Attendance Details ────────────────────────────────
export const getAttendanceDetails = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw Object.assign(new Error("Date query parameter is required"), { status: 400 });
    }

    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    const attendanceRecords = await Attendance.find({
      jobId,
      date: searchDate,
    })
      .populate("userId", "name email phone")
      .lean();

    const candidateDetails = await Promise.all(
      attendanceRecords.map(async (record, index) => {
        const userDetails = await UserDetails.findOne({
          userId: record.userId?._id,
        })
          .select("collegeName")
          .lean();

        return {
          id: record.userId?._id || record._id,
          sNo: String(index + 1).padStart(2, "0"),
          name: record.userId?.name || "Candidate",
          college: userDetails?.collegeName || "-",
          contact: record.userId?.phone || "-",
          mail: record.userId?.email || "-",
          status: record.status === "present" ? "Present" : "Absent",
        };
      })
    );

    res.status(200).json({
      success: true,
      data: candidateDetails,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get Applied Candidate Profile ───────────────────────────────
export const getAppliedCandidateProfile = async (req, res, next) => {
  try {
    const { applicationId } = req.params;

    const application = await AppliedJob.findById(applicationId)
      .populate("userId", "name email phone role")
      .populate("resumeId", "fileName fileUrl fileSize mimeType")
      .lean();

    if (!application) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }

    const userDetails = await UserDetails.findOne({
      userId: application.userId?._id,
    }).lean();

    const candidateProfile = {
      applicationId: application._id,
      jobId: application.jobId,
      jobType: application.jobType,
      status: application.status || "applied",
      appliedAt: application.createdAt,

      // Personal Info
      name: userDetails?.name || application.userId?.name || "",
      email: application.userId?.email || "",
      mail: application.userId?.email || "",
      contact: application.userId?.phone || "",
      phoneNumber: application.userId?.phone || "",
      profilePic: userDetails?.profile_pic || null,
      profile_pic: userDetails?.profile_pic || null,
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
      resumeUrl: application.resumeId?.fileUrl || "",
      resumeName: application.resumeId?.fileName || "Resume.pdf",
    };

    res.status(200).json({
      success: true,
      data: candidateProfile,
    });
  } catch (error) {
    next(error);
  }
};


import College from "../models/collegeModel.js";
import User from "../models/userModel.js";
import fs from "fs";
import path from "path";
import Event from "../models/eventModel.js";
import Internship from "../models/internshipModel.js";
import Company from "../models/companyModel.js";

import Freelance from "../models/freelanceModel.js";
import SavedJob from "../models/savedJobModel.js";
import AppliedJob from "../models/appliedJobModel.js";

import { checkIsSaved } from "../helper/isSaved.js";
import { checkIsApplied } from "../helper/isApplied.js";

import Competition from "../models/competitionModel.js";
import EventRegistration from "../models/eventRegistrationModel.js";

import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";




const toCleanString = (value) =>
    typeof value === "string" ? value.trim() : "";

const toCleanStringArray = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => toCleanString(item))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];

        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((item) => toCleanString(item))
                        .filter(Boolean);
                }
            } catch (_error) {
                // Ignore JSON parse errors and fall back to comma-separated parsing.
            }
        }

        return trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
};

const getUploadedFilePath = (file) => {
    if (!file?.path) return "";
    return path.relative(process.cwd(), file.path).replace(/\\/g, "/");
};

const cleanupUploadedFiles = (files = []) => {
    files.forEach((file) => {
        if (!file?.path) return;
        fs.unlink(file.path, () => { });
    });
};

const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


export const getCollegeDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [
      totalConferences,
      activeConferences,
      totalCompetitions,
      activeCompetitions,
      totalSeminars,
      activeSeminars,
      totalEvents,
      activeEvents,
      lastRegistrations,
    ] = await Promise.all([
      // ── Conference ─────────────────────────────────────────
      Conference.countDocuments({ c_by: userId }),
      Conference.countDocuments({ c_by: userId, isActive: true }),

      // ── Competition ────────────────────────────────────────
      Competition.countDocuments({ c_by: userId }),
      Competition.countDocuments({ c_by: userId, isActive: true }),

      // ── Seminar ────────────────────────────────────────────
      Seminar.countDocuments({ c_by: userId }),
      Seminar.countDocuments({ c_by: userId, isActive: true }),

      // ── Event ──────────────────────────────────────────────
      Event.countDocuments({ c_by: userId }),
      Event.countDocuments({ c_by: userId, isActive: true }),

      // ── Last 5 registrations for this college's events ─────
      EventRegistration.find({ c_by: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({ path: "userId", select: "name email phone" }),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        stats: {
          conferences:  { total: totalConferences,  active: activeConferences },
          competitions: { total: totalCompetitions, active: activeCompetitions },
          seminars:     { total: totalSeminars,      active: activeSeminars },
          events:       { total: totalEvents,        active: activeEvents },
        },

        // Last 5 registered users
        lastRegistrations: lastRegistrations.map((item, i) => ({
          _id:         item._id,
          index:       `0${i + 1}`,
          fullName:    item.fullName,
          department:  item.department,
          collegeName: item.collegeName,
          year:        item.year,
          phoneNumber: item.phoneNumber,
          mailId:      item.mailId,
          eventType:   item.eventType,
          createdAt:   item.createdAt,
          user:        item.userId,
        })),
      },
    });
  } catch (error) {
    console.error("College Dashboard Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load college dashboard",
      error: error.message,
    });
  }
};


export const createCollegeForm = async (req, res, next) => {
    let oldLogoPath = null;

    try {
        const id = req.body?.id || req.body?._id;
        const isUpdate = !!id;

        const collegeLogoFile = req.files?.collegeLogo?.[0];

        const collegeName = toCleanString(req.body?.collegeName);
        const collegeType = toCleanString(req.body?.collegeType);
        const establishedYear = toCleanString(req.body?.establishedYear);
        const affiliatedUniversity = toCleanString(req.body?.affiliatedUniversity);
        const totalDepartments = toCleanString(req.body?.totalDepartments);
        const totalStudents = toCleanString(req.body?.totalStudents);
        const placementAvailable = toCleanString(req.body?.placementAvailable);
        const aboutUs = toCleanString(req.body?.aboutUs);
        const contactPersonName = toCleanString(req.body?.contactPersonName);
        const address = toCleanString(req.body?.address);
        const city = toCleanString(req.body?.city);
        const state = toCleanString(req.body?.state);
        const pincode = toCleanString(req.body?.pincode);
        const mailId = toCleanString(req.body?.mailId).toLowerCase();
        const phoneNumber = toCleanString(req.body?.phoneNumber);

        const departments = toCleanStringArray(req.body?.departments);
        const coursesAvailable = toCleanStringArray(req.body?.coursesAvailable);

        let collegeLogo = getUploadedFilePath(collegeLogoFile);

        // Validation
        if (!collegeName) throw Object.assign(new Error("College Name is required"), { status: 400 });
        if (!collegeType) throw Object.assign(new Error("College Type is required"), { status: 400 });
        if (!isUpdate && !collegeLogo) throw Object.assign(new Error("College Logo is required"), { status: 400 });
        if (!contactPersonName) throw Object.assign(new Error("Contact Person Name is required"), { status: 400 });
        if (!phoneNumber) throw Object.assign(new Error("Phone Number is required"), { status: 400 });
        if (!mailId) throw Object.assign(new Error("Mail Id is required"), { status: 400 });
        if (!PHONE_REGEX.test(phoneNumber)) throw Object.assign(new Error("Phone Number must be exactly 10 digits"), { status: 400 });
        if (!EMAIL_REGEX.test(mailId)) throw Object.assign(new Error("Mail Id format is invalid"), { status: 400 });
        if (!address) throw Object.assign(new Error("Address is required"), { status: 400 });
        if (!city) throw Object.assign(new Error("City is required"), { status: 400 });
        if (!state) throw Object.assign(new Error("State is required"), { status: 400 });
        if (!pincode) throw Object.assign(new Error("Pincode is required"), { status: 400 });
        if (departments.length < 3) throw Object.assign(new Error("At least 3 Departments values are required"), { status: 400 });
        if (coursesAvailable.length < 1) throw Object.assign(new Error("At least 1 Course values are required"), { status: 400 });
        if (!totalStudents) throw Object.assign(new Error("Total Students is required"), { status: 400 });
        if (!aboutUs) throw Object.assign(new Error("About Us is required"), { status: 400 });


        // Uniqueness check for email and phone
        let currentUserId = null;
        if (isUpdate) {
            const existingCollege = await College.findById(id);
            if (existingCollege) currentUserId = existingCollege.userId;
        }

        const emailExists = await User.findOne({ email: mailId });
        if (emailExists && (!isUpdate || emailExists._id.toString() !== currentUserId?.toString())) {
            throw Object.assign(new Error("Email is already registered with another account"), { status: 400 });
        }

        const phoneExists = await User.findOne({ phone: phoneNumber });
        if (phoneExists && (!isUpdate || phoneExists._id.toString() !== currentUserId?.toString())) {
            throw Object.assign(new Error("Phone number is already registered with another account"), { status: 400 });
        }

        // Target User Account Management
        let targetUser = await User.findOne({ email: mailId });

        if (targetUser) {
            // Update existing user to be associated with this college
            targetUser.name = collegeName;
            targetUser.phone = phoneNumber;
            targetUser.role = "college";
            await targetUser.save();
        } else {
            // Create new user account for the college
            targetUser = await User.create({
                name: collegeName,
                email: mailId,
                phone: phoneNumber,
                role: "college",
                password: null,
            
            });
        }

        const targetUserId = targetUser._id;
        const creatorId = req.user._id;

        let college;

        if (isUpdate) {
            college = await College.findById(id);
            if (!college) throw Object.assign(new Error("College not found"), { status: 404 });

            // Prepare cleanup of old files if new ones are uploaded
            if (collegeLogo) {
                oldLogoPath = college.collegeLogo;
                college.collegeLogo = collegeLogo;
            }

            // Update fields
            college.userId = targetUserId;
            college.collegeName = collegeName;
            college.collegeType = collegeType;
            college.establishedYear = establishedYear || "";
            college.affiliatedUniversity = affiliatedUniversity || "";
            college.totalDepartments = totalDepartments || "";
            college.totalStudents = totalStudents || "";
            college.placementAvailable = placementAvailable || "";
            college.aboutUs = aboutUs || "";
            college.contactPersonName = contactPersonName;
            college.address = address;
            college.city = city;
            college.state = state;
            college.pincode = pincode;
            college.departments = departments;
            college.coursesAvailable = coursesAvailable;

            await college.save();
        } else {
            college = await College.create({
                c_by: creatorId,
                userId: targetUserId,
                collegeName,
                collegeType,
                establishedYear: establishedYear || "",
                affiliatedUniversity: affiliatedUniversity || "",
                totalDepartments: totalDepartments || "",
                totalStudents: totalStudents || "",
                placementAvailable: placementAvailable || "",
                aboutUs: aboutUs || "",
                collegeLogo,
                contactPersonName,
                address,
                city,
                state,
                pincode,
                departments,
                coursesAvailable,
            });
        }

        // Cleanup old files ONLY on successful update
        if (oldLogoPath) fs.unlink(path.join(process.cwd(), oldLogoPath), () => { });

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `College form ${isUpdate ? "updated" : "created"} successfully`,
            data: college,
        });
    } catch (error) {
        // Cleanup newly uploaded files on failure
        cleanupUploadedFiles([
            ...(req.files?.collegeLogo || []),
        ]);
        next(error);
    }
};

export const getAllCollege = async (req, res, next) => {
    try {
        const colleges = await College.find({}).populate("userId", "email phone role isActive").lean();

        const flattenedColleges = colleges.map(college => {
            const { userId, ...rest } = college;
            return {
                ...rest,
                email: userId?.email || "",
                phone: userId?.phone || "",
                role: userId?.role || "",
                isActive: userId?.isActive ?? true
            };
        });

        res.status(200).json({
            success: true,
            data: flattenedColleges,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleCollegeStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const college = await College.findById(id);

        if (!college) {
            const error = new Error("College not found");
            error.status = 404;
            throw error;
        }

        const user = await User.findById(college.userId);
        if (!user) {
            const error = new Error("Associated user not found");
            error.status = 404;
            throw error;
        }

        user.is_active= !user.is_active;
        await user.save();

        res.status(200).json({
            success: true,
            message: `Account ${user.is_active ? "activated" : "deactivated"} successfully`,
            data: { ...college.toObject(), is_active: user.is_active }
        });
    } catch (error) {
        next(error);
    }
};

export const setPassword = async (req, res, next) => {
    try {
        const { id, password, confirmPassword } = req.body;

        if (!id || !password || !confirmPassword) {
            const error = new Error("College ID, password, and confirm password are required");
            error.status = 400;
            throw error;
        }

        if (password !== confirmPassword) {
            const error = new Error("Passwords do not match");
            error.status = 400;
            throw error;
        }

        const college = await College.findById(id);
        if (!college) {
            const error = new Error("College not found");
            error.status = 404;
            throw error;
        }

        const user = await User.findById(college.userId);
        if (!user) {
            const error = new Error("Associated user account not found");
            error.status = 404;
            throw error;
        }

        // The pre-save hook in userModel will hash this
        user.password = password;
        user.is_active = true
        user.register_status="completed"
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (error) {
        next(error);
    }
};


// export const getCollegeById = async (req, res, next) => {
//     try {
//         const { id } = req.params;
//         const college = await College.findById(id).populate("userId", "email phone role isActive").lean();

//         if (!college) {
//             const error = new Error("College not found");
//             error.status = 404;
//             throw error;
//         }

//         const { userId, ...rest } = college;
//         const flattenedCollege = {
//             ...rest,
//             email: userId?.email || "",
//             phone: userId?.phone || "",
//             role: userId?.role || "",
//             isActive: userId?.isActive ?? true
//         };

//         res.status(200).json({
//             success: true,
//             data: flattenedCollege,
//         });
//     } catch (error) {
//         next(error);
//     }
// };


export const getCollegeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const college = await College.findById(id)
      .populate("userId", "email phone role is_active")
      .lean();

    if (!college) {
      const error = new Error("College not found");
      error.status = 404;
      throw error;
    }

    const { userId, ...rest } = college;
    const collegeUserId = userId?._id;

    const flattenedCollege = {
      ...rest,
      email: userId?.email || "",
      phone: userId?.phone || "",
      role: userId?.role || "",
      is_active: userId?.is_active ?? true,
    };

    // ── Fetch all events by c_by = collegeUserId ────────────
    const [conferences, events, competitions, seminars] = await Promise.all([
      Conference.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Event.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName eventType organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Competition.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Seminar.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName eventType organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),
    ]);

    // ── Helper: attach appliedCount to each event list ──────
    const attachAppliedCount = async (list, eventTypeName) => {
      return Promise.all(
        list.map(async (item) => {
          const appliedCount = await EventRegistration.countDocuments({
            eventId: item._id,
            eventType: eventTypeName,
          });
          return { ...item, appliedCount };
        })
      );
    };

    // ── Attach applied counts in parallel ───────────────────
    const [
      conferencesWithCount,
      eventsWithCount,
      competitionsWithCount,
      seminarsWithCount,
    ] = await Promise.all([
      attachAppliedCount(conferences, "Conference"),
      attachAppliedCount(events, "Event"),
      attachAppliedCount(competitions, "Competition"),
      attachAppliedCount(seminars, "Seminar"),
    ]);

    const totalCount =
      conferences.length +
      events.length +
      competitions.length +
      seminars.length;

    return res.status(200).json({
      success: true,
      data: {
        college: flattenedCollege,
        events: {
          conferences: conferencesWithCount,
          conferencesCount: conferences.length,
          events: eventsWithCount,
          eventsCount: events.length,
          competitions: competitionsWithCount,
          competitionsCount: competitions.length,
          seminars: seminarsWithCount,
          seminarsCount: seminars.length,
          totalCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getMyCollege= async (req, res, next) => {
  try {
    const  id  = req.user._id;

    const college = await College.findOne({userId:id})
      .populate("userId", "email phone role is_active")
      .lean();

    if (!college) {
      const error = new Error("College not found");
      error.status = 404;
      throw error;
    }

    const { userId, ...rest } = college;
    const collegeUserId = userId?._id;

    const flattenedCollege = {
      ...rest,
      email: userId?.email || "",
      phone: userId?.phone || "",
      role: userId?.role || "",
      is_active: userId?.is_active ?? true,
    };

    // ── Fetch all events by c_by = collegeUserId ────────────
    const [conferences, events, competitions, seminars] = await Promise.all([
      Conference.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Event.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName eventType organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Competition.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),

      Seminar.find({ c_by: collegeUserId })
        .sort({ createdAt: -1 })
        .select("eventName eventType organizer mode eventDate registrationType totalSeats individualFees isActive createdAt")
        .lean(),
    ]);

    // ── Helper: attach appliedCount to each event list ──────
    const attachAppliedCount = async (list, eventTypeName) => {
      return Promise.all(
        list.map(async (item) => {
          const appliedCount = await EventRegistration.countDocuments({
            eventId: item._id,
            eventType: eventTypeName,
          });
          return { ...item, appliedCount };
        })
      );
    };

    // ── Attach applied counts in parallel ───────────────────
    const [
      conferencesWithCount,
      eventsWithCount,
      competitionsWithCount,
      seminarsWithCount,
    ] = await Promise.all([
      attachAppliedCount(conferences, "Conference"),
      attachAppliedCount(events, "Event"),
      attachAppliedCount(competitions, "Competition"),
      attachAppliedCount(seminars, "Seminar"),
    ]);

    const totalCount =
      conferences.length +
      events.length +
      competitions.length +
      seminars.length;

    return res.status(200).json({
      success: true,
      data: {
        college: flattenedCollege,
        events: {
          conferences: conferencesWithCount,
          conferencesCount: conferences.length,
          events: eventsWithCount,
          eventsCount: events.length,
          competitions: competitionsWithCount,
          competitionsCount: competitions.length,
          seminars: seminarsWithCount,
          seminarsCount: seminars.length,
          totalCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
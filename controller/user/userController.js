import Event from "../../models/eventModel.js";
import Internship from "../../models/internshipModel.js";
import Company from "../../models/companyModel.js";

import Freelance from "../../models/freelanceModel.js";
import SavedJob from "../../models/savedJobModel.js";
import AppliedJob from "../../models/appliedJobModel.js";

import { checkIsSaved } from "../../helper/isSaved.js";
import { checkIsApplied } from "../../helper/isApplied.js";

import Competition from "../../models/competitionModel.js";
import EventRegistration from "../../models/eventRegistrationModel.js";
import { checkIsRegistered } from "../../helper/isRegistered.js";


import Conference from "../../models/conferenceModel.js";
import Seminar from "../../models/seminarModel.js";


import CompanyFollow from "../../models/companyFollowModel.js";

const userDashboard = async (req, res) => {
  try {
    const userId = req.user._id
    const [popularEvents, preferredInternships, topCompanies] =
      await Promise.all([
        // ── Popular Events ─────────────────────────────────────────

        Event.find({ isActive: true })
          .sort({ createdAt: -1 })
          .limit(3)
          .select("eventName coverImage organizer c_by mode description individualFees teamFees lateFees totalSeats eventDate geoLocation image isActive createdAt"),

        // ── Preferred Internships ──────────────────────────────────
        // No condition, latest 3
        Internship.find({ isActive: true })
          .sort({ createdAt: -1 })
          .limit(3)
          .select("jobTitle c_by location companyName duration salary eligibility createdAt")
          .populate("c_by", "role"),
        // ── Top Companies ──────────────────────────────────────────
        // Latest 4 companies
        Company.find()
          .sort({ createdAt: -1 })
          .limit(4)
          .select("companyName technologies companyTagLine companyLogo address state address industry website location createdAt"),
      ]);

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";
    console.log()
    const data = await Promise.all(
      preferredInternships.map(async (item) => {
        const obj = item.toObject();

        let companyImage = null;

        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;

        } else if (item.c_by?.role === "company") {

          const company = await Company.findOne({
            c_by: item.c_by,
          }).select("companyLogo").lean();
          companyImage = company?.companyLogo || null;
          console.log(company)
        }

        return {
          ...obj,
          companyImage,
          is_saved: await checkIsSaved(userId, item._id, "internship"),
          is_applied: await checkIsApplied(userId, item._id),
        };
      })
    );

    return res.status(200).json({
      status: true,
      data: {
        popularEvents,
        preferredInternships: data,
        topCompanies,
      },
    });
  } catch (error) {
    console.error("Dashboard API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load dashboard data",
      error: error.message,
    });
  }
};
// const getJobs = async (req, res) => {
//   try {
//     const [internships, freelance] = await Promise.all([
//       // ── Internships ────────────────────────────────────────────
//       Internship.find()
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select("jobTitle companyName duration salary eligibility createdAt"),

//       // ── Freelance ──────────────────────────────────────────────
//       Freelance.find()
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select("eligibility companyName jobTitle  jobStartDate totalOpenings mode salary createdAt"),
//     ]);

//     return res.status(200).json({
//       status: true,
//       data: {
//         internships,
//         freelance,
//       },
//     });
//   } catch (error) {
//     console.error("Jobs API Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load jobs data",
//       error: error.message,
//     });
//   }
// };

// const getAllInternships = async (req, res) => {
//   try {
//     const internships = await Internship.find()
//       .sort({ createdAt: -1 })
//       .select("jobTitle companyName duration salary eligibility createdAt");

//     return res.status(200).json({
//       status: true,
//       count: internships.length,
//       data: internships,
//     });
//   } catch (error) {
//     console.error("Internships API Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load internships",
//       error: error.message,
//     });
//   }
// };

// const getAllFreelances = async (req, res) => {
//   try {
//     const freelances = await Freelance.find()
//       .sort({ createdAt: -1 })
//       .select("eligibility companyName jobTitle  jobStartDate totalOpenings mode salary createdAt")

//     return res.status(200).json({
//       status: true,
//       count: freelances.length,
//       data:freelances,
//     });
//   } catch (error) {
//     console.error("Freelances API Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load Freelances",
//       error: error.message,
//     });
//   }
// };



const getJobs = async (req, res) => {
  try {
    const userId = req.user._id;

    const [internships, freelances] = await Promise.all([
      // ── Internships ────────────────────────────────────────────
      Internship.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .select("jobTitle location c_by companyName duration salary eligibility createdAt")
        .populate("c_by", "role"),

      // ── Freelance ──────────────────────────────────────────────
      Freelance.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .select("eligibility c_by description  companyName jobTitle jobStartDate totalOpenings mode salary createdAt")
        .populate("c_by", "role")
    ]);

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    const [internshipsWithSaved, freelancesWithSaved] = await Promise.all([

      // =========================
      // INTERNSHIPS
      // =========================
      Promise.all(
        internships.map(async (item) => {
          const obj = item.toObject();

          let companyImage = null;

          if (item.c_by?.role === "admin") {
            companyImage = STATIC_ADMIN_IMAGE;

          } else if (item.c_by?.role === "company") {
            const company = await Company.findOne({
              c_by: item.c_by._id,

            }).select("companyLogo").lean();

            companyImage = company?.companyLogo || null;
          }

          return {
            ...obj,
            companyImage,
            is_saved: await checkIsSaved(userId, item._id, "Internship"),
            is_applied: await checkIsApplied(userId, item._id),
          };
        })
      ),

      Promise.all(
        freelances.map(async (item) => {
          const obj = item.toObject();

          let companyImage = null;

          if (item.c_by?.role === "admin") {
            companyImage = STATIC_ADMIN_IMAGE;

          } else if (item.c_by?.role === "company") {
            const company = await Company.findOne({
              c_by: item.c_by._id,

            }).select("companyLogo").lean();

            companyImage = company?.companyLogo || null;
          }

          return {
            ...obj,
            companyImage,
            is_saved: await checkIsSaved(userId, item._id, "Freelance"),
            is_applied: await checkIsApplied(userId, item._id),
          };
        })
      ),

    ]);

    return res.status(200).json({
      status: true,
      data: {
        internships: internshipsWithSaved,
        freelance: freelancesWithSaved,
      },
    });
  } catch (error) {
    console.error("Jobs API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load jobs data",
      error: error.message,
    });
  }
};

const getAllInternships = async (req, res) => {
  try {
    const userId = req.user._id;
   
    const internships = await Internship.find()
      .sort({ createdAt: -1 })
      .select("jobTitle location companyName duration salary eligibility createdAt c_by")
      .populate("c_by", "role");

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    const data = await Promise.all(
      internships.map(async (item) => {
        const obj = item.toObject();
        let companyImage = null;
        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (item.c_by?.role === "company") {
          const company = await Company.findOne({
            c_by: item.c_by._id,

          }).select("companyLogo").lean();

          companyImage = company?.companyLogo || null;
        }

        return {
          ...obj,
          companyImage,
          is_saved: await checkIsSaved(userId, item._id, "Internship"),
          is_applied: await checkIsApplied(userId, item._id),
        };
      })
    );


    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Internships API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load internships",
      error: error.message,
    });
  }
};


const getAllFreelances = async (req, res) => {
  try {
    const userId = req.user._id;

    const freelances = await Freelance.find()
      .sort({ createdAt: -1 })
      .select("eligibility  description companyName jobTitle jobStartDate totalOpenings mode salary createdAt")
      .populate("c_by", "role"); // 🔴 required
    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";
    const data = await Promise.all(
      freelances.map(async (item) => {
        const obj = item.toObject();
        let companyImage = null;

        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (item.c_by?.role === "company") {
          const company = await Company.findOne({
            c_by: item.c_by._id,

          }).select("companyLogo").lean();

          companyImage = company?.companyLogo || null;
        }
        return {
          ...obj,
          companyImage,
          is_saved: await checkIsSaved(userId, item._id, "Freelance"),
          is_applied: await checkIsApplied(userId, item._id),
        };
      })
    );
    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Freelances API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load Freelances",
      error: error.message,
    });
  }
};




const toggleSavedJob = async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId, jobType } = req.body;
    console.log(jobId, jobType,userId)
    // Validate required fields
    if (!jobId || !jobType) {
      return res.status(400).json({
        success: false,
        message: "jobId and jobType are required",
      });
    }

    // Validate jobType
    if (!["Internship", "Freelance"].includes(jobType)) {
      return res.status(400).json({
        success: false,
        message: "jobType must be 'internship' or 'freelance'",
      });
    }

    // Check if already saved
    const existing = await SavedJob.findOne({ userId, jobId, jobType });

    if (existing) {
      // Already saved → unsave it
      await SavedJob.findByIdAndDelete(existing._id);
      return res.status(200).json({
        success: true,
        saved: false,
        message: "Job unsaved successfully",
      });
    } else {
      // Not saved → save it
      await SavedJob.create({ userId, jobId, jobType });
      return res.status(200).json({
        success: true,
        saved: true,
        message: "Job saved successfully",
      });
    }
  } catch (error) {
    console.error("Toggle Saved Job Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle saved job",
      error: error.message,
    });
  }
};

const getSavedJobs = async (req, res) => {
  try {
    const userId = req.user._id;

    const savedJobs = await SavedJob.find({ userId })
      .populate({
        path: "jobId",
        populate: {
          path: "c_by",
          select: "role",
        },
      })
      .sort({ createdAt: -1 });

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    const enrichedSavedJobs = await Promise.all(
      savedJobs.map(async (item) => {
        const job = item.jobId;

        if (!job) return null; // safety

        let companyImage = null;

        if (job.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (job.c_by?.role === "company") {
          const company = await Company.findOne({
            c_by: job.c_by._id,
          })
            .select("companyLogo")
            .lean();

          companyImage = company?.companyLogo || null;
        }

        return {
          ...item.toObject(),
          jobId: {
            ...job.toObject(),
            companyImage,
            is_saved: true,
            is_applied: await checkIsApplied(userId, job._id),
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedSavedJobs.length,
      data: enrichedSavedJobs.filter(Boolean),
    });
  } catch (error) {
    console.error("Get Saved Jobs Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch saved jobs",
      error: error.message,
    });
  }
};

const applyJob = async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId, jobType } = req.body;

    // Validate required fields
    if (!jobId || !jobType) {
      return res.status(400).json({
        status: false,
        message: "jobId and jobType are required",
      });
    }

    // Validate jobType
    if (!["Internship", "Freelance"].includes(jobType)) {
      return res.status(400).json({
        status: false,
        message: "jobType must be 'internship' or 'freelance'",
      });
    }

    // Check if already applied
    const existing = await AppliedJob.findOne({ userId, jobId });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: "You have already applied to this job",
      });
    }

    // Apply
    await AppliedJob.create({ userId, jobId, jobType });

    return res.status(201).json({
      status: true,
      is_applied: true,
      message: "Applied successfully",
    });
  } catch (error) {
    console.error("Apply Job Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to apply for job",
      error: error.message,
    });
  }
};

const getAppliedJobs = async (req, res) => {
  try {
    const userId = req.user._id;

    const appliedJobs = await AppliedJob.find({ userId })
      .populate({
        path: "jobId",
        populate: {
          path: "c_by",
          select: "role",
        },
      })
      .sort({ createdAt: -1 });

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    const enrichedAppliedJobs = await Promise.all(
      appliedJobs.map(async (item) => {
        const job = item.jobId;

        if (!job) return null;

        let companyImage = null;

        if (job.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (job.c_by?.role === "company") {
          const company = await Company.findOne({
            c_by: job.c_by._id,
          })
            .select("companyLogo")
            .lean();

          companyImage = company?.companyLogo || null;
        }

        return {
          ...item.toObject(),
          jobId: {
            ...job.toObject(),
            companyImage,

            // ✅ KEY DIFFERENCE
            is_applied: true,

            // ✅ Need to check saved
            is_saved: await checkIsSaved(
              userId,
              job._id,
              item.jobType // important for refPath
            ),
          },
        };
      })
    );

    return res.status(200).json({
      status: true,
      count: enrichedAppliedJobs.length,
      data: enrichedAppliedJobs.filter(Boolean),
    });
  } catch (error) {
    console.error("Get Applied Jobs Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch applied jobs",
      error: error.message,
    });
  }
};


const getJobProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    // Search internship first, then freelance
    let job = await Internship.findById(id);
    let jobType = "internship";

    if (!job) {
      job = await Freelance.findById(id);
      jobType = "freelance";
    }

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    const [is_saved, is_applied] = await Promise.all([
      checkIsSaved(userId, id, jobType),
      checkIsApplied(userId, id),
    ]);

    return res.status(200).json({
      status: true,
      jobType,
      data: {
        ...job.toObject(),
        is_saved,
        is_applied,
      },
    });
  } catch (error) {
    console.error("Job Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load job profile",
      error: error.message,
    });
  }
};

const getAllCompetitions = async (req, res) => {
  try {
    const userId = req.user._id;

    const competitions = await Competition.find()
      .sort({ createdAt: -1 })
      .select("eventName eventDate eligibilityDetails venueAddress geoLocation totalSeats individualFees teamFees lateFees mode registrationStartDate createdAt");

    const data = await Promise.all(
      competitions.map(async (item) => ({
        ...item.toObject(),
        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Competitions API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load competitions",
      error: error.message,
    });
  }
};


const getCompetitionProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    const competition = await Competition.findById(id);

    if (!competition) {
      return res.status(404).json({
        status: false,
        message: "Competition not found",
      });
    }

    const [is_registered] = await Promise.all([
      checkIsRegistered(userId, id),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...competition.toObject(),
        is_registered,
      },
    });
  } catch (error) {
    console.error("Competition Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load competition profile",
      error: error.message,
    });
  }
};

const createEventRegistration = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      eventId,
      eventType,
      fullName,
      department,
      collegeName,
      year,
      phoneNumber,
      mailId,
      food,
      foodType,
      accommodation,
      accommodationType,
    } = req.body;

    // Validate required fields
    if (!eventId || !eventType || !fullName || !department || !collegeName || !year || !phoneNumber || !mailId) {
      return res.status(400).json({
        status: false,
        message: "eventId, eventType, fullName, department, collegeName, year, phoneNumber and mailId are required",
      });
    }

    // Validate eventType
    if (!["Conference", "Competition", "Seminar", "Event"].includes(eventType)) {
      return res.status(400).json({
        status: false,
        message: "eventType must be 'conference', 'competition', 'seminar' or 'event'",
      });
    }

    // Validate foodType if food is yes
    if (food === "yes" && !foodType) {
      return res.status(400).json({
        status: false,
        message: "foodType is required when food is 'yes'",
      });
    }

    // Validate accommodationType if accommodation is yes
    if (accommodation === "yes" && !accommodationType) {
      return res.status(400).json({
        status: false,
        message: "accommodationType is required when accommodation is 'yes'",
      });
    }

    // Check if already registered
    const existing = await EventRegistration.findOne({ userId, eventId });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: "You have already registered for this event",
      });
    }

    // Create registration
    const registration = await EventRegistration.create({
      userId,
      eventId,
      eventType,
      fullName,
      department,
      collegeName,
      year,
      phoneNumber,
      mailId,
      food: food || "no",
      foodType: food === "yes" ? foodType : null,
      accommodation: accommodation || "no",
      accommodationType: accommodation === "yes" ? accommodationType : null,
    });

    return res.status(200).json({
      status: true,
      message: "Registered successfully",
      data: registration,
    });
  } catch (error) {
    console.error("Event Registration Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to register for event",
      error: error.message,
    });
  }
};
// ============================================
const getAllConferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const conferences = await Conference.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select(
        "eventName organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees venueAddress geoLocation eligibilityDetails teamOrIndividualEvent createdAt"
      );

    const data = await Promise.all(
      conferences.map(async (item) => ({
        ...item.toObject(),
        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Conferences API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load conferences",
      error: error.message,
    });
  }
};

const getConferenceProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    const conference = await Conference.findById(id);

    if (!conference) {
      return res.status(404).json({
        status: false,
        message: "Conference not found",
      });
    }

    const [is_registered] = await Promise.all([
      checkIsRegistered(userId, id),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...conference.toObject(),
        is_registered,
      },
    });
  } catch (error) {
    console.error("Conference Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load conference profile",
      error: error.message,
    });
  }
};

const getAllTechnicalEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    const events = await Event.find({ isActive: true, eventType: "Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees venueAddress geoLocation eligibilityDetails teamOrIndividualEvent createdAt"
      );

    const data = await Promise.all(
      events.map(async (item) => ({
        ...item.toObject(),

        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Technical Events API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load technical events",
      error: error.message,
    });
  }
};


const getAllNonTechnicalEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    const events = await Event.find({ isActive: true, eventType: "Non-Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees venueAddress geoLocation eligibilityDetails teamOrIndividualEvent createdAt"
      );

    const data = await Promise.all(
      events.map(async (item) => ({
        ...item.toObject(),

        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Non-Technical Events API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load non-technical events",
      error: error.message,
    });
  }
};


const getEventProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }
    const [is_registered] = await Promise.all([
      checkIsSaved(userId, id, "event"),
      checkIsRegistered(userId, id),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...event.toObject(),
        is_registered,
      },
    });
  } catch (error) {
    console.error("Event Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load event profile",
      error: error.message,
    });
  }
};



const getAllTechnicalSeminars = async (req, res) => {
  try {
    const userId = req.user._id;

    const seminars = await Seminar.find({ isActive: true, eventType: "Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees venueAddress geoLocation eligibilityDetails teamOrIndividualEvent createdAt"
      );

    const data = await Promise.all(
      seminars.map(async (item) => ({
        ...item.toObject(),
        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Technical Seminars API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load technical seminars",
      error: error.message,
    });
  }
};


const getAllNonTechnicalSeminars = async (req, res) => {
  try {
    const userId = req.user._id;

    const seminars = await Seminar.find({ isActive: true, eventType: "Non-Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees venueAddress geoLocation eligibilityDetails teamOrIndividualEvent createdAt"
      );

    const data = await Promise.all(
      seminars.map(async (item) => ({
        ...item.toObject(),
        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    return res.status(200).json({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Non-Technical Seminars API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load non-technical seminars",
      error: error.message,
    });
  }
};

/**
 * POST /api/seminars/profile
 * Body: { id }
 * Returns single seminar full profile with is_saved & is_registered
 */
const getSeminarProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    const seminar = await Seminar.findById(id);

    if (!seminar) {
      return res.status(404).json({
        status: false,
        message: "Seminar not found",
      });
    }

    const [is_registered] = await Promise.all([

      checkIsRegistered(userId, id),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...seminar.toObject(),
        is_saved,
        is_registered,
      },
    });
  } catch (error) {
    console.error("Seminar Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load seminar profile",
      error: error.message,
    });
  }
};

const getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user._id;

    const registrations = await EventRegistration.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "eventId",
        select:
          "eventName eventType organizer mode eventDate coverImage venueAddress geoLocation individualFees teamFees isActive",
      });

    return res.status(200).json({
      status: true,
      count: registrations.length,
      data: registrations,
    });
  } catch (error) {
    console.error("My Registrations API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load registered events",
      error: error.message,
    });
  }
};


const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select(
        "companyName companyType companyTagLine companyCultureTags companyLogo coverImage city state technologies whatWeDo yearFounded websiteLink createdAt"
      );
 
    return res.status(200).json({
      status: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error("Companies API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load companies",
      error: error.message,
    });
  }
};

const toggleFollow = async (req, res) => {
  try {
    const userId = req.user._id;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({
        status: false,
        message: "companyId is required",
      });
    }

    // Check if already following
    const existing = await CompanyFollow.findOne({ userId, companyId });

    if (existing) {
      // Unfollow
      await CompanyFollow.findByIdAndDelete(existing._id);
      const followCount = await CompanyFollow.countDocuments({ companyId });
      return res.status(200).json({
        status: true,
        is_following: false,
        followCount,
        message: "Unfollowed successfully",
      });
    } else {
      // Follow
      await CompanyFollow.create({ userId, companyId });
      const followCount = await CompanyFollow.countDocuments({ companyId });
      return res.status(201).json({
        status: true,
        is_following: true,
        followCount,
        message: "Followed successfully",
      });
    }
  } catch (error) {
    console.error("Toggle Follow Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to toggle follow",
      error: error.message,
    });
  }
};


const getFollowingList = async (req, res) => {
  try {
    const userId = req.user._id;

    const follows = await CompanyFollow.find({ userId })
      .sort({ createdAt: -1 })
      .populate({
        path: "companyId",
        select:
          "companyName companyType companyTagLine companyLogo coverImage city state technologies isActive",
      });

    return res.status(200).json({
      status: true,
      count: follows.length,
      data: follows.map((f) => f.companyId),
    });
  } catch (error) {
    console.error("Following List Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load following list",
      error: error.message,
    });
  }
};


const getCompanyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "id is required",
      });
    }

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
      });
    }

    const [followCount, isFollowing] = await Promise.all([
      CompanyFollow.countDocuments({ companyId: id }),
      CompanyFollow.findOne({ userId, companyId: id }),
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...company.toObject(),
        followCount,
        is_following: !!isFollowing,
      },
    });
  } catch (error) {
    console.error("Company Profile Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load company profile",
      error: error.message,
    });
  }
};


const attachFlags = async (items, type) =>
  Promise.all(
    items.map(async (item) => ({
      ...item.toObject(),
      is_registered: await checkIsRegistered(item._id),
    }))
);
const getEventsPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const [upcomingRaw, technicalRaw, nonTechnicalRaw] = await Promise.all([
      Event.find({ isActive: true, eventDate: { $gte: now } })
        .sort({ eventDate: 1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),

      Event.find({ isActive: true, eventType: "Technical" })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),

      Event.find({ isActive: true, eventType: "Non-Technical" })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),
    ]);

    const [upcomingEvents, technicalEvents, nonTechnicalEvents] = await Promise.all([
      attachFlags(upcomingRaw, "event"),
      attachFlags(technicalRaw, "event"),
      attachFlags(nonTechnicalRaw, "event"),
    ]);

    return res.status(200).json({
      status: true,
      data: { upcomingEvents, technicalEvents, nonTechnicalEvents },
    });
  } catch (error) {
    console.error("Events Page API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load events page",
      error: error.message,
    });
  }
};
const getSeminarsPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const [upcomingRaw, technicalRaw, nonTechnicalRaw] = await Promise.all([
      Seminar.find({ isActive: true, eventDate: { $gte: now } })
        .sort({ eventDate: 1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),

      Seminar.find({ isActive: true, eventType: "Technical" })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),

      Seminar.find({ isActive: true, eventType: "Non-Technical" })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("eventName eventType organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),
    ]);

    const [upcomingSeminars, technicalSeminars, nonTechnicalSeminars] = await Promise.all([
      attachFlags(upcomingRaw, "seminar"),
      attachFlags(technicalRaw, "seminar"),
      attachFlags(nonTechnicalRaw, "seminar"),
    ]);

    return res.status(200).json({
      status: true,
      data: { upcomingSeminars, technicalSeminars, nonTechnicalSeminars },
    });
  } catch (error) {
    console.error("Seminars Page API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load seminars page",
      error: error.message,
    });
  }
};
export {
  userDashboard,
  getJobs,
  getAllInternships,
  getAllFreelances,
  toggleSavedJob,
  getSavedJobs,
  applyJob,
  getAppliedJobs,
  getJobProfile,
  getAllCompetitions,
  getCompetitionProfile,
  createEventRegistration,
  getAllConferences,
  getConferenceProfile,
  getAllTechnicalEvents,
  getAllNonTechnicalEvents,
  getEventProfile,
  getAllTechnicalSeminars,
  getAllNonTechnicalSeminars,
  getSeminarProfile,
  getMyRegistrations,
  getAllCompanies,
  toggleFollow, 
  getFollowingList, 
  getCompanyProfile,
  getEventsPage, getSeminarsPage
};
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
import mongoose from "mongoose";

import CompanyFollow from "../../models/companyFollowModel.js";

import Location from "../../models/locationModel.js";
import { saveNotification } from "../../helper/saveNotification.js";
import { sendAndSaveNotification } from "../../helper/sendAndSaveNotification.js";
import JobSuggested from "../../models/jobSuggestedModel.js"
import { getCollegeByEventId } from "../../helper/collegeDetails.js";
import { getSeatAvailability } from "../../helper/getSeatAvailability.js";
import Payment from "../../models/paymentModel.js"
import User from "../../models/userModel.js"

// const userDashboard = async (req, res) => {
//   try {
//     const userId = req.user._id
//     const [popularEvents, preferredInternships, topCompanies] =
//       await Promise.all([
//         // ── Popular Events ─────────────────────────────────────────

//         Event.find({ isActive: true })
//           .sort({ createdAt: -1 })
//           .limit(3)
//           .select("eventName coverImage organizer c_by mode description individualFees teamFees lateFees totalSeats eventDate geoLocation image isActive createdAt"),

//         // ── Preferred Internships ──────────────────────────────────
//         // No condition, latest 3
//         Internship.find({ isActive: true })
//           .sort({ createdAt: -1 })
//           .limit(3)
//           .select("jobTitle c_by location companyName duration salary eligibility createdAt")
//           .populate("c_by", "role"),
//         // ── Top Companies ──────────────────────────────────────────
//         // Latest 4 companies
//         Company.find()
//           .sort({ createdAt: -1 })
//           .limit(4)
//           .select("companyName technologies companyTagLine companyLogo address state address industry website location createdAt"),
//       ]);

//     const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";
//     console.log()
//     const data = await Promise.all(
//       preferredInternships.map(async (item) => {
//         const obj = item.toObject();

//         let companyImage = null;

//         if (item.c_by?.role === "admin") {
//           companyImage = STATIC_ADMIN_IMAGE;

//         } else if (item.c_by?.role === "company") {

//           const company = await Company.findOne({
//             c_by: item.c_by,
//           }).select("companyLogo").lean();
//           companyImage = company?.companyLogo || null;
//           console.log(company)
//         }

//         return {
//           ...obj,
//           companyImage,
//           is_saved: await checkIsSaved(userId, item._id, "internship"),
//           is_applied: await checkIsApplied(userId, item._id),
//         };
//       })
//     );

//     return res.status(200).json({
//       status: true,
//       data: {
//         popularEvents,
//         preferredInternships: data,
//         topCompanies,
//       },
//     });
//   } catch (error) {
//     console.error("Dashboard API Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load dashboard data",
//       error: error.message,
//     });
//   }
// };
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



// const getJobs = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     const [internships, freelances] = await Promise.all([
//       // ── Internships ────────────────────────────────────────────
//       Internship.find()
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select("jobTitle location c_by companyName duration salary eligibility createdAt")
//         .populate("c_by", "role"),

//       // ── Freelance ──────────────────────────────────────────────
//       Freelance.find()
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select("eligibility c_by description  companyName jobTitle jobStartDate totalOpenings mode salary createdAt")
//         .populate("c_by", "role")
//     ]);

//     const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

//     const [internshipsWithSaved, freelancesWithSaved] = await Promise.all([

//       // =========================
//       // INTERNSHIPS
//       // =========================
//       Promise.all(
//         internships.map(async (item) => {
//           const obj = item.toObject();

//           let companyImage = null;

//           if (item.c_by?.role === "admin") {
//             companyImage = STATIC_ADMIN_IMAGE;

//           } else if (item.c_by?.role === "company") {
//             const company = await Company.findOne({
//               c_by: item.c_by._id,

//             }).select("companyLogo").lean();

//             companyImage = company?.companyLogo || null;
//           }

//           return {
//             ...obj,
//             companyImage,
//             is_saved: await checkIsSaved(userId, item._id, "Internship"),
//             is_applied: await checkIsApplied(userId, item._id),
//           };
//         })
//       ),

//       Promise.all(
//         freelances.map(async (item) => {
//           const obj = item.toObject();

//           let companyImage = null;

//           if (item.c_by?.role === "admin") {
//             companyImage = STATIC_ADMIN_IMAGE;

//           } else if (item.c_by?.role === "company") {
//             const company = await Company.findOne({
//               c_by: item.c_by._id,

//             }).select("companyLogo").lean();

//             companyImage = company?.companyLogo || null;
//           }

//           return {
//             ...obj,
//             companyImage,
//             is_saved: await checkIsSaved(userId, item._id, "Freelance"),
//             is_applied: await checkIsApplied(userId, item._id),
//           };
//         })
//       ),

//     ]);

//     return res.status(200).json({
//       status: true,
//       data: {
//         internships: internshipsWithSaved,
//         freelance: freelancesWithSaved,
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
const userDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    // ── Step 1: Get applied job IDs ─────────────────────────────
    const appliedJobs = await AppliedJob.find({ userId }).select("jobId");
    const appliedIds = new Set(appliedJobs.map((a) => a.jobId.toString()));

    // ── Step 2: Fetch data ──────────────────────────────────────
    const [popularEventsRaw, topCompanies, suggestedJobs] = await Promise.all([
      Event.find({ isActive: true ,status:"approved"})
        .sort({ createdAt: -1 })
        .limit(3)
        .select(
          "eventName coverImage registrationType organizer c_by mode description individualFees teamFees lateFees totalSeats eventDate city image isActive createdAt"
        ),

      Company.find()
        .sort({ createdAt: -1 })
        .limit(4)
        .select(
          "companyName technologies companyTagLine companyLogo address state industry website location createdAt"
        ),

      // ── Suggestions: only Internship type, not yet applied ────
      JobSuggested.find({ userId, jobType: "Internship" })
        .populate({
          path: "jobId",
          select:
            "jobTitle location c_by companyName duration salary eligibility createdAt isActive",
          populate: { path: "c_by", select: "role" },
        })
        .sort({ createdAt: -1 }),
    ]);

    // ── Step 3: Enrich events with is_registered ────────────────
    const popularEvents = await Promise.all(
      popularEventsRaw.map(async (item) => ({
        ...item.toObject(),
        is_registered: await checkIsRegistered(userId, item._id),
      }))
    );

    // ── Step 4: Build preferredInternships from suggestions ─────
    //           • skip deleted jobs
    //           • skip already-applied jobs
    //           • limit to 3
    const preferredInternshipsData = (
      await Promise.all(
        suggestedJobs.map(async (item) => {
          const job = item.jobId;

          // job deleted or inactive
          if (!job || job.isActive === false) return null;

          // already applied → exclude
          if (appliedIds.has(job._id.toString())) return null;

          let companyImage = null;
          if (job.c_by?.role === "admin") {
            companyImage = STATIC_ADMIN_IMAGE;
          } else if (job.c_by?.role === "company") {
            const company = await Company.findOne({ userId: job.c_by._id })
              .select("companyLogo")
              .lean();
            companyImage = company?.companyLogo || null;
          }

          return {
            ...job.toObject(),
            companyImage,
            is_applied: false,                                      // guaranteed not applied
            is_saved: await checkIsSaved(userId, job._id, "Internship"),
          };
        })
      )
    )
      .filter(Boolean)
      .slice(0, 3);                                                  // cap at 3

    return res.status(200).json({
      status: true,
      data: {
        popularEvents,
        preferredInternships: preferredInternshipsData,
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
// const userDashboard = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // ── Step 1: Get applied job IDs ─────────────────────────────
//     const appliedJobs = await AppliedJob.find({ userId }).select("jobId");
//     const appliedIds = appliedJobs.map((a) => new mongoose.Types.ObjectId(a.jobId));

//     // ── Step 2: Fetch data ──────────────────────────────────────
//     const [popularEventsRaw, preferredInternships, topCompanies] = await Promise.all([
//       Event.find({ isActive: true })
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select(
//           "eventName coverImage registrationType organizer c_by mode description individualFees teamFees lateFees totalSeats eventDate city image isActive createdAt"
//         ),

//       Internship.find({ isActive: true, _id: { $nin: appliedIds } })
//         .sort({ createdAt: -1 })
//         .limit(3)
//         .select(
//           "jobTitle c_by location companyName duration salary eligibility createdAt"
//         )
//         .populate("c_by", "role"),

//       Company.find()
//         .sort({ createdAt: -1 })
//         .limit(4)
//         .select(
//           "companyName technologies companyTagLine companyLogo address state address industry website location createdAt"
//         ),
//     ]);

//     const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

//     // ── Step 3: Enrich events with is_registered ────────────────
//     const popularEvents = await Promise.all(
//       popularEventsRaw.map(async (item) => ({
//         ...item.toObject(),
//         is_registered: await checkIsRegistered(userId, item._id),
//       }))
//     );

//     // ── Step 4: Enrich internships ──────────────────────────────
//     const preferredInternshipsData = await Promise.all(
//       preferredInternships.map(async (item) => {
//         const obj = item.toObject();

//         let companyImage = null;
//         if (item.c_by?.role === "admin") {
//           companyImage = STATIC_ADMIN_IMAGE;
//         } else if (item.c_by?.role === "company") {
//           const company = await Company.findOne({ c_by: item.c_by._id })
//             .select("companyLogo")
//             .lean();
//           companyImage = company?.companyLogo || null;
//         }

//         return {
//           ...obj,
//           companyImage,
//           is_saved: await checkIsSaved(userId, item._id, "Internship"),
//           is_applied: false,
//         };
//       })
//     );

//     return res.status(200).json({
//       status: true,
//       data: {
//         popularEvents,                          // ✅ now includes is_registered
//         preferredInternships: preferredInternshipsData,
//         topCompanies,
//       },
//     });
//   } catch (error) {
//     console.error("Dashboard API Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load dashboard data",
//       error: error.message,
//     });
//   }
// };
const getJobs = async (req, res) => {
  try {
    const userId = req.user._id;

    // ── Step 1: Get excluded jobIds (saved + applied) ─────────────
    const [applied] = await Promise.all([
      AppliedJob.find({ userId }).select("jobId"),
    ]);

    const excludedIds = [
      ...applied.map((a) => new mongoose.Types.ObjectId(a.jobId)),
    ];

    // ── Step 2: Fetch jobs (excluding saved + applied) ────────────
    const [internships, freelances] = await Promise.all([
      Internship.find({
        _id: { $nin: excludedIds },isActive:true,status:"approved"
      })
        .sort({ createdAt: -1 })
        
        .select("jobTitle internshipType location c_by companyName duration salary eligibility createdAt")
        .populate("c_by", "role"),

      Freelance.find({
        _id: { $nin: excludedIds }, isActive:true,status:"approved"
      })
        .sort({ createdAt: -1 })
      
        .select("eligibility c_by description companyName jobTitle jobStartDate totalOpenings mode salary createdAt")
        .populate("c_by", "role"),
    ]);

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    // ── Step 3: Enrich function ───────────────────────────────────
    const enrichJob = async (item) => {
      const obj = item.toObject();

      let companyImage = null;

      if (item.c_by?.role === "admin") {
        companyImage = STATIC_ADMIN_IMAGE;
      } else if (item.c_by?.role === "company") {
        const company = await Company.findOne({
          userId: item.c_by._id,
        })
          .select("companyLogo")
          .lean();

        companyImage = company?.companyLogo || null;
      }

      return {
        ...obj,
        companyImage,

        // ✅ Always false (because filtered)
        is_saved: await checkIsSaved(userId, item._id),
        is_applied: false,
      };
    };

    // ── Step 4: Process results ───────────────────────────────────
    const [internshipsData, freelancesData] = await Promise.all([
      Promise.all(internships.map(enrichJob)),
      Promise.all(freelances.map(enrichJob)),
    ]);

    // ── Response ──────────────────────────────────────────────────
    return res.status(200).json({
      status: true,
      data: {
        internships: internshipsData,
        freelance: freelancesData,
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
   
    const internships = await Internship.find({isActive:true,status:"approved"})
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
            userId: item.c_by._id,

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

    // ── Step 1: Get applied job IDs ─────────────
    const appliedJobs = await AppliedJob.find({ userId }).select("jobId");

    const appliedIds = appliedJobs.map(
      (a) => new mongoose.Types.ObjectId(a.jobId)
    );

    // ── Step 2: Fetch freelances (exclude applied) ─────────────
    const freelances = await Freelance.find({
      _id: { $nin: appliedIds },
      isActive:true,
      status:"approved"
    })
      .sort({ createdAt: -1 })
      .select("eligibility description companyName jobTitle jobStartDate totalOpenings mode salary createdAt c_by")
      .populate("c_by", "role");

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    // ── Step 3: Enrich ─────────────
    const data = await Promise.all(
      freelances.map(async (item) => {
        const obj = item.toObject();

        let companyImage = null;

        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (item.c_by?.role === "company") {
          const company = await Company.findOne({
            userId: item.c_by._id,
          })
            .select("companyLogo")
            .lean();

          companyImage = company?.companyLogo || null;
        }

        return {
          ...obj,
          companyImage,

          // ✅ still needed
          is_saved: await checkIsSaved(userId, item._id, "Freelance"),

          // ✅ always false (filtered)
          is_applied: false,
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
      match: { isActive: true }, 
    select:
      "jobTitle location c_by companyName duration salary eligibility createdAt description jobStartDate totalOpenings mode",
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
            userId: job.c_by._id,
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
    const { jobId, jobType,resumeId } = req.body;
 
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
        message: "jobType must be 'Internship' or 'Freelance'",
      });
    }
 
    // Fetch job to get c_by
    let job = null;
    if (jobType === "Internship") {
      job = await Internship.findById(jobId).select("c_by");
    } else {
      job = await Freelance.findById(jobId).select("c_by");
    }
 
    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
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
 
    // Apply with c_by from job
    await AppliedJob.create({
      userId,
      jobId,
      jobType,
      resumeId,
      c_by: job.c_by,
    });
 
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
    match: { isActive: true }, 
    select:
      "jobTitle location c_by companyName duration salary eligibility createdAt description jobStartDate totalOpenings mode",
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


const getMySuggestions = async (req, res) => {
  try {
    const userId = req.user._id;

    const suggestions = await JobSuggested.find({ userId })
      .populate({
        path: "jobId",
        select:
          "jobTitle location c_by companyName duration salary eligibility createdAt description jobStartDate totalOpenings mode",
        populate: {
          path: "c_by",
          select: "role",
        },
      })
      .sort({ createdAt: -1 });

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    const enrichedSuggestions = await Promise.all(
      suggestions.map(async (item) => {
        const job = item.jobId;

        // job deleted
        if (!job) return null;

        let companyImage = null;

        // ✅ Admin Job
        if (job.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        }

        // ✅ Company Job
        else if (job.c_by?.role === "company") {
          const company = await Company.findOne({
            userId: job.c_by._id,
          })
            .select("companyLogo")
            .lean();

          companyImage = company?.companyLogo || null;
        }

        // ✅ Check Applied
        const isApplied = await AppliedJob.exists({
          userId,
          jobId: job._id,
        });

        return {
          ...item.toObject(),

          jobId: {
            ...job.toObject(),

            companyImage,

            // ✅ Applied Status
            is_applied: !!isApplied,

            // ✅ Saved Status
            is_saved: await checkIsSaved(
              userId,
              job._id,
              item.jobType
            ),
          },
        };
      })
    );

    return res.status(200).json({
      status: true,
      count: enrichedSuggestions.filter(Boolean).length,
      data: enrichedSuggestions.filter(Boolean),
    });
  } catch (error) {
    console.error("Get Suggestions Error:", error.message);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch suggestions",
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

    // ── Find Job ─────────────────────────────
    let job = await Internship.findById(id).populate("c_by", "role email phone");
    let jobType = "Internship";

    if (!job) {
      job = await Freelance.findById(id).populate("c_by", "role email phone");
      jobType = "Freelance";
    }

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    // ── Get Company Details ─────────────────────────────
    let companyDetails = {
      companyLogo: null,
      email: job?.c_by?.email || null,
      phone: job?.c_by?.phone || null,
      aboutUs:null,
      websiteLink:null
    };

    if (job.c_by?.role === "admin") {
      companyDetails.companyLogo = STATIC_ADMIN_IMAGE;
    } else if (job.c_by?.role === "company") {
      const company = await Company.findOne({
        userId: job.c_by._id,
      })
        .select("companyLogo aboutUs websiteLink")
        .lean();
        companyDetails = {
          companyLogo: company?.companyLogo || null,
          aboutUs:company?.aboutUs|| null,
          website:company?.websiteLink|| null
        };
    }

    // ── Parallel Checks ─────────────────────────────
    const [is_saved, is_applied, appliedCount] = await Promise.all([
      checkIsSaved(userId, id, jobType),
      checkIsApplied(userId, id),

      // ✅ total applicants count
      AppliedJob.countDocuments({
        jobId: id,
        jobType: jobType,
      }),
    ]);

    return res.status(200).json({
      status: true,
      jobType,
      data: {
        ...job.toObject(),

        // ✅ attach company info
        company: companyDetails,

        // ✅ flags
        is_saved,
        is_applied,

        // ✅ count
        applied_count: appliedCount,
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

    const competitions = await Competition.find({isActive:true,status:"approved"})
      .sort({ createdAt: -1 })
      .select("eventName registrationType coverImage organizer eventDate eligibilityDetails city  totalSeats individualFees teamFees lateFees mode registrationStartDate createdAt");

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

    const [is_registered,college,availability] = await Promise.all([
      checkIsRegistered(userId, id),
      getCollegeByEventId({eventType:"competition",eventId:id}),
      getSeatAvailability({eventType:"competition",eventId:id})
    ]);
   console.log(college)
    return res.status(200).json({
      status: true,
      data: {
        ...competition.toObject(),
        is_registered,
        college:college,
        availableSeats:availability?.availableSeats
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
// const createEventRegistration = async (req, res) => {
//   try {

//     const userId = req.user._id;

//     const {
//       eventId,
//       eventType,
//       fullName,
//       department,
//       collegeName,
//       year,
//       phoneNumber,
//       mailId,
//       food,
//       foodType,
//       accommodation,
//       accommodationType,
//       type,
//       teamMembersCount,
//       transaction_id,
//       amount,
//     } = req.body;

//     // ==============================
//     // REQUIRED VALIDATION
//     // ==============================

//     if (
//       !eventId ||
//       !eventType ||
//       !fullName ||
//       !department ||
//       !collegeName ||
//       !year ||
//       !phoneNumber ||
//       !mailId ||
//       !type
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "eventId, eventType, fullName, department, collegeName, year, type, phoneNumber and mailId are required",
//       });
//     }

//     // ==============================
//     // EVENT TYPE VALIDATION
//     // ==============================

//     if (
//       !["Conference", "Competition", "Seminar", "Event"].includes(eventType)
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "eventType must be Conference, Competition, Seminar or Event",
//       });
//     }

//     // ==============================
//     // REGISTRATION TYPE VALIDATION
//     // ==============================

//     if (!["Team", "Individual"].includes(type)) {
//       return res.status(400).json({
//         status: false,
//         message: "type must be Team or Individual",
//       });
//     }

//     // ==============================
//     // FOOD VALIDATION
//     // ==============================

//     if (food === "yes" && !foodType) {
//       return res.status(400).json({
//         status: false,
//         message: "foodType is required when food is yes",
//       });
//     }

//     // ==============================
//     // ACCOMMODATION VALIDATION
//     // ==============================

//     if (accommodation === "yes" && !accommodationType) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "accommodationType is required when accommodation is yes",
//       });
//     }

//     // ==============================
//     // GET EVENT DOCUMENT
//     // ==============================

//     let eventDoc = null;

//     const selectFields = `
//       c_by
//       totalSeats
//       teamOrIndividualEvent
//       teamSizeMinimum
//       teamSizeMaximum
//       individualFees
//       teamFees
//       lateFees
//     `;

//     if (eventType === "Conference") {
//       eventDoc = await Conference.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Competition") {
//       eventDoc = await Competition.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Seminar") {
//       eventDoc = await Seminar.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Event") {
//       eventDoc = await Event.findById(eventId)
//         .select(selectFields);
//     }

//     // ==============================
//     // EVENT NOT FOUND
//     // ==============================

//     if (!eventDoc) {
//       return res.status(404).json({
//         status: false,
//         message: "Event not found",
//       });
//     }

//     // ==============================
//     // ALREADY REGISTERED
//     // ==============================

//     const existing = await EventRegistration.findOne({
//       userId,
//       eventId,
//     });

//     if (existing) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "You have already registered for this event",
//       });
//     }

//     // ==============================
//     // MEMBER COUNT
//     // ==============================

//     let member_count = 1;

//     if (type === "Team") {

//       member_count = Number(teamMembersCount);

//       if (!member_count || member_count <= 0) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "Valid teamMembersCount is required",
//         });
//       }
//     }

//     // ==============================
//     // TEAM / INDIVIDUAL VALIDATION
//     // ==============================

//     if (eventDoc.teamOrIndividualEvent === "Team") {

//       // Only Team allowed
//       if (type !== "Team") {
//         return res.status(400).json({
//           status: false,
//           message:
//             "This event allows only team registration",
//         });
//       }

//     } else if (
//       eventDoc.teamOrIndividualEvent === "Individual"
//     ) {

//       // Only Individual allowed
//       if (type !== "Individual") {
//         return res.status(400).json({
//           status: false,
//           message:
//             "This event allows only individual registration",
//         });
//       }

//     } else if (
//       eventDoc.teamOrIndividualEvent === "Both"
//     ) {

//       // Both allowed
//       if (!["Team", "Individual"].includes(type)) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "type must be Team or Individual",
//         });
//       }
//     }

//     // ==============================
//     // TEAM SIZE VALIDATION
//     // ==============================

//     if (type === "Team") {

//       // Minimum Team Size
//       if (
//         eventDoc.teamSizeMinimum &&
//         member_count < eventDoc.teamSizeMinimum
//       ) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Minimum ${eventDoc.teamSizeMinimum} team members required`,
//         });
//       }

//       // Maximum Team Size
//       if (
//         eventDoc.teamSizeMaximum &&
//         member_count > eventDoc.teamSizeMaximum
//       ) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Maximum ${eventDoc.teamSizeMaximum} team members allowed`,
//         });
//       }
//     }

//     // ==============================
//     // TOTAL SEATS VALIDATION
//     // ==============================

//     const registrations =
//       await EventRegistration.find({
//         eventId,
//       }).select("member_count");

//     const usedSeats = registrations.reduce(
//       (sum, item) =>
//         sum + (item.member_count || 1),
//       0
//     );

//     const remainingSeats =
//       (eventDoc.totalSeats || 0) - usedSeats;

//     if (
//       eventDoc.totalSeats &&
//       member_count > remainingSeats
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           `Only ${remainingSeats} seats remaining`,
//       });
//     }

//     // ==============================
//     // CALCULATE FEES
//     // ==============================

//     let finalAmount = 0;

//     // Team Fees
//     if (type === "Team") {

//       finalAmount =
//         Number(eventDoc.teamFees || 0);

//     } else {

//       // Individual Fees
//       finalAmount =
//         Number(eventDoc.individualFees || 0) *
//         member_count;
//     }

//     // Add Late Fees
//     finalAmount +=
//       Number(eventDoc.lateFees || 0);

//     // ==============================
//     // PAYMENT VALIDATION
//     // ==============================

//     if (finalAmount > 0) {

//       if (!transaction_id) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "transaction_id is required",
//         });
//       }

//       if (!amount) {
//         return res.status(400).json({
//           status: false,
//           message: "amount is required",
//         });
//       }

//       if (Number(amount) !== finalAmount) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Invalid amount. Payable amount is ${finalAmount}`,
//         });
//       }
//     }

//     // ==============================
//     // CREATE REGISTRATION
//     // ==============================

//     const registration =
//       await EventRegistration.create({
//         userId,
//         eventId,
//         eventType,
//         fullName,
//         department,
//         c_by: eventDoc.c_by,
//         collegeName,
//         year,
//         type,
//         member_count,
//         phoneNumber,
//         mailId,
//         food: food || "no",
//         foodType:
//           food === "yes"
//             ? foodType
//             : null,
//         accommodation:
//           accommodation || "no",
//         accommodationType:
//           accommodation === "yes"
//             ? accommodationType
//             : null,
//       });

//     // ==============================
//     // CREATE PAYMENT
//     // ==============================

//     let paymentData = null;

//     if (finalAmount > 0) {

//       paymentData = await Payment.create({
//         userId,
//         referenceId: registration._id,
//         referenceType:
//           "EventRegistration",
//         eventId,
//         eventType,
//         c_by: eventDoc.c_by,
//         amount: finalAmount,
//         paymentMethod: "UPI",
//         paymentStatus: "Success",
//         paymentGateway: "Offline",
//         transactionId: transaction_id,
//         remarks:
//           `${eventType} registration payment`,
//       });
//     }

//     // ==============================
//     // SEND NOTIFICATION
//     // ==============================

//     await sendAndSaveNotification({
//       senderId: userId,
//       receiverId: userId,
//       title:
//         "Event Registration Successful",
//       message:
//         `You have successfully registered for the ${eventType}.`,
//       type: "event_registered",
//       reference_id: eventId,
//       metadata: {
//         eventType,
//         registrationId:
//           registration._id,
//         paymentId:
//           paymentData?._id || null,
//         amount: finalAmount,
//         food: food || "no",
//         accommodation:
//           accommodation || "no",
//       },
//     });

//     // ==============================
//     // RESPONSE
//     // ==============================

//     return res.status(200).json({
//       status: true,
//       message:
//         "Registered successfully",
//       data: {
//         registration,
//         payment: paymentData,
//         payableAmount: finalAmount,
//       },
//     });

//   } catch (error) {

//     console.error(
//       "Event Registration Error:",
//       error.message
//     );

//     return res.status(500).json({
//       status: false,
//       message:
//         "Failed to register for event",
//       error: error.message,
//     });
//   }
// };
// ============================================

// const createEventRegistration = async (req, res) => {
//   try {

//     const userId = req.user._id;

//     const {
//       eventId,
//       eventType,
//       fullName,
//       department,
//       collegeName,
//       year,
//       phoneNumber,
//       mailId,
//       food,
//       foodType,
//       accommodation,
//       accommodationType,
//       type,
//       teamMembersCount,
//       transaction_id,
//       amount,
//     } = req.body;

//     // ==============================
//     // REQUIRED VALIDATION
//     // ==============================

//     if (
//       !eventId ||
//       !eventType ||
//       !fullName ||
//       !department ||
//       !collegeName ||
//       !year ||
//       !phoneNumber ||
//       !mailId ||
//       !type
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "eventId, eventType, fullName, department, collegeName, year, type, phoneNumber and mailId are required",
//       });
//     }

//     // ==============================
//     // EVENT TYPE VALIDATION
//     // ==============================

//     if (
//       !["Conference", "Competition", "Seminar", "Event"].includes(eventType)
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "eventType must be Conference, Competition, Seminar or Event",
//       });
//     }

//     // ==============================
//     // REGISTRATION TYPE VALIDATION
//     // ==============================

//     if (!["Team", "Individual"].includes(type)) {
//       return res.status(400).json({
//         status: false,
//         message: "type must be Team or Individual",
//       });
//     }

//     // ==============================
//     // FOOD VALIDATION
//     // ==============================

//     if (food === "yes" && !foodType) {
//       return res.status(400).json({
//         status: false,
//         message: "foodType is required when food is yes",
//       });
//     }

//     // ==============================
//     // ACCOMMODATION VALIDATION
//     // ==============================

//     if (accommodation === "yes" && !accommodationType) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "accommodationType is required when accommodation is yes",
//       });
//     }

//     // ==============================
//     // GET EVENT DOCUMENT
//     // ==============================

//     let eventDoc = null;

//     const selectFields = `
//       c_by
//       totalSeats
//       teamOrIndividualEvent
//       teamSizeMinimum
//       teamSizeMaximum
//       individualFees
//       teamFees
//       lateFees
//     `;

//     if (eventType === "Conference") {
//       eventDoc = await Conference.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Competition") {
//       eventDoc = await Competition.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Seminar") {
//       eventDoc = await Seminar.findById(eventId)
//         .select(selectFields);
//     }

//     if (eventType === "Event") {
//       eventDoc = await Event.findById(eventId)
//         .select(selectFields);
//     }

//     // ==============================
//     // EVENT NOT FOUND
//     // ==============================

//     if (!eventDoc) {
//       return res.status(404).json({
//         status: false,
//         message: "Event not found",
//       });
//     }

//     // ==============================
//     // ALREADY REGISTERED
//     // ==============================

//     const existing = await EventRegistration.findOne({
//       userId,
//       eventId,
//     });

//     if (existing) {
//       return res.status(400).json({
//         status: false,
//         message:
//           "You have already registered for this event",
//       });
//     }

//     // ==============================
//     // MEMBER COUNT
//     // ==============================

//     let member_count = 1;

//     if (type === "Team") {

//       member_count = Number(teamMembersCount);

//       if (!member_count || member_count <= 0) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "Valid teamMembersCount is required",
//         });
//       }
//     }

//     // ==============================
//     // TEAM / INDIVIDUAL VALIDATION
//     // ==============================

//     if (eventDoc.teamOrIndividualEvent === "Team") {

//       // Only Team allowed
//       if (type !== "Team") {
//         return res.status(400).json({
//           status: false,
//           message:
//             "This event allows only team registration",
//         });
//       }

//     } else if (
//       eventDoc.teamOrIndividualEvent === "Individual"
//     ) {

//       // Only Individual allowed
//       if (type !== "Individual") {
//         return res.status(400).json({
//           status: false,
//           message:
//             "This event allows only individual registration",
//         });
//       }

//     } else if (
//       eventDoc.teamOrIndividualEvent === "Both"
//     ) {

//       // Both allowed
//       if (!["Team", "Individual"].includes(type)) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "type must be Team or Individual",
//         });
//       }
//     }

//     // ==============================
//     // TEAM SIZE VALIDATION
//     // ==============================

//     if (type === "Team") {

//       // Minimum Team Size
//       if (
//         eventDoc.teamSizeMinimum &&
//         member_count < eventDoc.teamSizeMinimum
//       ) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Minimum ${eventDoc.teamSizeMinimum} team members required`,
//         });
//       }

//       // Maximum Team Size
//       if (
//         eventDoc.teamSizeMaximum &&
//         member_count > eventDoc.teamSizeMaximum
//       ) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Maximum ${eventDoc.teamSizeMaximum} team members allowed`,
//         });
//       }
//     }

//     // ==============================
//     // TOTAL SEATS VALIDATION
//     // ==============================

//     const registrations =
//       await EventRegistration.find({
//         eventId,
//       }).select("member_count");

//     const usedSeats = registrations.reduce(
//       (sum, item) =>
//         sum + (item.member_count || 1),
//       0
//     );

//     const remainingSeats =
//       (eventDoc.totalSeats || 0) - usedSeats;

//     if (
//       eventDoc.totalSeats &&
//       member_count > remainingSeats
//     ) {
//       return res.status(400).json({
//         status: false,
//         message:
//           `Only ${remainingSeats} seats remaining`,
//       });
//     }

//     // ==============================
//     // CALCULATE FEES
//     // ==============================

//     let finalAmount = 0;

//     // Team Fees
//     if (type === "Team") {

//       finalAmount =
//         Number(eventDoc.teamFees || 0);

//     } else {

//       // Individual Fees
//       finalAmount =
//         Number(eventDoc.individualFees || 0) *
//         member_count;
//     }

//     // Add Late Fees
//     finalAmount +=
//       Number(eventDoc.lateFees || 0);

//     // ==============================
//     // PAYMENT VALIDATION
//     // ==============================

//     if (finalAmount > 0) {

//       if (!transaction_id) {
//         return res.status(400).json({
//           status: false,
//           message:
//             "transaction_id is required",
//         });
//       }

//       if (!amount) {
//         return res.status(400).json({
//           status: false,
//           message: "amount is required",
//         });
//       }

//       if (Number(amount) !== finalAmount) {
//         return res.status(400).json({
//           status: false,
//           message:
//             `Invalid amount. Payable amount is ${finalAmount}`,
//         });
//       }
//     }

//     // ==============================
//     // CREATE REGISTRATION
//     // ==============================

//     const registration =
//       await EventRegistration.create({
//         userId,
//         eventId,
//         eventType,
//         fullName,
//         department,
//         c_by: eventDoc.c_by,
//         collegeName,
//         year,
//         type,
//         member_count,
//         phoneNumber,
//         mailId,
//         food: food || "no",
//         foodType:
//           food === "yes"
//             ? foodType
//             : null,
//         accommodation:
//           accommodation || "no",
//         accommodationType:
//           accommodation === "yes"
//             ? accommodationType
//             : null,
//       });

//     // ==============================
//     // CREATE PAYMENT
//     // ==============================

//     let paymentData = null;

//     if (finalAmount > 0) {

//       paymentData = await Payment.create({
//         userId,
//         referenceId: registration._id,
//         referenceType:
//           "EventRegistration",
//         eventId,
//         eventType,
//         c_by: eventDoc.c_by,
//         amount: finalAmount,
//         paymentMethod: "UPI",
//         paymentStatus: "Success",
//         paymentGateway: "Offline",
//         transactionId: transaction_id,
//         remarks:
//           `${eventType} registration payment`,
//       });
//     }

//     // ==============================
//     // SEND NOTIFICATION
//     // ==============================

//     await sendAndSaveNotification({
//       senderId: userId,
//       receiverId: userId,
//       title:
//         "Event Registration Successful",
//       message:
//         `You have successfully registered for the ${eventType}.`,
//       type: "event_registered",
//       reference_id: eventId,
//       metadata: {
//         eventType,
//         registrationId:
//           registration._id,
//         paymentId:
//           paymentData?._id || null,
//         amount: finalAmount,
//         food: food || "no",
//         accommodation:
//           accommodation || "no",
//       },
//     });

//     // ==============================
//     // RESPONSE
//     // ==============================

//     return res.status(200).json({
//       status: true,
//       message:
//         "Registered successfully",
//       data: {
//         registration,
//         payment: paymentData,
//         payableAmount: finalAmount,
//       },
//     });

//   } catch (error) {

//     console.error(
//       "Event Registration Error:",
//       error.message
//     );

//     return res.status(500).json({
//       status: false,
//       message:
//         "Failed to register for event",
//       error: error.message,
//     });
//   }
// };

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
      type,
      teamMembersCount,
      transaction_id="3478rfbrbub487",
      amount,
    } = req.body;

    // ==============================
    // REQUIRED VALIDATION
    // ==============================

    if (
      !eventId ||
      !eventType ||
      !fullName ||
      !department ||
      !collegeName ||
      !year ||
      !phoneNumber ||
      !mailId ||
      !type
    ) {
      return res.status(400).json({
        status: false,
        message:
          "eventId, eventType, fullName, department, collegeName, year, type, phoneNumber and mailId are required",
      });
    }

    // ==============================
    // EVENT TYPE VALIDATION
    // ==============================

    if (
      !["Conference", "Competition", "Seminar", "Event"].includes(eventType)
    ) {
      return res.status(400).json({
        status: false,
        message:
          "eventType must be Conference, Competition, Seminar or Event",
      });
    }

    // ==============================
    // REGISTRATION TYPE VALIDATION
    // ==============================

    if (!["Team", "Individual"].includes(type)) {
      return res.status(400).json({
        status: false,
        message: "type must be Team or Individual",
      });
    }

    // ==============================
    // FOOD VALIDATION
    // ==============================

    if (food === "yes" && !foodType) {
      return res.status(400).json({
        status: false,
        message: "foodType is required when food is yes",
      });
    }

    // ==============================
    // ACCOMMODATION VALIDATION
    // ==============================

    if (accommodation === "yes" && !accommodationType) {
      return res.status(400).json({
        status: false,
        message:
          "accommodationType is required when accommodation is yes",
      });
    }

    // ==============================
    // GET EVENT DOCUMENT
    // ==============================

    let eventDoc = null;

    const selectFields = `
      c_by
      totalSeats
      teamOrIndividualEvent
      teamSizeMinimum
      teamSizeMaximum
      individualFees
      teamFees
      lateFees
      registrationType
    `;

    if (eventType === "Conference") {
      eventDoc = await Conference.findById(eventId)
        .select(selectFields);
    }

    if (eventType === "Competition") {
      eventDoc = await Competition.findById(eventId)
        .select(selectFields);
    }

    if (eventType === "Seminar") {
      eventDoc = await Seminar.findById(eventId)
        .select(selectFields);
    }

    if (eventType === "Event") {
      eventDoc = await Event.findById(eventId)
        .select(selectFields);
    }

    // ==============================
    // EVENT NOT FOUND
    // ==============================

    if (!eventDoc) {
      return res.status(404).json({
        status: false,
        message: "Event not found",
      });
    }

    // ==============================
    // ALREADY REGISTERED
    // ==============================

    const existing = await EventRegistration.findOne({
      userId,
      eventId,
    });

    if (existing) {
      return res.status(400).json({
        status: false,
        message:
          "You have already registered for this event",
      });
    }

    // ==============================
    // MEMBER COUNT
    // ==============================

    let member_count = 1;

    if (type === "Team") {

      member_count = Number(teamMembersCount);

      if (!member_count || member_count <= 0) {
        return res.status(400).json({
          status: false,
          message:
            "Valid teamMembersCount is required",
        });
      }
    }

    // ==============================
    // TEAM / INDIVIDUAL VALIDATION
    // ==============================

    if (eventDoc.teamOrIndividualEvent === "Team") {

      // Only Team allowed
      if (type !== "Team") {
        return res.status(400).json({
          status: false,
          message:
            "This event allows only team registration",
        });
      }

    } else if (
      eventDoc.teamOrIndividualEvent === "Individual"
    ) {

      // Only Individual allowed
      if (type !== "Individual") {
        return res.status(400).json({
          status: false,
          message:
            "This event allows only individual registration",
        });
      }

    } else if (
      eventDoc.teamOrIndividualEvent === "Both"
    ) {

      // Both allowed
      if (!["Team", "Individual"].includes(type)) {
        return res.status(400).json({
          status: false,
          message:
            "type must be Team or Individual",
        });
      }
    }

    // ==============================
    // TEAM SIZE VALIDATION
    // ==============================

    if (type === "Team") {

      // Minimum Team Size
      if (
        eventDoc.teamSizeMinimum &&
        member_count < eventDoc.teamSizeMinimum
      ) {
        return res.status(400).json({
          status: false,
          message:
            `Minimum ${eventDoc.teamSizeMinimum} team members required`,
        });
      }

      // Maximum Team Size
      if (
        eventDoc.teamSizeMaximum &&
        member_count > eventDoc.teamSizeMaximum
      ) {
        return res.status(400).json({
          status: false,
          message:
            `Maximum ${eventDoc.teamSizeMaximum} team members allowed`,
        });
      }
    }

    // ==============================
    // TOTAL SEATS VALIDATION
    // ==============================

    const registrations =
      await EventRegistration.find({
        eventId,
      }).select("member_count");

    const usedSeats = registrations.reduce(
      (sum, item) =>
        sum + (item.member_count || 1),
      0
    );

    const remainingSeats =
      (eventDoc.totalSeats || 0) - usedSeats;

    if (
      eventDoc.totalSeats &&
      member_count > remainingSeats
    ) {
      return res.status(400).json({
        status: false,
        message:
          `Only ${remainingSeats} seats remaining`,
      });
    }

    // ==============================
    // CALCULATE FEES
    // ==============================


    // ==============================
    // PAYMENT VALIDATION
    // ==============================

    if (eventDoc.registrationType === "Paid") {
        if (!transaction_id) {
          return res.status(400).json({
            status: false,
            message:
              "transaction_id is required",
          });
        }

        if (!amount) {
          return res.status(400).json({
            status: false,
            message: "amount is required",
          });
        } 
    }

    // ==============================
    // CREATE REGISTRATION
    // ==============================

    const registration =
      await EventRegistration.create({
        userId,
        eventId,
        eventType,
        fullName,
        department,
        c_by: eventDoc.c_by,
        collegeName,
        year,
        type,
        member_count,
        phoneNumber,
        mailId,
        food: food || "no",
        foodType:
          food === "yes"
            ? foodType
            : null,
        accommodation:
          accommodation || "no",
        accommodationType:
          accommodation === "yes"
            ? accommodationType
            : null,
      });

    // ==============================
    // CREATE PAYMENT
    // ==============================

    let paymentData = null;

    if (
      eventDoc.registrationType === "Paid" 
    ) {

      paymentData = await Payment.create({
        userId,
        referenceId: registration._id,
        referenceType:
          "EventRegistration",
        eventId,
        eventType,
        c_by: eventDoc.c_by,
        amount:  amount,
        paymentMethod: "UPI",
        paymentStatus: "Success",
        paymentGateway: "Offline",
        transactionId: transaction_id,
        remarks:
          `${eventType} registration payment`,
      });
    }

    // ==============================
    // SEND NOTIFICATION
    // ==============================

    await sendAndSaveNotification({
      senderId: userId,
      receiverId: userId,
      title:
        "Event Registration Successful",
      message:
        `You have successfully registered for the ${eventType}.`,
      type: "event_registered",
      reference_id: eventId,
      metadata: {
        eventType,
        registrationId:
          registration._id,
        paymentId:
          paymentData?._id || null,
        amount,
        registrationType:
          eventDoc.registrationType,
        food: food || "no",
        accommodation:
          accommodation || "no",
      },
    });

    // ==============================
    // RESPONSE
    // ==============================

    return res.status(200).json({
      status: true,
      message:
        "Registered successfully",
      data: {
        registration,
        payment: paymentData,
        payableAmount:amount,
        registrationType:
          eventDoc.registrationType,
      },
    });

  } catch (error) {

    console.error(
      "Event Registration Error:",
      error.message
    );

    return res.status(500).json({
      status: false,
      message:
        "Failed to register for event",
      error: error.message,
    });
  }
};
const getAllConferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const conferences = await Conference.find({isActive:true,status:"approved"})
      .sort({ createdAt: -1 })
      .select(
        "eventName organizer registrationType mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees city  eligibilityDetails teamOrIndividualEvent createdAt"
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

    const [is_registered,college,availability] = await Promise.all([
      checkIsRegistered(userId, id),
      getCollegeByEventId({eventType:"conference",eventId:id}),
      getSeatAvailability({eventType:"conference",eventId:id})
    ]);

    return res.status(200).json({
      status: true,
      data: {
        college,
        ...conference.toObject(),
        is_registered,
        availableSeats:availability?.availableSeats
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

    const events = await Event.find({ isActive:true,status:"approved", eventType: "Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType  organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees city  eligibilityDetails teamOrIndividualEvent createdAt"
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

    const events = await Event.find({ isActive:true,status:"approved", eventType: "Non Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees city  eligibilityDetails teamOrIndividualEvent createdAt"
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
    const [is_registered,college,availability] = await Promise.all([
      checkIsRegistered(userId, id),
      getCollegeByEventId({eventType:"event",eventId:id}),
      getSeatAvailability({eventType:"event",eventId:id})
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...event.toObject(),
        is_registered,
        college,
        availableSeats:availability?.availableSeats
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

    const seminars = await Seminar.find({ isActive:true,status:"approved", eventType: "Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees city  eligibilityDetails teamOrIndividualEvent createdAt"
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

    const seminars = await Seminar.find({isActive:true,status:"approved", eventType: "Non Technical" })
      .sort({ createdAt: -1 })
      .select(
        "eventName eventType organizer mode eventDate registrationType registrationStartDate registrationEndDate totalSeats coverImage individualFees teamFees lateFees city  eligibilityDetails teamOrIndividualEvent createdAt"
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

    const [is_registered,college,availability] = await Promise.all([
      checkIsRegistered(userId, id),
      getCollegeByEventId({eventType:"seminar",eventId:id}),
      getSeatAvailability({eventType:"seminar",eventId:id})
    ]);

    return res.status(200).json({
      status: true,
      data: {
        ...seminar.toObject(),
          college,
        availableSeats:availability?.availableSeats,
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
       .select("eventId eventType")
      .sort({ createdAt: -1 })
      .populate({
        path: "eventId",
        select:
          "eventName eventType registrationType totalSeats organizer mode eventDate coverImage city  individualFees teamFees isActive",
      })

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
      return res.status(200).json({
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


// const getCompanyProfile = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { id } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         status: false,
//         message: "id is required",
//       });
//     }

//     const company = await Company.findById(id);

//     if (!company) {
//       return res.status(404).json({
//         status: false,
//         message: "Company not found",
//       });
//     }

//     const [followCount, isFollowing] = await Promise.all([
//       CompanyFollow.countDocuments({ companyId: id }),
//       CompanyFollow.findOne({ userId, companyId: id }),
//     ]);

//     return res.status(200).json({
//       status: true,
//       data: {
//         ...company.toObject(),
//         followCount,
//         is_following: !!isFollowing,
//       },
//     });
//   } catch (error) {
//     console.error("Company Profile Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to load company profile",
//       error: error.message,
//     });
//   }
// };


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

    const company = await Company.findById(id).populate("c_by", "role");

    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
      });
    }

    const companyUserId = company.userId; // ✅ the user who owns this company

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    // ── Fetch all in parallel ───────────────────────────────────
    const [followCount, isFollowing, internshipsRaw, freelancesRaw] = await Promise.all([
      CompanyFollow.countDocuments({ companyId: companyUserId }),
      CompanyFollow.findOne({ userId, companyId:company.userId }),

      // ✅ Internships posted by this company
      Internship.find({ isActive: true, c_by: companyUserId })
        .sort({ createdAt: -1 })
        .select("jobTitle totalOpenings mode description c_by location  companyName duration salary eligibility createdAt")
        .populate("c_by", "role"),

      // ✅ Freelance jobs posted by this company
      Freelance.find({ isActive: true, c_by: companyUserId })
        .sort({ createdAt: -1 })
        .select("jobTitle totalOpenings mode description c_by location companyName duration salary eligibility createdAt")
        .populate("c_by", "role"),
    ]);



    // ── Enrich internships ──────────────────────────────────────
    const internships = await Promise.all(
      internshipsRaw.map(async (item) => {
        const obj = item.toObject();

        let companyImage = null;
        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (item.c_by?.role === "company") {
          const comp = await Company.findOne({ c_by: item.c_by._id })
            .select("companyLogo")
            .lean();
          companyImage = comp?.companyLogo || null;
        }

        return {
          ...obj,
          companyImage,
          is_saved: await checkIsSaved(userId, item._id, "Internship"),
          is_applied: await checkIsApplied(userId, item._id),
        };
      })
    );

    // ── Enrich freelance jobs ───────────────────────────────────
    const freelances = await Promise.all(
      freelancesRaw.map(async (item) => {
        const obj = item.toObject();

        let companyImage = null;
        if (item.c_by?.role === "admin") {
          companyImage = STATIC_ADMIN_IMAGE;
        } else if (item.c_by?.role === "company") {
          const comp = await Company.findOne({ c_by: item.c_by._id })
            .select("companyLogo")
            .lean();
          companyImage = comp?.companyLogo || null;
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
      data: {
        ...company.toObject(),
        followCount,
        is_following: !!isFollowing,
        internships,   // ✅ internships by this company
        freelances,    // ✅ freelance jobs by this company
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

    const upcomingRaw = await Event.find({ isActive: true,status:"approved", eventDate: { $gte: now } })
      .sort({ eventDate: 1 })
      .limit(2)
      .select("eventName registrationType eventType organizer mode eventDate coverImage city totalSeats individualFees teamFees registrationEndDate createdAt");

    const upcomingIds = upcomingRaw.map((e) => e._id);

    const [technicalRaw, nonTechnicalRaw] = await Promise.all([
      Event.find({isActive: true,status:"approved", eventType: "Technical", _id: { $nin: upcomingIds } })
        .sort({ createdAt: -1 })
 
        .select("eventName registrationType eventType organizer mode eventDate coverImage city totalSeats individualFees teamFees registrationEndDate createdAt"),

      Event.find({ isActive: true,status:"approved", eventType: "Non Technical", _id: { $nin: upcomingIds } })
        .sort({ createdAt: -1 })
       
        .select("eventName registrationType eventType organizer mode eventDate coverImage city totalSeats individualFees teamFees registrationEndDate createdAt"),
    ]);

    // ✅ attachFlags + is_registered for all three
    const [upcomingEvents, technicalEvents, nonTechnicalEvents] = await Promise.all([
      Promise.all(
        upcomingRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
      Promise.all(
        technicalRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
      Promise.all(
        nonTechnicalRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
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

    const upcomingRaw = await Seminar.find({isActive: true,status:"approved", eventDate: { $gte: now } })
      .sort({ eventDate: 1 })
      .limit(2)
      .select("eventName eventType registrationType organizer mode eventDate coverImage city totalSeats individualFees teamFees registrationEndDate createdAt");

    const upcomingIds = upcomingRaw.map((s) => s._id);

    const [technicalRaw, nonTechnicalRaw] = await Promise.all([
      Seminar.find({isActive: true, status:"approved", eventType: "Technical", _id: { $nin: upcomingIds } })
        .sort({ createdAt: -1 })
  
        .select("eventName eventType registrationType city organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),

      Seminar.find({ isActive: true, status:"approved",  eventType: "Non Technical", _id: { $nin: upcomingIds } })
        .sort({ createdAt: -1 })

        .select("eventName eventType registrationType city organizer mode eventDate coverImage venueAddress totalSeats individualFees teamFees registrationEndDate createdAt"),
    ]);

    // ✅ attachFlags + is_registered for all three
    const [upcomingSeminars, technicalSeminars, nonTechnicalSeminars] = await Promise.all([
      Promise.all(
        upcomingRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
      Promise.all(
        technicalRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
      Promise.all(
        nonTechnicalRaw.map(async (item) => ({
          ...item.toObject(),
          is_registered: await checkIsRegistered(userId, item._id),
        }))
      ),
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



const getLocations = async (req, res) => {
  try {
    const { state="Tamil Nadu" } = req.query;

    const filter = { isActive: true };
    if (state) filter.state = state;

    const locations = await Location.find(filter)
      .sort({ state: 1, city: 1 })
      .select("state city");

    // Group by state
    const grouped = locations.reduce((acc, loc) => {
      if (!acc[loc.state]) acc[loc.state] = [];
      acc[loc.state].push(loc.city);
      return acc;
    }, {});

    return res.status(200).json({
      status: true,
      count: locations.length,
      data: grouped,
    });
  } catch (error) {
    console.error("Locations API Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch locations",
      error: error.message,
    });
  }
};

const getJobMetaPage = async (req, res) => {
  try {
    const { job_id, web } = req.query;
    const isWeb = web === "true";

    if (!job_id) {
      return res.status(400).send("<h1>Invalid Job ID</h1>");
    }

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    let job        = null;
    let jobType    = null;
    let emoji      = "💼";

    // ── Step 1: Detect job type ─────────────────────────────────
    job = await Internship.findById(job_id).populate("c_by", "role").lean();
    if (job) {
      jobType = "Internship";
      emoji   = "🎓";
    }

    if (!job) {
      job = await Freelance.findById(job_id).populate("c_by", "role").lean();
      if (job) {
        jobType = "Freelance";
        emoji   = "🧑‍💻";
      }
    }

    if (!job) {
      return res.status(404).send("<h1>Job not found</h1>");
    }

    // ── Step 2: Resolve company image ───────────────────────────
    let companyImage = `${process.env.BASE_URL}/default-company.png`;

    if (job.c_by?.role === "admin") {
      companyImage = `${process.env.BASE_URL}/${STATIC_ADMIN_IMAGE}`;
    } else if (job.c_by?.role === "company") {
      const company = await Company.findOne({ c_by: job.c_by._id })
        .select("companyLogo")
        .lean();
      if (company?.companyLogo) {
        companyImage = `${process.env.BASE_URL}/${company.companyLogo}`;
      }
    }

    // ── Step 3: Build meta fields ───────────────────────────────
    const title    = job.jobTitle     || "Job Opportunity";
    const company  = job.companyName  || job.organizer || "Company";
    const location = job.location     || "";
    const mode     = job.mode         || "";
    const duration = job.duration     || "";
    const salary   = job.salary
      ? `₹${job.salary}${jobType === "Internship" ? "/month" : ""}`
      : "Negotiable";

    const description =
      job.description ||
      `${title} at ${company} | ${location} | ${mode}${duration ? ` | ${duration}` : ""} | ${salary}`;

    const ogUrl = `${process.env.BASE_URL}/api/share/job?job_id=${job_id}&web=${isWeb}`;

    const redirectUrl = isWeb
      ? `${process.env.FRONTEND_URL}/job?job_id=${encodeURIComponent(job_id)}&web=true`
      : `${process.env.FRONTEND_URL}/job?job_id=${encodeURIComponent(job_id)}`;

    // ── Step 4: Render OG HTML ──────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} at ${company} | ${jobType}</title>

  <!-- Open Graph -->
  <meta property="og:title"            content="${emoji} ${title} – ${company}" />
  <meta property="og:description"      content="${description}" />
  <meta property="og:image"            content="${companyImage}" />
  <meta property="og:image:secure_url" content="${companyImage}" />
  <meta property="og:image:type"       content="image/jpeg" />
  <meta property="og:image:width"      content="1200" />
  <meta property="og:image:height"     content="630" />
  <meta property="og:image:alt"        content="${company}" />
  <meta property="og:url"              content="${ogUrl}" />
  <meta property="og:type"             content="website" />
  <meta property="og:site_name"        content="Nulinz" />
  <meta property="og:locale"           content="en_US" />
  <meta property="fb:app_id"           content="1492199609067011" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${emoji} ${title} – ${company}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image"       content="${companyImage}" />

  <!-- Fallback SEO -->
  <meta name="description" content="${description}" />

  <!-- Auto-redirect after 5s -->
  <meta http-equiv="refresh" content="5; url=${redirectUrl}" />
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
  <h2>${emoji} ${title}</h2>
  <p><strong>${company}</strong> · ${location} · ${mode}</p>
  <p>
    ${duration ? `Duration: ${duration}` : ""}
    ${duration && salary ? " | " : ""}
    ${salary ? `Salary: ${salary}` : ""}
  </p>
  <p style="color:#888;margin-top:24px;">Redirecting to ${jobType} page...</p>
  <a href="${redirectUrl}">Click here if not redirected</a>
</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).send(html);

  } catch (error) {
    console.error("Job Meta Page Error:", error.message);
    return res.status(500).send("<h1>Something went wrong</h1>");
  }
};
const getEventMetaPage = async (req, res) => {
  try {
    const { event_id, web } = req.query;
    const isWeb = web === "true";

    if (!event_id) {
      return res.status(400).send("<h1>Invalid Event ID</h1>");
    }

    let event     = null;
    let eventType = null;
    let emoji     = "📅";

    // ── Step 1: Detect which event model ────────────────────────
    event = await Event.findById(event_id).lean();
    if (event) { eventType = "Event"; emoji = "🎯"; }

    if (!event) {
      event = await Seminar.findById(event_id).lean();
      if (event) { eventType = "Seminar"; emoji = "🎤"; }
    }

    if (!event) {
      event = await Competition.findById(event_id).lean();
      if (event) { eventType = "Competition"; emoji = "🏆"; }
    }

    if (!event) {
      event = await Conference.findById(event_id).lean();
      if (event) { eventType = "Conference"; emoji = "🏛️"; }
    }

    if (!event) {
      return res.status(404).send("<h1>Event not found</h1>");
    }

    // ── Step 2: Resolve cover image ─────────────────────────────
    const coverImage = event.coverImage
      ? `${process.env.BASE_URL}/${event.coverImage}`
      : `${process.env.BASE_URL}/default-event.png`;

    // ── Step 3: Build meta fields ───────────────────────────────
    const name        = event.eventName   || "Event";
    const organizer   = event.organizer   || "";
    const city        = event.city        || "";
    const state       = event.state       || "";
    const mode        = event.mode        || "";
    const eventDate   = event.eventDate
      ? new Date(event.eventDate).toDateString()
      : "";

    const fees = (() => {
      if (event.individualFees && event.individualFees > 0)
        return `₹${event.individualFees} (Individual)`;
      if (event.teamFees && event.teamFees > 0)
        return `₹${event.teamFees} (Team)`;
      return "Free";
    })();

    const description =
      event.description ||
      `${name} by ${organizer} | ${mode} | ${city}${state ? `, ${state}` : ""} | ${eventDate} | ${fees}`;

    const ogUrl = `${process.env.BASE_URL}/api/users/share/event?event_id=${event_id}&web=${isWeb}`;

    const redirectUrl = isWeb
      ? `${process.env.FRONTEND_URL}/event?event_id=${encodeURIComponent(event_id)}&web=true`
      : `${process.env.FRONTEND_URL}/event?event_id=${encodeURIComponent(event_id)}`;

    // ── Step 4: Render OG HTML ──────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${name} | ${eventType}</title>

  <!-- Open Graph -->
  <meta property="og:title"            content="${emoji} ${name} – ${organizer}" />
  <meta property="og:description"      content="${description}" />
  <meta property="og:image"            content="${coverImage}" />
  <meta property="og:image:secure_url" content="${coverImage}" />
  <meta property="og:image:type"       content="image/jpeg" />
  <meta property="og:image:width"      content="1200" />
  <meta property="og:image:height"     content="630" />
  <meta property="og:image:alt"        content="${name}" />
  <meta property="og:url"              content="${ogUrl}" />
  <meta property="og:type"             content="website" />
  <meta property="og:site_name"        content="Nulinz" />
  <meta property="og:locale"           content="en_US" />
  <meta property="fb:app_id"           content="1492199609067011" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${emoji} ${name} – ${organizer}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image"       content="${coverImage}" />

  <!-- Fallback SEO -->
  <meta name="description" content="${description}" />

  <!-- Auto-redirect after 5s -->
  <meta http-equiv="refresh" content="5; url=${redirectUrl}" />
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
  <h2>${emoji} ${name}</h2>
  <p><strong>${organizer}</strong> · ${city}${state ? `, ${state}` : ""} · ${mode}</p>
  <p>
    ${eventDate ? `📅 ${eventDate}` : ""}
    ${eventDate && fees ? " | " : ""}
    ${fees ? `🎟️ ${fees}` : ""}
  </p>
  <p style="color:#888;margin-top:24px;">Redirecting to ${eventType} page...</p>
  <a href="${redirectUrl}">Click here if not redirected</a>
</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).send(html);

  } catch (error) {
    console.error("Event Meta Page Error:", error.message);
    return res.status(500).send("<h1>Something went wrong</h1>");
  }
};

const getCompanyMetaPage = async (req, res) => {
  try {
    const { company_id, web } = req.query;
    const isWeb = web === "true";

    if (!company_id) {
      return res.status(400).send("<h1>Invalid User ID</h1>");
    }

    const STATIC_ADMIN_IMAGE = "uploads/Nulinz LOGO 3.png";

    let companyName  = "Nulinz";
    let tagLine      = "Connecting Talent with Opportunity";
    let aboutUs      = "Explore opportunities and grow your career with us.";
    let city         = "";
    let state        = "";
    let companyType  = "";
    let employees    = "";
    let technologies = [];
    let companyLogo  = `${process.env.BASE_URL}/${STATIC_ADMIN_IMAGE}`;
    let coverImage   = `${process.env.BASE_URL}/default-cover.png`;
    let isAdmin      = false;

    // ── Step 1: Check if user is Admin ──────────────────────────
    const user = await User.findById(company_id).select("role").lean();

    if (!user) {
      return res.status(404).send("<h1>User not found</h1>");
    }

    if (user.role === "admin") {
      // Admin has no company profile → use static branding
      isAdmin     = true;
      companyLogo = `${process.env.BASE_URL}/${STATIC_ADMIN_IMAGE}`;
      coverImage  = `${process.env.BASE_URL}/default-cover.png`;
    } else {
      // ── Step 2: Find company by userId ────────────────────────
      const company = await Company.findOne({ userId:company_id, isActive: true }).lean();

      if (!company) {
        return res.status(404).send("<h1>Company not found</h1>");
      }

      companyName  = company.companyName   || "Company";
      tagLine      = company.companyTagLine || "";
      aboutUs      = company.aboutUs        || `${companyName} — ${tagLine}`;
      city         = company.city           || "";
      state        = company.state          || "";
      companyType  = company.companyType    || "";
      employees    = company.employees      || "";
      technologies = company.technologies   || [];

      companyLogo = company.companyLogo
        ? `${process.env.BASE_URL}/${company.companyLogo}`
        : `${process.env.BASE_URL}/${STATIC_ADMIN_IMAGE}`;

      coverImage = company.coverImage
        ? `${process.env.BASE_URL}/${company.coverImage}`
        : companyLogo;
    }

    // ── Step 3: Build meta fields ───────────────────────────────
    const locationStr = [city, state].filter(Boolean).join(", ");

    const descriptionParts = [
      tagLine,
      companyType,
      locationStr,
      employees ? `${employees} employees` : "",
      technologies.length ? technologies.slice(0, 4).join(" · ") : "",
    ].filter(Boolean);

    const description = aboutUs || descriptionParts.join(" | ");

    const ogUrl = `${process.env.BASE_URL}/api/users/share/company?user_id=${ company_id}&web=${isWeb}`;

    const redirectUrl = isWeb
      ? `${process.env.FRONTEND_URL}/company?company_id_id=${encodeURIComponent(company_id)}&web=true`
      : `${process.env.FRONTEND_URL}/company?company_id_id=${encodeURIComponent(company_id)}`;

    // ── Step 4: Render OG HTML ──────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${companyName} | Company Profile</title>

  <!-- Open Graph -->
  <meta property="og:title"            content="🏢 ${companyName}${tagLine ? ` – ${tagLine}` : ""}" />
  <meta property="og:description"      content="${description}" />
  <meta property="og:image"            content="${coverImage}" />
  <meta property="og:image:secure_url" content="${coverImage}" />
  <meta property="og:image:type"       content="image/jpeg" />
  <meta property="og:image:width"      content="1200" />
  <meta property="og:image:height"     content="630" />
  <meta property="og:image:alt"        content="${companyName}" />
  <meta property="og:url"              content="${ogUrl}" />
  <meta property="og:type"             content="website" />
  <meta property="og:site_name"        content="Nulinz" />
  <meta property="og:locale"           content="en_US" />
  <meta property="fb:app_id"           content="1492199609067011" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="🏢 ${companyName}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image"       content="${coverImage}" />

  <!-- Fallback SEO -->
  <meta name="description" content="${description}" />

  <!-- Auto-redirect after 5s -->
  <meta http-equiv="refresh" content="5; url=${redirectUrl}" />
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
  <img
    src="${companyLogo}"
    alt="${companyName}"
    style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:12px;"
    onerror="this.style.display='none'"
  />
  <h2>🏢 ${companyName}</h2>
  ${tagLine ? `<p style="color:#555;">${tagLine}</p>` : ""}
  <p>
    ${locationStr ? `📍 ${locationStr}` : ""}
    ${locationStr && companyType ? " · " : ""}
    ${companyType ? companyType : ""}
    ${employees ? ` · 👥 ${employees}` : ""}
  </p>
  ${technologies.length ? `<p style="color:#888;font-size:13px;">${technologies.slice(0, 5).join(" · ")}</p>` : ""}
  <p style="color:#aaa;margin-top:24px;">Redirecting to company profile...</p>
  <a href="${redirectUrl}">Click here if not redirected</a>
</body>
</html>
`;

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).send(html);

  } catch (error) {
    console.error("Company Meta Page Error:", error.message);
    return res.status(500).send("<h1>Something went wrong</h1>");
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
  getEventsPage,
  getSeminarsPage,
  getLocations,
  getMySuggestions,
  getJobMetaPage,
  getEventMetaPage,
  getCompanyMetaPage
};
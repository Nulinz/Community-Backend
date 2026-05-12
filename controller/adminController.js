import mongoose from "mongoose";

// Import Models
import Company from "../models/companyModel.js";
import College from "../models/collegeModel.js";
import Competition from "../models/competitionModel.js";
import Conference from "../models/conferenceModel.js";
import Event from "../models/eventModel.js";
import Seminar from "../models/seminarModel.js";
import Internship from "../models/internshipModel.js";
import Freelance from "../models/freelanceModel.js";

export const adminDashBoard = async (req, res) => {
  try {
    const now = new Date();

    // 📅 Time ranges
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 🔧 Common filter
    const baseFilter = {
      // is_deleted: false,
      // is_active: true,
      c_by:req?.user?._id,
    };

    // 📊 Helper
    const getStats = async (Model) => {
      const [total, thisMonth, lastMonth] = await Promise.all([
        Model.countDocuments(baseFilter),

        Model.countDocuments({
          ...baseFilter,
          createdAt: { $gte: startOfMonth },
        }),

        Model.countDocuments({
          ...baseFilter,
          createdAt: {
            $gte: startOfLastMonth,
            $lte: endOfLastMonth,
          },
        }),
      ]);

      // 📈 Growth %
      let growth = 0;
      if (lastMonth > 0) {
        growth = ((thisMonth - lastMonth) / lastMonth) * 100;
      } else if (thisMonth > 0) {
        growth = 100;
      }

      return {
        total,
        thisMonth,
        lastMonth,
        growth: Number(growth.toFixed(2)),
      };
    };

    // 🧩 Models map
    const models = {
      companies: Company,
      colleges: College,
      competitions: Competition,
      conferences: Conference,
      events: Event,
      seminars: Seminar,
      internships: Internship,
      freelances: Freelance,
    };
    

    // ⚡ Parallel execution
    const statsEntries = await Promise.all(
      Object.entries(models).map(async ([key, Model]) => {
        const stats = await getStats(Model);
        return [key, stats];
      })
    );

    const stats = Object.fromEntries(statsEntries);

    // 🏢 Latest Companies
    const latestCompanies = await Company.find(baseFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "companyName companyType contactPersonName city companyLogo createdAt"
      )
      .lean();

    // 📅 Last 7 days trend
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);

    const companyTrends = await Company.aggregate([
      {
        $match: {
          ...baseFilter,
          createdAt: { $gte: last7Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stats,
        latestCompanies,
        trends: {
          companies: companyTrends,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message,
    });
  }
};

export const updateEventStatus = async (req, res, next) => {
  try {
    const { event_id, eventType, status, rejected_reason } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    if (status === "rejected" && !rejected_reason) {
      return res.status(400).json({ success: false, message: "Rejected reason is required" });
    }

    const modelMap = {
      competition: Competition,
      conference:  Conference,
      event:       Event,
      seminar:     Seminar,
    };

    const Model = modelMap[eventType?.toLowerCase()];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid eventType" });
    }

    const updateData = { status };
    if (status === "rejected") {
      updateData.rejected_reason = rejected_reason;
    } else {
      updateData.rejected_reason = null; // clear reason if approved/pending
    }

    const updated = await Model.findByIdAndUpdate(
      event_id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
export const updateJobStatus = async (req, res, next) => {
  try {
    const { job_id, jobType, status, rejected_reason } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    if (status === "rejected" && !rejected_reason) {
      return res.status(400).json({ success: false, message: "Rejected reason is required" });
    }

    const modelMap = {
      internship: Internship,
      freelance:  Freelance,
    };

    const Model = modelMap[jobType?.toLowerCase()];
    if (!Model) {
      return res.status(400).json({ success: false, message: "Invalid jobType" });
    }

    const updateData = { status };
    if (status === "rejected") {
      updateData.rejected_reason = rejected_reason;
    } else {
      updateData.rejected_reason = null; // clear reason if approved/pending
    }

    const updated = await Model.findByIdAndUpdate(
      job_id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};


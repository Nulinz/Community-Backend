import mongoose from "mongoose";

// Import Models
import User from "../models/userModel.js";
import Company from "../models/companyModel.js";
import College from "../models/collegeModel.js";
import Competition from "../models/competitionModel.js";
import Conference from "../models/conferenceModel.js";
import Event from "../models/eventModel.js";
import Seminar from "../models/seminarModel.js";
import Internship from "../models/internshipModel.js";
import Job from "../models/jobModel.js";
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
      jobs: Job,
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
      job: Job,
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

/**
 * Admin creates an Influencer account
 */
export const createInfluencer = async (req, res, next) => {
  try {
    const { id, _id, name, email, mailId, phone, phoneNumber, password, influencerCode, instagram, youtube, linkedin, twitter, profileImage } = req.body;
    const influencerId = id || _id;
    const cleanEmail = (email || mailId || "").toLowerCase().trim();
    const cleanPhone = phone || phoneNumber;

    if (!name || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    let profileImagePath = null;
    if (req.file) {
      profileImagePath = req.file.path.replace(/\\/g, "/");
    } else if (profileImage && typeof profileImage === "string") {
      profileImagePath = profileImage;
    }

    // ── EDIT / UPDATE MODE ──
    if (influencerId) {
      const existingInfluencer = await User.findById(influencerId);
      if (!existingInfluencer) {
        return res.status(404).json({ success: false, message: "Influencer not found" });
      }

      if (cleanEmail && cleanEmail !== existingInfluencer.email) {
        const emailConflict = await User.findOne({ email: cleanEmail, _id: { $ne: influencerId } });
        if (emailConflict) {
          return res.status(400).json({ success: false, message: "An account with this email already exists" });
        }
        existingInfluencer.email = cleanEmail;
      }

      if (name) existingInfluencer.name = name.trim();
      if (cleanPhone) existingInfluencer.phone = cleanPhone.trim();
      if (influencerCode) existingInfluencer.influencerCode = influencerCode.trim().toUpperCase();
      if (instagram !== undefined) existingInfluencer.instagram = instagram;
      if (youtube !== undefined) existingInfluencer.youtube = youtube;
      if (linkedin !== undefined) existingInfluencer.linkedin = linkedin;
      if (twitter !== undefined) existingInfluencer.twitter = twitter;
      if (profileImagePath) existingInfluencer.profileImage = profileImagePath;

      await existingInfluencer.save();

      return res.status(200).json({
        success: true,
        message: "Influencer account updated successfully",
        data: existingInfluencer,
      });
    }

    // ── CREATE MODE ──
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const finalPhone = cleanPhone ? cleanPhone.trim() : `INF_${Date.now()}`;
    const existingPhone = await User.findOne({ phone: finalPhone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "An account with this phone number already exists",
      });
    }

    // Auto-generate unique influencer code if not provided
    let finalCode = influencerCode ? influencerCode.trim().toUpperCase() : null;
    if (!finalCode) {
      const sanitizedName = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5) || "INF";
      finalCode = `INF_${sanitizedName}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const existingCode = await User.findOne({ influencerCode: finalCode });
    if (existingCode) {
      finalCode = `INF_${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const influencer = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: finalPhone,
      password: password || null,
      role: "influencer",
      influencerCode: finalCode,
      profileImage: profileImagePath,
      instagram: instagram || "",
      youtube: youtube || "",
      linkedin: linkedin || "",
      twitter: twitter || "",
    });

    return res.status(201).json({
      success: true,
      message: "Influencer account created successfully",
      data: {
        id: influencer._id,
        name: influencer.name,
        email: influencer.email,
        phone: influencer.phone,
        role: influencer.role,
        influencerCode: influencer.influencerCode,
        profileImage: influencer.profileImage,
        instagram: influencer.instagram,
        youtube: influencer.youtube,
        linkedin: influencer.linkedin,
        twitter: influencer.twitter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin gets list of all registered influencers
 */
export const getAllInfluencers = async (req, res, next) => {
  try {
    const influencers = await User.find({ role: "influencer" })
      .select("name email phone influencerCode profileImage instagram youtube linkedin twitter createdAt is_active")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: influencers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin sets password for an influencer account
 */
export const setInfluencerPassword = async (req, res, next) => {
  try {
    const { id, password, confirmPassword } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Influencer ID is required" });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const user = await User.findOne({ _id: id, role: "influencer" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Influencer not found" });
    }

    user.password = password; // pre-save hook automatically hashes password
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password set successfully for influencer",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin gets single influencer details by ID
 */
export const getInfluencerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const influencer = await User.findOne({ _id: id, role: "influencer" }).select(
      "name email phone influencerCode profileImage instagram youtube linkedin twitter createdAt is_active"
    );

    if (!influencer) {
      return res.status(404).json({ success: false, message: "Influencer not found" });
    }

    return res.status(200).json({
      success: true,
      data: influencer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin toggles activate/deactivate status for an influencer
 */
export const toggleInfluencerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "influencer" });

    if (!user) {
      return res.status(404).json({ success: false, message: "Influencer not found" });
    }

    user.is_active = user.is_active === false ? true : false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Influencer ${user.is_active ? "activated" : "deactivated"} successfully`,
      data: { is_active: user.is_active },
    });
  } catch (error) {
    next(error);
  }
};


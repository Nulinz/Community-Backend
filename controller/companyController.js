import { register } from "module";
import mongoose from "mongoose";
import Company from "../models/companyModel.js";
import User from "../models/userModel.js";
import fs from "fs";
import UserDetails from "../models/userDetails.js";
import path from "path";
import CompanyFollow from "../models/companyFollowModel.js";
import Internship from "../models/internshipModel.js";


import Freelance from "../models/freelanceModel.js";
import Job from "../models/jobModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import Event from "../models/eventModel.js";
import Competition from "../models/competitionModel.js";



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


export const getCompanyDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get company by userId
    const company = await Company.findOne({ userId }).select("_id");
    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
      });
    }

    const companyId = company._id;

    // ── Date boundaries for live vs upcoming classification ───
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Queries scoped to company user or company ID
    const ownerQuery = { $in: [userId, companyId] };

    // ── All stats in parallel ──────────────────────────────────
    const [
      totalFollowers,
      activeInternships,
      activeFreelances,
      activeJobs,
      liveEvents,
      upcomingEvents,
      liveCompetitions,
      upcomingCompetitions,
      lastApplied,
    ] = await Promise.all([
      CompanyFollow.countDocuments({ companyId: ownerQuery }),
      Internship.countDocuments({ c_by: userId, isActive: true }),
      Freelance.countDocuments({ c_by: userId, isActive: true }),
      Job.countDocuments({ c_by: userId, isActive: true }),

      // Live Events: occurring today and active
      Event.countDocuments({
        c_by: ownerQuery,
        eventDate: { $gte: startOfToday, $lte: endOfToday },
        isActive: { $ne: false },
      }),

      // Upcoming Events: scheduled after today and active
      Event.countDocuments({
        c_by: ownerQuery,
        eventDate: { $gt: endOfToday },
        isActive: { $ne: false },
      }),

      // Live Competitions / Hackathons: active today (single-day or multi-day range)
      Competition.countDocuments({
        c_by: ownerQuery,
        isActive: { $ne: false },
        $or: [
          { eventDate: { $gte: startOfToday, $lte: endOfToday } },
          {
            eventDate: { $lte: endOfToday },
            eventEndDate: { $gte: startOfToday },
          },
        ],
      }),

      // Upcoming Competitions / Hackathons: starting after today and active
      Competition.countDocuments({
        c_by: ownerQuery,
        eventDate: { $gt: endOfToday },
        isActive: { $ne: false },
      }),

      // Last 5 applied jobs under this company
      AppliedJob.find({ c_by: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({ path: "userId", select: "name email phone" })
        .populate({ path: "jobId", select: "jobTitle c_by companyName" }),
    ]);

    // Filter only applications belonging to this company's jobs


    return res.status(200).json({
      status: true,
      data: {
        // stats — each key has { total } to match frontend data.total
        stats: {
          totalFollowers: { total: totalFollowers },
          activeInternships: { total: activeInternships },
          activeFreelances: { total: activeFreelances },
          activeJobs: { total: activeJobs },
          liveEvents: { total: liveEvents },
          upcomingEvents: { total: upcomingEvents },
          liveCompetitions: { total: liveCompetitions },
          upcomingCompetitions: { total: upcomingCompetitions },
        },

        // lastApplied — column keys match frontend table exactly
        lastApplied: lastApplied.map((item, i) => ({
          _id: item._id,
          index: `0${i + 1}`,
          name: item.userId?.name ?? "—",
          title: item.jobId?.jobTitle ?? "—",
          type: item.jobType ?? "—",
          email: item.userId?.email ?? "—",
          phone: item.userId?.phone ?? "—",
          createdAt: item.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Company Dashboard Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Failed to load company dashboard",
      error: error.message,
    });
  }
};





export const createCompanyForm = async (req, res, next) => {
  let oldLogoPath = null;
  let oldCoverPath = null;
  console.log(req.body)
  try {
    const id = req.body?.id || req.body?._id;
    const isUpdate = !!id;

    const companyLogoFile = req.files?.companyLogo?.[0];
    const coverImageFile = req.files?.coverImage?.[0];
    const signatureUrlFile = req.files?.signatureUrl?.[0];

    const companyName = toCleanString(req.body?.companyName);
    const companyType = toCleanString(req.body?.companyType);
    const industry = toCleanString(req.body?.industry || req.body?.sector);
    const domains = toCleanStringArray(req.body?.domains || req.body?.domain);
    const companyTagLine = toCleanString(req.body?.companyTagLine);
    const companyCultureTags = toCleanStringArray(req.body?.companyCultureTags);
    const yearFounded = toCleanString(req.body?.yearFounded);
    const websiteLink = toCleanString(req.body?.websiteLink);
    const linkedinUrl = toCleanString(req.body?.linkedinUrl || req.body?.linkedinLink || req.body?.linkedin);
    const employees = req?.body?.employees
    let companyLogo = getUploadedFilePath(companyLogoFile);
    let coverImage = getUploadedFilePath(coverImageFile);
    let signatureUrl = getUploadedFilePath(signatureUrlFile);

    const contactPersonName = toCleanString(req.body?.contactPersonName);
    const phoneNumber = toCleanString(req.body?.phoneNumber);
    const mailId = toCleanString(req.body?.mailId).toLowerCase();
    const address = toCleanString(req.body?.address);
    const city = toCleanString(req.body?.city);
    const state = toCleanString(req.body?.state);
    const pincode = toCleanString(req.body?.pincode);

    // ==============================
    // ACCOUNT DETAILS
    // ==============================

    const accountHolderName = toCleanString(req.body?.accountHolderName);
    const bankName = toCleanString(req.body?.bankName);
    const branchName = toCleanString(req.body?.branchName);
    const accountNumber = toCleanString(req.body?.accountNumber);
    const ifscCode = toCleanString(req.body?.ifscCode);
    const verificationStatus = toCleanString(req.body?.verificationStatus) || "Pending";


    const technologies = toCleanStringArray(req.body?.technologies);
    const whatWeDo = toCleanStringArray(req.body?.whatWeDo);
    const learningBenefits = toCleanStringArray(req.body?.learningBenefits);
    const learningOutcomes = toCleanStringArray(req.body?.learningOutcomes);

    const aboutUs = toCleanString(req.body?.aboutUs);
    const certificateAvailability = toCleanString(req.body?.certificateAvailability);
    const signatoryName = toCleanString(req.body?.signatoryName);
    const signatoryDesignation = toCleanString(req.body?.signatoryDesignation);
    const certificateContentBody = toCleanString(req.body?.certificateContentBody);

    // Validation
    if (!companyName) throw Object.assign(new Error("Company Name is required"), { status: 400 });
    if (!companyType) throw Object.assign(new Error("Company Type is required"), { status: 400 });
    if (!industry) throw Object.assign(new Error("Industry / Sector is required"), { status: 400 });

    // File validation only for new creations (Logo required, Cover Image optional)
    if (!isUpdate && !companyLogo) throw Object.assign(new Error("Company Logo is required"), { status: 400 });

    if (!contactPersonName) throw Object.assign(new Error("Contact Person Name is required"), { status: 400 });
    if (!phoneNumber) throw Object.assign(new Error("Phone Number is required"), { status: 400 });
    if (!mailId) throw Object.assign(new Error("Mail Id is required"), { status: 400 });
    if (!PHONE_REGEX.test(phoneNumber)) throw Object.assign(new Error("Phone Number must be exactly 10 digits"), { status: 400 });
    if (!EMAIL_REGEX.test(mailId)) throw Object.assign(new Error("Mail Id format is invalid"), { status: 400 });
    if (!address) throw Object.assign(new Error("Address is required"), { status: 400 });
    if (!city) throw Object.assign(new Error("City is required"), { status: 400 });
    if (!state) throw Object.assign(new Error("State is required"), { status: 400 });
    if (!pincode) throw Object.assign(new Error("Pincode is required"), { status: 400 });

    // if (technologies.length < 3) throw Object.assign(new Error("At least 3 Technologies / Tools values are required"), { status: 400 });
    // if (whatWeDo.length < 3) throw Object.assign(new Error("At least 3 What We Do (Core Areas) values are required"), { status: 400 });

    if (!aboutUs) throw Object.assign(new Error("About the Company is required"), { status: 400 });

    // Uniqueness check for email and phone
    let currentUserId = null;
    if (isUpdate) {
      const existingCompany = await Company.findById(id);
      if (existingCompany) currentUserId = existingCompany.userId;
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
      // Update existing user to be associated with this company
      targetUser.name = companyName;
      targetUser.phone = phoneNumber;
      await targetUser.save();
    } else {
      // Check existing user by email or phone
      const existingUser = await User.findOne({
        $or: [
          { email: mailId },
          { phone: phoneNumber }
        ]
      });

      if (existingUser) {
        if (existingUser.email === mailId) {
          return res.status(400).json({
            success: false,
            message: "Email Id already exists"
          });
        }
        if (existingUser.phone === phoneNumber) {
          return res.status(400).json({
            success: false,
            message: "Mobile Number already exists"
          });
        }
      }

      // Create new user account for the company
      targetUser = await User.create({
        name: companyName,
        email: mailId,
        phone: phoneNumber,
        role: "company",
        is_active: true,
        password: null
      });
    }

    const targetUserId = targetUser._id;
    const creatorId = req.user._id;

    let company;

    if (isUpdate) {
      company = await Company.findById(id);
      if (!company) throw Object.assign(new Error("Company not found"), { status: 404 });

      // Prepare cleanup of old files if new ones are uploaded
      if (companyLogo) {
        oldLogoPath = company.companyLogo;
        company.companyLogo = companyLogo;
      }
      if (coverImage) {
        oldCoverPath = company.coverImage;
        company.coverImage = coverImage;
      }

      // Update fields
      company.userId = targetUserId; // Link to the target account
      company.companyName = companyName;
      company.companyType = companyType;
      company.industry = industry;
      company.domains = domains;
      company.companyTagLine = companyTagLine;
      company.companyCultureTags = companyCultureTags || "";
      company.yearFounded = yearFounded || "";
      company.websiteLink = websiteLink || "";
      company.linkedinUrl = linkedinUrl || "";
      company.contactPersonName = contactPersonName;
      company.address = address;
      company.city = city;
      company.state = state;
      company.pincode = pincode;
      company.technologies = technologies;
      company.whatWeDo = whatWeDo;
      company.learningBenefits = learningBenefits;
      company.learningOutcomes = learningOutcomes;
      company.aboutUs = aboutUs;
      company.certificateAvailability = certificateAvailability;
      company.employees = employees;
      company.accountHolderName = accountHolderName;
      company.bankName = bankName;
      company.branchName = branchName;
      company.accountNumber = accountNumber;
      company.ifscCode = ifscCode;
      company.verificationStatus = verificationStatus;
      if (signatureUrl) {
        company.signatureUrl = signatureUrl;
      }
      company.signatoryName = signatoryName;
      company.signatoryDesignation = signatoryDesignation;
      company.certificateContentBody = certificateContentBody;

      await company.save();
    } else {
      company = await Company.create({
        c_by: creatorId, // The admin who created it
        userId: targetUserId, // The associated account
        companyName,
        companyType,
        industry,
        domains,
        companyTagLine,
        companyCultureTags: companyCultureTags || "",
        yearFounded: yearFounded || "",
        websiteLink: websiteLink || "",
        linkedinUrl: linkedinUrl || "",
        companyLogo,
        coverImage,
        contactPersonName,
        address,
        city,
        state,
        pincode,
        technologies,
        whatWeDo,
        learningBenefits,
        learningOutcomes,
        aboutUs,
        certificateAvailability,
        signatureUrl: signatureUrl || "",
        signatoryName: signatoryName || "",
        signatoryDesignation: signatoryDesignation || "",
        certificateContentBody: certificateContentBody || "",
        employees,
        accountHolderName,
        bankName,
        branchName,
        accountNumber,
        ifscCode,
        verificationStatus,
      });
    }

    // Cleanup old files ONLY on successful update
    if (oldLogoPath) fs.unlink(path.join(process.cwd(), oldLogoPath), () => { });
    if (oldCoverPath) fs.unlink(path.join(process.cwd(), oldCoverPath), () => { });

    const companyObj = company.toObject ? company.toObject() : { ...company };
    const resolvedDomains = Array.isArray(companyObj.domains) && companyObj.domains.length
      ? companyObj.domains
      : (companyObj.domain ? companyObj.domain.split(",").map((s) => s.trim()).filter(Boolean) : []);
    delete companyObj.domain;
    companyObj.domains = resolvedDomains;

    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: `Company  ${isUpdate ? "updated" : "created"} successfully`,
      data: companyObj,
    });
  } catch (error) {
    // Cleanup newly uploaded files on failure
    cleanupUploadedFiles([
      ...(req.files?.companyLogo || []),
      ...(req.files?.coverImage || []),
    ]);
    next(error);
  }
};



export const getAllCompany = async (req, res, next) => {
  try {
    const companies = await Company.find({}).populate("userId", "email phone role is_active").lean();

    const flattenedCompanies = companies.map(company => {
      const { userId, domain, ...rest } = company;
      const resolvedDomains = Array.isArray(rest.domains) && rest.domains.length ? rest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
      return {
        ...rest,
        domains: resolvedDomains,
        email: userId?.email || "",
        phone: userId?.phone || "",
        role: userId?.role || "",
        is_active: userId?.is_active ?? true
      };
    });

    res.status(200).json({
      success: true,
      data: flattenedCompanies,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompanyNames = async (req, res, next) => {
  try {
    const companies = await Company.find({}, "companyName companyLogo").sort({ companyName: 1 }).lean();

    const names = [...new Set(
      companies
        .map((company) => toCleanString(company?.companyName))
        .filter(Boolean)
    )];

    res.status(200).json({
      success: true,
      data: names,
      companies: companies.map((c) => ({
        companyName: toCleanString(c?.companyName),
        companyLogo: c?.companyLogo || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};



export const getMyCompany = async (req, res, next) => {
  try {
    const company = await Company.findOne({ userId: req.user._id }).populate("userId", "name email phone role is_active");
    const companyUserId = req.user._id
    if (!company) {
      const error = new Error("Company profile not found for this user");
      error.status = 404;
      throw error;
    }

    const { userId, domain, ...rest } = company.toObject();
    const resolvedDomains = Array.isArray(rest.domains) && rest.domains.length ? rest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
    const flattenedCompany = {
      ...rest,
      domains: resolvedDomains,
      email: userId?.email || "",
      phone: userId?.phone || "",
      role: userId?.role || "",
      is_active: userId?.is_active ?? true
    };

    // ── 2. Get Internships (c_by = companyUserId) ──────────────
    const rawInternships = await Internship.find({ c_by: companyUserId })
      .sort({ createdAt: -1 })
      .select("jobTitle domain domains location companyName duration salary paymentAmount internshipType eligibility createdAt")
      .lean();

    const internships = rawInternships.map(item => {
      const { domain: itemDomain, ...itemRest } = item;
      const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (itemDomain ? itemDomain.split(",").map(s => s.trim()).filter(Boolean) : []);
      return { ...itemRest, domains: itemDomains };
    });

    // ── 3. Get Freelances (c_by = companyUserId) ───────────────
    const rawFreelances = await Freelance.find({ c_by: companyUserId })
      .sort({ createdAt: -1 })
      .select("jobTitle domain domains location companyName eligibility jobStartDate jobEndDate duration totalOpenings mode salary createdAt")
      .lean();

    const freelances = rawFreelances.map(item => {
      const { domain: itemDomain, ...itemRest } = item;
      const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (itemDomain ? itemDomain.split(",").map(s => s.trim()).filter(Boolean) : []);
      return { ...itemRest, domains: itemDomains };
    });

    // ── 4. Get Followers (Matches either Company Document _id or Company User ID) ──
    const targetCompanyIds = [companyUserId, company._id].filter(Boolean);
    const rawFollowers = await CompanyFollow.find({ companyId: { $in: targetCompanyIds } })
      .populate("userId", "name email phone")
      .lean();

    // Deduplicate by user ID
    const seenUserIds = new Set();
    const followers = rawFollowers.filter((f) => {
      const uid = f.userId?._id?.toString() || f.userId?.toString();
      if (!uid || seenUserIds.has(uid)) return false;
      seenUserIds.add(uid);
      return true;
    });

    // ── 5. Enrich each follower with UserDetails ───────────────
    const followersData = await Promise.all(
      followers.map(async (follow) => {
        const followerUser = follow.userId;
        const followerUserId = followerUser?._id || follow.userId;

        const userDetails = await UserDetails.findOne({
          userId: followerUserId,
        })
          .select("name dob gender profile_pic currentStatus education ugDegree ugFieldOfStudy ugYear pgDegree pgFieldOfStudy pgYear companyName jobTitle yearOfExperience")
          .lean();

        const followerName = followerUser?.name || userDetails?.name || "Anonymous";

        return {
          userId: followerUserId,
          name: followerName,
          email: followerUser?.email || "",
          phone: followerUser?.phone || "",
          contact: followerUser?.phone || "",
          followedAt: follow.createdAt,
          degree: userDetails?.ugDegree || userDetails?.pgDegree || "-",
          education: userDetails?.education || "-",
          jobTitle: userDetails?.jobTitle || "-",
          status: userDetails?.currentStatus || "Active",
          ...userDetails,
          name: followerName,
        };
      })
    );

    // ── 6. Send Response ───────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        company: flattenedCompany,
        jobs: {
          internships,
          internshipsCount: internships.length,
          freelances,
          freelancesCount: freelances.length,
        },
        followers: {
          count: followersData.length,
          data: followersData,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// export const getCompanyById = async (req, res, next) => {
//     try {
//         const { id } = req.params;
//         const company = await Company.findById(id).populate("userId", "email phone role isActive").lean();

//         if (!company) {
//             const error = new Error("Company not found");
//             error.status = 404;
//             throw error;
//         }

//         const { userId, ...rest } = company;
//         const flattenedCompany = {
//             ...rest,
//             email: userId?.email || "",
//             phone: userId?.phone || "",
//             role: userId?.role || "",
//             isActive: userId?.isActive ?? true
//         };

//         res.status(200).json({
//             success: true,
//             data: flattenedCompany,
//         });
//     } catch (error) {
//         next(error);
//     }
// };

export const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ── 1. Get Company ─────────────────────────────────────────
    const company = await Company.findById(id)
      .populate("userId", "email phone role is_active")
      .lean();

    if (!company) {
      const error = new Error("Company not found");
      error.status = 404;
      throw error;
    }

    const { userId, domain, ...rest } = company;
    const companyUserId = userId?._id; // this is the c_by value in internship/freelance

    const resolvedDomains = Array.isArray(rest.domains) && rest.domains.length ? rest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
    const flattenedCompany = {
      ...rest,
      domains: resolvedDomains,
      email: userId?.email || "",
      phone: userId?.phone || "",
      role: userId?.role || "",
      is_active: userId?.is_active ?? true,
    };

    // ── 2. Get Internships (c_by = companyUserId) ──────────────
    const rawInternships = await Internship.find({ c_by: companyUserId })
      .sort({ createdAt: -1 })
      .select("jobTitle domain domains location companyName duration salary paymentAmount internshipType eligibility createdAt")
      .lean();

    const internships = rawInternships.map(item => {
      const { domain: itemDomain, ...itemRest } = item;
      const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (itemDomain ? itemDomain.split(",").map(s => s.trim()).filter(Boolean) : []);
      return { ...itemRest, domains: itemDomains };
    });

    // ── 3. Get Freelances (c_by = companyUserId) ───────────────
    const rawFreelances = await Freelance.find({ c_by: companyUserId })
      .sort({ createdAt: -1 })
      .select("jobTitle domain domains location companyName eligibility jobStartDate jobEndDate duration totalOpenings mode salary createdAt")
      .lean();

    const freelances = rawFreelances.map(item => {
      const { domain: itemDomain, ...itemRest } = item;
      const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (itemDomain ? itemDomain.split(",").map(s => s.trim()).filter(Boolean) : []);
      return { ...itemRest, domains: itemDomains };
    });

    // ── 4. Get Followers (Matches either Company Document _id or Company User ID) ──
    const targetCompanyIds = [companyUserId, company._id].filter(Boolean);
    const rawFollowers = await CompanyFollow.find({ companyId: { $in: targetCompanyIds } })
      .populate("userId", "email phone name")
      .lean();

    // Deduplicate by user ID
    const seenUserIds = new Set();
    const followers = rawFollowers.filter((f) => {
      const uid = f.userId?._id?.toString() || f.userId?.toString();
      if (!uid || seenUserIds.has(uid)) return false;
      seenUserIds.add(uid);
      return true;
    });

    // ── 5. Enrich each follower with UserDetails ───────────────
    const followersData = await Promise.all(
      followers.map(async (follow) => {
        const followerUser = follow.userId;
        const followerUserId = followerUser?._id || follow.userId;

        const userDetails = await UserDetails.findOne({
          userId: followerUserId,
        })
          .select("name dob gender profile_pic currentStatus education ugDegree ugFieldOfStudy ugYear pgDegree pgFieldOfStudy pgYear companyName jobTitle yearOfExperience")
          .lean();

        const followerName = followerUser?.name || userDetails?.name || "Anonymous";

        return {
          userId: followerUserId,
          name: followerName,
          email: followerUser?.email || "",
          contact: followerUser?.phone || "",
          followedAt: follow.createdAt,
          degree: userDetails?.ugDegree || userDetails?.pgDegree || "-",
          education: userDetails?.education || "-",
          jobTitle: userDetails?.jobTitle || "-",
          status: userDetails?.currentStatus || "Active"
        };
      })
    );

    // ── 6. Send Response ───────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: {
        company: flattenedCompany,
        jobs: {
          internships,
          internshipsCount: internships.length,
          freelances,
          freelancesCount: freelances.length,
        },
        followers: {
          count: followersData.length,
          data: followersData,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Uploads and attaches post images to a company's profile.
 * Supports multiple file field names ('images', 'posts', 'file', etc.) or URL arrays in body.
 * Robustly matches company by its own document _id, its associated userId, or creator c_by.
 */
export const addPost = async (req, res, next) => {
  // Collect any uploaded files for processing and cleanup on failure
  let rawFiles = [];
  if (Array.isArray(req.files)) {
    rawFiles = req.files;
  } else if (req.files && typeof req.files === "object") {
    rawFiles = Object.values(req.files).flat();
  } else if (req.file) {
    rawFiles = [req.file];
  }

  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      if (rawFiles.length > 0) cleanupUploadedFiles(rawFiles);
      const error = new Error("Invalid or missing Company ID format");
      error.status = 400;
      throw error;
    }

    // Extract paths from uploaded files
    let newPosts = rawFiles
      .map(file => {
        const relPath = getUploadedFilePath(file);
        if (!relPath) return null;
        return relPath.startsWith('/') ? relPath : '/' + relPath;
      })
      .filter(Boolean);

    // Fallback: If no multipart files, check if posts / images were passed in request body
    if (newPosts.length === 0 && (req.body?.posts || req.body?.images)) {
      const bodyPosts = req.body?.posts || req.body?.images;
      const bodyList = Array.isArray(bodyPosts) ? bodyPosts : [bodyPosts];
      newPosts = bodyList
        .filter(item => typeof item === "string" && item.trim().length > 0)
        .map(item => item.trim());
    }

    if (newPosts.length === 0) {
      if (rawFiles.length > 0) cleanupUploadedFiles(rawFiles);
      const error = new Error("No images or posts uploaded");
      error.status = 400;
      throw error;
    }

    // Find company by doc _id, userId, or c_by
    const company = await Company.findOne({
      $or: [
        { _id: id },
        { userId: id },
        { c_by: id }
      ]
    });

    if (!company) {
      if (rawFiles.length > 0) cleanupUploadedFiles(rawFiles);
      const error = new Error("Company not found");
      error.status = 404;
      throw error;
    }

    // Safely append new posts without breaking on missing schema fields or non-array posts
    const existingPosts = Array.isArray(company.posts) ? company.posts : [];
    company.posts = [...existingPosts, ...newPosts];
    await company.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Posts added successfully",
      data: company.posts
    });
  } catch (error) {
    if (rawFiles.length > 0) {
      cleanupUploadedFiles(rawFiles);
    }
    next(error);
  }
};

/**
 * Deletes a specific post image from a company's profile.
 * Enforces multi-layer defensive checks:
 * 1. Validates ID format and image URL inputs.
 * 2. Strict authorization: Only an admin or the verified company owner can delete posts.
 * 3. Atomic database update: Removes the specific post URL from the company's posts array.
 * 4. Path traversal defense: Strictly confines physical file unlink to the uploads/company directory.
 */
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUrl =
      req.body?.imageUrl ||
      req.body?.postUrl ||
      req.body?.image ||
      req.body?.post ||
      req.query?.imageUrl ||
      req.query?.postUrl;

    // ── 1. Validate Input Parameters ───────────────────────────
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid or missing Company ID format");
      error.status = 400;
      throw error;
    }

    if (!targetUrl || typeof targetUrl !== "string" || !targetUrl.trim()) {
      const error = new Error("Image URL to delete is required");
      error.status = 400;
      throw error;
    }

    // ── 2. Find Target Company ─────────────────────────────────
    const company = await Company.findOne({
      $or: [{ _id: id }, { userId: id }, { c_by: id }],
    });

    if (!company) {
      const error = new Error("Company not found");
      error.status = 404;
      throw error;
    }

    // ── 3. Strict Ownership & Role Authorization ───────────────
    // Prevent any unauthorized user from deleting another company's media
    const companyUserId = company.userId?._id
      ? company.userId._id.toString()
      : company.userId?.toString();
    const companyCreatorId = company.c_by?.toString();
    const currentUserId = req.user?._id?.toString();
    const isAdmin = req.user?.role === "admin";

    const isOwner =
      (companyUserId && companyUserId === currentUserId) ||
      (companyCreatorId && companyCreatorId === currentUserId);

    if (!isAdmin && !isOwner) {
      const error = new Error("Access denied: You can only delete your own company's posts");
      error.status = 403;
      throw error;
    }

    // ── 4. Verify Image Exists in Company's Posts ───────────────
    const cleanTarget = targetUrl.trim();
    const normalizedTarget = cleanTarget.startsWith("/") ? cleanTarget : `/${cleanTarget}`;
    const unslashedTarget = cleanTarget.replace(/^\/+/, "");

    const existingPosts = Array.isArray(company.posts) ? company.posts : [];
    const postIndex = existingPosts.findIndex((p) => {
      const norm = p.startsWith("/") ? p : `/${p}`;
      return norm === normalizedTarget || p === unslashedTarget;
    });

    if (postIndex === -1) {
      const error = new Error("The specified post image was not found on this company profile");
      error.status = 404;
      throw error;
    }

    // ── 5. Remove Post from Database ───────────────────────────
    const [removedPostPath] = existingPosts.splice(postIndex, 1);
    company.posts = existingPosts;
    await company.save({ validateBeforeSave: false });

    // ── 6. Path Traversal Guard & Physical File Deletion ───────
    try {
      const cleanPath = (removedPostPath || cleanTarget).replace(/^\/+/, "");
      const resolvedPath = path.resolve(process.cwd(), cleanPath);
      const uploadsDir = path.resolve(process.cwd(), "uploads", "company");

      // Verify resolved path strictly resides inside uploads/company/
      if (resolvedPath.startsWith(uploadsDir) && fs.existsSync(resolvedPath)) {
        fs.unlink(resolvedPath, (err) => {
          if (err) {
            console.error("[POST DELETE UNLINK ERROR]", err.message);
          }
        });
      }
    } catch (cleanupErr) {
      console.error("[POST DELETE CLEANUP ERROR]", cleanupErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Post image deleted successfully",
      data: company.posts,
    });
  } catch (error) {
    next(error);
  }
};

export const setPassword = async (req, res, next) => {
  try {
    const { id, password, confirmPassword } = req.body;

    if (!id || !password || !confirmPassword) {
      const error = new Error("Company ID, password, and confirm password are required");
      error.status = 400;
      throw error;
    }

    if (password !== confirmPassword) {
      const error = new Error("Passwords do not match");
      error.status = 400;
      throw error;
    }

    const company = await Company.findById(id);
    if (!company) {
      const error = new Error("Company not found");
      error.status = 404;
      throw error;
    }

    const user = await User.findById(company.userId);
    if (!user) {
      const error = new Error("Associated user account not found");
      error.status = 404;
      throw error;
    }

    // The pre-save hook in userModel will hash this
    user.password = password;
    user.is_active = true
    user.register_status = "completed"
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    next(error);
  }
};
export const toggleCompanyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);

    if (!company) {
      const error = new Error("Company not found");
      error.status = 404;
      throw error;
    }

    const user = await User.findById(company.userId);
    if (!user) {
      const error = new Error("Associated user not found");
      error.status = 404;
      throw error;
    }

    user.is_active = !user.is_active;
    await user.save();
    console.log(user)
    const companyObj = company.toObject();
    const resolvedDomains = Array.isArray(companyObj.domains) && companyObj.domains.length
      ? companyObj.domains
      : (companyObj.domain ? companyObj.domain.split(",").map((s) => s.trim()).filter(Boolean) : []);
    delete companyObj.domain;
    companyObj.domains = resolvedDomains;

    res.status(200).json({
      success: true,
      message: `Account ${user.is_active ? "activated" : "deactivated"} successfully`,
      data: { ...companyObj, is_active: user.is_active }
    });
  } catch (error) {
    next(error);
  }
};

import Freelance from "../models/freelanceModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import UserDetails from "../models/userDetails.js";
import { notifyJobAudience } from "../helper/jobNotification.js";
import Company from "../models/companyModel.js";
import User from "../models/userModel.js";

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const parseArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch (e) { return [val]; }
  }
  return [];
};

const PROJECT_TYPE_MIN_BUDGET = {
  "Small Project": 1000,
  "Standard Project": 2500,
  "Medium Project": 5000,
  "Advanced Project": 10000,
};

export const createFreelanceForm = async (req, res, next) => {
  try {
    const { id, _id, ...rest } = req.body;
    const targetId = id || _id;
    const isUpdate = !!targetId;
    const status = req?.user?.role === "admin" ? "approved" : "pending"
    const {
      domain,
      domains,
      jobTitle,
      companyName,
      projectType,
      mode,
      totalOpenings,
      duration,
      applicationDeadline,
      jobStartDate,
      jobEndDate,
      salary,
      budgetType,
      budget,
      paymentMethod,
      paymentStructure,
      milestones,
      projectNeeds,
      eligibility,
      security,
      referenceWebsite,
      learning,
      certificateAvailability,
      description,
      supporting_files,
      payment_structure,
      rules,
      skill_set,
      eligibility_criteria,
      location
    } = rest;

    // Validation
    if (!jobTitle) throw Object.assign(new Error("Job Title is required"), { status: 400 });
    if (!companyName) throw Object.assign(new Error("Company Name is required"), { status: 400 });

    const selectedType = projectType || "Small Project";
    const numericBudget = parseFloat(String(budget || "").replace(/[^0-9.]/g, ""));
    const minRequired = PROJECT_TYPE_MIN_BUDGET[selectedType];
    if (minRequired && (!numericBudget || numericBudget < minRequired)) {
      throw Object.assign(
        new Error(`Minimum budget for ${selectedType} is ₹${minRequired.toLocaleString("en-IN")}`),
        { status: 400 }
      );
    }

    let freelance;

    if (isUpdate) {
      freelance = await Freelance.findById(targetId);
      if (!freelance) {
        throw Object.assign(new Error("Freelance not found"), { status: 404 });
      }
      if (req.user?.role === "company" && freelance.c_by?.toString() !== req.user._id?.toString()) {
        throw Object.assign(new Error("Not authorized to update this freelance"), { status: 403 });
      }
    } else {
      freelance = new Freelance({ c_by: req.user._id });
      freelance.status = status
    }
    const resolvedDomains = parseArray(domains || domain);

    // Update fields
    freelance.domains = resolvedDomains;
    freelance.jobTitle = toCleanString(jobTitle);
    freelance.companyName = toCleanString(companyName);
    freelance.projectType = toCleanString(projectType) || "Small Project";
    freelance.mode = toCleanString(mode) || "Online";
    freelance.totalOpenings = Number(totalOpenings) || 0;
    freelance.duration = toCleanString(duration);
    freelance.applicationDeadline = applicationDeadline || undefined;
    freelance.jobStartDate = jobStartDate || undefined;
    freelance.jobEndDate = jobEndDate || undefined;
    freelance.salary = Number(salary) || 0;
    freelance.budgetType = toCleanString(budgetType) || "Fixed";
    freelance.budget = toCleanString(budget);
    freelance.paymentMethod = toCleanString(paymentMethod);
    freelance.paymentStructure = toCleanString(paymentStructure) || toCleanString(rest.paymentstructure) || "Full Payment";
    freelance.milestones = parseArray(milestones)
      .map((m) => ({
        milestoneName: toCleanString(m?.milestoneName),
        amount: Number(m?.amount) || 0,
        dueDate: m?.dueDate ? new Date(m.dueDate) : undefined,
      }))
      .filter((m) => m.milestoneName || m.amount > 0 || m.dueDate);
    freelance.location = toCleanString(location);
    freelance.learning = toCleanString(learning);
    freelance.certificateAvailability = toCleanString(certificateAvailability);
    freelance.description = toCleanString(description);

    freelance.projectNeeds = parseArray(projectNeeds);
    freelance.eligibility = parseArray(eligibility);
    freelance.security = parseArray(security);
    freelance.referenceWebsite = parseArray(referenceWebsite);
    freelance.rules = parseArray(rules);
    freelance.skill_set = parseArray(skill_set);
    freelance.payment_structure = parseArray(payment_structure);
    freelance.supporting_files = parseArray(supporting_files);
    freelance.eligibility_criteria = parseArray(eligibility_criteria);
    const savedFreelance = await freelance.save();
    const freelanceObj = savedFreelance.toObject();
    delete freelanceObj.domain;
    freelanceObj.domains = Array.isArray(freelanceObj.domains) && freelanceObj.domains.length
      ? freelanceObj.domains
      : resolvedDomains;

    res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: `Freelance ${isUpdate ? "updated" : "created"} successfully`,
      data: freelanceObj,
    });

  } catch (error) {
    next(error);
  }
};


export const getAllFreelances = async (req, res, next) => {
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

    const freelances = await Freelance.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const data = await Promise.all(
      freelances.map(async (item) => {
        const appliedCount = await AppliedJob.countDocuments({
          jobId: item._id,
          jobType: "Freelance",
        });
        const { domain, ...itemRest } = item;
        const itemDomains = Array.isArray(itemRest.domains) && itemRest.domains.length ? itemRest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
        return { ...itemRest, domains: itemDomains, appliedCount };
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

export const getFreelanceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const freelance = await Freelance.findById(id).lean();

    if (!freelance) {
      throw Object.assign(new Error("Freelance not found"), { status: 404 });
    }

    if (
      req.user?.role === "company" &&
      freelance.c_by?.toString() !== req.user._id?.toString()
    ) {
      throw Object.assign(new Error("Freelance not found"), { status: 404 });
    }

    // ── Get Applied List ────────────────────────────────────
    const applications = await AppliedJob.find({
      jobId: id,
      jobType: "Freelance",
    })
      .populate("userId", "email phone name ")
      .sort({ createdAt: -1 })
      .lean();

    // ── Enrich with UserDetails ─────────────────────────────
    const appliedList = await Promise.all(
      applications.map(async (app, index) => {
        const userDetails = await UserDetails.findOne({
          userId: app.userId?._id,
        })
          .select(
            "profile_pic gender dob currentStatus education ugDegree ugFieldOfStudy ugYear pgDegree pgFieldOfStudy pgYear companyName jobTitle yearOfExperience"
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
          portfolio: app.portfolio || null,
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

    // Resolve company logo from company profile or admin
    let companyLogo = null;
    if (freelance.c_by) {
      const company = await Company.findOne({
        $or: [{ userId: freelance.c_by }, { c_by: freelance.c_by }],
      })
        .select("companyLogo")
        .lean();
      if (company?.companyLogo) {
        companyLogo = company.companyLogo;
      }
    }
    if (!companyLogo && freelance.companyName) {
      const companyByName = await Company.findOne({
        companyName: new RegExp(`^${freelance.companyName.trim()}$`, "i"),
      })
        .select("companyLogo")
        .lean();
      if (companyByName?.companyLogo) {
        companyLogo = companyByName.companyLogo;
      }
    }
    if (!companyLogo && freelance.c_by) {
      const creator = await User.findById(freelance.c_by).select("role").lean();
      if (creator?.role === "admin") {
        companyLogo = "uploads/Nulinz LOGO 3.png";
      }
    }

    const { domain, ...freelanceRest } = freelance;
    const itemDomains = Array.isArray(freelanceRest.domains) && freelanceRest.domains.length ? freelanceRest.domains : (domain ? domain.split(",").map(s => s.trim()).filter(Boolean) : []);
    const enrichedFreelance = {
      ...freelanceRest,
      domains: itemDomains,
      companyLogo: companyLogo || "",
      companyImage: companyLogo || "",
    };

    return res.status(200).json({
      success: true,
      data: {
        freelance: enrichedFreelance,
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

export const toggleFreelanceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const freelance = await Freelance.findById(id);

    if (!freelance) {
      throw Object.assign(new Error("Freelance not found"), { status: 404 });
    }
    if (req.user?.role === "company" && freelance.c_by?.toString() !== req.user._id?.toString()) {
      throw Object.assign(new Error("Not authorized to update this freelance"), { status: 403 });
    }

    freelance.isActive = !freelance.isActive;
    await freelance.save();

    const freelanceObj = freelance.toObject();
    const resolvedDomains = Array.isArray(freelanceObj.domains) && freelanceObj.domains.length
      ? freelanceObj.domains
      : (freelanceObj.domain ? freelanceObj.domain.split(",").map((s) => s.trim()).filter(Boolean) : []);
    delete freelanceObj.domain;
    freelanceObj.domains = resolvedDomains;

    res.status(200).json({
      success: true,
      message: `Freelance ${freelance.isActive ? "activated" : "deactivated"} successfully`,
      data: freelanceObj,
    });
  } catch (error) {
    next(error);
  }
};

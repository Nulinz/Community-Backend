import Freelance from "../models/freelanceModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import UserDetails from "../models/userDetails.js";

const toCleanString = (value) =>
    typeof value === "string" ? value.trim() : "";

const parseArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
        try { return JSON.parse(val); } catch (e) { return [val]; }
    }
    return [];
};

export const createFreelanceForm = async (req, res, next) => {
    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;

        const {
            jobTitle,
            companyName,
            mode,
            totalOpenings,
            duration,
            applicationDeadline,
            jobStartDate,
            salary,
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
            eligibility_criteria,
             location
        } = rest;

        // Validation
        if (!jobTitle) throw Object.assign(new Error("Job Title is required"), { status: 400 });
        if (!companyName) throw Object.assign(new Error("Company Name is required"), { status: 400 });
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });

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
        }

        // Update fields
        freelance.jobTitle = toCleanString(jobTitle);
        freelance.companyName = toCleanString(companyName);
        freelance.mode = toCleanString(mode);
        freelance.totalOpenings = Number(totalOpenings) || 0;
        freelance.duration = toCleanString(duration);
        freelance.applicationDeadline = applicationDeadline || undefined;
        freelance.jobStartDate = jobStartDate || undefined;
        freelance.salary = Number(salary) || 0;
        freelance.location = toCleanString(location)
        freelance.learning = toCleanString(learning);
        freelance.certificateAvailability = toCleanString(certificateAvailability);
        freelance.description = toCleanString(description);

        freelance.projectNeeds = parseArray(projectNeeds);
        freelance.eligibility = parseArray(eligibility);
        freelance.security = parseArray(security);
        freelance.referenceWebsite = parseArray(referenceWebsite);
    freelance.rules = parseArray(rules);
    freelance.payment_structure = parseArray(payment_structure);
    freelance.supporting_files = parseArray(supporting_files);
     freelance. eligibility_criteria = parseArray( eligibility_criteria);
        await freelance.save();

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Freelance ${isUpdate ? "updated" : "created"} successfully`,
            data: freelance,
        });

    } catch (error) {
        next(error);
    }
};


export const getAllFreelances = async (req, res, next) => {
  try {
    const query = { isActive: true };
    if (req.user?.role === "company") {
      query.c_by = req.user._id;
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
      .populate("userId", "email phone")
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
          email: app.userId?.email || "",
          phone: app.userId?.phone || "",
          appliedAt: app.createdAt,
          profile_pic: userDetails?.profile_pic || null,
          gender: userDetails?.gender || "",
          currentStatus: userDetails?.currentStatus || "",
          education: userDetails?.education || "",
          ugDegree: userDetails?.ugDegree || "",
          ugFieldOfStudy: userDetails?.ugFieldOfStudy || "",
          ugYear: userDetails?.ugYear || null,
          pgDegree: userDetails?.pgDegree || "",
          pgFieldOfStudy: userDetails?.pgFieldOfStudy || "",
          pgYear: userDetails?.pgYear || null,
          companyName: userDetails?.companyName || "",
          jobTitle: userDetails?.jobTitle || "",
          yearOfExperience: userDetails?.yearOfExperience || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        freelance,
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

        res.status(200).json({
            success: true,
            message: `Freelance ${freelance.isActive ? "activated" : "deactivated"} successfully`,
            data: freelance,
        });
    } catch (error) {
        next(error);
    }
};

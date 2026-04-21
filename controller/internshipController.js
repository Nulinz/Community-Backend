import Internship from "../models/internshipModel.js";

const toCleanString = (value) =>
    typeof value === "string" ? value.trim() : "";




export const createInternshipForm = async (req, res, next) => {
    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;

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
            certificateAvailability
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
        }

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

        await internship.save();

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
        const query = {};
        if (req.user?.role === "company") {
            query.c_by = req.user._id;
        }

        const internships = await Internship.find(query).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: internships,
        });
    } catch (error) {
        next(error);
    }
};




export const getInternshipById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const internship = await Internship.findById(id);

        if (!internship) {
            throw Object.assign(new Error("Internship not found"), { status: 404 });
        }
        if (req.user?.role === "company" && internship.c_by?.toString() !== req.user._id?.toString()) {
            throw Object.assign(new Error("Internship not found"), { status: 404 });
        }

        res.status(200).json({
            success: true,
            data: internship,
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

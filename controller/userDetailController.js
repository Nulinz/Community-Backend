import UserDetails from "../models/userDetails.js";

const sanitizeInput = (value) =>
    typeof value === "string" ? value.trim() : value;

export const createUserDetails = async (req, res, next) => {
    try {
        const dob = sanitizeInput(req.body.dob);
        const gender = sanitizeInput(req.body.gender);
        const currentStatus = sanitizeInput(req.body.currentStatus);
        const education = sanitizeInput(req.body.education);
        const ugDegree = sanitizeInput(req.body.ugDegree);
        const ugFieldOfStudy = sanitizeInput(req.body.ugFieldOfStudy);
        const ugYear = req.body.ugYear ?? null;
        const pgDegree = sanitizeInput(req.body.pgDegree);
        const pgFieldOfStudy = sanitizeInput(req.body.pgFieldOfStudy);
        const pgYear = req.body.pgYear ?? null;
        const companyName = sanitizeInput(req.body.companyName);
        const jobTitle = sanitizeInput(req.body.jobTitle);
        const yearOfExperience = req.body.yearOfExperience ?? null;
        const hearAboutUs = sanitizeInput(req.body.hearAboutUs);
        const others = sanitizeInput(req.body.others) || null;

        if (!dob) {
            const error = new Error("Date of birth is required");
            error.status = 400;
            throw error;
        }

        if (!gender) {
            const error = new Error("Gender is required");
            error.status = 400;
            throw error;
        }

        if (!currentStatus) {
            const error = new Error("Current status is required");
            error.status = 400;
            throw error;
        }

        if (!education) {
            const error = new Error("Education is required");
            error.status = 400;
            throw error;
        }

        if (!hearAboutUs) {
            const error = new Error("Hear about us is required");
            error.status = 400;
            throw error;
        }

        if (education === "UG") {
            if (!ugDegree) {
                const error = new Error("UG degree is required");
                error.status = 400;
                throw error;
            }

            if (!ugFieldOfStudy) {
                const error = new Error("UG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!ugYear) {
                const error = new Error("UG year is required");
                error.status = 400;
                throw error;
            }
        }

        if (education === "PG") {
            if (!ugDegree) {
                const error = new Error("UG degree is required");
                error.status = 400;
                throw error;
            }

            if (!ugFieldOfStudy) {
                const error = new Error("UG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!ugYear) {
                const error = new Error("UG year is required");
                error.status = 400;
                throw error;
            }

            if (!pgDegree) {
                const error = new Error("PG degree is required");
                error.status = 400;
                throw error;
            }

            if (!pgFieldOfStudy) {
                const error = new Error("PG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!pgYear) {
                const error = new Error("PG year is required");
                error.status = 400;
                throw error;
            }
        }

        if (!["Student", "Unemployed"].includes(currentStatus)) {
            if (!companyName) {
                const error = new Error("Company name is required");
                error.status = 400;
                throw error;
            }

            if (!jobTitle) {
                const error = new Error("Job title is required");
                error.status = 400;
                throw error;
            }

            if (!yearOfExperience) {
                const error = new Error("Year of experience is required");
                error.status = 400;
                throw error;
            }
        }

        const existingUserDetails = await UserDetails.findOne({ userId: req.user._id });

        if (existingUserDetails) {
            const error = new Error("User details already exist");
            error.status = 409;
            throw error;
        }

        const userDetails = await UserDetails.create({
            userId: req.user._id,
            dob,
            gender,
            currentStatus,
            education,
            ugDegree: ugDegree || null,
            ugFieldOfStudy: ugFieldOfStudy || null,
            ugYear,
            pgDegree: pgDegree || null,
            pgFieldOfStudy: pgFieldOfStudy || null,
            pgYear,
            companyName: companyName || null,
            jobTitle: jobTitle || null,
            yearOfExperience,
            hearAboutUs,
            others,
        });

        res.status(201).json({
            success: true,
            message: "User details created successfully",
            userDetails,
        });
    } catch (error) {
        next(error);
    }
};



// get user detail by middlewat=re return user id
export const getUserDetails = async (req, res, next) => {
    try {
        const userDetails = await UserDetails.findOne({ userId: req.user._id });

        if (!userDetails) {
            const error = new Error("User details not found");
            error.status = 404;
            throw error;
        }

        res.status(200).json({
            success: true,
            userDetails: {
                ...userDetails.toObject(),
                name: req.user.name,
                email: req.user.email,
                phone: req.user.phone,
            },
        });
    } catch (error) {
        next(error);
    }
};



export const updateUserDetails = async (req, res, next) => {
    try {
        const dob = sanitizeInput(req.body.dob);
        const gender = sanitizeInput(req.body.gender);
        const currentStatus = sanitizeInput(req.body.currentStatus);
        const education = sanitizeInput(req.body.education);
        const ugDegree = sanitizeInput(req.body.ugDegree);
        const ugFieldOfStudy = sanitizeInput(req.body.ugFieldOfStudy);
        const ugYear = req.body.ugYear ?? null;
        const pgDegree = sanitizeInput(req.body.pgDegree);
        const pgFieldOfStudy = sanitizeInput(req.body.pgFieldOfStudy);
        const pgYear = req.body.pgYear ?? null;
        const companyName = sanitizeInput(req.body.companyName);
        const jobTitle = sanitizeInput(req.body.jobTitle);
        const yearOfExperience = req.body.yearOfExperience ?? null;
        const hearAboutUs = sanitizeInput(req.body.hearAboutUs);
        const others = sanitizeInput(req.body.others) || null;

        if (!dob) {
            const error = new Error("Date of birth is required");
            error.status = 400;
            throw error;
        }

        if (!gender) {
            const error = new Error("Gender is required");
            error.status = 400;
            throw error;
        }

        if (!currentStatus) {
            const error = new Error("Current status is required");
            error.status = 400;
            throw error;
        }

        if (!education) {
            const error = new Error("Education is required");
            error.status = 400;
            throw error;
        }

        if (!hearAboutUs) {
            const error = new Error("Hear about us is required");
            error.status = 400;
            throw error;
        }

        if (education === "UG") {
            if (!ugDegree) {
                const error = new Error("UG degree is required");
                error.status = 400;
                throw error;
            }

            if (!ugFieldOfStudy) {
                const error = new Error("UG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!ugYear) {
                const error = new Error("UG year is required");
                error.status = 400;
                throw error;
            }
        }

        if (education === "PG") {
            if (!ugDegree) {
                const error = new Error("UG degree is required");
                error.status = 400;
                throw error;
            }

            if (!ugFieldOfStudy) {
                const error = new Error("UG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!ugYear) {
                const error = new Error("UG year is required");
                error.status = 400;
                throw error;
            }

            if (!pgDegree) {
                const error = new Error("PG degree is required");
                error.status = 400;
                throw error;
            }

            if (!pgFieldOfStudy) {
                const error = new Error("PG field of study is required");
                error.status = 400;
                throw error;
            }

            if (!pgYear) {
                const error = new Error("PG year is required");
                error.status = 400;
                throw error;
            }
        }

        if (!["Student", "Unemployed"].includes(currentStatus)) {
            if (!companyName) {
                const error = new Error("Company name is required");
                error.status = 400;
                throw error;
            }

            if (!jobTitle) {
                const error = new Error("Job title is required");
                error.status = 400;
                throw error;
            }

            if (!yearOfExperience) {
                const error = new Error("Year of experience is required");
                error.status = 400;
                throw error;
            }
        }

        const userDetails = await UserDetails.findOne({ userId: req.user._id });

        if (!userDetails) {
            const error = new Error("User details not found");
            error.status = 404;
            throw error;
        }

        userDetails.dob = dob;
        userDetails.gender = gender;
        userDetails.currentStatus = currentStatus;
        userDetails.education = education;
        userDetails.ugDegree = ugDegree || null;
        userDetails.ugFieldOfStudy = ugFieldOfStudy || null;
        userDetails.ugYear = ugYear;
        userDetails.pgDegree = pgDegree || null;
        userDetails.pgFieldOfStudy = pgFieldOfStudy || null;
        userDetails.pgYear = pgYear;
        userDetails.companyName = companyName || null;
        userDetails.jobTitle = jobTitle || null;
        userDetails.yearOfExperience = yearOfExperience;
        userDetails.hearAboutUs = hearAboutUs;
        userDetails.others = others;

        await userDetails.save();

        res.status(200).json({
            success: true,
            message: "User details updated successfully",
            userDetails,
        });
    } catch (error) {
        next(error);
    }
}

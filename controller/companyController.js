import { register } from "module";
import Company from "../models/companyModel.js";
import User from "../models/userModel.js";
import fs from "fs";

import path from "path";

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




export const createCompanyForm = async (req, res, next) => {
    let oldLogoPath = null;
    let oldCoverPath = null;

    try {
        const id = req.body?.id || req.body?._id;
        const isUpdate = !!id;

        const companyLogoFile = req.files?.companyLogo?.[0];
        const coverImageFile = req.files?.coverImage?.[0];

        const companyName = toCleanString(req.body?.companyName);
        const companyType = toCleanString(req.body?.companyType);
        const companyTagLine = toCleanString(req.body?.companyTagLine);
        const companyCultureTags = toCleanString(req.body?.companyCultureTags);
        const yearFounded = toCleanString(req.body?.yearFounded);
        const websiteLink = toCleanString(req.body?.websiteLink);

        let companyLogo = getUploadedFilePath(companyLogoFile);
        let coverImage = getUploadedFilePath(coverImageFile);

        const contactPersonName = toCleanString(req.body?.contactPersonName);
        const phoneNumber = toCleanString(req.body?.phoneNumber);
        const mailId = toCleanString(req.body?.mailId).toLowerCase();
        const address = toCleanString(req.body?.address);
        const city = toCleanString(req.body?.city);
        const state = toCleanString(req.body?.state);
        const pincode = toCleanString(req.body?.pincode);

        const technologies = toCleanStringArray(req.body?.technologies);
        const whatWeDo = toCleanStringArray(req.body?.whatWeDo);
        const learningBenefits = toCleanStringArray(req.body?.learningBenefits);
        const learningOutcomes = toCleanStringArray(req.body?.learningOutcomes);

        const aboutUs = toCleanString(req.body?.aboutUs);
        const certificateAvailability = toCleanString(req.body?.certificateAvailability);

        // Validation
        if (!companyName) throw Object.assign(new Error("Company Name is required"), { status: 400 });
        if (!companyType) throw Object.assign(new Error("Company Type is required"), { status: 400 });
        if (!companyTagLine) throw Object.assign(new Error("Company Tag Line is required"), { status: 400 });

        // File validation only for new creations
        if (!isUpdate && !companyLogo) throw Object.assign(new Error("Company Logo is required"), { status: 400 });
        if (!isUpdate && !coverImage) throw Object.assign(new Error("Cover Image is required"), { status: 400 });

        if (!contactPersonName) throw Object.assign(new Error("Contact Person Name is required"), { status: 400 });
        if (!phoneNumber) throw Object.assign(new Error("Phone Number is required"), { status: 400 });
        if (!mailId) throw Object.assign(new Error("Mail Id is required"), { status: 400 });
        if (!PHONE_REGEX.test(phoneNumber)) throw Object.assign(new Error("Phone Number must be exactly 10 digits"), { status: 400 });
        if (!EMAIL_REGEX.test(mailId)) throw Object.assign(new Error("Mail Id format is invalid"), { status: 400 });
        if (!address) throw Object.assign(new Error("Address is required"), { status: 400 });
        if (!city) throw Object.assign(new Error("City is required"), { status: 400 });
        if (!state) throw Object.assign(new Error("State is required"), { status: 400 });
        if (!pincode) throw Object.assign(new Error("Pincode is required"), { status: 400 });

        if (technologies.length < 3) throw Object.assign(new Error("At least 3 Technologies We Use values are required"), { status: 400 });
        if (whatWeDo.length < 3) throw Object.assign(new Error("At least 3 What We Do values are required"), { status: 400 });
        if (learningBenefits.length < 3) throw Object.assign(new Error("At least 3 Learning Benefits values are required"), { status: 400 });
        if (learningOutcomes.length < 3) throw Object.assign(new Error("At least 3 Learning Outcomes values are required"), { status: 400 });

        if (!aboutUs) throw Object.assign(new Error("About us is required"), { status: 400 });
        if (!certificateAvailability) throw Object.assign(new Error("Certificate Availability is required"), { status: 400 });

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
            targetUser.role = "company";
            
            await targetUser.save();
        } else {
            // Create new user account for the company
            targetUser = await User.create({
                name: companyName,
                email: mailId,
                phone: phoneNumber,
                role: "company",
                is_active:false,
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
            company.companyTagLine = companyTagLine;
            company.companyCultureTags = companyCultureTags || "";
            company.yearFounded = yearFounded || "";
            company.websiteLink = websiteLink || "";
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

            await company.save();
        } else {
            company = await Company.create({
                c_by: creatorId, // The admin who created it
                userId: targetUserId, // The associated account
                companyName,
                companyType,
                companyTagLine,
                companyCultureTags: companyCultureTags || "",
                yearFounded: yearFounded || "",
                websiteLink: websiteLink || "",
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
            });
        }

        // Cleanup old files ONLY on successful update
        if (oldLogoPath) fs.unlink(path.join(process.cwd(), oldLogoPath), () => { });
        if (oldCoverPath) fs.unlink(path.join(process.cwd(), oldCoverPath), () => { });

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Company form ${isUpdate ? "updated" : "created"} successfully`,
            data: company,
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
        const companies = await Company.find({}).populate("userId", "email phone role isActive").lean();

        const flattenedCompanies = companies.map(company => {
            const { userId, ...rest } = company;
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
            data: flattenedCompanies,
        });
    } catch (error) {
        next(error);
    }
};

export const getCompanyNames = async (req, res, next) => {
    try {
        const companies = await Company.find({}, "companyName").sort({ companyName: 1 }).lean();

        const names = [...new Set(
            companies
                .map((company) => toCleanString(company?.companyName))
                .filter(Boolean)
        )];

        res.status(200).json({
            success: true,
            data: names,
        });
    } catch (error) {
        next(error);
    }
};



export const getMyCompany = async (req, res, next) => {
    try {
        const company = await Company.findOne({ userId: req.user._id }).populate("userId", "name email phone role isActive");
        if (!company) {
            const error = new Error("Company profile not found for this user");
            error.status = 404;
            throw error;
        }

        const { userId, ...rest } = company.toObject();
        const flattenedCompany = {
            ...rest,
            email: userId?.email || "",
            phone: userId?.phone || "",
            role: userId?.role || "",
            isActive: userId?.isActive ?? true
        };

        res.status(200).json({
            success: true,
            data: flattenedCompany,
        });
    } catch (error) {
        next(error);
    }
};

export const getCompanyById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const company = await Company.findById(id).populate("userId", "email phone role isActive").lean();

        if (!company) {
            const error = new Error("Company not found");
            error.status = 404;
            throw error;
        }

        const { userId, ...rest } = company;
        const flattenedCompany = {
            ...rest,
            email: userId?.email || "",
            phone: userId?.phone || "",
            role: userId?.role || "",
            isActive: userId?.isActive ?? true
        };

        res.status(200).json({
            success: true,
            data: flattenedCompany,
        });
    } catch (error) {
        next(error);
    }
};



export const addPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const files = req.files;

        if (!files || files.length === 0) {
            const error = new Error("No images uploaded");
            error.status = 400;
            throw error;
        }

        const company = await Company.findById(id);
        if (!company) {
            const error = new Error("Company not found");
            error.status = 404;
            throw error;
        }

        // Map files to their paths - Ensure they start with a / as requested
        const newPosts = files.map(file => {
            const relPath = getUploadedFilePath(file);
            return relPath.startsWith('/') ? relPath : '/' + relPath;
        });

        // Update company record
        const updatedCompany = await Company.findByIdAndUpdate(
            id,
            { $push: { posts: { $each: newPosts } } },
            { new: true, runValidators: true }
        ).lean();

        res.status(200).json({
            success: true,
            message: "Posts added successfully",
            data: updatedCompany.posts
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
        user.is_active=true
        register_status="completed"
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

        res.status(200).json({
            success: true,
            message: `Account ${user.isActive ? "activated" : "deactivated"} successfully`,
            data: { ...company.toObject(), isActive: user.isActive }
        });
    } catch (error) {
        next(error);
    }
};

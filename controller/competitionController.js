import Competition from "../models/competitionModel.js";
import fs from "fs";
import path from "path";

const toCleanString = (value) =>
    typeof value === "string" ? value.trim() : "";

const parseDynamicArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            return JSON.parse(trimmed);
        } catch (_error) {
            return [];
        }
    }
    return [];
};

const getUploadedFilePath = (file) => {
    if (!file?.path) return "";
    return path.relative(process.cwd(), file.path).replace(/\\/g, "/");
};

const cleanupUploadedFiles = (fileArray = []) => {
    fileArray.forEach((file) => {
        if (!file?.path) return;
        fs.unlink(file.path, () => { });
    });
};

export const createCompetitionForm = async (req, res, next) => {
    let oldCoverImagePath = null;
    let oldRuleBookPath = null;

    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;

        const {
            eventName,
            organizer,
            mode,
            eventDate,
            registrationType,
            registrationStartDate,
            registrationEndDate,
            totalSeats,
            individualFees,
            teamFees,
            lateFees,
            internshipOpportunity,
            placementOpportunity,
            industryExposure,
            industryPartners,
            firstPrize,
            secondPrize,
            thirdPrize,
            participationPrize,
            venueName,
            venueAddress,
            geoLocation,
            foodProvide,
            vegNonVeg,
            midnightSnacks,
            accommodationProvide,
            separatedForBoysGirls,
            onlyForOutstationParticipants,
            eligibilityDetails,
            allowedDepartments,
            teamOrIndividualEvent,
            teamSizeMinimum,
            teamSizeMaximum,
            additionalRules,
            description,
            rounds,
            schedule,
            incharges,
            certificateAvailability
        } = rest;

        // Validation
        if (!eventName) throw Object.assign(new Error("Event Name is required"), { status: 400 });
        if (!organizer) throw Object.assign(new Error("Organizer is required"), { status: 400 });
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });
        if (!eventDate) throw Object.assign(new Error("Event Date is required"), { status: 400 });
        if (!registrationType) throw Object.assign(new Error("Registration Type is required"), { status: 400 });

        // Handle Files
        const coverImageFile = req.files?.coverImage?.[0];
        const ruleBookFile = req.files?.ruleBook?.[0];

        if (!isUpdate && !coverImageFile) {
            throw Object.assign(new Error("Cover Image is required"), { status: 400 });
        }
        if (!isUpdate && !ruleBookFile) {
            throw Object.assign(new Error("Rule Book is required"), { status: 400 });
        }

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;
        const ruleBookPath = ruleBookFile ? getUploadedFilePath(ruleBookFile) : undefined;

        let competition;

        if (isUpdate) {
            competition = await Competition.findById(targetId);
            if (!competition) {
                throw Object.assign(new Error("Competition not found"), { status: 404 });
            }
            oldCoverImagePath = competition.coverImage;
            oldRuleBookPath = competition.ruleBook;
        } else {
            competition = new Competition({ c_by: req.user._id });
        }

        // Update fields
        competition.eventName = toCleanString(eventName);
        competition.organizer = toCleanString(organizer);
        competition.mode = toCleanString(mode);
        competition.eventDate = eventDate;
        competition.registrationType = toCleanString(registrationType);
        competition.registrationStartDate = registrationStartDate || undefined;
        competition.registrationEndDate = registrationEndDate || undefined;
        competition.totalSeats = Number(totalSeats) || 0;
        
        if (coverImagePath) competition.coverImage = coverImagePath;
        if (ruleBookPath) competition.ruleBook = ruleBookPath;

        competition.individualFees = Number(individualFees) || 0;
        competition.teamFees = Number(teamFees) || 0;
        competition.lateFees = Number(lateFees) || 0;

        competition.internshipOpportunity = toCleanString(internshipOpportunity);
        competition.placementOpportunity = toCleanString(placementOpportunity);
        competition.industryExposure = toCleanString(industryExposure);
        competition.industryPartners = toCleanString(industryPartners);

        competition.firstPrize = toCleanString(firstPrize);
        competition.secondPrize = toCleanString(secondPrize);
        competition.thirdPrize = toCleanString(thirdPrize);
        competition.participationPrize = toCleanString(participationPrize);

        competition.venueName = toCleanString(venueName);
        competition.venueAddress = toCleanString(venueAddress);
        competition.geoLocation = toCleanString(geoLocation);

        competition.foodProvide = toCleanString(foodProvide);
        competition.vegNonVeg = toCleanString(vegNonVeg);
        competition.midnightSnacks = toCleanString(midnightSnacks);
        competition.accommodationProvide = toCleanString(accommodationProvide);
        competition.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        competition.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        competition.eligibilityDetails = toCleanString(eligibilityDetails);
        competition.allowedDepartments = toCleanString(allowedDepartments);
        competition.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent);
        competition.teamSizeMinimum = Number(teamSizeMinimum) || 0;
        competition.teamSizeMaximum = Number(teamSizeMaximum) || 0;

        competition.additionalRules = toCleanString(additionalRules);
        competition.description = toCleanString(description);
        competition.certificateAvailability = toCleanString(certificateAvailability);
        competition.rounds = parseDynamicArray(rounds);
        competition.schedule = parseDynamicArray(schedule);
        competition.incharges = parseDynamicArray(incharges);

        await competition.save();

        // Cleanup old files ONLY on successful update
        if (isUpdate) {
            if (coverImagePath && oldCoverImagePath) {
                fs.unlink(path.join(process.cwd(), oldCoverImagePath), () => { });
            }
            if (ruleBookPath && oldRuleBookPath) {
                fs.unlink(path.join(process.cwd(), oldRuleBookPath), () => { });
            }
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Competition ${isUpdate ? "updated" : "created"} successfully`,
            data: competition,
        });

    } catch (error) {
        cleanupUploadedFiles([...(req.files?.coverImage || []), ...(req.files?.ruleBook || [])]);
        next(error);
    }
};

export const getAllCompetition = async (req, res, next) => {
    try {
        const competitions = await Competition.find({ }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: competitions,
        });
    } catch (error) {
        next(error);
    }
};

export const getCompetitionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const competition = await Competition.findById(id);

        if (!competition) {
            throw Object.assign(new Error("Competition not found"), { status: 404 });
        }

        res.status(200).json({
            success: true,
            data: competition,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleCompetitionStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const competition = await Competition.findById(id);

        if (!competition) {
            throw Object.assign(new Error("Competition not found"), { status: 404 });
        }

        competition.isActive = !competition.isActive;
        await competition.save();

        res.status(200).json({
            success: true,
            message: `Competition ${competition.isActive ? "activated" : "deactivated"} successfully`,
            data: competition,
        });
    } catch (error) {
        next(error);
    }
};

export const addCompetitionPosts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const competition = await Competition.findById(id);

        if (!competition) {
            cleanupUploadedFiles(req.files || []);
            throw Object.assign(new Error("Competition not found"), { status: 404 });
        }

        const newPosts = (req.files || []).map(file => getUploadedFilePath(file));
        
        if (newPosts.length === 0) {
            throw Object.assign(new Error("No images uploaded"), { status: 400 });
        }

        competition.posts = [...(competition.posts || []), ...newPosts];
        await competition.save();

        res.status(200).json({
            success: true,
            message: "Posts added successfully",
            data: competition
        });
    } catch (error) {
        cleanupUploadedFiles(req.files || []);
        next(error);
    }
};

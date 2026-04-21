import Seminar from "../models/seminarModel.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

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

const cleanupUploadedFiles = (files = []) => {
    files.forEach((file) => {
        if (!file?.path) return;
        fs.unlink(file.path, () => { });
    });
};

export const createSeminarForm = async (req, res, next) => {
    let oldCoverImagePath = null;

    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;

        if (isUpdate && !mongoose.Types.ObjectId.isValid(targetId)) {
            throw Object.assign(new Error("Invalid Seminar ID format"), { status: 400 });
        }

        const {
            eventType,
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
            firstPrize,
            secondPrize,
            thirdPrize,
            participationPrize,
            internshipOpportunity,
            placementOpportunity,
            industryExposure,
            industryPartners,
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
            description,
            rounds,
            schedule,
            incharges
        } = rest;

        // Validation
        if (!eventType) throw Object.assign(new Error("Event Type is required"), { status: 400 });
        if (!eventName) throw Object.assign(new Error("Event Name is required"), { status: 400 });
        if (!organizer) throw Object.assign(new Error("Organizer is required"), { status: 400 });
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });
        if (!eventDate) throw Object.assign(new Error("Event Date is required"), { status: 400 });
        if (!registrationType) throw Object.assign(new Error("Registration Type is required"), { status: 400 });

        // Handle File
        const coverImageFile = req.files?.coverImage?.[0];
        if (!isUpdate && !coverImageFile) {
            throw Object.assign(new Error("Cover Image is required"), { status: 400 });
        }

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;

        let seminar;

        if (isUpdate) {
            seminar = await Seminar.findById(targetId);
            if (!seminar) {
                throw Object.assign(new Error("Seminar not found"), { status: 404 });
            }
            oldCoverImagePath = seminar.coverImage;
        } else {
            seminar = new Seminar({ c_by: req.user._id });
        }

        // Update fields
        seminar.eventType = toCleanString(eventType);
        seminar.eventName = toCleanString(eventName);
        seminar.organizer = toCleanString(organizer);
        seminar.mode = toCleanString(mode);
        seminar.eventDate = eventDate;
        seminar.registrationType = toCleanString(registrationType);
        seminar.registrationStartDate = registrationStartDate || undefined;
        seminar.registrationEndDate = registrationEndDate || undefined;
        seminar.totalSeats = Number(totalSeats) || 0;
        
        if (coverImagePath) seminar.coverImage = coverImagePath;

        seminar.individualFees = Number(individualFees) || 0;
        seminar.teamFees = Number(teamFees) || 0;
        seminar.lateFees = Number(lateFees) || 0;

        seminar.firstPrize = toCleanString(firstPrize);
        seminar.secondPrize = toCleanString(secondPrize);
        seminar.thirdPrize = toCleanString(thirdPrize);
        seminar.participationPrize = toCleanString(participationPrize);

        seminar.internshipOpportunity = toCleanString(internshipOpportunity);
        seminar.placementOpportunity = toCleanString(placementOpportunity);
        seminar.industryExposure = toCleanString(industryExposure);
        seminar.industryPartners = toCleanString(industryPartners);

        seminar.venueName = toCleanString(venueName);
        seminar.venueAddress = toCleanString(venueAddress);
        seminar.geoLocation = toCleanString(geoLocation);

        seminar.foodProvide = toCleanString(foodProvide);
        seminar.vegNonVeg = toCleanString(vegNonVeg);
        seminar.midnightSnacks = toCleanString(midnightSnacks);
        seminar.accommodationProvide = toCleanString(accommodationProvide);
        seminar.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        seminar.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        seminar.eligibilityDetails = toCleanString(eligibilityDetails);
        seminar.allowedDepartments = toCleanString(allowedDepartments);
        seminar.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent);
        seminar.teamSizeMinimum = Number(teamSizeMinimum) || 0;
        seminar.teamSizeMaximum = Number(teamSizeMaximum) || 0;

        seminar.description = toCleanString(description);

        seminar.rounds = parseDynamicArray(rounds);
        seminar.schedule = parseDynamicArray(schedule);
        seminar.incharges = parseDynamicArray(incharges);

        await seminar.save();

        if (isUpdate && coverImagePath && oldCoverImagePath) {
            fs.unlink(path.join(process.cwd(), oldCoverImagePath), () => { });
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Seminar ${isUpdate ? "updated" : "created"} successfully`,
            data: seminar,
        });

    } catch (error) {
        cleanupUploadedFiles([...(req.files?.coverImage || [])]);
        next(error);
    }
};

export const getAllSeminars = async (req, res, next) => {
    try {
        const seminars = await Seminar.find({}).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: seminars,
        });
    } catch (error) {
        next(error);
    }
};


export const getSeminarById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Seminar ID format"), { status: 400 });
        }

        const seminar = await Seminar.findById(id);

        if (!seminar) {
            throw Object.assign(new Error("Seminar not found"), { status: 404 });
        }

        res.status(200).json({
            success: true,
            data: seminar,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleSeminarStatus = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Seminar ID format"), { status: 400 });
        }

        const seminar = await Seminar.findById(id);
        if (!seminar) {
            throw Object.assign(new Error("Seminar not found"), { status: 404 });
        }

        seminar.isActive = !seminar.isActive;
        await seminar.save();

        res.status(200).json({
            success: true,
            message: `Seminar ${seminar.isActive ? "activated" : "deactivated"} successfully`,
            data: seminar,
        });
    } catch (error) {
        next(error);
    }
};

export const addSeminarPosts = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Invalid Seminar ID format"), { status: 400 });
        }

        const seminar = await Seminar.findById(id);
        if (!seminar) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Seminar not found"), { status: 404 });
        }

        const newPosts = (req.files?.posts || []).map(file => getUploadedFilePath(file));
        seminar.posts = [...(seminar.posts || []), ...newPosts];
        await seminar.save();

        res.status(200).json({
            success: true,
            message: "Posts added successfully",
            data: seminar,
        });
    } catch (error) {
        cleanupUploadedFiles(req.files?.posts || []);
        next(error);
    }
};

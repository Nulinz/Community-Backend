import Conference from "../models/conferenceModel.js";
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

export const createConferenceForm = async (req, res, next) => {
    let oldCoverImagePath = null;

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
            rounds,
            schedule,
            incharges,
            description,
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

        if (!isUpdate && !coverImageFile) {
            throw Object.assign(new Error("Cover Image is required"), { status: 400 });
        }

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;

        let conference;

        if (isUpdate) {
            conference = await Conference.findById(targetId);
            if (!conference) {
                throw Object.assign(new Error("Conference not found"), { status: 404 });
            }
            oldCoverImagePath = conference.coverImage;
        } else {
            conference = new Conference({ c_by: req.user._id });
        }

        // Update fields
        conference.eventName = toCleanString(eventName);
        conference.organizer = toCleanString(organizer);
        conference.mode = toCleanString(mode);
        conference.eventDate = eventDate;
        conference.registrationType = toCleanString(registrationType);
        conference.registrationStartDate = registrationStartDate || undefined;
        conference.registrationEndDate = registrationEndDate || undefined;
        conference.totalSeats = Number(totalSeats) || 0;
        
        if (coverImagePath) conference.coverImage = coverImagePath;

        conference.individualFees = Number(individualFees) || 0;
        conference.teamFees = Number(teamFees) || 0;
        conference.lateFees = Number(lateFees) || 0;

        conference.firstPrize = toCleanString(firstPrize);
        conference.secondPrize = toCleanString(secondPrize);
        conference.thirdPrize = toCleanString(thirdPrize);
        conference.participationPrize = toCleanString(participationPrize);

        conference.internshipOpportunity = toCleanString(internshipOpportunity);
        conference.placementOpportunity = toCleanString(placementOpportunity);
        conference.industryExposure = toCleanString(industryExposure);
        conference.industryPartners = toCleanString(industryPartners);
        conference.certificateAvailability=toCleanString(certificateAvailability)
        conference.venueName = toCleanString(venueName);
        conference.venueAddress = toCleanString(venueAddress);
        conference.geoLocation = toCleanString(geoLocation);

        conference.foodProvide = toCleanString(foodProvide);
        conference.vegNonVeg = toCleanString(vegNonVeg);
        conference.midnightSnacks = toCleanString(midnightSnacks);
        conference.accommodationProvide = toCleanString(accommodationProvide);
        conference.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        conference.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        conference.eligibilityDetails = toCleanString(eligibilityDetails);
        conference.allowedDepartments = toCleanString(allowedDepartments);
        conference.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent);
        conference.teamSizeMinimum = Number(teamSizeMinimum) || 0;
        conference.teamSizeMaximum = Number(teamSizeMaximum) || 0;

        conference.rounds = parseDynamicArray(rounds);
        conference.schedule = parseDynamicArray(schedule);
        conference.incharges = parseDynamicArray(incharges);

        conference.description = toCleanString(description);

        await conference.save();

        // Cleanup old files
        if (isUpdate) {
            if (coverImagePath && oldCoverImagePath) {
                fs.unlink(path.join(process.cwd(), oldCoverImagePath), () => { });
            }
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Conference ${isUpdate ? "updated" : "created"} successfully`,
            data: conference,
        });

    } catch (error) {
        cleanupUploadedFiles([
            ...(req.files?.coverImage || [])
        ]);
        next(error);
    }
};

export const getAllConference = async (req, res, next) => {
    try {
        const conferences = await Conference.find({ }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: conferences,
        });
    } catch (error) {
        next(error);
    }
};

export const getConferenceById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Conference ID format"), { status: 400 });
        }

        const conference = await Conference.findById(id);

        if (!conference) {
            throw Object.assign(new Error("Conference not found"), { status: 404 });
        }

        res.status(200).json({
            success: true,
            data: conference,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleConferenceStatus = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Conference ID format"), { status: 400 });
        }

        const conference = await Conference.findById(id);

        if (!conference) {
            throw Object.assign(new Error("Conference not found"), { status: 404 });
        }

        conference.isActive = !conference.isActive;
        await conference.save();

        res.status(200).json({
            success: true,
            message: `Conference ${conference.isActive ? "activated" : "deactivated"} successfully`,
            data: conference,
        });
    } catch (error) {
        next(error);
    }
};

export const addConferencePosts = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Invalid Conference ID format"), { status: 400 });
        }

        const conference = await Conference.findById(id);
        if (!conference) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Conference not found"), { status: 404 });
        }

        const newPosts = (req.files?.posts || []).map(file => getUploadedFilePath(file));
        
        if (newPosts.length === 0) {
            throw Object.assign(new Error("No images uploaded"), { status: 400 });
        }

        conference.posts = [...(conference.posts || []), ...newPosts];
        await conference.save();

        res.status(200).json({
            success: true,
            message: "Conference posts added successfully",
            data: conference,
        });
    } catch (error) {
        cleanupUploadedFiles(req.files?.posts || []);
        next(error);
    }
};

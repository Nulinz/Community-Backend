import Event from "../models/eventModel.js";
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

export const createEventForm = async (req, res, next) => {
    let oldCoverImagePath = null;

    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;

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
            rounds,
            schedule,
            incharges,
            description,
        } = rest;

        if (!eventType) throw Object.assign(new Error("Event Type is required"), { status: 400 });
        if (!eventName) throw Object.assign(new Error("Event Name is required"), { status: 400 });
        if (!organizer) throw Object.assign(new Error("Organizer is required"), { status: 400 });
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });
        if (!eventDate) throw Object.assign(new Error("Event Date is required"), { status: 400 });
        if (!registrationType) throw Object.assign(new Error("Registration Type is required"), { status: 400 });

        const coverImageFile = req.files?.coverImage?.[0];
        if (!isUpdate && !coverImageFile) {
            throw Object.assign(new Error("Cover Image is required"), { status: 400 });
        }

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;

        let event;

        if (isUpdate) {
            if (!mongoose.Types.ObjectId.isValid(targetId)) {
                throw Object.assign(new Error("Invalid Event ID format"), { status: 400 });
            }
            event = await Event.findById(targetId);
            if (!event) {
                throw Object.assign(new Error("Event not found"), { status: 404 });
            }
            oldCoverImagePath = event.coverImage;
        } else {
            event = new Event({ c_by: req.user._id });
        }

        event.eventType = toCleanString(eventType);
        event.eventName = toCleanString(eventName);
        event.organizer = toCleanString(organizer);
        event.mode = toCleanString(mode);
        event.eventDate = eventDate;
        event.registrationType = toCleanString(registrationType);
        event.registrationStartDate = registrationStartDate || undefined;
        event.registrationEndDate = registrationEndDate || undefined;
        event.totalSeats = Number(totalSeats) || 0;

        if (coverImagePath) event.coverImage = coverImagePath;

        event.individualFees = Number(individualFees) || 0;
        event.teamFees = Number(teamFees) || 0;
        event.lateFees = Number(lateFees) || 0;

        event.firstPrize = toCleanString(firstPrize);
        event.secondPrize = toCleanString(secondPrize);
        event.thirdPrize = toCleanString(thirdPrize);
        event.participationPrize = toCleanString(participationPrize);

        event.internshipOpportunity = toCleanString(internshipOpportunity);
        event.placementOpportunity = toCleanString(placementOpportunity);
        event.industryExposure = toCleanString(industryExposure);
        event.industryPartners = toCleanString(industryPartners);

        event.venueName = toCleanString(venueName);
        event.venueAddress = toCleanString(venueAddress);
        event.geoLocation = toCleanString(geoLocation);

        event.foodProvide = toCleanString(foodProvide);
        event.vegNonVeg = toCleanString(vegNonVeg);
        event.midnightSnacks = toCleanString(midnightSnacks);
        event.accommodationProvide = toCleanString(accommodationProvide);
        event.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        event.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        event.eligibilityDetails = toCleanString(eligibilityDetails);
        event.allowedDepartments = toCleanString(allowedDepartments);
        event.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent);
        event.teamSizeMinimum = Number(teamSizeMinimum) || 0;
        event.teamSizeMaximum = Number(teamSizeMaximum) || 0;
        event.description = toCleanString(description);

        event.rounds = parseDynamicArray(rounds);
        event.schedule = parseDynamicArray(schedule);
        event.incharges = parseDynamicArray(incharges);

        await event.save();

        if (isUpdate && coverImagePath && oldCoverImagePath) {
            fs.unlink(path.join(process.cwd(), oldCoverImagePath), () => { });
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Event ${isUpdate ? "updated" : "created"} successfully`,
            data: event,
        });

    } catch (error) {
        cleanupUploadedFiles([...(req.files?.coverImage || [])]);
        next(error);
    }
};

export const getAllEvents = async (req, res, next) => {
    try {
        const events = await Event.find({}).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: events,
        });
    } catch (error) {
        next(error);
    }
};

export const getEventById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Event ID format"), { status: 400 });
        }

        const event = await Event.findById(id);

        if (!event) {
            throw Object.assign(new Error("Event not found"), { status: 404 });
        }

        res.status(200).json({
            success: true,
            data: event,
        });
    } catch (error) {
        next(error);
    }
};

export const toggleEventStatus = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw Object.assign(new Error("Invalid Event ID format"), { status: 400 });
        }

        const event = await Event.findById(id);
        if (!event) {
            throw Object.assign(new Error("Event not found"), { status: 404 });
        }

        event.isActive = !event.isActive;
        await event.save();

        res.status(200).json({
            success: true,
            message: `Event ${event.isActive ? "activated" : "deactivated"} successfully`,
            data: event,
        });
    } catch (error) {
        next(error);
    }
};

export const addEventPosts = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Invalid Event ID format"), { status: 400 });
        }

        const event = await Event.findById(id);
        if (!event) {
            cleanupUploadedFiles(req.files?.posts || []);
            throw Object.assign(new Error("Event not found"), { status: 404 });
        }

        const newPosts = (req.files?.posts || []).map(file => getUploadedFilePath(file));
        event.posts = [...(event.posts || []), ...newPosts];
        await event.save();

        res.status(200).json({
            success: true,
            message: "Posts added successfully",
            data: event,
        });
    } catch (error) {
        cleanupUploadedFiles(req.files?.posts || []);
        next(error);
    }
};

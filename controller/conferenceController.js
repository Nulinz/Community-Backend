import Conference from "../models/conferenceModel.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import EventRegistration from "../models/eventRegistrationModel.js";
import { getEventFinancials } from "../helper/getEventFinancials.js";
import { validateOrganizerPayout, resolveOrganizerName } from "../helper/payoutValidator.js";
import { enrichRegistrationsWithUserDetails } from "../helper/resolveUserEducation.js";
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
        const status=req?.user?.role==="admin"?"approved":"pending"
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
            gst,
            gstPercentage,
            gstPercent,
            gstAmount,
            prizesAvailable,
            firstPrize,
            secondPrize,
            thirdPrize,
            participationPrize,
            internshipOpportunity,
            placementOpportunity,
            industryExposure,
            industryPartners,
            venueName,
            address,
            city,
            pincode,
            state,
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
            certificateAvailability,
            signatoryName,
            signatoryDesignation,
            certificateContentBody,
            eventStartTime,
            eventEndDate,
            eventEndTime,
            onlinePlatformLink,
            publicationAvailability,
            externalRegistrationLink,
            customFees,
        } = rest;

        // Validation
        const isAdmin = req.user?.role === "admin";
        const resolvedOrganizer = await resolveOrganizerName(organizer, req.user);

        // Core fields are always mandatory across all roles (including admin)
        if (!eventName) throw Object.assign(new Error("Event Name is required"), { status: 400 });
        if (!organizer && !resolvedOrganizer) throw Object.assign(new Error("Organizer is required"), { status: 400 });

        if (!isAdmin) {
            if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });
            if (!eventDate) throw Object.assign(new Error("Event Date is required"), { status: 400 });
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            if (!isUpdate && new Date(eventDate) < startOfToday) {
                throw Object.assign(new Error("Event Date cannot be earlier than the current date"), { status: 400 });
            }
            if (registrationEndDate && eventDate && new Date(registrationEndDate) > new Date(eventDate)) {
                throw Object.assign(new Error("Registration End Date cannot be later than Event Date"), { status: 400 });
            }
            if (registrationStartDate && registrationEndDate && new Date(registrationStartDate) > new Date(registrationEndDate)) {
                throw Object.assign(new Error("Registration Start Date cannot be later than Registration End Date"), { status: 400 });
            }
            if (!registrationType) throw Object.assign(new Error("Registration Type is required"), { status: 400 });

            if (toCleanString(registrationType).toLowerCase() === "paid") {
                const payoutCheck = await validateOrganizerPayout(req.user);
                if (!payoutCheck.hasPayout) {
                    throw Object.assign(new Error(payoutCheck.message), { status: 400 });
                }
            }

            if ((mode === "Online" || mode === "Hybrid") && !onlinePlatformLink) {
                throw Object.assign(new Error("Online Platform / Meeting Link is required for Online/Hybrid mode"), { status: 400 });
            }
            if ((mode === "Offline" || mode === "Hybrid") && (!venueName || !address || !city || !state || !pincode)) {
                throw Object.assign(new Error("Venue Details (Venue Name, Address, City, State, Pincode) are required for Offline/Hybrid mode"), { status: 400 });
            }

            const coverImageFile = req.files?.coverImage?.[0];
            if (!isUpdate && !coverImageFile) {
                throw Object.assign(new Error("Cover Image is required"), { status: 400 });
            }
        }

        // Handle Files
        const coverImageFile = req.files?.coverImage?.[0];
        const signatureUrlFile = req.files?.signatureUrl?.[0];

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;
        const signatureUrlPath = signatureUrlFile ? getUploadedFilePath(signatureUrlFile) : undefined;

        let conference;
        let oldCoverImagePath;
        let oldSignatureUrlPath;

        if (isUpdate) {
            conference = await Conference.findById(targetId);
            if (!conference) {
                throw Object.assign(new Error("Conference not found"), { status: 404 });
            }
            oldCoverImagePath = conference.coverImage;
            oldSignatureUrlPath = conference.signatureUrl;
        } else {
            conference = new Conference({ c_by: req.user._id });
        }
        conference.status = status;
        // Update fields
        conference.eventName = toCleanString(eventName);
        conference.organizer = resolvedOrganizer || conference.organizer || "Organizer";
        const cleanMode = toCleanString(mode);
        conference.mode = cleanMode;
        conference.onlinePlatformLink = (cleanMode.toLowerCase() === "offline")
            ? ""
            : toCleanString(onlinePlatformLink);
        conference.publicationAvailability = toCleanString(publicationAvailability);
        conference.externalRegistrationLink = toCleanString(externalRegistrationLink);
        conference.eventDate = eventDate ? new Date(eventDate) : (conference.eventDate || undefined);
        conference.eventEndDate = eventEndDate ? new Date(eventEndDate) : undefined;
        conference.registrationType = toCleanString(registrationType) || "Free";
        conference.registrationStartDate = registrationStartDate ? new Date(registrationStartDate) : undefined;
        conference.registrationEndDate = registrationEndDate ? new Date(registrationEndDate) : undefined;
        conference.totalSeats = Number(totalSeats) || 0;
        conference.eventStartTime = toCleanString(eventStartTime);
        conference.eventEndTime = toCleanString(eventEndTime);
        if (coverImagePath) conference.coverImage = coverImagePath;
        if (signatureUrlPath) conference.signatureUrl = signatureUrlPath;

        // Fee validation: cannot be negative or decimal
        const validateFee = (val, label) => {
            if (val !== undefined && val !== null && val !== "") {
                const num = Number(val);
                if (isNaN(num) || num < 0) {
                    throw Object.assign(new Error(`${label} cannot be negative`), { status: 400 });
                }
                if (!Number.isInteger(num)) {
                    throw Object.assign(new Error(`${label} cannot contain decimal values`), { status: 400 });
                }
                return num;
            }
            return 0;
        };

        conference.individualFees = validateFee(individualFees, "Individual Fees");
        conference.teamFees = validateFee(teamFees, "Team Fees");
        conference.lateFees = validateFee(lateFees, "Late Fees");
        const cleanGst = toCleanString(gst) || "No";
        conference.gst = cleanGst;
        if (cleanGst.toLowerCase() === "yes") {
            const rawPercent = gstPercentage ?? gstPercent ?? 0;
            const cleanPercent = Number(String(rawPercent).replace("%", "").trim()) || 0;
            conference.gstPercentage = cleanPercent;
            const baseFee = Number(conference.individualFees) || Number(conference.teamFees) || 0;
            const computedGstAmount = (baseFee * cleanPercent) / 100;
            conference.gstAmount = (gstAmount !== undefined && gstAmount !== null && gstAmount !== "")
                ? Number(gstAmount) || 0
                : Math.round(computedGstAmount * 100) / 100;
        } else {
            conference.gstPercentage = 0;
            conference.gstAmount = 0;
        }

        conference.customFees = parseDynamicArray(customFees)
            .map((item) => ({
                feeLabel: toCleanString(item?.feeLabel),
                feeAmount: validateFee(item?.feeAmount, "Custom Fee Amount"),
            }))
            .filter((item) => item.feeLabel || item.feeAmount > 0);

        conference.prizesAvailable = toCleanString(prizesAvailable) || "No";
        conference.firstPrize = toCleanString(firstPrize);
        conference.secondPrize = toCleanString(secondPrize);
        conference.thirdPrize = toCleanString(thirdPrize);
        conference.participationPrize = toCleanString(participationPrize);

        conference.internshipOpportunity = toCleanString(internshipOpportunity);
        conference.placementOpportunity = toCleanString(placementOpportunity);
        conference.industryExposure = toCleanString(industryExposure);
        conference.industryPartners = toCleanString(industryPartners);
        conference.certificateAvailability = toCleanString(certificateAvailability) || "No";
        conference.signatoryName = toCleanString(signatoryName);
        conference.signatoryDesignation = toCleanString(signatoryDesignation);
        conference.certificateContentBody = toCleanString(certificateContentBody);
        conference.venueName = toCleanString(venueName);
        conference.address = toCleanString(address);
        conference.state = toCleanString(state);
        conference.pincode = toCleanString(pincode);
        conference.city = toCleanString(city);
        conference.geoLocation = toCleanString(geoLocation);

        conference.foodProvide = toCleanString(foodProvide);
        conference.vegNonVeg = toCleanString(vegNonVeg);
        conference.midnightSnacks = toCleanString(midnightSnacks);
        conference.accommodationProvide = toCleanString(accommodationProvide);
        conference.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        conference.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        conference.eligibilityDetails = toCleanString(eligibilityDetails);
        conference.allowedDepartments = parseDynamicArray(allowedDepartments);
        conference.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent) || "Individual";
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
            if (signatureUrlPath && oldSignatureUrlPath) {
                fs.unlink(path.join(process.cwd(), oldSignatureUrlPath), () => { });
            }
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Conference ${isUpdate ? "updated" : "created"} successfully`,
            data: conference,
        });

    } catch (error) {
        cleanupUploadedFiles([
            ...(req.files?.coverImage || []),
            ...(req.files?.signatureUrl || [])
        ]);
        next(error);
    }
};

export const getAllConference = async (req, res, next) => {
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

        const conferences = await Conference.find(query).sort({ createdAt: -1 }).lean();
        const confIds = conferences.map((c) => c._id);
        const counts = confIds.length > 0
            ? await EventRegistration.aggregate([
                { $match: { eventId: { $in: confIds } } },
                { $group: { _id: "$eventId", count: { $sum: 1 } } },
            ])
            : [];
        const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
        const data = conferences.map((item) => ({
            ...item,
            registeredCount: countMap.get(String(item._id)) || 0,
        }));

        res.status(200).json({
            success: true,
            data,
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

    // ── 1. Get Conference ───────────────────────────────────
    const conference = await Conference.findById(id).lean();

    if (!conference) {
      throw Object.assign(new Error("Conference not found"), { status: 404 });
    }
 const revenue=await getEventFinancials(id)

    // ── 2. Get Registered List ──────────────────────────────
    const registrations = await EventRegistration.find({
      eventId: id,
      eventType: "Conference",
    })
      .populate("userId", "email phone name")
      .sort({ createdAt: -1 })
      .lean();

    const registeredList = await enrichRegistrationsWithUserDetails(registrations);

    const conferenceData = {
      ...conference,
      gstPercent: conference.gstPercentage || 0,
      gstAmount: conference.gstAmount !== undefined && conference.gstAmount !== null
        ? conference.gstAmount
        : (conference.gst === "Yes" ? Math.round(((Number(conference.individualFees) || Number(conference.teamFees) || 0) * (conference.gstPercentage || 0)) / 100 * 100) / 100 : 0),
    };

    return res.status(200).json({
      success: true,
      data: {
        conference: conferenceData,
        registrations: {
          count: registeredList.length,
          list: registeredList,
          revenue
        },
      },
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

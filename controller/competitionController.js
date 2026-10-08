import Competition from "../models/competitionModel.js";
import fs from "fs";
import path from "path";
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

const cleanupUploadedFiles = (fileArray = []) => {
    fileArray.forEach((file) => {
        if (!file?.path) return;
        fs.unlink(file.path, () => { });
    });
};

export const createCompetitionForm = async (req, res, next) => {
    let oldCoverImagePath = null;
    let oldRuleBookPath = null;
    let oldSignatureUrlPath = null;

    try {
        const { id, _id, ...rest } = req.body;
        const targetId = id || _id;
        const isUpdate = !!targetId;
        const status = req?.user?.role === "admin" ? "approved" : "pending"
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
            internshipOpportunityDetails,
            placementOpportunity,
            placementOpportunityDetails,
            industryExposure,
            industryExposureDetails,
            industryPartners,
            industryPartnersDetails,
            prizesAvailable,
            firstPrize,
            secondPrize,
            thirdPrize,
            participationPrize,
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
            additionalRules,
            description,
            rounds,
            schedule,
            incharges,
            certificateAvailability,
            signatoryName,
            signatoryDesignation,
            certificateContentBody,
            eventStartTime,
            eventEndDate,
            eventEndTime,
            onlinePlatformLink,
            externalRegistrationLink
        } = rest;

        // Validation
        if (!eventName) throw Object.assign(new Error("Event Name is required"), { status: 400 });
        const resolvedOrganizer = await resolveOrganizerName(organizer, req.user);
        if (!mode) throw Object.assign(new Error("Mode is required"), { status: 400 });
        if (!eventDate) throw Object.assign(new Error("Event Date is required"), { status: 400 });
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (!isUpdate && new Date(eventDate) < startOfToday) {
            throw Object.assign(new Error("Event Date cannot be earlier than the current date"), { status: 400 });
        }
        if (!eventStartTime) throw Object.assign(new Error("Event Start Time is required"), { status: 400 });
        if (!registrationType) throw Object.assign(new Error("Registration Type is required"), { status: 400 });

        if (toCleanString(registrationType).toLowerCase() === "paid") {
            const payoutCheck = await validateOrganizerPayout(req.user);
            if (!payoutCheck.hasPayout) {
                throw Object.assign(new Error(payoutCheck.message), { status: 400 });
            }
        }
        if (!registrationStartDate) throw Object.assign(new Error("Registration Start Date is required"), { status: 400 });
        if (!registrationEndDate) throw Object.assign(new Error("Registration End Date is required"), { status: 400 });
        if (registrationEndDate && eventDate && new Date(registrationEndDate) > new Date(eventDate)) {
            throw Object.assign(new Error("Registration End Date cannot be later than Event Date"), { status: 400 });
        }
        if (registrationStartDate && registrationEndDate && new Date(registrationStartDate) > new Date(registrationEndDate)) {
            throw Object.assign(new Error("Registration Start Date cannot be later than Registration End Date"), { status: 400 });
        }

        if ((mode === "Online" || mode === "Hybrid") && !onlinePlatformLink) {
            throw Object.assign(new Error("Online Platform / Meeting Link is required for Online/Hybrid mode"), { status: 400 });
        }
        if ((mode === "Offline" || mode === "Hybrid") && (!venueName || !address || !city || !state || !pincode)) {
            throw Object.assign(new Error("Venue Details (Venue Name, Address, City, State, Pincode) are required for Offline/Hybrid mode"), { status: 400 });
        }

        // Handle Files
        const coverImageFile = req.files?.coverImage?.[0];
        const ruleBookFile = req.files?.ruleBook?.[0];
        const signatureUrlFile = req.files?.signatureUrl?.[0];

        if (!isUpdate && !coverImageFile) {
            throw Object.assign(new Error("Cover Image is required"), { status: 400 });
        }

        const coverImagePath = coverImageFile ? getUploadedFilePath(coverImageFile) : undefined;
        const ruleBookPath = ruleBookFile ? getUploadedFilePath(ruleBookFile) : undefined;
        const signatureUrlPath = signatureUrlFile ? getUploadedFilePath(signatureUrlFile) : undefined;

        let competition;

        if (isUpdate) {
            competition = await Competition.findById(targetId);
            if (!competition) {
                throw Object.assign(new Error("Competition not found"), { status: 404 });
            }
            oldCoverImagePath = competition.coverImage;
            oldRuleBookPath = competition.ruleBook;
            oldSignatureUrlPath = competition.signatureUrl;
        } else {
            competition = new Competition({ c_by: req.user._id });
        }
        competition.status = status;
        // Update fields
        competition.eventName = toCleanString(eventName);
        competition.organizer = resolvedOrganizer || competition.organizer || "Organizer";
        const cleanMode = toCleanString(mode);
        competition.mode = cleanMode;
        competition.eventDate = eventDate || undefined;
        competition.eventStartTime = toCleanString(eventStartTime);
        competition.eventEndDate = eventEndDate || undefined;
        competition.eventEndTime = toCleanString(eventEndTime);
        competition.onlinePlatformLink = (cleanMode.toLowerCase() === "offline")
            ? ""
            : toCleanString(onlinePlatformLink);
        competition.externalRegistrationLink = toCleanString(externalRegistrationLink);

        competition.registrationType = toCleanString(registrationType);
        competition.registrationStartDate = registrationStartDate || undefined;
        competition.registrationEndDate = registrationEndDate || undefined;
        competition.totalSeats = Number(totalSeats) || 0;

        if (coverImagePath) competition.coverImage = coverImagePath;
        if (ruleBookPath) competition.ruleBook = ruleBookPath;
        if (signatureUrlPath) competition.signatureUrl = signatureUrlPath;

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

        competition.individualFees = validateFee(individualFees, "Individual Fees");
        competition.teamFees = validateFee(teamFees, "Team Fees");
        competition.lateFees = validateFee(lateFees, "Late Fees");
        competition.internshipOpportunity = toCleanString(internshipOpportunity);
        competition.internshipOpportunityDetails = toCleanString(internshipOpportunityDetails);
        competition.placementOpportunity = toCleanString(placementOpportunity);
        competition.placementOpportunityDetails = toCleanString(placementOpportunityDetails);
        competition.industryExposure = toCleanString(industryExposure);
        competition.industryExposureDetails = toCleanString(industryExposureDetails);
        competition.industryPartners = toCleanString(industryPartners);
        competition.industryPartnersDetails = toCleanString(industryPartnersDetails);

        competition.prizesAvailable = toCleanString(prizesAvailable) || "No";
        competition.firstPrize = toCleanString(firstPrize);
        competition.secondPrize = toCleanString(secondPrize);
        competition.thirdPrize = toCleanString(thirdPrize);
        competition.participationPrize = toCleanString(participationPrize);

        competition.venueName = toCleanString(venueName);
        competition.address = toCleanString(address);
        competition.state = toCleanString(state);
        competition.pincode = toCleanString(pincode);
        competition.city = toCleanString(city);
        competition.geoLocation = toCleanString(geoLocation);

        competition.foodProvide = toCleanString(foodProvide);
        competition.vegNonVeg = toCleanString(vegNonVeg);
        competition.midnightSnacks = toCleanString(midnightSnacks);
        competition.accommodationProvide = toCleanString(accommodationProvide);
        competition.separatedForBoysGirls = toCleanString(separatedForBoysGirls);
        competition.onlyForOutstationParticipants = toCleanString(onlyForOutstationParticipants);

        competition.eligibilityDetails = toCleanString(eligibilityDetails);
        competition.allowedDepartments = parseDynamicArray(allowedDepartments);
        competition.teamOrIndividualEvent = toCleanString(teamOrIndividualEvent) || "Individual";
        competition.teamSizeMinimum = Number(teamSizeMinimum) || 0;
        competition.teamSizeMaximum = Number(teamSizeMaximum) || 0;

        competition.additionalRules = toCleanString(additionalRules);
        competition.description = toCleanString(description);
        competition.certificateAvailability = toCleanString(certificateAvailability) || "No";
        competition.signatoryName = toCleanString(signatoryName);
        competition.signatoryDesignation = toCleanString(signatoryDesignation);
        competition.certificateContentBody = toCleanString(certificateContentBody);
        const parsedRounds = parseDynamicArray(rounds);
        competition.rounds = parsedRounds.map((r, i) => {
            if (typeof r === "string") {
                return { roundNumber: `Round ${i + 1}`, roundName: r.trim(), roundDescription: "" };
            }
            if (r && typeof r === "object") {
                return {
                    roundNumber: r.roundNumber || `Round ${i + 1}`,
                    roundName: r.roundName || r.round || "",
                    roundDescription: r.roundDescription || "",
                };
            }
            return r;
        }).filter((r) => r && (r.roundName || r.roundNumber));
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
            if (signatureUrlPath && oldSignatureUrlPath) {
                fs.unlink(path.join(process.cwd(), oldSignatureUrlPath), () => { });
            }
        }

        res.status(isUpdate ? 200 : 201).json({
            success: true,
            message: `Competition ${isUpdate ? "updated" : "created"} successfully`,
            data: competition,
        });

    } catch (error) {
        console.log(error)
        cleanupUploadedFiles([...(req.files?.coverImage || []), ...(req.files?.ruleBook || []), ...(req.files?.signatureUrl || [])]);
        next(error);
    }
};

export const getAllCompetition = async (req, res, next) => {
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

        const competitions = await Competition.find(query).sort({ createdAt: -1 }).lean();
        const compIds = competitions.map((c) => c._id);
        const counts = compIds.length > 0
            ? await EventRegistration.aggregate([
                { $match: { eventId: { $in: compIds } } },
                { $group: { _id: "$eventId", count: { $sum: 1 } } },
            ])
            : [];
        const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
        const data = competitions.map((item) => ({
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
export const getCompetitionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const competition = await Competition.findById(id);

        if (!competition) {
            throw Object.assign(new Error("Competition not found"), { status: 404 });
        }


        const revenue = await getEventFinancials(id)

        const registrations = await EventRegistration.find({
            eventId: id,
            eventType: "Competition",
        })
            .populate("userId", "email phone name")
            .sort({ createdAt: -1 })
            .lean();

        const registeredList = await enrichRegistrationsWithUserDetails(registrations);

        res.status(200).json({
            success: true,
            data: {
                competition,
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

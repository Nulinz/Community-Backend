import EventRegistration from "../../models/eventRegistrationModel.js";
import User from "../../models/userModel.js";
import Conference from "../../models/conferenceModel.js";
import Competition from "../../models/competitionModel.js";
import Seminar from "../../models/seminarModel.js";
import Event from "../../models/eventModel.js";
import UserDetails from "../../models/userDetails.js";
import { resolveUserEducation, enrichRegistrationsWithUserDetails } from "../../helper/resolveUserEducation.js";

/**
 * Defensive extractor for QR scan payloads.
 * Handles direct fields, raw stringified JSON, and wrapped scanner payload objects
 * (e.g. qrPayload, qrData, data, payload, code).
 */
const extractEventPayload = (body) => {
  let eventId = body?.eventId || body?.event_id;
  let eventType = body?.eventType || body?.event_type || body?.type;

  const candidatePayloads = [
    body?.qrPayload,
    body?.qrData,
    body?.data,
    body?.payload,
    body?.code,
    body?.text,
    body?.qr,
  ];

  for (const candidate of candidatePayloads) {
    if (!candidate) continue;

    if (typeof candidate === "object") {
      eventId = eventId || candidate.eventId || candidate.event_id;
      eventType = eventType || candidate.eventType || candidate.event_type || candidate.type;
    } else if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object") {
          eventId = eventId || parsed.eventId || parsed.event_id;
          eventType = eventType || parsed.eventType || parsed.event_type || parsed.type;
        }
      } catch {
        // Direct string that looks like a MongoDB ObjectId
        if (!eventId && /^[0-9a-fA-F]{24}$/.test(candidate.trim())) {
          eventId = candidate.trim();
        }
      }
    }
  }

  // Handle case where body itself was passed as a raw string
  if (!eventId && typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      eventId = parsed.eventId || parsed.event_id;
      eventType = parsed.eventType || parsed.event_type || parsed.type;
    } catch {
      if (/^[0-9a-fA-F]{24}$/.test(body.trim())) {
        eventId = body.trim();
      }
    }
  }

  return { eventId, eventType };
};

/**
 * Mark event attendance via scanned QR payload.
 * Validates registration, handles spot check-ins for unregistered walk-ins,
 * and prevents double check-in errors.
 */
export const markEventAttendance = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User authentication required." });
    }

    const { eventId, eventType } = extractEventPayload(req.body);

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Missing event identifier in scanned payload.",
      });
    }

    // Match registration by (userId, eventId) first since this pair is uniquely indexed
    let registration = await EventRegistration.findOne({ userId, eventId });

    // Fallback: match by email or phone if attendee used an external or alternate identifier
    if (!registration && (req.user?.email || req.user?.phone)) {
      const orConditions = [];
      if (req.user?.email) orConditions.push({ mailId: req.user.email });
      if (req.user?.phone) orConditions.push({ phoneNumber: req.user.phone });

      if (orConditions.length > 0) {
        registration = await EventRegistration.findOne({
          eventId,
          $or: orConditions,
        });
      }
    }

    // If still no registration found, allow walk-in / spot registration if event exists
    if (!registration) {
      let eventDoc = null;
      let resolvedEventType = null;

      const normalizedType = String(eventType || "").toLowerCase();
      if (normalizedType.includes("conf")) {
        eventDoc = await Conference.findById(eventId);
        resolvedEventType = "Conference";
      } else if (normalizedType.includes("comp")) {
        eventDoc = await Competition.findById(eventId);
        resolvedEventType = "Competition";
      } else if (normalizedType.includes("sem")) {
        eventDoc = await Seminar.findById(eventId);
        resolvedEventType = "Seminar";
      } else if (normalizedType.includes("event")) {
        eventDoc = await Event.findById(eventId);
        resolvedEventType = "Event";
      }

      // Check all 4 event models if type was ambiguous
      if (!eventDoc) {
        const [conf, comp, sem, ev] = await Promise.all([
          Conference.findById(eventId),
          Competition.findById(eventId),
          Seminar.findById(eventId),
          Event.findById(eventId),
        ]);
        if (conf) { eventDoc = conf; resolvedEventType = "Conference"; }
        else if (comp) { eventDoc = comp; resolvedEventType = "Competition"; }
        else if (sem) { eventDoc = sem; resolvedEventType = "Seminar"; }
        else if (ev) { eventDoc = ev; resolvedEventType = "Event"; }
      }

      if (!eventDoc) {
        return res.status(404).json({
          success: false,
          message: "Event or registration record not found for this event.",
        });
      }

      const [userProfile, userDetails] = await Promise.all([
        User.findById(userId).select("name email phone").lean(),
        UserDetails.findOne({ userId }).lean(),
      ]);
      const eduDefaults = resolveUserEducation(userDetails);

      registration = await EventRegistration.create({
        eventId: eventDoc._id,
        eventType: resolvedEventType,
        c_by: eventDoc.c_by,
        userId,
        member_count: 1,
        type: "Individual",
        fullName: req.body.fullName?.trim() || userDetails?.name || userProfile?.name || "Participant",
        department: req.body.department?.trim() && req.body.department.trim().toUpperCase() !== "N/A" ? req.body.department.trim() : eduDefaults.department,
        collegeName: req.body.collegeName?.trim() && req.body.collegeName.trim().toUpperCase() !== "N/A" ? req.body.collegeName.trim() : eduDefaults.college,
        year: req.body.year?.trim() && req.body.year.trim().toUpperCase() !== "N/A" ? req.body.year.trim() : eduDefaults.year,
        phoneNumber: req.body.phoneNumber?.trim() || userProfile?.phone || "",
        mailId: req.body.mailId?.trim() || userProfile?.email || "",
        attendanceStatus: "present",
        attendedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: "Attendance recorded successfully! (Spot check-in)",
        data: {
          userName: registration.fullName,
          collegeName: registration.collegeName,
          department: registration.department,
          attendedAt: registration.attendedAt,
          attendanceStatus: "present",
        },
      });
    }

    // Check if user is already marked Present
    if (String(registration.attendanceStatus || "").trim().toLowerCase() === "present") {
      return res.status(400).json({
        status: false,
        success: false,
        alreadyMarked: true,
        message: "Attendance already marked",
        data: {
          userName: registration.fullName,
          collegeName: registration.collegeName,
          department: registration.department,
          attendedAt: registration.attendedAt,
          attendanceStatus: "present",
        },
      });
    }

    // Mark attendance Present
    registration.attendanceStatus = "present";
    registration.attendedAt = new Date();
    await registration.save();

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully!",
      data: {
        userName: registration.fullName,
        collegeName: registration.collegeName,
        department: registration.department,
        attendedAt: registration.attendedAt,
        attendanceStatus: "present",
      },
    });
  } catch (error) {
    console.error("Mark Attendance Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/**
 * Fetch attendance stats and attendee list for a specific event.
 * Uses case-insensitive eventType matching with automatic fallback to eventId.
 */
export const getEventAttendanceStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { eventType } = req.query;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "eventId parameter is required." });
    }

    const query = { eventId };
    if (eventType) {
      query.eventType = { $regex: new RegExp(`^${eventType}$`, "i") };
    }

    let registrations = await EventRegistration.find(query).sort({ attendedAt: -1, createdAt: -1 });

    // Fallback: If no records found with eventType filter, search by unique eventId directly
    if (registrations.length === 0 && eventType) {
      registrations = await EventRegistration.find({ eventId }).sort({ attendedAt: -1, createdAt: -1 });
    }

    const totalRegistered = registrations.length;
    const isPresent = (status) => String(status || "").trim().toLowerCase() === "present";
    const presentList = registrations.filter((r) => isPresent(r.attendanceStatus));
    const totalPresent = presentList.length;
    const totalAbsent = Math.max(0, totalRegistered - totalPresent);

    const enrichedList = await enrichRegistrationsWithUserDetails(registrations);
    const mapAttendee = (r, index) => ({
      index: index + 1,
      id: r.registrationId || r._id,
      _id: r.registrationId || r._id,
      userId: r.userId,
      fullName: r.fullName || "N/A",
      name: r.fullName || "N/A",
      mailId: r.mailId || "N/A",
      mail: r.mailId || "N/A",
      phoneNumber: r.phoneNumber || "N/A",
      contact: r.phoneNumber || "N/A",
      collegeName: r.collegeName || "N/A",
      college: r.collegeName || "N/A",
      department: r.department || "N/A",
      year: r.year || "N/A",
      food: r.food || "no",
      accommodation: r.accommodation || "no",
      attendedAt: r.attendedAt,
      attendanceStatus: isPresent(r.attendanceStatus) ? "present" : "absent",
      createdAt: r.registeredAt || r.createdAt,
    });

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRegistered,
          totalPresent,
          totalAbsent,
          attendanceRate: totalRegistered > 0 ? ((totalPresent / totalRegistered) * 100).toFixed(1) : "0",
        },
        attendees: presentList.map(mapAttendee),
        allRegistrations: registrations.map(mapAttendee),
      },
    });
  } catch (error) {
    console.error("Get Attendance Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/**
 * Toggle or set attendance status for a specific registration record.
 * Enables organizers to manually mark Present/Absent from the Attendance UI.
 */
export const toggleEventAttendanceStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status } = req.body;

    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration record not found." });
    }

    const currentStatus = String(registration.attendanceStatus || "").toLowerCase();

    // If caller explicitly requested "present" but user is already marked present
    if (status && String(status).trim().toLowerCase() === "present" && currentStatus === "present") {
      return res.status(400).json({
        status: false,
        success: false,
        alreadyMarked: true,
        message: "Attendance already marked",
        data: {
          registrationId: registration._id,
          attendanceStatus: "present",
          attendedAt: registration.attendedAt,
          fullName: registration.fullName,
        },
      });
    }

    const newStatus = status
      ? String(status).toLowerCase()
      : currentStatus === "present"
      ? "absent"
      : "present";

    registration.attendanceStatus = newStatus;
    if (newStatus === "present") {
      registration.attendedAt = registration.attendedAt || new Date();
    } else {
      registration.attendedAt = null;
    }

    await registration.save();

    return res.status(200).json({
      success: true,
      message: `Attendance marked as ${newStatus === "present" ? "Present" : "Absent"}.`,
      data: {
        registrationId: registration._id,
        attendanceStatus: registration.attendanceStatus,
        attendedAt: registration.attendedAt,
        fullName: registration.fullName,
      },
    });
  } catch (error) {
    console.error("Toggle Attendance Status Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

import EventRegistration from "../../models/eventRegistrationModel.js";

/**
 * Mark event attendance via scanned QR payload.
 * Prevents double check-ins and validates user registration.
 */
export const markEventAttendance = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { eventId, eventType } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User authentication required." });
    }

    if (!eventId || !eventType) {
      return res.status(400).json({ success: false, message: "Missing event parameters." });
    }

    const registration = await EventRegistration.findOne({ userId, eventId, eventType });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration record not found for this event.",
      });
    }

    if (registration.attendanceStatus === "present") {
      return res.status(400).json({
        success: false,
        message: "Attendance has already been marked for this user.",
        data: {
          userName: registration.fullName,
          attendedAt: registration.attendedAt,
        },
      });
    }

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
      },
    });
  } catch (error) {
    console.error("Mark Attendance Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/**
 * Fetch attendance stats and attendee list for a specific event.
 */
export const getEventAttendanceStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { eventType } = req.query;

    const query = { eventId };
    if (eventType) {
      query.eventType = eventType;
    }

    const registrations = await EventRegistration.find(query).sort({ attendedAt: -1, createdAt: -1 });

    const totalRegistered = registrations.length;
    const presentList = registrations.filter((r) => r.attendanceStatus === "present");
    const totalPresent = presentList.length;
    const totalAbsent = totalRegistered - totalPresent;

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRegistered,
          totalPresent,
          totalAbsent,
          attendanceRate: totalRegistered > 0 ? ((totalPresent / totalRegistered) * 100).toFixed(1) : "0",
        },
        attendees: presentList.map((r, index) => ({
          index: index + 1,
          id: r._id,
          userId: r.userId,
          fullName: r.fullName,
          mailId: r.mailId,
          phoneNumber: r.phoneNumber,
          collegeName: r.collegeName,
          department: r.department,
          attendedAt: r.attendedAt,
          attendanceStatus: r.attendanceStatus,
        })),
      },
    });
  } catch (error) {
    console.error("Get Attendance Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

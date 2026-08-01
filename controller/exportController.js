import EventRegistration from "../models/eventRegistrationModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import UserDetails from "../models/userDetails.js";

/**
 * Lightweight, high-performance CSV string formatter following RFC 4180.
 */
const convertToCSV = (headers, data) => {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map((h) => escapeCell(h.label)).join(',');
  const rows = data.map((item) =>
    headers.map((h) => escapeCell(item[h.key])).join(',')
  );

  return [headerRow, ...rows].join('\r\n');
};

/**
 * GET /api/users/export/event-registrations/:eventId
 * Exports Event / Competition / Seminar / Conference Registrations to CSV
 */
export const exportEventRegistrationsCSV = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { eventType } = req.query;

    const query = { eventId };
    if (eventType) {
      query.eventType = eventType;
    }

    const registrations = await EventRegistration.find(query).sort({ createdAt: -1 });

    const headers = [
      { label: "S.No", key: "sNo" },
      { label: "Full Name", key: "fullName" },
      { label: "Email", key: "mailId" },
      { label: "Phone Number", key: "phoneNumber" },
      { label: "College Name", key: "collegeName" },
      { label: "Department", key: "department" },
      { label: "Year", key: "year" },
      { label: "Type", key: "type" },
      { label: "Member Count", key: "member_count" },
      { label: "Food", key: "food" },
      { label: "Food Type", key: "foodType" },
      { label: "Accommodation", key: "accommodation" },
      { label: "Attendance Status", key: "attendanceStatus" },
      { label: "Registered At", key: "registeredAt" },
    ];

    const formattedData = registrations.map((r, index) => ({
      sNo: index + 1,
      fullName: r.fullName || "N/A",
      mailId: r.mailId || "N/A",
      phoneNumber: r.phoneNumber || "N/A",
      collegeName: r.collegeName || "N/A",
      department: r.department || "N/A",
      year: r.year || "N/A",
      type: r.type || "N/A",
      member_count: r.member_count || 1,
      food: r.food || "no",
      foodType: r.foodType || "N/A",
      accommodation: r.accommodation || "no",
      attendanceStatus: r.attendanceStatus || "absent",
      registeredAt: r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : "N/A",
    }));

    const csvContent = convertToCSV(headers, formattedData);
    const fileName = `${eventType || "Event"}_Registrations_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export Registrations Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export CSV." });
  }
};

/**
 * GET /api/users/export/event-attendance/:eventId
 * Exports Present Attendees List for Event / Competition / Seminar / Conference to CSV
 */
export const exportEventAttendanceCSV = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { eventType } = req.query;

    const query = { eventId, attendanceStatus: "present" };
    if (eventType) {
      query.eventType = eventType;
    }

    const presentList = await EventRegistration.find(query).sort({ attendedAt: -1, createdAt: -1 });

    const headers = [
      { label: "S.No", key: "sNo" },
      { label: "Full Name", key: "fullName" },
      { label: "Email", key: "mailId" },
      { label: "Phone Number", key: "phoneNumber" },
      { label: "College Name", key: "collegeName" },
      { label: "Department", key: "department" },
      { label: "Year", key: "year" },
      { label: "Check-in Time", key: "attendedAt" },
      { label: "Status", key: "attendanceStatus" },
    ];

    const formattedData = presentList.map((r, index) => ({
      sNo: index + 1,
      fullName: r.fullName || "N/A",
      mailId: r.mailId || "N/A",
      phoneNumber: r.phoneNumber || "N/A",
      collegeName: r.collegeName || "N/A",
      department: r.department || "N/A",
      year: r.year || "N/A",
      attendedAt: r.attendedAt ? new Date(r.attendedAt).toLocaleString("en-GB") : "N/A",
      attendanceStatus: r.attendanceStatus || "present",
    }));

    const csvContent = convertToCSV(headers, formattedData);
    const fileName = `${eventType || "Event"}_Attendance_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export Attendance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export attendance CSV." });
  }
};

/**
 * GET /api/users/export/job-candidates/:jobId
 * Exports Job / Internship Applicants to CSV
 */
export const exportJobCandidatesCSV = async (req, res) => {
  try {
    const { jobId } = req.params;

    const applications = await AppliedJob.find({ jobId })
      .sort({ createdAt: -1 })
      .populate({ path: "userId", select: "name email phone" });

    // Fetch user details for richer candidate info
    const userIds = applications.map((a) => a.userId?._id).filter(Boolean);
    const userDetailsMap = {};
    if (userIds.length > 0) {
      const detailsList = await UserDetails.find({ userId: { $in: userIds } }).lean();
      detailsList.forEach((d) => {
        userDetailsMap[d.userId.toString()] = d;
      });
    }

    const headers = [
      { label: "S.No", key: "sNo" },
      { label: "Candidate Name", key: "name" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
      { label: "College", key: "college" },
      { label: "Department", key: "department" },
      { label: "Degree", key: "degree" },
      { label: "Application Status", key: "status" },
      { label: "Applied At", key: "appliedAt" },
    ];

    const formattedData = applications.map((app, index) => {
      const uId = app.userId?._id?.toString();
      const uDetail = userDetailsMap[uId] || {};

      return {
        sNo: index + 1,
        name: uDetail.name || app.userId?.name || "N/A",
        email: uDetail.mail || uDetail.email || app.userId?.email || "N/A",
        phone: uDetail.phoneNumber || uDetail.contact || app.userId?.phone || "N/A",
        college: uDetail.collegeName || uDetail.college || "N/A",
        department: uDetail.department || "N/A",
        degree: uDetail.ugDegree || uDetail.degree || "N/A",
        status: app.status || "applied",
        appliedAt: app.createdAt ? new Date(app.createdAt).toLocaleString("en-GB") : "N/A",
      };
    });

    const csvContent = convertToCSV(headers, formattedData);
    const fileName = `Job_Candidates_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export Job Candidates Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export job candidates CSV." });
  }
};

/**
 * GET /api/users/export/college-dashboard-registrations
 * Exports all recent event registrations for the logged in College dashboard to CSV
 */
export const exportCollegeDashboardRegistrationsCSV = async (req, res) => {
  try {
    const creatorId = req.user?._id;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const registrations = await EventRegistration.find({ c_by: creatorId }).sort({ createdAt: -1 });

    const headers = [
      { label: "S.No", key: "sNo" },
      { label: "Full Name", key: "fullName" },
      { label: "Email", key: "mailId" },
      { label: "Phone Number", key: "phoneNumber" },
      { label: "College Name", key: "collegeName" },
      { label: "Department", key: "department" },
      { label: "Year", key: "year" },
      { label: "Event Type", key: "eventType" },
      { label: "Attendance Status", key: "attendanceStatus" },
      { label: "Registered At", key: "registeredAt" },
    ];

    const formattedData = registrations.map((r, index) => ({
      sNo: index + 1,
      fullName: r.fullName || "N/A",
      mailId: r.mailId || "N/A",
      phoneNumber: r.phoneNumber || "N/A",
      collegeName: r.collegeName || "N/A",
      department: r.department || "N/A",
      year: r.year || "N/A",
      eventType: r.eventType || "N/A",
      attendanceStatus: r.attendanceStatus || "absent",
      registeredAt: r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : "N/A",
    }));

    const csvContent = convertToCSV(headers, formattedData);
    const fileName = `College_Registrations_Report_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export College Registrations Error:", error);
    return res.status(500).json({ success: false, message: "Failed to export college registrations CSV." });
  }
};

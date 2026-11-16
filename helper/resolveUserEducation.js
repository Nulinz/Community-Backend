import mongoose from "mongoose";
import UserDetails from "../models/userDetails.js";

/**
 * Resolves normalized educational profile fields (college, department, year)
 * from a UserDetails document, respecting PG / UG hierarchy.
 * Defensively handles non-string values, numbers, and missing documents.
 */
export const resolveUserEducation = (userDetails) => {
  if (!userDetails) {
    return { college: "N/A", department: "N/A", year: "N/A" };
  }

  const isPg = String(userDetails.education || "").trim().toUpperCase() === "PG";

  const rawCollege =
    (isPg
      ? userDetails.pgCollegeName || userDetails.ugCollegeName
      : userDetails.ugCollegeName || userDetails.pgCollegeName) ||
    userDetails.collegeName ||
    "N/A";

  const rawDepartment =
    (isPg
      ? userDetails.pgFieldOfStudy || userDetails.pgDegree || userDetails.ugFieldOfStudy || userDetails.ugDegree
      : userDetails.ugFieldOfStudy || userDetails.ugDegree || userDetails.pgFieldOfStudy || userDetails.pgDegree) ||
    userDetails.department ||
    "N/A";

  const rawYear =
    (isPg ? userDetails.pgYear || userDetails.ugYear : userDetails.ugYear || userDetails.pgYear) ||
    userDetails.year;

  const collegeStr = rawCollege !== null && rawCollege !== undefined ? String(rawCollege).trim() : "";
  const deptStr = rawDepartment !== null && rawDepartment !== undefined ? String(rawDepartment).trim() : "";
  const yearStr = rawYear !== null && rawYear !== undefined ? String(rawYear).trim() : "";

  return {
    college: collegeStr && collegeStr.toUpperCase() !== "N/A" ? collegeStr : "N/A",
    department: deptStr && deptStr.toUpperCase() !== "N/A" ? deptStr : "N/A",
    year: yearStr && yearStr.toUpperCase() !== "N/A" ? yearStr : "N/A",
  };
};

/**
 * Batch enriches event registration documents with fallback education
 * details from UserDetails whenever registration fields are missing or 'N/A'.
 * Resilient against null, undefined, malformed ObjectIds, and database anomalies.
 */
export const enrichRegistrationsWithUserDetails = async (registrations) => {
  if (!Array.isArray(registrations) || registrations.length === 0) {
    return [];
  }

  // Extract unique user IDs safely for batch query, filtering only valid ObjectIds
  const userIds = [
    ...new Set(
      registrations
        .map((r) => {
          const rawId = r?.userId?._id || r?.userId;
          if (!rawId) return null;
          const idStr = String(rawId).trim();
          return mongoose.Types.ObjectId.isValid(idStr) ? idStr : null;
        })
        .filter(Boolean)
    ),
  ];

  let userDetailsMap = new Map();
  if (userIds.length > 0) {
    try {
      const detailsList = await UserDetails.find({ userId: { $in: userIds } }).lean();
      if (Array.isArray(detailsList)) {
        for (const d of detailsList) {
          const uId = d?.userId ? String(d.userId).trim() : null;
          if (uId) {
            userDetailsMap.set(uId, d);
          }
        }
      }
    } catch (err) {
      console.error("Warning: Failed to fetch UserDetails during enrichment:", err?.message || err);
    }
  }

  const hasValidVal = (val) =>
    Boolean(val) && String(val).trim() !== "" && String(val).trim().toUpperCase() !== "N/A";

  return registrations.map((reg, index) => {
    const rawUId = reg?.userId?._id || reg?.userId;
    const uId = rawUId ? String(rawUId).trim() : "";
    const uDetail = uId ? userDetailsMap.get(uId) : null;
    const edu = resolveUserEducation(uDetail);

    const college = hasValidVal(reg?.collegeName) ? String(reg.collegeName).trim() : edu.college;
    const department = hasValidVal(reg?.department) ? String(reg.department).trim() : edu.department;
    const year = hasValidVal(reg?.year) ? String(reg.year).trim() : edu.year;

    return {
      sNo: index + 1,
      registrationId: reg?._id,
      userId: reg?.userId?._id || reg?.userId,
      email: reg?.userId?.email || reg?.mailId || uDetail?.mail || uDetail?.email || "",
      phone: reg?.userId?.phone || reg?.phoneNumber || uDetail?.phoneNumber || "",
      name: reg?.fullName || reg?.userId?.name || uDetail?.name || "Participant",
      fullName: reg?.fullName || reg?.userId?.name || uDetail?.name || "Participant",
      department,
      college,
      collegeName: college,
      year,
      phoneNumber: reg?.phoneNumber || reg?.userId?.phone || uDetail?.phoneNumber || "",
      mailId: reg?.mailId || reg?.userId?.email || uDetail?.mail || uDetail?.email || "",
      food: reg?.food || "no",
      foodType: reg?.foodType || null,
      accommodation: reg?.accommodation || "no",
      accommodationType: reg?.accommodationType || null,
      registeredAt: reg?.createdAt,
      type: reg?.type || "Individual",
      member_count: reg?.member_count || 1,
      attendanceStatus: reg?.attendanceStatus || "absent",
      attendedAt: reg?.attendedAt || null,
    };
  });
};

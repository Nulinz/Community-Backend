import UserDetails from "../models/userDetails.js";

/**
 * Resolves normalized educational profile fields (college, department, year)
 * from a UserDetails document, respecting PG / UG hierarchy.
 */
export const resolveUserEducation = (userDetails) => {
  if (!userDetails) {
    return { college: "N/A", department: "N/A", year: "N/A" };
  }

  const isPg = String(userDetails.education || "").trim().toUpperCase() === "PG";

  const college =
    (isPg
      ? userDetails.pgCollegeName || userDetails.ugCollegeName
      : userDetails.ugCollegeName || userDetails.pgCollegeName) ||
    userDetails.collegeName ||
    "N/A";

  const department =
    (isPg
      ? userDetails.pgFieldOfStudy || userDetails.pgDegree || userDetails.ugFieldOfStudy || userDetails.ugDegree
      : userDetails.ugFieldOfStudy || userDetails.ugDegree || userDetails.pgFieldOfStudy || userDetails.pgDegree) ||
    userDetails.department ||
    "N/A";

  const rawYear =
    (isPg ? userDetails.pgYear || userDetails.ugYear : userDetails.ugYear || userDetails.pgYear) ||
    userDetails.year;
  const year = rawYear ? String(rawYear) : "N/A";

  return {
    college: college && college.trim() !== "" ? college.trim() : "N/A",
    department: department && department.trim() !== "" ? department.trim() : "N/A",
    year: year && year.trim() !== "" ? year.trim() : "N/A",
  };
};

/**
 * Batch enriches event registration documents with fallback education
 * details from UserDetails whenever registration fields are missing or 'N/A'.
 */
export const enrichRegistrationsWithUserDetails = async (registrations) => {
  if (!Array.isArray(registrations) || registrations.length === 0) {
    return [];
  }

  // Extract unique user IDs for efficient batch query
  const userIds = [
    ...new Set(
      registrations
        .map((r) => r.userId?._id || r.userId)
        .filter((id) => Boolean(id))
        .map((id) => id.toString())
    ),
  ];

  let userDetailsMap = new Map();
  if (userIds.length > 0) {
    const detailsList = await UserDetails.find({ userId: { $in: userIds } }).lean();
    userDetailsMap = new Map(detailsList.map((d) => [d.userId.toString(), d]));
  }

  const hasValidVal = (val) =>
    Boolean(val) && String(val).trim() !== "" && String(val).trim().toUpperCase() !== "N/A";

  return registrations.map((reg, index) => {
    const uId = (reg.userId?._id || reg.userId)?.toString();
    const uDetail = uId ? userDetailsMap.get(uId) : null;
    const edu = resolveUserEducation(uDetail);

    const college = hasValidVal(reg.collegeName) ? reg.collegeName : edu.college;
    const department = hasValidVal(reg.department) ? reg.department : edu.department;
    const year = hasValidVal(reg.year) ? String(reg.year) : edu.year;

    return {
      sNo: index + 1,
      registrationId: reg._id,
      userId: reg.userId?._id || reg.userId,
      email: reg.userId?.email || reg.mailId || uDetail?.mail || uDetail?.email || "",
      phone: reg.userId?.phone || reg.phoneNumber || uDetail?.phoneNumber || "",
      name: reg.fullName || reg.userId?.name || uDetail?.name || "Participant",
      fullName: reg.fullName || reg.userId?.name || uDetail?.name || "Participant",
      department,
      college,
      collegeName: college,
      year,
      phoneNumber: reg.phoneNumber || reg.userId?.phone || uDetail?.phoneNumber || "",
      mailId: reg.mailId || reg.userId?.email || uDetail?.mail || uDetail?.email || "",
      food: reg.food || "no",
      foodType: reg.foodType || null,
      accommodation: reg.accommodation || "no",
      accommodationType: reg.accommodationType || null,
      registeredAt: reg.createdAt,
      type: reg.type || "Individual",
      member_count: reg.member_count || 1,
      attendanceStatus: reg.attendanceStatus || "absent",
      attendedAt: reg.attendedAt || null,
    };
  });
};

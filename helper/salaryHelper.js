/**
 * Utility to format job salary for API responses.
 *
 * In MongoDB, salaryMin and salaryMax are persisted as numeric values to preserve
 * range filtering and sorting capabilities. When responding to client queries,
 * range compensation is formatted as "min-max" (e.g., "4-6") so consumers can
 * display the full salary range without custom client-side parsing.
 */
export const formatJobSalary = (jobObj) => {
  if (!jobObj) return 0;

  const cleanType = String(jobObj.salaryType || "").trim();
  const minVal =
    jobObj.salaryMin !== undefined && jobObj.salaryMin !== null && jobObj.salaryMin !== ""
      ? Number(jobObj.salaryMin)
      : null;
  const maxVal =
    jobObj.salaryMax !== undefined && jobObj.salaryMax !== null && jobObj.salaryMax !== ""
      ? Number(jobObj.salaryMax)
      : null;

  if (cleanType === "Range") {
    if (minVal !== null && maxVal !== null && minVal > 0 && maxVal > 0) {
      return `${minVal}-${maxVal}`;
    }
    if (minVal !== null && minVal > 0) return `${minVal}`;
    if (maxVal !== null && maxVal > 0) return `${maxVal}`;
  }

  return jobObj.salary ?? 0;
};

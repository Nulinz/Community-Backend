/**
 * Shared utilities for managing admin-assigned display priority (`order_count`)
 * and status-scoped queries across Jobs, Internships, Events, Seminars,
 * Competitions, and Conferences.
 */

/**
 * Applies `order_count` updates from request payload onto a Mongoose document.
 * Restricted strictly to admins so non-admin edits cannot alter or wipe out priority ranks.
 */
export const applyOrderCount = (doc, rawValue, userRole) => {
  if (!doc || userRole !== "admin" || rawValue === undefined) return;
  if (rawValue === null || String(rawValue).trim() === "") {
    doc.order_count = null;
    return;
  }
  const parsed = Number(rawValue);
  doc.order_count = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Builds the MongoDB filter query for list endpoints based on requested status.
 * Supports `all` (unfiltered for admins, scoped to own posts for non-admins).
 */
export const buildStatusQuery = (user, status, { forceOwnForCompany = false } = {}) => {
  const query = {};
  if (forceOwnForCompany && user?.role === "company") {
    query.c_by = user._id;
    return query;
  }

  switch (status) {
    case "community":
      query.c_by = user._id;
      break;
    case "all":
      if (user?.role !== "admin") {
        query.c_by = user._id;
      }
      break;
    case "pending":
    case "approved":
    case "rejected":
      query.status = status;
      break;
    default:
      query.status = "pending";
  }

  return query;
};

/**
 * Sorts records by `order_count` ascending (1 first, then 2, 3...),
 * falling back to newest `createdAt` first for unranked items (`null`/0).
 * Sorting in JS avoids MongoDB placing `null` before `1` in ascending sorts.
 */
export const sortByOrderCount = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items.sort((a, b) => {
    const orderA =
      a?.order_count !== null && a?.order_count !== undefined && Number(a.order_count) > 0
        ? Number(a.order_count)
        : Infinity;
    const orderB =
      b?.order_count !== null && b?.order_count !== undefined && Number(b.order_count) > 0
        ? Number(b.order_count)
        : Infinity;

    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
  });
};

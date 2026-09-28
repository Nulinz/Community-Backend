import College from "../models/collegeModel.js";
import Company from "../models/companyModel.js";

/**
 * Validates whether an event organizer (College or Company) has completed
 * their payment and payout bank details.
 * 
 * Free events do not require payout details.
 * Paid events strictly require accountHolderName, accountNumber, and ifscCode
 * so that participant fees can be disbursed to the organizer.
 */
export const validateOrganizerPayout = async (user) => {
  // Platform administrators are exempt from personal payout constraints
  if (!user || user.role === "admin") {
    return { hasPayout: true };
  }

  let organizer = null;
  if (user.role === "college") {
    organizer = await College.findOne({ userId: user._id });
  } else if (user.role === "company") {
    organizer = await Company.findOne({ userId: user._id });
  }

  if (!organizer) {
    return {
      hasPayout: false,
      message: "Organizer profile not found. Please complete your profile first.",
    };
  }

  const hasPayout = Boolean(
    organizer.accountHolderName?.trim() &&
    organizer.accountNumber?.trim() &&
    organizer.ifscCode?.trim()
  );

  return {
    hasPayout,
    message: hasPayout
      ? "Payout details verified."
      : "Payment & Payout details are required to host paid events. Please add your bank details in your profile first.",
  };
};

/**
 * Resolves the organizer name for events, seminars, competitions, and conferences.
 * Prevents Mongoose validation errors ("Path `organizer` is required.") when requests
 * omit an organizer field or when form payloads contain empty strings.
 *
 * Resolution hierarchy:
 * 1. Explicitly provided organizer string in request body
 * 2. College institution name (College.collegeName) when user role is "college"
 * 3. Company organization name (Company.companyName) when user role is "company"
 * 4. User profile name / collegeName / companyName properties
 * 5. Default fallback to "Nulinz Community" (for admin) or "Organizer"
 */
export const resolveOrganizerName = async (explicitOrganizer, user) => {
  const cleanExplicit = typeof explicitOrganizer === "string" ? explicitOrganizer.trim() : "";
  if (cleanExplicit) {
    return cleanExplicit;
  }

  if (user) {
    try {
      if (user.role === "college") {
        const col = await College.findOne({ userId: user._id }).select("collegeName");
        if (col?.collegeName?.trim()) {
          return col.collegeName.trim();
        }
      } else if (user.role === "company") {
        const comp = await Company.findOne({ userId: user._id }).select("companyName");
        if (comp?.companyName?.trim()) {
          return comp.companyName.trim();
        }
      } else if (user.role === "admin") {
        return user.name?.trim() || "Nulinz Community";
      }

      if (user.collegeName?.trim()) return user.collegeName.trim();
      if (user.companyName?.trim()) return user.companyName.trim();
      if (user.name?.trim()) return user.name.trim();
    } catch (_err) {
      // In case of query interruption, fallback gracefully
      if (user.name?.trim()) return user.name.trim();
    }
  }

  return "Organizer";
};


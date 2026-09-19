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

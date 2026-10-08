import CompanyFollow from "../models/companyFollowModel.js";
import Company from "../models/companyModel.js";
import { sendAndSaveNotification } from "./sendAndSaveNotification.js";

/**
 * Notifies all users who follow a company whenever a new Job,
 * Internship, or Envy (Freelance) project is published.
 *
 * Runs asynchronously so posting operations remain fast and non-blocking.
 * Resolves both Company._id and company.userId so followers are reliably
 * matched whether followed by profile ID or account User ID.
 */
export const notifyCompanyFollowers = async ({
  opportunity,
  opportunityType = "Job",
  senderId,
  organizerName,
}) => {
  try {
    const companyName = organizerName || opportunity?.companyName || opportunity?.organizer;
    if (!companyName && !senderId) return;

    // 1. Resolve company identifiers (Company._id, Company.userId, or creator User ID)
    const companyQuery = [];
    if (senderId) {
      companyQuery.push({ userId: senderId }, { _id: senderId });
    }
    if (companyName) {
      companyQuery.push({ companyName: new RegExp(`^${companyName}$`, "i") });
    }

    const company = await Company.findOne({ $or: companyQuery })
      .select("_id userId companyName")
      .lean();

    const companyIds = [
      senderId?.toString(),
      company?._id?.toString(),
      company?.userId?.toString(),
    ].filter(Boolean);

    // 2. Query all followers who follow any identifier of this company
    const follows = await CompanyFollow.find({
      companyId: { $in: companyIds },
    })
      .select("userId")
      .lean();

    if (!follows.length) return;

    // Deduplicate follower IDs and exclude the creator themselves
    const uniqueFollowerIds = [
      ...new Set(follows.map((f) => f.userId?.toString())),
    ].filter((uid) => uid && uid !== senderId?.toString());

    if (!uniqueFollowerIds.length) return;

    // 3. Format notification message
    const resolvedDisplayName = company?.companyName || companyName;
    const displayType = opportunityType === "Freelance" ? "Envy Project" : opportunityType;
    const title = `New ${displayType} from ${resolvedDisplayName}`;
    const message = `${resolvedDisplayName} just posted a new ${displayType.toLowerCase()}: "${opportunity.jobTitle}". Apply now!`;
    const body = `${opportunity.jobTitle} • ${resolvedDisplayName}`;

    // 4. Dispatch push & in-app notifications concurrently
    await Promise.allSettled(
      uniqueFollowerIds.map((receiverId) =>
        sendAndSaveNotification({
          senderId,
          receiverId,
          title,
          message,
          body,
          type: "job_posted",
          reference_id: opportunity._id?.toString(),
          metadata: {
            opportunityId: opportunity._id,
            opportunityType,
            jobTitle: opportunity.jobTitle,
            companyName: resolvedDisplayName,
          },
        })
      )
    );

    console.log(
      `[Followers Notified] Sent ${displayType} alert to ${uniqueFollowerIds.length} followers of "${resolvedDisplayName}"`
    );
  } catch (error) {
    console.error("notifyCompanyFollowers error:", error.message);
  }
};

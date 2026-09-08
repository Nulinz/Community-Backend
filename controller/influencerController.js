import User from "../models/userModel.js";

/**
 * 🔹 GET INFLUENCER DASHBOARD
 * Returns dashboard metrics & top 5 recent registered users.
 */
export const getInfluencerDashboard = async (req, res, next) => {
  try {
    const influencerId = req.user._id;
    const influencer = await User.findById(influencerId).lean();

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer account not found",
      });
    }

    const query = {
      $or: [{ influencerId: influencer._id }],
    };
    if (influencer.influencerCode) {
      query.$or.push({ referredByCode: influencer.influencerCode });
    }

    const registeredUsers = await User.find(query)
      .select("name profileImage createdAt is_active xp level")
      .lean();

    // In-memory reverse-chronological sort for Cosmos DB compatibility
    registeredUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const activeUsersCount = registeredUsers.filter((u) => u.is_active !== false).length;
    const totalXpEarned = registeredUsers.reduce((sum, u) => sum + (u.xp || 0), 0);

    const totalClicks = influencer.clickCount || influencer.clicks || 0;
    const conversionRate =
      totalClicks > 0
        ? `${((registeredUsers.length / totalClicks) * 100).toFixed(1)}%`
        : registeredUsers.length > 0
        ? "100%"
        : "0%";

    const referralBaseUrl = process.env.REFERRAL_BASE_URL || "https://gradenvy.com/referral";
    const referralLink = influencer.influencerCode
      ? `${referralBaseUrl}?ref=${influencer.influencerCode}`
      : `${referralBaseUrl}`;

    return res.status(200).json({
      success: true,
      data: {
        influencerCode: influencer.influencerCode,
        referralLink,
        totalRegistered: registeredUsers.length,
        activeUsers: activeUsersCount,
        totalXpEarned: `${totalXpEarned} XP`,
        conversionRate,
        registeredUsers: registeredUsers.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🔹 GET INFLUENCER REFERRAL LIST
 * Returns full list of all registered referred users (PII Protected).
 */
export const getInfluencerReferrals = async (req, res, next) => {
  try {
    const influencerId = req.user._id;
    const influencer = await User.findById(influencerId).lean();

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer account not found",
      });
    }

    const query = {
      $or: [{ influencerId: influencer._id }],
    };
    if (influencer.influencerCode) {
      query.$or.push({ referredByCode: influencer.influencerCode });
    }

    // Explicitly exclude sensitive fields for user privacy
    const registeredUsers = await User.find(query)
      .select("name profileImage createdAt is_active xp level")
      .lean();

    // In-memory reverse-chronological sort for Cosmos DB compatibility
    registeredUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      count: registeredUsers.length,
      data: registeredUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🔹 GET INFLUENCER PROFILE
 * Returns full profile details of the logged-in influencer.
 */
export const getInfluencerProfile = async (req, res, next) => {
  try {
    const influencerId = req.user._id;
    const influencer = await User.findById(influencerId)
      .select("-password -otp -otp_expire -forgot_otp")
      .lean();

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer account not found",
      });
    }

    const query = {
      $or: [{ influencerId: influencer._id }],
    };
    if (influencer.influencerCode) {
      query.$or.push({ referredByCode: influencer.influencerCode });
    }

    const totalReferredCount = await User.countDocuments(query);

    const referralBaseUrl = process.env.REFERRAL_BASE_URL || "https://gradenvy.com/referral";
    const referralLink = influencer.influencerCode
      ? `${referralBaseUrl}?ref=${influencer.influencerCode}`
      : `${referralBaseUrl}`;

    return res.status(200).json({
      success: true,
      data: {
        ...influencer,
        referralLink,
        totalReferredCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🔹 GET INFLUENCER SUBSCRIBED USERS LIST
 * Returns list of referred users who currently have an active subscription (PII Protected).
 */
export const getInfluencerSubscribedUsers = async (req, res, next) => {
  try {
    const influencerId = req.user._id;
    const influencer = await User.findById(influencerId).lean();

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer account not found",
      });
    }

    const query = {
      $or: [{ influencerId: influencer._id }],
      "subscription.isPlanActive": true,
    };
    if (influencer.influencerCode) {
      query.$or.push({ referredByCode: influencer.influencerCode, "subscription.isPlanActive": true });
    }

    const subscribedUsers = await User.find(query)
      .select("name profileImage subscription createdAt is_active xp level")
      .lean();

    // In-memory sort by subscription start date (or creation date) descending
    subscribedUsers.sort((a, b) => {
      const dateA = new Date(a.subscription?.startDate || a.createdAt || 0);
      const dateB = new Date(b.subscription?.startDate || b.createdAt || 0);
      return dateB - dateA;
    });

    const formattedData = subscribedUsers.map((u) => ({
      ...u,
      commissionAmount: 100, // Fixed 100 INR commission per subscription
      subscription: {
        ...u.subscription,
        planName: u.subscription?.planName || "Pro Plan",
        amount: u.subscription?.amount || u.subscription?.planAmount || 499,
        startDate: u.subscription?.startDate || u.createdAt,
        expiryDate: u.subscription?.expiryDate || null,
        isPlanActive: u.subscription?.isPlanActive !== false,
      },
    }));

    return res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

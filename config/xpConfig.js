/**
 * XP System Action Rewards Configuration
 */
export const XP_ACTIONS = {
  // EVENT_REGISTRATION: { xp: 20, label: "Registered for Event" },
  // SEMINAR_REGISTRATION: { xp: 20, label: "Registered for Seminar" },
  // CONFERENCE_REGISTRATION: { xp: 20, label: "Registered for Conference" },
  // COMPETITION_REGISTRATION: { xp: 25, label: "Registered for Competition" },
  // EVENT_ATTENDANCE: { xp: 50, label: "Attended Event" },
  // SEMINAR_ATTENDANCE: { xp: 40, label: "Attended Seminar" },
  // CONFERENCE_ATTENDANCE: { xp: 40, label: "Attended Conference" },
  // COMPETITION_ATTENDANCE: { xp: 50, label: "Attended Competition" },
  // COMPETITION_WIN: { xp: 250, label: "Won Competition" },
  FIRST_REGISTERATION: { xp: 10, label: "First Registration", isDaily: false, target: 1, unit: "count" },
  COMPLETE_PROFILE: { xp: 10, label: "Complete Your Profile", isDaily: false, target: 1, unit: "count" },
  FIRST_RESUME_CREATE: { xp: 10, label: "Create Your First Professional Resume", isDaily: false, target: 1, unit: "count" },
  FIRST_SAVED_JOB: { xp: 10, label: "Save Your First Opportunity", isDaily: false, target: 1, unit: "count" },
  DAILY_LOGIN: { xp: 5, label: "Daily Login", isDaily: true, target: 1, unit: "count" },
  AI_STATION: { xp: 5, label: "AI STATION", isDaily: true, target: 1, unit: "count" },
  LEVEL_1_BONUS: { xp: 25, label: "Reached Level 1 Bonus", isDaily: false, target: 1, unit: "count" },
  LEVEL_2_BONUS: { xp: 25, label: "Reached Level 2 Bonus", isDaily: false, target: 1, unit: "count" },
  FIRST_SUBSCRIPTION: { xp: 50, label: "First Subscription", isDaily: false, target: 1, unit: "count" },
  ACTIVE_30_MIN: { xp: 10, label: "Stay active for 30 minutes", isDaily: true, target: 30, unit: "mins", requiredLevel: 1 },
  ACTIVE_60_MIN: { xp: 15, label: "Stay active for 60 minutes", isDaily: true, target: 60, unit: "mins", requiredLevel: 2 },
  ACTIVE_180_MIN: { xp: 20, label: "Stay active for 180 minutes", isDaily: true, target: 180, unit: "mins", requiredLevel: 3 },
  FIRST_COMPANY_FOLLOW: { xp: 10, label: "Followed First Company", isDaily: false, target: 1, unit: "count" },
  FIRST_EVENT_REGISTRATION: { xp: 15, label: "Register for your first GradEnvy event", isDaily: false, target: 1, unit: "count" },
  FIRST_EVENT_ATTENDANCE: { xp: 25, label: "Attend event and mark attendance first time", isDaily: false, target: 1, unit: "count" },
  FIRST_FREELANCE_APPLICATION: { xp: 10, label: "Apply for your first Envy freelancing project", isDaily: false, target: 1, unit: "count" },
  FIRST_COMPETITION_REGISTRATION: { xp: 15, label: "Join your first competition", isDaily: false, target: 1, unit: "count" },
  INTERNSHIPS_AND_JOBS: { xp: 10, label: "Explore Internships & Jobs", isDaily: false, target: 1, unit: "count" },
  REFERRAL: { xp: 20, label: "Referred a Friend", isDaily: false, target: 1, unit: "count", isRepeatable: true },
  FOLLOW_INSTAGRAM: {
    xp: 20,
    label: "Follow GradEnvy on Instagram",
    isDaily: false,
    target: 1,
    unit: "count",
    platform: "instagram",
  },
  FOLLOW_YOUTUBE: {
    xp: 20,
    label: "Subscribe to GradEnvy on YouTube",
    isDaily: false,
    target: 1,
    unit: "count",
    platform: "youtube",
  },
};

/**
 * Required XP within each level to advance to the next level.
 * Level 1 requires 200 XP to reach Level 2.
 * Level 2 requires 400 XP to reach Level 3.
 * Level 3 requires 600 XP to reach Level 4, and so on.
 */
export const LEVEL_REQUIREMENTS = {
  1: 200,
  2: 400,
  3: 600,
  4: 800,
};

/**
 * Calculates level metadata and progress percentage.
 * Operates on current level XP (which resets to 0 upon level up)
 * while also returning the persistent lifetime XP.
 */
export const calculateLevelInfo = (currentXP = 0, currentLevel, lifetimeXP) => {
  let safeLevel = 1;
  let safeXP = 0;
  let safeLifetimeXP = 0;

  if (currentLevel !== undefined && currentLevel !== null) {
    safeLevel = Math.max(1, Number(currentLevel) || 1);
    safeXP = Math.max(0, Number(currentXP) || 0);
    safeLifetimeXP = lifetimeXP !== undefined && lifetimeXP !== null
      ? Math.max(0, Number(lifetimeXP) || 0)
      : safeXP;
  } else {
    // Graceful fallback for single-argument cumulative callers
    let remaining = Math.max(0, Number(currentXP) || 0);
    safeLifetimeXP = remaining;
    let lvl = 1;
    while (true) {
      const needed = LEVEL_REQUIREMENTS[lvl] || (lvl * 200);
      if (remaining < needed) break;
      remaining -= needed;
      lvl += 1;
    }
    safeLevel = lvl;
    safeXP = remaining;
  }

  const xpForNextLevel = LEVEL_REQUIREMENTS[safeLevel] || (safeLevel * 200);
  const xpNeeded = Math.max(0, xpForNextLevel - safeXP);
  const progressPercentage =
    xpForNextLevel > 0
      ? Math.min(100, Math.max(0, Math.round((safeXP / xpForNextLevel) * 100)))
      : 100;

  return {
    currentLevel: safeLevel,
    currentXP: safeXP,
    totalXP: safeLifetimeXP,
    lifetimeXP: safeLifetimeXP,
    xpForCurrentLevel: 0,
    xpForNextLevel,
    xpNeeded,
    progressPercentage,
  };
};

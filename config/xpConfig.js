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
  FIRST_COMPETITION_REGISTRATION: { xp: 15, label: "Join your first Envy League competition", isDaily: false, target: 1, unit: "count" },
  REFERRAL: { xp: 20, label: "Referred a Friend", isDaily: false, target: 1, unit: "count" },
};

/**
 * Calculates level metadata and progress percentage based on total XP.
 * Formula: Level = Math.floor(Math.sqrt(totalXP / 100)) + 1
 */
export const calculateLevelInfo = (totalXP = 0) => {
  const safeXP = Math.max(0, Number(totalXP) || 0);

  let currentLevel = 0;
  let xpForCurrentLevel = 0;
  let xpForNextLevel = 200;

  if (safeXP >= 600) {
    currentLevel = 4;
    xpForCurrentLevel = 600;
    xpForNextLevel = 600;
  } else if (safeXP >= 400) {
    currentLevel = 3;
    xpForCurrentLevel = 400;
    xpForNextLevel = 600;
  } else if (safeXP >= 200) {
    currentLevel = 2;
    xpForCurrentLevel = 200;
    xpForNextLevel = 400;
  } else {
    currentLevel = 1;
    xpForCurrentLevel = 0;
    xpForNextLevel = 200;
  }

  const levelProgressXP = safeXP - xpForCurrentLevel;
  const levelTotalXPNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage =
    levelTotalXPNeeded > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((levelProgressXP / levelTotalXPNeeded) * 100))
        )
      : 100;

  return {
    currentLevel,
    totalXP: safeXP,
    xpForCurrentLevel,
    xpForNextLevel,
    xpNeeded: Math.max(0, xpForNextLevel - safeXP),
    progressPercentage,
  };
};

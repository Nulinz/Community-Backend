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
  FIRST_REGISTERATION: { xp: 10, label: "First Registeration" },
  DAILY_LOGIN: { xp: 5, label: "Daily Login" },
  AI_STATION: { xp: 5, label: "AI STATION" },
  LEVEL_1_BONUS: { xp: 25, label: "Reached Level 1 Bonus" },
  LEVEL_2_BONUS: { xp: 25, label: "Reached Level 2 Bonus" },
  FIRST_SUBSCRIPTION: { xp: 50, label: "First Subscription" },
  ACTIVE_30_MIN: { xp: 10, label: "Stay active for 30 minutes" },
  ACTIVE_60_MIN: { xp: 15, label: "Stay active for 60 minutes" },
  ACTIVE_180_MIN: { xp: 20, label: "Stay active for 180 minutes" },
  FIRST_COMPANY_FOLLOW: { xp: 10, label: "Followed First Company" },
  FIRST_EVENT_REGISTRATION: { xp: 15, label: "Register for your first GradEnvy event" },
  FIRST_EVENT_ATTENDANCE: { xp: 25, label: "Attend event and mark attendance first time" },
  FIRST_FREELANCE_APPLICATION: { xp: 10, label: "Apply for your first Envy freelancing project" },
  FIRST_COMPETITION_REGISTRATION: { xp: 15, label: "Join your first Envy League competition" },
};

/**
 * Calculates level metadata and progress percentage based on total XP.
 * Formula: Level = Math.floor(Math.sqrt(totalXP / 100)) + 1
 */
export const calculateLevelInfo = (totalXP = 0) => {
  const safeXP = Math.max(0, Number(totalXP) || 0);

  let currentLevel = 0;
  let xpForCurrentLevel = 0;
  let xpForNextLevel = 100;

  if (safeXP >= 500) {
    currentLevel = 4;
    xpForCurrentLevel = 500;
    xpForNextLevel = 500;
  } else if (safeXP >= 250) {
    currentLevel = 3;
    xpForCurrentLevel = 250;
    xpForNextLevel = 500;
  } else if (safeXP >= 100) {
    currentLevel = 2;
    xpForCurrentLevel = 100;
    xpForNextLevel = 250;
  } else {
    currentLevel = 1;
    xpForCurrentLevel = 0;
    xpForNextLevel = 100;
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

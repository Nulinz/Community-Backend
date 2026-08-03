/**
 * XP System Action Rewards Configuration
 */
export const XP_ACTIONS = {
  EVENT_REGISTRATION: { xp: 20, label: "Registered for Event" },
  SEMINAR_REGISTRATION: { xp: 20, label: "Registered for Seminar" },
  CONFERENCE_REGISTRATION: { xp: 20, label: "Registered for Conference" },
  COMPETITION_REGISTRATION: { xp: 25, label: "Registered for Competition" },
  EVENT_ATTENDANCE: { xp: 50, label: "Attended Event" },
  SEMINAR_ATTENDANCE: { xp: 40, label: "Attended Seminar" },
  CONFERENCE_ATTENDANCE: { xp: 40, label: "Attended Conference" },
  COMPETITION_ATTENDANCE: { xp: 50, label: "Attended Competition" },
  COMPETITION_WIN: { xp: 250, label: "Won Competition" },
  PROFILE_COMPLETED: { xp: 100, label: "Completed Profile 100%" },
  DAILY_LOGIN: { xp: 10, label: "Daily Login" },
};

/**
 * Calculates level metadata and progress percentage based on total XP.
 * Formula: Level = Math.floor(Math.sqrt(totalXP / 100)) + 1
 */
export const calculateLevelInfo = (totalXP = 0) => {
  const safeXP = Math.max(0, Number(totalXP) || 0);
  const currentLevel = Math.floor(Math.sqrt(safeXP / 100)) + 1;

  const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
  const xpForNextLevel = Math.pow(currentLevel, 2) * 100;

  const levelProgressXP = safeXP - xpForCurrentLevel;
  const levelTotalXPNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.min(
    100,
    Math.max(0, Math.round((levelProgressXP / levelTotalXPNeeded) * 100))
  );

  return {
    currentLevel,
    totalXP: safeXP,
    xpForCurrentLevel,
    xpForNextLevel,
    xpNeeded: xpForNextLevel - safeXP,
    progressPercentage,
  };
};

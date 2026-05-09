// import cron from "node-cron";
// import mongoose from "mongoose";
// import Internship from "../models/internshipModel.js";
// import Freelance from "../models/freelanceModel.js";
// import AppliedJob from "../models/appliedJobModel.js";
// import CompanyFollow from "../models/companyFollowModel.js";
// import UserDetails from "../models/userDetails.js";
// import JobSuggested from "../models/jobSuggestedModel.js";
// import User from "../models/userModel.js";
// import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";


// // ═══════════════════════════════════════════════════════════════
// //  REUSE — same helpers from your notification helper
// // ═══════════════════════════════════════════════════════════════

// const knownSuffixes = ["js", "ts", "css", "3", "4", "5", "2"];

// const normalizeSkill = (skill = "") => {
//   let s = skill.toLowerCase().replace(/[\.\-\_\s\/]/g, "");
//   for (const suf of knownSuffixes) {
//     if (s.endsWith(suf) && s.length > suf.length + 1) {
//       s = s.slice(0, -suf.length);
//       break;
//     }
//   }
//   return s;
// };

// const skillMatches = (jobSkills = [], userSkills = []) => {
//   if (!jobSkills.length || !userSkills.length) return false;
//   const normJob  = jobSkills.map(normalizeSkill);
//   const normUser = userSkills.map(normalizeSkill);
//   return normJob.some((js) =>
//     normUser.some((us) => js === us || js.includes(us) || us.includes(js))
//   );
// };

// const titleKeywords = (title = "") =>
//   title
//     .toLowerCase()
//     .replace(/[\/\-,]/g, " ")
//     .split(/\s+/)
//     .filter((w) => w.length > 1);

// const titleMatches = (a = "", b = "") => {
//   const kA = titleKeywords(a);
//   const kB = titleKeywords(b);
//   return kA.some((k) => kB.includes(k));
// };

// // ═══════════════════════════════════════════════════════════════
// //  CORE — find matching jobs for a single user
// // ═══════════════════════════════════════════════════════════════

// const getMatchingJobsForUser = async ({ userDetail, followedCompanyIds, allJobs }) => {
//   const userAllSkills = [
//     ...(userDetail.skills?.primary_skills || []),
//     ...(userDetail.skills?.tools          || []),
//     ...(userDetail.skills?.languages      || []),
//   ];
//   const userJobTitles = userDetail.jobTitles || [];

//   const matched = [];

//   for (const job of allJobs) {
//     const companyIdStr = job.c_by?.toString();

//     let reason = null;

//     // ── follower ──────────────────────────────────────────────
//     if (followedCompanyIds.includes(companyIdStr)) {
//       reason = "follower";
//     }
//     // ── skill match ───────────────────────────────────────────
//     else if (job.skill_set?.length && skillMatches(job.skill_set, userAllSkills)) {
//       reason = "skill_match";
//     }
//     // ── profile jobTitle match ────────────────────────────────
//     else if (userJobTitles.some((jt) => titleMatches(jt, job.jobTitle))) {
//       reason = "job_title_match";
//     }

//     if (reason) {
//       matched.push({ job, reason });
//     }
//   }

//   return matched;
// };

// // ═══════════════════════════════════════════════════════════════
// //  CORE — filter out already suggested jobs
// // ═══════════════════════════════════════════════════════════════

// const filterAlreadySuggested = async (userId, matchedJobs) => {
//   // Get all jobIds already suggested to this user
//   const existing = await JobSuggested.find({ userId }).select("jobId").lean();
//   const existingIds = new Set(existing.map((e) => e.jobId.toString()));

//   // Return only jobs not yet suggested
//   return matchedJobs.filter(({ job }) => !existingIds.has(job._id.toString()));
// };

// // ═══════════════════════════════════════════════════════════════
// //  CORE — save suggested jobs + send 1 batch notification
// // ═══════════════════════════════════════════════════════════════

// const saveSuggestionsAndNotify = async ({ userId, newSuggestions, jobType }) => {
//   if (!newSuggestions.length) return;

//   // ── Take max 5 ────────────────────────────────────────────────────────
//   const batch = newSuggestions.slice(0, 5);

//   // ── Save each to JobSuggested (insertMany with ordered:false skips duplicates) ──
//   const docs = batch.map(({ job, reason }) => ({
//     userId,
//     jobId:     job._id,
//     jobType,
//     jobTitle:  job.jobTitle,
//     organizer: job.organizer,
//     reason,
//     notified:  true,
//   }));

//   await JobSuggested.insertMany(docs, { ordered: false }).catch((err) => {
//     // E11000 = duplicate key — safe to ignore
//     if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) {
//       throw err;
//     }
//   });

//   // ── Fetch user FCM token ──────────────────────────────────────────────
//   const user = await User.findById(userId).select("fcm_token").lean();
//   if (!user) return;

//   // ── Build one combined notification ──────────────────────────────────
//   const jobType_label = jobType === "Freelance" ? "freelance projects" : "internships";

//   const jobLines = batch
//     .map(({ job }, i) => `${i + 1}. ${job.jobTitle} — ${job.organizer}`)
//     .join("\n");

// const title =
//   batch.length === 1
//     ? `New ${jobType === "Freelance" ? "freelance project" : "internship"} for you`
//     : `${batch.length} new ${jobType_label} for you`;

// const message =
//   batch.length === 1
//     ? `${batch[0].job.jobTitle} at ${batch[0].job.organizer}. Apply now!`
//     : `${batch.length} ${jobType_label} match your profile. Check them now!`;

// const body =
//   batch.length === 1
//     ? `${batch[0].job.jobTitle} • Apply now`
//     : `${batch.length} new ${jobType_label} available`;

//   await sendAndSaveNotification({
//     senderId:     userId,             // system notification — no sender
//     receiverId:   userId.toString(),
//     title,
//     message,
//     body,
//     type:         "job_suggestion",
//     reference_id: batch[0].job._id.toString(),  // link to first job
//     metadata: {
//       jobType,
      
//       totalSuggested: batch.length,
//       jobs: batch.map(({ job, reason }) => ({
//         jobId:     job._id.toString(),
//         jobTitle:  job.jobTitle,
//         organizer: job.organizer,
//         reason,
//       })),
//     },
//   });

//   console.log(
//     `[CronSuggest] userId:${userId} → ${batch.length} ${jobType} suggestions sent`
//   );
// };

// // ═══════════════════════════════════════════════════════════════
// //  MAIN CRON RUNNER
// // ═══════════════════════════════════════════════════════════════

// const runJobSuggestionCron = async () => {
//   console.log("[CronSuggest] Running job suggestion cron...");

//   try {
//     // ── Fetch all active jobs (both types) ────────────────────────────
//     const [internships, freelances] = await Promise.all([
//       Internship.find({ isActive: true }).select(
//         "_id jobTitle organizer skill_set c_by applicationDeadline mode location"
//       ).lean(),
//       Freelance.find({ isActive: true }).select(
//         "_id jobTitle organizer skill_set c_by applicationDeadline mode location"
//       ).lean(),
//     ]);

//     // ── Fetch all users with details ──────────────────────────────────
//     const allUserDetails = await UserDetails.find({})
//       .select("userId skills jobTitles")
//       .lean();

//     for (const userDetail of allUserDetails) {
//       const userId = userDetail.userId;

//       // ── Get companies this user follows ───────────────────────────
//       const follows = await CompanyFollow.find({ userId }).select("companyId").lean();
//       const followedCompanyIds = follows.map((f) => f.companyId.toString());

//       // ── Match internships ─────────────────────────────────────────
//       const matchedInternships = await getMatchingJobsForUser({
//         userDetail,
//         followedCompanyIds,
//         allJobs: internships,
//       });

//       const newInternships = await filterAlreadySuggested(userId, matchedInternships);

//       await saveSuggestionsAndNotify({
//         userId,
//         newSuggestions: newInternships,
//         jobType: "Internship",
//       });

//       // ── Match freelances ──────────────────────────────────────────
//       const matchedFreelances = await getMatchingJobsForUser({
//         userDetail,
//         followedCompanyIds,
//         allJobs: freelances,
//       });

//       const newFreelances = await filterAlreadySuggested(userId, matchedFreelances);

//       await saveSuggestionsAndNotify({
//         userId,
//         newSuggestions: newFreelances,
//         jobType: "Freelance",
//       });
//     }

//     console.log("[CronSuggest] Done ✓");
//   } catch (error) {
//     console.error("[CronSuggest] Error:", error.message);
//   }
// };

// // ═══════════════════════════════════════════════════════════════
// //  SCHEDULE — runs every day at 9:00 AM
// //  change cron expression as needed:
// //  "0 9 * * *"     → every day 9AM
// //  "0 9,18 * * *"  → 9AM and 6PM daily
// //  "0 */6 * * *"   → every 6 hours
// // ═══════════════════════════════════════════════════════════════

// export const startJobSuggestionCron = () => {
//   cron.schedule("* * * * *", runJobSuggestionCron, {
//     timezone: "Asia/Kolkata",   // ← your timezone
//   });
//   console.log("[CronSuggest] Scheduled — daily at 9AM IST");
// };

import cron from "node-cron";
import Internship from "../models/internshipModel.js";
import Freelance from "../models/freelanceModel.js";
import AppliedJob from "../models/appliedJobModel.js";
import CompanyFollow from "../models/companyFollowModel.js";
import UserDetails from "../models/userDetails.js";
import JobSuggested from "../models/jobSuggestedModel.js";
import User from "../models/userModel.js";
import { sendAndSaveNotification } from "../helper/sendAndSaveNotification.js";

// ═══════════════════════════════════════════════════════════════
//  SKILL NORMALIZATION & FUZZY MATCHING (guarded)
// ═══════════════════════════════════════════════════════════════

const knownSuffixes = ["js", "ts", "css", "3", "4", "5", "2"];

const normalizeSkill = (skill = "") => {
  let s = skill.toLowerCase().replace(/[\.\-\_\s\/]/g, "");
  for (const suf of knownSuffixes) {
    if (s.endsWith(suf) && s.length > suf.length + 1) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
};

const skillMatches = (jobSkills = [], userSkills = []) => {
  if (!jobSkills.length || !userSkills.length) return false;
  const normJob  = jobSkills.map(normalizeSkill);
  const normUser = userSkills.map(normalizeSkill);

  return normJob.some((js) =>
    normUser.some((us) => {
      // ── exact match after normalize ────────────────────────────
      if (js === us) return true;

      // ── both must be at least 3 chars ──────────────────────────
      // prevents "ts" → "rust", "js" → "django"
      if (js.length < 3 || us.length < 3) return false;

      // ── shorter must be ≥ 60% of longer ────────────────────────
      // prevents "dart" → "dashboard", "vue" → "vulture"
      const longer  = Math.max(js.length, us.length);
      const shorter = Math.min(js.length, us.length);
      if (shorter / longer < 0.6) return false;

      return js.includes(us) || us.includes(js);
    })
  );
};

// ═══════════════════════════════════════════════════════════════
//  TITLE MATCHING (stop words removed)
// ═══════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "developer", "engineer", "designer", "lead", "senior", "junior",
  "intern", "manager", "architect", "analyst", "consultant", "specialist",
  "full", "stack", "web", "mobile", "app", "software", "dev",
]);

const titleKeywords = (title = "") =>
  title
    .toLowerCase()
    .replace(/[\/\-,]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  // "Flutter Developer"   → ["flutter"]
  // "Java Developer"      → ["java"]
  // "React JS Developer"  → ["react"]   ("js" filtered by length)
  // "UI/UX Designer"      → ["ui", "ux"]

const titleMatches = (a = "", b = "") => {
  const kA = titleKeywords(a);
  const kB = titleKeywords(b);

  // both must have meaningful keywords after stop word removal
  if (!kA.length || !kB.length) return false;

  return kA.some((k) => kB.includes(k));
};

// ═══════════════════════════════════════════════════════════════
//  CORE — find matching jobs for a single user
// ═══════════════════════════════════════════════════════════════

const getMatchingJobsForUser = ({ userDetail, followedCompanyIds, allJobs }) => {
  const userAllSkills = [
    ...(userDetail.skills?.primary_skills || []),
    ...(userDetail.skills?.tools          || []),
    ...(userDetail.skills?.languages      || []),
  ];
  const userJobTitles = userDetail.jobTitles || [];

  const matched = [];

  for (const job of allJobs) {
    const companyIdStr = job.c_by?.toString();
    let reason = null;

    // ── 1. follower ───────────────────────────────────────────────────
    if (followedCompanyIds.includes(companyIdStr)) {
      reason = "follower";
    }
    // ── 2. skill match (guarded fuzzy) ────────────────────────────────
    // "dart,flutter" user will NOT match "spring boot, mysql" job ✅
    else if (job.skill_set?.length && skillMatches(job.skill_set, userAllSkills)) {
      reason = "skill_match";
    }
    // ── 3. profile jobTitle match (stop-word filtered) ────────────────
    // "Flutter Developer" user will NOT match "Java Developer" job ✅
    else if (userJobTitles.some((jt) => titleMatches(jt, job.jobTitle))) {
      reason = "job_title_match";
    }

    if (reason) matched.push({ job, reason });
  }

  return matched;
};

// ═══════════════════════════════════════════════════════════════
//  CORE — filter out already suggested jobs
// ═══════════════════════════════════════════════════════════════

const filterAlreadySuggested = async (userId, matchedJobs) => {
  const existing = await JobSuggested.find({ userId }).select("jobId").lean();
  const existingIds = new Set(existing.map((e) => e.jobId.toString()));
  return matchedJobs.filter(({ job }) => !existingIds.has(job._id.toString()));
};

// ═══════════════════════════════════════════════════════════════
//  CORE — save suggested jobs + send 1 batch notification
// ═══════════════════════════════════════════════════════════════

const saveSuggestionsAndNotify = async ({ userId, newSuggestions, jobType }) => {
  if (!newSuggestions.length) return;

  // ── Take max 5 ────────────────────────────────────────────────────────
  const batch = newSuggestions.slice(0, 5);

  // ── Save to JobSuggested (ordered:false skips duplicate key errors) ───
  const docs = batch.map(({ job, reason }) => ({
    userId,
    jobId:     job._id,
    jobType,
    jobTitle:  job.jobTitle,
    organizer: job.organizer,
    reason,
    notified:  true,
  }));

  await JobSuggested.insertMany(docs, { ordered: false }).catch((err) => {
    if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) {
      throw err;
    }
  });

  // ── Fetch user ────────────────────────────────────────────────────────
  const user = await User.findById(userId).select("fcm_token").lean();
  if (!user) return;

  // ── Build one combined notification ──────────────────────────────────
  const jobTypeLabel = jobType === "Freelance" ? "freelance projects" : "internships";

  const title =
    batch.length === 1
      ? `New ${jobType === "Freelance" ? "freelance project" : "internship"} for you`
      : `${batch.length} new ${jobTypeLabel} for you`;

  const message =
    batch.length === 1
      ? `${batch[0].job.jobTitle} at ${batch[0].job.organizer}. Apply now!`
      : `${batch.length} ${jobTypeLabel} match your profile. Check them now!`;

  const body =
    batch.length === 1
      ? `${batch[0].job.jobTitle} • Apply now`
      : `${batch.length} new ${jobTypeLabel} available`;

  await sendAndSaveNotification({
    senderId:     null,
    receiverId:   userId.toString(),
    title,
    message,
    body,
    type:         "job_suggestion",
    reference_id: batch[0].job._id.toString(),
    metadata: {
      jobType,
      totalSuggested: batch.length,
      jobs: batch.map(({ job, reason }) => ({
        jobId:     job._id.toString(),
        jobTitle:  job.jobTitle,
        organizer: job.organizer,
        reason,
      })),
    },
  });

  console.log(`[CronSuggest] userId:${userId} → ${batch.length} ${jobType} suggestions sent`);
};

// ═══════════════════════════════════════════════════════════════
//  MAIN CRON RUNNER
// ═══════════════════════════════════════════════════════════════

const runJobSuggestionCron = async () => {
  console.log("[CronSuggest] Running job suggestion cron...");

  try {
    // ── Fetch all active jobs once (reused for all users) ─────────────
    const [internships, freelances] = await Promise.all([
      Internship.find({ isActive: true })
        .select("_id jobTitle organizer skill_set c_by applicationDeadline mode location")
        .lean(),
      Freelance.find({ isActive: true })
        .select("_id jobTitle organizer skill_set c_by applicationDeadline mode location")
        .lean(),
    ]);

    // ── Fetch all user details once ───────────────────────────────────
    const allUserDetails = await UserDetails.find({})
      .select("userId skills jobTitles")
      .lean();

    // ── Fetch all follows once (avoid per-user DB call) ───────────────
    const allFollows = await CompanyFollow.find({}).select("userId companyId").lean();

    // Group follows by userId for O(1) lookup
    const followsMap = {};
    for (const f of allFollows) {
      const uid = f.userId.toString();
      if (!followsMap[uid]) followsMap[uid] = [];
      followsMap[uid].push(f.companyId.toString());
    }

    for (const userDetail of allUserDetails) {
      const userId = userDetail.userId;
      const followedCompanyIds = followsMap[userId?.toString()] || [];

      // ── Internships ───────────────────────────────────────────────
      const matchedInternships = getMatchingJobsForUser({
        userDetail,
        followedCompanyIds,
        allJobs: internships,
      });
      const newInternships = await filterAlreadySuggested(userId, matchedInternships);
      await saveSuggestionsAndNotify({
        userId,
        newSuggestions: newInternships,
        jobType: "Internship",
      });

      // ── Freelances ────────────────────────────────────────────────
      const matchedFreelances = getMatchingJobsForUser({
        userDetail,
        followedCompanyIds,
        allJobs: freelances,
      });
      const newFreelances = await filterAlreadySuggested(userId, matchedFreelances);
      await saveSuggestionsAndNotify({
        userId,
        newSuggestions: newFreelances,
        jobType: "Freelance",
      });
    }

    console.log("[CronSuggest] Done ✓");
  } catch (error) {
    console.error("[CronSuggest] Error:", error.message);
  }
};

// ═══════════════════════════════════════════════════════════════
//  SCHEDULE
//  "0 9 * * *"     → every day 9AM
//  "0 9,18 * * *"  → 9AM and 6PM daily
//  "0 */6 * * *"   → every 6 hours
// ═══════════════════════════════════════════════════════════════

export const startJobSuggestionCron = () => {
  cron.schedule("0 9 * * *", runJobSuggestionCron, {
    timezone: "Asia/Kolkata",
  });
  console.log("[CronSuggest] Scheduled — daily at 9AM IST");
};
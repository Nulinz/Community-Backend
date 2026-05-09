// import CompanyFollow from "../models/companyFollowModel.js";
// import UserDetails from "../models/userDetails.js";
// import AppliedJob from "../models/appliedJobModel.js";
// import { sendAndSaveNotification } from "./sendAndSaveNotification.js";

// // ═══════════════════════════════════════════════════════════════
// //  SKILL NORMALIZATION & FUZZY MATCHING
// // ═══════════════════════════════════════════════════════════════

// const knownSuffixes = ["js", "ts", "css", "3", "4", "5", "2"];

// const normalizeSkill = (skill = "") => {
//   let s = skill
//     .toLowerCase()
//     .replace(/[\.\-\_\s\/]/g, "");
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
//     normUser.some(
//       (us) =>
//         js === us ||
//         js.includes(us) ||
//         us.includes(js)
//     )
//   );
// };

// // ═══════════════════════════════════════════════════════════════
// //  TITLE FLEXIBLE MATCHING
// //  "ui/ux designer" ≈ "ui designer" ≈ "ux designer"
// // ═══════════════════════════════════════════════════════════════

// const titleKeywords = (title = "") =>
//   title
//     .toLowerCase()
//     .replace(/[\/\-,]/g, " ")
//     .split(/\s+/)
//     .filter((w) => w.length > 1);

// const titleMatches = (appliedTitle = "", newTitle = "") => {
//   const newKw = titleKeywords(newTitle);
//   const appKw = titleKeywords(appliedTitle);
//   return newKw.some((k) => appKw.includes(k));
// };

// // ═══════════════════════════════════════════════════════════════
// //  NOTIFICATION MESSAGES — Internship
// // ═══════════════════════════════════════════════════════════════

// const getInternshipPayload = ({
//   receiverId,
//   followerIds,
//   skillUserIds,
//   similarTitleIds,
//   jobTitleUserIds,
//   job,
// }) => {
//   const isFollower = followerIds.includes(receiverId);
//   const isSkillMatch = skillUserIds.includes(receiverId);
//   const isSimilar = similarTitleIds.includes(receiverId);
//   const isJobTitleMatch = jobTitleUserIds.includes(receiverId);

//   if (isFollower) {
//     return {
//       title: `New internship from ${job.organizer}`,
//       message: `${job.jobTitle} internship is now open.`,
//       body: `${job.jobTitle} • Apply now`,
//     };
//   }

//   if (isSkillMatch) {
//     const matched = job.skill_set.slice(0, 2).join(", ");

//     return {
//       title: `${job.jobTitle} matches your skills`,
//       message: `Skills matched: ${matched}. Apply now!`,
//       body: `${job.jobTitle} • Skill match`,
//     };
//   }

//   if (isJobTitleMatch) {
//     return {
//       title: `${job.jobTitle} matches your profile`,
//       message: `New internship at ${job.organizer}.`,
//       body: `${job.jobTitle} • Profile match`,
//     };
//   }

//   if (isSimilar) {
//     return {
//       title: `Similar internship for you`,
//       message: `${job.jobTitle} is similar to your previous applications.`,
//       body: `${job.jobTitle} • Recommended`,
//     };
//   }

//   return {
//     title: `Trending internship`,
//     message: `${job.jobTitle} at ${job.organizer} is now open.`,
//     body: `${job.jobTitle} • Apply now`,
//   };
// };


// // ═══════════════════════════════════════════════════════════════
// //  NOTIFICATION MESSAGES — Freelance
// // ═══════════════════════════════════════════════════════════════

// const getFreelancePayload = ({
//   receiverId,
//   followerIds,
//   skillUserIds,
//   similarTitleIds,
//   jobTitleUserIds,
//   job,
// }) => {
//   const isFollower = followerIds.includes(receiverId);
//   const isSkillMatch = skillUserIds.includes(receiverId);
//   const isSimilar = similarTitleIds.includes(receiverId);
//   const isJobTitleMatch = jobTitleUserIds.includes(receiverId);

//   if (isFollower) {
//     return {
//       title: `New freelance project from ${job.organizer}`,
//       message: `${job.jobTitle} project is now available.`,
//       body: `${job.jobTitle} • Apply now`,
//     };
//   }

//   if (isSkillMatch) {
//     const matched = job.skill_set.slice(0, 2).join(", ");

//     return {
//       title: `${job.jobTitle} matches your skills`,
//       message: `Looking for ${matched} skills.`,
//       body: `${job.jobTitle} • Skill match`,
//     };
//   }

//   if (isJobTitleMatch) {
//     return {
//       title: `${job.jobTitle} matches your profile`,
//       message: `New freelance project at ${job.organizer}.`,
//       body: `${job.jobTitle} • Profile match`,
//     };
//   }

//   if (isSimilar) {
//     return {
//       title: `Similar freelance project`,
//       message: `${job.jobTitle} matches your past interests.`,
//       body: `${job.jobTitle} • Recommended`,
//     };
//   }

//   return {
//     title: `Trending freelance project`,
//     message: `${job.jobTitle} at ${job.organizer} is now live.`,
//     body: `${job.jobTitle} • Apply now`,
//   };
// };

// // ═══════════════════════════════════════════════════════════════
// //  CORE AUDIENCE BUILDER  (shared by both types)
// // ═══════════════════════════════════════════════════════════════

// const buildAudience = async ({ job, senderId, jobType }) => {
//   const companyId = senderId.toString();

//   // ── 1. Company followers ───────────────────────────────────────────────
//   const follows = await CompanyFollow.find({ companyId }).select("userId");
//   const followerIds = follows.map((f) => f.userId.toString());

//   // ── 2. Skill-matched users (fuzzy, case-insensitive, all 3 buckets) ────
//   let skillUserIds = [];
//   if (job.skill_set?.length) {
//     const allUserSkills = await UserDetails.find({
//       $or: [
//         { "skills.primary_skills": { $exists: true, $ne: [] } },
//         { "skills.tools":          { $exists: true, $ne: [] } },
//         { "skills.languages":      { $exists: true, $ne: [] } },
//       ],
//     })
//       .select("userId skills")
//       .lean();

//     skillUserIds = allUserSkills
//       .filter((doc) => {
//         const userAllSkills = [
//           ...(doc.skills?.primary_skills || []),
//           ...(doc.skills?.tools          || []),
//           ...(doc.skills?.languages      || []),
//         ];
//         return skillMatches(job.skill_set, userAllSkills);
//       })
//       .map((doc) => doc.userId.toString());
//   }

//   // ── 3. Users who applied to similar job titles ─────────────────────────
//   const allApplied = await AppliedJob.find({ jobType })
//     .select("userId jobId")
//     .populate({ path: "jobId", select: "jobTitle" });

//   const similarTitleIds = allApplied
//     .filter((a) => a.jobId?.jobTitle && titleMatches(a.jobId.jobTitle, job.jobTitle))
//     .map((a) => a.userId.toString());

//   // ── 4. Most-applied users (top 50 by application count) ───────────────
//   const topApplied = await AppliedJob.aggregate([
//     { $match: { jobType } },
//     { $group: { _id: "$userId", count: { $sum: 1 } } },
//     { $sort:  { count: -1 } },
//     { $limit: 50 },
//   ]);
//   const mostAppliedIds = topApplied.map((t) => t._id.toString());

//   // ── 5. Users whose profile jobTitles match the new job title ──────────
//   const jobTitleMatchedUsers = await UserDetails.find({
//     jobTitles: { $exists: true, $ne: [] },
//   })
//     .select("userId jobTitles")
//     .lean();

//   const jobTitleUserIds = jobTitleMatchedUsers
//     .filter((doc) =>
//       doc.jobTitles?.some((jt) => titleMatches(jt, job.jobTitle))
//     )
//     .map((doc) => doc.userId.toString());

//   // ── Merge, deduplicate, exclude company itself ─────────────────────────
//   const allReceivers = [
//     ...new Set([
//       ...followerIds,
//       ...skillUserIds,
//       ...similarTitleIds,
//       ...mostAppliedIds,
//       ...jobTitleUserIds,
//     ]),
//   ].filter((id) => id !== companyId);

//   return {
//     allReceivers,
//     followerIds,
//     skillUserIds,
//     similarTitleIds,
//     jobTitleUserIds,
//   };
// };

// // ═══════════════════════════════════════════════════════════════
// //  MAIN EXPORT — works for both Internship & Freelance
// // ═══════════════════════════════════════════════════════════════

// /**
//  * @param {Object}  job       - saved Internship or Freelance document
//  * @param {string}  senderId  - req.user._id (company)
//  * @param {boolean} isUpdate  - true = update, false = new posting
//  * @param {string}  jobType   - "Internship" | "Freelance"
//  */
// export const notifyJobAudience = async (
//   job,
//   senderId,
//   isUpdate = false,
//   jobType = "Internship"
// ) => {
//   try {
//     const {
//       allReceivers,
//       followerIds,
//       skillUserIds,
//       similarTitleIds,
//       jobTitleUserIds,
//     } = await buildAudience({ job, senderId, jobType });

//     if (!allReceivers.length) return;

//     const notifType = "job_posted";

//     const getPayload =
//       jobType === "Freelance" ? getFreelancePayload : getInternshipPayload;

//     await Promise.allSettled(
//       allReceivers.map((receiverId) => {
//         const { title, message, body } = getPayload({
//           receiverId,
//           followerIds,
//           skillUserIds,
//           similarTitleIds,
//           jobTitleUserIds,
//           job,
//         });

//         return sendAndSaveNotification({
//           senderId,
//           receiverId,
//           title,
//           message,
//           body,
//           type:         notifType,
//           reference_id: job._id.toString(),
//           metadata: {
//             jobTitle:  job.jobTitle,
//             organizer: job.organizer,
//             mode:      job.mode,
//             location:  job.location,
//             jobType,
//           },
//         });
//       })
//     );

//     console.log(
//       `[Notif] ${jobType} "${job.jobTitle}" → sent to ${allReceivers.length} users`
//     );
//   } catch (error) {
//     console.error("notifyJobAudience error:", error.message);
//   }
// };


import CompanyFollow from "../models/companyFollowModel.js";
import UserDetails from "../models/userDetails.js";
import AppliedJob from "../models/appliedJobModel.js";
import { sendAndSaveNotification } from "./sendAndSaveNotification.js";

// ═══════════════════════════════════════════════════════════════
//  SKILL NORMALIZATION & FUZZY MATCHING
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
      // ── 1. Exact match after normalize — always valid ──────────────
      if (js === us) return true;

      // ── 2. Both must be at least 3 chars for substring check ───────
      //    prevents "ts" matching "rust", "js" matching "django"
      if (js.length < 3 || us.length < 3) return false;

      // ── 3. Shorter must be ≥ 60% of longer ─────────────────────────
      //    prevents "dart" → "dashboard", "vue" → "vulture"
      //    "react" (5) vs "reactnative" (11) → 5/11 = 45% ❌ blocked
      //    "react" (5) vs "reactjs" (7)      → 5/7  = 71% ✅ allowed
      const longer  = Math.max(js.length, us.length);
      const shorter = Math.min(js.length, us.length);
      if (shorter / longer < 0.6) return false;

      return js.includes(us) || us.includes(js);
    })
  );
};

// ═══════════════════════════════════════════════════════════════
//  TITLE FLEXIBLE MATCHING
// ═══════════════════════════════════════════════════════════════

// Stop words — too generic to match on alone
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
  // ↑ "React JS Developer" → ["react"] (strips "developer", "js" after normalize)
  // ↑ "Java Developer"     → ["java"]
  // ↑ "Flutter Developer"  → ["flutter"]
  // So "Java Developer" will NEVER match "Flutter Developer" ✅

const titleMatches = (appliedTitle = "", newTitle = "") => {
  const newKw = titleKeywords(newTitle);
  const appKw = titleKeywords(appliedTitle);

  // both must have at least one meaningful keyword after stop word removal
  if (!newKw.length || !appKw.length) return false;

  return newKw.some((k) => appKw.includes(k));
};

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION MESSAGES — Internship
// ═══════════════════════════════════════════════════════════════

const getInternshipPayload = ({
  receiverId,
  followerIds,
  skillUserIds,
  similarTitleIds,
  jobTitleUserIds,
  job,
}) => {
  const isFollower      = followerIds.includes(receiverId);
  const isSkillMatch    = skillUserIds.includes(receiverId);
  const isSimilar       = similarTitleIds.includes(receiverId);
  const isJobTitleMatch = jobTitleUserIds.includes(receiverId);

  if (isFollower) {
    return {
      title:   `New internship from ${job.organizer}`,
      message: `${job.jobTitle} internship is now open.`,
      body:    `${job.jobTitle} • Apply now`,
    };
  }
  if (isSkillMatch) {
    const matched = job.skill_set.slice(0, 2).join(", ");
    return {
      title:   `${job.jobTitle} matches your skills`,
      message: `Skills matched: ${matched}. Apply now!`,
      body:    `${job.jobTitle} • Skill match`,
    };
  }
  if (isJobTitleMatch) {
    return {
      title:   `${job.jobTitle} matches your profile`,
      message: `New internship at ${job.organizer}.`,
      body:    `${job.jobTitle} • Profile match`,
    };
  }
  if (isSimilar) {
    return {
      title:   `Similar internship for you`,
      message: `${job.jobTitle} is similar to your previous applications.`,
      body:    `${job.jobTitle} • Recommended`,
    };
  }
  return {
    title:   `Trending internship`,
    message: `${job.jobTitle} at ${job.organizer} is now open.`,
    body:    `${job.jobTitle} • Apply now`,
  };
};

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION MESSAGES — Freelance
// ═══════════════════════════════════════════════════════════════

const getFreelancePayload = ({
  receiverId,
  followerIds,
  skillUserIds,
  similarTitleIds,
  jobTitleUserIds,
  job,
}) => {
  const isFollower      = followerIds.includes(receiverId);
  const isSkillMatch    = skillUserIds.includes(receiverId);
  const isSimilar       = similarTitleIds.includes(receiverId);
  const isJobTitleMatch = jobTitleUserIds.includes(receiverId);

  if (isFollower) {
    return {
      title:   `New freelance project from ${job.organizer}`,
      message: `${job.jobTitle} project is now available.`,
      body:    `${job.jobTitle} • Apply now`,
    };
  }
  if (isSkillMatch) {
    const matched = job.skill_set.slice(0, 2).join(", ");
    return {
      title:   `${job.jobTitle} matches your skills`,
      message: `Looking for ${matched} skills.`,
      body:    `${job.jobTitle} • Skill match`,
    };
  }
  if (isJobTitleMatch) {
    return {
      title:   `${job.jobTitle} matches your profile`,
      message: `New freelance project at ${job.organizer}.`,
      body:    `${job.jobTitle} • Profile match`,
    };
  }
  if (isSimilar) {
    return {
      title:   `Similar freelance project`,
      message: `${job.jobTitle} matches your past interests.`,
      body:    `${job.jobTitle} • Recommended`,
    };
  }
  return {
    title:   `Trending freelance project`,
    message: `${job.jobTitle} at ${job.organizer} is now live.`,
    body:    `${job.jobTitle} • Apply now`,
  };
};

// ═══════════════════════════════════════════════════════════════
//  CORE AUDIENCE BUILDER
// ═══════════════════════════════════════════════════════════════

const buildAudience = async ({ job, senderId, jobType }) => {
  const companyId = senderId.toString();

  // ── 1. Company followers ───────────────────────────────────────────────
  const follows = await CompanyFollow.find({ companyId }).select("userId");
  const followerIds = follows.map((f) => f.userId.toString());

  // ── 2. Skill-matched users (fuzzy + guarded, all 3 buckets) ───────────
  let skillUserIds = [];
  if (job.skill_set?.length) {
    const allUserSkills = await UserDetails.find({
      $or: [
        { "skills.primary_skills": { $exists: true, $ne: [] } },
        { "skills.tools":          { $exists: true, $ne: [] } },
        { "skills.languages":      { $exists: true, $ne: [] } },
      ],
    })
      .select("userId skills")
      .lean();

    skillUserIds = allUserSkills
      .filter((doc) => {
        const userAllSkills = [
          ...(doc.skills?.primary_skills || []),
          ...(doc.skills?.tools          || []),
          ...(doc.skills?.languages      || []),
        ];
        return skillMatches(job.skill_set, userAllSkills);
      })
      .map((doc) => doc.userId.toString());
  }

  // ── 3. Users who applied to jobs with SAME title keywords ─────────────
  //    ✅ Fixed: groups by user → checks if their applied titles match
  //    ❌ Was: top 50 global appliers (wrong — sent Java notifs to Flutter devs)
  const allApplied = await AppliedJob.find({ jobType })
    .select("userId jobId")
    .populate({ path: "jobId", select: "jobTitle" })
    .lean();

  const userAppliedTitlesMap = {};
  for (const a of allApplied) {
    if (!a.jobId?.jobTitle) continue;
    const uid = a.userId.toString();
    if (!userAppliedTitlesMap[uid]) userAppliedTitlesMap[uid] = [];
    userAppliedTitlesMap[uid].push(a.jobId.jobTitle);
  }

  const similarTitleIds = Object.entries(userAppliedTitlesMap)
    .filter(([, titles]) => titles.some((t) => titleMatches(t, job.jobTitle)))
    .map(([uid]) => uid);

  // ── 4. Most-applied — now means: users who applied most to SAME title ─
  //    ✅ Fixed: counts applications per user only within matching titles
  //    ❌ Was: top 50 by total application count globally
  const mostAppliedIds = Object.entries(userAppliedTitlesMap)
    .map(([uid, titles]) => ({
      uid,
      matchCount: titles.filter((t) => titleMatches(t, job.jobTitle)).length,
    }))
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 50)
    .map(({ uid }) => uid);

  // ── 5. Users whose profile jobTitles match ────────────────────────────
  const jobTitleMatchedUsers = await UserDetails.find({
    jobTitles: { $exists: true, $ne: [] },
  })
    .select("userId jobTitles")
    .lean();

  const jobTitleUserIds = jobTitleMatchedUsers
    .filter((doc) =>
      doc.jobTitles?.some((jt) => titleMatches(jt, job.jobTitle))
    )
    .map((doc) => doc.userId.toString());

  // ── Merge, deduplicate, exclude company itself ─────────────────────────
  const allReceivers = [
    ...new Set([
      ...followerIds,
      ...skillUserIds,
      ...similarTitleIds,
      ...mostAppliedIds,
      ...jobTitleUserIds,
    ]),
  ].filter((id) => id !== companyId);

  return {
    allReceivers,
    followerIds,
    skillUserIds,
    similarTitleIds,
    jobTitleUserIds,
  };
};

// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

export const notifyJobAudience = async (
  job,
  senderId,
  isUpdate = false,
  jobType = "Internship"
) => {
  try {
    const {
      allReceivers,
      followerIds,
      skillUserIds,
      similarTitleIds,
      jobTitleUserIds,
    } = await buildAudience({ job, senderId, jobType });

    if (!allReceivers.length) return;

    const getPayload =
      jobType === "Freelance" ? getFreelancePayload : getInternshipPayload;

    await Promise.allSettled(
      allReceivers.map((receiverId) => {
        const { title, message, body } = getPayload({
          receiverId,
          followerIds,
          skillUserIds,
          similarTitleIds,
          jobTitleUserIds,
          job,
        });

        return sendAndSaveNotification({
          senderId,
          receiverId,
          title,
          message,
          body,
          type:         "job_posted",
          reference_id: job._id.toString(),
          metadata: {
            jobTitle:  job.jobTitle,
            organizer: job.organizer,
            mode:      job.mode,
            location:  job.location,
            jobType,
          },
        });
      })
    );

    console.log(
      `[Notif] ${jobType} "${job.jobTitle}" → sent to ${allReceivers.length} users`
    );
  } catch (error) {
    console.error("notifyJobAudience error:", error.message);
  }
};
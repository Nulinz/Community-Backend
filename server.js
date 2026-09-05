import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

import express from "express";
import path from "path";

import connectDB from "./config/db.js";
import errorMiddleware from "./middleware/error.middleware.js";
import AppError from "./helper/appError.js";
import userRoutes from "./routes/userRoutes.js";
import userDetailsRoutes from "./routes/userDetails.js"
import companyRoutes from "./routes/companyRoutes.js";
import collegeRoutes from "./routes/collegeRoutes.js"
import eventRoutes from "./routes/eventRoutes.js"
import competitionRoutes from "./routes/competitionRoutes.js"
import conferenceRoutes from "./routes/conferenceRoutes.js"
import seminarRoutes from "./routes/seminarRoutes.js"
import internshipRoutes from "./routes/internshipRoutes.js"
import jobRoutes from "./routes/jobRoutes.js"
import freelanceRoutes from "./routes/freelanceRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import certificateRoutes from "./routes/certificateRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import influencerRoutes from "./routes/influencerRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import { seedTamilNaduLocations } from "./services/uploadLocation.js";
import { startEventReminderCron } from "./jobs/eventRemainder.js";
import { startJobSuggestionCron } from "./jobs/jobSuggested.js";
import { seedConferences } from "./services/uploadConference.js";
import { seedSeminars } from "./services/uploadSeminar.js";
import { seedCompanyByUserId } from "./services/companyCreate.js";
import { migrateStatusField } from "./services/statusSet.js";


const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.2:5173",
  "http://192.168.29.221:5173",
  "http://192.168.29.74:5173",
  "https://icy-tree-067e50e10.7.azurestaticapps.net",
  "https://gradenvy.com",
  "https://salmon-ocean-053a6b810.6.azurestaticapps.net",
  "https://gradenvy.com",
].filter(Boolean);

app.set("trust proxy", true);
app.use(
  cors({
    origin: allowedOrigins,
    // origin: "https://icy-tree-067e50e10.7.azurestaticapps.net",
    credentials: true
  })
);

// Upload Data

//  seedConferences()
//  seedSeminars()

app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/resume", express.static(path.join(process.cwd(), "resume")));

// ── Deep Linking & App Association Assets ──────────────────────
// 1. Android Digital Asset Links (Required for Android App Links auto-verify)
app.get(
  ["/.well-known/assetlinks.json", "/.wellknown/assetlinks.json", "/.wellknown/assetlinks"],
  (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path.join(process.cwd(), ".well-known", "assetlinks.json"), { dotfiles: "allow" });
  }
);

// 2. Apple App Site Association (Required for iOS Universal Links - served as application/json with NO extension)
app.get(
  [
    "/.well-known/apple-app-site-association",
    "/.wellknown/apple-app-site-association",
    "/apple-app-site-association",
  ],
  (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(path.join(process.cwd(), ".well-known", "apple-app-site-association"), { dotfiles: "allow" });
  }
);

// 3. Static directory fallback for .well-known & .wellknown URLs
app.use(
  ["/.well-known", "/.wellknown"],
  express.static(path.join(process.cwd(), ".well-known"), {
    dotfiles: "allow",
    setHeaders: (res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

// 4. Referral Landing Page & Smart App Redirection
app.use(
  "/referral",
  express.static(path.join(process.cwd(), "public", "referral"), { redirect: false })
);
app.get(/^\/referral(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "referral", "index.html"));
});

// 5. Fallback Share App Landing Page
app.use(
  "/share",
  express.static(path.join(process.cwd(), "public", "share"), { redirect: false })
);
app.get(/^\/share(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "share", "index.html"));
});
// seedTamilNaduLocations()

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Nulinz backend is running",
  });
});


/*-----------JOBS--------------- */

startEventReminderCron();
startJobSuggestionCron()
/*------------------------------ */
app.use("/api/users", userRoutes);
app.use("/api/userDetails", userDetailsRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/college", collegeRoutes)
app.use("/api/event", eventRoutes)
app.use("/api/competition", competitionRoutes)
app.use("/api/conference", conferenceRoutes)
app.use("/api/seminar", seminarRoutes)
app.use("/api/internship", internshipRoutes)
app.use("/api/job", jobRoutes)
app.use("/api/freelance", freelanceRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/certificates", certificateRoutes)
app.use("/api/feedback", feedbackRoutes)
app.use("/api/subscriptions", subscriptionRoutes)
app.use("/api/influencer", influencerRoutes)
app.use("/api/resume", resumeRoutes)


//  migrateStatusField()

// Catch-all for unhandled endpoints
app.use((req, res, next) => {
  next(new AppError("The requested resource could not be found.", 404));
});

app.use(errorMiddleware);




const startServer = async () => {
  if (process.env.MONGO_URI) {
    await connectDB();
    //     const result = await  seedCompanyByUserId({
    //   userId: "69feac1bc9dc4dd0ca5d5f10",
    //   companyData: {
    //     companyName: "Nulinz",
    //     companyType: "IT Services",
    //     contactPersonName: "admin",
    //     address: "Salem",
    //     city: "Salem",
    //     state: "Tamil Nadu",
    //     pincode: "636001",
    //     companyLogo: "uploads/Nulinz LOGO 3.png",
    //   },
    // });


    // console.log(result);
  } else {
    console.warn("MONGO_URI not found. Starting server without database connection.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};



startServer();

// Global process error safety guards
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught Exception:", err);
});

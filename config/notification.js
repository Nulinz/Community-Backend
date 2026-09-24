
import admin from "firebase-admin";
import fs from "fs";
import path from "path";


import { fileURLToPath } from "url";

// Fix __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(
  __dirname,
  "grad-envy-95e6254955fe.json"
);

/**
 * Resolves Firebase service account credentials.
 * Prioritizes:
 * 1. FIREBASE_SERVICE_ACCOUNT environment variable (JSON string or Base64 string from Azure)
 * 2. Individual Azure environment variables (FIREBASE_PRIVATE_KEY, etc.)
 * 3. Local service account JSON file for local development
 */
const getServiceAccountCredentials = () => {
  // 1. Check if whole JSON service account is provided in environment variables (Azure App Service / Key Vault)
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT
    ? "FIREBASE_SERVICE_ACCOUNT"
    : process.env.FIREBASE_CREDENTIALS
    ? "FIREBASE_CREDENTIALS"
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? "FIREBASE_SERVICE_ACCOUNT_KEY"
    : null;

  if (envKey) {
    console.log(`[Firebase Admin] Found credentials in process.env.${envKey}`);
    const rawServiceAccountEnv = process.env[envKey];
    const rawConfig = typeof rawServiceAccountEnv === "string" ? rawServiceAccountEnv.trim() : rawServiceAccountEnv;

    // Guard against unresolved Azure Key Vault references
    if (typeof rawConfig === "string" && rawConfig.startsWith("@Microsoft.KeyVault")) {
      console.error(
        "[Firebase Admin] Azure Key Vault reference was NOT resolved! Verify App Service Managed Identity has 'Key Vault Secrets User' role."
      );
      throw new Error(
        "Azure Key Vault reference for Firebase credentials was not resolved by App Service. Ensure Managed Identity has 'Key Vault Secrets User' role."
      );
    }

    try {
      let serviceAccount;
      if (typeof rawConfig === "object" && rawConfig !== null) {
        serviceAccount = rawConfig;
      } else {
        // Handle both raw JSON string and base64-encoded JSON string
        const jsonString = rawConfig.startsWith("{")
          ? rawConfig
          : Buffer.from(rawConfig, "base64").toString("utf-8");
        serviceAccount = JSON.parse(jsonString);
      }

      // Critical for Azure: Ensure escaped newlines in private key are converted to actual newlines
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key
          .replace(/^"|"$/g, "")
          .replace(/\\n/g, "\n");
      }

      const resolvedProjectId = serviceAccount.project_id || serviceAccount.projectId;
      console.log(
        `[Firebase Admin] Credentials loaded successfully for project: "${resolvedProjectId}" (Client: ${serviceAccount.client_email})`
      );

      return serviceAccount;
    } catch (parseError) {
      console.error("[Firebase Admin] Failed to parse JSON credentials:", parseError.message);
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${parseError.message}`
      );
    }
  }

  // 2. Check if individual Azure Environment Variables are populated
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("[Firebase Admin] Loading credentials from individual environment variables");
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY.trim();

    // Guard against unresolved Azure Key Vault references (missing Managed Identity permissions)
    if (rawPrivateKey.startsWith("@Microsoft.KeyVault")) {
      console.error(
        "[Firebase Admin] Azure Key Vault reference for FIREBASE_PRIVATE_KEY was not resolved!"
      );
      throw new Error(
        "Azure Key Vault reference for FIREBASE_PRIVATE_KEY was not resolved by App Service. Ensure the Managed Identity has 'Key Vault Secrets User' role."
      );
    }

    // Format private key by removing accidental quotes and converting escaped newlines
    const formattedPrivateKey = rawPrivateKey
      .replace(/^"|"$/g, "")
      .replace(/\\n/g, "\n");

    console.log(
      `[Firebase Admin] Individual env credentials loaded for project: "${process.env.FIREBASE_PROJECT_ID}"`
    );

    return {
      type: "service_account",
      projectId: process.env.FIREBASE_PROJECT_ID,
      project_id: process.env.FIREBASE_PROJECT_ID,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      privateKey: formattedPrivateKey,
      private_key: formattedPrivateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      clientId: process.env.FIREBASE_CLIENT_ID,
      client_id: process.env.FIREBASE_CLIENT_ID,
      authUri: "https://accounts.google.com/o/oauth2/auth",
      tokenUri: "https://oauth2.googleapis.com/token",
      authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
      clientX509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universeDomain: process.env.FIREBASE_UNIVERSE_DOMAIN || "googleapis.com",
    };
  }

  // 3. Fallback to local JSON file for local development
  if (fs.existsSync(serviceAccountPath)) {
    console.log(`[Firebase Admin] Loading credentials from local file: ${serviceAccountPath}`);
    const localCredentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    console.log(
      `[Firebase Admin] Local file credentials loaded for project: "${localCredentials.project_id || localCredentials.projectId}"`
    );
    return localCredentials;
  }

  console.error("[Firebase Admin] No Firebase credentials found in environment variables or local file!");
  throw new Error(
    "Firebase credentials not found in environment variables (Azure) or local file (grad-envy-*.json)."
  );
};

const getFirebaseApp = () => {
  // Reuse existing app instance to prevent duplicate app initialization errors
  if (admin.apps.length > 0) {
    return admin.app();
  }

  console.log("[Firebase Admin] Initializing Firebase Admin SDK app instance...");
  const credentials = getServiceAccountCredentials();
  const projectId = credentials.projectId || credentials.project_id;

  const app = admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId,
  });

  console.log(`[Firebase Admin] Firebase Admin SDK initialized successfully for project: "${projectId}"`);
  return app;
};

const sendNotification = async (data) => {
  if (!data || !data.token) {
    console.warn("[FCM] Notification skipped: No device token provided");
    return null;
  }

  const maskedToken = `...${String(data.token).slice(-6)}`;
  console.log(`[FCM] Sending push notification | Target: ${maskedToken} | Title: "${data.title}"`);

  try {
    const app = getFirebaseApp();

    const stringifyData = (obj) => {
      const result = {};
      if (!obj) return result;
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
          result[key] = typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
        }
      }
      return result;
    };

    const { token, title, body, ...restPayload } = data;

    const safeData = stringifyData({
      type: data.type || "alert",
      id: String(data.id || ""),
      ...restPayload,
    });

    const message = {
      token: data.token,
      notification: {
        title: data.title,
        body: data.body,
      },
      data: safeData,
      android: {
        priority: "high",
        notification: {
          channelId: "default_notification_channel",
          sound: "default",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: { sound: "default", badge: 1 },
        },
      },
    };

    const response = await app.messaging().send(message);
    console.log(`[FCM] Push notification delivered successfully to ${maskedToken} | Message ID: ${response}`);
    return response;
  } catch (error) {
    if (error.code === "messaging/registration-token-not-registered") {
      console.warn(`[FCM] Token ${maskedToken} is no longer registered or has expired. The app may have been uninstalled.`);
    } else if (
      error.code === "messaging/invalid-argument" ||
      error.code === "messaging/mismatched-credential" ||
      error.message?.includes("MismatchSenderId")
    ) {
      console.error(
        `[FCM] Sender ID mismatch or invalid token for ${maskedToken}. Ensure client and backend use the exact same Firebase Project.`
      );
    } else {
      console.error(`[FCM] Failed to send push notification to ${maskedToken}:`, error.code || error.message || error);
    }
    return null;
  }
};

const sendCallInvite = async (patientFcmToken, callData) => {
  if (!patientFcmToken) {
    console.warn("[FCM Call] Call invite skipped: No patient FCM token provided");
    return null;
  }

  const maskedToken = `...${String(patientFcmToken).slice(-6)}`;
  console.log(`[FCM Call] Sending call invite to ${maskedToken} | Doctor: "${callData.doctorName}" | Channel: "${callData.channelName}"`);

  try {
    const app = getFirebaseApp();

    const message = {
      token: patientFcmToken,
      data: {
        type: "call_invite",
        caller_name: String(callData.doctorName ?? ""),
        channel_name: String(callData.channelName ?? ""),
        token: String(callData.agoraToken ?? ""),
        api_uid: String(callData.patientId ?? ""),
        appointment_id: String(callData.appointmentId ?? ""),
        uid: "0",
      },
      android: {
        priority: "high",
        ttl: 60 * 1000,
      },
      apns: {
        payload: {
          aps: {
            "content-available": 1,
            sound: "default",
          },
        },
      },
    };

    const response = await app.messaging().send(message);
    console.log(`[FCM Call] Call invitation sent successfully to ${maskedToken} | Message ID: ${response}`);
    return response;

  } catch (error) {
    console.error(`[FCM Call] Failed to send call invite to ${maskedToken}:`, error.code || error.message || error);
    return null;
  }
};

// const message = {
//   token,
//   notification: {
//     title,
//     body,
//   },
//   data: {
//     type: data.type || "alert",
//     id: String(data.id || ""),
//     ...data,
//   },
//   android: {
//     priority: "high",
//   },
//   apns: {
//     payload: {
//       aps: {
//         sound: "default",
//         badge: 1,
//       },
//     },
//   },
// };
export { sendNotification, sendCallInvite };



// const admin = require("firebase-admin");
// const fs = require("fs");
// const path = require("path");
// const logger = require("../utils/logger");

// const serviceAccountPath = path.join(
//   __dirname,
//   "dacdiag-f9951-e521b8f0a5a0.json"
// );

// // A unique name for this specific Firebase instance to prevent senderId mismatches
// const APP_NAME = "DACDiagApp"; 

// // Helper function to ensure ALL data payload values are strings (Prevents FCM crashes)
// const stringifyData = (dataObj) => {
//   const result = {};
//   if (!dataObj) return result;
  
//   for (const [key, value] of Object.entries(dataObj)) {
//     if (value !== null && value !== undefined) {
//       // Objects/Arrays need to be stringified, primitives just converted to string
//       result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
//     }
//   }
//   return result;
// };

// const getFirebaseApp = () => {
//   // ⭐ Look for our specific named app instead of the generic default one
//   const existingApp = admin.apps.find((app) => app && app.name === APP_NAME);
//   if (existingApp) {
//     return existingApp;
//   }

//   if (!fs.existsSync(serviceAccountPath)) {
//     throw new Error(`Service account not found at path: ${serviceAccountPath}`);
//   }

//   const serviceAccount = JSON.parse(
//     fs.readFileSync(serviceAccountPath, "utf8")
//   );

//   // Initialize with our specific name
//   return admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     projectId: serviceAccount?.project_id
//   }, APP_NAME);
// };

// const sendNotification = async (token, title = "DACDiag Notification", body = "You have a new notification", data = {}) => {
//   if (!token) {
//     logger.warn("No device token provided");
//     return null;
//   }

//   try {
//     const app = getFirebaseApp();

//     // Safely combine and stringify all custom data
//     const safeData = stringifyData({
//       type: data.type || "alert",
//       id: data.id || "",
//       ...data, 
//     });

//     const message = {
//       token,
//       notification: {
//         title,
//         body,
//       },
//       data: safeData,
//       android: {
//         priority: "high",
//       },
//       apns: {
//         payload: {
//           aps: {
//             "content-available": 1, // Added for reliable background delivery on iOS
//             sound: "default",
//             badge: 1,
//           },
//         },
//       },
//     };

//     // Make sure we use the specific app instance's messaging service
//     const response = await app.messaging().send(message);
//     logger.info("Response:", response);
//     logger.info(`Notification sent to token: ${token}`);
//     return response;

//   } catch (error) {
//     logger.error("Notification error", error);
//     return null;
//   }
// };

// const sendCallInvite = async (patientFcmToken, callData) => {
//   if (!patientFcmToken) {
//     logger.warn("No patient FCM token provided");
//     return null;
//   }

//   try {
//     const app = getFirebaseApp();

//     // Ensure call data is safely stringified
//     const safeData = stringifyData({
//       type: "call_invite",
//       caller_name: callData.doctorName || "",
//       channel_name: callData.channelName || "",
//       token: callData.agoraToken || "",
//       api_uid: callData.patientId || "",
//       appointment_id: callData.appointmentId || "",
//       uid: "0",
//     });

//     const message = {
//       token: patientFcmToken,
//       data: safeData,
//       android: {
//         priority: "high",
//         ttl: 60 * 1000,
//       },
//       apns: {
//         payload: {
//           aps: {
//             "content-available": 1,
//             sound: "default",
//           },
//         },
//       },
//     };

//     const response = await app.messaging().send(message);
//     logger.info("Call invitation sent successfully");
//     return response;

//   } catch (error) {
//     logger.error("Call invite error", error);
//     return null;
//   }
// };

// module.exports = { sendNotification, sendCallInvite };

import admin from "firebase-admin";
import fs from "fs";
import path from "path";


import { fileURLToPath } from "url";

// Fix __dirname in ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(
  __dirname,
  "grad-envy-4a740eca4576.json"
);

const getFirebaseApp = () => {
  // ⭐ If app already exists, reuse it (IMPORTANT)
  if (admin.apps.length > 0) {
    return admin.app();
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("Service account not found");
  }
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );
console.log("Using Firebase project:", serviceAccount.project_id);
return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId:serviceAccount?.project_id
  });
};

const sendNotification = async (data) => {
  if (!data.token) {
    logger.warn("No device token provided");
    return null;
  }

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

    const safeData = stringifyData({
      type: data.type || "alert",
      id:   String(data.id || ""),
    });

    
    const message = {
      token:data.token,
      notification: { title:data.title, body:data.body },
      data: safeData, 
      android: { priority: "high" },
      apns: {
        payload: {
          aps: { sound: "default", badge: 1 },
        },
      },
    };

    const response = await app.messaging().send(message);
    
    // // ⭐ Add response validation - FCM returns error codes for mismatches
    // if (response.failureCount > 0 || !response.successCount) {
    //   const failedTokens = response.responses?.map(r => r.error?.message).filter(Boolean);
    //   console.error(`FCM failures: ${failedTokens?.join(', ') || 'Unknown'}`);
    //   return null;
    // }
    
    console.log(`Notification sent successfully: ${response}`);
    return response;
  } catch (error) {
    // ⭐ Log specific FCM errors like "MismatchSenderId"
    if (error.code === 'messaging/invalid-argument' || error.message.includes('MismatchSenderId')) {
      console.error(`Sender ID mismatch for token ${token.slice(-10)}...: Verify client/server project match`);
    } else {
      console.error("Notification error", error);
    }
    return null;
  }
};



const sendCallInvite = async (patientFcmToken, callData) => {
  if (!patientFcmToken) {
    logger.warn("No patient FCM token provided");
    return null;
  }

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
    logger.info("Call invitation sent successfully");
    return response;

  } catch (error) {
    logger.error("Call invite error", error);
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
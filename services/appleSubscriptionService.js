import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

/**
 * Apple StoreKit 2 & App Store Server API Service:
 * Manages JWS payload decoding, transaction token inspection, and
 * server-to-server token generation for iOS in-app subscriptions.
 * Designed to support both StoreKit 2 JWS transactions and App Store Server Notifications V2.
 */

/**
 * Safely parses a JWS (JSON Web Signature) string by extracting and decoding its Base64URL payload.
 * Useful for fast decoding of Apple StoreKit 2 client transaction receipts and webhook payloads.
 */
export const decodeAppleJWS = (jwsString) => {
  if (!jwsString || typeof jwsString !== "string") {
    return null;
  }

  const parts = jwsString.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payloadJson);
  } catch (err) {
    // Fallback for standard base64 if base64url padding issue occurs
    try {
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
      return JSON.parse(payloadJson);
    } catch (innerErr) {
      console.error("Failed to decode Apple JWS payload:", innerErr.message);
      return null;
    }
  }
};

/**
 * Reads the Apple StoreKit Private Key (.p8 file) from the configured path.
 * Returns null if the file cannot be accessed or is not yet configured.
 */
export const getApplePrivateKey = () => {
  try {
    const keyPath = process.env.APPLE_PRIVATE_KEY_PATH || "./certs/SubscriptionKey_LWCPYDPKNJ.p8";
    const resolvedPath = path.isAbsolute(keyPath)
      ? keyPath
      : path.join(process.cwd(), keyPath);

    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, "utf8");
    }
    return null;
  } catch (error) {
    console.warn("Apple .p8 private key not found on disk:", error.message);
    return null;
  }
};

/**
 * Generates an App Store Server API Bearer Token (ES256 JWT).
 * Used when querying Apple App Store Server API directly (e.g. Get Transaction History).
 */
export const generateAppleServerToken = () => {
  const privateKey = getApplePrivateKey();
  const keyId = process.env.APPLE_KEY_ID;
  const issuerId = process.env.APPLE_ISSUER_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID;

  if (!privateKey || !keyId || !issuerId || !bundleId) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600, // Valid for 1 hour
    aud: "appstoreconnect-v1",
    bid: bundleId,
  };

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  return jwt.sign(payload, privateKey, { algorithm: "ES256", header });
};

/**
 * Parses and normalizes transaction details from an iOS verification payload or JWS string.
 * Resolves fields across StoreKit 1 receipts and StoreKit 2 signed transaction JWS tokens.
 */
export const parseStoreKitTransaction = (rawReceipt, fallbackBody = {}) => {
  let decodedInfo = null;

  if (typeof rawReceipt === "string" && rawReceipt.includes(".")) {
    decodedInfo = decodeAppleJWS(rawReceipt);
  }

  const transactionId =
    decodedInfo?.transactionId ||
    fallbackBody.transactionId ||
    fallbackBody.orderId ||
    null;

  const originalTransactionId =
    decodedInfo?.originalTransactionId ||
    decodedInfo?.transactionId ||
    fallbackBody.originalTransactionId ||
    transactionId;

  const productId =
    decodedInfo?.productId ||
    fallbackBody.productId ||
    "gradenvy_pro_quarterly";

  const purchaseDate = decodedInfo?.purchaseDate
    ? new Date(Number(decodedInfo.purchaseDate))
    : fallbackBody.transactionDate
      ? new Date(fallbackBody.transactionDate)
      : new Date();

  const expiresDate = decodedInfo?.expiresDate
    ? new Date(Number(decodedInfo.expiresDate))
    : null;

  return {
    transactionId,
    originalTransactionId,
    productId,
    purchaseDate,
    expiresDate,
    rawPayload: decodedInfo || {},
  };
};

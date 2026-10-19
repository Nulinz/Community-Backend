import crypto from "crypto";
import Razorpay from "razorpay";
import EventRegistration from "../../models/eventRegistrationModel.js";
import Payment from "../../models/paymentModel.js";
import Conference from "../../models/conferenceModel.js";
import Competition from "../../models/competitionModel.js";
import Seminar from "../../models/seminarModel.js";
import Event from "../../models/eventModel.js";
import {
  fulfillEventRegistrationPayment,
  expireStalePendingPayments,
} from "../../services/paymentFulfillmentService.js";
import { awardXP, triggerMissionNotification } from "../../services/xpService.js";
import { sendAndSaveNotification } from "../../helper/sendAndSaveNotification.js";

// Indian Standard Time (IST, UTC+05:30) offset in milliseconds (5.5 hours)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getNowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Lazily initialize Razorpay client using environment variables.
 * Returns null if credentials are not present.
 */
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * Fetch the target event/seminar/conference/competition document
 * using the unified model discriminator.
 */
const findEventDoc = async (eventId, eventType) => {
  const selectFields = `
    c_by
    totalSeats
    teamOrIndividualEvent
    teamSizeMinimum
    teamSizeMaximum
    individualFees
    teamFees
    lateFees
    registrationType
  `;

  if (eventType === "Conference") return Conference.findById(eventId).select(selectFields);
  if (eventType === "Competition") return Competition.findById(eventId).select(selectFields);
  if (eventType === "Seminar") return Seminar.findById(eventId).select(selectFields);
  if (eventType === "Event") return Event.findById(eventId).select(selectFields);
  return null;
};

/**
 * Step 1: Pre-Registration Order Creation
 * Validates registration prerequisites (seat availability, team sizing, duplicate checks).
 * If Free: registers user immediately without payment gateway.
 * If Paid: creates a Razorpay order, persists pending payment record with registration
 * payload in metadata, and returns payment credentials for Flutter SDK checkout.
 */
export const createEventRegistrationOrder = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ status: false, message: "Unauthorized user." });
    }

    const {
      eventId,
      eventType,
      fullName,
      department,
      collegeName,
      year,
      phoneNumber,
      mailId,
      type = "Individual",
      teamMembersCount,
      food = "no",
      foodType = null,
      accommodation = "no",
      accommodationType = null,
      amount,
    } = req.body;

    // ── 1. INPUT VALIDATION ──────────────────────────────────────────────────────
    if (!eventId || !eventType || !fullName || !department || !collegeName || !year || !phoneNumber || !mailId) {
      return res.status(400).json({
        status: false,
        message: "eventId, eventType, fullName, department, collegeName, year, phoneNumber, and mailId are required.",
      });
    }

    if (!["Conference", "Competition", "Seminar", "Event"].includes(eventType)) {
      return res.status(400).json({
        status: false,
        message: "eventType must be Conference, Competition, Seminar, or Event.",
      });
    }

    if (!["Team", "Individual"].includes(type)) {
      return res.status(400).json({
        status: false,
        message: "type must be Team or Individual.",
      });
    }

    if (food === "yes" && !foodType) {
      return res.status(400).json({ status: false, message: "foodType is required when food is yes." });
    }

    if (accommodation === "yes" && !accommodationType) {
      return res.status(400).json({ status: false, message: "accommodationType is required when accommodation is yes." });
    }

    // ── 2. FETCH EVENT & VALIDATE AVAILABILITY ──────────────────────────────────
    const eventDoc = await findEventDoc(eventId, eventType);
    if (!eventDoc) {
      return res.status(404).json({ status: false, message: "Event not found." });
    }

    // Check duplicate registration
    const existingReg = await EventRegistration.findOne({ userId, eventId });
    if (existingReg) {
      return res.status(400).json({ status: false, message: "You have already registered for this event." });
    }

    let member_count = 1;
    if (type === "Team") {
      member_count = Number(teamMembersCount);
      if (!member_count || member_count <= 0) {
        return res.status(400).json({ status: false, message: "Valid teamMembersCount is required for Team registration." });
      }

      if (eventDoc.teamSizeMinimum && member_count < eventDoc.teamSizeMinimum) {
        return res.status(400).json({
          status: false,
          message: `Minimum ${eventDoc.teamSizeMinimum} team members required.`,
        });
      }

      if (eventDoc.teamSizeMaximum && member_count > eventDoc.teamSizeMaximum) {
        return res.status(400).json({
          status: false,
          message: `Maximum ${eventDoc.teamSizeMaximum} team members allowed.`,
        });
      }
    }

    // Check available seats
    if (eventDoc.totalSeats) {
      const allRegistrations = await EventRegistration.find({ eventId }).select("member_count").lean();
      const usedSeats = allRegistrations.reduce((sum, item) => sum + (item.member_count || 1), 0);
      const remainingSeats = eventDoc.totalSeats - usedSeats;

      if (member_count > remainingSeats) {
        return res.status(400).json({
          status: false,
          message: `Only ${Math.max(0, remainingSeats)} seats remaining.`,
        });
      }
    }

    // ── 3. HANDLE FREE REGISTRATION INSTANTLY ────────────────────────────────────
    const isPaid = eventDoc.registrationType === "Paid";
    if (!isPaid) {
      const registration = await EventRegistration.create({
        userId,
        eventId,
        eventType,
        fullName,
        department,
        c_by: eventDoc.c_by,
        collegeName,
        year,
        type,
        member_count,
        phoneNumber,
        mailId,
        food: food || "no",
        foodType: food === "yes" ? foodType : null,
        accommodation: accommodation || "no",
        accommodationType: accommodation === "yes" ? accommodationType : null,
      });

      // Notification & XP Gamification
      sendAndSaveNotification({
        senderId: userId,
        receiverId: userId,
        title: "Event Registration Successful",
        message: `You have successfully registered for the ${eventType}.`,
        type: "event_registered",
        reference_id: eventId,
        metadata: { eventType, registrationId: registration._id },
      }).catch((err) => console.error("Notification error:", err?.message));

      triggerMissionNotification(userId, "FIRST_EVENT_REGISTRATION").catch(() => {});
      if (eventType === "Competition") {
        triggerMissionNotification(userId, "FIRST_COMPETITION_REGISTRATION").catch(() => {});
      }

      const regActionKey = eventType === "Competition" ? "FIRST_COMPETITION_REGISTRATION" : "FIRST_EVENT_REGISTRATION";
      awardXP({ userId, actionKey: regActionKey, referenceId: registration._id }).catch(() => {});

      return res.status(200).json({
        status: true,
        isFree: true,
        message: "Registered successfully for free event.",
        data: registration,
      });
    }

    // ── 4. CREATE RAZORPAY ORDER FOR PAID REGISTRATION ──────────────────────────
    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({ status: false, message: "Payment gateway is not configured." });
    }

    // Calculate final fee (preference: explicit parameter, else event pricing)
    let finalAmount = Number(amount);
    if (!finalAmount || finalAmount <= 0) {
      finalAmount = type === "Team"
        ? (Number(eventDoc.teamFees) || Number(eventDoc.individualFees) * member_count || 100)
        : (Number(eventDoc.individualFees) || 100);
    }

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `ev_${userId.toString().slice(-6)}_${Date.now()}`.slice(0, 40),
      notes: {
        type: "EventRegistration",
        eventId: eventId.toString(),
        eventType,
        userId: userId.toString(),
      },
    });

    const nowIST = getNowIST();
    const paymentRecord = await Payment.create({
      userId,
      referenceId: userId, // Placeholder until registration ID is created upon payment confirmation
      referenceType: "EventRegistration",
      eventId,
      eventType,
      c_by: eventDoc.c_by,
      amount: finalAmount,
      currency: "INR",
      paymentStatus: "Pending",
      paymentGateway: "Razorpay",
      orderId: rzpOrder.id,
      remarks: `${eventType} Registration Initiated: ${fullName}`,
      metadata: {
        registrationData: {
          eventId,
          eventType,
          fullName,
          department,
          collegeName,
          year,
          phoneNumber,
          mailId,
          type,
          member_count,
          food,
          foodType,
          accommodation,
          accommodationType,
          c_by: eventDoc.c_by,
        },
      },
      paymentDate: nowIST,
      createdAt: nowIST,
      updatedAt: nowIST,
    });

    return res.status(200).json({
      status: true,
      isFree: false,
      message: "Payment order created successfully.",
      data: {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentRecordId: paymentRecord._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 2: Instant Client-Side Payment Verification Callback
 * Called by Flutter mobile app when Razorpay checkout returns success credentials.
 * Cryptographically verifies signature and fulfills registration idempotently.
 */
export const verifyEventRegistrationPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
      paymentId,
      signature,
      amount,
    } = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ status: false, message: "Unauthorized user." });
    }

    const actualOrderId = razorpay_order_id || orderId;
    const actualPaymentId = razorpay_payment_id || paymentId;
    const actualSignature = razorpay_signature || signature;

    if (!actualOrderId) {
      return res.status(400).json({ status: false, message: "Missing razorpay order identifier." });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (keySecret && actualPaymentId && actualSignature) {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${actualOrderId}|${actualPaymentId}`)
        .digest("hex");

      if (generatedSignature !== actualSignature) {
        return res.status(400).json({
          status: false,
          message: "Payment verification failed: cryptographic signature mismatch.",
        });
      }
    }

    const fulfillmentResult = await fulfillEventRegistrationPayment({
      orderId: actualOrderId,
      paymentId: actualPaymentId,
      signature: actualSignature,
      userId,
      amount,
    });

    return res.status(200).json({
      status: true,
      message: "Event registration and payment verified successfully.",
      data: fulfillmentResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 3: Self-Healing Payment Status Polling
 * Polled by mobile app if connection drops during checkout callback.
 * Queries Razorpay directly to resolve stuck pending orders without duplicate charges.
 */
export const checkEventRegistrationPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;

    if (!orderId) {
      return res.status(400).json({ status: false, message: "Order ID is required." });
    }

    // Auto-expire pending orders older than 5 minutes
    await expireStalePendingPayments(userId);

    const paymentRecord = await Payment.findOne({ orderId }).lean();
    if (!paymentRecord) {
      return res.status(404).json({ status: false, message: "Payment order record not found." });
    }

    if (paymentRecord.paymentStatus === "Success") {
      const registration = await EventRegistration.findById(paymentRecord.referenceId).lean();
      return res.status(200).json({
        status: true,
        paymentStatus: "Success",
        data: { payment: paymentRecord, registration },
      });
    }

    // Reconcile pending status against Razorpay API
    const razorpay = getRazorpayInstance();
    if (razorpay && paymentRecord.paymentStatus === "Pending") {
      try {
        const rzpPayments = await razorpay.orders.fetchPayments(orderId);
        const capturedPayment = rzpPayments?.items?.find((p) => p.status === "captured");

        if (capturedPayment) {
          const fulfillmentResult = await fulfillEventRegistrationPayment({
            orderId,
            paymentId: capturedPayment.id,
            userId: paymentRecord.userId || userId,
            amount: capturedPayment.amount / 100,
          });

          return res.status(200).json({
            status: true,
            paymentStatus: "Success",
            message: "Payment reconciled and fulfilled successfully.",
            data: fulfillmentResult,
          });
        }
      } catch (rzpErr) {
        console.warn("Direct Razorpay order reconciliation check failed:", rzpErr?.message);
      }
    }

    return res.status(200).json({
      status: true,
      paymentStatus: paymentRecord.paymentStatus,
      data: { payment: paymentRecord },
    });
  } catch (error) {
    next(error);
  }
};

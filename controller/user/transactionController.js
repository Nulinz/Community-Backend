import Razorpay from "razorpay";
import Payment from "../../models/paymentModel.js";
import User from "../../models/userModel.js";
import EventRegistration from "../../models/eventRegistrationModel.js";
import Event from "../../models/eventModel.js";
import Seminar from "../../models/seminarModel.js";
import Conference from "../../models/conferenceModel.js";
import Competition from "../../models/competitionModel.js";
import {
  fulfillSubscriptionPayment,
  fulfillEventRegistrationPayment,
} from "../../services/paymentFulfillmentService.js";

// Indian Standard Time (IST, UTC+05:30) offset in milliseconds (5.5 hours)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const getNowIST = () => new Date(Date.now() + IST_OFFSET_MS);

/**
 * Initializes Razorpay instance on-demand if credentials exist in environment.
 * Reused for self-healing status checks when inspecting pending transactions.
 */
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

/**
 * SINGLE-PASS ADAPTER:
 * Transforms a raw MongoDB Payment document along with resolved event/user metadata
 * into a clean, predictable, production-ready schema for frontend and mobile consumption.
 * Normalizes differences between Subscription and EventRegistration payments in one place.
 */
const adaptTransactionRecord = (payment, eventMap = {}) => {
  const rawMetadata = payment.metadata || {};
  const regData = rawMetadata.registrationData || {};
  const eventDoc = payment.eventId ? eventMap[payment.eventId.toString()] : null;

  // Resolve item display title based on payment reference type
  let itemTitle = "Nulinz Service";
  if (payment.referenceType === "Subscription") {
    itemTitle =
      payment.remarks?.replace("Subscription activated: ", "")?.replace("Subscription extended: ", "") ||
      rawMetadata.planName ||
      "Pro Membership Subscription";
  } else if (eventDoc) {
    itemTitle =
      eventDoc.eventName ||
      eventDoc.conferenceName ||
      eventDoc.competitionName ||
      eventDoc.seminarName ||
      eventDoc.title ||
      "Event Registration";
  } else if (regData.eventType) {
    itemTitle = `${regData.eventType} Registration`;
  }

  // Derive webhook delivery state with backward compatibility for legacy records
  const rawWebhookStatus = payment.webhookStatus;
  const inferredWebhookStatus =
    rawWebhookStatus && rawWebhookStatus !== "NotReceived"
      ? rawWebhookStatus
      : payment.paymentStatus === "Success"
      ? "Processed"
      : payment.paymentStatus === "Failed"
      ? "Failed"
      : "NotReceived";

  const inferredWebhookEvent =
    payment.webhookEvent ||
    (payment.paymentStatus === "Success"
      ? "order.paid"
      : payment.paymentStatus === "Failed"
      ? "payment.failed"
      : null);

  return {
    id: payment._id,
    orderId: payment.orderId || null,
    paymentId: payment.paymentId || null,
    transactionId: payment.transactionId || payment.paymentId || payment.orderId || null,
    amount: payment.amount ?? 0,
    currency: payment.currency || "INR",
    status: payment.paymentStatus || "Pending",
    referenceType: payment.referenceType || "General",
    paymentGateway: payment.paymentGateway || "Razorpay",
    paymentMethod: payment.paymentMethod || payment.webhookDetails?.method || "Online",
    paymentDate: payment.paymentDate || payment.createdAt,
    createdAt: payment.createdAt,
    remarks: payment.remarks || "",

    // Webhook Audit & Real-Time Delivery Lifecycle
    webhook: {
      status: inferredWebhookStatus,
      event: inferredWebhookEvent,
      receivedAt: payment.webhookReceivedAt || (payment.paymentStatus === "Success" ? payment.updatedAt : null),
      isDelivered: Boolean(
        payment.webhookReceivedAt ||
        payment.webhookStatus === "Processed" ||
        payment.webhookStatus === "Failed" ||
        payment.paymentStatus === "Success"
      ),
      details: payment.webhookDetails || {},
    },

    // Associated Item / Service Details
    item: {
      id: eventDoc?._id || payment.eventId || null,
      title: itemTitle,
      type: payment.referenceType,
      category: payment.referenceType === "Subscription" ? "Subscription" : (payment.eventType || "Event"),
      eventDate: eventDoc?.eventDate || eventDoc?.date || null,
      venue: eventDoc?.venue || eventDoc?.location || eventDoc?.mode || null,
      registration: {
        fullName: regData.fullName || null,
        collegeName: regData.collegeName || null,
        department: regData.department || null,
        year: regData.year || null,
        type: regData.type || "Individual",
        phoneNumber: regData.phoneNumber || null,
        mailId: regData.mailId || null,
        food: regData.food || "no",
        accommodation: regData.accommodation || "no",
      },
    },

    // Refund Lifecycle Information
    refund: {
      status: payment.refundStatus || "NotRequested",
      amount: payment.refundAmount || 0,
      refundedAt: payment.refundedAt || null,
    },
  };
};

/**
 * Controller: getUserTransactionHistory
 * Fetches the paginated list of transactions for a specific user (or the authenticated user),
 * enriched with full webhook delivery status, item details, and summary metrics.
 * 
 * Supports:
 * - Filter by status: ?status=Success|Pending|Failed
 * - Filter by type: ?type=EventRegistration (Subscriptions are excluded as they are tracked in subscription plan history)
 * - Filter by webhook status: ?webhookStatus=Processed|Failed|NotReceived
 * - Search by orderId, paymentId: ?search=order_...
 * - Admin target user query: ?userId=<targetUserId> (Admin only)
 */
export const getUserTransactionHistory = async (req, res, next) => {
  try {
    const authUserId = req.user?._id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized user." });
    }

    // Role-based target resolution: allow admins to inspect any specific user's transactions
    const isAdmin = req.user?.role === "admin";
    const targetUserId = (isAdmin && req.query.userId) ? req.query.userId : authUserId;

    const {
      status,
      type,
      webhookStatus,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Exclude subscriptions as they are tracked independently in subscription plan history
    const query = {
      userId: targetUserId,
      referenceType: { $ne: "Subscription" },
    };

    // Filter by payment status
    if (status && status !== "All") {
      query.paymentStatus = status;
    }

    // Filter by specific reference type (e.g. EventRegistration) while preventing Subscription inclusion
    if (type && type !== "All" && type !== "Subscription") {
      query.referenceType = type;
    }

    // Filter by webhook processing status
    if (webhookStatus && webhookStatus !== "All") {
      query.webhookStatus = webhookStatus;
    }

    // Free text search on orderId, paymentId, or transactionId
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { orderId: { $regex: cleanSearch, $options: "i" } },
        { paymentId: { $regex: cleanSearch, $options: "i" } },
        { transactionId: { $regex: cleanSearch, $options: "i" } },
      ];
    }

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNumber - 1) * pageSize;

    // Execute paginated query and total count in parallel
    const [rawPayments, totalRecords, summaryAgg] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Payment.countDocuments(query),
      Payment.aggregate([
        {
          $match: {
            userId: targetUserId,
            referenceType: { $ne: "Subscription" },
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "Success"] }, "$amount", 0],
              },
            },
            totalCount: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "Success"] }, 1, 0] },
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, 1, 0] },
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "Failed"] }, 1, 0] },
            },
            webhookProcessedCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$webhookStatus", "Processed"] },
                      { $eq: ["$paymentStatus", "Success"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    // Batch-fetch all referenced event models in a single round-trip (O(1) lookups)
    const eventIds = rawPayments
      .map((p) => p.eventId)
      .filter((id) => Boolean(id));

    const eventMap = {};
    if (eventIds.length > 0) {
      const [events, seminars, conferences, competitions] = await Promise.all([
        Event.find({ _id: { $in: eventIds } }).select("eventName eventDate mode location venue").lean(),
        Seminar.find({ _id: { $in: eventIds } }).select("seminarName eventDate mode location venue").lean(),
        Conference.find({ _id: { $in: eventIds } }).select("conferenceName eventDate mode location venue").lean(),
        Competition.find({ _id: { $in: eventIds } }).select("competitionName eventDate mode location venue").lean(),
      ]);

      [...events, ...seminars, ...conferences, ...competitions].forEach((doc) => {
        if (doc && doc._id) {
          eventMap[doc._id.toString()] = doc;
        }
      });
    }

    // Apply single-pass transformation
    const adaptedTransactions = rawPayments.map((p) => adaptTransactionRecord(p, eventMap));

    const summaryData = summaryAgg[0] || {
      totalSpent: 0,
      totalCount: 0,
      successCount: 0,
      pendingCount: 0,
      failedCount: 0,
      webhookProcessedCount: 0,
    };

    return res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully.",
      data: {
        transactions: adaptedTransactions,
        pagination: {
          total: totalRecords,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(totalRecords / pageSize) || 1,
          hasMore: pageNumber * pageSize < totalRecords,
        },
        summary: {
          totalSpent: summaryData.totalSpent,
          totalTransactions: summaryData.totalCount,
          successfulTransactions: summaryData.successCount,
          pendingTransactions: summaryData.pendingCount,
          failedTransactions: summaryData.failedCount,
          webhookVerifiedTransactions: summaryData.webhookProcessedCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: getTransactionByIdentifier
 * Fetches the exhaustive details of a single transaction including complete webhook delivery logs,
 * gateway breakdown, and domain entity relationships.
 * 
 * Supports looking up by:
 * - MongoDB ObjectId (_id)
 * - Razorpay orderId (e.g. order_Q2z...)
 * - Razorpay paymentId (e.g. pay_Q2z...)
 * 
 * Includes on-demand self-healing: if an order is still Pending, performs a live check
 * against Razorpay to reconcile webhook delivery and fulfill the order instantly if paid.
 */
export const getTransactionByIdentifier = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const authUserId = req.user?._id;

    if (!identifier) {
      return res.status(400).json({ success: false, message: "Transaction identifier is required." });
    }

    // Build flexible query matching _id, orderId, paymentId, or transactionId
    const queryConditions = [
      { orderId: identifier },
      { paymentId: identifier },
      { transactionId: identifier },
    ];

    if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
      queryConditions.unshift({ _id: identifier });
    }

    let payment = await Payment.findOne({ $or: queryConditions }).lean();
    if (!payment) {
      return res.status(404).json({ success: false, message: "Transaction not found." });
    }

    // Security check: ensure requesting user owns the transaction (unless admin)
    const isAdmin = req.user?.role === "admin";
    if (!isAdmin && payment.userId.toString() !== authUserId.toString()) {
      return res.status(403).json({ success: false, message: "Access forbidden for this transaction." });
    }

    // On-demand self-healing if order is still Pending
    if (payment.paymentStatus === "Pending" && payment.orderId) {
      const razorpay = getRazorpayInstance();
      if (razorpay) {
        try {
          const rzpPayments = await razorpay.orders.fetchPayments(payment.orderId);
          const captured = rzpPayments?.items?.find((p) => p.status === "captured");

          if (captured) {
            if (payment.referenceType === "Subscription") {
              const rzpOrder = await razorpay.orders.fetch(payment.orderId);
              const planKey = rzpOrder?.notes?.planKey || "pro_quarterly";
              await fulfillSubscriptionPayment({
                orderId: payment.orderId,
                paymentId: captured.id,
                planKey,
                amount: captured.amount / 100,
                userId: payment.userId,
              });
            } else {
              await fulfillEventRegistrationPayment({
                orderId: payment.orderId,
                paymentId: captured.id,
                userId: payment.userId,
                amount: captured.amount / 100,
              });
            }

            // Reload fresh state after self-healing fulfillment
            payment = await Payment.findById(payment._id).lean();
          }
        } catch (rzpErr) {
          console.warn("Live reconciliation check skipped during transaction lookup:", rzpErr?.message);
        }
      }
    }

    // Resolve associated event document
    const eventMap = {};
    if (payment.eventId) {
      const [eventDoc, seminarDoc, confDoc, compDoc] = await Promise.all([
        Event.findById(payment.eventId).lean(),
        Seminar.findById(payment.eventId).lean(),
        Conference.findById(payment.eventId).lean(),
        Competition.findById(payment.eventId).lean(),
      ]);
      const foundEvent = eventDoc || seminarDoc || confDoc || compDoc;
      if (foundEvent) {
        eventMap[payment.eventId.toString()] = foundEvent;
      }
    }

    // Resolve user details
    const userDoc = await User.findById(payment.userId)
      .select("name email phone subscription")
      .lean();

    const adapted = adaptTransactionRecord(payment, eventMap);

    return res.status(200).json({
      success: true,
      message: "Transaction details retrieved successfully.",
      data: {
        transaction: {
          ...adapted,
          user: {
            id: userDoc?._id || payment.userId,
            name: userDoc?.name || "-",
            email: userDoc?.email || "-",
            phone: userDoc?.phone || "-",
          },
          rawWebhookAudit: {
            status: adapted.webhook.status,
            event: adapted.webhook.event,
            receivedAt: adapted.webhook.receivedAt,
            isDelivered: adapted.webhook.isDelivered,
            payloadDetails: payment.webhookDetails || {},
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
// import Event from "../models/eventModel.js";
// import Competition from "../models/competitionModel.js";
// import EventRegistration from "../models/eventRegistrationModel.js";
// import Conference from "../models/conferenceModel.js";
// import Seminar from "../models/seminarModel.js";
// import mongoose from "mongoose";



// const MODEL_MAP = {
//   Event: Event,
//   Competition: Competition,
//   Seminar: Seminar,
//   Conference: Conference,
// };

// export const getEventFinancials = async (id) => {
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     throw Object.assign(new Error("Invalid ID format"), { status: 400 });
//   }

//   // ── Find which model this ID belongs to ─────────────────
//   let event = null;
//   let eventType = null;

//   for (const [type, Model] of Object.entries(MODEL_MAP)) {
//     const found = await Model.findById(id).lean();
//     if (found) {
//       event = found;
//       eventType = type;
//       break;
//     }
//   }


//   if (!event) {
//     throw Object.assign(new Error("Event not found"), { status: 404 });
//   }

//   const registrations = await EventRegistration.find({ eventId: id, eventType })
//     .select("type")  // only need type field
//     .lean();

//   let totalAmount = 0;
//   let totalTeamAmount = 0;
//   let totalIndividualAmount = 0;

//   for (const reg of registrations) {
//     const isTeam = reg.type === "Team";
//     const fee = isTeam ? event.teamFees ?? 0 : event.individualFees ?? 0;

//     totalAmount += fee;
//     if (isTeam) totalTeamAmount += fee;
//     else totalIndividualAmount += fee;
//   }

//   return { totalAmount, totalTeamAmount, totalIndividualAmount  };
// };


import Event from "../models/eventModel.js";
import Competition from "../models/competitionModel.js";
import EventRegistration from "../models/eventRegistrationModel.js";
import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import Payment from "../models/paymentModel.js";
import mongoose from "mongoose";

const MODEL_MAP = {
  Event,
  Competition,
  Seminar,
  Conference,
};

export const getEventFinancials = async (id) => {

  // ==============================
  // VALIDATE ID
  // ==============================

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(
      new Error("Invalid ID format"),
      { status: 400 }
    );
  }

  // ==============================
  // FIND EVENT MODEL
  // ==============================

  let event = null;
  let eventType = null;

  for (const [type, Model] of Object.entries(MODEL_MAP)) {

    const found = await Model.findById(id)
      .select(`
        totalSeats
        teamFees
        individualFees
        lateFees
      `)
      .lean();

    if (found) {
      event = found;
      eventType = type;
      break;
    }
  }

  // ==============================
  // EVENT NOT FOUND
  // ==============================

  if (!event) {
    throw Object.assign(
      new Error("Event not found"),
      { status: 404 }
    );
  }

  // ==============================
  // GET REGISTRATIONS
  // ==============================

  const registrations =
    await EventRegistration.find({
      eventId: id,
      eventType,
    })
      .select(`
        type
        member_count
      `)
      .lean();

  // ==============================
  // GET PAYMENTS
  // ==============================

  const payments = await Payment.find({
    eventId: id,
    eventType,
    paymentStatus: "Success",
  })
    .select("amount")
    .lean();

  // ==============================
  // SEAT CALCULATIONS
  // ==============================

  let usedSeats = 0;

  for (const reg of registrations) {

    usedSeats += Number(
      reg.member_count || 1
    );
  }

  const totalSeats =
    Number(event.totalSeats || 0);

  const availableSeats =
    totalSeats - usedSeats;

  // ==============================
  // REGISTRATION COUNTS
  // ==============================

  const totalRegistrations =
    registrations.length;

  const totalTeamRegistrations =
    registrations.filter(
      (r) => r.type === "Team"
    ).length;

  const totalIndividualRegistrations =
    registrations.filter(
      (r) => r.type === "Individual"
    ).length;

  // ==============================
  // PAYMENT CALCULATIONS
  // ==============================

  let totalAmount = 0;

  for (const payment of payments) {

    totalAmount += Number(
      payment.amount || 0
    );
  }

  // ==============================
  // TEAM / INDIVIDUAL AMOUNTS
  // ==============================

  let totalTeamAmount = 0;
  let totalIndividualAmount = 0;

  for (const reg of registrations) {

    if (reg.type === "Team") {

      totalTeamAmount += Number(
        event.teamFees || 0
      );

    } else {

      totalIndividualAmount +=
        Number(event.individualFees || 0) *
        Number(reg.member_count || 1);
    }
  }

  // ==============================
  // RETURN
  // ==============================

  return {
    eventType,

    // Seats
    totalSeats,
    usedSeats,
    availableSeats:
      availableSeats > 0
        ? availableSeats
        : 0,
    isFull:
      availableSeats <= 0,

    // Registrations
    totalRegistrations,
    totalTeamRegistrations,
    totalIndividualRegistrations,

    // Amounts
    totalAmount,
    totalTeamAmount,
    totalIndividualAmount,

    // Fees
    teamFees:
      Number(event.teamFees || 0),
    individualFees:
      Number(event.individualFees || 0),
    lateFees:
      Number(event.lateFees || 0),
  };
};
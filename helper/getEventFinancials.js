import Event from "../models/eventModel.js";
import Competition from "../models/competitionModel.js";
import EventRegistration from "../models/eventRegistrationModel.js";
import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import mongoose from "mongoose";



const MODEL_MAP = {
  Event: Event,
  Competition: Competition,
  Seminar: Seminar,
  Conference: Conference,
};

export const getEventFinancials = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error("Invalid ID format"), { status: 400 });
  }

  // ── Find which model this ID belongs to ─────────────────
  let event = null;
  let eventType = null;

  for (const [type, Model] of Object.entries(MODEL_MAP)) {
    const found = await Model.findById(id).lean();
    if (found) {
      event = found;
      eventType = type;
      break;
    }
  }


  if (!event) {
    throw Object.assign(new Error("Event not found"), { status: 404 });
  }

  const registrations = await EventRegistration.find({ eventId: id, eventType })
    .select("type")  // only need type field
    .lean();

  let totalAmount = 0;
  let totalTeamAmount = 0;
  let totalIndividualAmount = 0;

  for (const reg of registrations) {
    const isTeam = reg.type === "Team";
    const fee = isTeam ? event.teamFees ?? 0 : event.individualFees ?? 0;

    totalAmount += fee;
    if (isTeam) totalTeamAmount += fee;
    else totalIndividualAmount += fee;
  }

  return { totalAmount, totalTeamAmount, totalIndividualAmount };
};
import EventRegistration from "../models/eventRegistrationModel.js";
import Competition from "../models/competitionModel.js";
import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import Event from "../models/eventModel.js";

const eventModels = {
  competition: Competition,
  conference: Conference,
  seminar: Seminar,
  event: Event,
};


export const getSeatAvailability = async ({
  eventType,
  eventId,
}) => {
  try {
    // ==============================
    // VALIDATE EVENT TYPE
    // ==============================

    const Model = eventModels[eventType];

    if (!Model) {
      return {
        status: false,
        message: "Invalid event type",
      };
    }

    // ==============================
    // GET EVENT
    // ==============================

    const eventData = await Model.findById(eventId)
      .select("totalSeats");

    if (!eventData) {
      return {
        status: false,
        message: "Event not found",
      };
    }

    // ==============================
    // GET USED SEATS
    // ==============================

    const registrations =
      await EventRegistration.find({
        eventId,
      }).select("member_count");

    const usedSeats = registrations.reduce(
      (sum, item) =>
        sum + (item.member_count || 1),
      0
    );

    // ==============================
    // CALCULATE REMAINING SEATS
    // ==============================

    const totalSeats =
      Number(eventData.totalSeats || 0);

    const availableSeats =
      totalSeats - usedSeats;

    return {
      status: true,

        totalSeats,
        usedSeats,
        availableSeats:
          availableSeats > 0
            ? availableSeats
            : 0,
        isFull:
          availableSeats <= 0,
      
    };

  } catch (error) {

    console.error(
      "getSeatAvailability Error:",
      error.message
    );

    return {
      status: false,
      message:
        "Failed to fetch seat availability",
      error: error.message,
    };
  }
};
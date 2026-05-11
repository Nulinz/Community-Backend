import Competition from "../models/competitionModel.js";
import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import Event from "../models/eventModel.js";
import College from "../models/collegeModel.js";

const eventModels = {
  competition: Competition,
  conference: Conference,
  seminar: Seminar,
  event: Event,
};

export const getCollegeByEventId = async ({
  eventType,
  eventId,
}) => {
  try {
    // Find model dynamically
    console.log()
    const Model = eventModels[eventType?.toLowerCase()];
    
    if (!Model) {
      return {
        status: false,
        message: "Invalid event type",
      };
    }

const eventData = await Model.findById(eventId)
  .populate("c_by", "name role email phone")
  .select("c_by");

if (!eventData || !eventData.c_by) {
  return {
    status: false,
    message: `${eventType} not found`,
  };
}

console.log(eventData)

let collegeData = null;

// If creator is admin
if (eventData.c_by.role === "admin") {

  collegeData = {
    name: "Community",
    role: "admin",
    email:eventData?.c_by?.email,
    phone:eventData?.c_by?.phone,
    userId: eventData.c_by._id,
  };

} else {

  // Find college using userId
  collegeData = await College.findOne({
    userId: eventData.c_by._id,
  });

  if (!collegeData) {
    return {
      status: false,
      message: "College not found",
    };
  }
}

return {
  status: true,
  data: collegeData,
};

  } catch (error) {
    console.error("getCollegeByEventId Error:", error.message);

    return {
      status: false,
      message: "Failed to fetch college data",
      error: error.message,
    };
  }
};
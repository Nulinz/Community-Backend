import Event from "../models/eventModel.js";
import Internship from "../models/internshipModel.js";


import Freelance from "../models/freelanceModel.js";


import Competition from "../models/competitionModel.js";



import Conference from "../models/conferenceModel.js";
import Seminar from "../models/seminarModel.js";
import mongoose from "mongoose";
export const migrateStatusField = async () => {
  try {
    const models = [
      { name: "Competition", model: Competition },
      { name: "Conference",  model: Conference  },
      { name: "Event",       model: Event       },
      { name: "Seminar",     model: Seminar     },
      { name: "Internship",  model: Internship  },
      { name: "Freelance",   model: Freelance   },
    ];

    for (const { name, model } of models) {
      const result = await model.updateMany(
        { status:"pending" }, 
        { $set: { status: "approved" } }
      );
      console.log(`✅ ${name}: ${result.modifiedCount} documents updated`);
    }

    console.log("🎉 Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
};
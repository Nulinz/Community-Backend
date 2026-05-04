import mongoose from "mongoose";
import Location from "../models/locationModel.js";

const tamilNaduCities = [
  "Chennai",
  "Coimbatore",
  "Madurai",
  "Tiruchirappalli",
  "Salem",
  "Tirunelveli",
  "Erode",
  "Vellore",
  "Thoothukudi",
  "Dindigul",
  "Thanjavur",
  "Ranipet",
  "Sivakasi",
  "Karur",
  "Udhagamandalam",
  "Hosur",
  "Nagercoil",
  "Kanchipuram",
  "Kumbakonam",
  "Cuddalore",
  "Tiruppur",
  "Krishnagiri",
  "Dharmapuri",
  "Nagapattinam",
  "Ramanathapuram",
  "Virudhunagar",
  "Sivaganga",
  "Namakkal",
  "Perambalur",
  "Ariyalur",
  "Villupuram",
  "Kallakurichi",
  "Tiruvannamalai",
  "Pudukkottai",
  "Theni",
  "Tiruvarur",
  "Mayiladuthurai",
  "Chengalpattu",
  "Tenkasi",
  "Tirupattur",
];

export const seedTamilNaduLocations = async () => {
  try {
    const locations = tamilNaduCities.map((city) => ({
      state: "Tamil Nadu",
      city,
    }));

    // insertMany with ordered:false skips duplicates and continues
    await Location.insertMany(locations, { ordered: false });

    console.log(`✅ Tamil Nadu cities seeded successfully (${tamilNaduCities.length} cities)`);
  } catch (error) {
    if (error.code === 11000) {
      console.log("⚠️  Some cities already exist — skipped duplicates");
    } else {
      console.error("❌ Seeder Error:", error.message);
    }
  }
};
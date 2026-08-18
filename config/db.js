import mongoose from "mongoose";
import { dropStaleXPLogUniqueIndexes } from "../models/xpLogModel.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
    await dropStaleXPLogUniqueIndexes();
  } catch (error) {
    // console.error("❌ DB Error:", error.message);
    console.error("❌ DB Error:", error);
    process.exit(1);
  }
};

export default connectDB;
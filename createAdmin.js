import dotenv from "dotenv";
dotenv.config();


import mongoose from "mongoose"
import User from "./models/userModel.js"



const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database connected");

        const existingAdmin = await User.findOne({
            $or: [
                { email: "ravi@gmail.com" },
                { phone: "9000000005", }
            ],
        });

        if (existingAdmin) {
            console.log("admin already exists");
            process.exit(0);
        }


        await User.create({
            email: "ravi@gmail.com",
            phone: "9000000005",
            name: "ravi",
            password: "12345678",
            role: "admin",
        });


        console.log("👑admin created successfully");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
};



createAdmin();
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const conferenceSchema = new mongoose.Schema({}, { strict: false });
const Conference = mongoose.model('Conference', conferenceSchema, 'conferences');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await Conference.countDocuments();
        const activeCount = await Conference.countDocuments({ isActive: true });
        console.log(`Total Conferences: ${count}`);
        console.log(`Active Conferences: ${activeCount}`);
        const all = await Conference.find().limit(2);
        console.log('Sample data:', JSON.stringify(all, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();

import mongoose from "mongoose";

const MONGO_URL = "mongodb+srv://nulinzCommunity:nulinzCommunity_2026@cluster0.btu0p2l.mongodb.net/?appName=Cluster0";

async function clearDatabase() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to MongoDB");

    const collections = await mongoose.connection.db.collections();

    for (let collection of collections) {
      await collection.deleteMany({});
      console.log(`Cleared: ${collection.collectionName}`);
    }

    console.log("All data removed (collections kept)");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

clearDatabase();
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  const mongoDbName = process.env.MONGO_DB_NAME;

  if (!mongoUri) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: mongoDbName,
    });
    console.log("MongoDB Connected");
  } catch (error: any) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
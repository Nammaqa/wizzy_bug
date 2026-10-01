import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User';
import Project from './src/models/Project';

dotenv.config();

const hash = async (plain: string) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected to MongoDB');

    if (process.env.ENABLE_DEMO_SEED !== 'true') {
      console.log('Demo seeding is disabled (set ENABLE_DEMO_SEED=true to enable).');
      process.exit(0);
    }

    console.log('Demo seeding is no longer configured. This seed script does not create mock users or projects.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();

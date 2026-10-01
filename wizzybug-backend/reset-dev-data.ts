import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User';
import Project from './src/models/Project';
import Ticket from './src/models/Ticket';

dotenv.config();

const resetDevData = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in the environment');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await Project.deleteMany({});
    await Ticket.deleteMany({});

    console.log('Cleared users, projects, and tickets. The app is now reset for a fresh signup flow.');
  } catch (err) {
    console.error('Reset failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

resetDevData();

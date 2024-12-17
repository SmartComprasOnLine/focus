require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const Routine = require('../models/Routine');

async function clearDatabase() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected. Clearing database...');

        // Find and delete test user
        const user = await User.findOne({ whatsappNumber: '5581999725668' });
        if (user) {
            // Delete associated routines
            await Routine.deleteMany({ userId: user._id });
            await user.deleteOne();
            console.log('Cleared user Diego Santana and their routines');
        }

        console.log('Database cleared successfully');
    } catch (error) {
        console.error('Error clearing database:', error);
    } finally {
        await disconnectDB();
        console.log('Database connection closed');
    }
}

clearDatabase();

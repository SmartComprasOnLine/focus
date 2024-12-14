const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestUserEndingTrial() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Create date for trial ending tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        // Create date for trial starting 6 days ago
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
        sixDaysAgo.setHours(0, 0, 0, 0);

        const user = await User.create({
            name: 'Diego Santana',
            whatsappNumber: '5581999725668',
            subscription: {
                status: 'em_teste',
                trialStartDate: sixDaysAgo,
                trialEndDate: tomorrow
            },
            interactionHistory: [
                {
                    type: 'text',
                    content: 'Olá! Preciso de ajuda para organizar minha rotina.',
                    role: 'user',
                    timestamp: sixDaysAgo
                }
            ]
        });

        console.log('Test user created:', {
            name: user.name,
            whatsappNumber: user.whatsappNumber,
            trialStartDate: user.subscription.trialStartDate,
            trialEndDate: user.subscription.trialEndDate,
            daysRemaining: Math.ceil((user.subscription.trialEndDate - new Date()) / (1000 * 60 * 60 * 24))
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

createTestUserEndingTrial();

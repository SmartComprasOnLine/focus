const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUserSubscription() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const user = await User.findOne({ whatsappNumber: '5581999725668' });
        
        if (!user) {
            console.log('User not found');
            return;
        }

        console.log('User Subscription Status:', {
            name: user.name,
            whatsappNumber: user.whatsappNumber,
            subscription: {
                status: user.subscription.status,
                plan: user.subscription.plan,
                startDate: user.subscription.startDate,
                endDate: user.subscription.endDate,
                trialStartDate: user.subscription.trialStartDate,
                trialEndDate: user.subscription.trialEndDate,
                pendingPayment: user.subscription.pendingPayment
            },
            hasAccess: user.hasAccess()
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error checking user subscription:', error);
        process.exit(1);
    }
}

checkUserSubscription();

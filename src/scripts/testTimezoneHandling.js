const mongoose = require('mongoose');
const User = require('../models/User');
const timezoneService = require('../services/timezoneService');
require('dotenv').config();

async function testTimezoneHandling() {
    try {
        console.log('Current timezone:', process.env.TIMEZONE);
        
        const now = timezoneService.getCurrentTime();
        console.log('\nCurrent time in timezone:', timezoneService.formatDate(now));

        // Test trial period calculations
        const trialStart = timezoneService.startOfDay(timezoneService.addDays(now, -6));
        const trialEnd = timezoneService.endOfDay(timezoneService.addDays(now, 1));

        console.log('\nTrial Period:');
        console.log('Start:', timezoneService.formatDate(trialStart));
        console.log('End:', timezoneService.formatDate(trialEnd));
        console.log('Days Remaining:', timezoneService.getDaysBetween(now, trialEnd));

        // Test subscription period calculations
        const subscriptionStart = timezoneService.getCurrentTime();
        const monthlyEnd = timezoneService.addMonths(subscriptionStart, 1);
        const yearlyEnd = timezoneService.addYears(subscriptionStart, 1);

        console.log('\nSubscription Periods:');
        console.log('Monthly Plan:');
        console.log('Start:', timezoneService.formatDate(subscriptionStart));
        console.log('End:', timezoneService.formatDate(monthlyEnd));
        
        console.log('\nYearly Plan:');
        console.log('Start:', timezoneService.formatDate(subscriptionStart));
        console.log('End:', timezoneService.formatDate(yearlyEnd));

        // Test user creation with timezone
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Clear existing test user
        await User.deleteOne({ whatsappNumber: '5581999725668' });

        // Create new test user
        const user = await User.create({
            name: 'Diego Santana',
            whatsappNumber: '5581999725668',
            subscription: {
                status: 'em_teste',
                trialStartDate: trialStart,
                trialEndDate: trialEnd
            },
            interactionHistory: [
                {
                    type: 'text',
                    content: 'Olá! Preciso de ajuda para organizar minha rotina.',
                    role: 'user',
                    timestamp: trialStart
                }
            ]
        });

        console.log('\nTest User Created:');
        console.log('Name:', user.name);
        console.log('WhatsApp:', user.whatsappNumber);
        console.log('Trial Start:', timezoneService.formatDate(user.subscription.trialStartDate));
        console.log('Trial End:', timezoneService.formatDate(user.subscription.trialEndDate));
        console.log('Days Remaining:', timezoneService.getDaysBetween(now, user.subscription.trialEndDate));

        // Test subscription activation
        user.subscription = {
            status: 'ativa',
            plan: 'anual',
            startDate: subscriptionStart,
            endDate: yearlyEnd,
            paymentId: 'pi_' + Date.now()
        };

        await user.save();

        console.log('\nSubscription Activated:');
        console.log('Status:', user.subscription.status);
        console.log('Plan:', user.subscription.plan);
        console.log('Start:', timezoneService.formatDate(user.subscription.startDate));
        console.log('End:', timezoneService.formatDate(user.subscription.endDate));

        await mongoose.disconnect();
        console.log('\nTest completed successfully!');

    } catch (error) {
        console.error('Error during timezone test:', error);
        process.exit(1);
    }
}

testTimezoneHandling();

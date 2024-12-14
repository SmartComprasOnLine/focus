const mongoose = require('mongoose');
const User = require('../models/User');
const Routine = require('../models/Routine');
const routineController = require('../controllers/routineController');
const timezoneService = require('../services/timezoneService');
require('dotenv').config();

async function testPlanCreation() {
    try {
        console.log('Starting plan creation test...\n');

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Clear existing test user
        await User.deleteOne({ whatsappNumber: '5581999725668' });
        await Routine.deleteMany({ userId: null });

        // Create test user
        const user = await User.create({
            name: 'Diego Santana',
            whatsappNumber: '5581999725668',
            subscription: {
                status: 'em_teste',
                trialStartDate: timezoneService.startOfDay(timezoneService.addDays(timezoneService.getCurrentTime(), -1)),
                trialEndDate: timezoneService.endOfDay(timezoneService.addDays(timezoneService.getCurrentTime(), 6))
            }
        });

        console.log('Test user created:', {
            name: user.name,
            whatsappNumber: user.whatsappNumber,
            subscription: {
                status: user.subscription.status,
                trialStartDate: timezoneService.formatDate(user.subscription.trialStartDate),
                trialEndDate: timezoneService.formatDate(user.subscription.trialEndDate)
            }
        });

        // Test initial plan creation
        console.log('\nTesting plan creation...');
        const userResponses = {
            initialMessage: `
                Olá! Preciso de ajuda para organizar minha rotina. 
                Acordo às 7h, trabalho das 9h às 18h com intervalo para almoço ao meio-dia.
                À noite gosto de estudar um pouco, geralmente das 20h às 22h.
                Tenho dificuldade em manter o foco durante longos períodos de trabalho.
            `,
            previousResponses: [
                {
                    type: 'text',
                    content: 'Preciso de pausas frequentes para manter a concentração.',
                    role: 'user'
                }
            ]
        };

        const routine = await routineController.createInitialPlan(user, userResponses);
        
        console.log('\nPlan created successfully:', {
            routineName: routine.routineName,
            activities: routine.activities.map(activity => ({
                activity: activity.activity,
                scheduledTime: timezoneService.formatDate(activity.scheduledTime),
                type: activity.type,
                status: activity.status
            }))
        });

        // Verify user was updated with plan
        const updatedUser = await User.findById(user._id);
        console.log('\nUser plan status:', {
            hasCurrentPlan: !!updatedUser.currentPlan,
            planId: updatedUser.currentPlan
        });

        // Test plan progress update
        console.log('\nTesting plan progress update...');
        const completedTasks = [routine.activities[0]._id, routine.activities[2]._id];
        const feedback = "Consegui completar as primeiras atividades do dia, mas tive dificuldade com o foco após o almoço.";
        
        await routineController.updatePlanProgress(updatedUser, completedTasks, feedback);

        // Verify activities were marked as completed
        const updatedRoutine = await Routine.findById(routine._id);
        console.log('\nUpdated activities status:', 
            updatedRoutine.activities.map(activity => ({
                activity: activity.activity,
                status: activity.status,
                completed: completedTasks.includes(activity._id)
            }))
        );

        // Test daily motivation
        console.log('\nTesting daily motivation generation...');
        await routineController.getDailyMotivation(updatedUser);

        await mongoose.disconnect();
        console.log('\nPlan creation test completed successfully!');

    } catch (error) {
        console.error('Error during plan creation test:', error);
        process.exit(1);
    }
}

testPlanCreation();

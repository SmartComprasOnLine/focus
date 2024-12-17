require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const Routine = require('../models/Routine');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');

async function testMicroSaaS() {
    try {
        // Connect to database
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected successfully');

        // Create test user
        const user = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            whatsappNumber: '5581999999999',
            timezone: 'America/Sao_Paulo',
            subscription: {
                status: 'em_teste',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        console.log('Created test user:', user);

        // Test routine creation
        const routineInput = `
            Minha rotina atual:
            - Acordo às 7h
            - Trabalho das 9h às 18h
            - Academia às 19h
            - Durmo às 23h
            
            Desafios:
            - Dificuldade para manter foco
            - Procrastinação
            - Distrações com celular
            
            Preferências:
            - Mais produtivo pela manhã
            - Gosto de música para focar
            - Preciso de pausas regulares
        `;

        console.log('\nGenerating initial plan...');
        const plan = await openaiService.generateInitialPlan(user.name, routineInput);
        console.log('Generated plan:', plan);

        // Create routine
        const routine = await Routine.create({
            userId: user._id,
            routineName: 'Test Routine',
            activities: plan.activities.map(activity => ({
                activity: activity.task,
                scheduledTime: activity.time,
                duration: activity.duration,
                type: 'routine',
                status: 'active',
                messages: activity.reminders
            }))
        });

        console.log('\nCreated routine:', routine);

        // Update user with routine
        user.activeRoutineId = routine._id;
        await user.save();

        // Test plan summary
        console.log('\nGenerating plan summary...');
        const summary = await openaiService.generatePlanSummary(user.name, routine);
        console.log('Plan summary:', summary);

        // Test activity feedback
        console.log('\nGenerating activity feedback...');
        const feedback = await openaiService.generateActivityFeedback(user.name, true);
        console.log('Activity feedback:', feedback);

        // Test response generation
        console.log('\nGenerating response...');
        const response = await openaiService.generateResponse(user.name, 'Como posso melhorar meu foco?');
        console.log('Generated response:', response);

        // Clean up
        console.log('\nCleaning up test data...');
        await User.deleteOne({ _id: user._id });
        await Routine.deleteOne({ _id: routine._id });
        console.log('Test data cleaned up');

    } catch (error) {
        console.error('Error in test:', error);
    } finally {
        await disconnectDB();
        console.log('Database connection closed');
    }
}

testMicroSaaS();

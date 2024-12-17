require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const Routine = require('../models/Routine');
const intentService = require('../services/intentService');
const routineController = require('../controllers/routineController');

// Mock evolutionApi
const evolutionApi = {
    sendText: async (number, text) => {
        console.log('Mock sendText:', { number, text: text.substring(0, 50) + '...' });
        return { status: 200, data: { message: 'Message sent' } };
    }
};

// Override the evolutionApi in routineController
routineController.evolutionApi = evolutionApi;

async function testPlanUpdate() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected. Starting test...');

        // Clear test user and routines
        await User.deleteOne({ whatsappNumber: '5581999725668' });
        console.log('Cleared previous test data');

        // Create test user
        const user = await User.create({
            name: 'Diego Santana',
            email: 'diego@example.com',
            whatsappNumber: '5581999725668',
            timezone: 'America/Sao_Paulo',
            preferences: {
                reminders: [{
                    type: 'before',
                    timing: 15,
                    style: 'friendly'
                }],
                productivityPeriods: [{
                    startTime: '09:00',
                    endTime: '12:00',
                    energyLevel: 'high',
                    focusLevel: 'high'
                }],
                challenges: [{
                    type: 'focus',
                    description: 'Easily distracted by noise',
                    severity: 'high'
                }],
                strategies: [{
                    type: 'music',
                    description: 'Lofi music helps focus',
                    effectiveness: 'high'
                }],
                medication: {
                    name: 'Ritalina',
                    dosage: '10mg',
                    timing: '08:00',
                    duration: 4,
                    notes: 'Take with breakfast'
                },
                sleepSchedule: {
                    bedtime: '23:00',
                    wakeTime: '07:00',
                    quality: 'fair'
                },
                workSchedule: {
                    startTime: '09:00',
                    endTime: '18:00',
                    breakPreferences: [{
                        time: '12:00',
                        duration: 60
                    }]
                },
                environment: {
                    noisePreference: 'silent',
                    lightingPreference: 'bright',
                    temperaturePreference: 'moderate'
                }
            }
        });
        console.log('Created test user:', user._id);

        // Create initial plan
        console.log('\nTesting initial plan creation...');
        const initialMessage = `
            Minha rotina atual é assim:
            - Acordo 7h mas tenho dificuldade pra levantar
            - Tomo café 7h30
            - Trabalho home office das 9h às 18h
            - Almoço meio dia
            - Academia às 19h (quando consigo ir)
            - Janto 20h30
            - Durmo 23h mas fico no celular até tarde
        `;
        const routine = await routineController.createInitialPlan(user, { initialMessage });
        console.log('Initial plan created with activities:', 
            routine.activities.map(a => ({ time: a.time, task: a.task })));

        // Test plan update - adding a new activity
        console.log('\nTesting plan update - Adding new activity...');
        const updateMessage1 = "Quero adicionar uma pausa para meditação às 15h por 15 minutos";
        const intent1 = await intentService.detectIntent(updateMessage1, {
            hasActivePlan: true,
            subscriptionStatus: 'em_teste'
        });
        console.log('Intent detected:', intent1);
        const updatedRoutine1 = await routineController.updatePlan(user, updateMessage1);
        const meditationActivity = updatedRoutine1.activities.find(a => 
            a.task.toLowerCase().includes('meditação'));
        console.log('Added meditation break:', {
            time: meditationActivity?.time,
            task: meditationActivity?.task,
            duration: meditationActivity?.duration
        });

        // Test plan update - modifying existing activity
        console.log('\nTesting plan update - Modifying activity...');
        const updateMessage2 = "Preciso mudar o horário da academia para 18h";
        const intent2 = await intentService.detectIntent(updateMessage2, {
            hasActivePlan: true,
            subscriptionStatus: 'em_teste'
        });
        console.log('Intent detected:', intent2);
        const updatedRoutine2 = await routineController.updatePlan(user, updateMessage2);
        const gymActivity = updatedRoutine2.activities.find(a => 
            a.task.toLowerCase().includes('academia'));
        console.log('Modified gym activity:', {
            time: gymActivity?.time,
            task: gymActivity?.task,
            duration: gymActivity?.duration
        });

        // Test plan update - removing activity
        console.log('\nTesting plan update - Removing activity...');
        const updateMessage3 = "Quero remover a pausa para meditação do meu plano";
        const intent3 = await intentService.detectIntent(updateMessage3, {
            hasActivePlan: true,
            subscriptionStatus: 'em_teste'
        });
        console.log('Intent detected:', intent3);
        const updatedRoutine3 = await routineController.updatePlan(user, updateMessage3);
        console.log('Meditation activity removed:', 
            !updatedRoutine3.activities.some(a => a.task.toLowerCase().includes('meditação')));

        // Test plan update - updating reminders
        console.log('\nTesting plan update - Updating reminders...');
        const updateMessage4 = "Quero receber lembretes mais motivadores antes de cada atividade";
        const intent4 = await intentService.detectIntent(updateMessage4, {
            hasActivePlan: true,
            subscriptionStatus: 'em_teste'
        });
        console.log('Intent detected:', intent4);
        const updatedRoutine4 = await routineController.updatePlan(user, updateMessage4);
        console.log('Updated reminders sample:', {
            activity: updatedRoutine4.activities[0].task,
            beforeReminder: updatedRoutine4.activities[0].reminders.before.message
        });

        // Test various intent detections
        console.log('\nTesting additional intent detections...');
        const testMessages = [
            "Quero adicionar uma nova atividade ao meu plano",
            "Preciso mudar o horário da academia",
            "Me mostra como está meu plano atual",
            "Terminei a atividade de trabalho",
            "Não consegui ir à academia hoje",
            "Quero mudar meus lembretes para serem mais diretos",
            "Pode me mostrar um resumo do meu plano?",
            "Preciso reorganizar minhas atividades da manhã"
        ];

        for (const message of testMessages) {
            const intent = await intentService.detectIntent(message, {
                hasActivePlan: true,
                subscriptionStatus: 'em_teste'
            });
            console.log(`Message: "${message}" -> Intent: ${intent}`);
        }

        console.log('\nTest completed successfully');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await disconnectDB();
    }
}

testPlanUpdate();

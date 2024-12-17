const mongoose = require('mongoose');
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
const webhookController = require('../controllers/webhookController');
require('dotenv').config();

const mockResponse = {
    status: (code) => ({
        json: (data) => console.log(`Response status: ${code}, data:`, data),
    }),
};

async function testMicroSaaS() {
    try {
        console.log('\n=== Starting MicroSaaS Test Suite ===\n');

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Test 1: First User Interaction
        console.log('\n=== Test 1: First User Interaction ===\n');
        const firstMessageRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'oi'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(firstMessageRequest, mockResponse);

        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: User Asking About TDAH Help
        console.log('\n=== Test 2: User Asking About TDAH Help ===\n');
        const tdahHelpRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'preciso de ajuda com meu TDAH'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(tdahHelpRequest, mockResponse);

        // Test 3: Creating a Routine
        console.log('\n=== Test 3: Creating a Routine ===\n');
        const createRoutineRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'criar rotina'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(createRoutineRequest, mockResponse);

        // Test 4: Selecting Plan
        console.log('\n=== Test 4: Selecting Plan ===\n');
        const selectPlanRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'plano_anual'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(selectPlanRequest, mockResponse);

        // Test 5: Simulating Payment Success
        console.log('\n=== Test 5: Payment Success ===\n');
        const paymentSuccessRequest = {
            body: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_' + Date.now(),
                        payment_intent: 'pi_' + Date.now(),
                        metadata: {
                            userNumber: '5581999725668',
                            planType: 'anual'
                        }
                    }
                }
            },
        };
        await webhookController.handleWebhook(paymentSuccessRequest, mockResponse);

        // Test 6: Task Completion
        console.log('\n=== Test 6: Task Completion ===\n');
        const taskCompletionRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'completei a tarefa'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(taskCompletionRequest, mockResponse);

        // Test 7: Requesting Progress Report
        console.log('\n=== Test 7: Progress Report ===\n');
        const progressRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'ver progresso'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(progressRequest, mockResponse);

        // Test 8: Requesting Motivation
        console.log('\n=== Test 8: Requesting Motivation ===\n');
        const motivationRequest = {
            body: {
                data: {
                    key: {
                        remoteJid: '5581999725668@s.whatsapp.net',
                    },
                    message: {
                        conversation: 'preciso de motivação'
                    },
                    pushName: 'Diego Santana',
                },
            },
        };
        await webhookController.handleWebhook(motivationRequest, mockResponse);

        console.log('\n=== Test Suite Completed ===\n');

        // Clean up
        await mongoose.disconnect();
        console.log('Database connection closed');

    } catch (error) {
        console.error('Error during tests:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

testMicroSaaS();

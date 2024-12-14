const mongoose = require('mongoose');
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
require('dotenv').config();

async function simulateWebhook() {
    try {
        console.log('Environment Variables:', {
            MONGODB_URI: process.env.MONGODB_URI,
            EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
            EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
            API_KEY_EXISTS: !!process.env.EVOLUTION_API_KEY,
            STRIPE_KEY_EXISTS: !!process.env.STRIPE_SECRET_KEY
        });

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const webhookController = require('../controllers/webhookController');
        const mockResponse = {
            status: (code) => ({
                json: (data) => console.log(`Response status: ${code}, data:`, data),
            }),
        };

        // Step 1: Simulate selecting annual plan
        console.log('\n=== Step 1: Selecting Annual Plan ===\n');
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

        // Wait a bit before simulating Stripe webhook
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Simulate Stripe webhook for successful payment
        console.log('\n=== Step 2: Simulating Stripe Payment Webhook ===\n');
        const stripeWebhookRequest = {
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

        await webhookController.handleWebhook(stripeWebhookRequest, mockResponse);
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Erro ao simular webhook:', error);
        process.exit(1);
    }
}

simulateWebhook();

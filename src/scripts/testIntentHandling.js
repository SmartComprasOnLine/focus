const mongoose = require('mongoose');
const User = require('../models/User');
const intentService = require('../services/intentService');
const evolutionApi = require('../services/evolutionApi');
const timezoneService = require('../services/timezoneService');
require('dotenv').config();

async function testIntentHandling() {
    try {
        console.log('Starting intent handling test...\n');

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Test messages
        const testMessages = [
            "Olá! Preciso de ajuda para organizar minha rotina.",
            "Como faço para continuar usando o sistema? Estou gostando muito!",
            "Quero saber mais sobre os planos e preços.",
            "Acabei de fazer o pagamento do plano anual.",
            "Tenho dificuldade em manter o foco durante o trabalho.",
            "Que horas são as notificações?",
        ];

        const userName = "Diego";
        // Set default values if environment variables are not set
        const monthlyPrice = process.env.PLAN_MONTHLY_PRICE ? 
            (process.env.PLAN_MONTHLY_PRICE / 100).toFixed(2) : '99.00';
        const yearlyPrice = process.env.PLAN_YEARLY_PRICE ? 
            (process.env.PLAN_YEARLY_PRICE / 100).toFixed(2) : '999.00';
        const endDate = timezoneService.formatDateOnly(
            timezoneService.addYears(timezoneService.getCurrentTime(), 1)
        );

        console.log('Test Messages Analysis:\n');

        for (const message of testMessages) {
            console.log(`Message: "${message}"`);
            
            // Analyze intent
            const intent = await intentService.analyzeIntent(message, userName);
            console.log('Detected Intent:', intent);

            if (intent !== 'NONE') {
                // Base parameters for all intents
                const baseParams = {
                    userName,
                    monthlyPrice,
                    yearlyPrice,
                    endDate
                };

                // Add specific parameters based on intent
                let params = { ...baseParams };
                if (intent === 'PAYMENT_CONFIRMATION') {
                    params = {
                        ...params,
                        planType: 'anual'
                    };
                }

                const response = await intentService.getResponseForIntent(intent, params);

                if (response) {
                    console.log('Response Type:', response.type);
                    if (response.type === 'list') {
                        console.log('List Response:');
                        console.log('- Title:', response.title);
                        console.log('- Description:', response.description);
                        console.log('- Button Text:', response.buttonText);
                        console.log('- Sections:', JSON.stringify(response.sections, null, 2));
                    } else {
                        console.log('Text Response:', response.content);
                    }
                }
            } else {
                console.log('No predefined response for this intent');
            }
            
            console.log('\n---\n');
        }

        // Test with actual user in database
        console.log('Testing with database user:\n');

        // Clear existing test user
        await User.deleteOne({ whatsappNumber: '5581999725668' });

        // Create test user
        const user = await User.create({
            name: 'Diego Santana',
            whatsappNumber: '5581999725668',
            subscription: {
                status: 'em_teste',
                trialStartDate: timezoneService.startOfDay(timezoneService.addDays(timezoneService.getCurrentTime(), -6)),
                trialEndDate: timezoneService.endOfDay(timezoneService.addDays(timezoneService.getCurrentTime(), 1))
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

        // Test subscription inquiry
        const message = "Como faço para continuar usando o sistema?";
        console.log('\nTesting subscription inquiry:', message);

        const intent = await intentService.analyzeIntent(message, user.name);
        console.log('Detected Intent:', intent);

        if (intent === 'SUBSCRIPTION_INQUIRY') {
            const response = await intentService.getResponseForIntent(intent, {
                userName: user.name,
                monthlyPrice,
                yearlyPrice,
                endDate
            });

            if (response && response.type === 'list') {
                console.log('\nSending list message to WhatsApp...');
                await evolutionApi.sendList(
                    user.whatsappNumber,
                    response.title,
                    response.description,
                    response.buttonText,
                    response.sections
                );
                console.log('List message sent successfully');
            }
        }

        await mongoose.disconnect();
        console.log('\nIntent handling test completed successfully!');

    } catch (error) {
        console.error('Error during intent test:', error);
        process.exit(1);
    }
}

testIntentHandling();

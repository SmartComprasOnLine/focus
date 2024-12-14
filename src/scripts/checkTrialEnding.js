const mongoose = require('mongoose');
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
require('dotenv').config();

async function checkTrialEnding() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to database, checking for trials ending...');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find users whose trial ends tomorrow
        const users = await User.find({
            'subscription.status': 'em_teste',
            'subscription.trialEndDate': {
                $gte: today,
                $lte: tomorrow
            }
        });

        console.log(`Found ${users.length} users with trial ending tomorrow`);

        const monthlyPrice = (process.env.PLAN_MONTHLY_PRICE / 100).toFixed(2);
        const yearlyPrice = (process.env.PLAN_YEARLY_PRICE / 100).toFixed(2);

        for (const user of users) {
            console.log(`Sending trial ending notification to ${user.name} (${user.whatsappNumber})`);

            await evolutionApi.sendList(
                user.whatsappNumber,
                "Escolha seu plano",
                "⚠️ Seu período de teste termina amanhã! Para continuar tendo acesso e manter seu progresso, escolha um plano:",
                "Ver Planos",
                [
                    {
                        title: "Planos Disponíveis",
                        rows: [
                            {
                                title: "Plano Mensal",
                                description: `R$ ${monthlyPrice}/mês - Acesso a todas as funcionalidades`,
                                rowId: "plano_mensal"
                            },
                            {
                                title: "Plano Anual",
                                description: `R$ ${yearlyPrice}/ano - Economia de 2 meses!`,
                                rowId: "plano_anual"
                            }
                        ]
                    }
                ]
            );
        }

        console.log('Finished checking trial ending notifications');
        await mongoose.disconnect();

    } catch (error) {
        console.error('Error checking trial ending:', error);
        process.exit(1);
    }
}

// Run the check
checkTrialEnding();

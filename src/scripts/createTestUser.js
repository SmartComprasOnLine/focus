const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Criar usuário com período de teste começando há 6 dias
        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
        
        const trialEndDate = new Date(sixDaysAgo);
        trialEndDate.setDate(trialEndDate.getDate() + 7);

        const user = await User.create({
            name: 'Diego Santana',
            whatsappNumber: '5581999725668',
            subscription: {
                status: 'em_teste',
                trialStartDate: sixDaysAgo,
                trialEndDate: trialEndDate,
                plan: 'none'
            },
            interactionHistory: [
                {
                    type: 'text',
                    content: 'Olá! Preciso de ajuda para organizar minha rotina.',
                    role: 'user',
                    timestamp: sixDaysAgo
                }
            ],
            createdAt: sixDaysAgo
        });

        console.log('Usuário de teste criado:', {
            name: user.name,
            whatsappNumber: user.whatsappNumber,
            trialStartDate: user.subscription.trialStartDate,
            trialEndDate: user.subscription.trialEndDate,
            daysRemaining: Math.ceil((user.subscription.trialEndDate - new Date()) / (1000 * 60 * 60 * 24))
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Erro ao criar usuário de teste:', error);
    }
}

createTestUser();

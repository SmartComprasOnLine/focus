require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const webhookController = require('../controllers/webhookController');

// Override evolutionApi with mock
const evolutionApi = require('../services/evolutionApi');
evolutionApi.sendText = async (number, text) => {
    console.log('SendText called with:', { number, text });
    return {
        status: 201,
        data: {
            key: {
                remoteJid: `${number}@s.whatsapp.net`,
                fromMe: true,
                id: Math.random().toString(36).substring(7)
            },
            pushName: '',
            status: 'PENDING',
            message: { conversation: text },
            contextInfo: null,
            messageType: 'conversation',
            messageTimestamp: Date.now(),
            instanceId: '3c12b38a-6ccf-4a96-901f-4f8a73b188c0',
            source: 'unknown'
        }
    };
};

evolutionApi.sendList = async (number, title, description, buttonText, sections, footerText, delay = 1000) => {
    console.log('Sending list with data:', {
        number,
        title,
        description,
        buttonText,
        sections,
        footerText,
        delay
    });
    return { status: 200, data: { message: 'Message processed successfully' } };
};

async function simulateMessage(user, message) {
    console.log(`\n=== Step ${stepCount}: Message ${messageCount} ===\n`);
    console.log('Sending:', message);
    messageHistory.push({ role: 'user', content: message });
    
    try {
        // Create response object to capture messages
        const responses = [];
        const res = {
            json: (data) => {
                responses.push(data);
                console.log('Response status: 200', 'data:', data);
            },
            status: (code) => ({
                json: (data) => {
                    responses.push({ status: code, data });
                    console.log('Response status:', code, 'data:', data);
                }
            })
        };

        await webhookController.handleWebhook({
            body: {
                message,
                user
            }
        }, res);

        // Print user status after each message
        console.log('\nUser Status:');
        console.log('Subscription:', user.subscription);

        // Print interaction history
        console.log('\nInteraction History:');
        messageHistory.forEach((msg, index) => {
            console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
        });
        console.log('---\n');

    } catch (error) {
        console.error('Error in simulation:', error);
    }
}

let stepCount = 0;
let messageCount = 0;
const messageHistory = [];

async function runSimulation() {
    try {
        console.log('EVOLUTION_INSTANCE:', process.env.EVOLUTION_INSTANCE);
        
        // Connect to database
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected. Clearing database...');
        
        // Clear previous test data
        await User.deleteOne({ whatsappNumber: '5581999725668' });
        console.log('Database cleared successfully');

        // Create test user
        const user = await User.create({
            name: 'Diego Santana',
            email: 'diego@example.com',
            whatsappNumber: '5581999725668',
            timezone: 'America/Sao_Paulo',
            subscription: {
                status: 'em_teste',
                trialStartDate: new Date(),
                trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        const messages = [
            // Initial contact
            'Oi! Me falaram que vocês ajudam com TDAH',
            
            // Share routine
            `Minha rotina atual é assim:
            - Acordo 7h mas tenho dificuldade pra levantar
            - Tomo café 7h30
            - Trabalho home office das 9h às 18h
            - Almoço meio dia
            - Academia às 19h (quando consigo ir)
            - Janto 20h30
            - Durmo 23h mas fico no celular até tarde`,
            
            // Share productivity patterns
            `Sou mais produtivo de manhã, depois do almoço fico muito sonolento.
            Tenho muita dificuldade pra focar quando tem barulho.
            Já tentei usar timer mas esqueço de configurar.`,
            
            // Share challenges
            `Preciso organizar melhor meu trabalho, tenho muitos projetos atrasados.
            Minha maior dificuldade é começar as tarefas, fico enrolando.
            O celular me distrai muito, principalmente WhatsApp e Instagram.`,
            
            // Share strategies
            `Gosto de fazer listas no papel mas sempre perco.
            Música me ajuda a focar, principalmente lofi.
            Prefiro trabalhar de manhã quando a casa está silenciosa.`,
            
            // Share medication info
            `Tomo Ritalina de manhã, faz efeito por umas 4 horas.
            O médico falou pra evitar cafeína depois das 16h.`,
            
            // Like the plan
            'Gostei muito do plano! Principalmente das pausas e lembretes',
            
            // Request plan summary
            'Me mostra um resumo do meu plano?',
            
            // Update gym time
            'Preciso mudar o horário da academia para 18h, consigo ir mais cedo',
            
            // Add meditation
            'Queria adicionar uma meditação de 15 minutos depois do almoço',
            
            // Complete meditation
            'Terminei a meditação! Me senti muito bem',
            
            // Skip gym
            'Hoje não vou conseguir ir na academia, estou muito cansado',
            
            // Ask about subscription
            'Como faço pra continuar usando depois do teste?',
            
            // Select plan
            'plano_anual',
            
            // Say goodbye
            'Obrigado pela ajuda!'
        ];

        // Process each message with a delay
        for (const message of messages) {
            stepCount++;
            messageCount++;
            await simulateMessage(user, message);
            // Add small delay between messages to simulate typing
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Error in simulation:', error);
    } finally {
        // Wait for any pending timeouts (10 seconds + buffer)
        await new Promise(resolve => setTimeout(resolve, 11000));
        
        await disconnectDB();
        console.log('Database connection closed');
    }
}

runSimulation();
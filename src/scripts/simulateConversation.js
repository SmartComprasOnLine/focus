require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const webhookController = require('../controllers/webhookController');

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
            headers: {
                'x-api-key': process.env.EVOLUTION_API_KEY
            },
            body: {
                event: 'messages.upsert',
                instance: process.env.EVOLUTION_INSTANCE,
                data: {
                    key: {
                        remoteJid: user.whatsappNumber,
                        fromMe: false,
                        id: Math.random().toString(36).substring(7)
                    },
                    pushName: user.name,
                    status: 'DELIVERY_ACK',
                    message: { conversation: message },
                    messageType: 'conversation',
                    messageTimestamp: Math.floor(Date.now() / 1000),
                    instanceId: process.env.EVOLUTION_INSTANCE,
                    source: 'ios'
                },
                destination: process.env.MAIN_SERVICE_URL,
                date_time: new Date().toISOString(),
                sender: `${user.whatsappNumber}@s.whatsapp.net`,
                server_url: process.env.EVOLUTION_API_URL,
                apikey: process.env.EVOLUTION_API_KEY
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
            // Add 15-second delay between messages to simulate real conversation
            await new Promise(resolve => setTimeout(resolve, 15000));
        }

    } catch (error) {
        console.error('Error in simulation:', error);
    } finally {
        // Wait for all messages to be processed (15 messages * 15 seconds + 10 seconds timeout + buffer)
        await new Promise(resolve => setTimeout(resolve, 15 * 15000 + 10000 + 5000));
        
        await disconnectDB();
        console.log('Database connection closed');
    }
}

runSimulation();

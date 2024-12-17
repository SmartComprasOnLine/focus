const intentService = require('../services/intentService');
const routineController = require('./routineController');
const subscriptionController = require('./subscriptionController');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const User = require('../models/User');
const Routine = require('../models/Routine');

class WebhookController {
    constructor() {
        // Initialize Maps in constructor instead of static properties
        this.pendingMessages = new Map();
        this.messageTimeouts = new Map();
    }

    async handleWebhook(req, res) {
        try {
            // Parse body if it's a string
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            // Validate webhook data
            if (!body.data || !body.data.message || !body.data.key) {
                console.error('Invalid webhook data:', body);
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Extract message and number
            const messageData = body.data;
            const number = messageData.key.remoteJid.replace('@s.whatsapp.net', '');
            
            // Extract message text, handling different message structures
            let message;
            if (messageData.message.conversation) {
                message = messageData.message.conversation;
            } else if (messageData.message.extendedTextMessage) {
                message = messageData.message.extendedTextMessage.text;
            } else if (messageData.message.messageContextInfo && messageData.message.conversation) {
                message = messageData.message.conversation;
            } else {
                console.error('Unknown message format:', messageData.message);
                return res.status(400).json({ error: 'Unsupported message format' });
            }

            console.log('Extracted message:', message);

            const name = messageData.pushName || `User ${number.slice(-4)}`;

            // Find or create user
            let user = await User.findOne({ whatsappNumber: number });
            if (!user) {
                user = await User.create({
                    name,
                    whatsappNumber: number,
                    timezone: 'America/Sao_Paulo',
                    subscription: {
                        status: 'em_teste',
                        trialStartDate: new Date(),
                        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    }
                });
            }

            const userId = user._id.toString();

            // Add user message to history
            await user.addToMessageHistory('user', message);

            // Clear any existing timeout for this user
            if (this.messageTimeouts.has(userId)) {
                clearTimeout(this.messageTimeouts.get(userId));
            }

            // Get or initialize pending messages for this user
            const userMessages = this.pendingMessages.get(userId) || [];
            userMessages.push(message);
            this.pendingMessages.set(userId, userMessages);

            // Set a new timeout
            const timeout = setTimeout(async () => {
                try {
                    // Get all pending messages
                    const messages = this.pendingMessages.get(userId) || [];
                    // Clear pending messages
                    this.pendingMessages.delete(userId);
                    this.messageTimeouts.delete(userId);

                    // Process concatenated messages
                    await this.processMessages(messages.join('\n'), user);
                } catch (error) {
                    console.error('Error processing messages:', error);
                    const errorMessage = 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.';
                    await evolutionApi.sendText(user.whatsappNumber, errorMessage);
                    await user.addToMessageHistory('assistant', errorMessage);
                }
            }, 10000); // 10 seconds

            this.messageTimeouts.set(userId, timeout);

            // Send immediate response
            return res.json({ message: 'Message queued for processing' });
        } catch (error) {
            console.error('Error in webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processMessages(message, user) {
        try {
            // For new users, send welcome message immediately
            if (!user.welcomeSent) {
                const welcomeMessage = `*Olá ${user.name}!* 👋\n\n` +
                    '*Eu sou Rita, sua assistente pessoal!* 🌟\n\n' +
                    '*Estou aqui para te ajudar a:*\n' +
                    '• Criar e manter rotinas 📅\n' +
                    '• Gerenciar tarefas e lembretes ⏰\n' +
                    '• Melhorar seu foco e produtividade 🎯\n\n' +
                    '_Me conte um pouco sobre sua rotina atual para começarmos!_ 💪\n\n' +
                    '_Obs: Se precisar apagar seus dados, basta enviar "apagar meus dados"._';
                
                await evolutionApi.sendText(user.whatsappNumber, welcomeMessage);
                await user.addToMessageHistory('assistant', welcomeMessage);
                
                // Mark welcome message as sent
                user.welcomeSent = true;
                user.lastActive = new Date();
                await user.save();
            } else {
                // Update lastActive timestamp for returning users
                user.lastActive = new Date();
                await user.save();
            }

            // Get message history for context
            const messageHistory = user.getMessageHistory();

            // Detect intent with user context
            const userContext = {
                hasActivePlan: !!user.activeRoutineId,
                subscriptionStatus: user.subscription.status,
                preferences: user.preferences || {},
                messageHistory: messageHistory
            };

            try {
                const intent = await intentService.detectIntent(message, userContext);
                console.log('Detected intent:', intent);

                let response;
                switch (intent) {
                    case 'delete_data': {
                        // Delete user's routines
                        if (user.activeRoutineId) {
                            await Routine.deleteMany({ userId: user._id });
                        }
                        
                        // Delete user
                        await User.deleteOne({ _id: user._id });

                        // Send confirmation message
                        const deleteMessage = '*Seus dados foram apagados com sucesso.* 🗑️\n\n' +
                            '_Todas as suas informações foram removidas do nosso banco de dados._\n\n' +
                            'Se quiser voltar a usar o serviço, é só me mandar uma mensagem! 👋';
                        
                        await evolutionApi.sendText(user.whatsappNumber, deleteMessage);
                        break;
                    }

                    case 'create_plan':
                        await routineController.createInitialPlan(user, { initialMessage: message });
                        break;

                    case 'update_plan':
                        if (!user.activeRoutineId) {
                            // If user doesn't have a plan yet, create one
                            await routineController.createInitialPlan(user, { initialMessage: message });
                        } else {
                            // Update existing plan
                            await routineController.updatePlan(user, message);
                        }
                        break;

                    case 'show_plan':
                        await routineController.getPlanSummary(user);
                        break;

                    case 'activity_completed': {
                        const activityInfo = await intentService.extractActivityInfo(message);
                        if (activityInfo && activityInfo.activityId) {
                            await routineController.completeActivity(user, activityInfo.activityId);
                        }
                        break;
                    }

                    case 'activity_not_completed': {
                        const activityInfo = await intentService.extractActivityInfo(message);
                        if (activityInfo && activityInfo.activityId) {
                            await routineController.skipActivity(user, activityInfo.activityId);
                        }
                        break;
                    }

                    case 'subscription_inquiry':
                        await subscriptionController.showPlans(user);
                        break;

                    case 'select_plan': {
                        const planInfo = await intentService.extractActivityInfo(message);
                        if (planInfo && planInfo.planType) {
                            await subscriptionController.createPaymentLink(user, planInfo.planType);
                        }
                        break;
                    }

                    case 'goodbye': {
                        const goodbyeMessage = `*Sempre à disposição ${user.name}!* 😊 _Continue focado nos seus objetivos!_ 💪`;
                        await evolutionApi.sendText(user.whatsappNumber, goodbyeMessage);
                        await user.addToMessageHistory('assistant', goodbyeMessage);
                        break;
                    }

                    default: {
                        // Generate contextual response
                        response = await openaiService.generateResponse(user.name, message, messageHistory);
                        await evolutionApi.sendText(user.whatsappNumber, response);
                        await user.addToMessageHistory('assistant', response);
                        break;
                    }
                }
            } catch (error) {
                console.error('Error processing intent:', error);
                const errorMessage = 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.';
                await evolutionApi.sendText(user.whatsappNumber, errorMessage);
                await user.addToMessageHistory('assistant', errorMessage);
            }
        } catch (error) {
            console.error('Error processing messages:', error);
            const errorMessage = 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.';
            await evolutionApi.sendText(user.whatsappNumber, errorMessage);
            await user.addToMessageHistory('assistant', errorMessage);
        }
    }
}

module.exports = new WebhookController();

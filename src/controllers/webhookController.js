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
            // Update lastActive timestamp
            user.lastActive = new Date();
            await user.save();

            // Get message history for context
            const messageHistory = user.getMessageHistory();

            // Detect intent with user context
            const userContext = {
                hasActivePlan: !!user.activeRoutineId,
                subscriptionStatus: user.subscription.status,
                preferences: user.preferences || {},
                messageHistory: messageHistory,
                isNewUser: !user.welcomeSent
            };

            try {
                const intent = await intentService.detectIntent(message, userContext);
                console.log('Detected intent:', intent);

                let response;
                switch (intent) {
                    case 'confirm_plan': {
                        const confirmMessage = `Perfeito! 🎯 Seu plano está confirmado e ativo. 

Dicas para aproveitar melhor os lembretes:
• Quando completar uma atividade, me avise dizendo "completei"
• Se precisar pular uma atividade, diga "não completei"
• Para ver seu plano atual, peça "mostrar plano"
• Para fazer ajustes, é só me dizer o que quer mudar

Estou aqui para ajudar você a manter o foco! 💪`;
                        
                        await evolutionApi.sendText(user.whatsappNumber, confirmMessage);
                        await user.addToMessageHistory('assistant', confirmMessage);
                        break;
                    }
                    case 'initial_message': {
                        if (!user.welcomeSent) {
                            response = await openaiService.generateResponse(user.name, message, messageHistory);
                            await evolutionApi.sendText(user.whatsappNumber, response);
                            await user.addToMessageHistory('assistant', response);
                            user.welcomeSent = true;
                            await user.save();
                        } else {
                            response = await openaiService.generateResponse(user.name, message, messageHistory);
                            await evolutionApi.sendText(user.whatsappNumber, response);
                            await user.addToMessageHistory('assistant', response);
                        }
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

                    case 'delete_data': {
                        // Delete user's routine if exists
                        if (user.activeRoutineId) {
                            await Routine.findByIdAndDelete(user.activeRoutineId);
                        }
                        
                        // Delete user
                        await User.findByIdAndDelete(user._id);
                        
                        const deleteMessage = `Seus dados foram apagados com sucesso, ${user.name}. Se quiser voltar a usar o serviço, é só mandar uma mensagem. 👋`;
                        await evolutionApi.sendText(user.whatsappNumber, deleteMessage);
                        break;
                    }

                    default: {
                        // Generate contextual response
                        response = await openaiService.generateResponse(user.name, message, messageHistory);
                        await evolutionApi.sendText(user.whatsappNumber, response);
                        await user.addToMessageHistory('assistant', response);

                        // Mark welcome message as sent if this is the first interaction
                        if (!user.welcomeSent) {
                            user.welcomeSent = true;
                            await user.save();
                        }
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

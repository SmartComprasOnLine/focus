const intentService = require('../services/intentService');
const routineController = require('./routineController');
const subscriptionController = require('./subscriptionController');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const User = require('../models/User');

class WebhookController {
    constructor() {
        // Initialize Maps in constructor instead of static properties
        this.pendingMessages = new Map();
        this.messageTimeouts = new Map();
    }

    async handleWebhook(req, res) {
        try {
            // Extract API key from headers
            const apiKey = req.headers['apikey'];

            if (!apiKey || apiKey !== process.env.EVOLUTION_API_KEY) {
                console.error('Invalid API key in headers:', apiKey);
                return res.status(401).json({ error: 'Unauthorized' });
            }

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
            const message = messageData.message.conversation;
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
                    await evolutionApi.sendText(user.whatsappNumber,
                        'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.'
                    );
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
                await evolutionApi.sendText(user.whatsappNumber,
                    `Olá ${user.name}! 👋\n\n` +
                    'Bem-vindo ao Focus, seu assistente pessoal para TDAH! 🌟\n\n' +
                    'Estou aqui para te ajudar a:\n' +
                    '• Criar e manter rotinas 📅\n' +
                    '• Gerenciar tarefas e lembretes ⏰\n' +
                    '• Melhorar seu foco e produtividade 🎯\n\n' +
                    'Me conte um pouco sobre sua rotina atual para começarmos! 💪'
                );
                
                // Mark welcome message as sent
                user.welcomeSent = true;
                user.lastActive = new Date();
                await user.save();
            } else {
                // Update lastActive timestamp for returning users
                user.lastActive = new Date();
                await user.save();
            }

            // Detect intent with user context
            const userContext = {
                hasActivePlan: !!user.activeRoutineId,
                subscriptionStatus: user.subscription.status,
                preferences: user.preferences || {}
            };

            try {
                const intent = await intentService.detectIntent(message, userContext);
                console.log('Detected intent:', intent);

                switch (intent) {
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
                        await evolutionApi.sendText(user.whatsappNumber,
                            `Sempre à disposição ${user.name}! 😊 Continue focado nos seus objetivos! 💪`
                        );
                        break;
                    }

                    default: {
                        // Generate contextual response
                        const response = await openaiService.generateResponse(user.name, message);
                        await evolutionApi.sendText(user.whatsappNumber, response);
                        break;
                    }
                }
            } catch (error) {
                console.error('Error processing intent:', error);
                await evolutionApi.sendText(user.whatsappNumber,
                    'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.'
                );
            }
        } catch (error) {
            console.error('Error processing messages:', error);
            // Send error message to user
            await evolutionApi.sendText(user.whatsappNumber,
                'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.'
            );
        }
    }
}

module.exports = new WebhookController();

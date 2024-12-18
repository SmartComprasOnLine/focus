const User = require('../models/User');
const Routine = require('../models/Routine');
const routineController = require('./routineController');
const subscriptionController = require('./subscriptionController');
const evolutionApi = require('../services/evolutionApi');
const conversationService = require('../services/conversationService');
const aiAnalysisService = require('../services/aiAnalysisService');

class WebhookController {
    constructor() {
        this.pendingMessages = new Map();
        this.messageTimeouts = new Map();
    }

    async handleWebhook(req, res) {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            if (!body.data || !body.data.message || !body.data.key) {
                console.error('Invalid webhook data:', body);
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const messageData = body.data;
            const number = messageData.key.remoteJid.replace('@s.whatsapp.net', '');
            
            let message = this.extractMessage(messageData);
            if (!message) {
                console.error('Unknown message format:', messageData.message);
                return res.status(400).json({ error: 'Unsupported message format' });
            }

            console.log('Extracted message:', message);

            const name = messageData.pushName || `User ${number.slice(-4)}`;
            const user = await this.findOrCreateUser(name, number);
            
            await this.queueMessage(user._id.toString(), message, user);

            return res.json({ message: 'Message queued for processing' });
        } catch (error) {
            console.error('Error in webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    extractMessage(messageData) {
        if (messageData.message.conversation) {
            return messageData.message.conversation;
        }
        if (messageData.message.extendedTextMessage) {
            return messageData.message.extendedTextMessage.text;
        }
        if (messageData.message.messageContextInfo && messageData.message.conversation) {
            return messageData.message.conversation;
        }
        if (messageData.message.listResponseMessage?.title) {
            return messageData.message.listResponseMessage.title;
        }
        if (messageData.message.buttonsResponseMessage?.selectedDisplayText) {
            return messageData.message.buttonsResponseMessage.selectedDisplayText;
        }
        return null;
    }

    async findOrCreateUser(name, number) {
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
        return user;
    }

    async queueMessage(userId, message, user) {
        if (this.messageTimeouts.has(userId)) {
            clearTimeout(this.messageTimeouts.get(userId));
        }

        const userMessages = this.pendingMessages.get(userId) || [];
        userMessages.push(message);
        this.pendingMessages.set(userId, userMessages);

        const timeout = setTimeout(async () => {
            try {
                const messages = this.pendingMessages.get(userId) || [];
                this.pendingMessages.delete(userId);
                this.messageTimeouts.delete(userId);

                await this.processMessages(messages.join('\n'), user);
            } catch (error) {
                console.error('Error processing messages:', error);
                await this.sendErrorMessage(user);
            }
        }, 10000);

        this.messageTimeouts.set(userId, timeout);
    }

    async processMessages(message, user) {
        try {
            user.lastActive = new Date();
            await user.save();

            // Process with conversation service
            const response = await conversationService.handleMessage(user, message);

            // Handle special actions
            if (response.action) {
                switch (response.action) {
                    case 'create_plan':
                        await routineController.createInitialPlan(user, { initialMessage: message });
                        break;
                    case 'update_plan':
                        await routineController.updatePlan(user, message);
                        break;
                    case 'show_plans':
                        await subscriptionController.showPlans(user);
                        break;
                    case 'delete_data':
                        await this.handleDataDeletion(user);
                        break;
                    default:
                        await evolutionApi.sendText(user.whatsappNumber, response.message);
                }
            } else {
                await evolutionApi.sendText(user.whatsappNumber, response.message);
            }

            await this.logInteraction(user, message, response);

        } catch (error) {
            console.error('Error processing messages:', error);
            await this.sendErrorMessage(user);
        }
    }

    async handleDataDeletion(user) {
        try {
            if (user.activeRoutineId) {
                await Routine.findByIdAndDelete(user.activeRoutineId);
            }
            await User.findByIdAndDelete(user._id);
            
            const deleteMessage = `Seus dados foram apagados com sucesso, ${user.name}. Se quiser voltar a usar o serviço, é só mandar uma mensagem. 👋`;
            await evolutionApi.sendText(user.whatsappNumber, deleteMessage);
        } catch (error) {
            console.error('Error deleting user data:', error);
            await this.sendErrorMessage(user);
        }
    }

    async sendErrorMessage(user) {
        const errorMessage = 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.';
        await evolutionApi.sendText(user.whatsappNumber, errorMessage);
        await user.addToMessageHistory('assistant', errorMessage);
    }

    async logInteraction(user, message, response) {
        try {
            const analysis = await aiAnalysisService.analyzeUserBehavior(user);
            
            const interaction = {
                timestamp: new Date(),
                user: user._id,
                message,
                response,
                context: {
                    hasActivePlan: !!user.activeRoutineId,
                    messageCount: user.messageHistory.length,
                    timeOfDay: new Date().getHours(),
                    analysis: {
                        patterns: analysis.padrões,
                        insights: analysis.insights
                    }
                }
            };

            console.log('Interaction logged:', interaction);
        } catch (error) {
            console.error('Error logging interaction:', error);
        }
    }
}

module.exports = new WebhookController();

const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
const openaiService = require('../services/openaiService');

class WebhookController {
  async handleWebhook(req, res) {
    let user; // Define user variable here
    try {
      console.log('=== WEBHOOK REQUEST START ===');
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Log the incoming request body for debugging
      console.log('Incoming request body:', JSON.stringify(req.body, null, 2));
      
      // Extract information from the webhook from Evolution API
      const { data } = req.body;
      if (!data || !data.key || !data.message) {
        console.log('No message in webhook');
        return res.status(200).json({ message: 'No message in webhook' });
      }

      const whatsappNumber = data.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = data.message?.conversation || 
                           data.message?.extendedTextMessage?.text ||
                           'Media message received';
      const messageType = data.messageType === 'conversation' ? 'text' : data.messageType || 'text';
      const userName = data.pushName || 'Novo Usuário';

      console.log('Processed message:', {
        whatsappNumber,
        messageContent,
        messageType,
        userName
      });

      // Find or create user
      console.log('Finding user:', whatsappNumber);
      user = await User.findOne({ whatsappNumber });
      
      if (!user) {
        console.log('Creating new user:', {
          whatsappNumber,
          userName
        });
        
        // New user - start trial
        user = await User.create({
          whatsappNumber,
          name: userName,
          subscription: {
            status: 'em_teste',
            trialStartDate: new Date(),
            trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        console.log('New user created:', user);

        // Send welcome message
        console.log('Sending welcome message');
        await evolutionApi.sendText(
          whatsappNumber,
          `👋 Olá ${userName}! Bem-vindo ao seu assistente pessoal para TDAH!\n\n` +
          'Estou aqui para ajudar você a organizar sua rotina e melhorar seu foco. ' +
          'Você tem 7 dias de teste gratuito para experimentar todas as funcionalidades.\n\n' +
          'Como posso ajudar você hoje?'
        );
        
        console.log('Welcome message sent');
        return res.status(200).json({ message: 'Welcome message sent' });
      }

      // Update user name if different
      if (user.name !== userName && userName !== 'Novo Usuário') {
        console.log('Updating user name:', {
          old: user.name,
          new: userName
        });
        user.name = userName;
      }

      // Check access
      console.log('Checking user access:', {
        status: user.subscription.status,
        hasAccess: user.hasAccess()
      });

      if (!user.hasAccess()) {
        console.log('User access expired, sending subscription options');
        await evolutionApi.sendText(
          whatsappNumber,
          `❌ ${userName}, seu período de acesso expirou. Para continuar utilizando o serviço, escolha um plano:`
        );
        await evolutionApi.sendSubscriptionOptions(whatsappNumber);
        return res.status(200).json({ message: 'Subscription required message sent' });
      }

      // Store interaction in history with role
      console.log('Storing interaction in history');
      if (messageType && messageContent) {
        user.interactionHistory.push({
          type: messageType,
          content: messageContent,
          role: 'user'  // Set role for user interactions
        });
      } else {
        console.error('Failed to store interaction: Missing type or content');
      }

      // Process message based on type
      console.log('Processing message by type:', messageType);
      if (messageType === 'text') {
        console.log('Handling text message');
        await this.handleTextMessage(user, messageContent);
      } else if (messageType === 'audio') {
        console.log('Handling audio message');
        await this.handleAudioMessage(user, messageContent);
      } else if (messageType === 'image') {
        console.log('Handling image message');
        await this.handleImageMessage(user, messageContent);
      } else {
        console.log('Unknown message type, sending default response');
        await evolutionApi.sendText(
          whatsappNumber,
          '🤔 Desculpe, ainda não sei processar esse tipo de mensagem.'
        );
      }

      console.log('Current interaction history:', user.interactionHistory);
      await user.save();
      console.log('User saved successfully with updated interaction history.');
      console.log('=== WEBHOOK REQUEST END ===');
      return res.status(200).json({ message: 'Message processed successfully' });

    } catch (error) {
      console.error('=== ERROR PROCESSING WEBHOOK ===', {
        message: error.message,
        requestBody: JSON.stringify(req.body, null, 2),
        user: user ? { whatsappNumber: user.whatsappNumber, name: user.name } : null
      });
      console.error('Error details:', error); // Log the error details
      console.error('Stack trace:', error.stack);
      console.error('=== ERROR END ===');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ... (rest of the methods remain unchanged)
}

module.exports = new WebhookController();

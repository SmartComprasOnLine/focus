const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
const openaiService = require('../services/openaiService');

class WebhookController {
  async handleWebhook(req, res) {
    try {
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
      
      // Extrair informações do webhook da Evolution API
      const { messages } = req.body;
      if (!messages || !messages[0]) {
        return res.status(200).json({ message: 'No message in webhook' });
      }

      const message = messages[0];
      const whatsappNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text ||
                           'Media message received';
      const messageType = message.messageType || 'text';
      const userName = message.pushName || 'Novo Usuário';

      console.log('Processed message:', {
        whatsappNumber,
        messageContent,
        messageType,
        userName
      });

      // Find or create user
      let user = await User.findOne({ whatsappNumber });
      
      if (!user) {
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

        // Send welcome message
        await evolutionApi.sendText(
          whatsappNumber,
          `👋 Olá ${userName}! Bem-vindo ao seu assistente pessoal para TDAH!\n\n` +
          'Estou aqui para ajudar você a organizar sua rotina e melhorar seu foco. ' +
          'Você tem 7 dias de teste gratuito para experimentar todas as funcionalidades.\n\n' +
          'Como posso ajudar você hoje?'
        );
        
        return res.status(200).json({ message: 'Welcome message sent' });
      }

      // Update user name if different
      if (user.name !== userName && userName !== 'Novo Usuário') {
        user.name = userName;
      }

      // Check access
      if (!user.hasAccess()) {
        await evolutionApi.sendText(
          whatsappNumber,
          `❌ ${userName}, seu período de acesso expirou. Para continuar utilizando o serviço, escolha um plano:`
        );
        await evolutionApi.sendSubscriptionOptions(whatsappNumber);
        return res.status(200).json({ message: 'Subscription required message sent' });
      }

      // Store interaction in history
      user.interactionHistory.push({
        type: messageType,
        content: messageContent,
        role: 'user'
      });

      // Process message based on type
      switch (messageType) {
        case 'text':
          await this.handleTextMessage(user, messageContent);
          break;
        case 'audio':
          await this.handleAudioMessage(user, messageContent);
          break;
        case 'image':
          await this.handleImageMessage(user, messageContent);
          break;
        default:
          await evolutionApi.sendText(
            whatsappNumber,
            '🤔 Desculpe, ainda não sei processar esse tipo de mensagem.'
          );
      }

      await user.save();
      return res.status(200).json({ message: 'Message processed successfully' });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleTextMessage(user, content) {
    try {
      console.log('Generating AI response for:', {
        userName: user.name,
        content,
        planStatus: user.subscription.status
      });

      // Get AI coach response
      const coachResponse = await openaiService.generateCoachResponse(
        user.name,
        content,
        user.plan,
        user.interactionHistory.slice(-5) // Last 5 interactions for context
      );

      console.log('AI response generated:', coachResponse);

      // Store AI response in history
      user.interactionHistory.push({
        type: 'text',
        content: coachResponse,
        role: 'assistant'
      });

      // Send response to user
      await evolutionApi.sendText(user.whatsappNumber, coachResponse);

      // Check if it's time to send trial ending reminder
      if (user.subscription.status === 'em_teste') {
        const trialEndDate = new Date(user.subscription.trialEndDate);
        const oneDayBefore = new Date(trialEndDate);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);

        if (new Date() >= oneDayBefore && new Date() < trialEndDate) {
          await evolutionApi.sendText(
            user.whatsappNumber,
            `⚠️ ${user.name}, seu período de teste termina amanhã! ` +
            'Para continuar tendo acesso a todas as funcionalidades, escolha um de nossos planos.'
          );
        }
      }

    } catch (error) {
      console.error('Error handling text message:', error);
      await evolutionApi.sendText(
        user.whatsappNumber,
        '😅 Ops! Tive um pequeno problema. Pode tentar novamente?'
      );
    }
  }

  async handleAudioMessage(user, audioUrl) {
    try {
      await evolutionApi.sendText(
        user.whatsappNumber,
        `🎵 ${user.name}, recebi seu áudio! Em breve teremos suporte para processamento de mensagens de voz.`
      );
    } catch (error) {
      console.error('Error handling audio message:', error);
      await evolutionApi.sendText(
        user.whatsappNumber,
        '😅 Ops! Tive um problema ao processar seu áudio. Pode tentar enviar uma mensagem de texto?'
      );
    }
  }

  async handleImageMessage(user, imageUrl) {
    try {
      await evolutionApi.sendText(
        user.whatsappNumber,
        `🖼️ ${user.name}, recebi sua imagem! Em breve teremos suporte para processamento de imagens.`
      );
    } catch (error) {
      console.error('Error handling image message:', error);
      await evolutionApi.sendText(
        user.whatsappNumber,
        '😅 Ops! Tive um problema ao processar sua imagem. Pode tentar enviar uma mensagem de texto?'
      );
    }
  }
}

module.exports = new WebhookController();
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');
const openaiService = require('../services/openaiService');

class WebhookController {
  async handleWebhook(req, res) {
    try {
      const { type, body } = req.body;
      
      if (type !== 'message') {
        return res.status(200).json({ message: 'Non-message event received' });
      }

      const { from, type: messageType, content } = body;
      const whatsappNumber = from.replace('@c.us', '');

      // Find or create user
      let user = await User.findOne({ whatsappNumber });
      
      if (!user) {
        // New user - start trial
        user = await User.create({
          whatsappNumber,
          name: 'Novo Usuário', // Will be updated later
          subscription: {
            status: 'em_teste',
            trialStartDate: new Date(),
            trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        // Send welcome message
        await evolutionApi.sendWelcomeMessage(whatsappNumber, 'Novo Usuário');
        return res.status(200).json({ message: 'Welcome message sent' });
      }

      // Check access
      if (!user.hasAccess()) {
        await evolutionApi.sendText(
          whatsappNumber,
          '❌ Seu período de acesso expirou. Para continuar utilizando o serviço, escolha um plano:'
        );
        await evolutionApi.sendSubscriptionOptions(whatsappNumber);
        return res.status(200).json({ message: 'Subscription required message sent' });
      }

      // Store interaction in history
      user.interactionHistory.push({
        type: messageType,
        content: content || 'Media message received'
      });

      // Process message based on type
      switch (messageType) {
        case 'text':
          await this.handleTextMessage(user, content);
          break;
        case 'audio':
          await this.handleAudioMessage(user, content);
          break;
        case 'image':
          await this.handleImageMessage(user, content);
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
      // Get AI coach response
      const coachResponse = await openaiService.generateCoachResponse(
        user.name,
        content,
        user.plan,
        user.interactionHistory.slice(-5) // Last 5 interactions for context
      );

      // Send response to user
      await evolutionApi.sendText(user.whatsappNumber, coachResponse);

      // Check if it's time to send trial ending reminder
      if (user.subscription.status === 'em_teste') {
        const trialEndDate = new Date(user.subscription.trialEndDate);
        const oneDayBefore = new Date(trialEndDate);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);

        if (new Date() >= oneDayBefore && new Date() < trialEndDate) {
          await evolutionApi.sendTrialEndingReminder(user.whatsappNumber, user.name);
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
        '🎵 Recebi seu áudio! Em breve teremos suporte para processamento de mensagens de voz.'
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
        '🖼️ Recebi sua imagem! Em breve teremos suporte para processamento de imagens.'
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

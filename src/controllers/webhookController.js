const User = require('../models/User');
const Routine = require('../models/Routine');
const evolutionApi = require('../services/evolutionApi');
const openaiService = require('../services/openaiService');
const reminderService = require('../services/reminderService');
const stripeService = require('../services/stripeService');

const logMessage = (level, message) => {
    console.log(JSON.stringify({ level, message, timestamp: new Date().toISOString() }));
};

class WebhookController {
  async handleWebhook(req, res) {
    let user;
    try {
      logMessage('info', '=== WEBHOOK REQUEST START ===');
      logMessage('info', 'Webhook payload:', req.body);
      
      // Handle Stripe webhook events
      if (req.body.type === 'checkout.session.completed') {
        const session = req.body.data.object;
        const { userNumber, planType } = session.metadata;
        
        user = await User.findOne({ whatsappNumber: userNumber });
        if (!user) {
          logMessage('error', 'User not found for Stripe webhook:', userNumber);
          return res.status(404).json({ error: 'User not found' });
        }

          const timezoneService = require('../services/timezoneService');
          const subscriptionEnd = planType === 'mensal' 
            ? timezoneService.addMonths(timezoneService.getCurrentTime(), 1)
            : timezoneService.addYears(timezoneService.getCurrentTime(), 1);

        user.subscription = {
          status: 'ativa',
          plan: planType,
          startDate: new Date(),
          endDate: subscriptionEnd,
          paymentId: session.payment_intent
        };

        await user.save();

        await evolutionApi.sendText(
          userNumber,
          `🎉 Pagamento confirmado!\n\n` +
          `Seu Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)} foi ativado com sucesso.\n\n` +
          `Período: ${planType === 'mensal' ? '1 mês' : '1 ano'}\n` +
          `Validade: ${subscriptionEnd.toLocaleDateString()}\n\n` +
          `Continue contando comigo para organizar sua rotina e melhorar seu foco! 💪✨`
        );
        return res.status(200).json({ message: 'Subscription activated' });
      }
      
      // Handle WhatsApp messages
      const { data } = req.body;
      if (!data || !data.key || !data.message) {
        logMessage('warning', 'No message in webhook');
        return res.status(200).json({ message: 'No message in webhook' });
      }

      const whatsappNumber = data.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageContent = data.message?.conversation || 
                           data.message?.extendedTextMessage?.text ||
                           'Media message received';
      const messageType = data.messageType === 'conversation' ? 'text' : data.messageType || 'text';
      const userName = data.pushName || 'Novo Usuário';

      logMessage('info', 'Extracted values:', {
        whatsappNumber,
        messageContent,
        messageType,
        userName
      });

      logMessage('info', 'Finding user:', whatsappNumber);
      user = await User.findOne({ whatsappNumber });
      
      if (!user) {
        logMessage('info', 'Creating new user:', {
          whatsappNumber,
          userName
        });
        
        user = await User.create({
          whatsappNumber,
          name: userName,
          subscription: {
            status: 'em_teste',
            trialStartDate: new Date(),
            trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });

        logMessage('info', 'New user created:', user);
        logMessage('info', 'Sending welcome message');
        await evolutionApi.sendWelcomeMessage(whatsappNumber, userName);
        
        logMessage('info', 'Welcome message sent');
        return res.status(200).json({ message: 'Welcome message sent' });
      }

      if (user.name !== userName && userName !== 'Novo Usuário') {
        logMessage('info', 'Updating user name:', {
          old: user.name,
          new: userName
        });
        user.name = userName;
        await user.save();
      }

      logMessage('info', 'Checking user access:', {
        status: user.subscription.status,
        hasAccess: user.hasAccess(),
        trialEndDate: user.subscription.trialEndDate
      });

      const timezoneService = require('../services/timezoneService');
      const now = timezoneService.getCurrentTime();
      const trialEndDate = timezoneService.endOfDay(user.subscription.trialEndDate);
      const daysRemaining = timezoneService.getDaysBetween(now, trialEndDate);

      const monthlyPrice = (process.env.PLAN_MONTHLY_PRICE / 100).toFixed(2);
      const yearlyPrice = (process.env.PLAN_YEARLY_PRICE / 100).toFixed(2);

      if (!user.hasAccess()) {
        logMessage('warning', 'User access expired, sending subscription options');
        await evolutionApi.sendList(
          whatsappNumber,
          "Escolha seu plano",
          "Seu período de teste expirou! Para continuar tendo acesso e manter seu progresso, escolha um plano:",
          "Ver Planos",
          [
            {
              title: "Planos Disponíveis",
              rows: [
                {
                  title: "Plano Mensal",
                  description: `R$ ${monthlyPrice}/mês - Acesso a todas as funcionalidades`,
                  rowId: "plano_mensal"
                },
                {
                  title: "Plano Anual",
                  description: `R$ ${yearlyPrice}/ano - Economia de 2 meses!`,
                  rowId: "plano_anual"
                }
              ]
            }
          ]
        );
        return res.status(200).json({ message: 'Subscription required message sent' });
      } else if (daysRemaining === 1) {
        await evolutionApi.sendList(
          whatsappNumber,
          "Escolha seu plano",
          "Seu período de teste termina amanhã! Para continuar tendo acesso e manter seu progresso, escolha um plano:",
          "Ver Planos",
          [
            {
              title: "Planos Disponíveis",
              rows: [
                {
                  title: "Plano Mensal",
                  description: `R$ ${monthlyPrice}/mês - Acesso a todas as funcionalidades`,
                  rowId: "plano_mensal"
                },
                {
                  title: "Plano Anual",
                  description: `R$ ${yearlyPrice}/ano - Economia de 2 meses!`,
                  rowId: "plano_anual"
                }
              ]
            }
          ]
        );
      }

      if (messageType && messageContent) {
        // Check for plan selection
        const planMatch = messageContent.toLowerCase().match(/plano_(mensal|anual)/);
        if (planMatch) {
          const planType = planMatch[1];
          
          try {
            const session = await stripeService.createPaymentSession(planType, whatsappNumber);
            
            await evolutionApi.sendText(
              whatsappNumber,
              `Ótima escolha! 🎉\n\n` +
              `Para ativar seu Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)}, clique no link abaixo para realizar o pagamento de forma segura:\n\n` +
              `${session.url}\n\n` +
              `Após o pagamento, seu plano será ativado automaticamente e você poderá continuar usando todas as funcionalidades! 💪`
            );

            // Store session ID in user data
            user.subscription.pendingPayment = {
              sessionId: session.id,
              planType: planType,
              createdAt: new Date()
            };
            await user.save();
            return res.status(200).json({ message: 'Payment link sent' });
          } catch (error) {
            console.error('Error creating payment session:', error);
            await evolutionApi.sendText(
              whatsappNumber,
              "Desculpe, tivemos um problema ao processar sua solicitação. Por favor, tente novamente em alguns minutos."
            );
            return res.status(500).json({ error: 'Payment session creation failed' });
          }
        }

        user.interactionHistory.push({
          type: messageType,
          content: messageContent,
          role: 'user'
        });
        logMessage('info', 'User interaction stored:', user.interactionHistory);
      }

      logMessage('info', 'Processing message by type:', messageType);
      if (messageType === 'text') {
        logMessage('info', 'Handling text message');
        const response = await this.handleTextMessage(user, messageContent);
        
        if (response) {
          user.interactionHistory.push({
            type: 'text',
            content: response,
            role: 'assistant'
          });
          logMessage('info', 'Assistant response stored:', user.interactionHistory);
        }
      } else if (messageType === 'audio') {
        logMessage('info', 'Handling audio message');
        await this.handleAudioMessage(user, messageContent);
      } else if (messageType === 'image') {
        logMessage('info', 'Handling image message');
        await this.handleImageMessage(user, messageContent);
      } else {
        logMessage('warning', 'Unknown message type, sending default response');
        await evolutionApi.sendText(
          whatsappNumber,
          '🤔 Desculpe, ainda não sei processar esse tipo de mensagem.'
        );
      }

      logMessage('info', 'Current interaction history:', user.interactionHistory);
      await user.save();
      logMessage('info', 'User saved successfully with updated interaction history.');
      logMessage('info', '=== WEBHOOK REQUEST END ===');
      return res.status(200).json({ message: 'Message processed successfully' });

    } catch (error) {
      logMessage('error', '=== ERROR PROCESSING WEBHOOK ===', {
        message: error.message,
        requestBody: JSON.stringify(req.body, null, 2),
        user: user ? { whatsappNumber: user.whatsappNumber, name: user.name } : null
      });
      logMessage('error', 'Error details:', error);
      logMessage('error', 'Stack trace:', error.stack);
      logMessage('error', '=== ERROR END ===');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleTextMessage(user, messageContent) {
    logMessage('info', 'Processing text message:', messageContent);

    const isRoutineInfo = this.isRoutineInformation(messageContent);
    const isPlanConfirmation = this.isPlanConfirmation(messageContent);
    
    if (isRoutineInfo && !user.currentPlan) {
      logMessage('info', 'Creating initial plan based on user response');
      const routineController = require('./routineController');
      await routineController.createInitialPlan(user, {
        initialMessage: messageContent,
        previousResponses: user.interactionHistory
      });
      return "Ótimo! Estou criando seu plano personalizado com base nas informações que você me forneceu. 🎯";
    }

    if (isPlanConfirmation && user.currentPlan) {
      logMessage('info', 'User confirmed the plan, starting daily tracking');
      
      const routine = await Routine.findById(user.currentPlan);
      if (!routine) {
        throw new Error('Routine not found');
      }

      await reminderService.setupReminders(user, routine);
      logMessage('info', 'Reminders configured successfully');

      await evolutionApi.sendText(
        user.whatsappNumber,
        "Perfeito! 🎉 Seu plano está confirmado e os lembretes foram configurados.\n\n" +
        "🔸 Você receberá lembretes 5 minutos antes de cada atividade\n" +
        "🔸 Durante as atividades, enviarei mensagens de motivação\n" +
        "🔸 Ao final de cada atividade, farei um checkpoint do seu progresso\n\n" +
        "Preparado para começar? Vamos focar na primeira tarefa do seu dia! 💪"
      );
      return;
    }

    const response = await openaiService.generateCoachResponse(
        user.name,
        messageContent,
        user.currentPlan,
        user.interactionHistory
    );

    await evolutionApi.sendText(
        user.whatsappNumber,
        response
    );

    return response;
  }

  isRoutineInformation(message) {
    const routineKeywords = [
      'rotina', 'horário', 'agenda', 'dia', 'manhã', 'tarde', 'noite',
      'acordo', 'durmo', 'trabalho', 'estudo', 'faço', 'costumo',
      'sempre', 'geralmente', 'normalmente', 'hábito'
    ];

    const lowercaseMessage = message.toLowerCase();
    return routineKeywords.some(keyword => lowercaseMessage.includes(keyword));
  }

  isPlanConfirmation(message) {
    const confirmationKeywords = [
      'sim', 'ok', 'confirmo', 'confirmado', 'pode ser',
      'gostei', 'aceito', 'vamos', 'bom', 'ótimo', 'perfeito'
    ];

    const lowercaseMessage = message.toLowerCase();
    return confirmationKeywords.some(keyword => lowercaseMessage.includes(keyword));
  }

  async handleAudioMessage(user, messageContent) {
    logMessage('info', 'Processing audio message:', messageContent);
    await evolutionApi.sendText(
      user.whatsappNumber,
      'Recebi seu áudio, mas ainda estou aprendendo a processá-lo!'
    );
  }

  async handleImageMessage(user, messageContent) {
    logMessage('info', 'Processing image message:', messageContent);
    await evolutionApi.sendText(
      user.whatsappNumber,
      'Recebi sua imagem, mas ainda estou aprendendo a processá-la!'
    );
  }
}

module.exports = new WebhookController();

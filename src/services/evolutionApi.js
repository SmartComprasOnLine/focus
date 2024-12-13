const axios = require('axios');

class EvolutionApiService {
  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
    this.instance = process.env.EVOLUTION_INSTANCE;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    });
  }

  async sendText(number, text) {
    try {
      const response = await this.axiosInstance.post(`/message/sendText/${this.instance}`, {
        number,
        text
      });
      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error);
      throw error;
    }
  }

  async sendMedia(number, mediatype, mimetype, caption, mediaUrl) {
    try {
      const response = await this.axiosInstance.post(`/message/sendMedia/${this.instance}`, {
        number,
        mediatype,
        mimetype,
        caption,
        media: mediaUrl
      });
      return response.data;
    } catch (error) {
      console.error('Error sending media:', error);
      throw error;
    }
  }

  async sendAudio(number, audioUrl) {
    try {
      const response = await this.axiosInstance.post(`/message/sendWhatsAppAudio/${this.instance}`, {
        number,
        audio: audioUrl
      });
      return response.data;
    } catch (error) {
      console.error('Error sending audio:', error);
      throw error;
    }
  }

  async sendList(number, title, description, buttonText, sections) {
    try {
      const response = await this.axiosInstance.post(`/message/sendList/${this.instance}`, {
        number,
        title,
        description,
        buttonText,
        sections
      });
      return response.data;
    } catch (error) {
      console.error('Error sending list:', error);
      throw error;
    }
  }

  async sendSubscriptionOptions(number) {
    const monthlyPrice = (process.env.PLAN_MONTHLY_PRICE / 100).toFixed(2);
    const yearlyPrice = (process.env.PLAN_YEARLY_PRICE / 100).toFixed(2);

    return this.sendList(number, 
      'Escolha um plano',
      'Planos disponíveis',
      'Ver Planos',
      [{
        title: 'Planos',
        rows: [
          {
            title: 'Plano Mensal',
            description: `R$ ${monthlyPrice} por mês`,
            rowId: 'mensal'
          },
          {
            title: 'Plano Anual',
            description: `R$ ${yearlyPrice} por ano`,
            rowId: 'anual'
          }
        ]
      }]
    );
  }

  async sendWelcomeMessage(number, userName) {
    const welcomeMessage = 
      `Olá ${userName}! 👋\n\n` +
      `Bem-vindo ao seu Coach Pessoal para TDAH! 🌟\n\n` +
      `Estou aqui para ajudar você a:\n` +
      `✅ Organizar sua rotina\n` +
      `✅ Melhorar seu foco\n` +
      `✅ Aumentar sua produtividade\n` +
      `✅ Manter sua disposição\n\n` +
      `Você tem 7 dias GRATUITOS para experimentar todas as funcionalidades!\n\n` +
      `Vamos começar? Me conte um pouco sobre sua rotina atual. 😊`;

    return this.sendText(number, welcomeMessage);
  }

  async sendTrialEndingReminder(number, userName) {
    const message = 
      `Olá ${userName}! ⏰\n\n` +
      `Seu período de teste gratuito termina amanhã!\n\n` +
      `Para continuar tendo acesso ao seu coach pessoal e manter seu progresso, escolha um de nossos planos:\n`;

    await this.sendText(number, message);
    return this.sendSubscriptionOptions(number);
  }
}

module.exports = new EvolutionApiService();

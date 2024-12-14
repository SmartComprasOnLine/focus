const axios = require('axios');
require('dotenv').config();

class EvolutionApiService {
  constructor() {
    this.baseURL = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
    this.instance = process.env.EVOLUTION_INSTANCE; 
    console.log('EVOLUTION_INSTANCE:', this.instance);
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    });
  }

  calculateDelay(text) {
    const charactersPerSecond = 3.33;
    const minDelay = 2000;
    const maxDelay = 8000;
    
    const delay = Math.ceil(text.length / charactersPerSecond) * 1000;
    return Math.min(Math.max(delay, minDelay), maxDelay);
  }

  async sendText(number, text) {
    try {
      console.log('SendText called with:', { number, text });
      console.log('Current instance:', this.instance);
      console.log('Current baseURL:', this.baseURL);
      
      const delay = this.calculateDelay(text);
      const url = `/message/sendText/${this.instance}`;
      console.log('Request URL:', url);
      
      const response = await this.axiosInstance.post(url, {
        number,
        text,
        delay
      });
      return response.data;
    } catch (error) {
      console.error('Error sending text message:', error);
      throw error;
    }
  }

  async sendMedia(number, mediatype, mimetype, caption, mediaUrl) {
    try {
      const delay = caption ? this.calculateDelay(caption) : 3000;
      const response = await this.axiosInstance.post(`/message/sendMedia/${this.instance}`, {
        number,
        mediatype,
        mimetype,
        caption,
        media: mediaUrl,
        delay
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
        audio: audioUrl,
        delay: 2000
      });
      return response.data;
    } catch (error) {
      console.error('Error sending audio:', error);
      throw error;
    }
  }

  async sendList(number, title, description, buttonText, sections) {
    try {
      const data = {
        number: number,
        title: title,
        description: description,
        buttonText: buttonText,
        footerText: "Escolha uma opção",
        sections: sections,
        delay: 1000
      };

      console.log('Sending list with data:', JSON.stringify(data, null, 2));

      const response = await this.axiosInstance.post(`/message/sendList/${this.instance}`, data);
      return response.data;
    } catch (error) {
      console.error('Error sending list:', error);
      // Fallback to text message if list fails
      await this.sendText(
        number,
        `${description}\n\n` +
        sections[0].rows.map(row => 
          `• ${row.title}: ${row.description}`
        ).join('\n\n') +
        '\n\nResponda com o nome do plano desejado.'
      );
    }
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

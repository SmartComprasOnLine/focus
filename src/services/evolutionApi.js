const axios = require('axios');

class EvolutionApi {
    constructor() {
        this.instance = process.env.EVOLUTION_INSTANCE || 'desafio';
        this.baseURL = process.env.EVOLUTION_API_URL || 'https://evo.meuchatinteligente.com.br';
        this.apiKey = process.env.EVOLUTION_API_KEY;

        // Initialize axios instance
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.apiKey
            }
        });
    }

    async sendText(number, text) {
        try {
            console.log('SendText called with:', { number, text });
            console.log('Current instance:', this.instance);
            console.log('Current baseURL:', this.baseURL);
            console.log('Request URL:', `/message/sendText/${this.instance}`);

            const response = await this.api.post(`/message/sendText/${this.instance}`, {
                number: `${number}@s.whatsapp.net`,
                options: {
                    delay: 1000,
                    presence: 'composing'
                },
                textMessage: {
                    text
                }
            });

            return response;
        } catch (error) {
            console.error('Error sending text message:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendList(number, title, description, buttonText, sections, footerText, delay = 1000) {
        try {
            console.log('Sending list with data:', {
                number,
                title,
                description,
                buttonText,
                sections,
                footerText,
                delay
            });

            const response = await this.api.post(`/message/sendList/${this.instance}`, {
                number: `${number}@s.whatsapp.net`,
                options: {
                    delay,
                    presence: 'composing'
                },
                listMessage: {
                    title,
                    description,
                    buttonText,
                    sections,
                    footerText
                }
            });

            return response;
        } catch (error) {
            console.error('Error sending list message:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new EvolutionApi();

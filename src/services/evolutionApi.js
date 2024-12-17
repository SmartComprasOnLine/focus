const axios = require('axios');

class EvolutionApi {
    constructor() {
        this.instance = process.env.EVOLUTION_INSTANCE;
        this.baseURL = process.env.EVOLUTION_API_URL;
        this.apiKey = process.env.EVOLUTION_API_KEY;

        if (!this.instance || !this.baseURL || !this.apiKey) {
            throw new Error('Missing required Evolution API configuration');
        }

        // Initialize axios instance
        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey
            }
        });
    }

    async sendText(number, text) {
        try {
            console.log('SendText called with:', { number, text });
            console.log('Current instance:', this.instance);
            console.log('Current baseURL:', this.baseURL);
            console.log('Request URL:', `/message/sendText/${this.instance}`);
            console.log('Request body:', {
                number,
                options: {
                    delay: 1000,
                    presence: 'composing'
                },
                textMessage: {
                    text
                }
            });

            const response = await this.api.post(`/message/sendText/${this.instance}`, {
                number: number,
                options: {
                    delay: 1000,
                    presence: 'composing'
                },
                textMessage: {
                    text
                }
            });

            if (!response.data || response.data.error) {
                throw new Error(response.data?.error || 'Failed to send message');
            }

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
                number: number,
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

            if (!response.data || response.data.error) {
                throw new Error(response.data?.error || 'Failed to send list message');
            }

            return response;
        } catch (error) {
            console.error('Error sending list message:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new EvolutionApi();

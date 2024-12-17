const axios = require('axios');

class EvolutionApi {
    constructor() {
        this.instance = process.env.EVOLUTION_INSTANCE;
        this.baseURL = process.env.EVOLUTION_API_URL;
        this.apiKey = process.env.EVOLUTION_API_KEY;

        if (!this.instance || !this.baseURL || !this.apiKey) {
            throw new Error('Missing required Evolution API configuration');
        }
    }

    formatNumber(number) {
        // Remove any non-digit characters
        const cleaned = number.replace(/\D/g, '');
        // Add country code if not present
        return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    }

    async sendText(number, text) {
        try {
            console.log('\n=== Evolution API Request ===');
            console.log('Method: POST');
            console.log('URL:', `${this.baseURL}/message/sendText/${this.instance}`);
            console.log('Headers:', {
                'Content-Type': 'application/json',
                'apikey': this.apiKey
            });
            console.log('Body:', {
                number,
                text
            });

            const response = await axios({
                method: 'post',
                url: `${this.baseURL}/message/sendText/${this.instance}`,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
                },
                data: {
                    number: number,
                    text: text
                }
            });

            console.log('\n=== Evolution API Response ===');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Data:', response.data);
            
            if (!response.data || response.data.error) {
                console.error('\n=== Evolution API Error ===');
                console.error('Status:', response.status);
                console.error('Headers:', response.headers);
                console.error('Data:', response.data);
                throw new Error(response.data?.error || 'Failed to send message');
            }

            return response;
        } catch (error) {
            console.error('\n=== Evolution API Error ===');
            console.error('Error sending text message:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers,
                    data: error.config?.data
                }
            });
            throw error;
        }
    }

    async sendList(number, title, description, buttonText, sections, footerText) {
        try {
            const data = {
                number: number,
                title: title,
                description: description,
                buttonText: buttonText,
                sections: sections,
                footerText: footerText
            };

            console.log('\n=== Evolution API Request ===');
            console.log('Method: POST');
            console.log('URL:', `${this.baseURL}/message/sendList/${this.instance}`);
            console.log('Headers:', {
                'Content-Type': 'application/json',
                'apikey': this.apiKey
            });
            console.log('Body:', data);

            const response = await axios({
                method: 'post',
                url: `${this.baseURL}/message/sendList/${this.instance}`,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
                },
                data: data
            });

            console.log('\n=== Evolution API Response ===');
            console.log('Status:', response.status);
            console.log('Headers:', response.headers);
            console.log('Data:', response.data);

            if (!response.data || response.data.error) {
                console.error('\n=== Evolution API Error ===');
                console.error('Status:', response.status);
                console.error('Headers:', response.headers);
                console.error('Data:', response.data);
                throw new Error(response.data?.error || 'Failed to send list message');
            }

            return response;
        } catch (error) {
            console.error('\n=== Evolution API Error ===');
            console.error('Error sending list message:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    headers: error.config?.headers,
                    data: error.config?.data
                }
            });
            throw error;
        }
    }
}

module.exports = new EvolutionApi();

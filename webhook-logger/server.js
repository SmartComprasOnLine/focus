const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 4000;
const MAIN_SERVICE_URL = process.env.MAIN_SERVICE_URL || 'http://app:3001/api/webhook';

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    try {
        // Log detalhado do payload recebido
        console.log('=== WEBHOOK PAYLOAD START ===');
        console.log(JSON.stringify(req.body, null, 2));
        console.log('=== WEBHOOK PAYLOAD END ===');
        
        // Verificar se é um evento de mensagem
        if (req.body.event !== 'messages.upsert') {
            console.log('Ignoring non-message event:', req.body.event);
            return res.status(200).send('Event ignored');
        }

        // Extrair dados da mensagem
        const { data, instance } = req.body;
        
        // Verificar se a mensagem é válida
        if (!data || !data.key || !data.message) {
            console.log('Invalid message format:', req.body);
            return res.status(200).send('Invalid message format');
        }

        // Determinar o tipo de mensagem
        let messageType = 'unknown';
        let messageContent = '';

        if (data.message.conversation) {
            messageType = 'text';
            messageContent = data.message.conversation;
        } else if (data.message.audioMessage) {
            messageType = 'audio';
            messageContent = data.message.audioMessage.url || 'Audio received';
        } else if (data.message.imageMessage) {
            messageType = 'image';
            messageContent = data.message.imageMessage.url || 'Image received';
        }

        const requestBody = {
            instance,
            messages: [
                {
                    key: {
                        remoteJid: data.key.remoteJid,
                        fromMe: data.key.fromMe,
                        id: data.key.id
                    },
                    pushName: data.pushName,
                    message: {
                        conversation: messageContent,
                        messageTimestamp: data.messageTimestamp
                    },
                    messageType,
                    metadata: {
                        source: data.source,
                        instanceId: data.instanceId
                    }
                }
            ]
        };

        console.log('Sending request to main service:', {
            url: MAIN_SERVICE_URL,
            body: JSON.stringify(requestBody, null, 2)
        });

        // Encaminhar a requisição para o serviço principal
        const response = await fetch(MAIN_SERVICE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log('=== RESPONSE FROM MAIN SERVICE ===');
        console.log(JSON.stringify(responseData, null, 2));
        console.log('=== RESPONSE END ===');
        
        res.status(200).send('Webhook received and processed');
    } catch (error) {
        console.error('=== ERROR PROCESSING WEBHOOK ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        console.error('=== ERROR END ===');
        res.status(500).send('Error processing webhook');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook logger listening on port ${PORT}`);
    console.log(`Main service URL: ${MAIN_SERVICE_URL}`);
});
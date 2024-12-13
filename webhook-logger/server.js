const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
const PORT = 80;

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
        const { data } = req.body;
        
        // Encaminhar a requisição para o serviço principal
        const response = await fetch('http://app:3000/api/webhook/whatsapp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        key: {
                            remoteJid: data.key.remoteJid,
                            fromMe: data.key.fromMe,
                            id: data.key.id
                        },
                        pushName: data.pushName,
                        message: {
                            conversation: data.message.conversation,
                            messageTimestamp: data.messageTimestamp
                        },
                        messageType: data.messageType
                    }
                ]
            })
        });

        const responseData = await response.json();
        console.log('=== RESPONSE FROM MAIN SERVICE ===');
        console.log(JSON.stringify(responseData, null, 2));
        console.log('=== RESPONSE END ===');
        
        res.status(200).send('Webhook received and processed');
    } catch (error) {
        console.error('=== ERROR PROCESSING WEBHOOK ===');
        console.error(error);
        console.error('=== ERROR END ===');
        res.status(500).send('Error processing webhook');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook logger listening on port ${PORT}`);
});
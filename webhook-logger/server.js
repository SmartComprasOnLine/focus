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
                            remoteJid: req.body.key?.remoteJid || req.body.from,
                            fromMe: req.body.key?.fromMe || false,
                            id: req.body.key?.id || req.body.id
                        },
                        message: {
                            conversation: req.body.body || req.body.text || req.body.message,
                            messageTimestamp: req.body.messageTimestamp || Date.now()
                        }
                    }
                ]
            })
        });

        const data = await response.json();
        console.log('=== RESPONSE FROM MAIN SERVICE ===');
        console.log(JSON.stringify(data, null, 2));
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
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
const PORT = 80;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    try {
        // Encaminhar a requisição para o serviço principal
        const response = await fetch('http://app:3000/api/webhook/whatsapp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        console.log('Response from main service:', data);
        
        res.status(200).send('Webhook received and processed');
    } catch (error) {
        console.error('Error forwarding webhook:', error);
        res.status(500).send('Error processing webhook');
    }
});

app.listen(PORT, () => {
    console.log(`Webhook logger listening on port ${PORT}`);
});
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 4000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    res.status(200).send('Webhook received');
});

app.listen(PORT, () => {
    console.log(`Webhook logger listening on port ${PORT}`);
});

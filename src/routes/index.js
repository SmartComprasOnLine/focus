const express = require('express');
const webhookController = require('../controllers/webhookController');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// Webhook routes
router.post('/api/webhook', webhookController.handleWebhook.bind(webhookController));

// Subscription routes
router.post('/subscription/create-checkout', subscriptionController.createCheckoutSession.bind(subscriptionController));
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), subscriptionController.handleWebhook.bind(subscriptionController));

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const evolutionApi = require('../services/evolutionApi');

class SubscriptionController {
  async createCheckoutSession(req, res) {
    try {
      const { whatsappNumber, planType } = req.body;

      const user = await User.findOne({ whatsappNumber });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Set price based on plan type
      const priceId = planType === 'monthly' 
        ? process.env.PLAN_MONTHLY_PRICE 
        : process.env.PLAN_YEARLY_PRICE;

      // Create or retrieve Stripe customer
      let customer;
      if (user.subscription.stripeCustomerId) {
        customer = await stripe.customers.retrieve(user.subscription.stripeCustomerId);
      } else {
        customer = await stripe.customers.create({
          name: user.name,
          metadata: {
            whatsappNumber: user.whatsappNumber
          }
        });
        user.subscription.stripeCustomerId = customer.id;
        await user.save();
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `Coach TDAH - Plano ${planType === 'monthly' ? 'Mensal' : 'Anual'}`,
                description: 'Acesso ao coach pessoal para TDAH'
              },
              unit_amount: parseInt(priceId),
              recurring: {
                interval: planType === 'monthly' ? 'month' : 'year'
              }
            },
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
        metadata: {
          whatsappNumber: user.whatsappNumber,
          planType
        }
      });

      return res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: 'Error creating checkout session' });
    }
  }

  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(event.data.object);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object);
          break;
      }

      return res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      return res.status(400).json({ error: 'Webhook error' });
    }
  }

  async handleCheckoutComplete(session) {
    try {
      const { whatsappNumber, planType } = session.metadata;
      const user = await User.findOne({ whatsappNumber });

      if (!user) {
        throw new Error('User not found');
      }

      // Update subscription details
      user.subscription.status = 'ativa';
      user.subscription.plan = planType;
      user.subscription.startDate = new Date();
      user.subscription.endDate = planType === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await user.save();

      // Send confirmation message
      await evolutionApi.sendText(
        whatsappNumber,
        `🎉 Parabéns! Sua assinatura do plano ${planType === 'monthly' ? 'mensal' : 'anual'} foi ativada com sucesso!\n\nContinuarei te ajudando a manter o foco e organização. Conte comigo! 💪`
      );
    } catch (error) {
      console.error('Error handling checkout complete:', error);
    }
  }

  async handleInvoicePaid(invoice) {
    try {
      const customer = await stripe.customers.retrieve(invoice.customer);
      const user = await User.findOne({ 
        'subscription.stripeCustomerId': invoice.customer 
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Extend subscription period
      const subscriptionItem = invoice.lines.data[0];
      const interval = subscriptionItem.plan.interval;
      
      user.subscription.endDate = interval === 'month'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await user.save();

      // Send confirmation message
      await evolutionApi.sendText(
        user.whatsappNumber,
        '✅ Pagamento recebido com sucesso! Sua assinatura continua ativa.'
      );
    } catch (error) {
      console.error('Error handling invoice paid:', error);
    }
  }

  async handlePaymentFailed(invoice) {
    try {
      const user = await User.findOne({ 
        'subscription.stripeCustomerId': invoice.customer 
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Send payment failed message
      await evolutionApi.sendText(
        user.whatsappNumber,
        '❌ Ops! Tivemos um problema com seu pagamento. Por favor, verifique seus dados de pagamento para continuar usando o serviço.'
      );
    } catch (error) {
      console.error('Error handling payment failed:', error);
    }
  }

  async handleSubscriptionCanceled(subscription) {
    try {
      const user = await User.findOne({ 
        'subscription.stripeCustomerId': subscription.customer 
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Update user subscription status
      user.subscription.status = 'inativa';
      user.subscription.endDate = new Date();
      await user.save();

      // Send cancellation message
      await evolutionApi.sendText(
        user.whatsappNumber,
        '😢 Sua assinatura foi cancelada. Esperamos que você volte em breve!\n\nCaso queira reativar, é só me avisar.'
      );
    } catch (error) {
      console.error('Error handling subscription canceled:', error);
    }
  }
}

module.exports = new SubscriptionController();

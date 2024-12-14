const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  async createPaymentSession(planType, userNumber) {
    try {
      const prices = {
        mensal: {
          amount: process.env.PLAN_MONTHLY_PRICE,
          interval: 'month'
        },
        anual: {
          amount: process.env.PLAN_YEARLY_PRICE,
          interval: 'year'
        }
      };

      const plan = prices[planType];
      
      // Create a payment session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)} - Coach IA`,
                description: `Assinatura ${planType} do Coach IA para TDAH`
              },
              unit_amount: plan.amount,
              recurring: {
                interval: plan.interval
              }
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.MAIN_SERVICE_URL}/success?session_id={CHECKOUT_SESSION_ID}&number=${userNumber}`,
        cancel_url: `${process.env.MAIN_SERVICE_URL}/cancel?number=${userNumber}`,
        metadata: {
          userNumber: userNumber,
          planType: planType
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error;
    }
  }

  async createPaymentIntent(planType, userNumber) {
    try {
      const prices = {
        mensal: process.env.PLAN_MONTHLY_PRICE,
        anual: process.env.PLAN_YEARLY_PRICE
      };

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: prices[planType],
        currency: 'brl',
        payment_method_types: ['card'],
        metadata: {
          userNumber: userNumber,
          planType: planType
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          await this.handleSuccessfulPayment(session);
          break;
        
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await this.handleSuccessfulPayment(paymentIntent);
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  async handleSuccessfulPayment(paymentData) {
    try {
      const { userNumber, planType } = paymentData.metadata;
      
      // Update user subscription status in database
      const User = require('../models/User');
      const user = await User.findOne({ whatsappNumber: userNumber });
      
      if (!user) {
        throw new Error('User not found');
      }

      const subscriptionEnd = new Date();
      if (planType === 'mensal') {
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
      } else if (planType === 'anual') {
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
      }

      user.subscription = {
        status: 'ativa',
        plan: planType,
        startDate: new Date(),
        endDate: subscriptionEnd,
        paymentId: paymentData.id
      };

      await user.save();

      // Send confirmation message via WhatsApp
      const evolutionApi = require('./evolutionApi');
      await evolutionApi.sendText(
        userNumber,
        `🎉 Pagamento confirmado!\n\n` +
        `Seu Plano ${planType.charAt(0).toUpperCase() + planType.slice(1)} foi ativado com sucesso.\n\n` +
        `Período: ${planType === 'mensal' ? '1 mês' : '1 ano'}\n` +
        `Validade: ${subscriptionEnd.toLocaleDateString()}\n\n` +
        `Continue contando comigo para organizar sua rotina e melhorar seu foco! 💪✨`
      );

    } catch (error) {
      console.error('Error handling successful payment:', error);
      throw error;
    }
  }
}

module.exports = new StripeService();

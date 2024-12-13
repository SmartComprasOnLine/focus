# Focus - ADHD Coach WhatsApp Bot

A MicroSaaS system integrated with Evolution API for WhatsApp, designed to help people with ADHD organize their routines. The system acts as a personal coach, helping users improve their productivity, focus, and disposition.

## Features

- WhatsApp message processing (text, audio, and image)
- Automated messaging and notifications
- Personalized plan generation based on user profile
- Dynamic plan adjustments by AI coach
- Subscription management with Stripe integration
- 7-day free trial period

## Tech Stack

- Node.js
- Express.js
- MongoDB
- OpenAI GPT-4
- Evolution API (WhatsApp)
- Stripe (Payments)

## Prerequisites

- Node.js >= 18.0.0
- MongoDB
- Evolution API instance
- OpenAI API key
- Stripe account

## Environment Variables

Create a `.env` file in the root directory with the following variables:

\`\`\`env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/focus_adhd

# Evolution API Configuration
EVOLUTION_API_URL=https://evo.meuchatinteligente.com.br
EVOLUTION_API_KEY=your_api_key
EVOLUTION_INSTANCE=your_instance

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Subscription Plans (in cents)
PLAN_MONTHLY_PRICE=9900
PLAN_YEARLY_PRICE=99900
\`\`\`

## Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/focus.git
   cd focus
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## API Endpoints

### Webhook Endpoints
- POST `/api/webhook/whatsapp` - WhatsApp webhook endpoint
- POST `/api/webhook/stripe` - Stripe webhook endpoint

### Subscription Endpoints
- POST `/api/subscription/create-checkout` - Create Stripe checkout session

### Health Check
- GET `/api/health` - Service health check

## WhatsApp Message Types Supported

1. Text Messages
   - User queries
   - Coach responses
   - System notifications

2. Audio Messages (Future Support)
   - Voice notes
   - Audio instructions

3. Image Messages (Future Support)
   - Visual aids
   - Progress tracking

## Subscription Plans

1. Free Trial
   - 7-day trial period
   - Full access to features
   - Automatic reminders before expiration

2. Paid Plans
   - Monthly subscription
   - Annual subscription (discounted)
   - Full access to all features

## Development

Start the development server with hot reload:
\`\`\`bash
npm run dev
\`\`\`

## Production

Start the production server:
\`\`\`bash
npm start
\`\`\`

## Testing

Run tests:
\`\`\`bash
npm test
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License.

const { OpenAI } = require('openai');
require('dotenv').config();

class OpenAIService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.systemPrompt = `
            Você é um coach pessoal especializado em TDAH focado em ajudar {userName} a melhorar sua produtividade, 
            foco e disposição. Seu objetivo é auxiliar na organização da rotina diária do usuário.
            
            Diretrizes:
            1. Mantenha respostas curtas e objetivas
            2. Use emojis para tornar a comunicação mais engajadora
            3. Foque em soluções práticas e alcançáveis
            4. Divida tarefas complexas em etapas menores
            5. Ofereça sugestões específicas baseadas no contexto do usuário
            6. Mantenha um tom motivador e compreensivo
            7. Evite sobrecarregar o usuário com muitas tarefas
        `;
    }

    async generateResponse(userName, userMessage, currentPlan = null, interactionHistory = []) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.systemPrompt.replace('{userName}', userName)
                }
            ];

            // Add interaction history
            if (interactionHistory && interactionHistory.length > 0) {
                const recentHistory = interactionHistory.slice(-5); // Get last 5 interactions
                recentHistory.forEach(interaction => {
                    messages.push({
                        role: interaction.role,
                        content: interaction.content
                    });
                });
            }

            // Add current plan context if available
            if (currentPlan) {
                messages.push({
                    role: 'system',
                    content: `Plano atual do usuário: ${JSON.stringify(currentPlan, null, 2)}`
                });
            }

            // Add user's current message
            messages.push({
                role: 'user',
                content: userMessage
            });

            const completion = await this.openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-4',
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating OpenAI response:', error);
            throw error;
        }
    }

    async analyzeIntent(message) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `
                            Você é um analisador de intenções. Sua tarefa é identificar a intenção principal 
                            na mensagem do usuário. Retorne apenas uma das seguintes opções:
                            
                            - SUBSCRIPTION_INQUIRY: Usuário pergunta sobre assinatura, preços, ou como continuar usando
                            - WELCOME: Primeira mensagem ou pedido de ajuda inicial
                            - ROUTINE_HELP: Pedido de ajuda com organização ou rotina
                            - PAYMENT_CONFIRMATION: Menção a pagamento ou comprovante
                            - NONE: Se nenhuma das opções acima corresponder
                            
                            Retorne apenas o identificador, sem explicações adicionais.
                        `
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0,
                max_tokens: 50
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error analyzing intent:', error);
            return 'NONE';
        }
    }
}

module.exports = new OpenAIService();

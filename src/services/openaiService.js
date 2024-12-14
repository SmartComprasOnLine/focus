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

    async generateInitialPlan(userName, userResponses) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: `
                        Você é um coach especializado em TDAH criando um plano personalizado para ${userName}.
                        Seu objetivo é criar um plano diário com atividades e lembretes que ajudem o usuário a:
                        1. Manter uma rotina estruturada
                        2. Gerenciar melhor seu tempo
                        3. Manter o foco nas tarefas
                        4. Incluir pausas estratégicas
                        5. Celebrar conquistas

                        Retorne um objeto JSON com esta estrutura exata:
                        {
                            "plan": "Descrição do plano em texto",
                            "reminders": [
                                {
                                    "activity": "Nome da atividade",
                                    "scheduledTime": "HH:mm",
                                    "type": "planejamento|trabalho|estudo|pausa|revisão",
                                    "messages": {
                                        "before": "Mensagem 5 minutos antes",
                                        "start": "Mensagem no início",
                                        "during": "Mensagem durante",
                                        "after": "Mensagem após"
                                    }
                                }
                            ]
                        }

                        Mantenha o plano realista e alcançável, com no máximo 6-8 atividades por dia.
                        Use emojis para tornar as mensagens mais engajadoras.
                        Inclua pausas regulares usando a técnica Pomodoro (25 min trabalho, 5 min pausa).
                        
                        IMPORTANTE: Retorne APENAS o objeto JSON, sem texto adicional.
                    `
                },
                {
                    role: 'user',
                    content: userResponses.initialMessage || ''
                }
            ];

            // Add previous responses if available
            if (userResponses.previousResponses) {
                userResponses.previousResponses.forEach(response => {
                    if (response.role === 'user') {
                        messages.push({
                            role: 'user',
                            content: response.content
                        });
                    }
                });
            }

            const completion = await this.openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-4',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
                response_format: { type: "json_object" }
            });

            console.log('OpenAI Response:', completion.choices[0].message.content);
            
            try {
                const result = JSON.parse(completion.choices[0].message.content);
                if (!result.plan || !Array.isArray(result.reminders)) {
                    throw new Error('Invalid response format');
                }
                return {
                    plan: result.plan,
                    reminders: result.reminders
                };
            } catch (parseError) {
                console.error('Error parsing OpenAI response:', parseError);
                console.error('Response content:', completion.choices[0].message.content);
                throw new Error('Failed to parse plan from OpenAI response');
            }
        } catch (error) {
            console.error('Error generating initial plan:', error);
            throw error;
        }
    }

    async analyzePlanProgress(currentPlan, completedTasks, feedback) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: `
                        Você é um coach especializado em TDAH analisando o progresso do plano do usuário.
                        Analise as tarefas completadas e o feedback para gerar sugestões de ajustes.
                        Mantenha um tom motivador e construtivo.
                        Use emojis para tornar a mensagem mais engajadora.
                    `
                },
                {
                    role: 'user',
                    content: `
                        Plano atual: ${JSON.stringify(currentPlan, null, 2)}
                        Tarefas completadas: ${JSON.stringify(completedTasks, null, 2)}
                        Feedback do usuário: ${feedback}
                    `
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-4',
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error analyzing plan progress:', error);
            throw error;
        }
    }

    async generateDailyMotivation(userName, progress) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: `
                        Você é um coach motivacional especializado em TDAH.
                        Gere uma mensagem motivacional personalizada para ${userName} com base em seu progresso:
                        - Atividades completadas: ${progress.completedActivities}
                        - Total de atividades: ${progress.totalActivities}
                        - Taxa de conclusão: ${progress.completionRate.toFixed(1)}%

                        Use emojis e mantenha um tom positivo e encorajador.
                        Foque em celebrar o progresso e motivar para as próximas atividades.
                    `
                }
            ];

            const completion = await this.openai.chat.completions.create({
                model: process.env.GPT_MODEL || 'gpt-4',
                messages: messages,
                temperature: 0.7,
                max_tokens: 300
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('Error generating daily motivation:', error);
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

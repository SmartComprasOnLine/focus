const openai = require('./openaiService');

class IntentService {
    constructor() {
        this.predefinedMessages = {
            SUBSCRIPTION_INQUIRY: {
                intent: "Usuário pergunta sobre assinatura, preços, ou como continuar usando o sistema",
                response: async (params) => {
                    const monthlyPrice = params.monthlyPrice || '99.00';
                    const yearlyPrice = params.yearlyPrice || '999.00';
                    return {
                        type: 'list',
                        title: "Escolha seu plano",
                        description: "Para continuar tendo acesso e manter seu progresso, escolha um plano:",
                        buttonText: "Ver Planos",
                        sections: [{
                            title: "Planos Disponíveis",
                            rows: [
                                {
                                    title: "Plano Mensal",
                                    description: `R$ ${monthlyPrice}/mês - Acesso a todas as funcionalidades`,
                                    rowId: "plano_mensal"
                                },
                                {
                                    title: "Plano Anual",
                                    description: `R$ ${yearlyPrice}/ano - Economia de 2 meses!`,
                                    rowId: "plano_anual"
                                }
                            ]
                        }]
                    };
                }
            },
            WELCOME: {
                intent: "Primeira mensagem do usuário ou pedido de ajuda inicial",
                response: async (params) => {
                    const userName = params.userName || 'Olá';
                    return {
                        type: 'text',
                        content: `${userName}! 👋\n\n` +
                                `Bem-vindo ao seu Coach Pessoal para TDAH! 🌟\n\n` +
                                `Estou aqui para ajudar você a:\n` +
                                `✅ Organizar sua rotina\n` +
                                `✅ Melhorar seu foco\n` +
                                `✅ Aumentar sua produtividade\n` +
                                `✅ Manter sua disposição\n\n` +
                                `Você tem 7 dias GRATUITOS para experimentar todas as funcionalidades!\n\n` +
                                `Vamos começar? Me conte um pouco sobre sua rotina atual. 😊`
                    };
                }
            },
            ROUTINE_HELP: {
                intent: "Usuário pede ajuda com organização de rotina ou menciona dificuldades com tarefas diárias",
                response: async (params) => {
                    const userName = params.userName || 'Olá';
                    return {
                        type: 'text',
                        content: `${userName}, vou te ajudar a organizar sua rotina! 🎯\n\n` +
                                `Para começarmos, me conte:\n\n` +
                                `1️⃣ Que horas você costuma acordar?\n` +
                                `2️⃣ Quais são suas principais atividades diárias?\n` +
                                `3️⃣ Em quais momentos você sente mais dificuldade de manter o foco?\n\n` +
                                `Com essas informações, poderei criar um plano personalizado para você! 💪`
                    };
                }
            },
            PAYMENT_CONFIRMATION: {
                intent: "Usuário menciona que fez o pagamento ou enviou comprovante",
                response: async (params) => {
                    try {
                        const monthlyPrice = params.monthlyPrice || '99.00';
                        const yearlyPrice = params.yearlyPrice || '999.00';
                        const planTypes = {
                            mensal: {
                                period: '1 mês',
                                price: monthlyPrice
                            },
                            anual: {
                                period: '1 ano',
                                price: yearlyPrice
                            }
                        };

                        const normalizedPlanType = (params.planType || 'anual').toLowerCase();
                        
                        if (!planTypes[normalizedPlanType]) {
                            throw new Error(`Invalid plan type: ${normalizedPlanType}`);
                        }

                        const plan = planTypes[normalizedPlanType];
                        const capitalizedPlanType = normalizedPlanType.charAt(0).toUpperCase() + normalizedPlanType.slice(1);
                        const endDate = params.endDate || 'em processamento';

                        return {
                            type: 'text',
                            content: `🎉 Pagamento confirmado!\n\n` +
                                    `Seu Plano ${capitalizedPlanType} foi ativado com sucesso!\n` +
                                    `Valor: R$ ${plan.price}/${normalizedPlanType === 'mensal' ? 'mês' : 'ano'}\n` +
                                    `Período: ${plan.period}\n` +
                                    `Validade: ${endDate}\n\n` +
                                    `Continue contando comigo para organizar sua rotina e melhorar seu foco! 💪✨`
                        };
                    } catch (error) {
                        console.error('Error generating payment confirmation:', error);
                        return {
                            type: 'text',
                            content: `🎉 Pagamento confirmado!\n\n` +
                                    `Seu plano foi ativado com sucesso!\n` +
                                    `Validade: ${params.endDate || 'em processamento'}\n\n` +
                                    `Continue contando comigo para organizar sua rotina e melhorar seu foco! 💪✨`
                        };
                    }
                }
            }
        };
    }

    async analyzeIntent(message, userName) {
        try {
            const prompt = `
                Analise a mensagem do usuário e identifique a intenção principal. Compare com as seguintes intenções predefinidas e retorne a mais apropriada, ou 'NONE' se nenhuma corresponder:

                Intenções disponíveis:
                ${Object.entries(this.predefinedMessages)
                    .map(([key, value]) => `${key}: ${value.intent}`)
                    .join('\n')}

                Mensagem do usuário: "${message}"

                Retorne apenas o identificador da intenção (ex: SUBSCRIPTION_INQUIRY) ou 'NONE'.
            `;

            const response = await openai.generateResponse(userName, prompt);
            return response.trim();
        } catch (error) {
            console.error('Error analyzing intent:', error);
            return 'NONE';
        }
    }

    async getResponseForIntent(intent, params = {}) {
        const message = this.predefinedMessages[intent];
        if (!message) return null;

        try {
            return await message.response(params);
        } catch (error) {
            console.error('Error getting response for intent:', error);
            return null;
        }
    }
}

module.exports = new IntentService();

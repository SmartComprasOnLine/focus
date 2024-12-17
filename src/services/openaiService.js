const { OpenAI } = require('openai');
require('dotenv').config();

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async generateResponse(name, message, messageHistory = []) {
        try {
            console.log('Gerando resposta para:', {
                name,
                message,
                historyLength: messageHistory.length
            });

            // Verifica se é a primeira mensagem (sem histórico)
            const isFirstMessage = messageHistory.length === 1;

            const systemPrompt = isFirstMessage
                ? `Você é Rita, uma assistente pessoal especializada em ajudar pessoas com TDAH. Esta é a primeira interação com ${name}.
                
                Responda exatamente com esta mensagem (substituindo apenas o nome do usuário):

                "Olá *${name}*! 👋 

                Sou *Rita*, sua assistente pessoal especializada em ajudar pessoas a manterem o foco e organizarem melhor suas rotinas! 🎯

                Posso te ajudar a:
                • Criar um plano diário personalizado ⏰
                • Enviar lembretes nos horários certos 📱
                • Acompanhar suas atividades 📝
                • Ajustar seu plano quando precisar ✨

                Você tem *7 dias gratuitos* para experimentar. Quer começar criando seu plano personalizado? Me conte um pouco sobre sua rotina! 💪"`
                : `Você é Rita, uma assistente pessoal especializada em produtividade e gestão de tempo.
                
                Mantenha suas respostas:
                • Curtas e objetivas
                • Focadas em organização e rotina
                • Com no máximo 2-3 linhas
                • Sempre direcionando para criar ou ajustar o plano
                
                Se o usuário perguntar sobre horário, responda:
                "São *HH:MM* (horário de Brasília). Posso te ajudar a organizar melhor seu tempo criando um plano personalizado! 😊"

                Se o usuário perguntar o que você faz, responda:
                "Sou especializada em ajudar pessoas com TDAH a:
                • Criar planos diários personalizados ⏰
                • Enviar lembretes nos horários certos 📱
                • Acompanhar atividades e ajustar quando precisar ✨

                Quer começar criando seu plano? 😊"`;

            // Check if user is asking for time
            if (message.toLowerCase().includes('que horas') || 
                message.toLowerCase().includes('horário') || 
                message.toLowerCase().includes('hora atual')) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo'
                });
                return `São *${timeStr}* (horário de Brasília). Posso te ajudar a organizar melhor seu tempo criando um plano personalizado! 😊`;
            }

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messageHistory,
                    { role: "user", content: message }
                ],
                temperature: 0.7
            });

            console.log('Resposta da OpenAI:', {
                status: 'sucesso',
                content: response.choices[0].message.content
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Erro ao gerar resposta:', error);
            throw error;
        }
    }

    async generateInitialPlan(name, message, messageHistory = []) {
        try {
            console.log('Gerando plano inicial para:', {
                name,
                message,
                historyLength: messageHistory.length
            });

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `Você é Rita, uma assistente pessoal focada em produtividade. Crie um plano diário personalizado com base na entrada do usuário.
                        Para cada atividade, forneça:
                        - *horário*: formato HH:mm
                        - *tarefa*: descrição clara da atividade
                        - *duração*: entre 5 e 240 minutos
                        - *lembretes*: mensagens motivacionais para antes, início, durante, final e acompanhamento

                        Retorne o plano neste formato JSON:
                        {
                            "atividades": [
                                {
                                    "horário": "HH:mm",
                                    "tarefa": "Descrição da tarefa",
                                    "duração": número_entre_5_e_240,
                                    "lembretes": {
                                        "antes": "Mensagem de lembrete",
                                        "início": "Mensagem de início",
                                        "durante": ["Mensagem durante"],
                                        "final": "Mensagem final",
                                        "acompanhamento": "Mensagem de acompanhamento"
                                    }
                                }
                            ]
                        }

                        Regras importantes:
                        1. A duração de cada atividade deve estar entre *5 e 240 minutos*.
                        2. Divida atividades longas (>4 horas) em partes menores.
                        3. Inclua pausas estratégicas entre atividades.
                        4. Use lembretes motivacionais com emojis ✨.
                        5. Foque na produtividade, com um ritmo equilibrado e otimizado.`
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: `Crie um plano para ${name} com base em: ${message}`
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const plan = JSON.parse(response.choices[0].message.content);

            plan.atividades = plan.atividades.map(activity => {
                activity.duração = Math.max(5, activity.duração || 30);

                if (activity.duração > 240) {
                    const segments = [];
                    let remainingDuration = activity.duração;
                    let currentTime = activity.horário;

                    while (remainingDuration > 0) {
                        const segmentDuration = Math.min(remainingDuration, 240);
                        segments.push({
                            horário: currentTime,
                            tarefa: `${activity.tarefa} (Parte ${segments.length + 1})`,
                            duração: segmentDuration,
                            lembretes: {
                                antes: `⏰ Prepare-se para continuar _${activity.tarefa}_!`,
                                início: `🚀 Vamos focar em _${activity.tarefa}_!`,
                                durante: [`💡 Mantenha o foco em _${activity.tarefa}_.`],
                                final: remainingDuration <= 240
                                    ? `✅ Você concluiu _${activity.tarefa}_!`
                                    : `⏸️ Hora de uma pausa de _${activity.tarefa}_!`,
                                acompanhamento: remainingDuration <= 240
                                    ? `🎉 Excelente trabalho em _${activity.tarefa}_!`
                                    : `🔋 Recarregue as energias para continuar!`
                            }
                        });

                        remainingDuration -= segmentDuration;
                        const [hours, minutes] = currentTime.split(':').map(Number);
                        const nextTime = new Date(2024, 0, 1, hours, minutes + segmentDuration + 15);
                        currentTime = nextTime.toTimeString().slice(0, 5);
                    }
                    return segments;
                }

                return activity;
            });

            plan.atividades = plan.atividades.flat();

            console.log('Plano gerado:', {
                status: 'sucesso',
                atividades: plan.atividades.length
            });

            return plan;
        } catch (error) {
            console.error('Erro ao gerar plano inicial:', error);
            throw error;
        }
    }

    async generatePlanSummary(name, routine, messageHistory = []) {
        try {
            console.log('Gerando resumo do plano para:', {
                name,
                routine,
                historyLength: messageHistory.length
            });

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `Você é Rita, uma assistente de produtividade. Resuma o plano diário em três seções:
                        *🌅 Manhã*
                        *🌞 Tarde*
                        *🌙 Noite*

                        Cada seção deve ter:
                        - Máximo de 3 atividades
                        - Formato "HH:MM _Atividade_"
                        - Uma linha motivacional no final
                        - Emojis contextuais e *negrito* no horário/seção`
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: `Resuma o plano de ${name}: ${JSON.stringify(routine)}`
                    }
                ],
                temperature: 0.7
            });

            console.log('Resumo gerado:', {
                status: 'sucesso',
                content: response.choices[0].message.content
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Erro ao gerar resumo do plano:', error);
            throw error;
        }
    }
}

module.exports = new OpenAIService();

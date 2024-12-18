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
                ? `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar. Esta é a primeira interação com ${name}.
                
                Responda exatamente com esta mensagem (substituindo apenas o nome do usuário):

                "Olá *${name}*! 👋 

                Sou *Rita*, sua assistente pessoal especializada em produtividade, gestão de tempo e bem estar! 🎯

                Posso te ajudar a:
                • Criar um plano diário produtivo e equilibrado ⏰
                • Gerenciar melhor seu tempo com lembretes 📱
                • Acompanhar suas atividades e progresso 📝
                • Manter o equilíbrio entre tarefas e bem estar ✨

                Você tem *7 dias gratuitos* para experimentar. Quer começar criando seu plano personalizado? Me conte um pouco sobre sua rotina! 💪"`
                : `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar.
                
                Mantenha suas respostas:
                • Curtas e objetivas
                • Focadas em organização e rotina
                • Com no máximo 2-3 linhas
                • Sempre direcionando para criar ou ajustar o plano
                
                Se o usuário perguntar sobre horário, responda:
                "São *HH:MM* (horário de Brasília). Posso te ajudar a organizar melhor seu tempo criando um plano personalizado! 😊"

                Se o usuário perguntar o que você faz, responda:
                "Sou especializada em:
                • Criar planos diários produtivos e equilibrados ⏰
                • Gerenciar seu tempo com lembretes inteligentes 📱
                • Acompanhar seu progresso e bem estar ✨

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
                        content: `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar. Crie um plano diário equilibrado com base na entrada do usuário.
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
                        3. Inclua pausas estratégicas entre atividades:
                           - Pausa de 5-15 minutos a cada 90-120 minutos de trabalho
                           - Soneca após almoço limitada a 30 minutos
                           - Intervalos para hidratação a cada 2-3 horas
                        4. Use lembretes motivacionais com emojis ✨.
                        5. Foque na produtividade, com um ritmo equilibrado e otimizado.
                        6. Distribua o trabalho em blocos flexíveis ao longo do dia.
                        7. Respeite horários importantes:
                           - Início do dia: 8:00
                           - Almoço: 12:00-13:00
                           - Fim do dia: 22:00
                        8. Distribua a hidratação ao longo do dia:
                           - Água: 1,5L dividido em 4-6 porções
                           - Tereré: 1,5L dividido em 3-4 porções
                        9. Priorize um sono noturno adequado (7-8 horas)`
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
                        content: `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar. 
                        
                        Resuma o plano diário exatamente neste formato:

*🌅 Manhã*
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_

_Mensagem motivacional personalizada!_ ✨

*🌞 Tarde*
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_

_Mensagem motivacional personalizada!_ 💪

*🌙 Noite*
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_
• *HH:MM* _Descrição da atividade_

_Mensagem motivacional personalizada!_ 🌟

Regras importantes:
1. Use exatamente esta formatação:
   - Títulos em *negrito* com emoji
   - Horários em *negrito*
   - Atividades em _itálico_
   - Bullet points com •
   - Uma linha em branco antes das mensagens motivacionais
   - Mensagens motivacionais em _itálico_ com emoji
2. Agrupe por períodos do dia (máx. 3 atividades por período)
3. Personalize as mensagens motivacionais ao contexto
4. Mantenha a formatação consistente`
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

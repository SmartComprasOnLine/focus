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
                        content: `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar. Analise a rotina do usuário e crie um plano personalizado que otimize sua produtividade e bem-estar.

                        Aspectos a considerar na análise:
                        1. Ciclo de energia diário:
                           - Horários de maior disposição
                           - Períodos de baixa energia
                           - Necessidades de descanso

                        2. Gestão de tempo:
                           - Blocos de trabalho focado
                           - Pausas estratégicas
                           - Transições entre atividades

                        3. Hábitos e rotinas:
                           - Padrões atuais
                           - Oportunidades de melhoria
                           - Pontos de atenção

                        4. Produtividade:
                           - Técnicas (Pomodoro, GTD, etc.)
                           - Eliminação de distrações
                           - Foco e concentração

                        5. Bem-estar:
                           - Equilíbrio trabalho-vida
                           - Atividade física
                           - Alimentação e hidratação

                        Para cada atividade, forneça:
                        {
                            "atividades": [
                                {
                                    "horário": "HH:mm",
                                    "tarefa": "Descrição da tarefa",
                                    "duração": número_entre_5_e_240,
                                    "categoria": "trabalho|descanso|exercício|alimentação|outros",
                                    "energia": "alta|média|baixa",
                                    "sugestões": ["Sugestões de melhoria ou otimização"],
                                    "lembretes": {
                                        "antes": "Mensagem de preparação",
                                        "início": "Mensagem motivacional",
                                        "durante": ["Dicas de foco/produtividade"],
                                        "final": "Mensagem de conclusão",
                                        "acompanhamento": "Reflexão/feedback"
                                    }
                                }
                            ],
                            "análise": {
                                "pontos_fortes": ["Aspectos positivos da rotina"],
                                "oportunidades": ["Sugestões de melhoria"],
                                "perguntas": ["Questões para entender melhor e otimizar"]
                            }
                        }

                        Regras importantes:
                        1. Horários e durações:
                           - Atividades entre 5-240 minutos
                           - Não divida atividades em partes
                           - Respeite horários fixos do usuário
                           - Evite sobreposições de horários
                           
                        2. Pausas e descanso:
                           - 5-15 min a cada 90-120 min de trabalho
                           - Soneca pós-almoço máx. 30-40 min
                           - Intervalos para hidratação a cada 2-3h
                           
                        3. Hidratação distribuída:
                           - Água: 1,5L em 4-6 porções
                           - Tereré: 1,5L em 3-4 porções
                           - Intercale água e tereré
                           
                        4. Estrutura do dia:
                           - Manhã: atividades físicas/importantes
                           - Tarde: trabalho com pausas regulares
                           - Noite: atividades leves, preparação sono
                           
                        5. Sono e descanso:
                           - Horário dormir: 22:00-22:30
                           - Duração: 7-8 horas contínuas
                           - Preparação: 30-45 min antes
                           
                        6. Lembretes:
                           - Motivacionais e específicos
                           - Use emojis relevantes
                           - Foque em produtividade e bem-estar`
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

*🌅 Manhã (até 12:00)*
• *HH:MM* _Descrição da atividade_

*🌞 Tarde (12:00-18:00)*
• *HH:MM* _Descrição da atividade_

*🌙 Noite (após 18:00)*
• *HH:MM* _Descrição da atividade_

_Mensagem motivacional curta e relevante_ ✨

Regras importantes:
1. Use formatação consistente:
   - Títulos: *emoji Período (horário)*
   - Atividades: • *HH:MM* _Descrição_
   - Mensagem final: _texto_ ✨
2. Agrupe atividades por período do dia
3. Não divida períodos em subseções
4. Não divida o sono em partes
5. Remova espaços extras após descrições
6. Use apenas uma mensagem motivacional ao final
7. Não inclua períodos sem atividades
8. Mantenha horários realistas e sem sobreposições
9. Respeite os horários fixos do usuário (trabalho, compromissos)`
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

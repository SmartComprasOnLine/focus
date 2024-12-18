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

            const currentTime = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const currentDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const currentDay = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
            const period = (() => {
                const hour = parseInt(currentTime.split(':')[0]);
                if (hour >= 5 && hour < 12) return 'Bom dia';
                if (hour >= 12 && hour < 18) return 'Boa tarde';
                return 'Boa noite';
            })();

            const systemPrompt = isFirstMessage
                ? `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar. 
                Horário atual: ${currentTime}
                Data atual: ${currentDate}
                Dia da semana: ${currentDay}
                
                Responda exatamente com esta mensagem (substituindo nome e saudação):

                "${period} *${name}*! 👋 

                Sou *Rita*, sua assistente pessoal especializada em produtividade, gestão de tempo e bem estar! 🎯

                Posso te ajudar a:
                • Criar um plano diário produtivo e equilibrado ⏰
                • Gerenciar melhor seu tempo com lembretes 📱
                • Acompanhar suas atividades e progresso 📝
                • Manter o equilíbrio entre tarefas e bem estar ✨

                Você tem *7 dias gratuitos* para experimentar. Quer começar criando seu plano personalizado? Me conte um pouco sobre sua rotina! 💪"`
                : `Você é Rita, uma assistente pessoal especializada em produtividade, gestão de tempo e bem estar.
                Horário atual: ${currentTime}
                Data atual: ${currentDate}
                Dia da semana: ${currentDay}
                
                Mantenha suas respostas:
                • Curtas e objetivas
                • Focadas em organização e rotina
                • Com no máximo 2-3 linhas
                • Sempre direcionando para criar ou ajustar o plano
                • Considere o horário atual nas sugestões
                
                Se o usuário perguntar sobre horário, responda:
                "São *${currentTime}* (horário de Brasília). Posso te ajudar a organizar melhor seu tempo criando um plano personalizado! 😊"

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
                        content: `Você é Rita, uma assistente pessoal especializada em produtividade. 
Horário atual: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Data atual: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Dia da semana: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' })}

Analise a rotina do usuário considerando:
- Ciclo de energia (disposição, descanso)
- Gestão de tempo (foco, pausas)
- Hábitos e rotinas
- Produtividade (técnicas, distrações)
- Bem-estar (equilíbrio, exercícios)
- Horário atual e dia da semana

Regras para duração das atividades:

1. Trabalho/Estudo:
   - Blocos focados: 90-120 minutos
   - Pausas curtas: 5-15 minutos entre blocos
   - Pausa longa: 30-60 minutos após 4 horas

2. Exercícios/Atividade Física:
   - Aquecimento: 5-10 minutos
   - Atividade principal: 30-60 minutos
   - Alongamento: 5-10 minutos

3. Refeições e Hidratação:
   - Café da manhã: 15-30 minutos
   - Almoço/Jantar: 30-45 minutos
   - Lanches: 10-15 minutos
   - Hidratação: distribuir água (3,5L)

4. Descanso:
   - Soneca pós-almoço: máx 30-40 minutos
   - Pausas para relaxamento: 10-15 minutos
   - Preparação para dormir: 30-45 minutos
   - Sono noturno: 7-8 horas 420-480 minutos

5. Organização do dia:
   - Manhã: atividades que exigem mais foco
   - Tarde: alternar trabalho com pausas
   - Noite: atividades leves após 20:00

Defina a duração de cada atividade de acordo com estas regras e a rotina do usuário.

Retorne apenas um JSON válido neste formato:
{
    "atividades": [
        {
            "horário": "HH:mm",
            "tarefa": "string",
            "duração": "number",
            "categoria": "trabalho|descanso|exercício|alimentação|outros",
            "energia": "alta|média|baixa",
            "sugestões": ["string"],
            "lembretes": {
                "antes": "string",
                "início": "string",
                "durante": ["string"],
                "final": "string",
                "acompanhamento": "string"
            }
        }
    ],
    "análise": {
        "pontos_fortes": ["string"],
        "oportunidades": ["string"],
        "perguntas": ["string"]
    }
}`
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

            // Process activities and handle special cases
            plan.atividades = plan.atividades.map(activity => {
                // Ensure minimum duration
                activity.duração = Math.max(5, activity.duração || 30);

                // Special handling for sleep activity
                if (activity.categoria === 'descanso' && activity.tarefa.toLowerCase().includes('dormir')) {
                    // Keep sleep as one activity with full duration
                    return activity;
                }

                // Handle long activities by adding breaks
                if (activity.duração > 120 && activity.categoria !== 'descanso') {
                    const segments = [];
                    let remainingDuration = activity.duração;
                    let currentTime = activity.horário;
                    let partCount = 1;

                    while (remainingDuration > 0) {
                        // For work activities, add breaks every 2 hours
                        const segmentDuration = activity.categoria === 'trabalho' ? 
                            Math.min(remainingDuration, 120) : // 2 hours for work
                            remainingDuration; // Full duration for other activities
                        segments.push({
                            horário: currentTime,
                            tarefa: segments.length === 0 ? activity.tarefa : `${activity.tarefa} (continuação)`,
                            duração: segmentDuration,
                            categoria: activity.categoria,
                            energia: activity.energia,
                            sugestões: activity.sugestões,
                            lembretes: {
                                antes: `⏰ ${partCount === 1 ? 'Prepare-se para' : 'Continue com'} _${activity.tarefa}_!`,
                                início: `🚀 ${partCount === 1 ? 'Vamos começar' : 'Vamos continuar'} _${activity.tarefa}_!`,
                                durante: [`💡 Mantenha o foco em _${activity.tarefa}_.`],
                                final: remainingDuration <= 120
                                    ? `✅ Você concluiu _${activity.tarefa}_!`
                                    : `⏸️ Hora de uma pausa de _${activity.tarefa}_!`,
                                acompanhamento: remainingDuration <= 120
                                    ? `🎉 Excelente trabalho em _${activity.tarefa}_!`
                                    : `🔋 Faça uma pausa e recarregue as energias!`
                            }
                        });

                        // Add a break between segments if not the last segment
                        if (remainingDuration > 120) {
                            const [hours, minutes] = currentTime.split(':').map(Number);
                            const breakStartMinutes = hours * 60 + minutes + segmentDuration;
                            const breakStartHours = Math.floor(breakStartMinutes / 60) % 24;
                            const breakStartMins = breakStartMinutes % 60;
                            const breakTime = `${String(breakStartHours).padStart(2, '0')}:${String(breakStartMins).padStart(2, '0')}`;

                            segments.push({
                                horário: breakTime,
                                tarefa: 'Pausa para descanso',
                                duração: 15,
                                categoria: 'descanso',
                                energia: 'baixa',
                                sugestões: ['Faça uma pausa ativa', 'Hidrate-se', 'Faça alongamentos'],
                                lembretes: {
                                    antes: '⏸️ Hora de fazer uma pausa!',
                                    início: '🌿 Aproveite para relaxar um pouco.',
                                    durante: ['💆 Momento de recarregar as energias.'],
                                    final: '✨ Pausa concluída!',
                                    acompanhamento: '💪 Pronto para continuar?'
                                }
                            });

                            // Update current time for next segment
                            const nextSegmentMinutes = breakStartMinutes + 15;
                            const nextHours = Math.floor(nextSegmentMinutes / 60) % 24;
                            const nextMins = nextSegmentMinutes % 60;
                            currentTime = `${String(nextHours).padStart(2, '0')}:${String(nextMins).padStart(2, '0')}`;
                        }

                        remainingDuration -= segmentDuration;
                        partCount++;
                    }
                    return segments;
                }

                return activity;
            });

            // Flatten the array and sort by time
            plan.atividades = plan.atividades.flat().sort((a, b) => {
                const timeA = a.horário.split(':').map(Number);
                const timeB = b.horário.split(':').map(Number);
                return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
            });

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

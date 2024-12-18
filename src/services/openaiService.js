const { OpenAI } = require('openai');
require('dotenv').config();

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async detectIntent(message, userContext = {}) {
        try {
            // Check for direct commands first
            const lowerMessage = message.toLowerCase().trim();
            
            // Data deletion commands
            const deleteCommands = [
                'apagar', 'deletar', 'excluir', 'remover',
                'apagar dados', 'deletar dados', 'excluir dados', 'remover dados',
                'apagar meus dados', 'deletar meus dados', 'excluir meus dados', 'remover meus dados'
            ];
            if (deleteCommands.some(cmd => lowerMessage.includes(cmd))) {
                return 'delete_data';
            }

            // Confirmation commands
            const confirmCommands = ['sim', 'ótimo', 'ok', 'beleza', 'confirmar', 'pode ser', 'claro'];
            if (confirmCommands.some(cmd => lowerMessage === cmd)) {
                return 'confirm_plan';
            }

            // Time queries
            if (lowerMessage.includes('que horas') || 
                lowerMessage.includes('horário') || 
                lowerMessage.includes('hora atual')) {
                return 'time_query';
            }

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `Analise a mensagem e contexto do usuário para identificar a intenção.
                        
Considere:
- Histórico de mensagens
- Padrões de comportamento
- Horário do dia
- Estado atual do plano

Retorne apenas uma das intenções:
- initial_message: primeira interação ou saudação
- create_plan: criar plano inicial
- update_plan: modificar plano existente
- show_plan: ver plano atual
- activity_completed: completou atividade
- activity_not_completed: não completou atividade
- subscription_inquiry: pergunta sobre planos
- select_plan: escolha de plano
- goodbye: despedida
- general_conversation: outros`
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            message,
                            context: userContext
                        })
                    }
                ],
                temperature: 0.3,
                max_tokens: 50
            });

            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            console.error('Erro ao detectar intenção:', error);
            throw error;
        }
    }

    async generateResponse(name, message, messageHistory = []) {
        try {
            console.log('Gerando resposta para:', {
                name,
                message,
                historyLength: messageHistory.length
            });

            const currentTime = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const currentDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const currentDay = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
            const period = (() => {
                const hour = parseInt(currentTime.split(':')[0]);
                if (hour >= 5 && hour < 12) return 'Bom dia';
                if (hour >= 12 && hour < 18) return 'Boa tarde';
                return 'Boa noite';
            })();

            const systemPrompt = messageHistory.length === 0
                ? `Você é Rita, uma assistente pessoal especializada em produtividade. 
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
                : `Você é Rita, uma assistente pessoal especializada em produtividade. 
                Horário atual: ${currentTime}
                Data atual: ${currentDate}
                Dia da semana: ${currentDay}

                Analise o histórico e contexto para gerar uma resposta personalizada.
                
                Mantenha suas respostas:
                • Curtas e objetivas (2-3 linhas)
                • Focadas em produtividade
                • Com sugestões práticas
                • Usando emojis relevantes
                • Direcionando para o plano

                Se precisar de mais informações, faça perguntas específicas.
                Se detectar padrões, sugira melhorias.
                Se houver desafios, ofereça soluções práticas.`;

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messageHistory,
                    { role: "user", content: message }
                ],
                temperature: 0.7
            });

            console.log('Resposta gerada:', {
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

${messageHistory.length > 0 ? 
`Atualize o plano existente mantendo a mesma estrutura e fazendo apenas as alterações solicitadas.

Plano atual:
${messageHistory[0].content}

Mudanças solicitadas:
${message}

Importante:
1. Mantenha as atividades que não foram mencionadas nas mudanças
2. Atualize apenas os horários e durações solicitados
3. Ajuste os horários subsequentes conforme necessário
4. Mantenha a mesma estrutura e formato do plano` 
:
`Analise a rotina do usuário considerando:`}
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
   - Sono noturno: 7-8 horas

5. Organização do dia:
   - Manhã: atividades que exigem mais foco
   - Tarde: alternar trabalho com pausas
   - Noite: atividades leves após 20:00

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

    async extractActivityInfo(message) {
        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `Analise a mensagem e extraia:
- ID da atividade (formato: completed_ID ou not_completed_ID)
- Tipo de plano (mensal ou anual)
- Detalhes da atividade (horário, tarefa, duração)

Retorne apenas um JSON válido com as informações encontradas, ou null se não houver informações relevantes.`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Erro ao extrair informações:', error);
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

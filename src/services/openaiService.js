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
            console.log('Generating response for:', {
                name,
                message,
                historyLength: messageHistory.length
            });

            // Check if this is the first message (no history)
            const isFirstMessage = messageHistory.length === 1; // Only the current message

            const systemPrompt = isFirstMessage ? 
                `Você é Rita, uma assistente pessoal focada em produtividade. Esta é a primeira interação com ${name}. 
                Dê boas-vindas calorosas e informe sobre o período de teste gratuito de 7 dias.
                Sua resposta deve:
                1. Ser em português
                2. Usar formatação WhatsApp (*negrito* e _itálico_)
                3. Mencionar o nome do usuário
                4. Informar sobre o período de teste
                5. Ser acolhedora e profissional
                6. Usar no máximo 2-3 emojis
                7. Ser concisa (máximo 3 parágrafos curtos)` :
                `Você é Rita, uma assistente pessoal focada em produtividade. Suas respostas devem ser:
                1. Em português
                2. Muito concisas (máximo 3 parágrafos curtos)
                3. Diretas e práticas
                4. Usar emojis com moderação (máximo 2-3)
                5. Focar em uma mensagem ou dica principal
                6. Manter o encorajamento breve mas significativo
                7. Usar formatação WhatsApp:
                   - *negrito* para pontos importantes
                   - _itálico_ para ênfase`;

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7
            });

            console.log('OpenAI response:', {
                status: 'success',
                content: response.choices[0].message.content
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    async generateInitialPlan(name, message, messageHistory = []) {
        try {
            console.log('Generating initial plan for:', {
                name,
                message,
                historyLength: messageHistory.length
            });

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant. Create a personalized daily routine plan based on the user's input.
                        For each activity, you must specify:
                        - time: in HH:mm format
                        - task: clear description of the activity
                        - duration: in minutes (minimum 5 minutes, maximum 240 minutes per segment)
                        - reminders: motivational messages for before, start, during, end, and follow-up

                        Return the plan in this exact JSON format:
                        {
                            "activities": [
                                {
                                    "time": "HH:mm",
                                    "task": "Task description",
                                    "duration": number_between_5_and_240,
                                    "reminders": {
                                        "before": "Reminder message",
                                        "start": "Start message",
                                        "during": ["During message"],
                                        "end": "End message",
                                        "followUp": "Follow-up message"
                                    }
                                }
                            ]
                        }

                        Important rules:
                        1. Every activity must have a duration between 5 and 240 minutes
                        2. Long activities (>4 hours) should be split into multiple segments
                        3. Include breaks and transitions between activities
                        4. Reminders should be motivational and include emojis
                        5. Consider productivity and focus when scheduling activities`
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: `Create a plan for ${name} based on: ${message}`
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const plan = JSON.parse(response.choices[0].message.content);

            // Validate and adjust durations
            plan.activities = plan.activities.map(activity => {
                // Ensure minimum duration
                activity.duration = Math.max(5, activity.duration || 30);
                
                // Split long activities into segments
                if (activity.duration > 240) {
                    const segments = [];
                    let remainingDuration = activity.duration;
                    let currentTime = activity.time;

                    while (remainingDuration > 0) {
                        const segmentDuration = Math.min(remainingDuration, 240);
                        segments.push({
                            time: currentTime,
                            task: `${activity.task} (Part ${segments.length + 1})`,
                            duration: segmentDuration,
                            reminders: {
                                before: `⏰ Prepare-se para continuar ${activity.task}!`,
                                start: `🎯 Hora de continuar ${activity.task}!`,
                                during: [`💪 Continue focado em ${activity.task}!`],
                                end: segments.length === Math.ceil(activity.duration / 240) - 1 
                                    ? `✅ Hora de finalizar ${activity.task}!`
                                    : `⏸️ Hora de fazer uma pausa de ${activity.task}!`,
                                followUp: segments.length === Math.ceil(activity.duration / 240) - 1
                                    ? `🌟 Parabéns por completar ${activity.task}!`
                                    : `🔋 Aproveite sua pausa!`
                            }
                        });

                        remainingDuration -= segmentDuration;
                        // Calculate next segment start time
                        const [hours, minutes] = currentTime.split(':').map(Number);
                        const nextTime = new Date(2024, 0, 1, hours, minutes + segmentDuration + 15);
                        currentTime = nextTime.toTimeString().slice(0, 5);
                    }
                    return segments;
                }

                return activity;
            });

            // Flatten segments array
            plan.activities = plan.activities.flat();

            console.log('Generated plan:', {
                status: 'success',
                activities: plan.activities.length
            });

            return plan;
        } catch (error) {
            console.error('Error generating initial plan:', error);
            throw error;
        }
    }

    async generatePlanSummary(name, routine, messageHistory = []) {
        try {
            console.log('Generating plan summary for:', {
                name,
                routine,
                historyLength: messageHistory.length
            });

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant. Create a minimal schedule:
                        1. Three sections only:
                           🌅 Manhã
                           07:00 Acordar
                           
                           🌞 Tarde
                           12:00 Almoço
                           
                           🌙 Noite
                           22:00 Dormir
                        2. Max 3 activities per section
                        3. Use format "HH:MM Atividade"
                        4. Single word activities in Portuguese
                        5. One line motivation in Portuguese
                        6. Use WhatsApp formatting:
                           - *bold* for times and section headers
                           - _italic_ for activities
                           - Add emojis for context`
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: `Create a summary for ${name}'s plan: ${JSON.stringify(routine)}`
                    }
                ],
                temperature: 0.7
            });

            console.log('Generated summary:', {
                status: 'success',
                content: response.choices[0].message.content
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error generating plan summary:', error);
            throw error;
        }
    }

    async generateActivityFeedback(name, success = true, messageHistory = []) {
        try {
            console.log('Generating activity feedback for:', {
                name,
                success,
                historyLength: messageHistory.length
            });

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant. ${
                            success 
                                ? 'Generate a brief positive message in Portuguese for activity completion.' 
                                : 'Generate a brief supportive message in Portuguese for missing an activity.'
                        }
                        Your response must:
                        1. Be just 1-2 short sentences in Portuguese
                        2. Use maximum 1 emoji
                        3. Focus on moving forward
                        4. Avoid lengthy explanations
                        5. Keep encouragement simple and direct
                        6. Use WhatsApp formatting:
                           - *bold* for emphasis
                           - _italic_ for gentle encouragement`
                    },
                    ...messageHistory,
                    {
                        role: "user",
                        content: `Generate ${success ? 'positive' : 'supportive'} feedback for ${name}`
                    }
                ],
                temperature: 0.7
            });

            console.log('Generated feedback:', {
                status: 'success',
                content: response.choices[0].message.content
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Error generating activity feedback:', error);
            throw error;
        }
    }
}

module.exports = new OpenAIService();

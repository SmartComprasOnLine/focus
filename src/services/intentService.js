const { OpenAI } = require('openai');
require('dotenv').config();

class IntentService {
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

            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant. 
                        Analyze the user message and return one of these intents:
                        - initial_message: When this is the user's first interaction or they're saying hello/hi/starting a conversation
                        - create_plan: When user wants to create their initial routine plan
                        - update_plan: When user wants to modify their existing plan (add/remove/change activities or reminders)
                        - show_plan: When user wants to see their current plan or routine
                        - activity_completed: When user indicates they completed an activity
                        - activity_not_completed: When user indicates they couldn't complete an activity
                        - subscription_inquiry: When user asks about plans, pricing, or continuing after trial
                        - select_plan: When user chooses a subscription plan
                        - goodbye: When user is saying goodbye or thanking
                        - general_conversation: For any other type of conversation

                        Context about the user's current plan status:
                        ${JSON.stringify(userContext)}
                        
                        Return ONLY the intent name, nothing else.`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.3,
                max_tokens: 50
            });

            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            console.error('Error detecting intent:', error);
            throw error;
        }
    }

    async analyzePlanUpdate(message, currentPlan) {
        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant.
                        Analyze the user's message to identify requested changes to their routine plan.
                        Current plan:
                        ${JSON.stringify(currentPlan, null, 2)}

                        Return a JSON object with:
                        {
                            "type": "add" | "modify" | "remove",
                            "activities": [{
                                "id": string (if modifying/removing),
                                "time": string (HH:mm format),
                                "task": string,
                                "duration": number (minutes),
                                "changes": {
                                    "field": "what changed",
                                    "from": "old value",
                                    "to": "new value"
                                }
                            }],
                            "reminders": [{
                                "activityId": string,
                                "type": "before" | "start" | "during" | "end" | "followUp",
                                "message": string,
                                "time": string (HH:mm format)
                            }]
                        }`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Error analyzing plan update:', error);
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
                        content: `You are Rita, a personal productivity assistant.
                        Analyze the user message and extract:
                        - Activity ID if present (usually in format 'completed_ID' or 'not_completed_ID')
                        - Plan type if present (usually 'mensal' or 'anual')
                        - Activity details (time, task, duration) if present
                        
                        Return the extracted information in a JSON format, or 'null' if no relevant information found.`
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
            console.error('Error extracting activity info:', error);
            throw error;
        }
    }

    async analyzeRoutinePreferences(messages) {
        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant.
                        Analyze the user's messages and identify:
                        - Productive periods (when they feel most focused/energetic)
                        - Challenges they face
                        - Strategies that help them
                        - Common distractions
                        - Daily schedule
                        - Sleep patterns
                        - Work/study schedule
                        - Exercise/physical activity habits
                        
                        Return the analysis in a structured JSON format that can be used to create personalized reminders and recommendations.`
                    },
                    {
                        role: "user",
                        content: Array.isArray(messages) ? messages.join('\n') : messages
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Error analyzing routine preferences:', error);
            throw error;
        }
    }

    async generateReminders(activity, preferences) {
        try {
            const response = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are Rita, a personal productivity assistant.
                        Based on the activity and user preferences, generate personalized reminders that:
                        - Are motivating and encouraging
                        - Consider the user's peak productivity times
                        - Account for their challenges and distractions
                        - Incorporate their helpful strategies
                        - Include relevant emojis
                        
                        Return the reminders in a JSON format with:
                        {
                            "before": {
                                "message": string,
                                "time": "HH:mm"
                            },
                            "start": {
                                "message": string,
                                "time": "HH:mm"
                            },
                            "during": [{
                                "message": string,
                                "time": "HH:mm"
                            }],
                            "end": {
                                "message": string,
                                "time": "HH:mm"
                            },
                            "followUp": {
                                "message": string,
                                "time": "HH:mm"
                            }
                        }`
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            activity: activity,
                            preferences: preferences
                        })
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Error generating reminders:', error);
            throw error;
        }
    }
}

module.exports = new IntentService();

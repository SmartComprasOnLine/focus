const { OpenAI } = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.GPT_MODEL || 'gpt-4o-mini';
  }

  async generateCoachResponse(userName, userMessage, currentPlan, interactionHistory) {
    try {
      // Buscar o plano atual do banco de dados
      const Routine = require('../models/Routine');
      let planDetails = "Ainda não definido";
      
      if (currentPlan) {
        const routineDoc = await Routine.findById(currentPlan);
        if (routineDoc) {
          planDetails = {
            nome: routineDoc.routineName,
            atividades: routineDoc.activities,
            criadoEm: routineDoc.createdAt
          };
        }
      }

      const systemPrompt = `
        Você é um coach pessoal especializado em TDAH, focado em ajudar ${userName} a melhorar sua produtividade, 
        foco e disposição. Seu objetivo é auxiliar na organização da rotina diária do usuário.
        
        Plano atual do usuário: ${JSON.stringify(planDetails, null, 2)}
        
        Diretrizes:
        1. Mantenha respostas curtas e objetivas
        2. Use emojis para tornar a comunicação mais engajadora
        3. Foque em soluções práticas e alcançáveis
        4. Divida tarefas complexas em etapas menores
        5. Ofereça sugestões específicas baseadas no contexto do usuário
        6. Mantenha um tom motivador e compreensivo
        7. Evite sobrecarregar o usuário com muitas tarefas
      `;

      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      if (interactionHistory && interactionHistory.length > 0) {
        console.log('Processing interaction history:', JSON.stringify(interactionHistory, null, 2));
        interactionHistory.forEach(interaction => {
          if (!interaction.role || !interaction.content) {
            console.warn('Interaction missing role or content:', interaction);
            return;
          }
          messages.push({
            role: interaction.role,
            content: interaction.content
          });
        });
      } else {
        messages.push({ role: 'user', content: userMessage });
      }

      console.log('OpenAI messages:', JSON.stringify(messages, null, 2));

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating coach response:', error);
      throw error;
    }
  }

  async generateInitialPlan(userName, userResponses) {
    try {
      // Primeiro, gerar o plano
      const planMessages = [
        {
          role: 'system',
          content: `Você é um coach especializado em TDAH, focado em ajudar pessoas a melhorarem sua produtividade e foco.
          Gere um plano detalhado e estruturado, incluindo:
          1. Rotina diária estruturada
          2. Técnicas de foco e concentração
          3. Estratégias para gestão de tempo
          4. Lembretes e checkpoints importantes
          5. Metas de curto prazo (próximos 7 dias)`
        },
        {
          role: 'user',
          content: `Crie um plano personalizado para ${userName} com base nas seguintes informações:
          ${JSON.stringify(userResponses)}`
        }
      ];

      const planResponse = await this.openai.chat.completions.create({
        model: this.model,
        messages: planMessages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const plan = planResponse.choices[0].message.content;

      // Definir atividades e lembretes padrão
      const activities = [
        {
          activity: "Início do trabalho",
          scheduledTime: "09:00",
          type: "trabalho",
          messages: {
            before: "Em 5 minutos: Prepare seu ambiente de trabalho 🖥️ Lembre-se de desativar notificações!",
            start: "Hora de começar o trabalho! Vamos usar a técnica Pomodoro: 25 min de foco, 5 min de pausa 🎯",
            during: "Como está indo? Mantenha o foco! Se precisar, faça uma pausa curta 💪",
            after: "Primeira hora de trabalho completa! Que tal uma pausa de 5 minutos? ☕"
          }
        },
        {
          activity: "Daily Meeting",
          scheduledTime: "10:00",
          type: "trabalho",
          messages: {
            before: "Em 5 minutos: Prepare-se para a daily! 📋 Revise suas atualizações.",
            start: "Hora da daily! Compartilhe seu progresso e desafios 🗣️",
            during: "Mantenha o foco na reunião e anote pontos importantes 📝",
            after: "Daily concluída! Hora de voltar ao código com as novas informações 💻"
          }
        },
        {
          activity: "Almoço",
          scheduledTime: "12:00",
          type: "pausa",
          messages: {
            before: "Em 5 minutos: Prepare-se para sua pausa do almoço! 🍽️",
            start: "Hora do almoço! Desligue o computador e relaxe 🌟",
            during: "Aproveite sua refeição sem distrações. Você merece este momento! 😌",
            after: "Almoço finalizado! Pronto para voltar ao trabalho? 💪"
          }
        },
        {
          activity: "Pausa da Tarde",
          scheduledTime: "15:00",
          type: "pausa",
          messages: {
            before: "Em 5 minutos: Prepare-se para uma pausa revigorante! 🌿",
            start: "Hora da pausa! Levante-se e faça alguns alongamentos 🧘‍♂️",
            during: "Aproveite para beber água e dar uma caminhada curta 🚶‍♂️",
            after: "Pausa concluída! Voltando ao trabalho com energia renovada! 🔋"
          }
        },
        {
          activity: "Fim do Expediente",
          scheduledTime: "18:00",
          type: "revisao",
          messages: {
            before: "Em 5 minutos: Prepare-se para encerrar o dia de trabalho! 📝",
            start: "Hora de revisar o que foi feito hoje e planejar amanhã 📋",
            during: "Organize suas anotações e atualize seu status 📊",
            after: "Dia de trabalho concluído! Hora de descansar e recarregar 🌙"
          }
        }
      ];

      return {
        plan: plan,
        reminders: activities
      };
    } catch (error) {
      console.error('Error generating initial plan:', error);
      throw error;
    }
  }

  async analyzePlanProgress(currentPlan, completedTasks, userFeedback) {
    try {
      const prompt = `
        Analise o progresso do usuário no plano atual e sugira ajustes:
        
        Plano Atual: ${JSON.stringify(currentPlan)}
        Tarefas Completadas: ${JSON.stringify(completedTasks)}
        Feedback do Usuário: ${userFeedback}
        
        Forneça:
        1. Análise do progresso
        2. Sugestões de ajustes no plano
        3. Recomendações para melhorar a execução
        4. Próximos passos sugeridos
      `;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 800
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing plan progress:', error);
      throw error;
    }
  }

  async generateDailyMotivation(userName, userProgress) {
    try {
      const prompt = `
        Gere uma mensagem motivacional personalizada para ${userName} considerando:
        
        Progresso: ${JSON.stringify(userProgress)}
        
        A mensagem deve ser:
        1. Curta e impactante
        2. Específica ao progresso do usuário
        3. Motivadora e encorajadora
        4. Incluir emojis relevantes
      `;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 200
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating daily motivation:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();

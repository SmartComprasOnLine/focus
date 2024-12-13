const { OpenAI } = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateCoachResponse(userName, userMessage, currentPlan, interactionHistory) {
    try {
      const systemPrompt = `
        Você é um coach pessoal especializado em TDAH, focado em ajudar ${userName} a melhorar sua produtividade, 
        foco e disposição. Seu objetivo é auxiliar na organização da rotina diária do usuário.
        
        Plano atual do usuário: ${JSON.stringify(currentPlan)}
        
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

      // Adiciona o histórico de interações
      if (interactionHistory && interactionHistory.length > 0) {
        console.log('Processing interaction history:', JSON.stringify(interactionHistory, null, 2));
        interactionHistory.forEach(interaction => {
          if (!interaction.role) {
            console.warn('Interaction missing role:', interaction);
          }
          messages.push({
            role: interaction.role || 'user',  // Fallback para 'user' se role não estiver definido
            content: interaction.content
          });
        });
      }

      // Adiciona a mensagem atual do usuário
      messages.push({ role: 'user', content: userMessage });

      console.log('OpenAI messages:', JSON.stringify(messages, null, 2));

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generating coach response:', error);
      console.error('Error details:', {
        userName,
        userMessage,
        currentPlan,
        interactionHistory
      });
      throw error;
    }
  }

  async generateInitialPlan(userName, userResponses) {
    try {
      const prompt = `
        Como coach especializado em TDAH, crie um plano inicial personalizado para ${userName} 
        com base nas seguintes informações fornecidas:
        
        ${JSON.stringify(userResponses)}
        
        O plano deve incluir:
        1. Rotina diária estruturada
        2. Técnicas de foco e concentração
        3. Estratégias para gestão de tempo
        4. Lembretes e checkpoints importantes
        5. Metas de curto prazo (próximos 7 dias)
        
        Formate o plano de forma estruturada e fácil de seguir.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content;
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
        model: 'gpt-4',
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
        model: 'gpt-4',
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
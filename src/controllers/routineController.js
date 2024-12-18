const Routine = require('../models/Routine');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const reminderService = require('../services/reminderService');
const timezoneService = require('../services/timezoneService');
const intentService = require('../services/intentService');

class RoutineController {
  async createInitialPlan(user, { initialMessage }) {
    try {
      // Generate personalized plan using OpenAI
      const plan = await openaiService.generateInitialPlan(user.name, initialMessage);

      console.log('Generated plan:', JSON.stringify(plan, null, 2));

      // Convert activities to reminders
      const activities = plan.atividades.map(activity => {
        const scheduledTime = activity.horário;
        console.log(`Processing activity at ${scheduledTime}: ${activity.tarefa}`);
        
        return {
          activity: activity.tarefa,
          scheduledTime: scheduledTime,
          type: 'routine',
          status: 'active',
          duration: activity.duração,
          messages: activity.lembretes
        };
      });

      console.log('Converted activities:', JSON.stringify(activities.map(a => ({
        activity: a.activity,
        scheduledTime: a.scheduledTime,
        type: a.type,
        duration: a.duration
      })), null, 2));

      // Create new routine in database
      const routine = await Routine.create({
        userId: user._id,
        routineName: 'Plano Inicial',
        activities: activities
      });

      // Update user with current plan
      user.activeRoutineId = routine._id;
      await user.save();

      // Setup reminders
      await reminderService.setupReminders(user, routine);

      // Format activities and analysis for WhatsApp
      const formattedActivities = plan.atividades.map(a => {
        const energyEmoji = {
          'alta': '⚡',
          'média': '💫',
          'baixa': '🌙'
        }[a.energia] || '⏰';
        
        return `${energyEmoji} *${a.horário}* - _${a.tarefa}_ (${a.duração}min)`;
      }).join('\n');

      // Format suggestions and insights
      const formattedAnalysis = 
        '\n\n*📊 Análise da sua rotina:*\n' +
        '\n*Pontos fortes:*\n' + plan.análise.pontos_fortes.map(p => `• ${p}`).join('\n') +
        '\n\n*💡 Oportunidades de melhoria:*\n' + plan.análise.oportunidades.map(o => `• ${o}`).join('\n');

      // Format follow-up questions
      const formattedQuestions = 
        '\n\n*🤔 Para otimizar ainda mais seu plano, me conte:*\n' +
        plan.análise.perguntas.map(q => `• ${q}`).join('\n');

      // Send complete analysis to user
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Ótimo! Analisei sua rotina e criei um plano personalizado:* 🎯\n\n` +
        formattedActivities +
        formattedAnalysis +
        formattedQuestions +
        '\n\n_Configurei lembretes inteligentes para cada atividade, com dicas de produtividade e foco._ ⏰\n\n' +
        '*Vamos começar?* Responda "sim" para confirmar o plano, ou me conte o que gostaria de ajustar. 😊'
      );

      return routine;
    } catch (error) {
      console.error('Error creating initial plan:', error);
      throw error;
    }
  }

  async updatePlan(user, message) {
    try {
      // Find user's current routine
      const routine = await Routine.findOne({ userId: user._id });

      if (!routine) {
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Você ainda não tem um plano criado.* 📝\n\n_Que tal me contar um pouco sobre sua rotina para eu criar um plano personalizado?_ 😊'
        );
        return;
      }

      // Format current plan for OpenAI
      const currentPlan = {
        atividades: routine.activities.map(a => ({
          horário: a.scheduledTime,
          tarefa: a.activity,
          duração: a.duration,
          categoria: a.type,
          energia: 'média',
          sugestões: [],
          lembretes: a.messages || {}
        }))
      };

      // Generate new plan based on current plan and requested changes
      const newPlan = await openaiService.generateInitialPlan(user.name, message, [
        { role: 'system', content: JSON.stringify(currentPlan) }
      ]);

      // Convert new plan activities to routine format
      const activities = newPlan.atividades.map(activity => ({
        activity: activity.tarefa,
        scheduledTime: activity.horário,
        type: 'routine',
        status: 'active',
        duration: activity.duração,
        messages: activity.lembretes
      }));

      // Update routine with new activities
      routine.activities = activities;
      await routine.save();

      // Update reminders
      await reminderService.setupReminders(user, routine);

      // Format activities for WhatsApp
      const formattedActivities = newPlan.atividades.map(a => {
        const energyEmoji = {
          'alta': '⚡',
          'média': '💫',
          'baixa': '🌙'
        }[a.energia] || '⏰';
        
        return `${energyEmoji} *${a.horário}* - _${a.tarefa}_ (${a.duração}min)`;
      }).join('\n');

      // Format analysis
      const formattedAnalysis = 
        '\n\n*📊 Análise das mudanças:*\n' +
        '\n*Ajustes realizados:*\n' + newPlan.análise.pontos_fortes.map(p => `• ${p}`).join('\n') +
        '\n\n*💡 Recomendações:*\n' + newPlan.análise.oportunidades.map(o => `• ${o}`).join('\n');

      // Send confirmation message
      const confirmMessage = `*Plano atualizado com sucesso!* ✅\n\n` +
        formattedActivities +
        formattedAnalysis +
        '\n\n_Lembretes atualizados nos novos horários!_ ⏰';

      await user.addToMessageHistory('assistant', confirmMessage);
      await evolutionApi.sendText(user.whatsappNumber, confirmMessage);

    } catch (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
  }

  calculateTimeChange(oldTime, newTime) {
    const [oldHours, oldMinutes] = oldTime.split(':').map(Number);
    const [newHours, newMinutes] = newTime.split(':').map(Number);
    return (newHours * 60 + newMinutes) - (oldHours * 60 + oldMinutes);
  }

  adjustSubsequentActivities(routine, changedActivity, timeChange) {
    // Find the index of the changed activity
    const changedIndex = routine.activities.findIndex(a => a === changedActivity);
    if (changedIndex === -1) return;

    // Calculate total duration including buffer
    const calculateEndTime = (activity) => {
      const totalMinutes = this.timeToMinutes(activity.scheduledTime) + activity.duration + 15; // 15min buffer
      return totalMinutes;
    };

    // Adjust subsequent activities
    for (let i = changedIndex + 1; i < routine.activities.length; i++) {
      const prevActivity = routine.activities[i - 1];
      const currentActivity = routine.activities[i];
      
      // Calculate new start time based on previous activity's end
      const prevEndTime = calculateEndTime(prevActivity);
      
      // Update time if it would overlap
      const currentStartTime = this.timeToMinutes(currentActivity.scheduledTime);
      if (currentStartTime < prevEndTime) {
        // Keep time within 24 hours
        const adjustedTime = prevEndTime % (24 * 60);
        const newHours = Math.floor(adjustedTime / 60);
        const newMinutes = adjustedTime % 60;
        currentActivity.scheduledTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
      }
    }
  }

  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  validateTime(time) {
    const minutes = this.timeToMinutes(time);
    if (minutes < 0 || minutes >= 24 * 60) {
      throw new Error(`Invalid time: ${time}`);
    }
    return time;
  }

  async updatePlanProgress(user, completedTasks, feedback) {
    try {
      // Analyze progress and generate adjustments
      const analysis = await openaiService.analyzePlanProgress(
        user.currentPlan,
        completedTasks,
        feedback
      );

      // Update routine in database
      const routine = await Routine.findOne({ userId: user._id });
      if (routine) {
        // Update status of completed activities
        completedTasks.forEach(taskId => {
          const activity = routine.activities.id(taskId);
          if (activity) {
            activity.status = 'completed';
            activity.completedAt = timezoneService.getCurrentTime();
          }
        });
        await routine.save();
      }

      // Send analysis to user with WhatsApp formatting
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Análise do seu progresso:* 📊\n\n_${analysis}_`
      );

      return routine;
    } catch (error) {
      console.error('Error updating plan progress:', error);
      throw error;
    }
  }

  async getDailyMotivation(user) {
    try {
      const routine = await Routine.findOne({ userId: user._id });
      const completedActivities = routine ? 
        routine.activities.filter(a => a.status === 'completed').length : 0;
      const totalActivities = routine ? routine.activities.length : 0;
      
      const progress = {
        completedActivities,
        totalActivities,
        completionRate: totalActivities > 0 ? 
          (completedActivities / totalActivities) * 100 : 0
      };

      const motivation = await openaiService.generateDailyMotivation(
        user.name,
        progress
      );

      // Send motivation with WhatsApp formatting
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Mensagem do dia:* 🌟\n\n_${motivation}_`
      );
    } catch (error) {
      console.error('Error generating daily motivation:', error);
      throw error;
    }
  }

  async getPlanSummary(user) {
    try {
      // Find user's current routine
      const routine = await Routine.findOne({ userId: user._id });

      if (!routine) {
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Você ainda não tem um plano criado.* 📝\n\n_Que tal me contar um pouco sobre sua rotina para eu criar um plano personalizado?_ 😊'
        );
        return;
      }

      // Generate summary using OpenAI
      const summary = await openaiService.generatePlanSummary(
        user.name,
        routine
      );

      // Format sections for WhatsApp
      const formattedSummary = summary
        .replace(/🌅 Manhã/g, '*🌅 Manhã*')
        .replace(/🌞 Tarde/g, '*🌞 Tarde*')
        .replace(/🌙 Noite/g, '*🌙 Noite*')
        .replace(/(\d{2}:\d{2})/g, '*$1*')
        .split('\n')
        .map(line => line.includes(':') && !line.includes('Manhã') && !line.includes('Tarde') && !line.includes('Noite') ? 
          `_${line}_` : line)
        .join('\n');

      // Send summary to user with WhatsApp formatting
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Aqui está o resumo do seu plano:* 📋\n\n${formattedSummary}\n\n_Precisa de algum ajuste? Me avise!_ 😊`
      );

      return routine;
    } catch (error) {
      console.error('Error getting plan summary:', error);
      throw error;
    }
  }
}

module.exports = new RoutineController();

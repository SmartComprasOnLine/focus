const Routine = require('../models/Routine');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const reminderService = require('../services/reminderService');
const timezoneService = require('../services/timezoneService');

class RoutineController {
  async createInitialPlan(user, userResponses) {
    try {
      // Gerar plano personalizado e lembretes usando OpenAI
      const { plan, reminders } = await openaiService.generateInitialPlan(user.name, userResponses);

      console.log('Generated reminders:', JSON.stringify(reminders, null, 2));

      // Converter os lembretes em atividades
      const activities = reminders.map(reminder => {
        const scheduledTime = timezoneService.getScheduledTime(reminder.scheduledTime);
        console.log(`Converting time ${reminder.scheduledTime} to ${timezoneService.formatDate(scheduledTime)}`);
        
        return {
          activity: reminder.activity,
          scheduledTime: scheduledTime,
          type: reminder.type || 'geral',
          status: 'active',
          messages: reminder.messages || {
            before: `⏰ Em 5 minutos: ${reminder.activity}`,
            start: `🎯 Hora de ${reminder.activity}`,
            during: `💪 Continue focado em ${reminder.activity}`,
            after: `✅ Como foi ${reminder.activity}?`
          }
        };
      });

      console.log('Converted activities:', JSON.stringify(activities.map(a => ({
        activity: a.activity,
        scheduledTime: timezoneService.formatDate(a.scheduledTime),
        type: a.type
      })), null, 2));

      // Criar nova rotina no banco de dados
      const routine = await Routine.create({
        userId: user._id,
        routineName: 'Plano Inicial',
        activities: activities
      });

      // Atualizar o usuário com o plano atual
      user.currentPlan = routine._id;
      await user.save();

      // Configurar lembretes
      await reminderService.setupReminders(user, routine);

      // Enviar plano para o usuário
      await evolutionApi.sendText(
        user.whatsappNumber,
        `Ótimo! Criei um plano personalizado para você:\n\n${plan}\n\n` +
        'Configurei lembretes para ajudar você a seguir o plano. Você receberá notificações nos horários programados.\n\n' +
        'Vamos começar? Responda "sim" para confirmar ou me diga se precisar de ajustes. 😊'
      );

      return routine;
    } catch (error) {
      console.error('Error creating initial plan:', error);
      throw error;
    }
  }

  async updatePlanProgress(user, completedTasks, feedback) {
    try {
      // Analisar progresso e gerar ajustes
      const analysis = await openaiService.analyzePlanProgress(
        user.currentPlan,
        completedTasks,
        feedback
      );

      // Atualizar rotina no banco de dados
      const routine = await Routine.findOne({ userId: user._id });
      if (routine) {
        // Atualizar status das atividades completadas
        completedTasks.forEach(taskId => {
          const activity = routine.activities.id(taskId);
          if (activity) {
            activity.status = 'completed';
            activity.completedAt = timezoneService.getCurrentTime();
          }
        });
        await routine.save();
      }

      // Enviar análise para o usuário
      await evolutionApi.sendText(
        user.whatsappNumber,
        `Análise do seu progresso:\n\n${analysis}`
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

      await evolutionApi.sendText(user.whatsappNumber, motivation);
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
          'Você ainda não tem um plano criado. Que tal me contar um pouco sobre sua rotina para eu criar um plano personalizado? 😊'
        );
        return;
      }

      // Generate summary using OpenAI
      const summary = await openaiService.generatePlanSummary(
        user.name,
        routine
      );

      // Send summary to user
      await evolutionApi.sendText(
        user.whatsappNumber,
        `Aqui está o resumo do seu plano:\n\n${summary}\n\nPrecisa de algum ajuste? Me avise! 😊`
      );

      return routine;
    } catch (error) {
      console.error('Error getting plan summary:', error);
      throw error;
    }
  }
}

module.exports = new RoutineController();

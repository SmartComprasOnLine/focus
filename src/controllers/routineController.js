const Routine = require('../models/Routine');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const reminderService = require('../services/reminderService');

class RoutineController {
  async createInitialPlan(user, userResponses) {
    try {
      // Gerar plano personalizado e lembretes usando OpenAI
      const { plan, reminders } = await openaiService.generateInitialPlan(user.name, userResponses);

      // Converter os lembretes em atividades
      const activities = reminders.map(reminder => ({
        activity: reminder.activity,
        scheduledTime: this.getScheduledTime(reminder.scheduledTime),
        type: reminder.type,
        status: 'active',
        messages: reminder.messages
      }));

      // Criar nova rotina no banco de dados
      const routine = await Routine.create({
        userId: user._id,
        routineName: 'Plano Inicial',
        activities: activities
      });

      // Atualizar o usuário com o plano atual
      user.currentPlan = routine._id;
      await user.save();

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

  getScheduledTime(timeString) {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      // Ajusta para o fuso horário local (GMT-3)
      date.setHours(hours - 3, minutes, 0, 0);
      return date;
    } catch (error) {
      console.error('Error converting time:', error);
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
}

module.exports = new RoutineController();

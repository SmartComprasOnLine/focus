const Routine = require('../models/Routine');
const openaiService = require('../services/openaiService');
const evolutionApi = require('../services/evolutionApi');
const reminderService = require('../services/reminderService');
const timezoneService = require('../services/timezoneService');

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

      // Format activities for WhatsApp
      const formattedActivities = plan.atividades.map(a => 
        `⏰ *${a.horário}* - _${a.tarefa}_ (${a.duração}min)`
      ).join('\n');

      // Send plan to user with WhatsApp formatting
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Ótimo! Criei um plano personalizado para você:* 🎯\n\n` +
        formattedActivities +
        '\n\n_Configurei lembretes para ajudar você a seguir o plano. Você receberá notificações nos horários programados._ ⏰\n\n' +
        '*Vamos começar?* Responda "sim" para confirmar ou me diga se precisar de ajustes. 😊'
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

      // Analyze the update request
      const updateInfo = await intentService.analyzePlanUpdate(message, routine);
      console.log('Update info:', updateInfo);

      // Update the routine based on the analysis
      if (updateInfo.type === 'modify') {
        updateInfo.activities.forEach(activityUpdate => {
          const activity = routine.activities.find(a => 
            a.activity === activityUpdate.id || 
            (a.scheduledTime === activityUpdate.time && a.activity === activityUpdate.task)
          );

          if (activity) {
            if (activityUpdate.changes.field === 'time') {
              activity.scheduledTime = activityUpdate.changes.to;
            } else if (activityUpdate.changes.field === 'duration') {
              activity.duration = parseInt(activityUpdate.changes.to);
            }
          }
        });
      }

      await routine.save();

      // Send confirmation message
      const confirmMessage = `*Plano atualizado com sucesso!* ✅\n\nVou te mostrar como ficou:`;
      await evolutionApi.sendText(user.whatsappNumber, confirmMessage);
      
      // Show updated plan
      await this.getPlanSummary(user);

    } catch (error) {
      console.error('Error updating plan:', error);
      throw error;
    }
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

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
        const updatedActivities = [];
        
        for (const activityUpdate of updateInfo.activities) {
          const activity = routine.activities.find(a => {
            // Try to match by activity name containing the target activity
            const activityNameMatch = a.activity.toLowerCase().includes(activityUpdate.task.toLowerCase());
            // Or by time if specified
            const timeMatch = activityUpdate.time && a.scheduledTime === activityUpdate.time;
            return activityNameMatch || timeMatch;
          });

          if (activity) {
            console.log('Updating activity:', {
              from: {
                activity: activity.activity,
                scheduledTime: activity.scheduledTime,
                duration: activity.duration
              },
              changes: activityUpdate.changes
            });

            const originalTime = activity.scheduledTime;

            if (activityUpdate.changes.field === 'time') {
              try {
                // Validate and set new time
                activity.scheduledTime = this.validateTime(activityUpdate.changes.to);
                
                // Calculate time change and adjust subsequent activities
                const timeChange = this.calculateTimeChange(originalTime, activity.scheduledTime);
                this.adjustSubsequentActivities(routine, activity, timeChange);
                
                updatedActivities.push({
                  task: activity.activity,
                  change: `horário atualizado para *${activity.scheduledTime}*`
                });
              } catch (error) {
                console.error('Invalid time update:', error);
                continue;
              }
            } else if (activityUpdate.changes.field === 'duration') {
              const newDuration = parseInt(activityUpdate.changes.to);
              
              if (isNaN(newDuration) || newDuration < 5) {
                console.error('Invalid duration:', activityUpdate.changes.to);
                continue;
              }

              if (newDuration > 240) {
                // For long activities, adjust duration and add buffer
                activity.duration = Math.min(newDuration, 240);
                this.adjustSubsequentActivities(routine, activity, 0);
              } else {
                activity.duration = newDuration;
                this.adjustSubsequentActivities(routine, activity, 0);
              }

              updatedActivities.push({
                task: activity.activity,
                change: `duração atualizada para *${activity.duration} minutos*`
              });
            }
          }
        }

        // Sort activities by time after all updates
        routine.activities.sort((a, b) => this.timeToMinutes(a.scheduledTime) - this.timeToMinutes(b.scheduledTime));

        // Format confirmation message with actual changes made
        const confirmMessage = `*Plano atualizado com sucesso!* ✅\n\n` +
          `*Alterações realizadas:*\n` +
          updatedActivities.map(update => `• ${update.task}: ${update.change}`).join('\n') +
          `\n\n*Seu plano atualizado:*\n` +
          routine.activities.map(a => {
            const isUpdated = updatedActivities.some(update => 
              a.activity.toLowerCase().includes(update.task.toLowerCase())
            );
            return `${isUpdated ? '🔄' : '⏰'} *${a.scheduledTime}* - _${a.activity}_ (${a.duration}min)${isUpdated ? ' ✨' : ''}`;
          }).join('\n') +
          `\n\n_Lembretes atualizados nos novos horários!_ ⏰`;

        await user.addToMessageHistory('assistant', confirmMessage);
        await evolutionApi.sendText(user.whatsappNumber, confirmMessage);
      }

      await routine.save();

      // Update reminders for the modified routine
      await reminderService.setupReminders(user, routine);

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
      const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
      return hours * 60 + minutes + activity.duration + 15; // 15min buffer
    };

    // Adjust subsequent activities
    for (let i = changedIndex + 1; i < routine.activities.length; i++) {
      const prevActivity = routine.activities[i - 1];
      const currentActivity = routine.activities[i];
      
      // Calculate new start time based on previous activity's end
      const prevEndTime = calculateEndTime(prevActivity);
      const newHours = Math.floor(prevEndTime / 60);
      const newMinutes = prevEndTime % 60;
      
      // Update time if it would overlap
      const currentStartTime = this.timeToMinutes(currentActivity.scheduledTime);
      if (currentStartTime < prevEndTime) {
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

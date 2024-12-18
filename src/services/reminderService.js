const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map(); // userId -> [cronJobs]
    this.lastSentReminders = new Map(); // userId_activityId_timing -> timestamp
  }

  clearLastSentReminders(userId) {
    // Clear all lastSentReminders for this user
    for (const key of this.lastSentReminders.keys()) {
      if (key.startsWith(userId)) {
        this.lastSentReminders.delete(key);
      }
    }
  }

  async setupReminders(user, routine) {
    try {
      // Cancel existing reminders for this user
      this.cancelUserReminders(user.id);

      const reminders = [];
      
      // Set up reminders for each activity in the plan
      routine.activities.forEach(activity => {
        // Convert activity time to user's timezone
        const userTime = new Date();
        const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
        userTime.setHours(hours, minutes, 0, 0);

        // Adjust for timezone (America/Sao_Paulo)
        const timezonedDate = new Date(userTime.toLocaleString('en-US', {
          timeZone: 'America/Sao_Paulo'
        }));
        const tzHours = timezonedDate.getHours();
        const tzMinutes = timezonedDate.getMinutes();
        
        // Before reminder (5 minutes before)
        const beforeTime = this.adjustTime(tzHours, tzMinutes, -5);
        const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * *`;
        
        // Start reminder (at scheduled time)
        const startExpression = `${tzMinutes} ${tzHours} * * *`;
        
        // During reminder (15 minutes after start)
        const duringTime = this.adjustTime(tzHours, tzMinutes, 15);
        const duringExpression = `${duringTime.minutes} ${duringTime.hours} * * *`;
        
        // End reminder (at end of duration)
        const endTime = this.adjustTime(tzHours, tzMinutes, activity.duration);
        const endExpression = `${endTime.minutes} ${endTime.hours} * * *`;
        
        // Follow-up reminder (15 minutes after end)
        const followUpTime = this.adjustTime(tzHours, tzMinutes, activity.duration + 15);
        const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * *`;

        // Log the scheduled times for debugging
        console.log('Reminder times for activity:', activity.activity, {
          beforeTime: `${beforeTime.hours}:${beforeTime.minutes}`,
          startTime: `${tzHours}:${tzMinutes}`,
          duringTime: `${duringTime.hours}:${duringTime.minutes}`,
          endTime: `${endTime.hours}:${endTime.minutes}`,
          followUpTime: `${followUpTime.hours}:${followUpTime.minutes}`
        });

        console.log('Setting up reminders for activity:', {
          activity: activity.activity,
          scheduledTime: activity.scheduledTime,
          expressions: {
            before: beforeExpression,
            start: startExpression,
            during: duringExpression,
            end: endExpression,
            followUp: followUpExpression
          }
        });
        
        // Create cron jobs
        const beforeJob = cron.schedule(beforeExpression, async () => {
          await this.sendActivityReminder(user, activity, 'before');
        });
        
        const startJob = cron.schedule(startExpression, async () => {
          await this.sendActivityReminder(user, activity, 'start');
        });
        
        const duringJob = cron.schedule(duringExpression, async () => {
          if (Array.isArray(activity.messages.during)) {
            for (const message of activity.messages.during) {
              await evolutionApi.sendText(user.whatsappNumber, message);
            }
          } else {
            await this.sendActivityReminder(user, activity, 'during');
          }
        });
        
        const endJob = cron.schedule(endExpression, async () => {
          await this.sendActivityReminder(user, activity, 'end');
        });

        const followUpJob = cron.schedule(followUpExpression, async () => {
          await this.sendActivityReminder(user, activity, 'followUp');
          // Ask about activity completion
          await this.askActivityCompletion(user, activity);
        });
        
        reminders.push(
          { activityId: activity._id, timing: 'before', job: beforeJob },
          { activityId: activity._id, timing: 'start', job: startJob },
          { activityId: activity._id, timing: 'during', job: duringJob },
          { activityId: activity._id, timing: 'end', job: endJob },
          { activityId: activity._id, timing: 'followUp', job: followUpJob }
        );
      });
      
      // Store active reminders
      this.activeReminders.set(user.id, reminders);
      
      console.log(`Set up ${reminders.length} reminders for user ${user.name}`);
    } catch (error) {
      console.error('Error setting up reminders:', error);
      throw error;
    }
  }

  adjustTime(hours, minutes, adjustment) {
    const totalMinutes = hours * 60 + minutes + adjustment;
    return {
      hours: Math.floor((totalMinutes + 1440) % 1440 / 60), // Add 1440 (24h) to handle negative times
      minutes: Math.floor((totalMinutes + 1440) % 60)
    };
  }

  async sendActivityReminder(user, activity, timing = 'start') {
    try {
      // Get the last sent message timestamp for this activity
      const lastSentKey = `${user.id}_${activity._id}_${timing}`;
      const lastSent = this.lastSentReminders.get(lastSentKey);
      const now = Date.now();

      // Prevent duplicate messages within 5 minutes
      if (lastSent && (now - lastSent) < 5 * 60 * 1000) {
        console.log('Skipping duplicate reminder:', {
          activity: activity.activity,
          timing,
          timeSinceLastSent: (now - lastSent) / 1000
        });
        return;
      }

      let message;
      if (activity.messages && activity.messages[timing]) {
        message = Array.isArray(activity.messages[timing]) 
          ? activity.messages[timing][0] 
          : activity.messages[timing];
      } else {
        // Default messages
        const defaultMessages = {
          before: `⏰ Em 5 minutos: ${activity.activity}`,
          start: `🎯 Hora de ${activity.activity}`,
          during: `💪 Continue focado em ${activity.activity}`,
          end: `✅ Hora de concluir ${activity.activity}`,
          followUp: `🤔 Como foi ${activity.activity}?`
        };
        message = defaultMessages[timing];
      }
      
      await evolutionApi.sendText(user.whatsappNumber, message);
      
      // Store the timestamp of this message
      this.lastSentReminders.set(lastSentKey, now);
      console.log('Reminder sent:', {
        activity: activity.activity,
        timing,
        message
      });
    } catch (error) {
      console.error('Error sending activity reminder:', error);
      throw error;
    }
  }

  async askActivityCompletion(user, activity) {
    try {
      const motivationalMessages = {
        'planejamento': 'Planejar é o primeiro passo! 🎯',
        'trabalho': 'Cada tarefa é uma conquista! 💪',
        'estudo': 'Conhecimento é poder! 📚',
        'pausa': 'Pausas renovam a energia! 🧘‍♂️',
        'revisão': 'Revisar é evoluir! 📊',
        'geral': 'Cada passo conta! ✨'
      };

      await evolutionApi.sendList(
        user.whatsappNumber,
        'Confirmação de Atividade',
        `Você completou "${activity.activity}"?\n\n` +
        `${motivationalMessages[activity.type] || motivationalMessages['geral']}`,
        'Confirmar',
        [{
          title: 'Status da Atividade',
          rows: [
            {
              title: '✅ Sim, completei!',
              description: 'Marcar como concluída',
              rowId: `completed_${activity._id}`
            },
            {
              title: '❌ Não consegui',
              description: 'Preciso de ajustes',
              rowId: `not_completed_${activity._id}`
            }
          ]
        }]
      );
    } catch (error) {
      console.error('Error asking activity completion:', error);
      throw error;
    }
  }

  cancelUserReminders(userId) {
    try {
      const userReminders = this.activeReminders.get(userId);
      if (userReminders) {
        userReminders.forEach(reminder => {
          reminder.job.stop();
        });
        this.activeReminders.delete(userId);
        this.clearLastSentReminders(userId);
        console.log(`Cancelled reminders for user ${userId}`);
      }
    } catch (error) {
      console.error('Error cancelling user reminders:', error);
      throw error;
    }
  }
}

module.exports = new ReminderService();

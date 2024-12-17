const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map(); // userId -> [cronJobs]
  }

  async setupReminders(user, routine) {
    try {
      // Cancel existing reminders for this user
      this.cancelUserReminders(user.id);

      const reminders = [];
      
      // Set up reminders for each activity in the plan
      routine.activities.forEach(activity => {
        const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
        
        // Before reminder (5 minutes before)
        const beforeTime = this.adjustTime(hours, minutes, -5);
        const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * *`;
        
        // Start reminder (at scheduled time)
        const startExpression = `${minutes} ${hours} * * *`;
        
        // During reminder (15 minutes after start)
        const duringTime = this.adjustTime(hours, minutes, 15);
        const duringExpression = `${duringTime.minutes} ${duringTime.hours} * * *`;
        
        // End reminder (at end of duration)
        const endTime = this.adjustTime(hours, minutes, activity.duration);
        const endExpression = `${endTime.minutes} ${endTime.hours} * * *`;
        
        // Follow-up reminder (15 minutes after end)
        const followUpTime = this.adjustTime(hours, minutes, activity.duration + 15);
        const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * *`;

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
      // Check for custom messages
      if (activity.messages && activity.messages[timing]) {
        const message = Array.isArray(activity.messages[timing]) 
          ? activity.messages[timing][0] 
          : activity.messages[timing];
        await evolutionApi.sendText(user.whatsappNumber, message);
        return;
      }

      // Default messages based on activity type
      const defaultMessages = {
        'planejamento': {
          before: '📋 Em 5 minutos: Momento de planejar!',
          start: '📋 Hora de planejar! Vamos organizar.',
          during: '📋 Continue organizando.',
          end: '📋 Hora de finalizar o planejamento.',
          followUp: '📋 Como foi o planejamento?'
        },
        'trabalho': {
          before: '💼 Em 5 minutos: Prepare-se para o trabalho!',
          start: '💼 Hora de trabalhar!',
          during: '💼 Mantenha o foco!',
          end: '💼 Hora de concluir o trabalho.',
          followUp: '💼 Como foi o trabalho?'
        },
        'estudo': {
          before: '📚 Em 5 minutos: Prepare seu ambiente!',
          start: '📚 Hora de estudar!',
          during: '📚 Continue focado!',
          end: '📚 Hora de concluir os estudos.',
          followUp: '📚 Como foi o estudo?'
        },
        'pausa': {
          before: '⏰ Em 5 minutos: Prepare-se para a pausa!',
          start: '☕ Hora da pausa!',
          during: '🧘‍♂️ Aproveite para relaxar.',
          end: '⏰ Hora de retornar.',
          followUp: '💪 Como foi a pausa?'
        },
        'revisão': {
          before: '📊 Em 5 minutos: Prepare-se para revisar!',
          start: '📊 Hora da revisão!',
          during: '📊 Continue avaliando.',
          end: '📊 Hora de concluir a revisão.',
          followUp: '📊 Como foi a revisão?'
        },
        'geral': {
          before: `⏰ Em 5 minutos: ${activity.activity}`,
          start: `🎯 Hora de ${activity.activity}`,
          during: `💪 Continue com ${activity.activity}`,
          end: `✅ Hora de concluir ${activity.activity}`,
          followUp: `🤔 Como foi ${activity.activity}?`
        }
      };

      const message = defaultMessages[activity.type]?.[timing] || 
                     defaultMessages['geral'][timing];
      
      await evolutionApi.sendText(user.whatsappNumber, message);
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
        console.log(`Cancelled reminders for user ${userId}`);
      }
    } catch (error) {
      console.error('Error cancelling user reminders:', error);
      throw error;
    }
  }
}

module.exports = new ReminderService();

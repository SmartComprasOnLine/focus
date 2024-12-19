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

  setupActivityReminders(activity) {
    // Parse activity time and calculate reminders
    const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
    const beforeTime = this.adjustTime(hours, minutes, -5);
    const followUpTime = this.adjustTime(hours, minutes, activity.duration);
    
    // Determine os dias da semana para esta atividade
    const days = activity.schedule?.days || ['*']; // '*' significa todos os dias
    const daysExpression = days[0] === '*' ? '*' : days.join(',');
    
    // Create cron expressions
    const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * ${daysExpression}`;
    const startExpression = `${minutes} ${hours} * * ${daysExpression}`;
    const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * ${daysExpression}`;
    
    // Log detalhado da configuração
    console.log(`⏰ Atividade: ${activity.activity}`, {
      'Agenda': {
        'Dias': days[0] === '*' ? 'Todos os dias' : days.join(', '),
        'Horário': `${this.formatTime(hours, minutes)} (${activity.duration}min)`
      },
      'Lembretes': {
        'Preparação': `${this.formatTime(beforeTime.hours, beforeTime.minutes)}`,
        'Início': `${this.formatTime(hours, minutes)}`,
        'Conclusão': `${this.formatTime(followUpTime.hours, followUpTime.minutes)}`
      }
    });

    return {
      times: { beforeTime, hours, minutes, followUpTime },
      expressions: { beforeExpression, startExpression, followUpExpression }
    };
  }

  async setupReminders(user, routine, isUpdate = false) {
    try {
      // Get existing reminders before canceling
      const existingReminders = this.activeReminders.get(user.id) || [];
      
      if (isUpdate) {
        // Cancel only specific reminders if updating
        routine.activities.forEach(activity => {
          const existingActivity = existingReminders.find(r => 
            r.activityId.toString() === activity._id.toString()
          );
          if (existingActivity) {
            existingActivity.job.stop();
          }
        });
      } else {
        // Cancel all reminders for new setup
        this.cancelUserReminders(user.id);
        
        // Send setup message only for new setups
        await evolutionApi.sendText(
          user.whatsappNumber,
          `*Seus lembretes foram configurados!* ⏰\n\n` +
          `Para cada atividade do seu dia, você receberá:\n` +
          `• Um lembrete 5 minutos antes para se preparar\n` +
          `• Uma notificação no horário de início\n` +
          `• Um acompanhamento ao finalizar\n\n` +
          `Por exemplo, para uma atividade às ${this.formatTime(9, 0)}:\n` +
          `• ${this.formatTime(8, 55)} - Preparação\n` +
          `• ${this.formatTime(9, 0)} - Início\n` +
          `• ${this.formatTime(9, 30)} - Acompanhamento (após 30min)\n\n` +
          `_Os lembretes respeitarão sua agenda de cada dia_ 🔄\n` +
          `_Para ajustar os horários, basta me avisar!_ 💪`
        );
      }

      // Combine existing and new reminders
      let reminders = isUpdate ? 
        existingReminders.filter(r => !routine.activities.find(a => 
          a._id.toString() === r.activityId.toString()
        )) : [];
      
      // Configure reminders for each activity
      console.log(`📅 Iniciando configuração de lembretes para: ${user.name}`);
      routine.activities.forEach(activity => {
        const { times, expressions } = this.setupActivityReminders(activity);
        const { beforeTime, hours, minutes, followUpTime } = times;
        const { beforeExpression, startExpression, followUpExpression } = expressions;

        // Create cron jobs
        const beforeJob = cron.schedule(beforeExpression, async () => {
          await this.sendActivityReminder(user, activity, 'before');
        });
        
        const startJob = cron.schedule(startExpression, async () => {
          await this.sendActivityReminder(user, activity, 'start');
        });

        const followUpJob = cron.schedule(followUpExpression, async () => {
          await this.sendActivityReminder(user, activity, 'followUp');
          // Ask about activity completion
          await this.askActivityCompletion(user, activity);
        });
        
        reminders.push(
          { activityId: activity._id, timing: 'before', job: beforeJob },
          { activityId: activity._id, timing: 'start', job: startJob },
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
    // Ensure positive values for modulo operation
    const totalMinutes = (hours * 60 + minutes + adjustment + 1440) % 1440;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: Math.floor(totalMinutes % 60)
    };
  }

  formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
          before: `⏰ Prepare-se! Em 5 minutos começa: ${activity.activity}`,
          start: `🎯 Hora de iniciar: ${activity.activity}`,
          followUp: `✅ Hora de finalizar: ${activity.activity}\n_Como foi a atividade?_`
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
        'Acompanhamento Diário',
        `Como foi a atividade "${activity.activity}" hoje?\n\n` +
        `${motivationalMessages[activity.type] || motivationalMessages['geral']}\n\n` +
        `_Seus lembretes continuarão amanhã no mesmo horário_ ⏰`,
        'Confirmar',
        [{
          title: 'Status da Atividade',
          rows: [
            {
              title: '✅ Completei hoje!',
              description: 'Marcar como concluída',
              rowId: `completed_${activity._id}`
            },
            {
              title: '❌ Não consegui hoje',
              description: 'Preciso de ajustes',
              rowId: `not_completed_${activity._id}`
            },
            {
              title: '⚙️ Ajustar lembretes',
              description: 'Modificar frequência ou horários',
              rowId: `adjust_reminders_${activity._id}`
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

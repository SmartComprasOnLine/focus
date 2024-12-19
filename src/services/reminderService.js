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

      // Enviar mensagem explicativa sobre os lembretes
      await evolutionApi.sendText(
        user.whatsappNumber,
        `*Seus lembretes foram configurados!* ⏰\n\n` +
        `Você receberá 3 lembretes diários para cada atividade:\n` +
        `• 5 minutos antes do início\n` +
        `• No horário marcado\n` +
        `• Ao finalizar a atividade\n\n` +
        `_Vou te ajudar a manter o foco e acompanhar seu progresso diário!_ 💪`
      );

      const reminders = [];
      
      // Configurar lembretes diários para cada atividade
      console.log('Configurando lembretes diários para:', user.name);
      routine.activities.forEach(activity => {
        // Parse activity time
        const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
        
        // Create a date in America/Sao_Paulo timezone
        const userTime = new Date();
        userTime.setHours(hours, minutes, 0, 0);

        // Get hours and minutes directly (no timezone conversion needed as we're already in Sao Paulo time)
        const tzHours = hours;
        const tzMinutes = minutes;
        
        // Before reminder (5 minutes before)
        const beforeTime = this.adjustTime(tzHours, tzMinutes, -5);
        const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * *`;
        
        // Start reminder (at scheduled time)
        const startExpression = `${tzMinutes} ${tzHours} * * *`;
        
        // Follow-up reminder (at end of duration)
        const followUpTime = this.adjustTime(tzHours, tzMinutes, activity.duration);
        const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * *`;

        // Log the scheduled times for debugging
        console.log(`Configurando lembretes para: ${activity.activity} (${activity.scheduledTime})`, {
          'Horário original': activity.scheduledTime,
          'Lembrete antes': this.formatTime(beforeTime.hours, beforeTime.minutes),
          'Início': this.formatTime(tzHours, tzMinutes),
          'Acompanhamento': this.formatTime(followUpTime.hours, followUpTime.minutes)
        });

        // Log cron expressions for verification
        console.log('Expressões cron:', {
          'Atividade': activity.activity,
          'Antes': `${beforeExpression} (${this.formatTime(beforeTime.hours, beforeTime.minutes)})`,
          'Início': `${startExpression} (${this.formatTime(tzHours, tzMinutes)})`,
          'Acompanhamento': `${followUpExpression} (${this.formatTime(followUpTime.hours, followUpTime.minutes)})`
        });
        
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

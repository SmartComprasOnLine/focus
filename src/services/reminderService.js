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
    
    // Determine os dias da semana para esta atividade
    const days = activity.schedule?.days || ['*']; // '*' significa todos os dias
    const daysExpression = days[0] === '*' ? '*' : days.join(',');
    
    // Ajusta horários para timezone America/Sao_Paulo
    const spTimezone = 'America/Sao_Paulo';
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: spTimezone }));
    userTime.setHours(hours, minutes, 0, 0);
    
    // Calcula horários dos lembretes
    const beforeTime = this.adjustTime(hours, minutes, -5);
    const followUpTime = this.adjustTime(hours, minutes, activity.duration);
    
    // Cria expressões cron
    const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * ${daysExpression}`;
    const startExpression = `${minutes} ${hours} * * ${daysExpression}`;
    const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * ${daysExpression}`;

    // Log unificado e detalhado
    console.log(`⏰ Configurando lembretes para: ${activity.activity}`, {
      'Agenda': {
        'Dias': days[0] === '*' ? 'Todos os dias' : days.join(', '),
        'Horário': `${this.formatTime(hours, minutes)} (${activity.duration}min)`,
        'Timezone': spTimezone
      },
      'Lembretes': {
        'Preparação': `${this.formatTime(beforeTime.hours, beforeTime.minutes)} (${beforeExpression})`,
        'Início': `${this.formatTime(hours, minutes)} (${startExpression})`,
        'Conclusão': `${this.formatTime(followUpTime.hours, followUpTime.minutes)} (${followUpExpression})`
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
    // Convert to Date object for proper timezone handling
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    // Add adjustment in minutes
    date.setMinutes(date.getMinutes() + adjustment);
    
    // Get time in America/Sao_Paulo timezone
    const spTime = date.toLocaleString('en-US', { 
      timeZone: 'America/Sao_Paulo',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Parse hours and minutes
    const [adjustedHours, adjustedMinutes] = spTime.split(':').map(Number);
    
    return {
      hours: adjustedHours,
      minutes: adjustedMinutes
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
          followUp: activity.activity.toLowerCase().includes('sono') || activity.activity.toLowerCase().includes('dormir') ?
            `✅ Hora de finalizar: ${activity.activity}\nBom descanso! 😴` :
            `✅ Hora de finalizar: ${activity.activity}\n_Como foi a atividade?_`
        };

        // Ajusta mensagem baseado no tipo de atividade
        if (activity.activity.toLowerCase().includes('expediente') || 
            activity.activity.toLowerCase().includes('trabalho')) {
          defaultMessages.before = `⏰ Em 5 minutos inicia seu ${activity.activity}`;
          defaultMessages.start = `🎯 Momento de focar no ${activity.activity}`;
          defaultMessages.followUp = `✅ Hora de concluir ${activity.activity}\n_Como foi sua produtividade?_`;
        } else if (activity.activity.toLowerCase().includes('pausa') || 
                   activity.activity.toLowerCase().includes('descanso')) {
          defaultMessages.before = `⏰ Em 5 minutos é hora da sua ${activity.activity}`;
          defaultMessages.start = `🧘‍♂️ Momento de sua ${activity.activity}`;
          defaultMessages.followUp = `✅ Fim da ${activity.activity}\n_Está mais renovado?_`;
        }
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

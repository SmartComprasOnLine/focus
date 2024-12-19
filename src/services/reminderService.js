const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map(); // userId -> [cronJobs]
    this.lastSentReminders = new Map(); // userId_activityId_timing -> timestamp
  }

  async getCurrentPlan(user) {
    try {
      // Verifica se usuário tem plano atual
      if (!user.currentPlan?.activities?.length) {
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Você ainda não tem um plano criado.* 📝\n\n' +
          '_Que tal me contar um pouco sobre sua rotina para eu criar um plano personalizado?_ 😊'
        );
        return null;
      }

      // Verifica última atualização
      const lastUpdate = user.currentPlan.lastUpdate;
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

      // Se o plano foi atualizado há mais de 24 horas, sugere criar novo
      if (hoursSinceUpdate > 24) {
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Seu último plano foi criado há mais de 24 horas.* ⏰\n\n' +
          '_Que tal atualizarmos sua rotina para hoje?_ 😊'
        );
        return null;
      }

      // Formata plano atual para exibição
      console.log('Formatando plano para exibição:', {
        userId: user.id,
        activitiesCount: user.currentPlan.activities.length,
        lastUpdate: user.currentPlan.lastUpdate
      });

      const activities = user.currentPlan.activities.reduce((acc, activity) => {
        const period = this.getPeriod(activity.scheduledTime);
        if (!acc[period]) {
          acc[period] = [];
        }
        acc[period].push(activity);
        return acc;
      }, {});

      // Organiza por período
      const formattedPlan = {
        '*🌅 Manhã (até 12:00)*': [],
        '*🌞 Tarde (12:00-18:00)*': [],
        '*🌙 Noite (após 18:00)*': []
      };

      // Preenche atividades por período
      Object.entries(activities).forEach(([period, acts]) => {
        acts.sort((a, b) => {
          const [aHours, aMinutes] = a.scheduledTime.split(':').map(Number);
          const [bHours, bMinutes] = b.scheduledTime.split(':').map(Number);
          return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
        });

        formattedPlan[period] = acts.map(a => 
          `• *${a.scheduledTime}* _${a.activity}${a.duration ? ` (${a.duration}min)` : ''}_`
        );
      });

      // Monta mensagem
      let message = Object.entries(formattedPlan)
        .filter(([_, acts]) => acts.length > 0)
        .map(([period, acts]) => `${period}\n${acts.join('\n')}`)
        .join('\n\n');

      message += '\n\n_Equilíbrio e produtividade são a chave para um dia bem-sucedido!_ ✨\n\n';
      message += 'Precisa de algum ajuste? Me avise! 😊';

      return message;
    } catch (error) {
      console.error('Erro ao buscar plano atual:', error);
      throw error;
    }
  }

  getPeriod(time) {
    const [hours] = time.split(':').map(Number);
    if (hours < 12) return '*🌅 Manhã (até 12:00)*';
    if (hours < 18) return '*🌞 Tarde (12:00-18:00)*';
    return '*🌙 Noite (após 18:00)*';
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
      console.log('Configurando lembretes para usuário:', {
        userId: user.id,
        isUpdate,
        activitiesCount: routine.activities.length
      });

      // Verifica se já existe plano
      const existingReminders = this.activeReminders.get(user.id) || [];
      const hadPreviousPlan = existingReminders.length > 0;
      
      // Cancela lembretes existentes
      this.cancelUserReminders(user.id);
      
      // Envia mensagem de configuração apenas se necessário
      if (!hadPreviousPlan && !isUpdate) {
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

      try {
        // Valida e formata as atividades
        const formattedActivities = routine.activities.map(activity => {
          // Valida formato do horário
          if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(activity.scheduledTime)) {
            throw new Error(`Invalid time format for activity "${activity.activity}": ${activity.scheduledTime}`);
          }

          // Valida duração
          if (activity.duration < 5 || activity.duration > 480) {
            throw new Error(`Invalid duration for activity "${activity.activity}": ${activity.duration}`);
          }

          // Formata dias da semana
          const days = activity.schedule?.days?.map(day => 
            day.toLowerCase()
          ) || ['*'];

          if (!days.every(day => 
            day === '*' || 
            ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(day)
          )) {
            throw new Error(`Invalid days format for activity "${activity.activity}": ${days.join(', ')}`);
          }

          return {
            activity: activity.activity,
            scheduledTime: activity.scheduledTime,
            duration: activity.duration,
            type: activity.type || 'routine',
            status: 'pending',
            schedule: {
              days,
              repeat: activity.schedule?.repeat || 'daily'
            }
          };
        });

        // Atualiza plano no banco
        await user.updateOne({
          $set: {
            'currentPlan.activities': formattedActivities,
            'currentPlan.lastUpdate': new Date()
          }
        }, { 
          runValidators: true,
          new: true 
        });

        // Atualiza usuário em memória
        user.currentPlan = {
          activities: formattedActivities,
          lastUpdate: new Date()
        };

        console.log('Plano atualizado com sucesso:', {
          userId: user.id,
          activitiesCount: formattedActivities.length,
          lastUpdate: new Date()
        });
      } catch (error) {
        console.error('Erro ao atualizar plano:', error);
        throw new Error(`Erro ao atualizar plano: ${error.message}`);
      }

      // Configura novos lembretes
      const reminders = [];
      
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

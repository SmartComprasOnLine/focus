const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map(); // userId -> [cronJobs]
    this.lastSentReminders = new Map(); // userId_activityId_timing -> timestamp
  }

  clearLastSentReminders(userId) {
    for (const key of this.lastSentReminders.keys()) {
      if (key.startsWith(userId)) {
        this.lastSentReminders.delete(key);
      }
    }
  }

  validatePlan(activities) {
    const errors = [];
    const warnings = [];
    let totalWorkMinutes = 0;
    let lastBreakTime = null;
    let continuousWorkMinutes = 0;

    // Agrupar atividades por dia
    const dailyActivities = {};
    activities.forEach(activity => {
      const days = activity.schedule?.days || ['*'];
      days.forEach(day => {
        if (!dailyActivities[day]) {
          dailyActivities[day] = [];
        }
        dailyActivities[day].push(activity);
      });
    });

    // Validar cada dia separadamente
    Object.entries(dailyActivities).forEach(([day, dayActivities]) => {
      if (dayActivities.length > 20) {
        warnings.push(`Muitas atividades programadas para ${day === '*' ? 'todos os dias' : day} (${dayActivities.length})`);
      }

      let dayWorkMinutes = 0;
      dayActivities.sort((a, b) => {
        const [aHours, aMinutes] = a.scheduledTime.split(':').map(Number);
        const [bHours, bMinutes] = b.scheduledTime.split(':').map(Number);
        return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
      });

      dayActivities.forEach((activity, index) => {
        // Validar formato de horário
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(activity.scheduledTime)) {
          errors.push(`Horário inválido em "${activity.activity}": ${activity.scheduledTime}`);
        }

        // Validar duração
        if (activity.duration < 5 || activity.duration > 480) {
          errors.push(`Duração inválida em "${activity.activity}": ${activity.duration}min`);
        }

        // Validar tempo mínimo entre atividades
        if (index > 0) {
          const prevActivity = dayActivities[index - 1];
          const gap = this.getMinutesBetween(
            this.addMinutes(prevActivity.scheduledTime, prevActivity.duration),
            activity.scheduledTime
          );
          if (gap < 5) {
            errors.push(`Tempo insuficiente entre "${prevActivity.activity}" e "${activity.activity}" (${gap}min)`);
          }
        }

        // Calcular tempo de trabalho
        const isBreak = activity.activity.toLowerCase().includes('pausa') || 
                       activity.activity.toLowerCase().includes('almoço') || 
                       activity.activity.toLowerCase().includes('descanso');

        if (!isBreak) {
          dayWorkMinutes += activity.duration;
          continuousWorkMinutes += activity.duration;
        } else if (activity.duration >= 15) {
          continuousWorkMinutes = 0;
          lastBreakTime = activity.scheduledTime;
        }

        // Validar tempo contínuo
        if (continuousWorkMinutes > 240) {
          warnings.push(`Período longo sem pausa adequada após "${activity.activity}"`);
        }
      });

      // Validar tempo total do dia
      if (dayWorkMinutes > 600) {
        warnings.push(`Tempo total de trabalho muito longo em ${day === '*' ? 'todos os dias' : day}: ${Math.floor(dayWorkMinutes/60)}h${dayWorkMinutes%60}min`);
      }

      // Verificar pausa para almoço
      const lunchTime = dayActivities.find(a => 
        a.activity.toLowerCase().includes('almoço') && 
        a.duration >= 30 &&
        this.isTimeInRange(a.scheduledTime, '11:00', '14:00')
      );

      if (!lunchTime) {
        warnings.push('Não foi encontrada pausa adequada para almoço (mínimo 30min entre 11h e 14h)');
      }
    });

    return { errors, warnings };
  }

  isTimeInRange(time, start, end) {
    const [h, m] = time.split(':').map(Number);
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const t = h * 60 + m;
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    return t >= s && t <= e;
  }

  addMinutes(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    return this.formatTime(
      Math.floor(totalMinutes / 60) % 24,
      totalMinutes % 60
    );
  }

  getMinutesBetween(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  }

  formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  async setupReminders(user, routine, isUpdate = false) {
    try {
      // Valida plano
      const { errors, warnings } = this.validatePlan(routine.activities);

      if (errors.length > 0) {
        // Envia mensagem de erro para o usuário
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Encontrei alguns problemas no seu plano:* ❌\n\n' +
          errors.map(err => `• ${err}`).join('\n') +
          '\n\nPor favor, corrija esses problemas e tente novamente! 🙏'
        );
        throw new Error('Validation failed: ' + errors.join(', '));
      }

      if (warnings.length > 0) {
        // Envia avisos para o usuário
        await evolutionApi.sendText(
          user.whatsappNumber,
          '*Algumas observações sobre seu plano:* ⚠️\n\n' +
          warnings.map(warn => `• ${warn}`).join('\n') +
          '\n\nDeseja continuar mesmo assim? Responda "sim" para confirmar ou me conte o que gostaria de ajustar. 🤔'
        );
        return;
      }

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

      // Formata atividades
      const formattedActivities = routine.activities.map(activity => ({
        activity: activity.activity,
        scheduledTime: activity.scheduledTime,
        duration: activity.duration,
        type: activity.type || 'routine',
        status: 'pending',
        schedule: {
          days: activity.schedule?.days?.map(day => day.toLowerCase()) || ['*'],
          repeat: activity.schedule?.repeat || 'daily'
        }
      }));

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

      // Configura novos lembretes
      const reminders = [];
      
      // Configure reminders for each activity
      console.log(`📅 Iniciando configuração de lembretes para: ${user.name}`);
      routine.activities.forEach(activity => {
        const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
        
        // Determine os dias da semana para esta atividade
        const days = activity.schedule?.days || ['*'];
        const daysExpression = days[0] === '*' ? '*' : days.join(',');
        
        // Calculate reminder times
        const beforeTime = this.adjustTime(hours, minutes, -5);
        const followUpTime = this.adjustTime(hours, minutes, activity.duration);
        
        // Create cron expressions
        const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * ${daysExpression}`;
        const startExpression = `${minutes} ${hours} * * ${daysExpression}`;
        const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * ${daysExpression}`;

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
      console.error('Erro ao atualizar plano:', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });

      // Envia mensagem de erro amigável para o usuário
      await evolutionApi.sendText(
        user.whatsappNumber,
        '*Ops! Tive um problema ao atualizar seu plano.* 😅\n\n' +
        'Parece que houve um erro com:\n' +
        (error.message.includes('time format') ? 
          '• Formato de horário inválido (use HH:MM)\n' :
         error.message.includes('duration') ?
          '• Duração inválida (mínimo 5min, máximo 8h)\n' :
         error.message.includes('days format') ?
          '• Dias da semana inválidos\n' :
          '• Formato dos dados\n'
        ) +
        '\nPor favor, tente novamente com valores válidos! 🙏'
      );

      throw error;
    }
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

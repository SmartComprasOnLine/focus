const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map();
    this.lastSentReminders = new Map();
  }

  clearLastSentReminders(userId) {
    for (const key of this.lastSentReminders.keys()) {
      if (key.startsWith(userId)) {
        this.lastSentReminders.delete(key);
      }
    }
  }

  async setupReminders(user, routine, isUpdate = false) {
    try {
      // Analisa plano e oferece sugestões
      const suggestions = this.analyzePlan(routine.activities);

      if (suggestions.length > 0) {
        // Formata mensagem de sugestões
        let message = '*Algumas sugestões para otimizar seu plano:* 💡\n\n';
        
        const groupedSuggestions = suggestions.reduce((acc, sugg) => {
          if (!acc[sugg.type]) acc[sugg.type] = [];
          acc[sugg.type].push(sugg.message);
          return acc;
        }, {});

        if (groupedSuggestions.overlap) {
          message += '*Ajustes de Horário:*\n' + 
                    groupedSuggestions.overlap.map(s => `• ${s}`).join('\n') + '\n\n';
        }
        
        if (groupedSuggestions.long_work) {
          message += '*Pausas Sugeridas:*\n' + 
                    groupedSuggestions.long_work.map(s => `• ${s}`).join('\n') + '\n\n';
        }
        
        if (groupedSuggestions.work_balance || groupedSuggestions.meal_time) {
          message += '*Bem-estar:*\n' + 
                    [...(groupedSuggestions.work_balance || []), 
                     ...(groupedSuggestions.meal_time || [])]
                    .map(s => `• ${s}`).join('\n') + '\n\n';
        }

        message += '_Estas são apenas sugestões para seu bem-estar. Você pode continuar com seu plano atual ou fazer ajustes como preferir!_ ✨';

        await evolutionApi.sendText(user.whatsappNumber, message);
      }

      // Get existing reminders
      const existingReminders = this.activeReminders.get(user.id) || [];
      
      // Cancel existing reminders if updating
      if (isUpdate) {
        routine.activities.forEach(activity => {
          const existingActivity = existingReminders.find(r => 
            r.activityId.toString() === activity._id.toString()
          );
          if (existingActivity) {
            existingActivity.job.stop();
          }
        });
      } else {
        this.cancelUserReminders(user.id);
        
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
          `• ${this.formatTime(9, 30)} - Acompanhamento\n\n` +
          `_Os lembretes respeitarão sua agenda de cada dia_ 🔄\n` +
          `_Para ajustar os horários, basta me avisar!_ 💪`
        );
      }

      // Format activities
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

      // Update plan in database
      await user.updateOne({
        $set: {
          'currentPlan.activities': formattedActivities,
          'currentPlan.lastUpdate': new Date()
        }
      }, { 
        runValidators: true,
        new: true 
      });

      // Update user in memory
      user.currentPlan = {
        activities: formattedActivities,
        lastUpdate: new Date()
      };

      // Setup new reminders
      const reminders = [];
      
      console.log(`📅 Configurando lembretes para: ${user.name}`);
      routine.activities.forEach(activity => {
        const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
        const days = activity.schedule?.days || ['*'];
        const daysExpression = days[0] === '*' ? '*' : days.join(',');
        
        const beforeTime = this.adjustTime(hours, minutes, -5);
        const followUpTime = this.adjustTime(hours, minutes, activity.duration);
        
        const beforeExpression = `${beforeTime.minutes} ${beforeTime.hours} * * ${daysExpression}`;
        const startExpression = `${minutes} ${hours} * * ${daysExpression}`;
        const followUpExpression = `${followUpTime.minutes} ${followUpTime.hours} * * ${daysExpression}`;

        const beforeJob = cron.schedule(beforeExpression, async () => {
          await this.sendActivityReminder(user, activity, 'before');
        });
        
        const startJob = cron.schedule(startExpression, async () => {
          await this.sendActivityReminder(user, activity, 'start');
        });

        const followUpJob = cron.schedule(followUpExpression, async () => {
          await this.sendActivityReminder(user, activity, 'followUp');
          await this.askActivityCompletion(user, activity);
        });
        
        reminders.push(
          { activityId: activity._id, timing: 'before', job: beforeJob },
          { activityId: activity._id, timing: 'start', job: startJob },
          { activityId: activity._id, timing: 'followUp', job: followUpJob }
        );
      });
      
      this.activeReminders.set(user.id, reminders);
      console.log(`✅ ${reminders.length} lembretes configurados para ${user.name}`);

    } catch (error) {
      console.error('Erro ao configurar lembretes:', {
        userId: user.id,
        error: error.message,
        stack: error.stack
      });

      await evolutionApi.sendText(
        user.whatsappNumber,
        '*Ops! Tive um pequeno problema ao configurar seus lembretes.* 😅\n\n' +
        'Por favor, tente novamente ou me avise se precisar de ajuda! 🙏'
      );

      throw error;
    }
  }

  analyzePlan(activities) {
    const suggestions = [];
    let continuousWorkMinutes = 0;
    let lastBreakTime = null;

    const dailyActivities = activities.reduce((acc, activity) => {
      const days = activity.schedule?.days || ['*'];
      days.forEach(day => {
        if (!acc[day]) acc[day] = [];
        acc[day].push(activity);
      });
      return acc;
    }, {});

    Object.entries(dailyActivities).forEach(([day, dayActivities]) => {
      dayActivities.sort((a, b) => {
        const [aHours, aMinutes] = a.scheduledTime.split(':').map(Number);
        const [bHours, bMinutes] = b.scheduledTime.split(':').map(Number);
        return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
      });

      let dayWorkMinutes = 0;

      dayActivities.forEach((activity, index) => {
        if (index > 0) {
          const prevActivity = dayActivities[index - 1];
          const gap = this.getMinutesBetween(
            this.addMinutes(prevActivity.scheduledTime, prevActivity.duration),
            activity.scheduledTime
          );
          
          if (gap < 0) {
            suggestions.push({
              type: 'overlap',
              message: `Considere ajustar o horário de "${activity.activity}" para evitar sobreposição`
            });
          }
        }

        const isBreak = this.isBreakActivity(activity);
        if (!isBreak) {
          dayWorkMinutes += activity.duration;
          continuousWorkMinutes += activity.duration;
        } else {
          continuousWorkMinutes = 0;
          lastBreakTime = activity.scheduledTime;
        }

        if (continuousWorkMinutes > 180) {
          suggestions.push({
            type: 'long_work',
            message: `Uma pausa após "${activity.activity}" pode ajudar sua produtividade`
          });
        }
      });

      if (dayWorkMinutes > 480) {
        suggestions.push({
          type: 'work_balance',
          message: 'Considere distribuir melhor as atividades para evitar sobrecarga'
        });
      }

      if (!dayActivities.some(a => this.isBreakActivity(a))) {
        suggestions.push({
          type: 'meal_time',
          message: 'Incluir pausas regulares ajuda a manter sua energia ao longo do dia'
        });
      }
    });

    return suggestions;
  }

  isBreakActivity(activity) {
    const name = activity.activity.toLowerCase();
    return name.includes('pausa') || 
           name.includes('almoço') || 
           name.includes('descanso') ||
           name.includes('intervalo');
  }

  async sendActivityReminder(user, activity, timing = 'start') {
    try {
      const lastSentKey = `${user.id}_${activity._id}_${timing}`;
      const lastSent = this.lastSentReminders.get(lastSentKey);
      const now = Date.now();

      if (lastSent && (now - lastSent) < 5 * 60 * 1000) {
        return;
      }

      const messages = {
        before: `⏰ Em 5 minutos: ${activity.activity}`,
        start: `🎯 Hora de iniciar: ${activity.activity}`,
        followUp: `✅ Hora de finalizar: ${activity.activity}`
      };

      if (this.isBreakActivity(activity)) {
        messages.before = `⏰ Em 5 minutos é hora da sua pausa`;
        messages.start = `🧘‍♂️ Momento de descansar um pouco`;
        messages.followUp = `✅ Fim da pausa. Pronto para continuar?`;
      }

      await evolutionApi.sendText(user.whatsappNumber, messages[timing]);
      this.lastSentReminders.set(lastSentKey, now);

    } catch (error) {
      console.error('Erro ao enviar lembrete:', error);
      throw error;
    }
  }

  async askActivityCompletion(user, activity) {
    try {
      if (!this.isBreakActivity(activity)) {
        await evolutionApi.sendList(
          user.whatsappNumber,
          'Como foi a atividade?',
          `"${activity.activity}"\n\n` +
          `_Seu feedback ajuda a melhorar suas sugestões!_ ✨`,
          'Responder',
          [{
            title: 'Status',
            rows: [
              {
                title: '✅ Completei!',
                description: 'Tudo certo',
                rowId: `completed_${activity._id}`
              },
              {
                title: '⚙️ Preciso ajustar',
                description: 'Modificar horário/duração',
                rowId: `adjust_${activity._id}`
              }
            ]
          }]
        );
      }
    } catch (error) {
      console.error('Erro ao pedir feedback:', error);
      throw error;
    }
  }

  cancelUserReminders(userId) {
    try {
      const userReminders = this.activeReminders.get(userId);
      if (userReminders) {
        userReminders.forEach(reminder => reminder.job.stop());
        this.activeReminders.delete(userId);
        this.clearLastSentReminders(userId);
      }
    } catch (error) {
      console.error('Erro ao cancelar lembretes:', error);
      throw error;
    }
  }

  formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  adjustTime(hours, minutes, adjustment) {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setMinutes(date.getMinutes() + adjustment);
    
    return {
      hours: date.getHours(),
      minutes: date.getMinutes()
    };
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
}

module.exports = new ReminderService();

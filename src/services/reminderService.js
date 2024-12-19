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
        // Agrupa e formata sugestões
        const groupedSuggestions = suggestions.reduce((acc, sugg) => {
          if (!acc[sugg.type]) acc[sugg.type] = [];
          acc[sugg.type].push(sugg.message);
          return acc;
        }, {});

        // Personaliza mensagem por período do dia
        const now = new Date();
        const currentHour = now.getHours();
        const period = currentHour < 12 ? 'manhã' : currentHour < 18 ? 'tarde' : 'noite';
        
        const greetings = {
          'manhã': '🌅 Bom dia! Vamos organizar seu dia?',
          'tarde': '☀️ Boa tarde! Vamos otimizar sua rotina?',
          'noite': '🌙 Boa noite! Vamos ajustar seu planejamento?'
        };

        let message = `${greetings[period]}\n\n`;
        message += '*Analisei seu plano e tenho algumas sugestões:* 💡\n\n';

        // Organiza sugestões por prioridade
        const sections = [
          {
            title: '⚡ Principais Ajustes:',
            types: ['overlap', 'short_break'],
            emoji: '•'
          },
          {
            title: '🎯 Otimização de Tempo:',
            types: ['duration', 'period_balance'],
            emoji: '•'
          },
          {
            title: '🧘‍♂️ Bem-estar:',
            types: ['break', 'work_balance'],
            emoji: '•'
          }
        ];

        sections.forEach(section => {
          const sectionSuggestions = section.types
            .flatMap(type => groupedSuggestions[type] || []);
          
          if (sectionSuggestions.length > 0) {
            message += `${section.title}\n`;
            sectionSuggestions.forEach(sugg => {
              message += `${section.emoji} ${sugg}\n`;
            });
            message += '\n';
          }
        });

        // Adiciona dicas personalizadas
        const tips = {
          'manhã': [
            '💡 Dica: Comece com as tarefas mais importantes!',
            '💪 Sua energia está no pico pela manhã'
          ],
          'tarde': [
            '💡 Dica: Alterne entre tarefas leves e pesadas',
            '🎯 Mantenha o foco com pausas estratégicas'
          ],
          'noite': [
            '💡 Dica: Priorize atividades mais leves',
            '🌙 Prepare-se para um bom descanso'
          ]
        };

        message += `\n${tips[period][0]}\n${tips[period][1]}\n\n`;
        message += '_Estas sugestões visam seu bem-estar e produtividade._ ✨\n';
        message += '_Adapte conforme sua necessidade!_ 💪';

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

    // Agrupa atividades por dia e período
    const dailyActivities = activities.reduce((acc, activity) => {
      const days = activity.schedule?.days || ['*'];
      const [hours] = activity.scheduledTime.split(':').map(Number);
      const period = hours < 12 ? 'manhã' : hours < 18 ? 'tarde' : 'noite';
      
      days.forEach(day => {
        if (!acc[day]) acc[day] = { manhã: [], tarde: [], noite: [] };
        acc[day][period].push(activity);
      });
      return acc;
    }, {});

    Object.entries(dailyActivities).forEach(([day, periods]) => {
      let dayWorkMinutes = 0;
      let morningActivities = periods.manhã.length;
      let eveningActivities = periods.noite.length;

      // Analisa distribuição do dia
      if (morningActivities === 0) {
        suggestions.push({
          type: 'period_balance',
          message: 'Começar o dia cedo pode aumentar sua produtividade! 🌅'
        });
      }

      if (eveningActivities > 3) {
        suggestions.push({
          type: 'period_balance',
          message: 'Muitas atividades à noite podem afetar seu descanso 🌙'
        });
      }

      // Analisa cada período
      Object.entries(periods).forEach(([period, periodActivities]) => {
        periodActivities.sort((a, b) => {
          const [aHours, aMinutes] = a.scheduledTime.split(':').map(Number);
          const [bHours, bMinutes] = b.scheduledTime.split(':').map(Number);
          return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
        });

        periodActivities.forEach((activity, index) => {
          // Verifica sobreposições
          if (index > 0) {
            const prevActivity = periodActivities[index - 1];
            const gap = this.getMinutesBetween(
              this.addMinutes(prevActivity.scheduledTime, prevActivity.duration),
              activity.scheduledTime
            );
            
            if (gap < 0) {
              suggestions.push({
                type: 'overlap',
                message: `Atividades "${prevActivity.activity}" e "${activity.activity}" estão sobrepostas`
              });
            } else if (gap < 5) {
              suggestions.push({
                type: 'short_break',
                message: `Considere um pequeno intervalo entre "${prevActivity.activity}" e "${activity.activity}"`
              });
            }
          }

          // Analisa duração e pausas
          const isBreak = this.isBreakActivity(activity);
          if (!isBreak) {
            dayWorkMinutes += activity.duration;
            continuousWorkMinutes += activity.duration;

            // Sugestões específicas por período
            if (period === 'manhã' && activity.duration > 90) {
              suggestions.push({
                type: 'duration',
                message: 'Atividades mais curtas pela manhã ajudam a manter o foco ⚡'
              });
            }

            if (period === 'tarde' && continuousWorkMinutes > 120) {
              suggestions.push({
                type: 'break',
                message: 'Uma pausa à tarde ajuda a manter a energia! ☀️'
              });
            }
          } else {
            continuousWorkMinutes = 0;
            lastBreakTime = activity.scheduledTime;
          }
        });

        // Verifica pausas por período
        if (!periodActivities.some(a => this.isBreakActivity(a)) && periodActivities.length > 2) {
          const messages = {
            'manhã': 'Uma pausa pela manhã ajuda a manter o ritmo! 🌅',
            'tarde': 'Intervalos à tarde mantêm sua produtividade! ☀️',
            'noite': 'Momentos de descanso à noite são importantes! 🌙'
          };
          suggestions.push({
            type: 'break',
            message: messages[period]
          });
        }
      });

      // Analisa carga total
      if (dayWorkMinutes > 480) {
        suggestions.push({
          type: 'work_balance',
          message: 'Que tal distribuir melhor as atividades para evitar sobrecarga? 💪'
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

      const messages = this.getActivityMessages(activity, timing);

      await evolutionApi.sendText(user.whatsappNumber, messages[timing]);
      this.lastSentReminders.set(lastSentKey, now);

    } catch (error) {
      console.error('Erro ao enviar lembrete:', error);
      throw error;
    }
  }

  getActivityMessages(activity, timing) {
    const [hours] = activity.scheduledTime.split(':').map(Number);
    const period = hours < 12 ? 'manhã' : hours < 18 ? 'tarde' : 'noite';
    
    const periodEmojis = {
      'manhã': '🌅',
      'tarde': '☀️',
      'noite': '🌙'
    };

    const motivationalMessages = {
      'manhã': [
        'Comece o dia com energia! ⚡',
        'Um ótimo dia pela frente! 🌟',
        'Hora de começar com tudo! 💪'
      ],
      'tarde': [
        'Mantenha o foco! 🎯',
        'Continue com energia! ⚡',
        'Você está indo bem! 💫'
      ],
      'noite': [
        'Última etapa do dia! 🌙',
        'Finalizando com sucesso! ✨',
        'Quase lá! 💫'
      ]
    };

    const randomMotivation = () => {
      const messages = motivationalMessages[period];
      return messages[Math.floor(Math.random() * messages.length)];
    };

    if (this.isBreakActivity(activity)) {
      return {
        before: `${periodEmojis[period]} Em 5 minutos é hora da sua pausa! Prepare-se para recarregar as energias`,
        start: `🧘‍♂️ Momento de descansar! Aproveite para se alongar e respirar`,
        followUp: `✨ Pausa concluída! ${randomMotivation()}`
      };
    }

    return {
      before: `${periodEmojis[period]} Em 5 minutos: ${activity.activity}\n${randomMotivation()}`,
      start: `🎯 Hora de iniciar: ${activity.activity}\nFoco total nessa atividade! 💪`,
      followUp: `✅ Hora de finalizar: ${activity.activity}\nÓtimo trabalho! 🌟`
    };
  }

  async askActivityCompletion(user, activity) {
    try {
      if (!this.isBreakActivity(activity)) {
        const [hours] = activity.scheduledTime.split(':').map(Number);
        const period = hours < 12 ? 'manhã' : hours < 18 ? 'tarde' : 'noite';
        
        const feedbackMessages = {
          'manhã': 'Como começou sua manhã?',
          'tarde': 'Como está indo seu dia?',
          'noite': 'Como foi essa atividade?'
        };

        await evolutionApi.sendList(
          user.whatsappNumber,
          feedbackMessages[period],
          `"${activity.activity}"\n\n` +
          `_Seu feedback ajuda a personalizar suas sugestões!_ ✨\n` +
          `_Juntos podemos melhorar sua produtividade!_ 💪`,
          'Responder',
          [{
            title: 'Status',
            rows: [
              {
                title: '✅ Completei com sucesso!',
                description: 'Tudo conforme planejado',
                rowId: `completed_${activity._id}`
              },
              {
                title: '👍 Completei parcialmente',
                description: 'Fiz o que foi possível',
                rowId: `partial_${activity._id}`
              },
              {
                title: '⚙️ Preciso ajustar',
                description: 'Modificar horário/duração',
                rowId: `adjust_${activity._id}`
              },
              {
                title: '💡 Tenho uma sugestão',
                description: 'Melhorar a atividade',
                rowId: `suggest_${activity._id}`
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

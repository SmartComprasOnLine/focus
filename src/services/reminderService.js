const evolutionApi = require('./evolutionApi');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.activeReminders = new Map(); // userId -> [cronJobs]
  }

  async setupReminders(user, routine) {
    // Cancelar lembretes existentes para este usuário
    this.cancelUserReminders(user.id);

    const reminders = [];
    
    // Configurar lembretes para cada atividade do plano
    routine.activities.forEach(activity => {
      const scheduledTime = new Date(activity.scheduledTime);
      const hours = scheduledTime.getHours();
      const minutes = scheduledTime.getMinutes();
      
      // Lembrete 5 minutos antes
      const beforeMinutes = minutes - 5 < 0 ? 55 : minutes - 5;
      const beforeHours = minutes - 5 < 0 ? hours - 1 : hours;
      const beforeExpression = `${beforeMinutes} ${beforeHours} * * *`;
      
      // Lembrete no horário
      const startExpression = `${minutes} ${hours} * * *`;
      
      // Lembrete durante (15 minutos depois)
      const duringMinutes = (minutes + 15) % 60;
      const duringHours = minutes + 15 >= 60 ? (hours + 1) % 24 : hours;
      const duringExpression = `${duringMinutes} ${duringHours} * * *`;
      
      // Lembrete após (30 minutos depois)
      const afterMinutes = (minutes + 30) % 60;
      const afterHours = minutes + 30 >= 60 ? (hours + 1) % 24 : hours;
      const afterExpression = `${afterMinutes} ${afterHours} * * *`;
      
      // Criar os jobs cron
      const beforeJob = cron.schedule(beforeExpression, async () => {
        await this.sendActivityReminder(user, activity, 'before');
      });
      
      const startJob = cron.schedule(startExpression, async () => {
        await this.sendActivityReminder(user, activity, 'start');
      });
      
      const duringJob = cron.schedule(duringExpression, async () => {
        await this.sendActivityReminder(user, activity, 'during');
      });
      
      const afterJob = cron.schedule(afterExpression, async () => {
        await this.sendActivityReminder(user, activity, 'after');
      });
      
      reminders.push(
        { activityId: activity._id, timing: 'before', job: beforeJob },
        { activityId: activity._id, timing: 'start', job: startJob },
        { activityId: activity._id, timing: 'during', job: duringJob },
        { activityId: activity._id, timing: 'after', job: afterJob }
      );
    });
    
    // Armazenar os lembretes ativos
    this.activeReminders.set(user.id, reminders);
    
    console.log(`Configurados ${reminders.length} lembretes para o usuário ${user.name}`);
  }

  async sendActivityReminder(user, activity, timing = 'start') {
    // Verifica se a atividade tem mensagens personalizadas
    if (activity.messages && activity.messages[timing]) {
      await evolutionApi.sendText(user.whatsappNumber, activity.messages[timing]);
      return;
    }

    // Mensagens padrão baseadas no tipo de atividade
    const defaultMessages = {
      'planejamento': {
        before: '📋 Em 5 minutos: Momento de planejar seu dia!',
        start: '📋 Hora de planejar! Vamos organizar suas tarefas.',
        during: '📋 Continue organizando suas prioridades.',
        after: '📋 Como foi o planejamento? Tudo organizado?'
      },
      'trabalho': {
        before: '💼 Em 5 minutos: Prepare-se para iniciar o trabalho!',
        start: '💼 Hora de trabalhar! Lembre-se da técnica Pomodoro.',
        during: '💼 Mantenha o foco! Você está indo bem.',
        after: '💼 Como foi a sessão de trabalho?'
      },
      'estudo': {
        before: '📚 Em 5 minutos: Prepare seu ambiente de estudo!',
        start: '📚 Hora de estudar! Use a técnica Pomodoro.',
        during: '📚 Continue focado nos estudos!',
        after: '📚 Como foi a sessão de estudo?'
      },
      'pausa': {
        before: '⏰ Em 5 minutos: Prepare-se para sua pausa!',
        start: '☕ Hora da pausa! Aproveite para se alongar.',
        during: '🧘‍♂️ Aproveite este momento para relaxar.',
        after: '💪 Pronto para voltar às atividades?'
      },
      'revisão': {
        before: '📊 Em 5 minutos: Prepare-se para revisar seu progresso!',
        start: '📊 Hora de revisar! Vamos ver o que foi realizado.',
        during: '📊 Continue avaliando seu progresso.',
        after: '📊 Como foi a revisão? Alcançou seus objetivos?'
      }
    };

    const message = defaultMessages[activity.type]?.[timing] || 
                   `⏰ ${timing === 'before' ? 'Em 5 minutos: ' : ''}${activity.activity}`;
    
    await evolutionApi.sendText(user.whatsappNumber, message);
  }

  cancelUserReminders(userId) {
    const userReminders = this.activeReminders.get(userId);
    if (userReminders) {
      userReminders.forEach(reminder => {
        reminder.job.stop();
      });
      this.activeReminders.delete(userId);
    }
  }

  // Configurar lembretes padrão baseados no plano
  async setupDefaultReminders(user) {
    const defaultReminders = [
      { time: '07:00', activity: 'Início do dia - Planejamento e organização' },
      { time: '09:00', activity: 'Início do trabalho - Primeira sessão Pomodoro' },
      { time: '10:30', activity: 'Pausa da manhã - Momento para alongamento' },
      { time: '12:00', activity: 'Pausa para almoço - Desconecte-se do trabalho' },
      { time: '15:00', activity: 'Pausa da tarde - Exercício de respiração' },
      { time: '18:00', activity: 'Revisão do trabalho - Organize tarefas pendentes' },
      { time: '20:00', activity: 'Início dos estudos - Prepare seu ambiente' },
      { time: '22:00', activity: 'Revisão do dia - Planeje o dia seguinte' }
    ];

    const activities = defaultReminders.map(reminder => ({
      activity: reminder.activity,
      scheduledTime: this.getScheduledTime(reminder.time),
      type: this.getActivityType(reminder.activity),
      status: 'active',
      messages: {
        before: `⏰ Em 5 minutos: ${reminder.activity}. Prepare-se!`,
        start: `🎯 Hora de ${reminder.activity}. Vamos lá!`,
        during: `💪 Continue focado em ${reminder.activity}. Você está indo bem!`,
        after: `✅ Como foi ${reminder.activity}? Me conte seu progresso!`
      }
    }));

    return activities;
  }

  getScheduledTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    // Ajusta para o fuso horário local (GMT-3)
    date.setHours(hours - 3, minutes, 0, 0);
    return date;
  }

  getActivityType(activity) {
    const types = {
      'planejamento': ['planejamento', 'planejar', 'organizar'],
      'trabalho': ['trabalho', 'trabalhar'],
      'estudo': ['estudo', 'estudar'],
      'pausa': ['pausa', 'descanso', 'intervalo', 'almoço'],
      'revisão': ['revisão', 'revisar', 'avaliar']
    };

    const activityLower = activity.toLowerCase();
    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(keyword => activityLower.includes(keyword))) {
        return type;
      }
    }
    return 'geral';
  }
}

module.exports = new ReminderService();

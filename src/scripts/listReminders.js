const reminderService = require('../services/reminderService');
const User = require('../models/User');
require('dotenv').config();

async function listReminders() {
    try {
        const activeReminders = reminderService.activeReminders;
        console.log('\nLembretes Ativos:');
        
        for (const [userId, reminders] of activeReminders.entries()) {
            const user = await User.findById(userId);
            console.log(`\nUsuário: ${user ? user.name : userId}`);
            console.log(`Total de lembretes: ${reminders.length}`);
            
            reminders.forEach((reminder, index) => {
                console.log(`\nLembrete ${index + 1}:`);
                console.log(`- ID da Atividade: ${reminder.activityId}`);
                console.log(`- Tipo: ${reminder.timing || 'start'}`);
                console.log(`- Status do Job: ${reminder.job.running ? 'Ativo' : 'Inativo'}`);
            });
        }

        // Se não houver lembretes ativos
        if (activeReminders.size === 0) {
            console.log('Nenhum lembrete ativo encontrado.');
        }

    } catch (error) {
        console.error('Erro ao listar lembretes:', error);
    }
}

listReminders();

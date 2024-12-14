const mongoose = require('mongoose');
const User = require('./src/models/User'); // Ajuste o caminho conforme necessário
const Routine = require('./src/models/Routine'); // Ajuste o caminho conforme necessário
require('dotenv').config(); // Carregar variáveis de ambiente do .env

async function clearDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { // Use a variável de ambiente
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        await User.deleteMany({});
        console.log('Todos os usuários foram removidos.');

        await Routine.deleteMany({});
        console.log('Todas as rotinas foram removidas.');

        await mongoose.disconnect();
        console.log('Conexão com o banco de dados encerrada.');
    } catch (error) {
        console.error('Erro ao limpar o banco de dados:', error);
    }
}

clearDatabase();
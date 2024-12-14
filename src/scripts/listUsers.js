const mongoose = require('mongoose');
const User = require('../models/User'); // Ajuste o caminho conforme necessário
require('dotenv').config(); // Carregar variáveis de ambiente do .env

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const users = await User.find({});
        console.log('Usuários no banco de dados:', users);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
    }
}

listUsers();

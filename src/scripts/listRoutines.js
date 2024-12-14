const mongoose = require('mongoose');
const Routine = require('../models/Routine');
require('dotenv').config();

async function listRoutines() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const routines = await Routine.find({}).lean();
        console.log('Rotinas no banco de dados:', JSON.stringify(routines, null, 2));

        await mongoose.disconnect();
    } catch (error) {
        console.error('Erro ao listar rotinas:', error);
    }
}

listRoutines();

const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  routineName: {
    type: String,
    required: true
  },
  activities: [{
    activity: {
      type: String,
      required: true
    },
    scheduledTime: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['planejamento', 'trabalho', 'estudo', 'pausa', 'revisão', 'geral'],
      default: 'geral'
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    },
    messages: {
      before: String,
      start: String,
      during: String,
      after: String
    },
    completedAt: {
      type: Date
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
routineSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Routine', routineSchema);

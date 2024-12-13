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
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Routine', routineSchema);

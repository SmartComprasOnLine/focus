const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  whatsappNumber: {
    type: String,
    required: true,
    unique: true
  },
  subscription: {
    status: {
      type: String,
      enum: ['em_teste', 'ativa', 'inativa'],
      default: 'em_teste'
    },
    trialStartDate: Date,
    trialEndDate: Date,
    plan: String,
    startDate: Date,
    endDate: Date,
    paymentId: String,
    pendingPayment: {
      sessionId: String,
      planType: String,
      createdAt: Date
    }
  },
  currentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine'
  },
  interactionHistory: [{
    type: { type: String },
    content: { type: String },
    role: { type: String },
    timestamp: {
      type: Date,
      default: Date.now
    },
    _id: false
  }]
}, {
  timestamps: true
});

userSchema.methods.hasAccess = function() {
  if (this.subscription.status === 'ativa') {
    return true;
  }
  
  if (this.subscription.status === 'em_teste') {
    const now = new Date();
    return now <= this.subscription.trialEndDate;
  }
  
  return false;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
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
    trialStartDate: {
      type: Date,
      default: Date.now
    },
    trialEndDate: {
      type: Date,
      default: function() {
        const date = new Date(this.trialStartDate);
        date.setDate(date.getDate() + 7);
        return date;
      }
    },
    plan: {
      type: String,
      enum: ['none', 'monthly', 'yearly'],
      default: 'none'
    },
    startDate: Date,
    endDate: Date,
    stripeCustomerId: String
  },
  plan: {
    activities: [{
      name: String,
      description: String,
      schedule: String,
      completed: {
        type: Boolean,
        default: false
      }
    }],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  notifications: [{
    message: String,
    scheduledFor: Date,
    sent: {
      type: Boolean,
      default: false
    }
  }],
  interactionHistory: [{
    type: {
      type: String,
      enum: ['text', 'audio', 'image']
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Method to check if trial is active
userSchema.methods.isTrialActive = function() {
  return this.subscription.status === 'em_teste' && 
         new Date() <= this.subscription.trialEndDate;
};

// Method to check if subscription is active
userSchema.methods.isSubscriptionActive = function() {
  return this.subscription.status === 'ativa' && 
         (!this.subscription.endDate || new Date() <= this.subscription.endDate);
};

// Method to check if user has access to services
userSchema.methods.hasAccess = function() {
  return this.isTrialActive() || this.isSubscriptionActive();
};

const User = mongoose.model('User', userSchema);

module.exports = User;

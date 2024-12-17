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
      type: String,  // Changed from Date to String to store "HH:mm" format
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format! Use HH:mm`
      }
    },
    type: {
      type: String,
      enum: ['planejamento', 'trabalho', 'estudo', 'pausa', 'revisão', 'geral', 'routine'],
      default: 'geral'
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'skipped'],
      default: 'active'
    },
    duration: {
      type: Number,
      min: 5,
      max: 240,
      required: true
    },
    messages: {
      before: String,
      start: String,
      during: [String],  // Changed to array of strings
      end: String,
      followUp: String
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

// Convert time string to Date object for comparison
routineSchema.methods.getActivityTime = function(activity) {
  const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Sort activities by time
routineSchema.methods.getSortedActivities = function() {
  return this.activities.sort((a, b) => {
    const timeA = this.getActivityTime(a);
    const timeB = this.getActivityTime(b);
    return timeA - timeB;
  });
};

// Get next activity
routineSchema.methods.getNextActivity = function() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  return this.activities.find(activity => {
    const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
    return (hours > currentHour) || (hours === currentHour && minutes > currentMinute);
  });
};

// Get current activity
routineSchema.methods.getCurrentActivity = function() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  return this.activities.find(activity => {
    const [hours, minutes] = activity.scheduledTime.split(':').map(Number);
    const endTime = new Date(now);
    endTime.setHours(hours, minutes + activity.duration, 0, 0);
    
    const activityTime = new Date(now);
    activityTime.setHours(hours, minutes, 0, 0);
    
    return now >= activityTime && now <= endTime;
  });
};

module.exports = mongoose.model('Routine', routineSchema);

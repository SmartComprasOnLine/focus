const mongoose = require('mongoose');

const messageHistorySchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const reminderPreferenceSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['before', 'start', 'during', 'end', 'followUp'],
        required: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    timing: {
        type: Number, // minutes before/after
        required: true
    },
    style: {
        type: String,
        enum: ['motivational', 'direct', 'friendly', 'professional'],
        default: 'friendly'
    }
});

const productivityPeriodSchema = new mongoose.Schema({
    startTime: String,
    endTime: String,
    energyLevel: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: true
    },
    focusLevel: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: true
    }
});

const challengeSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['focus', 'noise', 'procrastination', 'energy', 'organization', 'other'],
        required: true
    },
    description: String,
    severity: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: true
    }
});

const strategySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['music', 'timer', 'lists', 'environment', 'breaks', 'other'],
        required: true
    },
    description: String,
    effectiveness: {
        type: String,
        enum: ['high', 'medium', 'low'],
        required: true
    }
});

const medicationSchema = new mongoose.Schema({
    name: String,
    dosage: String,
    timing: String,
    duration: Number, // effect duration in hours
    notes: String
});

const preferencesSchema = new mongoose.Schema({
    reminders: [reminderPreferenceSchema],
    productivityPeriods: [productivityPeriodSchema],
    challenges: [challengeSchema],
    strategies: [strategySchema],
    medication: medicationSchema,
    sleepSchedule: {
        bedtime: String,
        wakeTime: String,
        quality: {
            type: String,
            enum: ['good', 'fair', 'poor'],
            required: true
        }
    },
    workSchedule: {
        startTime: String,
        endTime: String,
        breakPreferences: [{
            time: String,
            duration: Number // minutes
        }]
    },
    environment: {
        noisePreference: {
            type: String,
            enum: ['silent', 'ambient', 'music', 'any'],
            default: 'silent'
        },
        lightingPreference: {
            type: String,
            enum: ['bright', 'moderate', 'dim'],
            default: 'bright'
        },
        temperaturePreference: {
            type: String,
            enum: ['cool', 'moderate', 'warm'],
            default: 'moderate'
        }
    }
});

const planHistorySchema = new mongoose.Schema({
    routineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Routine',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: Date,
    status: {
        type: String,
        enum: ['active', 'completed', 'abandoned'],
        required: true
    },
    metrics: {
        completionRate: Number,
        focusTime: Number, // minutes
        breakTime: Number, // minutes
        productivity: {
            type: Number,
            min: 0,
            max: 100
        }
    },
    feedback: {
        challenges: [String],
        improvements: [String],
        notes: String
    }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true
    },
    whatsappNumber: {
        type: String,
        required: true,
        unique: true
    },
    timezone: {
        type: String,
        required: true,
        default: 'UTC'
    },
    activeRoutineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Routine'
    },
    subscription: {
        status: {
            type: String,
            enum: ['em_teste', 'ativo', 'inativo', 'pendente'],
            default: 'em_teste'
        },
        plan: {
            type: String,
            enum: ['mensal', 'anual', 'none', null],
            default: 'none'
        },
        trialStartDate: {
            type: Date,
            default: Date.now
        },
        trialEndDate: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        startDate: Date,
        endDate: Date,
        stripeCustomerId: String,
        stripeSubscriptionId: String,
        pendingPayment: {
            sessionId: String,
            planType: String,
            createdAt: Date
        }
    },
    preferences: preferencesSchema,
    planHistory: [planHistorySchema],
    messageHistory: [messageHistorySchema],
    lastActive: {
        type: Date,
        default: Date.now
    },
    welcomeSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Methods
userSchema.methods.updateMetrics = async function(metrics) {
    if (this.activeRoutineId) {
        const currentPlan = this.planHistory.find(
            plan => plan.routineId.equals(this.activeRoutineId) && plan.status === 'active'
        );
        
        if (currentPlan) {
            Object.assign(currentPlan.metrics, metrics);
            await this.save();
        }
    }
};

userSchema.methods.completePlan = async function(feedback) {
    if (this.activeRoutineId) {
        const currentPlan = this.planHistory.find(
            plan => plan.routineId.equals(this.activeRoutineId) && plan.status === 'active'
        );
        
        if (currentPlan) {
            currentPlan.status = 'completed';
            currentPlan.endDate = new Date();
            currentPlan.feedback = feedback;
            this.activeRoutineId = null;
            await this.save();
        }
    }
};

userSchema.methods.abandonPlan = async function(reason) {
    if (this.activeRoutineId) {
        const currentPlan = this.planHistory.find(
            plan => plan.routineId.equals(this.activeRoutineId) && plan.status === 'active'
        );
        
        if (currentPlan) {
            currentPlan.status = 'abandoned';
            currentPlan.endDate = new Date();
            currentPlan.feedback = {
                challenges: [reason],
                improvements: [],
                notes: 'Plan abandoned by user'
            };
            this.activeRoutineId = null;
            await this.save();
        }
    }
};

userSchema.methods.updatePreferences = async function(newPreferences) {
    Object.assign(this.preferences, newPreferences);
    await this.save();
};

userSchema.methods.addToMessageHistory = async function(role, content) {
    // Keep only the last 10 messages
    if (this.messageHistory.length >= 10) {
        this.messageHistory.shift(); // Remove oldest message
    }
    this.messageHistory.push({ role, content });
    await this.save();
};

userSchema.methods.getMessageHistory = function() {
    return this.messageHistory.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
};

module.exports = mongoose.model('User', userSchema);

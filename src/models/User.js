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

const achievementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['streak', 'milestone', 'challenge', 'improvement'],
        required: true
    },
    name: String,
    description: String,
    earnedAt: {
        type: Date,
        default: Date.now
    },
    value: Number, // points or streak count
    icon: String
});

const analyticsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    metrics: {
        focusScore: {
            type: Number,
            min: 0,
            max: 100
        },
        productivityScore: {
            type: Number,
            min: 0,
            max: 100
        },
        energyLevel: {
            type: Number,
            min: 0,
            max: 100
        },
        tasksCompleted: Number,
        totalFocusTime: Number, // minutes
        totalBreakTime: Number, // minutes
        distractions: Number,
        streakDays: Number
    },
    patterns: {
        mostProductiveTime: String,
        commonChallenges: [String],
        successfulStrategies: [String],
        improvementAreas: [String]
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
        },
        energyLevels: [{
            time: String,
            level: Number // 0-100
        }],
        distractions: [{
            time: String,
            type: String,
            duration: Number // minutes
        }],
        improvements: [{
            metric: String,
            value: Number,
            date: Date
        }]
    },
    feedback: {
        challenges: [String],
        improvements: [String],
        notes: String,
        mood: {
            type: String,
            enum: ['excellent', 'good', 'neutral', 'tired', 'stressed']
        },
        energyRating: {
            type: Number,
            min: 1,
            max: 5
        }
    }
});

const gamificationSchema = new mongoose.Schema({
    level: {
        type: Number,
        default: 1
    },
    experience: {
        type: Number,
        default: 0
    },
    streaks: {
        current: {
            type: Number,
            default: 0
        },
        longest: {
            type: Number,
            default: 0
        },
        lastUpdated: Date
    },
    achievements: [achievementSchema],
    points: {
        total: {
            type: Number,
            default: 0
        },
        history: [{
            date: Date,
            amount: Number,
            reason: String
        }]
    },
    challenges: [{
        name: String,
        description: String,
        progress: Number,
        target: Number,
        completedAt: Date,
        reward: Number // points
    }]
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    analytics: [analyticsSchema],
    gamification: gamificationSchema,
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
        default: 'America/Sao_Paulo'
    },
    activeRoutineId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Routine'
    },
    currentPlan: {
        type: {
            activities: [{
                activity: {
                    type: String,
                    required: true
                },
                scheduledTime: {
                    type: String,
                    required: true,
                    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
                },
                duration: {
                    type: Number,
                    required: true,
                    min: 5,
                    max: 480
                },
                type: {
                    type: String,
                    default: 'routine'
                },
                status: {
                    type: String,
                    enum: ['pending', 'active', 'completed', 'skipped'],
                    default: 'pending'
                },
                schedule: {
                    days: {
                        type: [String],
                        default: ['*'],
                        validate: {
                            validator: function(v) {
                                return v.every(day => 
                                    day === '*' || 
                                    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(day.toLowerCase())
                                );
                            },
                            message: 'Invalid day format'
                        }
                    },
                    repeat: {
                        type: String,
                        enum: ['daily', 'weekdays', 'weekends', 'custom'],
                        default: 'daily'
                    }
                }
            }],
            lastUpdate: {
                type: Date,
                default: Date.now
            }
        },
        required: false,
        _id: false
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
// Analytics Methods
userSchema.methods.updateMetrics = async function(metrics) {
    if (this.activeRoutineId) {
        const currentPlan = this.planHistory.find(
            plan => plan.routineId.equals(this.activeRoutineId) && plan.status === 'active'
        );
        
        if (currentPlan) {
            Object.assign(currentPlan.metrics, metrics);

            // Update daily analytics
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let dailyAnalytics = this.analytics.find(a => 
                a.date.getTime() === today.getTime()
            );

            if (!dailyAnalytics) {
                dailyAnalytics = {
                    date: today,
                    metrics: {
                        focusScore: 0,
                        productivityScore: 0,
                        energyLevel: 0,
                        tasksCompleted: 0,
                        totalFocusTime: 0,
                        totalBreakTime: 0,
                        distractions: 0,
                        streakDays: this.gamification?.streaks?.current || 0
                    },
                    patterns: {
                        mostProductiveTime: '',
                        commonChallenges: [],
                        successfulStrategies: [],
                        improvementAreas: []
                    }
                };
                this.analytics.push(dailyAnalytics);
            }

            // Update analytics metrics
            Object.assign(dailyAnalytics.metrics, {
                focusScore: Math.round((metrics.focusTime / (metrics.focusTime + metrics.breakTime)) * 100),
                productivityScore: metrics.productivity,
                totalFocusTime: (dailyAnalytics.metrics.totalFocusTime || 0) + metrics.focusTime,
                totalBreakTime: (dailyAnalytics.metrics.totalBreakTime || 0) + metrics.breakTime,
                tasksCompleted: (dailyAnalytics.metrics.tasksCompleted || 0) + 1
            });

            await this.save();
            await this.updateGamification(metrics);
        }
    }
};

// Gamification Methods
userSchema.methods.updateGamification = async function(metrics) {
    if (!this.gamification) {
        this.gamification = {
            level: 1,
            experience: 0,
            streaks: { current: 0, longest: 0 },
            points: { total: 0, history: [] },
            achievements: [],
            challenges: []
        };
    }

    // Update streaks
    const today = new Date();
    if (this.gamification.streaks.lastUpdated) {
        const lastUpdate = new Date(this.gamification.streaks.lastUpdated);
        const daysDiff = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
            this.gamification.streaks.current++;
            this.gamification.streaks.longest = Math.max(
                this.gamification.streaks.longest,
                this.gamification.streaks.current
            );
        } else if (daysDiff > 1) {
            this.gamification.streaks.current = 1;
        }
    }
    this.gamification.streaks.lastUpdated = today;

    // Award points based on metrics
    const points = Math.round(
        (metrics.productivity || 0) +
        (metrics.focusTime / 30) + // Points per 30 min of focus
        (this.gamification.streaks.current * 10) // Streak bonus
    );

    this.gamification.points.total += points;
    this.gamification.points.history.push({
        date: today,
        amount: points,
        reason: 'Daily activity completion'
    });

    // Update experience and level
    this.gamification.experience += points;
    const newLevel = Math.floor(Math.sqrt(this.gamification.experience / 100)) + 1;
    if (newLevel > this.gamification.level) {
        this.gamification.level = newLevel;
        await this.awardAchievement('milestone', `Reached Level ${newLevel}!`, newLevel);
    }

    // Check for achievements
    if (this.gamification.streaks.current === 7) {
        await this.awardAchievement('streak', 'Week Warrior', 7);
    } else if (this.gamification.streaks.current === 30) {
        await this.awardAchievement('streak', 'Monthly Master', 30);
    }

    if (metrics.productivity >= 90) {
        await this.awardAchievement('improvement', 'Productivity Star', 90);
    }

    await this.save();
};

userSchema.methods.awardAchievement = async function(type, name, value) {
    if (!this.gamification.achievements.find(a => a.name === name)) {
        this.gamification.achievements.push({
            type,
            name,
            description: `Earned for achieving ${name}`,
            value,
            earnedAt: new Date(),
            icon: '🏆'
        });

        // Bonus points for achievement
        const bonusPoints = value * 10;
        this.gamification.points.total += bonusPoints;
        this.gamification.points.history.push({
            date: new Date(),
            amount: bonusPoints,
            reason: `Achievement: ${name}`
        });
    }
};

// Existing Methods
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
            
            // Award completion points
            await this.updateGamification({
                productivity: 100,
                focusTime: 480, // 8 hours
                breakTime: 120  // 2 hours
            });
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
                notes: 'Plan abandoned by user',
                mood: 'stressed',
                energyRating: 2
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

// Analytics Helper Methods
userSchema.methods.getProductivityTrends = function() {
    const last7Days = this.analytics.slice(-7);
    return {
        focusScores: last7Days.map(day => day.metrics.focusScore),
        productivityScores: last7Days.map(day => day.metrics.productivityScore),
        mostProductiveTimes: last7Days.map(day => day.patterns.mostProductiveTime),
        commonChallenges: [...new Set(last7Days.flatMap(day => day.patterns.commonChallenges))],
        improvementAreas: [...new Set(last7Days.flatMap(day => day.patterns.improvementAreas))]
    };
};

userSchema.methods.getGamificationStatus = function() {
    return {
        level: this.gamification.level,
        experience: this.gamification.experience,
        nextLevelExp: (this.gamification.level + 1) ** 2 * 100,
        streaks: this.gamification.streaks,
        recentAchievements: this.gamification.achievements.slice(-5),
        points: this.gamification.points.total,
        activeChallenges: this.gamification.challenges.filter(c => !c.completedAt)
    };
};

module.exports = mongoose.model('User', userSchema);

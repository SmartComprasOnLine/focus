const User = require('../models/User');

class GamificationService {
    // Achievement definitions
    static ACHIEVEMENTS = {
        streaks: [
            { name: 'Iniciante Dedicado', days: 3, points: 30, icon: '🌱' },
            { name: 'Week Warrior', days: 7, points: 70, icon: '⚔️' },
            { name: 'Consistency Champion', days: 14, points: 140, icon: '🏆' },
            { name: 'Monthly Master', days: 30, points: 300, icon: '👑' }
        ],
        productivity: [
            { name: 'Focus Finder', score: 70, points: 50, icon: '🎯' },
            { name: 'Productivity Pro', score: 85, points: 85, icon: '⭐' },
            { name: 'Efficiency Expert', score: 95, points: 150, icon: '💫' }
        ],
        milestones: [
            { name: 'Getting Started', tasks: 1, points: 10, icon: '🎉' },
            { name: 'Task Master', tasks: 10, points: 100, icon: '📊' },
            { name: 'Productivity Guru', tasks: 50, points: 500, icon: '🎓' }
        ]
    };

    // Challenge definitions
    static CHALLENGES = {
        daily: [
            {
                name: 'Early Bird',
                description: 'Complete 3 tasks before noon',
                target: 3,
                points: 30
            },
            {
                name: 'Focus Master',
                description: 'Maintain 90%+ focus score for all tasks today',
                target: 90,
                points: 50
            },
            {
                name: 'Break Balance',
                description: 'Take all scheduled breaks on time',
                target: 100,
                points: 40
            }
        ],
        weekly: [
            {
                name: 'Streak Seeker',
                description: 'Maintain a 5-day streak',
                target: 5,
                points: 100
            },
            {
                name: 'Level Hunter',
                description: 'Gain 2 levels this week',
                target: 2,
                points: 200
            }
        ]
    };

    async checkAndAwardAchievements(userId, metrics) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const awarded = [];

            // Check streak achievements
            const currentStreak = user.gamification?.streaks?.current || 0;
            GamificationService.ACHIEVEMENTS.streaks.forEach(achievement => {
                if (currentStreak >= achievement.days) {
                    awarded.push(this.awardAchievement(user, 'streak', achievement));
                }
            });

            // Check productivity achievements
            const productivityScore = metrics.productivity || 0;
            GamificationService.ACHIEVEMENTS.productivity.forEach(achievement => {
                if (productivityScore >= achievement.score) {
                    awarded.push(this.awardAchievement(user, 'productivity', achievement));
                }
            });

            // Check milestone achievements
            const totalTasks = user.analytics.reduce((sum, day) => 
                sum + (day.metrics.tasksCompleted || 0), 0);
            GamificationService.ACHIEVEMENTS.milestones.forEach(achievement => {
                if (totalTasks >= achievement.tasks) {
                    awarded.push(this.awardAchievement(user, 'milestone', achievement));
                }
            });

            // Award achievements that haven't been awarded yet
            const newAchievements = await Promise.all(awarded);
            return newAchievements.filter(Boolean);
        } catch (error) {
            console.error('Error checking achievements:', error);
            throw error;
        }
    }

    async awardAchievement(user, type, achievement) {
        // Check if already awarded
        if (user.gamification.achievements.find(a => a.name === achievement.name)) {
            return null;
        }

        // Award new achievement
        const newAchievement = {
            type,
            name: achievement.name,
            description: achievement.description || `Earned for ${achievement.name}`,
            value: achievement.points,
            icon: achievement.icon,
            earnedAt: new Date()
        };

        user.gamification.achievements.push(newAchievement);
        user.gamification.points.total += achievement.points;
        user.gamification.points.history.push({
            date: new Date(),
            amount: achievement.points,
            reason: `Achievement: ${achievement.name}`
        });

        await user.save();
        return newAchievement;
    }

    async updateChallenges(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Remove expired challenges
            user.gamification.challenges = user.gamification.challenges.filter(challenge => 
                !challenge.completedAt && new Date(challenge.createdAt) >= today
            );

            // Add new daily challenges if needed
            if (user.gamification.challenges.length < 3) {
                const availableChallenges = [...GamificationService.CHALLENGES.daily];
                while (user.gamification.challenges.length < 3 && availableChallenges.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableChallenges.length);
                    const challenge = availableChallenges.splice(randomIndex, 1)[0];
                    
                    if (!user.gamification.challenges.find(c => c.name === challenge.name)) {
                        user.gamification.challenges.push({
                            ...challenge,
                            progress: 0,
                            createdAt: new Date()
                        });
                    }
                }
            }

            // Add weekly challenge if none active
            const hasWeeklyChallenge = user.gamification.challenges.some(c => 
                c.name === GamificationService.CHALLENGES.weekly[0].name
            );
            
            if (!hasWeeklyChallenge) {
                const weeklyChallenge = GamificationService.CHALLENGES.weekly[0];
                user.gamification.challenges.push({
                    ...weeklyChallenge,
                    progress: 0,
                    createdAt: new Date()
                });
            }

            await user.save();
            return user.gamification.challenges;
        } catch (error) {
            console.error('Error updating challenges:', error);
            throw error;
        }
    }

    async updateChallengeProgress(userId, metrics) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const updatedChallenges = [];

            for (const challenge of user.gamification.challenges) {
                if (challenge.completedAt) continue;

                switch (challenge.name) {
                    case 'Early Bird':
                        if (new Date().getHours() < 12) {
                            challenge.progress++;
                        }
                        break;
                    case 'Focus Master':
                        if (metrics.productivity >= 90) {
                            challenge.progress = metrics.productivity;
                        }
                        break;
                    case 'Break Balance':
                        if (metrics.breaksOnTime) {
                            challenge.progress = 100;
                        }
                        break;
                    case 'Streak Seeker':
                        challenge.progress = user.gamification.streaks.current;
                        break;
                    case 'Level Hunter':
                        challenge.progress = user.gamification.level - challenge.startLevel;
                        break;
                }

                // Check if challenge completed
                if (challenge.progress >= challenge.target) {
                    challenge.completedAt = new Date();
                    user.gamification.points.total += challenge.points;
                    user.gamification.points.history.push({
                        date: new Date(),
                        amount: challenge.points,
                        reason: `Challenge completed: ${challenge.name}`
                    });
                    updatedChallenges.push(challenge);
                }
            }

            await user.save();
            return updatedChallenges;
        } catch (error) {
            console.error('Error updating challenge progress:', error);
            throw error;
        }
    }

    calculateLevelProgress(experience) {
        const level = Math.floor(Math.sqrt(experience / 100)) + 1;
        const currentLevelExp = (level - 1) ** 2 * 100;
        const nextLevelExp = level ** 2 * 100;
        const progress = ((experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;
        
        return {
            level,
            progress: Math.round(progress),
            currentExp: experience,
            nextLevelExp,
            remainingExp: nextLevelExp - experience
        };
    }
}

module.exports = new GamificationService();

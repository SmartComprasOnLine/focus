const User = require('../models/User');

class AnalyticsService {
    async updateUserAnalytics(userId, activityData) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Update metrics
            await user.updateMetrics({
                focusTime: activityData.focusTime || 0,
                breakTime: activityData.breakTime || 0,
                productivity: activityData.productivity || 0,
                distractions: activityData.distractions || []
            });

            // Get updated analytics
            return {
                daily: user.analytics[user.analytics.length - 1],
                trends: user.getProductivityTrends(),
                gamification: user.getGamificationStatus()
            };
        } catch (error) {
            console.error('Error updating analytics:', error);
            throw error;
        }
    }

    async generateInsights(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const trends = user.getProductivityTrends();
            const gamification = user.getGamificationStatus();

            // Generate personalized insights
            const insights = {
                productivity: {
                    trend: this.analyzeTrend(trends.productivityScores),
                    bestTime: this.findMostFrequent(trends.mostProductiveTimes),
                    challenges: trends.commonChallenges.slice(0, 3)
                },
                achievements: {
                    recent: gamification.recentAchievements,
                    streak: gamification.streaks.current,
                    nextLevel: {
                        current: gamification.level,
                        progress: Math.round((gamification.experience / gamification.nextLevelExp) * 100)
                    }
                },
                suggestions: this.generateSuggestions(trends, gamification)
            };

            return insights;
        } catch (error) {
            console.error('Error generating insights:', error);
            throw error;
        }
    }

    analyzeTrend(scores) {
        if (scores.length < 2) return 'insufficient_data';
        
        const changes = scores.slice(1).map((score, i) => score - scores[i]);
        const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
        
        if (averageChange > 5) return 'improving';
        if (averageChange < -5) return 'declining';
        return 'stable';
    }

    findMostFrequent(array) {
        if (!array.length) return null;
        
        const frequency = {};
        let maxFreq = 0;
        let mostFrequent;

        array.forEach(item => {
            frequency[item] = (frequency[item] || 0) + 1;
            if (frequency[item] > maxFreq) {
                maxFreq = frequency[item];
                mostFrequent = item;
            }
        });

        return mostFrequent;
    }

    generateSuggestions(trends, gamification) {
        const suggestions = [];

        // Productivity-based suggestions
        if (trends.productivityScores.some(score => score < 70)) {
            suggestions.push({
                type: 'productivity',
                message: 'Tente usar a técnica Pomodoro: 25 minutos de foco, seguidos de 5 minutos de pausa.',
                action: 'implement_pomodoro'
            });
        }

        // Streak-based suggestions
        if (gamification.streaks.current < 3) {
            suggestions.push({
                type: 'consistency',
                message: 'Mantenha uma sequência de 3 dias para ganhar bônus de pontos!',
                action: 'maintain_streak'
            });
        }

        // Challenge-based suggestions
        if (trends.commonChallenges.includes('distractions')) {
            suggestions.push({
                type: 'focus',
                message: 'Configure um ambiente livre de distrações antes de começar suas atividades.',
                action: 'setup_environment'
            });
        }

        // Level-based suggestions
        const levelProgress = (gamification.experience / gamification.nextLevelExp) * 100;
        if (levelProgress > 80) {
            suggestions.push({
                type: 'achievement',
                message: `Você está próximo do nível ${gamification.level + 1}! Complete mais algumas atividades para avançar.`,
                action: 'reach_next_level'
            });
        }

        return suggestions;
    }

    async getWeeklyReport(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            const trends = user.getProductivityTrends();
            const gamification = user.getGamificationStatus();

            return {
                summary: {
                    averageProductivity: this.calculateAverage(trends.productivityScores),
                    totalFocusTime: user.analytics.reduce((sum, day) => sum + (day.metrics.totalFocusTime || 0), 0),
                    tasksCompleted: user.analytics.reduce((sum, day) => sum + (day.metrics.tasksCompleted || 0), 0),
                    currentStreak: gamification.streaks.current
                },
                achievements: gamification.recentAchievements,
                improvements: trends.improvementAreas,
                nextWeekGoals: this.generateGoals(trends, gamification)
            };
        } catch (error) {
            console.error('Error generating weekly report:', error);
            throw error;
        }
    }

    calculateAverage(numbers) {
        if (!numbers.length) return 0;
        return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
    }

    generateGoals(trends, gamification) {
        const goals = [];
        const avgProductivity = this.calculateAverage(trends.productivityScores);

        // Productivity goal
        goals.push({
            type: 'productivity',
            target: Math.min(Math.round(avgProductivity * 1.1), 100),
            current: avgProductivity,
            description: 'Aumentar produtividade média'
        });

        // Streak goal
        goals.push({
            type: 'streak',
            target: gamification.streaks.current + 3,
            current: gamification.streaks.current,
            description: 'Manter sequência de dias produtivos'
        });

        // Level goal
        goals.push({
            type: 'level',
            target: gamification.level + 1,
            current: gamification.level,
            description: 'Alcançar próximo nível'
        });

        return goals;
    }
}

module.exports = new AnalyticsService();

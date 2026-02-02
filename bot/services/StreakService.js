const { supabase } = require('../config/supabaseClient');
const moment = require('moment-timezone');

/**
 * StreakService - Manages user daily activity streaks
 * Tracks consecutive days of activity and provides bonus calculations
 */
class StreakService {
    constructor() {
        this.timezone = 'America/Mexico_City';
    }

    /**
     * Get or create streak record for user
     */
    async getStreak(userId) {
        try {
            let { data, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;

            // Create if doesn't exist
            if (!data) {
                const { data: newStreak, error: createError } = await supabase
                    .from('user_streaks')
                    .insert([{
                        user_id: userId,
                        current_streak: 0,
                        longest_streak: 0,
                        total_claims: 0
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                return newStreak;
            }

            return data;
        } catch (error) {
            console.error('Error getting streak:', error);
            throw error;
        }
    }

    /**
     * Update streak when user claims daily activity
     * Returns: { streak, bonus, isNewRecord, streakBroken }
     */
    async updateStreak(userId) {
        try {
            const streak = await this.getStreak(userId);
            const now = moment().tz(this.timezone);
            const lastClaim = streak.last_claim_date ? moment(streak.last_claim_date).tz(this.timezone) : null;

            let newStreak = streak.current_streak;
            let streakBroken = false;
            let isNewRecord = false;

            // Check if this is a new day
            if (!lastClaim || !this.isSameDay(now, lastClaim)) {
                // Check if streak should continue or reset
                if (lastClaim && this.isConsecutiveDay(lastClaim, now)) {
                    // Consecutive day - increment streak
                    newStreak = streak.current_streak + 1;
                } else if (lastClaim) {
                    // Streak broken
                    streakBroken = true;
                    newStreak = 1;
                } else {
                    // First ever claim
                    newStreak = 1;
                }

                // Check for new record
                if (newStreak > streak.longest_streak) {
                    isNewRecord = true;
                }

                // Update database
                const { error } = await supabase
                    .from('user_streaks')
                    .update({
                        current_streak: newStreak,
                        longest_streak: Math.max(newStreak, streak.longest_streak),
                        last_claim_date: now.toISOString(),
                        total_claims: streak.total_claims + 1,
                        updated_at: now.toISOString()
                    })
                    .eq('user_id', userId);

                if (error) throw error;

                const bonus = this.calculateStreakBonus(newStreak);

                return {
                    currentStreak: newStreak,
                    longestStreak: Math.max(newStreak, streak.longest_streak),
                    bonus,
                    isNewRecord,
                    streakBroken,
                    canClaim: true
                };
            } else {
                // Already claimed today
                return {
                    currentStreak: streak.current_streak,
                    longestStreak: streak.longest_streak,
                    bonus: 0,
                    isNewRecord: false,
                    streakBroken: false,
                    canClaim: false
                };
            }
        } catch (error) {
            console.error('Error updating streak:', error);
            throw error;
        }
    }

    /**
     * Calculate bonus money based on streak days
     */
    calculateStreakBonus(streakDays) {
        if (streakDays < 3) return 0;
        if (streakDays < 7) return 5000;
        if (streakDays < 14) return 15000;
        if (streakDays < 30) return 35000;
        if (streakDays < 60) return 75000;
        if (streakDays < 90) return 150000;
        return 250000; // 90+ days
    }

    /**
     * Get streak emoji based on days
     */
    getStreakEmoji(streakDays) {
        if (streakDays >= 90) return '🔥🔥🔥';
        if (streakDays >= 30) return '🔥🔥';
        if (streakDays >= 7) return '🔥';
        if (streakDays >= 3) return '⚡';
        return '✨';
    }

    /**
     * Get streak badge for profile
     */
    getStreakBadge(streak) {
        const { current_streak, longest_streak } = streak;
        let badges = [];

        if (current_streak >= 90) badges.push('🏆 LEYENDA');
        else if (current_streak >= 30) badges.push('💎 DEDICADO');
        else if (current_streak >= 7) badges.push('⭐ CONSTANTE');

        if (longest_streak >= 100) badges.push('👑 RÉCORD');

        return badges.join(' ');
    }

    /**
     * Get top streaks in server
     */
    async getTopStreaks(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('user_streaks')
                .select('*')
                .order('current_streak', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting top streaks:', error);
            return [];
        }
    }

    /**
     * Check if two moments are the same day
     */
    isSameDay(moment1, moment2) {
        return moment1.format('YYYY-MM-DD') === moment2.format('YYYY-MM-DD');
    }

    /**
     * Check if moments are consecutive days
     */
    isConsecutiveDay(lastClaim, now) {
        const yesterday = now.clone().subtract(1, 'day');
        return this.isSameDay(lastClaim, yesterday);
    }

    /**
     * Get next streak milestone reward
     */
    getNextMilestone(currentStreak) {
        const milestones = [3, 7, 14, 30, 60, 90];
        for (const milestone of milestones) {
            if (currentStreak < milestone) {
                return {
                    days: milestone,
                    reward: this.calculateStreakBonus(milestone),
                    daysLeft: milestone - currentStreak
                };
            }
        }
        return null; // Max milestone reached
    }
}

module.exports = new StreakService();

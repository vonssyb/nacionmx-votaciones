const { supabase } = require('../config/supabaseClient');
const moment = require('moment-timezone');

/**
 * DailyRewardService - Manages improved daily reward claims
 * Progressive rewards based on consecutive days
 */
class DailyRewardService {
    constructor() {
        this.timezone = 'America/Mexico_City';
        this.luckyBonusChance = 0.10; // 10% chance of lucky bonus
    }

    /**
     * Get or create daily reward record
     */
    async getDailyReward(userId) {
        try {
            let { data, error } = await supabase
                .from('daily_rewards')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                const { data: newReward, error: createError } = await supabase
                    .from('daily_rewards')
                    .insert([{
                        user_id: userId,
                        consecutive_days: 0,
                        total_claims: 0,
                        total_earned: 0,
                        best_streak: 0
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                return newReward;
            }

            return data;
        } catch (error) {
            console.error('Error getting daily reward:', error);
            throw error;
        }
    }

    /**
     * Calculate reward based on consecutive days
     */
    calculateReward(consecutiveDays) {
        const baseRewards = {
            1: 5000,
            2: 7500,
            3: 10000,
            4: 12500,
            5: 15000,
            6: 17500,
            7: 50000,    // Week 1 bonus
            14: 100000,  // Week 2 bonus
            21: 175000,  // Week 3 bonus
            30: 500000,  // Month bonus
            60: 1000000, // 2 months
            90: 2500000  // 3 months
        };

        // Get exact day reward if available
        if (baseRewards[consecutiveDays]) {
            return baseRewards[consecutiveDays];
        }

        // Calculate for days in between milestones
        if (consecutiveDays > 90) return 100000 + (consecutiveDays * 2000);
        if (consecutiveDays > 30) return 50000 + (consecutiveDays * 1500);
        if (consecutiveDays > 14) return 25000 + (consecutiveDays * 1000);
        if (consecutiveDays > 7) return 20000;

        return 5000 + (consecutiveDays * 2500);
    }

    /**
     * Check if user won lucky bonus
     */
    rollLuckyBonus() {
        return Math.random() < this.luckyBonusChance;
    }

    /**
     * Calculate lucky bonus amount
     */
    calculateLuckyBonus(baseReward) {
        // Lucky bonus is 50-200% of base reward
        const multiplier = 0.5 + (Math.random() * 1.5);
        return Math.floor(baseReward * multiplier);
    }

    /**
     * Claim daily reward
     */
    async claimDailyReward(userId) {
        try {
            const dailyReward = await this.getDailyReward(userId);
            const now = moment().tz(this.timezone);
            const lastClaim = dailyReward.last_claim_date
                ? moment(dailyReward.last_claim_date).tz(this.timezone)
                : null;

            // Check if already claimed today
            if (lastClaim && this.isSameDay(now, lastClaim)) {
                const nextClaim = lastClaim.clone().add(1, 'day').startOf('day');
                return {
                    success: false,
                    alreadyClaimed: true,
                    nextClaimTimestamp: Math.floor(nextClaim.valueOf() / 1000)
                };
            }

            // Calculate new consecutive days
            let consecutiveDays = dailyReward.consecutive_days;
            if (!lastClaim || this.isConsecutiveDay(lastClaim, now)) {
                consecutiveDays += 1;
            } else {
                // Streak broken, reset to 1
                consecutiveDays = 1;
            }

            // Calculate rewards
            const baseReward = this.calculateReward(consecutiveDays);
            const isLucky = this.rollLuckyBonus();
            const luckyBonus = isLucky ? this.calculateLuckyBonus(baseReward) : 0;
            const totalReward = baseReward + luckyBonus;

            // Update database
            const { error: updateError } = await supabase
                .from('daily_rewards')
                .update({
                    last_claim_date: now.toISOString(),
                    consecutive_days: consecutiveDays,
                    total_claims: dailyReward.total_claims + 1,
                    total_earned: dailyReward.total_earned + totalReward,
                    best_streak: Math.max(consecutiveDays, dailyReward.best_streak),
                    last_bonus_amount: totalReward,
                    updated_at: now.toISOString()
                })
                .eq('user_id', userId);

            if (updateError) throw updateError;

            // Record claim in history
            await supabase
                .from('daily_reward_claims')
                .insert([{
                    user_id: userId,
                    consecutive_day: consecutiveDays,
                    base_reward: baseReward,
                    bonus_reward: luckyBonus,
                    total_reward: totalReward,
                    was_lucky_bonus: isLucky
                }]);

            // Get next milestone info
            const nextMilestone = this.getNextMilestone(consecutiveDays);

            return {
                success: true,
                consecutiveDays,
                baseReward,
                luckyBonus,
                totalReward,
                isLucky,
                isMilestone: this.isMilestone(consecutiveDays),
                nextMilestone,
                bestStreak: Math.max(consecutiveDays, dailyReward.best_streak)
            };
        } catch (error) {
            console.error('Error claiming daily reward:', error);
            throw error;
        }
    }

    /**
     * Check if day is a milestone
     */
    isMilestone(day) {
        return [7, 14, 21, 30, 60, 90].includes(day);
    }

    /**
     * Get next milestone
     */
    getNextMilestone(currentDay) {
        const milestones = [7, 14, 21, 30, 60, 90];
        for (const milestone of milestones) {
            if (currentDay < milestone) {
                return {
                    days: milestone,
                    reward: this.calculateReward(milestone),
                    daysLeft: milestone - currentDay
                };
            }
        }
        return null;
    }

    /**
     * Check if two moments are same day
     */
    isSameDay(moment1, moment2) {
        return moment1.format('YYYY-MM-DD') === moment2.format('YYYY-MM-DD');
    }

    /**
     * Check if consecutive day
     */
    isConsecutiveDay(lastClaim, now) {
        const yesterday = now.clone().subtract(1, 'day');
        return this.isSameDay(lastClaim, yesterday);
    }

    /**
     * Get users who haven't claimed today
     */
    async getUsersNeedingReminder() {
        try {
            const now = moment().tz(this.timezone);
            const startOfDay = now.clone().startOf('day').toISOString();

            const { data, error } = await supabase
                .from('daily_rewards')
                .select('user_id, last_claim_date, consecutive_days')
                .or(`last_claim_date.is.null,last_claim_date.lt.${startOfDay}`)
                .gte('consecutive_days', 3); // Only remind users with at least 3 day streak

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting users needing reminder:', error);
            return [];
        }
    }
}

module.exports = new DailyRewardService();

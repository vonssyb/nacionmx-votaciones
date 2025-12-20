/**
 * RewardsService - Points and cashback management
 * Fase 4, Item #12: Rewards/Cashback System
 */

const logger = require('./Logger');

class RewardsService {
    constructor(supabase) {
        this.supabase = supabase;
        this.pointsPerHundred = 1; // 1 point per $100
        this.creditMultiplier = 2; // 2x points on credit cards
        this.redemptionRate = 100; // 100 points = $1
    }

    /**
     * Award points for a transaction
     */
    async awardPointsForTransaction(userId, amount, cardType = 'debit') {
        try {
            const { data: points, error } = await this.supabase
                .rpc('calculate_transaction_points', {
                    p_amount: Math.abs(amount),
                    p_card_type: cardType
                });

            if (error) throw error;

            if (points > 0) {
                await this.awardPoints(
                    userId,
                    points,
                    'earn',
                    'transaction',
                    { amount, cardType }
                );

                logger.info(`Awarded ${points} points to ${userId}`, {
                    amount,
                    cardType
                });
            }

            return points;

        } catch (error) {
            logger.errorWithContext('Error awarding transaction points', error, {
                userId,
                amount
            });
            return 0;
        }
    }

    /**
     * Award points to user
     */
    async awardPoints(userId, amount, type = 'earn', source = null, metadata = null) {
        try {
            const { error } = await this.supabase
                .rpc('award_points', {
                    p_user_id: userId,
                    p_amount: amount,
                    p_type: type,
                    p_source: source,
                    p_metadata: metadata
                });

            if (error) throw error;

            logger.info(`Points awarded: ${amount} to ${userId}`, {
                type,
                source
            });

            return true;

        } catch (error) {
            logger.errorWithContext('Error awarding points', error, {
                userId,
                amount
            });
            throw error;
        }
    }

    /**
     * Redeem points for cash
     */
    async redeemForCash(userId, points) {
        try {
            // Calculate cash value
            const cashValue = points / this.redemptionRate;

            if (cashValue < 1) {
                throw new Error('Minimum redemption is 100 points ($1)');
            }

            // Redeem points
            const { error: redeemError } = await this.supabase
                .rpc('redeem_points', {
                    p_user_id: userId,
                    p_amount: points
                });

            if (redeemError) throw redeemError;

            logger.info(`Points redeemed: ${points} points for $${cashValue}`, {
                userId
            });

            return cashValue;

        } catch (error) {
            logger.errorWithContext('Error redeeming points', error, {
                userId,
                points
            });
            throw error;
        }
    }

    /**
     * Get user points balance
     */
    async getUserBalance(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_points')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || {
                user_id: userId,
                points_balance: 0,
                lifetime_earned: 0,
                lifetime_redeemed: 0
            };

        } catch (error) {
            logger.errorWithContext('Error getting user balance', error, { userId });
            return null;
        }
    }

    /**
     * Get user points summary
     */
    async getUserSummary(userId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_user_points_summary', {
                    p_user_id: userId
                });

            if (error) throw error;

            return data && data.length > 0 ? data[0] : null;

        } catch (error) {
            logger.errorWithContext('Error getting points summary', error, { userId });
            return null;
        }
    }

    /**
     * Get available rewards catalog
     */
    async getRewardsCatalog() {
        try {
            const { data, error } = await this.supabase
                .from('rewards_catalog')
                .select('*')
                .eq('active', true)
                .order('points_cost');

            if (error) throw error;

            return data || [];

        } catch (error) {
            logger.errorWithContext('Error getting rewards catalog', error);
            return [];
        }
    }

    /**
     * Redeem a specific reward
     */
    async redeemReward(userId, rewardId) {
        try {
            // Get reward details
            const { data: reward, error: rewardError } = await this.supabase
                .from('rewards_catalog')
                .select('*')
                .eq('id', rewardId)
                .eq('active', true)
                .single();

            if (rewardError) throw rewardError;

            if (!reward) {
                throw new Error('Reward not found or inactive');
            }

            // Check if user has enough points
            const balance = await this.getUserBalance(userId);
            if (balance.points_balance < reward.points_cost) {
                throw new Error('Insufficient points');
            }

            // Redeem points
            const { error: redeemError } = await this.supabase
                .rpc('redeem_points', {
                    p_user_id: userId,
                    p_amount: reward.points_cost,
                    p_reward_id: rewardId
                });

            if (redeemError) throw redeemError;

            logger.info(`Reward redeemed: ${reward.name}`, {
                userId,
                rewardId,
                points: reward.points_cost
            });

            return {
                reward,
                cashValue: reward.cash_value
            };

        } catch (error) {
            logger.errorWithContext('Error redeeming reward', error, {
                userId,
                rewardId
            });
            throw error;
        }
    }

    /**
     * Give bonus points (admin/event)
     */
    async giveBonusPoints(userId, amount, reason) {
        try {
            await this.awardPoints(
                userId,
                amount,
                'bonus',
                'manual',
                { reason }
            );

            logger.info(`Bonus points given: ${amount} to ${userId}`, { reason });

            return true;

        } catch (error) {
            logger.errorWithContext('Error giving bonus points', error);
            throw error;
        }
    }

    /**
     * Format points display
     */
    formatPoints(points) {
        const { formatNumber } = require('../utils/formatters');
        return `${formatNumber(points)} pts`;
    }

    /**
     * Format cash value
     */
    formatCashValue(points) {
        const { formatMoney } = require('../utils/formatters');
        const cash = points / this.redemptionRate;
        return formatMoney(cash);
    }
}

module.exports = RewardsService;

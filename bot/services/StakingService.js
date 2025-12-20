/**
 * StakingService - Crypto staking with APY
 * Lock crypto for passive income
 */

const logger = require('./Logger');

class StakingService {
    constructor(supabase) {
        this.supabase = supabase;

        // APY rates by crypto and lock period
        this.rates = {
            'BTC': { 7: 0.05, 30: 0.06, 90: 0.08 },  // 5%, 6%, 8%
            'ETH': { 7: 0.08, 30: 0.10, 90: 0.12 },  // 8%, 10%, 12%
            'SOL': { 7: 0.12, 30: 0.15, 90: 0.18 }   // 12%, 15%, 18%
        };
    }

    /**
     * Create new stake
     */
    async createStake(userId, cryptoSymbol, amount, lockedDays) {
        try {
            const apy = this.rates[cryptoSymbol]?.[lockedDays] || 0.05;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + lockedDays);

            const { data, error } = await this.supabase
                .from('crypto_stakes')
                .insert({
                    user_id: userId,
                    crypto_symbol: cryptoSymbol,
                    amount,
                    apy: apy * 100, // Store as percentage
                    locked_days: lockedDays,
                    end_date: endDate.toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            logger.info(`Stake created: ${userId} staked ${amount} ${cryptoSymbol} for ${lockedDays} days`);
            return data;

        } catch (error) {
            logger.errorWithContext('Error creating stake', error);
            throw error;
        }
    }

    /**
     * Get user's active stakes
     */
    async getUserStakes(userId) {
        try {
            const { data, error } = await this.supabase
                .from('crypto_stakes')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            logger.errorWithContext('Error getting stakes', error);
            return [];
        }
    }

    /**
     * Calculate current earnings
     */
    async calculateEarnings(stakeId) {
        try {
            const { data, error } = await this.supabase
                .rpc('calculate_stake_earnings', { p_stake_id: stakeId });

            if (error) throw error;
            return data || 0;

        } catch (error) {
            logger.errorWithContext('Error calculating earnings', error);
            return 0;
        }
    }

    /**
     * Withdraw stake (if unlocked)
     */
    async withdrawStake(stakeId, userId) {
        try {
            const { data: stake, error: fetchError } = await this.supabase
                .from('crypto_stakes')
                .select('*')
                .eq('id', stakeId)
                .eq('user_id', userId)
                .single();

            if (fetchError) throw fetchError;

            const now = new Date();
            const endDate = new Date(stake.end_date);

            if (now < endDate) {
                throw new Error('Stake is still locked');
            }

            const earnings = await this.calculateEarnings(stakeId);

            const { error: updateError } = await this.supabase
                .from('crypto_stakes')
                .update({
                    status: 'completed',
                    earnings
                })
                .eq('id', stakeId);

            if (updateError) throw updateError;

            logger.info(`Stake withdrawn: ${stakeId} with earnings ${earnings}`);
            return { amount: stake.amount, earnings };

        } catch (error) {
            logger.errorWithContext('Error withdrawing stake', error);
            throw error;
        }
    }
}

module.exports = StakingService;

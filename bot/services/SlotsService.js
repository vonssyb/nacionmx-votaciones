/**
 * SlotsService - Slot machine casino game
 * 3-reel slots with jackpot
 */

const logger = require('./Logger');

class SlotsService {
    constructor(supabase) {
        this.supabase = supabase;

        // Slot symbols with weights
        this.symbols = [
            { emoji: '🍒', weight: 30, value: 2 },   // Cherry - common
            { emoji: '🍋', weight: 25, value: 3 },   // Lemon
            { emoji: '🍊', weight: 20, value: 4 },   // Orange
            { emoji: '🍇', weight: 15, value: 5 },   // Grape
            { emoji: '💎', weight: 8, value: 10 },   // Diamond - rare
            { emoji: '7️⃣', weight: 2, value: 50 }    // Lucky 7 - very rare
        ];
    }

    /**
     * Spin the slots
     */
    async spin(userId, betAmount) {
        try {
            // Generate 3 random symbols
            const reel1 = this.getRandomSymbol();
            const reel2 = this.getRandomSymbol();
            const reel3 = this.getRandomSymbol();

            const result = { reel1, reel2, reel3 };

            // Calculate payout
            const { payout, win, jackpot } = this.calculatePayout(
                reel1, reel2, reel3, betAmount
            );

            // Update jackpot (1% of bet goes to jackpot)
            await this.addToJackpot(betAmount * 0.01);

            // Record spin
            const { error } = await this.supabase
                .from('slot_spins')
                .insert({
                    user_id: userId,
                    bet_amount: betAmount,
                    result,
                    payout,
                    win
                });

            if (error) throw error;

            // Handle jackpot win
            if (jackpot) {
                const jackpotAmount = await this.getJackpot();
                await this.resetJackpot(userId);
                return {
                    result,
                    payout: payout + jackpotAmount,
                    win: true,
                    jackpot: true,
                    jackpotAmount
                };
            }

            logger.info(`Slots spin: ${userId} bet ${betAmount}, ${win ? 'WON' : 'LOST'} ${payout}`);

            return { result, payout, win, jackpot: false };

        } catch (error) {
            logger.errorWithContext('Error spinning slots', error);
            throw error;
        }
    }

    /**
     * Get random symbol based on weights
     */
    getRandomSymbol() {
        const totalWeight = this.symbols.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;

        for (const symbol of this.symbols) {
            if (random < symbol.weight) {
                return symbol.emoji;
            }
            random -= symbol.weight;
        }

        return this.symbols[0].emoji; // Fallback
    }

    /**
     * Calculate payout based on matching symbols
     */
    calculatePayout(r1, r2, r3, bet) {
        // Jackpot: Three 7s
        if (r1 === '7️⃣' && r2 === '7️⃣' && r3 === '7️⃣') {
            return { payout: bet * 100, win: true, jackpot: true };
        }

        // Three of a kind
        if (r1 === r2 && r2 === r3) {
            const symbol = this.symbols.find(s => s.emoji === r1);
            const multiplier = symbol ? symbol.value : 2;
            return { payout: bet * multiplier, win: true, jackpot: false };
        }

        // Two of a kind
        if (r1 === r2 || r2 === r3 || r1 === r3) {
            return { payout: bet * 1.5, win: true, jackpot: false };
        }

        // No match
        return { payout: 0, win: false, jackpot: false };
    }

    /**
     * Get current jackpot amount
     */
    async getJackpot() {
        try {
            const { data, error } = await this.supabase
                .from('slot_jackpot')
                .select('amount')
                .eq('id', 1)
                .single();

            if (error) throw error;
            return data?.amount || 10000;

        } catch (error) {
            logger.errorWithContext('Error getting jackpot', error);
            return 10000;
        }
    }

    /**
     * Add to jackpot pool
     */
    async addToJackpot(amount) {
        try {
            const current = await this.getJackpot();

            const { error } = await this.supabase
                .from('slot_jackpot')
                .update({ amount: current + amount })
                .eq('id', 1);

            if (error) throw error;

        } catch (error) {
            logger.errorWithContext('Error adding to jackpot', error);
        }
    }

    /**
     * Reset jackpot after win
     */
    async resetJackpot(winnerId) {
        try {
            const { error } = await this.supabase
                .from('slot_jackpot')
                .update({
                    amount: 10000, // Reset to base
                    last_winner: winnerId,
                    last_won_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) throw error;

            logger.info(`Jackpot won by ${winnerId}!`);

        } catch (error) {
            logger.errorWithContext('Error resetting jackpot', error);
        }
    }
}

module.exports = SlotsService;

/**
 * RouletteService - Improved Roulette System
 * Multiplayer betting with various bet types
 */

const logger = require('./Logger');

class RouletteService {
    constructor(supabase) {
        this.supabase = supabase;
        this.gameCounter = 0;

        // Roulette numbers with colors
        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
        // 0 is green
    }

    /**
     * Create new roulette game
     */
    async createGame() {
        try {
            this.gameCounter++;
            const winningNumber = Math.floor(Math.random() * 37); // 0-36
            const winningColor = this.getColor(winningNumber);

            const { data, error } = await this.supabase
                .from('roulette_games')
                .insert({
                    game_number: this.gameCounter,
                    winning_number: winningNumber,
                    winning_color: winningColor
                })
                .select()
                .single();

            if (error) throw error;

            logger.info(`Roulette game created: #${this.gameCounter}, winning: ${winningNumber} (${winningColor})`);
            return data;

        } catch (error) {
            logger.errorWithContext('Error creating roulette game', error);
            throw error;
        }
    }

    /**
     * Place bet on game
     */
    async placeBet(gameId, userId, betType, betValue, amount) {
        try {
            const { data, error } = await this.supabase
                .from('roulette_bets')
                .insert({
                    game_id: gameId,
                    user_id: userId,
                    bet_type: betType,
                    bet_value: betValue,
                    amount
                })
                .select()
                .single();

            if (error) throw error;

            logger.info(`Bet placed: ${userId} on ${betType}:${betValue} for ${amount}`);
            return data;

        } catch (error) {
            logger.errorWithContext('Error placing bet', error);
            throw error;
        }
    }

    /**
     * Calculate payout for bet
     */
    calculatePayout(betType, betValue, winningNumber, winningColor, betAmount) {
        switch (betType) {
            case 'number':
                // Straight up: 35:1
                return parseInt(betValue) === winningNumber ? betAmount * 35 : 0;

            case 'color':
                // Red/Black: 1:1 (but 0 loses)
                if (winningNumber === 0) return 0;
                return betValue === winningColor ? betAmount * 2 : 0;

            case 'odd':
                // Odd: 1:1 (0 loses)
                if (winningNumber === 0) return 0;
                return winningNumber % 2 === 1 ? betAmount * 2 : 0;

            case 'even':
                // Even: 1:1 (0 loses)
                if (winningNumber === 0 || winningNumber % 2 === 1) return 0;
                return betAmount * 2;

            case 'low':
                // 1-18: 1:1
                if (winningNumber === 0) return 0;
                return winningNumber >= 1 && winningNumber <= 18 ? betAmount * 2 : 0;

            case 'high':
                // 19-36: 1:1
                if (winningNumber === 0) return 0;
                return winningNumber >= 19 && winningNumber <= 36 ? betAmount * 2 : 0;

            default:
                return 0;
        }
    }

    /**
     * Process all bets for a game
     */
    async processBets(gameId) {
        try {
            const { data: game } = await this.supabase
                .from('roulette_games')
                .select('*')
                .eq('id', gameId)
                .single();

            const { data: bets } = await this.supabase
                .from('roulette_bets')
                .select('*')
                .eq('game_id', gameId);

            if (!bets || bets.length === 0) {
                return { winners: [], losers: [] };
            }

            const winners = [];
            const losers = [];

            for (const bet of bets) {
                const payout = this.calculatePayout(
                    bet.bet_type,
                    bet.bet_value,
                    game.winning_number,
                    game.winning_color,
                    bet.amount
                );

                const won = payout > 0;

                // Update bet record
                await this.supabase
                    .from('roulette_bets')
                    .update({ payout, won })
                    .eq('id', bet.id);

                if (won) {
                    winners.push({ ...bet, payout });
                } else {
                    losers.push(bet);
                }
            }

            // Update game totals
            const totalPot = bets.reduce((sum, b) => sum + b.amount, 0);
            await this.supabase
                .from('roulette_games')
                .update({
                    total_pot: totalPot,
                    total_players: bets.length
                })
                .eq('id', gameId);

            return { winners, losers, game };

        } catch (error) {
            logger.errorWithContext('Error processing roulette bets', error);
            throw error;
        }
    }

    /**
     * Get color of number
     */
    getColor(number) {
        if (number === 0) return 'green';
        if (this.redNumbers.includes(number)) return 'red';
        if (this.blackNumbers.includes(number)) return 'black';
        return 'green';
    }

    /**
     * Get emoji for color
     */
    getColorEmoji(color) {
        switch (color) {
            case 'red': return '🔴';
            case 'black': return '⚫';
            case 'green': return '🟢';
            default: return '⚪';
        }
    }
}

module.exports = RouletteService;

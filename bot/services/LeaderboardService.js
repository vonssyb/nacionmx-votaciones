const { supabase } = require('../config/supabaseClient');
const { EmbedBuilder } = require('discord.js');

/**
 * LeaderboardService - Generates rankings for various categories
 */
class LeaderboardService {
    /**
     * Get top users by total money (balance + bank)
     */
    async getTopMoney(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('user_id, username, balance, bank')
                .order('balance', { ascending: false })
                .limit(limit * 2); // Get more to calculate properly

            if (error) throw error;

            // Calculate total and sort
            const ranked = (data || [])
                .map(user => ({
                    ...user,
                    total: (user.balance || 0) + (user.bank || 0)
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, limit);

            return ranked;
        } catch (error) {
            console.error('Error getting top money:', error);
            return [];
        }
    }

    /**
     * Get top casino players by total winnings
     */
    async getTopCasino(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('casino_stats')
                .select('user_id, total_won, total_bet, games_played')
                .gte('games_played', 5) // At least 5 games played
                .order('total_won', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting top casino:', error);
            return [];
        }
    }

    /**
     * Get top companies by revenue
     */
    async getTopCompanies(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name, owner_id, total_revenue, employee_count')
                .order('total_revenue', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting top companies:', error);
            return [];
        }
    }

    /**
     * Get top users by level/experience
     */
    async getTopLevel(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('user_levels')
                .select('user_id, level, experience, total_experience')
                .order('total_experience', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting top level:', error);
            return [];
        }
    }

    /**
     * Get top streaks
     */
    async getTopStreaks(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('user_streaks')
                .select('user_id, current_streak, longest_streak')
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
     * Create leaderboard embed
     */
    createLeaderboardEmbed(title, description, rankings, formatFunction, color = 0xFFD700) {
        const medals = ['🥇', '🥈', '🥉'];

        let descriptionText = description + '\n\n';

        rankings.forEach((item, index) => {
            const medal = index < 3 ? medals[index] : `**${index + 1}.**`;
            descriptionText += `${medal} ${formatFunction(item, index)}\n`;
        });

        if (rankings.length === 0) {
            descriptionText += '*No hay datos disponibles aún.*';
        }

        return new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(descriptionText)
            .setTimestamp()
            .setFooter({ text: 'Rankings actualizados' });
    }

    /**
     * Get user position in ranking
     */
    async getUserPosition(userId, rankingType) {
        try {
            let query;
            let orderColumn;

            switch (rankingType) {
                case 'money':
                    // Special case - need to calculate total
                    const { data: allUsers } = await supabase
                        .from('users')
                        .select('user_id, balance, bank');

                    const sorted = (allUsers || [])
                        .map(u => ({
                            user_id: u.user_id,
                            total: (u.balance || 0) + (u.bank || 0)
                        }))
                        .sort((a, b) => b.total - a.total);

                    const position = sorted.findIndex(u => u.user_id === userId);
                    return position >= 0 ? position + 1 : null;

                case 'casino':
                    query = supabase.from('casino_stats').select('user_id, total_won');
                    orderColumn = 'total_won';
                    break;

                case 'level':
                    query = supabase.from('user_levels').select('user_id, total_experience');
                    orderColumn = 'total_experience';
                    break;

                case 'streak':
                    query = supabase.from('user_streaks').select('user_id, current_streak');
                    orderColumn = 'current_streak';
                    break;

                default:
                    return null;
            }

            if (query) {
                const { data } = await query.order(orderColumn, { ascending: false });
                const position = (data || []).findIndex(u => u.user_id === userId);
                return position >= 0 ? position + 1 : null;
            }

            return null;
        } catch (error) {
            console.error('Error getting user position:', error);
            return null;
        }
    }

    /**
     * Format money amount
     */
    formatMoney(amount) {
        return `$${amount.toLocaleString('en-US')}`;
    }

    /**
     * Get username from Discord
     */
    async getUsername(client, userId) {
        try {
            const user = await client.users.fetch(userId);
            return user ? user.username : 'Usuario Desconocido';
        } catch {
            return 'Usuario Desconocido';
        }
    }
}

module.exports = new LeaderboardService();

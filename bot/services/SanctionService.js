const { EmbedBuilder } = require('discord.js');

class SanctionService {
    constructor(supabase, client) {
        this.supabase = supabase;
        this.client = client;
    }

    /**
     * Create a new sanction
     * @param {string} discordUserId 
     * @param {string} moderatorId 
     * @param {'notificacion'|'sa'|'general'} type 
     * @param {string} reason 
     * @param {string|null} evidenceUrl 
     */
    async createSanction(discordUserId, moderatorId, type, reason, evidenceUrl = null) {
        try {
            const { data, error } = await this.supabase
                .from('sanctions')
                .insert({
                    discord_user_id: discordUserId,
                    moderator_id: moderatorId,
                    type: type,
                    reason: reason,
                    evidence_url: evidenceUrl,
                    status: 'active'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating sanction:', error);
            throw error;
        }
    }

    /**
     * Get active sanctions for a user
     * @param {string} discordUserId 
     */
    async getUserSanctions(discordUserId) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('discord_user_id', discordUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Count sanctions by type for a user
     * @param {string} discordUserId 
     */
    async getSanctionCounts(discordUserId) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('type')
            .eq('discord_user_id', discordUserId)
            .eq('status', 'active');

        if (error) throw error;

        const counts = {
            notificacion: 0,
            sa: 0,
            general: 0
        };

        data.forEach(s => {
            if (counts[s.type] !== undefined) counts[s.type]++;
        });

        return counts;
    }

    /**
     * Get a specific sanction by ID
     * @param {string} id 
     */
    async getSanctionById(id) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Update a sanction's details
     * @param {string} id 
     * @param {object} updates 
     */
    async updateSanction(id, updates) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get total count of 'general' sanctions (warns) for a user
     * @param {string} discordUserId 
     */
    async getWarnCount(discordUserId) {
        const { count, error } = await this.supabase
            .from('sanctions')
            .select('*', { count: 'exact', head: true })
            .eq('discord_user_id', discordUserId)
            .eq('type', 'general')
            .eq('status', 'active');

        if (error) throw error;
        return count;
    }
}

module.exports = SanctionService;

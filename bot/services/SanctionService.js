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
    async createSanction(discordUserId, moderatorId, type, reason, evidenceUrl = null, expiresAt = null, actionType = null, description = null) {
        try {
            const { data, error } = await this.supabase
                .from('sanctions')
                .insert({
                    discord_user_id: discordUserId,
                    moderator_id: moderatorId,
                    type: type,
                    reason: reason,
                    description: description,
                    evidence_url: evidenceUrl,
                    status: 'active',
                    expires_at: expiresAt,
                    action_type: actionType
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
            .in('status', ['active', 'appealed'])
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

    async getSACount(discordUserId) {
        const { count, error } = await this.supabase
            .from('sanctions')
            .select('*', { count: 'exact', head: true })
            .eq('discord_user_id', discordUserId)
            .eq('type', 'sa')
            .eq('status', 'active');

        if (error) throw error;
        return count;
    }

    // --- EXPIRATION LOGIC ---
    async checkExpiredSanctions() {
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lt('expires_at', now);

        if (error) {
            console.error('Error checking expired sanctions:', error);
            return [];
        }
        return data;
    }

    async expireSanction(id) {
        const { error } = await this.supabase
            .from('sanctions')
            .update({ status: 'expired' })
            .eq('id', id);

        if (error) console.error(`Error expiring sanction ${id}:`, error);
    }

    // --- CLEAN SLATE / ARCHIVE LOGIC ---
    async archiveOldSanctions(userId, months = 6) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        const cutoffISO = cutoffDate.toISOString();

        // Only archive 'general' sanctions (Warns/Verbal)
        // SAs should generally be permanent or handled differently, but requirement says "Warns old".
        // We will target 'general' type.
        const { data, error } = await this.supabase
            .from('sanctions')
            .update({ status: 'archived' })
            .eq('discord_user_id', userId)
            .eq('type', 'general')
            .eq('status', 'active')
            .lt('created_at', cutoffISO)
            .select();

        if (error) throw error;
        return data ? data.length : 0;
    }
    /**
     * Void/Delete a sanction (Soft Delete)
     * @param {string} id 
     * @param {string} voidReason 
     * @param {string} moderatorId 
     */
    async voidSanction(id, voidReason, moderatorId) {
        // We append the void reason to the original reason or a note, 
        // and set status to 'void'.
        // Assuming 'void' is a valid status enum, if not we use 'archived' or similar, 
        // but 'void' is clearer for "deleted by admin".

        const { data, error } = await this.supabase
            .from('sanctions')
            .update({
                status: 'void',
                // We might want to store who deleted it. 
                // If table doesn't have specific columns, we can append to reason?
                // Better to just update status for now, managing columns is complex live.
                // We will rely on Audit Log for the "Who" and "Why".
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
    async appealSanction(id, reason) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .update({
                status: 'appealed'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = SanctionService;

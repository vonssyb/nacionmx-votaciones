const logger = require('./Logger');

class BanxicoService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Get all indicators
     */
    async getIndicators() {
        const { data, error } = await this.supabase
            .from('banxico_indicators')
            .select('*')
            .order('key');

        if (error) {
            logger.error('[Banxico] Error fetching indicators', error);
            throw error;
        }
        return data;
    }

    /**
     * Update an indicator
     */
    async updateIndicator(key, value, userId) {
        const { data, error } = await this.supabase
            .from('banxico_indicators')
            .update({
                value,
                updated_at: new Date(),
                updated_by: userId
            })
            .eq('key', key)
            .select()
            .single();

        if (error) {
            logger.error('[Banxico] Error updating indicator', error);
            throw error;
        }

        // Log action
        await this.supabase.from('banxico_logs').insert({
            action: 'update_indicator',
            details: { key, value },
            executor_id: userId
        });

        return data;
    }

    /**
     * Create authentication code
     */
    async createAuthCode(userId, code, expiresAt) {
        // First delete any existing codes for this user to avoid clutter
        await this.supabase
            .from('banxico_auth_codes')
            .delete()
            .eq('user_id', userId);

        const { data, error } = await this.supabase
            .from('banxico_auth_codes')
            .insert({
                user_id: userId,
                code: code,
                expires_at: expiresAt
            })
            .select()
            .single();

        if (error) {
            logger.error('[Banxico] Error creating auth code', error);
            throw error;
        }
        return data;
    }
}

module.exports = BanxicoService;

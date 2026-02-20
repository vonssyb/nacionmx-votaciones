/**
 * CharacterService
 * Manages multi-character system for users (Ultrapass feature)
 * 
 * Handles:
 * - Tracking active character for each user
 * - Switching between characters
 * - Verifying permission to use multiple characters
 */

const { EmbedBuilder } = require('discord.js');

class CharacterService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;

        // Caching for active character to reduce DB hits
        // Key: userId, Value: { charId: number, expires: timestamp }
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get the currently active character ID for a user.
     * Defaults to 1 if not set.
     * @param {string} userId - Discord User ID
     * @returns {Promise<number>} - 1 or 2
     */
    async getActiveCharacter(userId) {
        // Check cache first
        const cached = this.cache.get(userId);
        if (cached && Date.now() < cached.expires) {
            return cached.charId;
        }

        try {
            const { data, error } = await this.supabase
                .from('user_active_character')
                .select('active_character_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('[CharacterService] Error fetching active character:', error);
                return 1; // Default to 1 on error
            }

            const charId = data ? data.active_character_id : 1;

            // Update cache
            this.cache.set(userId, { charId, expires: Date.now() + this.CACHE_TTL });

            return charId;
        } catch (err) {
            console.error('[CharacterService] Exception fetching active character:', err);
            return 1;
        }
    }

    /**
     * Set the active character for a user.
     * @param {string} userId - Discord User ID
     * @param {number} charId - 1 or 2
     * @returns {Promise<boolean>} Success status
     */
    async setActiveCharacter(userId, charId) {
        if (![1, 2].includes(charId)) return false;

        try {
            const { error } = await this.supabase
                .from('user_active_character')
                .upsert({
                    user_id: userId,
                    active_character_id: charId,
                    updated_at: new Date()
                }, { onConflict: 'user_id' });

            if (error) {
                console.error('[CharacterService] Error setting active character:', error);
                return false;
            }

            // Update cache
            this.cache.set(userId, { charId, expires: Date.now() + this.CACHE_TTL });
            return true;
        } catch (err) {
            console.error('[CharacterService] Exception setting active character:', err);
            return false;
        }
    }

    /**
     * Helper to get user's display name for character
     * @param {string} userId 
     */
    async getCharacterName(userId, charId = null) {
        if (!charId) charId = await this.getActiveCharacter(userId);

        // This is a placeholder, usually we'd fetch DNI name
        // We can inject DNIService if needed or rely on caller
        return `Personaje #${charId}`;
    }
}

module.exports = CharacterService;

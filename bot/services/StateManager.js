const { createClient } = require('@supabase/supabase-js');
const logger = require('./Logger');

/**
 * Centralized State Manager
 * Manages ephemeral state with Supabase persistence
 * Replaces global.pendingActions and other in-memory state
 */
class StateManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.tableName = 'pending_actions';
    }

    /**
     * Initialize state manager (create table if needed)
     */
    async initialize() {
        try {
            // Check if table exists
            const { error } = await this.supabase
                .from(this.tableName)
                .select('id')
                .limit(1);

            if (error && error.code === '42P01') {
                // Table doesn't exist, create it
                logger.info('Creating pending_actions table...');

                // Note: This requires SUPERUSER permissions or pre-created table
                // Best practice: Create via migration script
                logger.warn('Please create pending_actions table via migration');
            }

            // Cleanup expired actions on startup
            await this.cleanupExpired();

            logger.info('StateManager initialized');
        } catch (error) {
            logger.errorWithContext('Failed to initialize StateManager', error);
        }
    }

    /**
     * Store a pending action
     * @param {string} hash - Unique identifier for the action
     * @param {Object} data - Action data to store
     * @param {number} ttlSeconds - Time to live in seconds (default: 1 hour)
     */
    async setPendingAction(hash, data, ttlSeconds = 3600) {
        try {
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

            const { error } = await this.supabase
                .from(this.tableName)
                .upsert({
                    action_hash: hash,
                    data: data,
                    expires_at: expiresAt,
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'action_hash'
                });

            if (error) {
                logger.errorWithContext('Failed to store pending action', error, { hash });
                return false;
            }

            logger.debug(`Stored pending action: ${hash}`);
            return true;
        } catch (error) {
            logger.errorWithContext('Error in setPendingAction', error, { hash });
            return false;
        }
    }

    /**
     * Retrieve a pending action
     * @param {string} hash - Action identifier
     * @returns {Object|null} Action data or null if not found/expired
     */
    async getPendingAction(hash) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .eq('action_hash', hash)
                .gte('expires_at', new Date().toISOString())
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Not found
                    return null;
                }
                logger.errorWithContext('Failed to retrieve pending action', error, { hash });
                return null;
            }

            return data?.data || null;
        } catch (error) {
            logger.errorWithContext('Error in getPendingAction', error, { hash });
            return null;
        }
    }

    /**
     * Delete a pending action
     * @param {string} hash - Action identifier
     */
    async deletePendingAction(hash) {
        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .eq('action_hash', hash);

            if (error) {
                logger.errorWithContext('Failed to delete pending action', error, { hash });
                return false;
            }

            logger.debug(`Deleted pending action: ${hash}`);
            return true;
        } catch (error) {
            logger.errorWithContext('Error in deletePendingAction', error, { hash });
            return false;
        }
    }

    /**
     * Get all pending actions for a user
     * @param {string} userId - Discord user ID
     */
    async getUserActions(userId) {
        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .gte('expires_at', new Date().toISOString())
                .ilike('data->>userId', userId);

            if (error) {
                logger.errorWithContext('Failed to get user actions', error, { userId });
                return [];
            }

            return data.map(row => row.data);
        } catch (error) {
            logger.errorWithContext('Error in getUserActions', error, { userId });
            return [];
        }
    }

    /**
     * Cleanup expired actions
     */
    async cleanupExpired() {
        try {
            const { error, count } = await this.supabase
                .from(this.tableName)
                .delete()
                .lt('expires_at', new Date().toISOString());

            if (error) {
                logger.errorWithContext('Failed to cleanup expired actions', error);
            } else if (count > 0) {
                logger.info(`Cleaned up ${count} expired actions`);
            }
        } catch (error) {
            logger.errorWithContext('Error in cleanupExpired', error);
        }
    }

    /**
     * Get statistics
     */
    async getStats() {
        try {
            const { count: total } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true });

            const { count: active } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true })
                .gte('expires_at', new Date().toISOString());

            const { count: expired } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true })
                .lt('expires_at', new Date().toISOString());

            return {
                total: total || 0,
                active: active || 0,
                expired: expired || 0
            };
        } catch (error) {
            logger.errorWithContext('Error getting stats', error);
            return { total: 0, active: 0, expired: 0 };
        }
    }

    /**
     * Start periodic cleanup (every 5 minutes)
     */
    startPeriodicCleanup(intervalMinutes = 5) {
        setInterval(async () => {
            await this.cleanupExpired();
        }, intervalMinutes * 60 * 1000);

        logger.info(`Started periodic cleanup (every ${intervalMinutes} minutes)`);
    }
}

module.exports = StateManager;

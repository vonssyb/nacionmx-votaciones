/**
 * LimitsService - Manage dynamic card limits by role
 * Fase 3, Item #8: Límites Dinámicos por Rol
 */

const logger = require('./Logger');

class LimitsService {
    constructor(supabase) {
        this.supabase = supabase;
        this.cache = new Map(); // Cache role limits
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get card limit for a user
     * Checks: user override -> role limits -> default
     */
    async getUserLimit(userId, cardType, tier = null, roleId = 'default') {
        try {
            const { data, error } = await this.supabase
                .rpc('get_user_card_limit', {
                    p_user_id: userId,
                    p_card_type: cardType,
                    p_tier: tier,
                    p_role_id: roleId
                });

            if (error) throw error;

            logger.debug(`Got limit for user ${userId}: ${data}`, {
                cardType,
                tier,
                roleId
            });

            return data || 50000; // Fallback
        } catch (error) {
            logger.errorWithContext('Error getting user limit', error, {
                userId,
                cardType,
                tier
            });
            return 50000; // Safe fallback
        }
    }

    /**
     * Get limits for a specific role
     */
    async getRoleLimits(roleId) {
        // Check cache
        const cacheKey = `role_${roleId}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const { data, error } = await this.supabase
                .rpc('get_role_limits', { p_role_id: roleId });

            if (error) throw error;

            // Cache result
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            logger.errorWithContext('Error getting role limits', error, { roleId });
            return null;
        }
    }

    /**
     * Set limits for a role (admin only)
     */
    async setRoleLimits(roleId, roleName, limits, adminId) {
        try {
            const { data, error } = await this.supabase
                .rpc('set_role_limits', {
                    p_role_id: roleId,
                    p_role_name: roleName,
                    p_limits: limits
                });

            if (error) throw error;

            // Clear cache
            this.cache.delete(`role_${roleId}`);

            logger.info(`Role limits updated for ${roleName} (${roleId}) by ${adminId}`, {
                limits
            });

            return true;
        } catch (error) {
            logger.errorWithContext('Error setting role limits', error, {
                roleId,
                adminId
            });
            throw error;
        }
    }

    /**
     * Set user-specific override (admin only)
     */
    async setUserOverride(userId, limits, reason, adminId) {
        try {
            const { data, error } = await this.supabase
                .rpc('set_user_override', {
                    p_user_id: userId,
                    p_limits: limits,
                    p_reason: reason,
                    p_set_by: adminId
                });

            if (error) throw error;

            logger.info(`User override set for ${userId} by ${adminId}`, {
                limits,
                reason
            });

            return true;
        } catch (error) {
            logger.errorWithContext('Error setting user override', error, {
                userId,
                adminId
            });
            throw error;
        }
    }

    /**
     * Remove user override (admin only)
     */
    async removeUserOverride(userId, adminId) {
        try {
            const { data, error } = await this.supabase
                .rpc('remove_user_override', { p_user_id: userId });

            if (error) throw error;

            logger.info(`User override removed for ${userId} by ${adminId}`);

            return true;
        } catch (error) {
            logger.errorWithContext('Error removing user override', error, {
                userId,
                adminId
            });
            throw error;
        }
    }

    /**
     * Get user's override status
     */
    async getUserOverride(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_limit_overrides')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore not found

            return data;
        } catch (error) {
            logger.errorWithContext('Error getting user override', error, { userId });
            return null;
        }
    }

    /**
     * List all configured roles
     */
    async listRoles() {
        try {
            const { data, error } = await this.supabase
                .from('card_limits')
                .select('role_id, role_name')
                .order('role_name');

            if (error) throw error;

            return data || [];
        } catch (error) {
            logger.errorWithContext('Error listing roles', error);
            return [];
        }
    }

    /**
     * Get highest priority role for user
     * (Helper for Discord role integration)
     */
    getHighestRoleId(member) {
        // Priority role IDs (configure these)
        const rolePriority = {
            // Example: 'VIP_ROLE_ID': 1,
            // 'PREMIUM_ROLE_ID': 2,
            // Higher number = higher priority
        };

        let highestRole = 'default';
        let highestPriority = -1;

        for (const [roleId, priority] of Object.entries(rolePriority)) {
            if (member.roles.cache.has(roleId) && priority > highestPriority) {
                highestRole = roleId;
                highestPriority = priority;
            }
        }

        return highestRole;
    }

    /**
     * Format limits for display
     */
    formatLimits(limits) {
        const { formatMoney } = require('../utils/formatters');

        return {
            debit: `${formatMoney(limits.debit_base_limit)} - ${formatMoney(limits.debit_max_limit)}`,
            credit: {
                start: formatMoney(limits.credit_start_limit),
                basica: formatMoney(limits.credit_basica_limit),
                plus: formatMoney(limits.credit_plus_limit),
                plata: formatMoney(limits.credit_plata_limit),
                oro: formatMoney(limits.credit_oro_limit),
                rubi: formatMoney(limits.credit_rubi_limit),
                black: formatMoney(limits.credit_black_limit),
                diamante: formatMoney(limits.credit_diamante_limit)
            },
            business: formatMoney(limits.business_limit),
            transactions: {
                max: formatMoney(limits.max_transaction),
                daily: formatMoney(limits.daily_transaction_limit)
            }
        };
    }
}

module.exports = LimitsService;

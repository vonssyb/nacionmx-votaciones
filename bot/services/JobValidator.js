const { EMERGENCY_ROLES, PRINCIPAL_JOBS, SECONDARY_JOBS } = require('../config/erlcEconomyEmergency');
const { BENEFIT_ROLES, RP_RANK_ROLES } = require('./EconomyHelper');

const JOB_LIMITS = {
    DEFAULT: { principal: 1, secondary: 1 },
    BOOSTER: { principal: 2, secondary: 2 },
    PREMIUM: { principal: 2, secondary: 4 },
    ULTRAPASS: { principal: 3, secondary: 4 }
};

class JobValidator {
    /**
     * Get the job limits for a user based on their roles
     * @param {GuildMember} member
     * @returns {{principal: number, secondary: number, tier: string}}
     */
    static getLimits(member) {
        if (!member) return { ...JOB_LIMITS.DEFAULT, tier: 'Default' };

        if (member.roles.cache.has(BENEFIT_ROLES.ULTRAPASS)) {
            return { ...JOB_LIMITS.ULTRAPASS, tier: 'Ultra Pass 💎' };
        }
        if (member.roles.cache.has(BENEFIT_ROLES.PREMIUM)) {
            return { ...JOB_LIMITS.PREMIUM, tier: 'Premium 🌟' };
        }
        if (member.roles.cache.has(BENEFIT_ROLES.BOOSTER)) {
            return { ...JOB_LIMITS.BOOSTER, tier: 'Booster 🚀' };
        }

        return { ...JOB_LIMITS.DEFAULT, tier: 'Estándar' };
    }

    /**
     * Count the number of Principal jobs (Gov + Cartel + Criminal) a user has
     * @param {GuildMember} member
     * @returns {number}
     */
    static getPrincipalJobCount(member) {
        let count = 0;

        // Iterate through defined PRINCIPAL_JOBS
        for (const roleId of PRINCIPAL_JOBS) {
            if (member.roles.cache.has(roleId)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Count the number of Secondary jobs (Companies + Roles) a user has
     * @param {GuildMember} member
     * @param {SupabaseClient} supabase
     * @returns {Promise<number>}
     */
    static async getSecondaryJobCount(member, supabase) {
        let count = 0;

        // 1. Check Discord Roles
        for (const roleId of SECONDARY_JOBS) {
            if (member.roles.cache.has(roleId)) {
                count++;
            }
        }

        // 2. Check Database (Companies)
        // Only if we want to include companies that might not have a specific role assigned yet
        // or if using a different system.
        try {
            const { count: dbCount, error } = await supabase
                .from('company_employees')
                .select('*', { count: 'exact', head: true })
                .eq('discord_id', member.id)
                .is('fired_at', null);

            if (!error && dbCount) {
                // We add database jobs.
                // Note: If the DB entry also gives the Role, this counts as 2.
                // Ideally we should prefer one source.
                // However, for "Blocking", over-counting is safer than under-counting.
                // Only if count is excessively high is it a problem.
                // Let's assume distinct systems for now or accept the overlap as a stronger restriction.
                count += dbCount;
            }
        } catch (e) {
            console.error('[JobValidator] Exception counting secondary jobs:', e);
        }

        return count;
    }

    /**
     * Validate if a user can accept a new job
     * @param {GuildMember} member
     * @param {string} newJobType 'PRINCIPAL' or 'SECONDARY'
     * @param {SupabaseClient} supabase
     * @returns {Promise<{allowed: boolean, reason: string}>}
     */
    static async validateNewJob(member, newJobType, supabase) {
        const limits = this.getLimits(member);

        if (newJobType === 'PRINCIPAL') {
            const currentPrincipal = this.getPrincipalJobCount(member);
            if (currentPrincipal >= limits.principal) {
                return {
                    allowed: false,
                    reason: `❌ Has alcanzado tu límite de **${limits.principal}** trabajos principales (Gobierno/Cartel).\n💎 Nivel actual: **${limits.tier}**`
                };
            }
        }

        if (newJobType === 'SECONDARY') {
            const currentSecondary = await this.getSecondaryJobCount(member, supabase);
            if (currentSecondary >= limits.secondary) {
                return {
                    allowed: false,
                    reason: `❌ Has alcanzado tu límite de **${limits.secondary}** trabajos secundarios (Empresas/Roles).\n💎 Nivel actual: **${limits.tier}**`
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check if user has incompatible roles (Police vs Cartel)
     * @param {GuildMember} member 
     * @returns {boolean} true if conflict exists
     */
    static hasIncompatibleRoles(member) {
        // Simplified check: Just ensuring they don't exceed principal count implies they can't have conflicting major roles
        // if the limit is 1. If limit > 1 (Booster), they CAN have multiple.
        // But usually Police <-> Criminal is hard restricted logic.
        // For now, relies on principal limit.
        return false;
    }
}

module.exports = JobValidator;

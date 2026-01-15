const { EMERGENCY_ROLES } = require('../config/erlcEconomyEmergency');
const { BENEFIT_ROLES } = require('./EconomyHelper');

const CARTEL_ROLE_ID = '0000000000000000000'; // TODO: Replace with actual Cartel Role ID

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

        return { ...JOB_LIMITS.DEFAULT, tier: 'Ciudadano' };
    }

    /**
     * Count the number of Principal jobs (Gov + Cartel) a user has
     * @param {GuildMember} member
     * @returns {number}
     */
    static getPrincipalJobCount(member) {
        let count = 0;

        // Count Government Roles
        const govRoles = Object.values(EMERGENCY_ROLES);
        for (const roleId of govRoles) {
            // EXCEPTION: Paramédico is considered a Secondary Job
            if (roleId === EMERGENCY_ROLES.PARAMEDICO) continue;

            if (member.roles.cache.has(roleId)) {
                count++;
                // Optimization: If distinct government branches count as 1 "Principal" job regardless of how many roles they have within it?
                // Usually in RP, you are just "Police", you can't be "Police" AND "Military" at the same time usually.
                // But if they somehow have multiple roles, we count them.
            }
        }

        // Count Cartel Role
        if (member.roles.cache.has(CARTEL_ROLE_ID)) {
            count++;
        }

        return count;
    }

    /**
     * Count the number of Secondary jobs (Companies) a user has
     * @param {string} discordId
     * @param {SupabaseClient} supabase
     * @returns {Promise<number>}
     */
    static async getSecondaryJobCount(discordId, supabase) {
        try {
            const { count, error } = await supabase
                .from('company_employees')
                .select('*', { count: 'exact', head: true })
                .eq('discord_id', discordId)
                .is('fired_at', null);

            if (error) {
                console.error('[JobValidator] Error counting secondary jobs:', error);
                return 0; // Fail safe? Or block? checking 0 might allow exploit if DB fails.
                // But usually we prefer to be lenient on read errors or throw.
            }

            return count || 0;
        } catch (e) {
            console.error('[JobValidator] Exception counting secondary jobs:', e);
            return 0;
        }
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

            // Check Exclusion (Police vs Cartel)
            // If trying to add Police, check Cartel. If trying to add Cartel, check Police.
            // This method assumes we know what specific role is being added, but here we just know 'PRINCIPAL'.
            // The exclusion check is better handled specifically when adding the specific role.
            // But we can do a general check: "If you have X, you cannot have Y"
        }

        if (newJobType === 'SECONDARY') {
            const currentSecondary = await this.getSecondaryJobCount(member.id, supabase);
            if (currentSecondary >= limits.secondary) {
                return {
                    allowed: false,
                    reason: `❌ Has alcanzado tu límite de **${limits.secondary}** trabajos secundarios (Empresas).\n💎 Nivel actual: **${limits.tier}**`
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
        const hasPolice = Object.values(EMERGENCY_ROLES).some(roleId => member.roles.cache.has(roleId));
        const hasCartel = member.roles.cache.has(CARTEL_ROLE_ID);

        return hasPolice && hasCartel;
    }
}

module.exports = JobValidator;

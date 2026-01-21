/**
 * @module services/RoleManager
 * @description Manages Role Assignments for Sanctions (SA Levels, Blacklists)
 */

const logger = require('./Logger');

class RoleManager {
    constructor(client) {
        this.client = client;

        this.SA_ROLES = {
            1: '1450997809234051122',
            2: '1454636391932756049',
            3: '1456028699718586459',
            4: '1456028797638934704',
            5: '1456028933995630701'
        };

        this.BLACKLIST_ROLES = {
            'Blacklist Moderacion': '1451860028653834300',
            'Blacklist Facciones Policiales': '1413714060423200778',
            'Blacklist Cartel': '1449930883762225253',
            'Blacklist Politica': '1413714467287470172',
            'Blacklist Empresas': '1413714540834852875',
            'Blacklist Influencer': '1459240544017453238'
        };
    }

    /**
     * Adjust SA Roles based on current sanction count
     * Removes all other SA roles and adds the correct one.
     * @param {GuildMember} member - Discord Member
     * @param {number} level - Current SA Level (0-5)
     */
    async setSanctionRole(member, level) {
        try {
            if (!member || !member.roles) return false;

            const allSaRoles = Object.values(this.SA_ROLES);

            // 1. Remove ALL SA roles
            // Optimization: Only remove if they have them? remove() handles it safely usually.
            await member.roles.remove(allSaRoles);

            // 2. Add target role if level > 0 and exists
            if (level > 0 && this.SA_ROLES[level]) {
                await member.roles.add(this.SA_ROLES[level]);
                logger.info(`[RoleManager] Set SA Level ${level} for ${member.user.tag}`);
                return true;
            }

            return true; // Success (cleared roles if level 0)
        } catch (error) {
            logger.errorWithContext(`[RoleManager] Failed to set SA role lvl ${level}`, error);
            return false;
        }
    }

    /**
     * Assign a Blacklist Role
     * @param {GuildMember} member 
     * @param {string} typeKey - Key matching BLACKLIST_ROLES
     */
    async assignBlacklistRole(member, typeKey) {
        try {
            const roleId = this.BLACKLIST_ROLES[typeKey];
            if (!roleId) {
                logger.warn(`[RoleManager] Blacklist type not found: ${typeKey}`);
                return false;
            }

            await member.roles.add(roleId);
            logger.info(`[RoleManager] Assigned Blacklist Role (${typeKey}) to ${member.user.tag}`);
            return true;
        } catch (error) {
            logger.errorWithContext(`[RoleManager] Failed to assign Blacklist role`, error);
            return false;
        }
    }

    getSaRoleId(level) {
        return this.SA_ROLES[level];
    }
}

module.exports = RoleManager;

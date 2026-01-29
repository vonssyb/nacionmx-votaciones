/**
 * PermissionService
 * Centralized permission and role management service
 * 
 * Usage:
 *   const PermissionService = require('../services/PermissionService');
 *   
 *   if (!PermissionService.hasRole(member, 'staff.admin')) {
 *       return interaction.editReply('❌ No tienes permisos.');
 *   }
 */

const { PermissionFlagsBits } = require('discord.js');
const roles = require('../config/roles.json');

class PermissionService {
    /**
     * Check if member has a specific role
     * @param {GuildMember} member - Discord guild member
     * @param {string} rolePath - Dot notation path to role (e.g., 'staff.owner', 'economy.premium')
     * @returns {boolean}
     */
    static hasRole(member, rolePath) {
        if (!member || !member.roles) return false;

        const roleId = this.getRoleId(rolePath);
        if (!roleId) {
            console.warn(`[PermissionService] Role not found: ${rolePath}`);
            return false;
        }

        return member.roles.cache.has(roleId);
    }

    /**
     * Check if member has ANY of the specified roles
     * @param {GuildMember} member - Discord guild member
     * @param {string[]} rolePaths - Array of role paths
     * @returns {boolean}
     */
    static hasAnyRole(member, rolePaths) {
        if (!member || !member.roles) return false;
        return rolePaths.some(path => this.hasRole(member, path));
    }

    /**
     * Check if member has ALL of the specified roles
     * @param {GuildMember} member - Discord guild member
     * @param {string[]} rolePaths - Array of role paths
     * @returns {boolean}
     */
    static hasAllRoles(member, rolePaths) {
        if (!member || !member.roles) return false;
        return rolePaths.every(path => this.hasRole(member, path));
    }

    /**
     * Check if member is in a role group
     * @param {GuildMember} member - Discord guild member
     * @param {string} groupName - Group name from roles.json (e.g., 'admin', 'staff_all')
     * @returns {boolean}
     */
    static isInGroup(member, groupName) {
        if (!member || !member.roles) return false;

        const group = roles.groups[groupName];
        if (!group || !Array.isArray(group)) {
            console.warn(`[PermissionService] Group not found: ${groupName}`);
            return false;
        }

        return group.some(roleId => member.roles.cache.has(roleId));
    }

    /**
     * Check if member has Discord Administrator permission
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static isAdmin(member) {
        if (!member || !member.permissions) return false;
        return member.permissions.has(PermissionFlagsBits.Administrator);
    }

    /**
     * Check if member is staff (admin or staff group)
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static isStaff(member) {
        return this.isInGroup(member, 'admin') ||
            this.isInGroup(member, 'staff_all') ||
            this.isAdmin(member);
    }

    /**
     * Check if member can arrest others
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static canArrest(member) {
        return this.isInGroup(member, 'can_arrest') || this.isAdmin(member);
    }

    /**
     * Check if member can issue fines (multar)
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static canIssueFines(member) {
        return this.isInGroup(member, 'can_multar') || this.isAdmin(member);
    }

    /**
     * Check if member can grant licenses
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static canGrantLicenses(member) {
        return this.isInGroup(member, 'can_grant_licenses') || this.isAdmin(member);
    }

    /**
     * Check if target member is protected from arrest
     * @param {GuildMember} targetMember - Target member to check
     * @returns {boolean}
     */
    static isProtectedFromArrest(targetMember) {
        return this.isInGroup(targetMember, 'protected_from_arrest');
    }

    /**
     * Check if target member is protected from CK
     * @param {GuildMember} targetMember - Target member to check
     * @returns {boolean}
     */
    static isProtectedFromCK(targetMember) {
        return this.isInGroup(targetMember, 'protected_from_ck');
    }

    /**
     * Check if member has economy benefits (premium, booster, etc.)
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean}
     */
    static hasEconomyBenefits(member) {
        return this.isInGroup(member, 'economy_benefits');
    }

    /**
     * Get role ID from dot notation path
     * @param {string} path - Dot notation path (e.g., 'staff.owner')
     * @returns {string|null}
     * @private
     */
    static getRoleId(path) {
        const parts = path.split('.');
        let current = roles;

        for (const part of parts) {
            if (current[part] === undefined) return null;
            current = current[part];
        }

        return typeof current === 'string' ? current : null;
    }

    /**
     * Get all role IDs from a group
     * @param {string} groupName - Group name
     * @returns {string[]}
     */
    static getGroupRoles(groupName) {
        return roles.groups[groupName] || [];
    }

    /**
     * Get channel ID from configuration
     * @param {string} channelKey - Channel key (e.g., 'arrest_public', 'ck_private')
     * @returns {string|null}
     */
    static getChannelId(channelKey) {
        return roles.channels[channelKey] || null;
    }

    /**
     * Require specific role or throw permission error
     * @param {GuildMember} member - Discord guild member
     * @param {string|string[]} rolePaths - Role path(s) required
     * @param {string} errorMessage - Custom error message
     * @throws {Error} If member doesn't have required role(s)
     */
    static requireRole(member, rolePaths, errorMessage = null) {
        const paths = Array.isArray(rolePaths) ? rolePaths : [rolePaths];

        if (!this.hasAnyRole(member, paths)) {
            const error = new Error(errorMessage || '❌ No tienes los permisos necesarios.');
            error.code = 'INSUFFICIENT_PERMISSIONS';
            throw error;
        }

        return true;
    }

    /**
     * Require member to be staff
     * @param {GuildMember} member - Discord guild member
     * @param {string} errorMessage - Custom error message
     * @throws {Error} If member is not staff
     */
    static requireStaff(member, errorMessage = null) {
        if (!this.isStaff(member)) {
            const error = new Error(errorMessage || '❌ Este comando es solo para staff.');
            error.code = 'STAFF_ONLY';
            throw error;
        }

        return true;
    }

    /**
     * Require member to be admin
     * @param {GuildMember} member - Discord guild member
     * @param {string} errorMessage - Custom error message
     * @throws {Error} If member is not admin
     */
    static requireAdmin(member, errorMessage = null) {
        if (!this.isInGroup(member, 'admin') && !this.isAdmin(member)) {
            const error = new Error(errorMessage || '❌ Este comando es solo para administradores.');
            error.code = 'ADMIN_ONLY';
            throw error;
        }

        return true;
    }

    /**
     * Get member's highest role from a category
     * @param {GuildMember} member - Discord guild member
     * @param {string} category - Category name (e.g., 'staff', 'government')
     * @returns {object|null} {key: string, id: string, name: string}
     */
    static getHighestRole(member, category) {
        if (!member || !member.roles) return null;

        const categoryRoles = roles[category];
        if (!categoryRoles) return null;

        // Priority order (customize based on your hierarchy)
        const priorityOrder = [
            'owner', 'co_owner', 'the_boss', 'junta_directiva',
            'administrador', 'staff', 'encargado_staff'
        ];

        for (const key of priorityOrder) {
            const roleId = categoryRoles[key];
            if (roleId && member.roles.cache.has(roleId)) {
                return {
                    key,
                    id: roleId,
                    name: member.roles.cache.get(roleId)?.name || key
                };
            }
        }

        return null;
    }

    /**
     * Get all roles.json data (for debugging/admin commands)
     * @returns {object}
     */
    static getAllRoles() {
        return roles;
    }

    /**
     * Check if role ID exists in configuration
     * @param {string} roleId - Discord role ID
     * @returns {boolean}
     */
    static roleExists(roleId) {
        const search = (obj) => {
            for (const key in obj) {
                if (obj[key] === roleId) return true;
                if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    if (search(obj[key])) return true;
                }
                if (Array.isArray(obj[key]) && obj[key].includes(roleId)) {
                    return true;
                }
            }
            return false;
        };

        return search(roles);
    }
}

module.exports = PermissionService;

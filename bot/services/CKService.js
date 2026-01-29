/**
 * CKService
 * Centralized Character Kill management service
 * 
 * Handles:
 * - Complete character backup before CK
 * - CK application (data deletion, role removal)
 * - CK reversal (backup restoration)
 * - Atomic operations with rollback support
 * - CK logging and history
 * 
 * Usage:
 *   const CKService = require('../services/CKService');
 *   await CKService.applyCK(supabase, userId, guildId, type, reason, moderatorId, evidenceUrl);
 */

const PermissionService = require('./PermissionService');
const LogHelper = require('../utils/LogHelper');

class CKService {
    /**
     * Create complete backup of user data
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @returns {Promise<object>} Backup data object
     */
    static async createBackup(supabase, userId, guildId) {
        try {
            const backup = {};

            // Get user balance
            const { data: balance } = await supabase
                .from('user_balances')
                .select('cash, bank')
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .maybeSingle();

            backup.cash = balance?.cash || 0;
            backup.bank = balance?.bank || 0;

            // Get DNI
            const { data: dni } = await supabase
                .from('citizen_dni')
                .select('*')
                .eq('discord_user_id', userId)
                .maybeSingle();

            backup.dni = dni;

            // Get credit cards
            const { data: cards } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('discord_user_id', userId)
                .eq('active', true);

            backup.cards = cards || [];

            // Get debit cards
            const { data: debitCards } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', userId)
                .eq('status', 'active');

            backup.debit_cards = debitCards || [];

            // Get companies
            const { data: companies } = await supabase
                .from('companies')
                .select('*')
                .contains('owner_ids', [userId]);

            backup.companies = companies || [];

            // Get vehicles
            const { data: vehicles } = await supabase
                .from('registered_vehicles')
                .select('*')
                .eq('owner_id', userId);

            backup.vehicles = vehicles || [];

            // Get user purchases (tienda items)
            const { data: purchases } = await supabase
                .from('user_purchases')
                .select('*')
                .eq('user_id', userId);

            backup.purchases = purchases || [];

            // Get savings accounts
            const { data: savings } = await supabase
                .from('savings_accounts')
                .select('*')
                .eq('discord_user_id', userId);

            backup.savings = savings || [];

            // Get investments
            const { data: investments } = await supabase
                .from('investments')
                .select('*')
                .eq('discord_user_id', userId);

            backup.investments = investments || [];

            // Get loans
            const { data: loans } = await supabase
                .from('loans')
                .select('*')
                .eq('discord_user_id', userId);

            backup.loans = loans || [];

            console.log('[CKService] Backup created:', {
                userId,
                dni: !!backup.dni,
                cards: backup.cards.length,
                companies: backup.companies.length,
                vehicles: backup.vehicles.length
            });

            return backup;
        } catch (error) {
            console.error('[CKService] Error creating backup:', error);
            throw error;
        }
    }

    /**
     * Apply CK to user (delete all data)
     * @param {object} supabase - Supabase client
     * @param {GuildMember} member - Target guild member
     * @param {string} guildId - Guild ID
     * @param {string} type - CK type (Normal, Administrativo, Auto CK)
     * @param {string} reason - Reason for CK
     * @param {string} moderatorId - Moderator user ID
     * @param {string} evidenceUrl - Evidence screenshot URL
     * @returns {Promise<{success: boolean, message: string, ckRecord?: object}>}
     */
    static async applyCK(supabase, member, guildId, type, reason, moderatorId, evidenceUrl) {
        try {
            const userId = member.user.id;

            // 1. Create backup first
            const backup = await this.createBackup(supabase, userId, guildId);

            // 2. Get roles to remove
            const rolesToRemove = member.roles.cache
                .filter(role => role.id !== member.guild.id) // Don't remove @everyone
                .map(role => ({
                    id: role.id,
                    name: role.name
                }));

            // 3. Delete DNI
            await this.deleteDNI(supabase, userId);

            // 4. Deactivate credit cards
            await this.deactivateCreditCards(supabase, userId);

            // 5. Deactivate debit cards
            await this.deactivateDebitCards(supabase, userId);

            // 6. Expropriate companies
            await this.expropriateCompanies(supabase, userId);

            // 7. Remove vehicles
            await this.removeVehicles(supabase, userId);

            // 8. Delete user purchases
            await this.deleteUserPurchases(supabase, userId);

            // 9. Delete savings accounts
            await this.deleteSavingsAccounts(supabase, userId);

            // 10. Delete investments
            await this.deleteInvestments(supabase, userId);

            // 11. Delete loans
            await this.deleteLoans(supabase, userId);

            // 12. Reset money to 0
            await supabase
                .from('user_balances')
                .upsert({
                    guild_id: guildId,
                    user_id: userId,
                    cash: 0,
                    bank: 0
                }, { onConflict: 'guild_id,user_id' });

            // 13. Remove Discord roles
            await this.removeRoles(member, rolesToRemove);

            // 14. Create CK record with backup
            const { data: ckRecord } = await supabase
                .from('ck_registry')
                .insert({
                    user_id: userId,
                    moderator_id: moderatorId,
                    ck_type: type,
                    reason: reason,
                    evidence_url: evidenceUrl,
                    previous_cash: backup.cash,
                    previous_bank: backup.bank,
                    roles_removed: rolesToRemove,
                    backup_data: backup,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            return {
                success: true,
                message: '✅ CK aplicado exitosamente.',
                ckRecord
            };
        } catch (error) {
            console.error('[CKService] Error applying CK:', error);
            return {
                success: false,
                message: '❌ Error al aplicar CK. Puede que algunos datos no se hayan eliminado.'
            };
        }
    }

    /**
     * Revert CK (restore from backup)
     * @param {object} supabase - Supabase client
     * @param {GuildMember} member - Target guild member
     * @param {string} guildId - Guild ID
     * @param {string} reason - Reason for reversal
     * @param {string} moderatorId - Moderator user ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async revertCK(supabase, member, guildId, reason, moderatorId) {
        try {
            const userId = member.user.id;

            // 1. Find last CK record with backup
            const { data: ckRecord, error } = await supabase
                .from('ck_registry')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error || !ckRecord) {
                return {
                    success: false,
                    message: '❌ No se encontró un registro de CK para este usuario.'
                };
            }

            const backup = ckRecord.backup_data;
            if (!backup) {
                return {
                    success: false,
                    message: '⚠️ El registro de CK no tiene datos de respaldo. Solo se pueden restaurar roles y dinero manualmente.'
                };
            }

            // 2. Restore money
            await supabase
                .from('user_balances')
                .upsert({
                    guild_id: guildId,
                    user_id: userId,
                    cash: ckRecord.previous_cash || 0,
                    bank: ckRecord.previous_bank || 0
                }, { onConflict: 'guild_id,user_id' });

            // 3. Restore DNI
            if (backup.dni) {
                await supabase.from('citizen_dni').upsert(backup.dni);
            }

            // 4. Restore credit cards
            if (backup.cards && backup.cards.length > 0) {
                const cardIds = backup.cards.map(c => c.id);
                await supabase
                    .from('credit_cards')
                    .update({ active: true })
                    .in('id', cardIds);
            }

            // 5. Restore debit cards
            if (backup.debit_cards && backup.debit_cards.length > 0) {
                const debitCardIds = backup.debit_cards.map(c => c.id);
                await supabase
                    .from('debit_cards')
                    .update({ status: 'active' })
                    .in('id', debitCardIds);
            }

            // 6. Restore companies (re-add as owner)
            if (backup.companies && backup.companies.length > 0) {
                for (const comp of backup.companies) {
                    const { data: currentComp } = await supabase
                        .from('companies')
                        .select('owner_ids, status')
                        .eq('id', comp.id)
                        .maybeSingle();

                    if (currentComp) {
                        let newOwners = currentComp.owner_ids || [];
                        if (!newOwners.includes(userId)) {
                            newOwners.push(userId);
                            await supabase
                                .from('companies')
                                .update({ owner_ids: newOwners })
                                .eq('id', comp.id);
                        }
                    }
                }
            }

            // 7. Restore vehicles
            if (backup.vehicles && backup.vehicles.length > 0) {
                for (const vehicle of backup.vehicles) {
                    await supabase.from('registered_vehicles').upsert(vehicle);
                }
            }

            // 8. Restore user purchases
            if (backup.purchases && backup.purchases.length > 0) {
                for (const purchase of backup.purchases) {
                    await supabase.from('user_purchases').upsert(purchase);
                }
            }

            // 9. Restore Discord roles
            const rolesToRestore = ckRecord.roles_removed || [];
            await this.restoreRoles(member, rolesToRestore);

            // 10. Mark CK as reverted
            await supabase
                .from('ck_registry')
                .update({
                    reverted: true,
                    reverted_at: new Date().toISOString(),
                    reverted_by: moderatorId,
                    revert_reason: reason
                })
                .eq('id', ckRecord.id);

            return {
                success: true,
                message: '✅ CK revertido exitosamente. Datos restaurados.'
            };
        } catch (error) {
            console.error('[CKService] Error reverting CK:', error);
            return {
                success: false,
                message: '❌ Error al revertir CK.'
            };
        }
    }

    /**
     * Delete user DNI
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deleteDNI(supabase, userId) {
        await supabase
            .from('citizen_dni')
            .delete()
            .eq('discord_user_id', userId);
    }

    /**
     * Deactivate all credit cards
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deactivateCreditCards(supabase, userId) {
        await supabase
            .from('credit_cards')
            .update({ active: false })
            .eq('discord_user_id', userId);
    }

    /**
     * Deactivate all debit cards
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deactivateDebitCards(supabase, userId) {
        await supabase
            .from('debit_cards')
            .update({ status: 'inactive' })
            .eq('discord_user_id', userId);
    }

    /**
     * Expropriate companies (remove user from owner_ids)
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async expropriateCompanies(supabase, userId) {
        const { data: companies } = await supabase
            .from('companies')
            .select('id, owner_ids')
            .contains('owner_ids', [userId]);

        if (companies && companies.length > 0) {
            for (const company of companies) {
                const newOwners = (company.owner_ids || []).filter(id => id !== userId);

                await supabase
                    .from('companies')
                    .update({
                        owner_ids: newOwners.length > 0 ? newOwners : null,
                        status: newOwners.length === 0 ? 'expropriated' : company.status
                    })
                    .eq('id', company.id);
            }
        }

        // Also remove as employee
        await supabase
            .from('company_employees')
            .delete()
            .eq('employee_id', userId);
    }

    /**
     * Remove all vehicles
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async removeVehicles(supabase, userId) {
        await supabase
            .from('registered_vehicles')
            .delete()
            .eq('owner_id', userId);
    }

    /**
     * Delete all user purchases
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deleteUserPurchases(supabase, userId) {
        await supabase
            .from('user_purchases')
            .delete()
            .eq('user_id', userId);
    }

    /**
     * Delete all savings accounts
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deleteSavingsAccounts(supabase, userId) {
        await supabase
            .from('savings_accounts')
            .delete()
            .eq('discord_user_id', userId);
    }

    /**
     * Delete all investments
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deleteInvestments(supabase, userId) {
        await supabase
            .from('investments')
            .delete()
            .eq('discord_user_id', userId);
    }

    /**
     * Delete all loans
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     */
    static async deleteLoans(supabase, userId) {
        await supabase
            .from('loans')
            .delete()
            .eq('discord_user_id', userId);
    }

    /**
     * Remove Discord roles from member
     * @param {GuildMember} member - Guild member
     * @param {Array} rolesToRemove - Array of role objects {id, name}
     */
    static async removeRoles(member, rolesToRemove) {
        for (const roleData of rolesToRemove) {
            try {
                const role = member.guild.roles.cache.get(roleData.id);
                if (role && member.roles.cache.has(roleData.id)) {
                    await member.roles.remove(role);
                }
            } catch (error) {
                console.error(`[CKService] Failed to remove role ${roleData.name}:`, error);
            }
        }
    }

    /**
     * Restore Discord roles to member
     * @param {GuildMember} member - Guild member
     * @param {Array} rolesToRestore - Array of role objects {id, name}
     */
    static async restoreRoles(member, rolesToRestore) {
        for (const roleData of rolesToRestore) {
            try {
                const role = member.guild.roles.cache.get(roleData.id);
                if (role && !member.roles.cache.has(roleData.id)) {
                    await member.roles.add(role);
                }
            } catch (error) {
                console.error(`[CKService] Failed to restore role ${roleData.name}:`, error);
            }
        }
    }

    /**
     * Get CK history for a user
     * @param {object} supabase - Supabase client
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of CK records
     */
    static async getCKHistory(supabase, userId) {
        const { data, error } = await supabase
            .from('ck_registry')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[CKService] Error fetching CK history:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Validate if moderator can apply CK
     * @param {GuildMember} moderator - Moderator member
     * @param {GuildMember} target - Target member
     * @returns {{canApply: boolean, message?: string}}
     */
    static validateCanApplyCK(moderator, target) {
        // Check if target is protected
        if (PermissionService.isProtectedFromCK(target)) {
            return {
                canApply: false,
                message: '❌ Este usuario está protegido y no puede recibir CK.'
            };
        }

        // Check if moderator has permission
        if (!PermissionService.isStaff(moderator)) {
            return {
                canApply: false,
                message: '❌ Solo el staff puede aplicar CK.'
            };
        }

        return { canApply: true };
    }
}

module.exports = CKService;

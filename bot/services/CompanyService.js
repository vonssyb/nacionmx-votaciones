/**
 * CompanyService
 * Centralized company management service
 * 
 * Handles:
 * - Company CRUD operations
 * - Employee management (hire, fire, salary adjustments)
 * - Financial operations (deposits, withdrawals, payroll)
 * - Company validation and permissions
 * 
 * Usage:
 *   const CompanyService = require('../services/CompanyService');
 *   const companies = await CompanyService.getUserCompanies(supabase, userId);
 */

const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const ValidationHelper = require('../utils/ValidationHelper');
const EconomyHelper = require('./EconomyHelper');

class CompanyService {
    /**
     * Get all companies owned by a user
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @returns {Promise<Array>} Array of companies
     */
    static async getUserCompanies(supabase, userId) {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .contains('owner_ids', [userId]);

        if (error) {
            console.error('[CompanyService] Error fetching user companies:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get company by ID
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @returns {Promise<object|null>} Company data or null
     */
    static async getCompanyById(supabase, companyId) {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .maybeSingle();

        if (error) {
            console.error('[CompanyService] Error fetching company:', error);
            return null;
        }

        return data;
    }

    /**
     * Get company by name
     * @param {object} supabase - Supabase client
     * @param {string} companyName - Company name
     * @returns {Promise<object|null>} Company data or null
     */
    static async getCompanyByName(supabase, companyName) {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .ilike('name', companyName)
            .maybeSingle();

        if (error) {
            console.error('[CompanyService] Error fetching company by name:', error);
            return null;
        }

        return data;
    }

    /**
     * Check if user is owner of company
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {string} companyId - Company ID
     * @returns {Promise<boolean>}
     */
    static async isOwner(supabase, userId, companyId) {
        const company = await this.getCompanyById(supabase, companyId);
        if (!company) return false;

        const ownerIds = company.owner_ids || [];
        return ownerIds.includes(userId);
    }

    /**
     * Check if user is employee of company
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {string} companyId - Company ID
     * @returns {Promise<object|null>} Employee record or null
     */
    static async isEmployee(supabase, userId, companyId) {
        const { data, error } = await supabase
            .from('company_employees')
            .select('*')
            .eq('company_id', companyId)
            .eq('employee_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[CompanyService] Error checking employee:', error);
            return null;
        }

        return data;
    }

    /**
     * Check if user can manage company (owner or CEO)
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {string} companyId - Company ID
     * @returns {Promise<boolean>}
     */
    static async canManage(supabase, userId, companyId) {
        // Check if owner
        if (await this.isOwner(supabase, userId, companyId)) {
            return true;
        }

        // Check if CEO/Manager
        const employee = await this.isEmployee(supabase, userId, companyId);
        if (employee && employee.position) {
            const managerialPositions = ['CEO', 'Director', 'Gerente', 'Manager'];
            return managerialPositions.some(pos =>
                employee.position.toLowerCase().

                    includes(pos.toLowerCase())
            );
        }

        return false;
    }

    /**
     * Get all employees of a company
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @returns {Promise<Array>} Array of employees
     */
    static async getEmployees(supabase, companyId) {
        const { data, error } = await supabase
            .from('company_employees')
            .select('*')
            .eq('company_id', companyId)
            .order('hired_at', { ascending: false });

        if (error) {
            console.error('[CompanyService] Error fetching employees:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Hire an employee
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {string} userId - User ID to hire
     * @param {number} salary - Salary amount
     * @param {string} position - Job position
     * @returns {Promise<{success: boolean, message: string, data?: object}>}
     */
    static async hireEmployee(supabase, companyId, userId, salary, position) {
        try {
            // Validate salary
            const salaryValidation = ValidationHelper.validateAmount(salary, 1000, 10000000);
            if (!salaryValidation.valid) {
                return { success: false, message: salaryValidation.message };
            }

            // Check if already employed
            const existing = await this.isEmployee(supabase, userId, companyId);
            if (existing) {
                return { success: false, message: '❌ Este usuario ya es empleado de esta empresa.' };
            }

            // Insert employee record
            const { data, error } = await supabase
                .from('company_employees')
                .insert({
                    company_id: companyId,
                    employee_id: userId,
                    salary: salary,
                    position: position,
                    hired_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[CompanyService] Error hiring employee:', error);
                return { success: false, message: '❌ Error al contratar empleado.' };
            }

            return {
                success: true,
                message: '✅ Empleado contratado exitosamente.',
                data
            };
        } catch (error) {
            console.error('[CompanyService] Exception hiring employee:', error);
            return { success: false, message: '❌ Error al contratar empleado.' };
        }
    }

    /**
     * Fire an employee
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {string} userId - User ID to fire
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async fireEmployee(supabase, companyId, userId) {
        try {
            const { error } = await supabase
                .from('company_employees')
                .delete()
                .eq('company_id', companyId)
                .eq('employee_id', userId);

            if (error) {
                console.error('[CompanyService] Error firing employee:', error);
                return { success: false, message: '❌ Error al despedir empleado.' };
            }

            return { success: true, message: '✅ Empleado despedido exitosamente.' };
        } catch (error) {
            console.error('[CompanyService] Exception firing employee:', error);
            return { success: false, message: '❌ Error al despedir empleado.' };
        }
    }

    /**
     * Update employee salary
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {string} userId - User ID
     * @param {number} newSalary - New salary amount
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async updateSalary(supabase, companyId, userId, newSalary) {
        try {
            // Validate salary
            const salaryValidation = ValidationHelper.validateAmount(newSalary, 1000, 10000000);
            if (!salaryValidation.valid) {
                return { success: false, message: salaryValidation.message };
            }

            const { error } = await supabase
                .from('company_employees')
                .update({ salary: newSalary })
                .eq('company_id', companyId)
                .eq('employee_id', userId);

            if (error) {
                console.error('[CompanyService] Error updating salary:', error);
                return { success: false, message: '❌ Error al actualizar salario.' };
            }

            return { success: true, message: '✅ Salario actualizado exitosamente.' };
        } catch (error) {
            console.error('[CompanyService] Exception updating salary:', error);
            return { success: false, message: '❌ Error al actualizar salario.' };
        }
    }

    /**
     * Deposit funds to company
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {number} amount - Amount to deposit
     * @returns {Promise<{success: boolean, message: string, newBalance?: number}>}
     */
    static async depositFunds(supabase, companyId, amount) {
        try {
            const company = await this.getCompanyById(supabase, companyId);
            if (!company) {
                return { success: false, message: '❌ Empresa no encontrada.' };
            }

            const newBalance = (company.balance || 0) + amount;

            const { error } = await supabase
                .from('companies')
                .update({ balance: newBalance })
                .eq('id', companyId);

            if (error) {
                console.error('[CompanyService] Error depositing funds:', error);
                return { success: false, message: '❌ Error al depositar fondos.' };
            }

            return {
                success: true,
                message: '✅ Fondos depositados exitosamente.',
                newBalance
            };
        } catch (error) {
            console.error('[CompanyService] Exception depositing funds:', error);
            return { success: false, message: '❌ Error al depositar fondos.' };
        }
    }

    /**
     * Withdraw funds from company
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {number} amount - Amount to withdraw
     * @returns {Promise<{success: boolean, message: string, newBalance?: number}>}
     */
    static async withdrawFunds(supabase, companyId, amount) {
        try {
            const company = await this.getCompanyById(supabase, companyId);
            if (!company) {
                return { success: false, message: '❌ Empresa no encontrada.' };
            }

            const currentBalance = company.balance || 0;
            if (currentBalance < amount) {
                return {
                    success: false,
                    message: `❌ Saldo insuficiente. Balance actual: ${EconomyHelper.formatMoney(currentBalance)}`
                };
            }

            const newBalance = currentBalance - amount;

            const { error } = await supabase
                .from('companies')
                .update({ balance: newBalance })
                .eq('id', companyId);

            if (error) {
                console.error('[CompanyService] Error withdrawing funds:', error);
                return { success: false, message: '❌ Error al retirar fondos.' };
            }

            return {
                success: true,
                message: '✅ Fondos retirados exitosamente.',
                newBalance
            };
        } catch (error) {
            console.error('[CompanyService] Exception withdrawing funds:', error);
            return { success: false, message: '❌ Error al retirar fondos.' };
        }
    }

    /**
     * Calculate total payroll for a company
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @returns {Promise<{total: number, count: number}>}
     */
    static async calculateTotalPayroll(supabase, companyId) {
        const employees = await this.getEmployees(supabase, companyId);

        const total = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

        return {
            total,
            count: employees.length
        };
    }

    /**
     * Format company information for display
     * @param {object} company - Company data
     * @param {Array} employees - Array of employees
     * @returns {EmbedBuilder} Formatted embed
     */
    static formatCompanyInfo(company, employees = []) {
        const payroll = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

        const embed = new EmbedBuilder()
            .setTitle(`🏢 ${company.name}`)
            .setColor('#FFD700')
            .addFields(
                { name: '💰 Balance', value: EconomyHelper.formatMoney(company.balance || 0), inline: true },
                { name: '👥 Empleados', value: `${employees.length}`, inline: true },
                { name: '💼 Nómina Total', value: EconomyHelper.formatMoney(payroll), inline: true },
                { name: '📊 Tipo', value: company.is_private ? 'Privada' : 'Pública', inline: true },
                { name: '🏷️ Sector', value: company.sector || 'No especificado', inline: true }
            )
            .setTimestamp();

        if (company.description) {
            embed.setDescription(company.description);
        }

        return embed;
    }

    /**
     * Get comprehensive company statistics
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @returns {Promise<object>} Company stats including employees, payroll, transactions
     */
    static async getCompanyStats(supabase, companyId) {
        try {
            // Get company data
            const company = await this.getCompanyById(supabase, companyId);
            if (!company) {
                return null;
            }

            // Get employees
            const { data: employees } = await supabase
                .from('company_employees')
                .select('user_id, role, salary, hired_at')
                .eq('company_id', companyId);

            // Calculate total monthly payroll
            const totalPayroll = employees?.reduce((sum, e) => sum + (e.salary || 0), 0) || 0;

            // Get recent transactions (last 5)
            const { data: transactions } = await supabase
                .from('money_history')
                .select('*')
                .or(`sender_id.eq.company_${companyId},receiver_id.eq.company_${companyId}`)
                .order('created_at', { ascending: false })
                .limit(5);

            return {
                company,
                employees: employees || [],
                employeeCount: employees?.length || 0,
                totalPayroll,
                transactions: transactions || []
            };
        } catch (error) {
            console.error('[CompanyService] Error getting company stats:', error);
            return null;
        }
    }

    /**
     * Generate financial report for a company
     * @param {object} supabase - Supabase client
     * @param {string} companyId - Company ID
     * @param {string} period - Report period ('monthly', 'yearly', 'all')
     * @returns {Promise<object>} Financial report data
     */
    static async generateFinancialReport(supabase, companyId, period) {
        try {
            const company = await this.getCompanyById(supabase, companyId);
            if (!company) {
                return null;
            }

            const now = new Date();
            let startDate = new Date(0); // All time default
            let periodLabel = 'Todo el tiempo';

            if (period === 'monthly') {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                periodLabel = 'Últimos 30 días';
            } else if (period === 'yearly') {
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                periodLabel = 'Últimos 365 días';
            }

            // Get transactions in period
            const { data: transactions } = await supabase
                .from('money_history')
                .select('*')
                .or(`sender_id.eq.company_${companyId},receiver_id.eq.company_${companyId}`)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false });

            // Calculate income and expenses
            let income = 0;
            let expenses = 0;
            const incomeTransactions = [];
            const expenseTransactions = [];

            if (transactions) {
                transactions.forEach(tx => {
                    const amount = Math.abs(tx.amount || 0);

                    if (tx.receiver_id === `company_${companyId}`) {
                        income += amount;
                        incomeTransactions.push(tx);
                    } else if (tx.sender_id === `company_${companyId}`) {
                        expenses += amount;
                        expenseTransactions.push(tx);
                    }
                });
            }

            // Get current employees and payroll
            const { data: employees } = await supabase
                .from('company_employees')
                .select('salary')
                .eq('company_id', companyId);

            const monthlyPayroll = employees?.reduce((sum, e) => sum + (e.salary || 0), 0) || 0;

            // Calculate estimated annual payroll if period is yearly or all
            let estimatedPayrollCost = 0;
            if (period === 'yearly') {
                estimatedPayrollCost = monthlyPayroll * 12;
            } else if (period === 'all') {
                // Estimate based on company age (rough calculation)
                const createdDate = new Date(company.created_at);
                const monthsOld = Math.ceil((now - createdDate) / (30 * 24 * 60 * 60 * 1000));
                estimatedPayrollCost = monthlyPayroll * Math.min(monthsOld, 12);
            } else {
                estimatedPayrollCost = monthlyPayroll;
            }

            const netIncome = income - expenses;

            return {
                company,
                period,
                periodLabel,
                income,
                expenses,
                netIncome,
                monthlyPayroll,
                estimatedPayrollCost,
                transactionCount: transactions?.length || 0,
                incomeTransactions: incomeTransactions.length,
                expenseTransactions: expenseTransactions.length,
                startDate,
                endDate: now
            };
        } catch (error) {
            console.error('[CompanyService] Error generating financial report:', error);
            return null;
        }
    }

    /**
     * Assign businessman role to user
     * @param {Guild} guild - Discord guild
     * @param {string} userId - Discord user ID
     */
    static async assignBusinessmanRole(guild, userId) {
        const BUSINESSMAN_ROLE_ID = '1412899397351510178';
        try {
            const member = await guild.members.fetch(userId);
            if (!member.roles.cache.has(BUSINESSMAN_ROLE_ID)) {
                await member.roles.add(BUSINESSMAN_ROLE_ID);
                console.log(`[CompanyService] Assigned businessman role to ${userId}`);
            }
        } catch (error) {
            console.error(`[CompanyService] Error assigning businessman role:`, error);
        }
    }

    /**
     * Remove businessman role from user if they have no companies
     * @param {Guild} guild - Discord guild
     * @param {string} userId - Discord user ID
     * @param {object} supabase - Supabase client
     */
    static async removeBusinessmanRole(guild, userId, supabase) {
        const BUSINESSMAN_ROLE_ID = '1412899397351510178';
        try {
            // Check if user has any remaining companies
            const { data: companies } = await supabase
                .from('companies')
                .select('id')
                .contains('owner_ids', [userId]);

            if (!companies || companies.length === 0) {
                const member = await guild.members.fetch(userId);
                if (member.roles.cache.has(BUSINESSMAN_ROLE_ID)) {
                    await member.roles.remove(BUSINESSMAN_ROLE_ID);
                    console.log(`[CompanyService] Removed businessman role from ${userId}`);
                }
            }
        } catch (error) {
            console.error(`[CompanyService] Error removing businessman role:`, error);
        }
    }
}

module.exports = CompanyService;

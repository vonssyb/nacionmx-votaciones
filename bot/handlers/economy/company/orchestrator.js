/**
 * @module handlers/economy/company/orchestrator
 * @description Orquestador central para el módulo de Gestión Empresarial
 * 
 * En ruta interacciones a los sub-handlers específicos:
 * - Vehicles (Compra de vehículos)
 * - Payroll (Nómina)
 * - Withdraw (Retiros)
 * - Debt (Pago de deudas)
 */

const CompanyVehicleHandler = require('./vehicles');
const CompanyPayrollHandler = require('./payroll');
const CompanyWithdrawHandler = require('./withdraw');
const CompanyDebtHandler = require('./debt');
// ManagementHandler is passed in constructor to avoid circular dependency or duplicate instantiation

class CompanyOrchestrator {
    constructor(client, supabase, paymentProcessor, billingService, managementHandler) {
        this.client = client;
        this.supabase = supabase;

        // Initialize sub-handlers
        this.vehicleHandler = new CompanyVehicleHandler(client, supabase, paymentProcessor);
        this.payrollHandler = new CompanyPayrollHandler(client, supabase, paymentProcessor, billingService);
        this.withdrawHandler = new CompanyWithdrawHandler(client, supabase, billingService);
        this.debtHandler = new CompanyDebtHandler(client, supabase, paymentProcessor);

        // Injected
        this.managementHandler = managementHandler;
    }

    /**
     * Dispatch interaction to the appropriate handler
     * @param {Interaction} interaction 
     * @returns {Promise<boolean>} True if handled, False otherwise
     */
    async handleInteraction(interaction) {
        if (!interaction.customId) return false;
        const cid = interaction.customId;

        // 1. Company Creation / Management
        if (this.managementHandler) {
            if (cid.startsWith('company_create_pay_')) {
                return await this.managementHandler.handleInteraction(interaction);
            }
        }

        // 2. Company Debt
        if (cid.startsWith('pay_biz_debt_')) {
            return await this.debtHandler.handleInteraction(interaction);
        }

        // 2. Company Vehicles
        if (cid.startsWith('company_addvehicle_') ||
            cid.startsWith('vehicle_select_') ||
            cid.startsWith('vehicle_pay_')) {
            return await this.vehicleHandler.handleInteraction(interaction);
        }

        // 3. Company Payroll
        if (cid.startsWith('company_payroll_') ||
            cid.startsWith('payroll_select_') ||
            cid.startsWith('payroll_pay_')) {
            return await this.payrollHandler.handleInteraction(interaction);
        }

        // 4. Company Withdraw
        if (cid.startsWith('company_withdraw_') ||
            cid.startsWith('withdraw_submit_')) {
            return await this.withdrawHandler.handleInteraction(interaction);
        }

        return false;
    }
}

module.exports = CompanyOrchestrator;

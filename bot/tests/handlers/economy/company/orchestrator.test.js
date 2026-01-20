/**
 * Tests for Company Orchestrator
 */

const CompanyOrchestrator = require('../../../../handlers/economy/company/orchestrator');

// Mock Sub-handlers
jest.mock('../../../../handlers/economy/company/vehicles');
jest.mock('../../../../handlers/economy/company/payroll');
jest.mock('../../../../handlers/economy/company/withdraw');
jest.mock('../../../../handlers/economy/company/debt');

const CompanyVehicleHandler = require('../../../../handlers/economy/company/vehicles');
const CompanyPayrollHandler = require('../../../../handlers/economy/company/payroll');
const CompanyWithdrawHandler = require('../../../../handlers/economy/company/withdraw');
const CompanyDebtHandler = require('../../../../handlers/economy/company/debt');

describe('Company Orchestrator', () => {
    let orchestrator;
    let mockClient, mockSupabase, mockPaymentProcessor, mockBillingService;
    let mockVehicleHandler, mockPayrollHandler, mockWithdrawHandler, mockDebtHandler;

    beforeEach(() => {
        mockClient = {};
        mockSupabase = {};
        mockPaymentProcessor = {};
        mockBillingService = {};

        // Reset mocks
        CompanyVehicleHandler.mockClear();
        CompanyPayrollHandler.mockClear();
        CompanyWithdrawHandler.mockClear();
        CompanyDebtHandler.mockClear();

        orchestrator = new CompanyOrchestrator(mockClient, mockSupabase, mockPaymentProcessor, mockBillingService);

        // Get instances
        mockVehicleHandler = CompanyVehicleHandler.mock.instances[0];
        mockVehicleHandler.handleInteraction = jest.fn().mockResolvedValue(true);

        mockPayrollHandler = CompanyPayrollHandler.mock.instances[0];
        mockPayrollHandler.handleInteraction = jest.fn().mockResolvedValue(true);

        mockWithdrawHandler = CompanyWithdrawHandler.mock.instances[0];
        mockWithdrawHandler.handleInteraction = jest.fn().mockResolvedValue(true);

        mockDebtHandler = CompanyDebtHandler.mock.instances[0];
        mockDebtHandler.handleInteraction = jest.fn().mockResolvedValue(true);
    });

    describe('handleInteraction', () => {
        it('should route vehicle interactions', async () => {
            const interaction = { customId: 'company_addvehicle_123' };
            await orchestrator.handleInteraction(interaction);
            expect(mockVehicleHandler.handleInteraction).toHaveBeenCalledWith(interaction);
            expect(mockPayrollHandler.handleInteraction).not.toHaveBeenCalled();
        });

        it('should route payroll interactions', async () => {
            const interaction = { customId: 'company_payroll_123' };
            await orchestrator.handleInteraction(interaction);
            expect(mockPayrollHandler.handleInteraction).toHaveBeenCalledWith(interaction);
        });

        it('should route withdraw interactions', async () => {
            const interaction = { customId: 'company_withdraw_123' };
            await orchestrator.handleInteraction(interaction);
            expect(mockWithdrawHandler.handleInteraction).toHaveBeenCalledWith(interaction);
        });

        it('should route debt interactions', async () => {
            const interaction = { customId: 'pay_biz_debt_123' };
            await orchestrator.handleInteraction(interaction);
            expect(mockDebtHandler.handleInteraction).toHaveBeenCalledWith(interaction);
        });

        it('should return false for unknown interaction', async () => {
            const interaction = { customId: 'unknown_btn' };
            const result = await orchestrator.handleInteraction(interaction);
            expect(result).toBe(false);
            expect(mockVehicleHandler.handleInteraction).not.toHaveBeenCalled();
        });

        it('should return false if no customId', async () => {
            const interaction = {};
            const result = await orchestrator.handleInteraction(interaction);
            expect(result).toBe(false);
        });
    });
});

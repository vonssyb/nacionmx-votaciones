/**
 * Tests for Company Management Handler
 */

const CompanyManagementHandler = require('../../../../handlers/economy/company/management');
const { EmbedBuilder } = require('discord.js');

// Mocks
const mockClient = {
    guilds: {
        cache: {
            get: jest.fn()
        }
    }
};

const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn()
};

const mockPaymentProcessor = {
    processPayment: jest.fn()
};

const mockBillingService = {};

const mockStateManager = {
    setPendingAction: jest.fn(),
    getPendingAction: jest.fn(),
    deletePendingAction: jest.fn()
};

const mockInteraction = {
    user: { id: 'user123' },
    guildId: 'guild123',
    guild: {
        members: {
            fetch: jest.fn()
        },
        roles: {
            cache: {
                find: jest.fn(),
                some: jest.fn()
            }
        }
    },
    options: {
        getString: jest.fn(),
        getUser: jest.fn(),
        getAttachment: jest.fn(),
        getBoolean: jest.fn()
    },
    followUp: jest.fn(),
    editReply: jest.fn(),
    reply: jest.fn(),
    deferReply: jest.fn(),
    isButton: jest.fn().mockReturnValue(true),
    customId: 'company_create_pay_cash_session123'
};

describe('Company Management Handler', () => {
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        handler = new CompanyManagementHandler(mockClient, mockSupabase, mockPaymentProcessor, mockBillingService, mockStateManager);

        // Setup base mocks
        mockSupabase.from.mockReturnThis();
        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockReturnThis();

        mockInteraction.options.getString.mockImplementation((key) => {
            if (key === 'nombre') return 'Test Corp';
            if (key === 'tipo_local') return 'pequeño';
            return null;
        });
        mockInteraction.options.getUser.mockReturnValue({ id: 'user123' });

        mockInteraction.guild.members.fetch.mockResolvedValue({
            roles: { cache: { some: jest.fn().mockReturnValue(false) } } // No discount
        });
    });

    describe('handleCreateCommand', () => {
        it('should validate unique name and show payment buttons', async () => {
            // Mock no existing company
            mockSupabase.maybeSingle.mockResolvedValue({ data: null });

            // Mock state storage success
            mockStateManager.setPendingAction.mockResolvedValue(true);

            await handler.handleCreateCommand(mockInteraction);

            expect(mockSupabase.from).toHaveBeenCalledWith('companies');
            expect(mockStateManager.setPendingAction).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'company_create', data: expect.objectContaining({ name: 'Test Corp' }) }),
                600
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
                components: expect.arrayContaining([expect.anything()]) // ActionRow
            }));
        });

        it('should limit duplicate names', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({ data: { id: 'existing' } });

            await handler.handleCreateCommand(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Ya existe') }));
        });
    });

    describe('handleCreationPayment', () => {
        beforeEach(() => {
            // Mock retrieval of state
            mockStateManager.getPendingAction.mockResolvedValue({
                data: {
                    type: 'company_create',
                    data: {
                        name: 'Test Corp',
                        owner_id: 'user123',
                        totalCost: 1000000
                    }
                }
            });
        });

        it('should process payment and create company', async () => {
            mockPaymentProcessor.processPayment.mockResolvedValue({ success: true, transactionId: 'tx123' });
            mockSupabase.insert.mockReturnThis();
            mockSupabase.single.mockResolvedValue({ data: { id: 'comp123', name: 'Test Corp' }, error: null });

            await handler.handleCreationPayment(mockInteraction);

            expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith('cash', 'user123', 'guild123', 1000000, expect.any(String));
            expect(mockSupabase.from).toHaveBeenCalledWith('companies');
            expect(mockSupabase.insert).toHaveBeenCalled();
            expect(mockStateManager.deletePendingAction).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
        });

        it('should handle failed payment', async () => {
            mockPaymentProcessor.processPayment.mockResolvedValue({ success: false, error: 'No funds' });

            await handler.handleCreationPayment(mockInteraction);

            expect(mockSupabase.insert).not.toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Fallido') }));
        });

        it('should handle expired session', async () => {
            mockStateManager.getPendingAction.mockResolvedValue(null);

            await handler.handleCreationPayment(mockInteraction);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('expirado') }));
        });
    });
});

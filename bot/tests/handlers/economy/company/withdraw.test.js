/**
 * Tests for Company Withdraw Handler
 */

const CompanyWithdrawHandler = require('../../../../handlers/economy/company/withdraw');

// Mock discord.js items
jest.mock('discord.js', () => {
    const mockBuilder = () => ({
        setCustomId: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        setRequired: jest.fn().mockReturnThis(),
        setMinLength: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
    });
    return {
        ModalBuilder: jest.fn().mockImplementation(mockBuilder),
        TextInputBuilder: jest.fn().mockImplementation(mockBuilder),
        ActionRowBuilder: jest.fn().mockImplementation(mockBuilder),
        EmbedBuilder: jest.fn().mockImplementation(mockBuilder),
        TextInputStyle: { Short: 1 }
    };
});

describe('Company Withdraw Handler', () => {
    let handler;
    let mockClient;
    let mockSupabase;
    let mockBillingService;
    let mockQueryBuilder;

    beforeEach(() => {
        // Mock Query Builder
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            then: function (resolve) {
                resolve({ data: {}, error: null });
            }
        };

        mockSupabase = {
            from: jest.fn().mockReturnValue(mockQueryBuilder)
        };

        mockBillingService = {
            addMoney: jest.fn()
        };

        mockClient = {};

        handler = new CompanyWithdrawHandler(mockClient, mockSupabase, mockBillingService);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.guildId = 'guild123';
            mockInteraction.user = { id: 'user123' };
            // Default fields helper for Modal submit
            mockInteraction.fields = {
                getTextInputValue: jest.fn()
            };
            mockInteraction.showModal = jest.fn();
            mockInteraction.deferReply = jest.fn();
        });

        test('should ignore irrelevant interactions', async () => {
            mockInteraction.customId = 'other';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.isModalSubmit = jest.fn().mockReturnValue(false);
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        describe('Step 1: Show Modal (company_withdraw_)', () => {
            beforeEach(() => {
                mockInteraction.customId = 'company_withdraw_comp123';
                mockInteraction.isButton = jest.fn().mockReturnValue(true);
            });

            it('should show modal if company has funds', async () => {
                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Rich Corp', balance: 50000 },
                    error: null
                });

                const result = await handler.handleInteraction(mockInteraction);

                expect(result).toBe(true);
                expect(mockInteraction.showModal).toHaveBeenCalled();
            });

            it('should error if balance is 0', async () => {
                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Poor Corp', balance: 0 },
                    error: null
                });

                const result = await handler.handleInteraction(mockInteraction);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({ content: expect.stringContaining('Sin fondos') })
                );
                expect(mockInteraction.showModal).not.toHaveBeenCalled();
            });
        });

        describe('Step 2: Process Withdraw (withdraw_submit_)', () => {
            beforeEach(() => {
                mockInteraction.customId = 'withdraw_submit_comp123';
                mockInteraction.isModalSubmit = jest.fn().mockReturnValue(true);
                mockInteraction.isButton = jest.fn().mockReturnValue(false);
            });

            it('should process valid withdrawal', async () => {
                // Input: 1000
                mockInteraction.fields.getTextInputValue.mockReturnValue('1000');

                // Company Balance: 5000
                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Rich Corp', balance: 5000 },
                    error: null
                });

                const result = await handler.handleInteraction(mockInteraction);

                expect(result).toBe(true);
                expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });

                // 1. Check deduction
                // New Balance: 5000 - 1000 = 4000
                expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                    expect.objectContaining({ balance: 4000 })
                );

                // 2. Check User Credit (BillingService)
                // Tax: 10% of 1000 = 100
                // Net: 900
                expect(mockBillingService.addMoney).toHaveBeenCalledWith(
                    'guild123',
                    'user123',
                    900,
                    expect.stringContaining('Retiro de Rich Corp'),
                    'cash'
                );

                // 3. Success Embed
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });

            it('should reject invalid amount', async () => {
                mockInteraction.fields.getTextInputValue.mockReturnValue('-50');

                const result = await handler.handleInteraction(mockInteraction);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({ content: expect.stringContaining('inválido') })
                );
                expect(mockQueryBuilder.update).not.toHaveBeenCalled();
            });

            it('should reject insufficient funds', async () => {
                mockInteraction.fields.getTextInputValue.mockReturnValue('10000');

                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Rich Corp', balance: 5000 },
                    error: null
                });

                await handler.handleInteraction(mockInteraction);

                expect(mockInteraction.editReply).toHaveBeenCalled();
            });
        });

    });
});

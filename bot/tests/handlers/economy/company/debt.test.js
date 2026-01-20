/**
 * Tests for Company Debt Handler
 */

const CompanyDebtHandler = require('../../../../handlers/economy/company/debt');

describe('Company Debt Handler', () => {
    let handler;
    let mockClient;
    let mockSupabase;
    let mockPaymentProcessor;
    let mockQueryBuilder;

    beforeEach(() => {
        // Mock Query Builder with Thenable support
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            // Default success for chained calls like .update().eq()
            then: function (resolve) {
                resolve({ data: {}, error: null });
            }
        };

        mockSupabase = {
            from: jest.fn().mockReturnValue(mockQueryBuilder)
        };

        mockPaymentProcessor = {
            processPayment: jest.fn()
        };

        mockClient = {};

        handler = new CompanyDebtHandler(mockClient, mockSupabase, mockPaymentProcessor);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'pay_biz_debt_bank_card123_2000';
            mockInteraction.guildId = 'guild123';
            mockInteraction.user = { id: 'user123' };
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
        });

        it('should ignore invalid buttons', async () => {
            mockInteraction.customId = 'other_btn';
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        it('should validate button format length', async () => {
            mockInteraction.customId = 'pay_biz_debt_broken';
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        it('should handle card not found', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: new Error('Not found')
            });

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no encontrada') })
            );
        });

        it('should handle payment failure', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: {
                    id: 'card123',
                    companies: { name: 'Test Corp' },
                    current_balance: 5000
                }
            });

            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: false,
                error: 'Insufficient funds'
            });

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Error en el pago') })
            );
        });

        it('should handle successful debt payment', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: {
                    id: 'card123',
                    card_name: 'Platinum',
                    companies: { name: 'Test Corp' },
                    current_balance: 5000
                }
            });

            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                methodName: 'Banco',
                transactionId: 'TX-123'
            });

            // Mock update success (default then behavior)

            await handler.handleInteraction(mockInteraction);

            // 1. Check Charge
            expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith(
                'bank',
                'user123',
                'guild123',
                2000,
                expect.stringContaining('Pago deuda empresarial')
            );

            // 2. Check DB Update
            // .update({ current_balance: 3000, ... })
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({ current_balance: 3000 })
            );

            // 3. Success Embed
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        it('should handle database update error after payment', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: {
                    id: 'card123',
                    companies: { name: 'Test Corp' },
                    current_balance: 5000
                }
            });

            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                transactionId: 'TX-123'
            });

            // Force update failure
            mockQueryBuilder.then = function (resolve, reject) {
                resolve({ data: null, error: new Error('DB Update Fail') });
            };

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('hubo un error actualizando la deuda') })
            );
        });
    });
});

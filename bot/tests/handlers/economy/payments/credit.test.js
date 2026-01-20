/**
 * Tests for Credit Payment Handler
 */

const CreditPaymentHandler = require('../../../../handlers/economy/payments/credit');

describe('Credit Payment Handler', () => {
    let handler;
    let mockClient;
    let mockSupabase;
    let mockPaymentProcessor;
    let mockQueryBuilder;

    beforeEach(() => {
        // Mock Query Builder
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
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

        handler = new CreditPaymentHandler(mockClient, mockSupabase, mockPaymentProcessor);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'cred_pay_cash_500_card999';
            mockInteraction.guildId = 'guild123';
            mockInteraction.user = { id: 'user123' };
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
        });

        it('should return false for invalid buttons', async () => {
            mockInteraction.customId = 'other_btn';
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
                data: { id: 'card999', current_balance: 1000, card_type: 'Gold' }
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

        it('should handle successful credit payment', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'card999', current_balance: 1000, card_type: 'Gold' }
            });

            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                methodName: 'Efectivo',
                transactionId: 'TX-999'
            });

            await handler.handleInteraction(mockInteraction);

            // 1. Check processor call
            expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith(
                'cash',
                'user123',
                'guild123',
                500,
                expect.stringContaining('Pago Tarjeta: Gold')
            );

            // 2. Check Balance Update
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({ current_balance: 500 }) // 1000 - 500
            );

            // 3. Check History Insert
            expect(mockSupabase.from).toHaveBeenCalledWith('credit_card_payments');
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        card_id: 'card999',
                        amount: 500
                    })
                ])
            );

            // 4. Success Response
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );
        });

        it('should handle db update error after payment', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'card999', current_balance: 1000, card_type: 'Gold' }
            });

            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true
            });

            // Mock update fail through 'then'
            mockQueryBuilder.then = function (resolve, reject) {
                // Check if it's the UPDATE call by context or return generic error
                // Simple way: if this is used by all, it fails all.
                // Ideally we target the update call.
                // We can spy on calls, but to change return val dynamically is tricky with this simple mock.
                // Let's assume the update call returns error.
                resolve({ error: new Error('DB Error') });
            };

            // Re-setup single for the first call (since 'then' above overrides it if chained, 
            // but single is usually a Promise directly in this mock pattern or returns Thenable).
            // Actually in our mock `single: jest.fn()` returns undefined by default, so we resolvedValue above.
            // But if `single` returns a Promise, `then` isn't called on the builder for `single`.
            // Wait, the code is: .select()...single(). 
            // And update code is: .update()...eq() (thenable).

            // To make `single` work we need it to return a Promise that resolves data.
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'card999', current_balance: 1000, card_type: 'Gold' }
            });

            await handler.handleInteraction(mockInteraction);

            // The handler calls `await this.supabase...eq()` which triggers `then`.
            // So the update will fail.

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('error actualizando saldo') })
            );
        });
    });
});

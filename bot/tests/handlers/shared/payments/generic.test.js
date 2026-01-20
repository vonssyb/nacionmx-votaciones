/**
 * Tests for Generic Payment Handler
 */

const GenericPaymentHandler = require('../../../../handlers/shared/payments/generic');

describe('Generic Payment Handler', () => {
    let handler;
    let mockSupabase;
    let mockPaymentProcessor;
    let mockQueryBuilder;

    beforeEach(() => {
        // Create manual mock for query builder
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            maybeSingle: jest.fn(),
            // Make it Thenable to support await .update().eq()
            then: function (resolve, reject) {
                // Default resolution
                resolve({ data: {}, error: null });
            }
        };

        mockSupabase = {
            from: jest.fn().mockReturnValue(mockQueryBuilder)
        };

        mockPaymentProcessor = {
            processPayment: jest.fn()
        };

        handler = new GenericPaymentHandler(mockSupabase, mockPaymentProcessor);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'pay_cash_1000_comp123';
            mockInteraction.guildId = 'guild123';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.message = {
                embeds: [{
                    fields: [{ name: '🧾 Concepto', value: 'Test Service' }]
                }]
            };
        });

        it('should return false for non-payment buttons', async () => {
            mockInteraction.customId = 'other_button';
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        it('should handle cancellation', async () => {
            mockInteraction.customId = 'pay_cancel_0_0';

            const result = await handler.handleInteraction(mockInteraction);

            expect(result).toBe(true);
            expect(mockInteraction.update).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('cancelado') })
            );
        });

        it('should validate inputs', async () => {
            mockInteraction.customId = 'pay_cash_invalid_comp123';

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('inválido') })
            );
        });

        it('should handle company not found', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: new Error('Not found')
            });

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no encontrada') })
            );
        });

        it('should handle payment failure (e.g. insufficient funds)', async () => {
            // Mock company found
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'comp123', name: 'Test Corp', balance: 0 },
                error: null
            });

            // Mock payment failure
            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: false,
                error: 'Insufficient funds'
            });

            await handler.handleInteraction(mockInteraction);

            expect(mockPaymentProcessor.processPayment).toHaveBeenCalled();
            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Error en el pago') })
            );
        });

        it('should handle successful payment', async () => {
            // Mock company found
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'comp123', name: 'Test Corp', balance: 500 },
                error: null
            });

            // Mock payment success
            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                transactionId: 'TX-123',
                methodName: 'Efectivo'
            });

            // Mock company update success (default .then behavior is success)

            await handler.handleInteraction(mockInteraction);

            // Verify charge with Guild ID
            expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith(
                'cash',
                'test-user-id',
                'guild123',
                1000,
                expect.stringContaining('Pago a Test Corp')
            );

            // Verify credit attempted
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({
                balance: 1500
            });

            // Verify success response
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Pago Exitoso') })
            );
        });

        it('should handle critical error during company update', async () => {
            // Mock company found
            mockQueryBuilder.single.mockResolvedValue({
                data: { id: 'comp123', name: 'Test Corp', balance: 0 },
                error: null
            });

            // Mock payment success
            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                transactionId: 'TX-123'
            });

            // Mock company update failure
            // Override 'then' to resolve with error
            mockQueryBuilder.then = function (resolve, reject) {
                resolve({ data: null, error: new Error('DB Error') });
            };

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Advertencia') })
            );
        });
    });
});

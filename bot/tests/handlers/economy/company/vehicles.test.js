/**
 * Tests for Company Vehicle Handler
 */

const CompanyVehicleHandler = require('../../../../handlers/economy/company/vehicles');

// Manual mock for discord.js builders to support chaining
jest.mock('discord.js', () => {
    const mockBuilder = () => ({
        setCustomId: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        addOptions: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis()
    });
    return {
        ActionRowBuilder: jest.fn().mockImplementation(mockBuilder),
        StringSelectMenuBuilder: jest.fn().mockImplementation(mockBuilder),
        EmbedBuilder: jest.fn().mockImplementation(mockBuilder),
        ButtonBuilder: jest.fn().mockImplementation(mockBuilder),
        ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 }
    };
});

describe('Company Vehicle Handler', () => {
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
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            // Thenable support for await chains
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

        handler = new CompanyVehicleHandler(mockClient, mockSupabase, mockPaymentProcessor);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.guildId = 'guild123';
            mockInteraction.user = { id: 'user123' };
        });

        test('should ignore irrelevant interactions', async () => {
            mockInteraction.customId = 'other_btn';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.isStringSelectMenu = jest.fn().mockReturnValue(false);
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        describe('Step 1: Start Selection (company_addvehicle_)', () => {
            beforeEach(() => {
                mockInteraction.customId = 'company_addvehicle_comp123';
                mockInteraction.isButton = jest.fn().mockReturnValue(true);
            });

            it('should show vehicle selection menu', async () => {
                const result = await handler.handleInteraction(mockInteraction);

                expect(result).toBe(true);
                expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });
        });

        describe('Step 2: Type Selection (vehicle_select_)', () => {
            beforeEach(() => {
                mockInteraction.customId = 'vehicle_select_comp123';
                mockInteraction.isStringSelectMenu = jest.fn().mockReturnValue(true);
                mockInteraction.isButton = jest.fn().mockReturnValue(false);
                mockInteraction.values = ['sedan'];
            });

            it('should show payment options', async () => {
                const result = await handler.handleInteraction(mockInteraction);

                expect(result).toBe(true);
                expect(mockInteraction.deferUpdate).toHaveBeenCalled();

                // Expect Embed with cost
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });
        });

        describe('Step 3: Payment (vehicle_pay_)', () => {
            beforeEach(() => {
                // vehicle_pay_METHOD_TYPE_ID_COST
                mockInteraction.customId = 'vehicle_pay_cash_sedan_comp123_150000';
                mockInteraction.isButton = jest.fn().mockReturnValue(true);
            });

            it('should handle payment and update vehicle count', async () => {
                // Setup mock for company fetch
                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Test Corp', vehicle_count: 5 },
                    error: null
                });

                // Setup mock payment success
                mockPaymentProcessor.processPayment.mockResolvedValue({
                    success: true,
                    methodName: 'Efectivo',
                    transactionId: 'TX-VEH-1'
                });

                const result = await handler.handleInteraction(mockInteraction);

                expect(result).toBe(true);

                // 1. Check Payment Call
                expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith(
                    'cash',
                    'user123',
                    'guild123',
                    150000,
                    expect.stringContaining('Compra Vehículo Empresa')
                );

                // 2. Check DB Update
                expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                    expect.objectContaining({ vehicle_count: 6 }) // 5 + 1
                );

                // 3. Check Success Response
                // 3. Check Success Response
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });

            it('should handle payment failure', async () => {
                mockPaymentProcessor.processPayment.mockResolvedValue({
                    success: false,
                    error: 'Insufficient funds'
                });

                await handler.handleInteraction(mockInteraction);

                expect(mockInteraction.followUp).toHaveBeenCalledWith(
                    expect.objectContaining({ content: expect.stringContaining('Error en el pago') })
                );
                // DB should not be updated
                expect(mockQueryBuilder.update).not.toHaveBeenCalled();
            });

            it('should handle DB error after payment', async () => {
                // Setup mock for company fetch
                mockQueryBuilder.single.mockResolvedValue({
                    data: { id: 'comp123', name: 'Test Corp', vehicle_count: 5 },
                    error: null
                });

                mockPaymentProcessor.processPayment.mockResolvedValue({
                    success: true
                });

                // Fail the update
                // The update call is the second call to supabase (first is select)
                // We'll use mockImplementationOnce for select, then the queryBuilder "then" for update?
                // Or just override "then" dynamically??

                // Cleaner way:
                // select() -> returns builder. single() -> resolves data.
                // update() -> returns builder. then() -> resolves/rejects.

                mockQueryBuilder.update.mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        then: (resolve) => resolve({ error: new Error('DB Update Failed') })
                    })
                });

                await handler.handleInteraction(mockInteraction);

                expect(mockInteraction.followUp).toHaveBeenCalledWith(
                    expect.objectContaining({ content: expect.stringContaining('error al actualizar contador') })
                );
            });
        });
    });
});

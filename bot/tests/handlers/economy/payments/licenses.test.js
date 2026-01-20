/**
 * Tests for License Payment Handler
 */

const LicensePaymentHandler = require('../../../../handlers/economy/payments/licenses');

describe('License Payment Handler', () => {
    let handler;
    let mockClient;
    let mockSupabase;
    let mockPaymentProcessor;
    let mockGuild;
    let mockMember;
    let mockRole;
    let mockLogChannel;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();

        mockPaymentProcessor = {
            processPayment: jest.fn()
        };

        // Complete Mock Guild Structure
        mockRole = { id: 'role123', name: 'Licencia Armas' };
        mockLogChannel = { send: jest.fn().mockResolvedValue({}) };

        mockMember = {
            id: 'target123',
            user: { id: 'target123', tag: 'Citizen#0001', send: jest.fn().mockResolvedValue({}) },
            send: jest.fn().mockResolvedValue({}),
            roles: {
                cache: new Map(),
                add: jest.fn().mockResolvedValue({})
            }
        };

        mockGuild = {
            members: {
                fetch: jest.fn().mockResolvedValue(mockMember)
            },
            roles: {
                cache: new Map([['role123', mockRole]]),
                get: jest.fn().mockReturnValue(mockRole)
            },
            channels: {
                cache: new Map([
                    ['1450262813548482665', mockLogChannel] // LOG_LICENCIAS ID match
                ]),
                get: jest.fn().mockReturnValue(mockLogChannel)
            }
        };

        mockClient = {};

        handler = new LicensePaymentHandler(mockClient, mockSupabase, mockPaymentProcessor);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'license_pay_cash_5000_role123_target123';
            mockInteraction.guild = mockGuild;
            mockInteraction.guildId = 'guild123';
            mockInteraction.user = { id: 'buyer123', tag: 'Buyer#0001' };
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
        });

        it('should ignore non-license buttons', async () => {
            mockInteraction.customId = 'other_btn';
            const result = await handler.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        it('should verify target member exists', async () => {
            mockGuild.members.fetch.mockRejectedValueOnce(new Error('Unknown Member'));

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('no se encuentra') })
            );
        });

        it('should prevent double licensing (already has role)', async () => {
            mockMember.roles.cache.set('role123', mockRole);

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('ya tiene esta licencia') })
            );
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
        });

        it('should handle successful flow (payment + role + log + dm)', async () => {
            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true,
                methodName: 'Efectivo'
            });

            await handler.handleInteraction(mockInteraction);

            // 1. Payment
            expect(mockPaymentProcessor.processPayment).toHaveBeenCalledWith(
                'cash',
                'buyer123',
                'guild123',
                5000,
                expect.stringContaining('Licencia: Licencia Armas')
            );

            // 2. Role Add
            expect(mockMember.roles.add).toHaveBeenCalledWith('role123');

            // 3. Response
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) })
            );

            // 4. Log Channel (indirectly via _logLicense)
            // Need to verify if _logLicense found the channel.
            // The handler fetches channel from guild.channels.cache
            // Since we mocked the cache with the ID map, it should work.
            expect(mockLogChannel.send).toHaveBeenCalled();

            // 5. DM User
            expect(mockMember.send).toHaveBeenCalled();
        });

        it('should handle role assignment failure', async () => {
            mockPaymentProcessor.processPayment.mockResolvedValue({
                success: true
            });
            mockMember.roles.add.mockRejectedValue(new Error('Discord API Error'));

            await handler.handleInteraction(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('error asignando el rol') })
            );
            // Should still log error internally (logger mocked globally or in implementation)
        });
    });
});

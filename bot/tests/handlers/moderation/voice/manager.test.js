/**
 * Tests for Voice Manager
 */

const VoiceManager = require('../../../../handlers/moderation/voice/manager');
const VoiceEmbeds = require('../../../../utils/voiceEmbeds');

jest.mock('../../../../utils/voiceEmbeds', () => ({
    createControlPanel: jest.fn().mockReturnValue({}),
    createControlComponents: jest.fn().mockReturnValue([]),
    createUserSelectMenu: jest.fn(),
    createStatsEmbed: jest.fn(),
    createChannelInfoEmbed: jest.fn()
}));

describe('Voice Manager', () => {
    let manager;
    let mockClient;
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
        mockClient = {
            tempChannelManager: null,
            voicePermissionManager: null,
            voiceActivityHandler: null
        };
        manager = new VoiceManager(mockClient, mockSupabase);
    });

    describe('handleInteraction', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'vc_refresh';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.member = {
                id: 'user123',
                voice: {
                    channelId: 'channel123',
                    channel: {
                        id: 'channel123',
                        name: 'General',
                        members: new Map(),
                        permissionOverwrites: { cache: new Map() }
                    }
                },
                permissions: {
                    has: jest.fn().mockReturnValue(true)
                }
            };
            mockInteraction.update = jest.fn().mockResolvedValue({});
        });

        it('should return false for non-voice buttons', async () => {
            mockInteraction.customId = 'other_button';
            const result = await manager.handleInteraction(mockInteraction);
            expect(result).toBe(false);
        });

        it('should reject if user not in voice channel', async () => {
            mockInteraction.member.voice.channelId = null;

            const result = await manager.handleInteraction(mockInteraction);

            expect(result).toBe(true);
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Debes estar en un canal de voz')
                })
            );
        });

        it('should handle refresh button', async () => {
            mockInteraction.customId = 'vc_refresh';

            const result = await manager.handleInteraction(mockInteraction);

            expect(result).toBe(true);
            expect(mockInteraction.update).toHaveBeenCalled();
        });

        it('should handle invite button', async () => {
            mockInteraction.customId = 'vc_invite';
            mockInteraction.guild = {
                members: {
                    cache: new Map([
                        ['user1', { id: 'user1', user: { bot: false }, voice: { channelId: null } }]
                    ])
                }
            };

            await manager.handleInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalled();
        });

        it('should handle stats button when no handler available', async () => {
            mockInteraction.customId = 'vc_stats';

            await manager.handleInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('no está disponible')
                })
            );
        });

        it('should handle unknown voice button', async () => {
            mockInteraction.customId = 'vc_unknown';

            const result = await manager.handleInteraction(mockInteraction);

            expect(result).toBe(false);
        });
    });

    describe('Permission Checks', () => {
        it('should check permissions via voicePermissionManager if available', async () => {
            mockClient.voicePermissionManager = {
                canModerateChannel: jest.fn().mockResolvedValue({ allowed: true })
            };

            const mockMember = { id: 'user123', permissions: { has: jest.fn() } };
            const mockChannel = { id: 'channel123' };

            const result = await manager._canModerate(mockMember, mockChannel);

            expect(result).toBe(true);
            expect(mockClient.voicePermissionManager.canModerateChannel).toHaveBeenCalled();
        });

        it('should fallback to Discord permissions if no manager', async () => {
            const mockMember = {
                id: 'user123',
                permissions: { has: jest.fn().mockReturnValue(true) }
            };
            const mockChannel = { id: 'channel123' };

            const result = await manager._canModerate(mockMember, mockChannel);

            expect(result).toBe(true);
            expect(mockMember.permissions.has).toHaveBeenCalled();
        });
    });
});

/**
 * Tests for Mission Claim Handler
 */

const MissionClaimHandler = require('../../../../handlers/economy/missions/claim');

describe('Mission Claim Handler', () => {
    let handler;
    let mockSupabase;
    let mockMissionService;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
        mockMissionService = {
            claimRewards: jest.fn(),
            initializeDailyMissions: jest.fn(),
            updateProgress: jest.fn()
        };
        handler = new MissionClaimHandler(mockSupabase, mockMissionService);
    });

    describe('handleInteraction', () => {
        let mockInteraction;
        let mockClient;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'claim_mission_123';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockClient = {};
        });

        it('should return false for non-mission buttons', async () => {
            mockInteraction.customId = 'other_button';
            const result = await handler.handleInteraction(mockInteraction, mockClient);
            expect(result).toBe(false);
        });

        it('should handle successful claim', async () => {
            mockMissionService.claimRewards.mockResolvedValue({
                success: true,
                mission: { name: 'Daily Quest' },
                rewards: { xp: 100, money: 500 }
            });

            const result = await handler.handleInteraction(mockInteraction, mockClient);

            expect(result).toBe(true);
            expect(mockMissionService.claimRewards).toHaveBeenCalledWith('test-user-id', '123');
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        it('should handle failed claim', async () => {
            mockMissionService.claimRewards.mockResolvedValue({
                success: false,
                error: 'Mission not completed'
            });

            const result = await handler.handleInteraction(mockInteraction, mockClient);

            expect(result).toBe(true);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('Error al reclamar')
            );
        });

        it('should parse mission ID correctly', async () => {
            mockInteraction.customId = 'claim_mission_abc-def-123';
            mockMissionService.claimRewards.mockResolvedValue({
                success: true,
                mission: { name: 'Test' },
                rewards: { xp: 50 }
            });

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockMissionService.claimRewards).toHaveBeenCalledWith(
                'test-user-id',
                'abc-def-123'
            );
        });
    });

    describe('getActiveMissions', () => {
        it('should return active missions', async () => {
            const mockMissions = [
                { id: '1', status: 'active', mission: { name: 'Quest 1' } },
                { id: '2', status: 'active', mission: { name: 'Quest 2' } }
            ];

            mockSupabase.from().select().eq().eq().gte.mockResolvedValue({
                data: mockMissions,
                error: null
            });

            const result = await handler.getActiveMissions('user123');

            expect(result).toHaveLength(2);
            expect(result[0].mission.name).toBe('Quest 1');
        });

        it('should return empty array on error', async () => {
            mockSupabase.from().select().eq().eq().gte.mockResolvedValue({
                data: null,
                error: new Error('DB error')
            });

            const result = await handler.getActiveMissions('user123');

            expect(result).toEqual([]);
        });
    });

    describe('getCompletedMissions', () => {
        it('should return completed missions', async () => {
            const mockMissions = [
                { id: '1', status: 'completed', mission: { name: 'Quest 1' } },
                { id: '2', status: 'claimed', mission: { name: 'Quest 2' } }
            ];

            mockSupabase.from().select().eq().in().order().limit.mockResolvedValue({
                data: mockMissions,
                error: null
            });

            const result = await handler.getCompletedMissions('user123');

            expect(result).toHaveLength(2);
        });
    });

    describe('canClaimMission', () => {
        it('should allow claim for completed mission', async () => {
            mockSupabase.from().select().eq().eq().single.mockResolvedValue({
                data: {
                    status: 'completed',
                    expires_at: new Date(Date.now() + 10000).toISOString(),
                    mission: { name: 'Test' }
                },
                error: null
            });

            const result = await handler.canClaimMission('user123', 'mission1');

            expect(result.canClaim).toBe(true);
            expect(result.mission).toBeDefined();
        });

        it('should reject already claimed mission', async () => {
            mockSupabase.from().select().eq().eq().single.mockResolvedValue({
                data: {
                    status: 'claimed',
                    expires_at: new Date(Date.now() + 10000).toISOString()
                },
                error: null
            });

            const result = await handler.canClaimMission('user123', 'mission1');

            expect(result.canClaim).toBe(false);
            expect(result.reason).toContain('Ya reclamaste');
        });

        it('should reject uncompleted mission', async () => {
            mockSupabase.from().select().eq().eq().single.mockResolvedValue({
                data: {
                    status: 'active',
                    expires_at: new Date(Date.now() + 10000).toISOString()
                },
                error: null
            });

            const result = await handler.canClaimMission('user123', 'mission1');

            expect(result.canClaim).toBe(false);
            expect(result.reason).toContain('no completada');
        });

        it('should reject expired mission', async () => {
            mockSupabase.from().select().eq().eq().single.mockResolvedValue({
                data: {
                    status: 'completed',
                    expires_at: new Date(Date.now() - 10000).toISOString() // Expired
                },
                error: null
            });

            const result = await handler.canClaimMission('user123', 'mission1');

            expect(result.canClaim).toBe(false);
            expect(result.reason).toContain('expirada');
        });

        it('should reject if mission not found', async () => {
            mockSupabase.from().select().eq().eq().single.mockResolvedValue({
                data: null,
                error: new Error('Not found')
            });

            const result = await handler.canClaimMission('user123', 'mission1');

            expect(result.canClaim).toBe(false);
            expect(result.reason).toContain('no encontrada');
        });
    });

    describe('Success Messages', () => {
        it('should format rewards with XP and money', async () => {
            mockMissionService.claimRewards.mockResolvedValue({
                success: true,
                mission: { name: 'Daily Quest' },
                rewards: { xp: 100, money: 500 }
            });

            const mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'claim_mission_123';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);

            await handler.handleInteraction(mockInteraction, {});

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('✨ 100 XP')
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('$500')
            );
        });

        it('should format rewards with only XP', async () => {
            mockMissionService.claimRewards.mockResolvedValue({
                success: true,
                mission: { name: 'XP Quest' },
                rewards: { xp: 50 }
            });

            const mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'claim_mission_456';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);

            await handler.handleInteraction(mockInteraction, {});

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('✨ 50 XP')
            );
        });
    });
});

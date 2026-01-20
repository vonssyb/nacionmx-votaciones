/**
 * Tests for Voting Handler
 */

const VotingHandler = require('../../../../handlers/shared/voting/handler');

describe('Voting Handler', () => {
    let handler;
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
        handler = new VotingHandler(mockSupabase);
    });

    describe('handleInteraction', () => {
        let mockInteraction;
        let mockClient;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'vote_yes_session123';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.guild = {
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        roles: { cache: new Map() }
                    })
                }
            };
            mockClient = {};
        });

        it('should return false for non-voting buttons', async () => {
            mockInteraction.customId = 'other_button';
            const result = await handler.handleInteraction(mockInteraction, mockClient);
            expect(result).toBe(false);
        });

        it('should handle valid vote', async () => {
            // Mock session lookup
            mockSupabase.from().select().eq().single.mockResolvedValueOnce({
                data: { id: 'session123', status: 'active' },
                error: null
            });

            // Mock existing vote check
            mockSupabase.from().select().eq().eq().maybeSingle.mockResolvedValueOnce({
                data: null,
                error: null
            });

            // Mock vote insert
            mockSupabase.from().insert.mockResolvedValueOnce({
                data: {},
                error: null
            });

            // Mock results query
            mockSupabase.from().select().eq.mockResolvedValueOnce({
                data: [{ user_id: 'user123', vote_type: 'yes' }],
                error: null
            });

            const result = await handler.handleInteraction(mockInteraction, mockClient);

            expect(result).toBe(true);
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('✅ Voto registrado'),
                    ephemeral: true
                })
            );
        });

        it('should reject vote for inactive session', async () => {
            mockSupabase.from().select().eq().single.mockResolvedValue({
                data: { id: 'session123', status: 'closed' },
                error: null
            });

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('ya no está activa')
                })
            );
        });

        it('should reject vote with invalid session ID', async () => {
            mockInteraction.customId = 'vote_yes_';

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('inválido')
                })
            );
        });

        it('should update existing vote', async () => {
            // Session exists
            mockSupabase.from().select().eq().single.mockResolvedValueOnce({
                data: { id: 'session123', status: 'active' },
                error: null
            });

            // User already voted
            mockSupabase.from().select().eq().eq().maybeSingle.mockResolvedValueOnce({
                data: { id: 'vote1', vote_type: 'yes' },
                error: null
            });

            // Update vote
            mockSupabase.from().update().eq.mockResolvedValueOnce({
                error: null
            });

            // Results query
            mockSupabase.from().select().eq.mockResolvedValueOnce({
                data: [{ user_id: 'user123', vote_type: 'late' }],
                error: null
            });

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockInteraction.reply).toHaveBeenCalled();
        });
    });

    describe('getVoteResults', () => {
        it('should return vote counts', async () => {
            const mockVotes = [
                { user_id: '1', vote_type: 'yes' },
                { user_id: '2', vote_type: 'yes' },
                { user_id: '3', vote_type: 'late' },
                { user_id: '4', vote_type: 'no' }
            ];

            mockSupabase.from().select().eq.mockResolvedValue({
                data: mockVotes,
                error: null
            });

            const results = await handler.getVoteResults('session123');

            expect(results.yes).toBe(2);
            expect(results.late).toBe(1);
            expect(results.no).toBe(1);
            expect(results.total).toBe(4);
        });

        it('should handle empty votes', async () => {
            mockSupabase.from().select().eq.mockResolvedValue({
                data: [],
                error: null
            });

            const results = await handler.getVoteResults('session123');

            expect(results.yes).toBe(0);
            expect(results.late).toBe(0);
            expect(results.no).toBe(0);
            expect(results.total).toBe(0);
        });

        it('should handle database errors gracefully', async () => {
            mockSupabase.from().select().eq.mockResolvedValue({
                data: null,
                error: new Error('DB error')
            });

            const results = await handler.getVoteResults('session123');

            expect(results.total).toBe(0);
        });
    });

    describe('countStaffVotes', () => {
        it('should count staff votes correctly', async () => {
            const mockGuild = {
                members: {
                    fetch: jest.fn()
                        .mockResolvedValueOnce({
                            roles: { cache: new Map([[handler.STAFF_ROLE_ID, {}]]) }
                        })
                        .mockResolvedValueOnce({
                            roles: { cache: new Map() }
                        })
                        .mockResolvedValueOnce({
                            roles: { cache: new Map([[handler.STAFF_ROLE_ID, {}]]) }
                        })
                }
            };

            const count = await handler.countStaffVotes(mockGuild, ['user1', 'user2', 'user3']);

            expect(count).toBe(2);
        });

        it('should handle members who left server', async () => {
            const mockGuild = {
                members: {
                    fetch: jest.fn()
                        .mockResolvedValueOnce({
                            roles: { cache: new Map([[handler.STAFF_ROLE_ID, {}]]) }
                        })
                        .mockRejectedValueOnce(new Error('User not found'))
                }
            };

            const count = await handler.countStaffVotes(mockGuild, ['user1', 'user2']);

            expect(count).toBe(1);
        });
    });

    describe('getUserVote', () => {
        it('should return existing vote', async () => {
            mockSupabase.from().select().eq().eq().maybeSingle.mockResolvedValue({
                data: { id: 'vote1', vote_type: 'yes' },
                error: null
            });

            const vote = await handler.getUserVote('user123', 'session123');

            expect(vote).toBeDefined();
            expect(vote.vote_type).toBe('yes');
        });

        it('should return null if no vote exists', async () => {
            mockSupabase.from().select().eq().eq().maybeSingle.mockResolvedValue({
                data: null,
                error: null
            });

            const vote = await handler.getUserVote('user123', 'session123');

            expect(vote).toBeNull();
        });
    });

    describe('createResultsEmbed', () => {
        it('should create embed with results', () => {
            const results = {
                yes: 10,
                late: 3,
                no: 2,
                total: 15
            };

            const embed = handler.createResultsEmbed(results, 5);

            expect(embed.data.title).toContain('Resultados');
            expect(embed.data.fields).toHaveLength(5); // yes, late, no, staff, total
        });

        it('should create embed without staff count', () => {
            const results = {
                yes: 5,
                late: 1,
                no: 1,
                total: 7
            };

            const embed = handler.createResultsEmbed(results);

            expect(embed.data.fields).toHaveLength(4); // yes, late, no, total (no staff)
        });
    });
});

/**
 * Tests for Blackjack Handler
 */

const BlackjackHandler = require('../../../../handlers/economy/casino/blackjack');

describe('Blackjack Handler', () => {
    let handler;
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = global.createMockSupabase();
        handler = new BlackjackHandler(mockSupabase);
    });

    describe('Initialization', () => {
        it('should initialize with correct default state', () => {
            expect(handler.session.state).toBe('LOBBY');
            expect(handler.session.players).toEqual({});
            expect(handler.session.isOpen).toBe(false);
        });

        it('should have correct card constants', () => {
            expect(handler.SUITS).toHaveLength(4);
            expect(handler.FACES).toHaveLength(13);
            expect(handler.VALUES['A']).toBe(11);
            expect(handler.VALUES['K']).toBe(10);
        });
    });

    describe('handleInteraction', () => {
        let mockInteraction;
        let mockClient;

        beforeEach(() => {
            mockInteraction = global.createMockInteraction();
            mockInteraction.customId = 'btn_bj_hit';
            mockInteraction.isButton = jest.fn().mockReturnValue(true);
            mockInteraction.deferUpdate = jest.fn().mockResolvedValue({});

            mockClient = {};
        });

        it('should return false for non-blackjack buttons', async () => {
            mockInteraction.customId = 'other_button';
            const result = await handler.handleInteraction(mockInteraction, mockClient);
            expect(result).toBe(false);
        });

        it('should handle hit action correctly', async () => {
            // Setup game state
            handler.session.state = 'PLAYING';
            handler.session.deck = handler._createDeck();
            handler.session.players['user123'] = {
                bet: 100,
                hand: [
                    { face: '7', suit: '♠', value: 7 },
                    { face: '8', suit: '♥', value: 8 }
                ],
                status: 'PLAYING'
            };

            mockInteraction.user.id = 'user123';
            mockInteraction.customId = 'btn_bj_hit';

            const result = await handler.handleInteraction(mockInteraction, mockClient);

            expect(result).toBe(true);
            expect(handler.session.players['user123'].hand.length).toBe(3);
        });

        it('should handle stand action correctly', async () => {
            handler.session.state = 'PLAYING';
            handler.session.players['user123'] = {
                bet: 100,
                hand: [
                    { face: '10', suit: '♠', value: 10 },
                    { face: '9', suit: '♥', value: 9 }
                ],
                status: 'PLAYING'
            };

            mockInteraction.user.id = 'user123';
            mockInteraction.customId = 'btn_bj_stand';

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(handler.session.players['user123'].status).toBe('STAND');
        });

        it('should reject interaction if no active round', async () => {
            handler.session.state = 'LOBBY';
            mockInteraction.user.id = 'user123';

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No hay ronda activa'),
                    ephemeral: true
                })
            );
        });

        it('should reject if player not in round', async () => {
            handler.session.state = 'PLAYING';
            mockInteraction.user.id = 'user123';
            // No player added

            await handler.handleInteraction(mockInteraction, mockClient);

            expect(mockInteraction.reply).toHaveBeenCalled();
        });
    });

    describe('Card Calculations', () => {
        it('should calculate hand value correctly', () => {
            const hand1 = [
                { face: '7', suit: '♠', value: 7 },
                { face: '8', suit: '♥', value: 8 }
            ];
            expect(handler._calculateHand(hand1)).toBe(15);

            const hand2 = [
                { face: 'K', suit: '♠', value: 10 },
                { face: 'A', suit: '♥', value: 11 }
            ];
            expect(handler._calculateHand(hand2)).toBe(21); // Blackjack!
        });

        it('should handle ace correctly when busting', () => {
            const hand = [
                { face: 'K', suit: '♠', value: 10 },
                { face: '7', suit: '♥', value: 7 },
                { face: 'A', suit: '♦', value: 11 } // Should count as 1, not 11
            ];
            expect(handler._calculateHand(hand)).toBe(18); // 10 + 7 + 1 = 18
        });

        it('should handle multiple aces', () => {
            const hand = [
                { face: 'A', suit: '♠', value: 11 },
                { face: 'A', suit: '♥', value: 11 },
                { face: '9', suit: '♦', value: 9 }
            ];
            expect(handler._calculateHand(hand)).toBe(21); // 11 + 1 + 9 = 21
        });
    });

    describe('Deck Creation', () => {
        it('should create a full deck', () => {
            const deck = handler._createDeck();
            expect(deck).toHaveLength(52); // 4 suits × 13 faces
        });

        it('should shuffle the deck', () => {
            const deck1 = handler._createDeck();
            const deck2 = handler._createDeck();

            // Very unlikely to be in same order
            const same = deck1.every((card, i) =>
                card.face === deck2[i].face && card.suit === deck2[i].suit
            );
            expect(same).toBe(false);
        });
    });

    describe('Player Management', () => {
        it('should add player to session', () => {
            handler.addPlayer('user123', 500);

            expect(handler.session.players['user123']).toBeDefined();
            expect(handler.session.players['user123'].bet).toBe(500);
            expect(handler.session.players['user123'].status).toBe('WAITING');
        });

        it('should reset session', () => {
            handler.session.state = 'PLAYING';
            handler.session.players = { user123: { bet: 100 } };

            handler.reset();

            expect(handler.session.state).toBe('LOBBY');
            expect(handler.session.players).toEqual({});
            expect(handler.session.isOpen).toBe(false);
        });

        it('should get current state', () => {
            handler.session.state = 'PLAYING';
            handler.addPlayer('user1', 100);
            handler.addPlayer('user2', 200);

            const state = handler.getState();

            expect(state.state).toBe('PLAYING');
            expect(state.playersCount).toBe(2);
            expect(state.isOpen).toBe(false);
        });
    });

    describe('Game Flow', () => {
        it('should detect bust correctly', async () => {
            handler.session.state = 'PLAYING';
            handler.session.deck = handler._createDeck();

            // Force bust scenario
            handler.session.players['user123'] = {
                bet: 100,
                hand: [
                    { face: 'K', suit: '♠', value: 10 },
                    { face: 'Q', suit: '♥', value: 10 }
                ],
                status: 'PLAYING'
            };

            // Force next card to be high
            handler.session.deck.push({ face: '10', suit: '♦', value: 10 });

            await handler._handleHit(handler.session.players['user123']);

            expect(handler.session.players['user123'].status).toBe('BUST');
        });

        it('should detect 21 and stand automatically', async () => {
            handler.session.state = 'PLAYING';
            handler.session.deck = handler._createDeck();

            handler.session.players['user123'] = {
                bet: 100,
                hand: [
                    { face: 'K', suit: '♠', value: 10 },
                    { face: '10', suit: '♥', value: 10 }
                ],
                status: 'PLAYING'
            };

            // Force ace
            handler.session.deck.push({ face: 'A', suit: '♦', value: 11 });

            await handler._handleHit(handler.session.players['user123']);

            expect(handler._calculateHand(handler.session.players['user123'].hand)).toBe(21);
            expect(handler.session.players['user123'].status).toBe('STAND');
        });
    });

    describe('Format Hand', () => {
        it('should format hand correctly', () => {
            const hand = [
                { face: 'A', suit: '♠', value: 11 },
                { face: 'K', suit: '♥', value: 10 }
            ];

            const formatted = handler._formatHand(hand);

            expect(formatted).toBe('[A♠] [K♥]');
        });
    });
});

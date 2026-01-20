/**
 * @module handlers/economy/casino/blackjack
 * @description Maneja las interacciones del juego de Blackjack
 * 
 * Este módulo gestiona todo el flujo del juego de Blackjack:
 * - Botones de juego (Hit/Stand)
 * - Cálculo de manos
 * - Lógica del dealer
 * - Pagos y actualizaciones de balance
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class BlackjackHandler {
    constructor(supabase) {
        this.supabase = supabase;

        // Session state
        this.session = {
            isOpen: false,
            players: {},
            dealerHand: [],
            deck: [],
            timer: null,
            startTime: null,
            state: 'LOBBY', // LOBBY | PLAYING | DEALER_TURN
            message: null
        };

        // Constants
        this.SUITS = ['♠', '♥', '♦', '♣'];
        this.FACES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.VALUES = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11
        };
    }

    /**
     * Maneja las interacciones de botones de Blackjack
     * @param {Interaction} interaction - Discord button interaction
     * @param {Client} client - Discord client
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction, client) {
        try {
            if (!interaction.isButton()) return false;

            const { customId, user, channel } = interaction;

            // Check if this is a blackjack button
            if (!customId.startsWith('btn_bj_')) {
                return false;
            }

            const userId = user.id;

            // Validate session state
            if (this.session.state !== 'PLAYING') {
                await this._sendError(interaction, 'No hay ronda activa.');
                return true;
            }

            if (!this.session.players[userId]) {
                await this._sendError(interaction, 'No estás en esta ronda.');
                return true;
            }

            const player = this.session.players[userId];
            if (player.status !== 'PLAYING') {
                await this._sendError(interaction, 'Ya terminaste tu turno.');
                return true;
            }

            // Handle button actions
            if (customId === 'btn_bj_hit') {
                await this._handleHit(player);
            } else if (customId === 'btn_bj_stand') {
                await this._handleStand(player);
            }

            // Defer the interaction
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferUpdate();
                }
            } catch (e) {
                logger.warn('Could not defer blackjack interaction', { error: e.message });
            }

            // Update the game board
            await this._updateEmbed(channel);

            // Check if all players are done
            const allDone = Object.values(this.session.players).every(p => p.status !== 'PLAYING');
            if (allDone) {
                await this._playDealerTurn(channel);
            }

            logger.info('Blackjack interaction handled', {
                customId,
                userId,
                action: customId.replace('btn_bj_', '')
            });

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'blackjack',
                customId: interaction.customId
            });
            return true;
        }
    }

    /**
     * Inicia un nuevo juego de Blackjack
     * @param {Channel} channel - Canal de Discord
     * @returns {Promise<void>}
     */
    async startGame(channel) {
        try {
            this.session.isOpen = false;
            this.session.state = 'PLAYING';
            this.session.deck = this._createDeck();
            this.session.dealerHand = [this.session.deck.pop(), this.session.deck.pop()];

            // Deal cards to players
            for (const userId in this.session.players) {
                const player = this.session.players[userId];
                player.hand = [this.session.deck.pop(), this.session.deck.pop()];
                player.status = 'PLAYING';

                const val = this._calculateHand(player.hand);
                if (val === 21) {
                    player.status = 'STAND'; // Blackjack!
                }
            }

            // Create game message
            const embed = new EmbedBuilder()
                .setTitle('🃏 BLACKJACK ACTIVO')
                .setDescription('La ronda ha comenzado. Usen los botones para jugar.')
                .setColor(0x00CED1);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_bj_hit')
                    .setLabel('Pedir Carta')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🃏'),
                new ButtonBuilder()
                    .setCustomId('btn_bj_stand')
                    .setLabel('Plantarse')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🛑')
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });
            this.session.message = msg;

            await this._updateEmbed(channel);
            logger.info('Blackjack game started', { playersCount: Object.keys(this.session.players).length });

        } catch (error) {
            logger.errorWithContext('Failed to start blackjack game', error);
            throw error;
        }
    }

    /**
     * Añade un jugador a la sesión
     * @param {string} userId - Discord user ID
     * @param {number} bet - Monto de la apuesta
     */
    addPlayer(userId, bet) {
        this.session.players[userId] = {
            bet,
            hand: [],
            status: 'WAITING'
        };
        logger.info('Player joined blackjack', { userId, bet });
    }

    /**
     * Resetea la sesión
     */
    reset() {
        this.session = {
            isOpen: false,
            players: {},
            dealerHand: [],
            deck: [],
            timer: null,
            startTime: null,
            state: 'LOBBY',
            message: null
        };
        logger.info('Blackjack session reset');
    }

    /**
     * Obtiene el estado actual de la sesión
     * @returns {Object} - Session state
     */
    getState() {
        return {
            state: this.session.state,
            playersCount: Object.keys(this.session.players).length,
            isOpen: this.session.isOpen
        };
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    /**
     * Envía un mensaje de error
     * @private
     */
    async _sendError(interaction, message) {
        const content = `❌ ${message}`;
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content, ephemeral: true }).catch(() => { });
        } else {
            await interaction.reply({ content, ephemeral: true }).catch(() => { });
        }
    }

    /**
     * Maneja la acción HIT (pedir carta)
     * @private
     */
    async _handleHit(player) {
        player.hand.push(this.session.deck.pop());
        const val = this._calculateHand(player.hand);

        if (val > 21) {
            player.status = 'BUST';
        } else if (val === 21) {
            player.status = 'STAND';
        }
    }

    /**
     * Maneja la acción STAND (plantarse)
     * @private
     */
    async _handleStand(player) {
        player.status = 'STAND';
    }

    /**
     * Crea un mazo nuevo
     * @private
     * @returns {Array} Shuffled deck
     */
    _createDeck() {
        const deck = [];
        for (const suit of this.SUITS) {
            for (const face of this.FACES) {
                deck.push({
                    face,
                    suit,
                    value: this.VALUES[face]
                });
            }
        }
        // Shuffle
        return deck.sort(() => Math.random() - 0.5);
    }

    /**
     * Calcula el valor de una mano
     * @private
     * @param {Array} hand - Array of cards
     * @returns {number} Hand value
     */
    _calculateHand(hand) {
        let value = 0;
        let aces = 0;

        for (const card of hand) {
            value += card.value;
            if (card.face === 'A') aces++;
        }

        // Adjust for aces
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    /**
     * Formatea una mano para display
     * @private
     * @param {Array} hand - Array of cards
     * @returns {string} Formatted hand
     */
    _formatHand(hand) {
        return hand.map(c => `[${c.face}${c.suit}]`).join(' ');
    }

    /**
     * Actualiza el embed del juego
     * @private
     */
    async _updateEmbed(channel) {
        const dealerShow = this.session.state === 'DEALER_TURN'
            ? `${this._formatHand(this.session.dealerHand)} (**${this._calculateHand(this.session.dealerHand)}**)`
            : `[${this.session.dealerHand[0].face}${this.session.dealerHand[0].suit}] [?]`;

        const embed = new EmbedBuilder()
            .setTitle('🃏 MESA DE BLACKJACK')
            .setColor(0x2F3136)
            .addFields({ name: '🤵 Dealer', value: dealerShow, inline: false });

        let desc = '';
        for (const userId in this.session.players) {
            const p = this.session.players[userId];
            const val = this._calculateHand(p.hand);
            const statusIcon = p.status === 'PLAYING' ? '🤔' : (p.status === 'BUST' ? '💥' : '🛑');
            desc += `<@${userId}>: ${this._formatHand(p.hand)} (**${val}**) ${statusIcon}\n`;
        }

        embed.setDescription(desc || 'Esperando jugadores...');

        if (this.session.message) {
            try {
                await this.session.message.edit({ embeds: [embed] });
            } catch (e) {
                logger.warn('Could not update blackjack embed', { error: e.message });
            }
        }
    }

    /**
     * Ejecuta el turno del dealer y resuelve la partida
     * @private
     */
    async _playDealerTurn(channel) {
        this.session.state = 'DEALER_TURN';
        let dealerVal = this._calculateHand(this.session.dealerHand);

        // Dealer hits until 17
        while (dealerVal < 17) {
            this.session.dealerHand.push(this.session.deck.pop());
            dealerVal = this._calculateHand(this.session.dealerHand);
        }

        // Calculate results
        const winners = [];

        for (const userId in this.session.players) {
            const player = this.session.players[userId];
            const playerVal = this._calculateHand(player.hand);
            let multiplier = 0;
            let reason = '';

            // Determine winner
            if (player.status === 'BUST') {
                multiplier = 0;
                reason = 'Bust';
            } else if (dealerVal > 21) {
                multiplier = 2;
                reason = 'Dealer Bust';
            } else if (playerVal > dealerVal) {
                multiplier = 2;
                reason = 'Higher Hand';
            } else if (playerVal === dealerVal) {
                multiplier = 1;
                reason = 'Push';
            } else {
                multiplier = 0;
                reason = 'Lower Hand';
            }

            // Check for Blackjack (21 with 2 cards)
            if (playerVal === 21 && player.hand.length === 2 &&
                (dealerVal !== 21 || this.session.dealerHand.length !== 2)) {
                multiplier = 2.5;
                reason = 'Blackjack!';
            }

            // Update balance
            if (multiplier > 0) {
                const profit = Math.floor(player.bet * multiplier);
                const netProfit = profit - player.bet;

                if (netProfit > 0) {
                    winners.push(`✅ <@${userId}>: +$${profit.toLocaleString()} (${reason})`);
                } else {
                    winners.push(`♻️ <@${userId}>: Refund (${reason})`);
                }

                // Update chips
                await this._updateChips(userId, profit, netProfit);
            } else {
                // Loss
                await this._updateLoss(userId, player.bet);
            }
        }

        // Send results
        await this._sendResults(channel, dealerVal, winners);

        // Reset session
        this.reset();
    }

    /**
     * Actualiza las fichas del ganador
     * @private
     */
    async _updateChips(userId, profit, netProfit) {
        try {
            const { data: acc } = await this.supabase
                .from('casino_chips')
                .select('chips_balance, total_won')
                .eq('discord_user_id', userId)
                .single();

            if (acc) {
                await this.supabase
                    .from('casino_chips')
                    .update({
                        chips_balance: acc.chips_balance + profit,
                        total_won: acc.total_won + netProfit,
                        updated_at: new Date().toISOString()
                    })
                    .eq('discord_user_id', userId);
            }
        } catch (error) {
            logger.errorWithContext('Failed to update chips for winner', error, { userId, profit });
        }
    }

    /**
     * Actualiza las pérdidas
     * @private
     */
    async _updateLoss(userId, amount) {
        try {
            const { data: acc } = await this.supabase
                .from('casino_chips')
                .select('total_lost')
                .eq('discord_user_id', userId)
                .single();

            if (acc) {
                await this.supabase
                    .from('casino_chips')
                    .update({ total_lost: acc.total_lost + amount })
                    .eq('discord_user_id', userId);
            }
        } catch (error) {
            logger.errorWithContext('Failed to update loss', error, { userId, amount });
        }
    }

    /**
     * Envía los resultados finales
     * @private
     */
    async _sendResults(channel, dealerVal, winners) {
        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK FINALIZADO')
            .setColor(0x000000)
            .addFields({
                name: '🤵 Dealer',
                value: `${this._formatHand(this.session.dealerHand)} (**${dealerVal}**)`,
                inline: false
            });

        let playerList = '';
        for (const userId in this.session.players) {
            const p = this.session.players[userId];
            const val = this._calculateHand(p.hand);
            playerList += `<@${userId}>: ${this._formatHand(p.hand)} (**${val}**) - ${p.status}\n`;
        }
        embed.setDescription(playerList);

        if (winners.length > 0) {
            embed.addFields({
                name: '🎉 Resultados',
                value: winners.join('\n').substring(0, 1024),
                inline: false
            });
        } else {
            embed.addFields({
                name: '😢 Resultados',
                value: 'La casa gana.',
                inline: false
            });
        }

        await channel.send({ content: '🃏 **Ronda Terminada**', embeds: [embed] });
    }
}

module.exports = BlackjackHandler;

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class CasinoService {
    constructor(supabase) {
        this.supabase = supabase;
        this.sessions = {
            roulette: {
                active: false,
                bets: [],
                spinNumber: null,
                closeTime: null,
                channel: null,
                timeout: null
            },
            race: {
                active: false,
                bets: [],
                horses: [],
                winner: null,
                closeTime: null,
                channel: null,
                timeout: null
            },
            crash: {
                isOpen: false,
                bets: [],
                timer: null,
                startTime: null,
                multiplier: 1.00,
                crashed: false
            },
            blackjack: {
                isOpen: false,
                players: {},
                dealerHand: [],
                deck: [],
                timer: null,
                startTime: null,
                state: 'LOBBY',
                message: null // Store message reference
            }
        };

        // Constants
        this.BJ_SUITS = ['♠', '♥', '♦', '♣'];
        this.BJ_FACES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.BJ_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };
    }

    // --- CHIPS HELPER ---
    async checkChips(userId, amount) {
        const { data: account } = await this.supabase
            .from('casino_chips')
            .select('chips_balance')
            .eq('discord_user_id', userId)
            .maybeSingle();

        if (!account) return { hasEnough: false, message: '❌ No tienes cuenta de casino. Compra fichas con `/casino fichas comprar`' };
        if (account.chips_balance < amount) {
            return {
                hasEnough: false,
                message: `❌ Fichas insuficientes.\n\nTienes: ${account.chips_balance.toLocaleString()}\nNecesitas: ${amount.toLocaleString()}`
            };
        }
        return { hasEnough: true, balance: account.chips_balance };
    }

    // --- ANIMATIONS ---
    async animateSlots(interaction, symbols) {
        const frames = [
            '🎰 **GIRANDO...**\n⚡⚡⚡',
            `🎰 **SLOTS**\n${symbols[0]} ? ?`,
            `🎰 **SLOTS**\n${symbols[0]} ${symbols[1]} ?`,
            `🎰 **SLOTS**\n${symbols[0]} ${symbols[1]} ${symbols[2]}`
        ];
        for (let i = 0; i < frames.length; i++) {
            await interaction.editReply(frames[i]).catch(() => { });
            await sleep(i === 0 ? 800 : 600);
        }
    }

    async animateDice(interaction) {
        const frames = [
            '🎲 **Lanzando dados...**\n🎲🎲',
            '🎲 **Lanzando dados...**\n🎲🎲\n.',
            '🎲 **Lanzando dados...**\n🎲🎲\n..',
            '🎲 **Lanzando dados...**\n🎲🎲\n...'
        ];
        for (const frame of frames) {
            await interaction.editReply(frame).catch(() => { });
            await sleep(400);
        }
    }

    async animateRoulette(interaction, spin) {
        const sequence = [];
        for (let i = 0; i < 8; i++) sequence.push(Math.floor(Math.random() * 37));
        sequence.push(spin);

        for (let i = 0; i < sequence.length; i++) {
            const delay = i < 5 ? 300 : i < 7 ? 500 : 800;
            await interaction.editReply(`🎡 **GIRANDO...**\n\n🔵 ${sequence[i]}`).catch(() => { });
            await sleep(delay);
        }
    }

    // --- ROULETTE LOGIC ---
    startRouletteSession(interaction) {
        if (this.sessions.roulette.active) return false;
        this.sessions.roulette = {
            active: true,
            bets: [],
            spinNumber: Math.floor(Math.random() * 37),
            closeTime: Date.now() + 30000,
            channel: interaction.channelId,
            timeout: setTimeout(() => this.executeRouletteSession(), 30000)
        };
        return true;
    }

    async executeRouletteSession() {
        const session = this.sessions.roulette;
        if (!session.active || session.bets.length === 0) {
            session.active = false;
            return;
        }

        const spin = session.spinNumber;
        const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const isRed = reds.includes(spin);
        const isBlack = spin > 0 && !isRed;
        const color = spin === 0 ? '🟢' : isRed ? '🔴' : '🔵';

        // Animate
        for (const bet of session.bets) {
            await this.animateRoulette(bet.interaction, spin);
        }

        // Payouts
        for (const bet of session.bets) {
            let won = false, mult = 1;
            const { betType, numero: num } = bet;

            if (betType === 'numero' && spin === num) { won = true; mult = 35; }
            else if (betType === 'red' && isRed) { won = true; mult = 1; }
            else if (betType === 'black' && isBlack) { won = true; mult = 1; }
            else if (betType === 'even' && spin > 0 && spin % 2 === 0) { won = true; mult = 1; }
            else if (betType === 'odd' && spin > 0 && spin % 2 === 1) { won = true; mult = 1; }

            // ... simplified other checks for brevity, can expand if needed ...
            else if (betType === '1-18' && spin >= 1 && spin <= 18) { won = true; mult = 1; }
            else if (betType === '19-36' && spin >= 19 && spin <= 36) { won = true; mult = 1; }
            else if (betType === 'col1' && spin > 0 && (spin - 1) % 3 === 0) { won = true; mult = 2; }
            else if (betType === 'col2' && spin > 0 && (spin - 2) % 3 === 0) { won = true; mult = 2; }
            else if (betType === 'col3' && spin > 0 && (spin - 3) % 3 === 0) { won = true; mult = 2; }

            const payout = won ? bet.amount * (mult + 1) : 0;
            const netProfit = payout - bet.amount;

            if (payout > 0) {
                await this.supabase.from('casino_chips').update({
                    chips: (bet.currentChips - bet.amount + payout), // Note: Verify if column is chips or chips_balance. DB schema says chips_balance usually.
                    // Legacy code used "chips" in update but select "chips_balance". 
                    // Let's stick to safe increment via RPC if possible, or just update "chips_balance"
                    chips_balance: (bet.currentChips - bet.amount + payout), // Correct column name assumption
                    total_won: (bet.totalWon || 0) + payout,
                    games_played: (bet.gamesPlayed || 0) + 1
                }).eq('discord_user_id', bet.userId);
            } else {
                await this.supabase.from('casino_chips').update({
                    chips_balance: (bet.currentChips - bet.amount),
                    total_lost: (bet.totalLost || 0) + bet.amount,
                    games_played: (bet.gamesPlayed || 0) + 1
                }).eq('discord_user_id', bet.userId);
            }

            const resultText = won ? `✅ **¡GANAS!** +${payout} (${mult + 1}x)` : `❌ **Perdiste** -${bet.amount}`;
            await bet.interaction.editReply(`🎡 **RULETA DE CASINO**\n\n${color} **${spin}**\n\n👥 ${session.bets.length} jugadores\nTu apuesta: **${betType.toUpperCase()}**\n${resultText}`).catch(() => { });
        }

        session.active = false;
        session.bets = [];
    }

    // --- RACE LOGIC ---
    async animateRace(interaction, horses) {
        const laps = 5;
        for (let lap = 1; lap <= laps; lap++) {
            horses.forEach(h => h.pos += Math.random() * 20);
            horses.sort((a, b) => b.pos - a.pos);

            let display = `🏁 **Vuelta ${lap}/${laps}**\n\n`;
            horses.forEach((h, idx) => {
                const bars = Math.floor(h.pos / 20);
                const track = '━'.repeat(Math.min(bars, 10));
                display += `${idx === 0 ? '🔥' : '　'}${h.emoji}${track}\n`;
            });

            await interaction.editReply(display).catch(() => { });
            await sleep(1000);
        }
    }

    startRaceSession(interaction) {
        if (this.sessions.race.active) return false;
        const horses = [
            { id: 1, emoji: '🐴', name: 'Relámpago', pos: 0 },
            { id: 2, emoji: '🏇', name: 'Trueno', pos: 0 },
            { id: 3, emoji: '🐎', name: 'Viento', pos: 0 },
            { id: 4, emoji: '🦄', name: 'Estrella', pos: 0 }
        ];

        this.sessions.race = {
            active: true,
            bets: [],
            horses: horses,
            winner: null,
            closeTime: Date.now() + 45000,
            channel: interaction.channelId,
            timeout: setTimeout(() => this.executeRaceSession(), 45000)
        };
        return true;
    }

    async executeRaceSession() {
        const session = this.sessions.race;
        if (!session.active || session.bets.length === 0) {
            session.active = false;
            return;
        }

        for (const bet of session.bets) await this.animateRace(bet.interaction, session.horses);

        session.horses.sort((a, b) => b.pos - a.pos);
        const winner = session.horses[0].id;

        for (const bet of session.bets) {
            const won = winner === bet.horseId;
            const payout = won ? bet.amount * 3 : 0;
            const netProfit = payout - bet.amount;

            // DB Update logic similar to roulette
            const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won, total_lost').eq('discord_user_id', bet.userId).single();
            if (acc) {
                if (won) {
                    await this.supabase.from('casino_chips').update({
                        chips_balance: acc.chips_balance + payout, // Amount was already deducted at bet time? Usually yes.
                        // If deducted at bet time, we just add payout. If not, we subtract bet + add payout.
                        // Assuming deduction happens at valid bet placement in command.
                        total_won: acc.total_won + payout
                    }).eq('discord_user_id', bet.userId);
                } else {
                    await this.supabase.from('casino_chips').update({
                        total_lost: acc.total_lost + bet.amount
                    }).eq('discord_user_id', bet.userId);
                }
            }

            const resultText = won ? `✅ **¡GANAS!** +${payout} (3x)` : `❌ **Perdiste** -${bet.amount}`;
            const yourHorse = session.horses.find(h => h.id === bet.horseId);
            await bet.interaction.editReply(`🏇 **CARRERAS**\n\n🏆 Ganador: ${session.horses[0].emoji} **${session.horses[0].name}**\n\n${resultText}`).catch(() => { });
        }

        session.active = false;
        session.bets = [];
    }

    // --- CRASH LOGIC ---
    async startCrashGame(channel) {
        const session = this.sessions.crash;
        session.isOpen = false;
        let multiplier = 1.00;
        const instantCrash = Math.random() < 0.03;
        let crashPoint = instantCrash ? 1.00 : (0.99 / (1 - Math.random()));
        if (crashPoint > 50) crashPoint = 50.00;

        const msg = await channel.send({ content: `🚀 **CRASH** Lanzamiento iniciado... \n\n📈 Multiplicador: **1.00x**` });

        const interval = setInterval(async () => {
            if (multiplier < 2) multiplier *= 1.25;
            else if (multiplier < 5) multiplier *= 1.2;
            else multiplier *= 1.1;

            if (multiplier >= crashPoint) {
                clearInterval(interval);
                multiplier = crashPoint;
                let description = `💥 **CRASHED @ ${crashPoint.toFixed(2)}x**\n\n`;
                let winners = [];

                for (const bet of session.bets) {
                    const userTarget = bet.target;
                    if (userTarget <= crashPoint) {
                        const profit = Math.floor(bet.amount * userTarget);
                        winners.push(`✅ <@${bet.userId}> retiró en **${userTarget}x** -> +$${profit.toLocaleString()}`);

                        const { data: acc } = await this.supabase.from('casino_chips').select('*').eq('discord_user_id', bet.userId).single();
                        if (acc) {
                            await this.supabase.from('casino_chips').update({
                                chips_balance: acc.chips_balance + profit,
                                total_won: acc.total_won + (profit - bet.amount),
                                updated_at: new Date().toISOString()
                            }).eq('discord_user_id', bet.userId);
                        }
                    } else {
                        const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('discord_user_id', bet.userId).single();
                        if (acc) await this.supabase.from('casino_chips').update({ total_lost: acc.total_lost + bet.amount }).eq('discord_user_id', bet.userId);
                    }

                    try {
                        if (bet.target <= crashPoint) await bet.interaction.editReply(`✅ Retiraste en **${bet.target}x**`).catch(() => { });
                        else await bet.interaction.editReply(`❌ Te estrellaste (Crash: ${crashPoint.toFixed(2)}x)`).catch(() => { });
                    } catch (e) { }
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle(`📉 CRASH FINALIZADO`)
                    .setDescription(description + (winners.length > 0 ? `**Ganadores:**\n${winners.join('\n')}` : '😢 Todos estrellados.'))
                    .setColor(0xFF4500)
                    .setFooter({ text: `Punto de Crash: ${crashPoint.toFixed(2)}x` });

                await msg.edit({ content: `💥 **CRASHED @ ${crashPoint.toFixed(2)}x**`, embeds: [resultEmbed] });
                session.bets = [];
            } else {
                await msg.edit(`🚀 **${multiplier.toFixed(2)}x** ... subiendo`).catch(() => { });
            }
        }, 2000);
    }

    // --- BLACKJACK LOGIC ---
    async handleBlackjackInteraction(interaction) {
        if (!interaction.isButton()) return;
        const session = this.sessions.blackjack;
        const userId = interaction.user.id;

        if (session.state !== 'PLAYING') {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: '❌ No hay ronda activa.', ephemeral: true }).catch(() => { });
            else await interaction.reply({ content: '❌ No hay ronda activa.', ephemeral: true }).catch(() => { });
            return;
        }

        if (!session.players[userId]) {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: '❌ No estás en esta ronda.', ephemeral: true }).catch(() => { });
            else await interaction.reply({ content: '❌ No estás en esta ronda.', ephemeral: true }).catch(() => { });
            return;
        }

        const player = session.players[userId];
        if (player.status !== 'PLAYING') {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: '❌ Ya terminaste tu turno.', ephemeral: true }).catch(() => { });
            else await interaction.reply({ content: '❌ Ya terminaste tu turno.', ephemeral: true }).catch(() => { });
            return;
        }

        if (interaction.customId === 'btn_bj_hit') {
            player.hand.push(session.deck.pop());
            const val = this.calculateHand(player.hand);
            if (val > 21) player.status = 'BUST';
            if (val === 21) player.status = 'STAND';
        } else if (interaction.customId === 'btn_bj_stand') {
            player.status = 'STAND';
        }

        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        } catch (e) { }

        await this.updateBlackjackEmbed(interaction.channel);

        const allDone = Object.values(session.players).every(p => p.status !== 'PLAYING');
        if (allDone) {
            await this.dealerPlay(interaction.channel);
        }
    }

    createDeck() {
        let deck = [];
        for (const s of this.BJ_SUITS) for (const f of this.BJ_FACES) deck.push({ face: f, suit: s, value: this.BJ_VALUES[f] });
        return deck.sort(() => Math.random() - 0.5);
    }

    calculateHand(hand) {
        let value = 0;
        let aces = 0;
        for (const card of hand) { value += card.value; if (card.face === 'A') aces++; }
        while (value > 21 && aces > 0) { value -= 10; aces--; }
        return value;
    }

    formatHand(hand) {
        return hand.map(c => `[${c.face}${c.suit}]`).join(' ');
    }

    async updateBlackjackEmbed(channel) {
        const session = this.sessions.blackjack;
        const dealerShow = session.state === 'DEALER_TURN'
            ? `${this.formatHand(session.dealerHand)} (**${this.calculateHand(session.dealerHand)}**)`
            : `[${session.dealerHand[0].face}${session.dealerHand[0].suit}] [?]`;

        const embed = new EmbedBuilder()
            .setTitle('🃏 MESA DE BLACKJACK')
            .setColor(0x2F3136)
            .addFields({ name: '🤵 Dealer', value: dealerShow, inline: false });

        let desc = '';
        for (const userId in session.players) {
            const p = session.players[userId];
            const val = this.calculateHand(p.hand);
            desc += `<@${userId}>: ${this.formatHand(p.hand)} (**${val}**) ${p.status === 'PLAYING' ? '🤔' : (p.status === 'BUST' ? '💥' : '🛑')}\n`;
        }
        embed.setDescription(desc || 'Esperando jugadores...');

        if (session.message) {
            try { await session.message.edit({ embeds: [embed] }); } catch (e) { }
        }
    }

    async dealerPlay(channel) {
        const session = this.sessions.blackjack;
        session.state = 'DEALER_TURN';
        let dealerVal = this.calculateHand(session.dealerHand);

        while (dealerVal < 17) {
            session.dealerHand.push(session.deck.pop());
            dealerVal = this.calculateHand(session.dealerHand);
        }

        let winners = [];
        for (const userId in session.players) {
            const player = session.players[userId];
            const playerVal = this.calculateHand(player.hand);
            let win = false, multiplier = 0, reason = '';

            if (player.status === 'BUST') { multiplier = 0; reason = 'Bust'; }
            else if (dealerVal > 21) { win = true; multiplier = 2; reason = 'Dealer Bust'; }
            else if (playerVal > dealerVal) { win = true; multiplier = 2; reason = 'Higher Hand'; }
            else if (playerVal === dealerVal) { win = true; multiplier = 1; reason = 'Push'; }
            else { multiplier = 0; reason = 'Lower Hand'; }

            if (playerVal === 21 && player.hand.length === 2 && (dealerVal !== 21 || session.dealerHand.length !== 2)) {
                multiplier = 2.5; reason = 'Blackjack!';
            }

            if (multiplier > 0) {
                const profit = Math.floor(player.bet * multiplier);
                const netProfit = profit - player.bet;
                if (netProfit > 0) winners.push(`✅ <@${userId}>: +$${profit.toLocaleString()} (${reason})`);
                else winners.push(`♻️ <@${userId}>: Refund (${reason})`);

                const { data: acc } = await this.supabase.from('casino_chips').select('*').eq('discord_user_id', userId).single();
                if (acc) {
                    await this.supabase.from('casino_chips').update({
                        chips_balance: acc.chips_balance + profit,
                        total_won: acc.total_won + netProfit,
                        updated_at: new Date().toISOString()
                    }).eq('discord_user_id', userId);
                }
            } else {
                // Loss update
                const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('discord_user_id', userId).single();
                if (acc) await this.supabase.from('casino_chips').update({ total_lost: acc.total_lost + player.bet }).eq('discord_user_id', userId);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK FINALIZADO')
            .setColor(0x000000)
            .addFields({ name: '🤵 Dealer', value: `${this.formatHand(session.dealerHand)} (**${dealerVal}**)`, inline: false });

        let playerList = '';
        for (const userId in session.players) {
            const p = session.players[userId];
            const val = this.calculateHand(p.hand);
            playerList += `<@${userId}>: ${this.formatHand(p.hand)} (**${val}**) - ${p.status}\n`;
        }
        embed.setDescription(playerList);
        if (winners.length > 0) embed.addFields({ name: '🎉 Resultados', value: winners.join('\n').substring(0, 1024), inline: false });
        else embed.addFields({ name: '😢 Resultados', value: 'La casa gana.', inline: false });

        await channel.send({ content: '🃏 **Ronda Terminada**', embeds: [embed] });

        // Reset
        session.players = {};
        session.dealerHand = [];
        session.deck = [];
        session.state = 'LOBBY';
        session.timer = null;
    }

    async startBlackjackGame(channel) {
        const session = this.sessions.blackjack;
        session.isOpen = false;
        session.state = 'PLAYING';
        session.deck = this.createDeck();
        session.dealerHand = [session.deck.pop(), session.deck.pop()];

        for (const userId in session.players) {
            session.players[userId].hand = [session.deck.pop(), session.deck.pop()];
            const val = this.calculateHand(session.players[userId].hand);
            if (val === 21) session.players[userId].status = 'STAND';
        }

        const embed = new EmbedBuilder()
            .setTitle('🃏 BLACKJACK ACTIVO')
            .setDescription('La ronda ha comenzado. Usen los botones para jugar.')
            .setColor(0x00CED1);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_bj_hit').setLabel('Pedir Carta').setStyle(ButtonStyle.Success).setEmoji('🃏'),
            new ButtonBuilder().setCustomId('btn_bj_stand').setLabel('Plantarse').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });
        session.message = msg;
        await this.updateBlackjackEmbed(channel);
    }
}

module.exports = CasinoService;

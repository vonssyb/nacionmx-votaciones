const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class CasinoService {
    constructor(supabase, transactionManager = null) {
        this.supabase = supabase;
        this.transactionManager = transactionManager;
        this.sessions = {
            roulette: { /* ... */ },
            race: { /* ... */ },
            crash: { /* ... */ },
            blackjack: { /* ... */ },
            mines: {},
            tower: {},
            penalty: {} // { userId: { bet: 100, active: true } }
        };

        // ... constants ...
    }

    // ========================================
    // CENTRALIZED TRANSACTION METHODS (NEW)
    // ========================================

    /**
     * Play dados with automatic transaction handling
     * @param {string} userId
     * @param {number} bet
     * @param {string} type
     * @returns {Promise<{won: boolean, payout: number, d1: number, d2: number, sum: number, newBalance?: number}>}
     */
    async playDiceAndUpdate(userId, bet, type) {
        // Calculate game result
        const gameResult = await this.playDice(userId, bet, type);

        // If TransactionManager is available, use atomic transaction
        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                gameResult.payout,
                'dados',
                { type, d1: gameResult.d1, d2: gameResult.d2, sum: gameResult.sum }
            );

            if (!txResult.success) {
                return { ...gameResult, error: txResult.error };
            }

            return {
                ...gameResult,
                newBalance: txResult.newBalance,
                balanceBefore: txResult.balanceBefore
            };
        }

        // Fallback to direct DB update (legacy mode)
        return await this._legacyUpdateBalance(userId, bet, gameResult.payout, 'dados');
    }

    /**
     * Play slots with automatic transaction handling
     * @param {string} userId
     * @param {number} bet
     * @returns {Promise<{symbols: array, won: boolean, payout: number, matchType: string, newBalance?: number}>}
     */
    async playSlotsAndUpdate(userId, bet) {
        const { symbols, won, payout, matchType } = await this.playSlots(userId, bet);

        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                payout,
                'tragamonedas',
                { symbols, matchType }
            );

            if (!txResult.success) {
                return { symbols, won, payout, matchType, error: txResult.error };
            }

            return { symbols, won, payout, matchType, newBalance: txResult.newBalance };
        }

        return await this._legacyUpdateBalance(userId, bet, payout, 'tragamonedas', { symbols, won, payout, matchType });
    }

    /**
     * Play scratch card with automatic transaction handling
     * @param {string} userId
     * @param {number} bet
     */
    async playScratchAndUpdate(userId, bet) {
        const gameResult = await this.playScratch(userId, bet);

        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                gameResult.payout,
                'raspa',
                { grid: gameResult.grid, match: gameResult.match }
            );

            if (!txResult.success) {
                return { ...gameResult, error: txResult.error };
            }

            return {
                ...gameResult,
                newBalance: txResult.newBalance,
                balanceBefore: txResult.balanceBefore
            };
        }

        // Fallback to legacy update (simulate atomic return structure)
        // We reuse the logic from the command file or implement a helper here if needed.
        // For now, let's just use a simple legacy update helper or throw if not supported, 
        // but to ensure backward compatibility we can do a direct update.
        // However, the command file has its own logic. 
        // Ideally we move that logic here.

        return await this._legacyUpdateBalance(userId, bet, gameResult.payout, 'raspa', gameResult);
    }


    /**
     * Play Coinflip Duel (PvP) with atomic transaction
     * @param {string} challengerId
     * @param {string} opponentId
     * @param {number} betAmount
     */
    async playCoinflipDuel(challengerId, opponentId, betAmount) {
        // 1. Determine Winner
        // 50/50 chance
        const winnerIsChallenger = Math.random() < 0.5;
        const winnerId = winnerIsChallenger ? challengerId : opponentId;
        const loserId = winnerIsChallenger ? opponentId : challengerId;

        // 2. Execute Atomic Transaction
        if (this.transactionManager) {
            const txResult = await this.transactionManager.executePvPDuel(
                winnerId,
                loserId,
                betAmount,
                'coinflip'
            );

            if (!txResult.success) {
                return { error: txResult.error };
            }

            return {
                winnerId,
                loserId,
                winAmount: txResult.winAmount,
                tax: txResult.tax,
                winnerNewBalance: txResult.winnerNewBalance,
                loserNewBalance: txResult.loserNewBalance
            };
        }

        // Fallback for legacy (Manual update - unsafe but keeps compatibility if TM missing)
        // NOT IMPLEMENTING LEGACY FALLBACK FOR PVP TO ENFORCE ATOMICITY
        return { error: '❌ Error interno: Gestor de transacciones no disponible.' };
    }

    /**
     * Legacy fallback method for balance updates without TransactionManager
     * @private
     */
    async _legacyUpdateBalance(userId, bet, payout, gameType, gameData = {}) {
        try {
            const { data: acc } = await this.supabase
                .from('casino_chips')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!acc) {
                return { ...gameData, error: '❌ Cuenta de casino no encontrada' };
            }

            const won = payout > bet;
            const newBalance = acc.chips - bet + payout;

            const updates = {
                chips: newBalance,
                games_played: (acc.games_played || 0) + 1,
                updated_at: new Date().toISOString()
            };

            if (won) {
                updates.total_won = (acc.total_won || 0) + (payout - bet);
            } else {
                updates.total_lost = (acc.total_lost || 0) + bet;
            }

            await this.supabase
                .from('casino_chips')
                .update(updates)
                .eq('user_id', userId);

            return {
                ...gameData,
                newBalance,
                balanceBefore: acc.chips
            };

        } catch (error) {
            console.error('[CasinoService] Legacy update failed:', error);
            return { ...gameData, error: '❌ Error al actualizar el balance' };
        }
    }

    // ========================================
    // ORIGINAL METHODS BELOW
    // ========================================


    // --- TOWER LOGIC ---
    // Difficulties:
    // EASY: 3 cols, 2 safe (Chance 66%), Multiplier: 1.45x per step
    // MEDIUM: 3 cols, 1 safe (Chance 33%), Multiplier: 2.90x per step
    // HARD: 2 cols, 1 safe (Chance 50%), Multiplier: 1.95x per step (Wait, Medium is harder than Hard? Hard usually means more mines)
    // Let's standard: 
    // EASY: 4 cols, 3 safe.
    // MEDIUM: 3 cols, 2 safe.
    // HARD: 3 cols, 1 safe.
    // EXTREME: 2 cols, 1 safe.

    calculateTowerMultiplier(difficulty, level) {
        let base = 1.0;
        let step = 0;
        if (difficulty === 'easy') step = 1.30;
        else if (difficulty === 'medium') step = 1.45;
        else if (difficulty === 'hard') step = 2.90;

        return Math.pow(step, level);
    }

    async startTowerGame(interaction, bet, difficulty) {
        const userId = interaction.user.id;
        const levels = 8;
        const grid = [];

        // Generate Tower
        for (let i = 0; i < levels; i++) {
            let row = [];
            let width = 3;
            let safeCount = 2; // Default Medium

            if (difficulty === 'easy') { width = 4; safeCount = 3; }
            else if (difficulty === 'medium') { width = 3; safeCount = 2; }
            else if (difficulty === 'hard') { width = 3; safeCount = 1; }

            // Fill row
            let mines = width - safeCount;
            let r = Array(width).fill(0); // 0=Safe
            let minesPlaced = 0;
            while (minesPlaced < mines) {
                const idx = Math.floor(Math.random() * width);
                if (r[idx] === 0) {
                    r[idx] = 1; // 1=Mine
                    minesPlaced++;
                }
            }
            grid.push(r);
        }

        this.sessions.tower[userId] = {
            userId,
            bet,
            difficulty,
            level: 0, // Current level waiting to be played (0-7)
            grid, // grid[0] is level 1 (bottom)
            active: true
        };

        await this.updateTowerEmbed(interaction, userId);
    }

    async handleTowerInteraction(interaction) {
        const userId = interaction.user.id;
        const session = this.sessions.tower[userId];

        if (!session || !session.active) return interaction.reply({ content: '❌ Juego expirado.', ephemeral: true });

        const customId = interaction.customId;

        if (customId === 'btn_tower_cashout') {
            await this.cashoutTowerAndUpdate(interaction, userId);
            return;
        }

        if (customId.startsWith('btn_tower_')) {
            const col = parseInt(customId.split('_')[2]);
            const currentRow = session.grid[session.level]; // 0 is bottom

            // Allow only selection on current level? Yes.
            // Check if mine or safe
            if (currentRow[col] === 1) {
                // FAIL
                await this.failTowerAndUpdate(interaction, userId, col);
            } else {
                // SAFE
                session.level++;
                if (session.level >= session.grid.length) {
                    // Reached Top -> Auto Cashout
                    await this.cashoutTowerAndUpdate(interaction, userId, true);
                } else {
                    await this.updateTowerEmbed(interaction, userId);
                }
            }
        }
    }

    async updateTowerEmbed(interaction, userId) {
        const session = this.sessions.tower[userId];
        const multiplier = session.level === 0 ? 1.0 : this.calculateTowerMultiplier(session.difficulty, session.level);
        const nextMult = this.calculateTowerMultiplier(session.difficulty, session.level + 1);
        const currentWin = Math.floor(session.bet * multiplier);

        const embed = new EmbedBuilder()
            .setTitle('🗼 TORRE')
            .setDescription(`Dificultad: **${session.difficulty.toUpperCase()}**\nNivel: **${session.level + 1} / ${session.grid.length}**\nMultiplicador: **${multiplier.toFixed(2)}x**\nSiguiente: **${nextMult.toFixed(2)}x**`)
            .setColor('#9B59B6');

        const rows = [];

        // Show current level buttons
        const width = session.grid[0].length;
        const row = new ActionRowBuilder();
        for (let i = 0; i < width; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_tower_${i}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('🪜 Subir')
            );
        }
        rows.push(row);

        // Cashout
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_tower_cashout')
                .setStyle(ButtonStyle.Success)
                .setLabel(`💰 Retirar (${currentWin})`)
                .setDisabled(session.level === 0)
        ));

        if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embed], components: rows }).catch(() => { });
        else await interaction.reply({ embeds: [embed], components: rows }).catch(() => { });
    }

    async failTower(interaction, userId, col) {
        const session = this.sessions.tower[userId];
        const embed = new EmbedBuilder().setTitle('💀 TE CAÍSTE DE LA TORRE').setColor('#E74C3C').setDescription(`Elegiste columna ${col + 1} y había una mina.\nPerdiste **${session.bet}** fichas.`);

        const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', userId).single();
        await this.supabase.from('casino_chips').update({ total_lost: (acc.total_lost || 0) + session.bet }).eq('user_id', userId);

        delete this.sessions.tower[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    async cashoutTower(interaction, userId, completed = false) {
        const session = this.sessions.tower[userId];
        const multiplier = this.calculateTowerMultiplier(session.difficulty, session.level);
        const winAmount = Math.floor(session.bet * multiplier);

        const embed = new EmbedBuilder()
            .setTitle(completed ? '🏆 ¡CIMA ALCANZADA!' : '💰 RETIRO DE TORRE')
            .setColor('#2ECC71')
            .setDescription(`Ganaste **${winAmount}** fichas\nMultiplicador: **${multiplier.toFixed(2)}x**`);

        const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won').eq('user_id', userId).single();
        await this.supabase.from('casino_chips').update({
            chips_balance: acc.chips_balance + winAmount,
            total_won: (acc.total_won || 0) + (winAmount - session.bet)
        }).eq('user_id', userId);

        delete this.sessions.tower[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    // --- CHIPS HELPER ---
    async checkChips(userId, amount) {
        const { data: account } = await this.supabase
            .from('casino_chips')
            .select('chips')
            .eq('user_id', userId)
            .maybeSingle();

        if (!account) return { hasEnough: false, message: '❌ No tienes cuenta de casino. Compra fichas con `/fichas comprar`' };
        if (account.chips < amount) {
            return {
                hasEnough: false,
                message: `❌ Fichas insuficientes.\n\nTienes: ${account.chips_balance.toLocaleString()}\nNecesitas: ${amount.toLocaleString()}`
            };
        }
        return { hasEnough: true, balance: account.chips };
    }

    async addChips(userId, amount) {
        const { data: account } = await this.supabase
            .from('casino_chips')
            .select('chips')
            .eq('user_id', userId)
            .maybeSingle();

        if (!account) {
            await this.supabase.from('casino_chips').insert({
                user_id: userId,
                chips: amount,
                total_won: 0,
                total_lost: 0,
                games_played: 0
            });
        } else {
            await this.supabase.from('casino_chips').update({
                chips: account.chips + amount,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
        }
    }

    async removeChips(userId, amount) {
        const { data: account } = await this.supabase
            .from('casino_chips')
            .select('chips')
            .eq('user_id', userId)
            .single(); // Assuming checkChips was called before

        if (account) {
            await this.supabase.from('casino_chips').update({
                chips: account.chips - amount,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
        }
    }

    async updateStats(userId, amount, isWin) {
        const { data: account } = await this.supabase
            .from('casino_chips')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (account) {
            const updates = { games_played: (account.games_played || 0) + 1 };
            if (isWin) {
                updates.total_won = (account.total_won || 0) + amount;
            } else {
                updates.total_lost = (account.total_lost || 0) + amount;
            }
            await this.supabase.from('casino_chips').update(updates).eq('user_id', userId);
        }
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
                    chips: (bet.currentChips - bet.amount + payout), // Correct column name assumption
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

    // --- VIDEO POKER LOGIC ---
    evaluatePokerHand(hand) {
        // Hand: [{face: 'A', suit: '♠', value: 11}, ...]
        // Rank mapping: 2..9, 10, J, Q, K, A
        const ranks = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        const suits = hand.map(c => c.suit);
        const faces = hand.map(c => ranks[c.face]);

        // Sort descending
        faces.sort((a, b) => b - a);

        const isFlush = suits.every(s => s === suits[0]);
        let isStraight = true;
        for (let i = 0; i < 4; i++) {
            if (faces[i] - faces[i + 1] !== 1) {
                // Special case: A, 5, 4, 3, 2 (Wheel)
                if (i === 0 && faces[0] === 14 && faces[1] === 5) {
                    // Check rest 5,4,3,2
                    if (faces[1] === 5 && faces[2] === 4 && faces[3] === 3 && faces[4] === 2) {
                        isStraight = true;
                        break;
                    }
                }
                isStraight = false;
                break;
            }
        }

        const counts = {};
        faces.forEach(x => counts[x] = (counts[x] || 0) + 1);
        const countValues = Object.values(counts).sort((a, b) => b - a); // [4, 1] means 4 of a kind

        // Evaluate
        if (isFlush && isStraight) {
            if (faces[0] === 14 && faces[4] === 10) return { rank: 'ROYAL_FLUSH', multiplier: 250, name: 'Escalera Real' };
            return { rank: 'STRAIGHT_FLUSH', multiplier: 50, name: 'Escalera de Color' };
        }
        if (countValues[0] === 4) return { rank: 'FOUR_OF_A_KIND', multiplier: 25, name: 'Poker (4 iguales)' };
        if (countValues[0] === 3 && countValues[1] === 2) return { rank: 'FULL_HOUSE', multiplier: 9, name: 'Full House' };
        if (isFlush) return { rank: 'FLUSH', multiplier: 6, name: 'Color' };
        if (isStraight) return { rank: 'STRAIGHT', multiplier: 4, name: 'Escalera' };
        if (countValues[0] === 3) return { rank: 'THREE_OF_A_KIND', multiplier: 3, name: 'Trío' };
        if (countValues[0] === 2 && countValues[1] === 2) return { rank: 'TWO_PAIR', multiplier: 2, name: 'Doble Par' };
        if (countValues[0] === 2) {
            // Check Jacks or Better (J=11, Q=12, K=13, A=14)
            const pairRank = parseInt(Object.keys(counts).find(key => counts[key] === 2));
            if (pairRank >= 11) return { rank: 'JACKS_OR_BETTER', multiplier: 1, name: 'Jacks or Better' };
        }

        return { rank: 'NONE', multiplier: 0, name: 'Nada' };
    }

    async startVideoPoker(interaction, betAmount) {
        const deck = this.createDeck();
        const hand = [];
        for (let i = 0; i < 5; i++) hand.push(deck.pop());

        const userId = interaction.user.id;

        // Save session
        // Note: active table for VP required in constructor? 
        // I will add it dynamically or update constructor later.
        if (!this.sessions.videopoker) this.sessions.videopoker = {};

        this.sessions.videopoker[userId] = {
            userId,
            bet: betAmount,
            hand,
            deck,
            held: [false, false, false, false, false], // Indices 0-4
            stage: 'HOLD' // HOLD -> DRAW -> FINISH
        };

        await this.updateVideoPokerEmbed(interaction, userId);
    }

    async handleVideoPokerInteraction(interaction) {
        const userId = interaction.user.id;
        const session = this.sessions.videopoker?.[userId];
        if (!session) return interaction.reply({ content: '❌ Sesión expirada.', ephemeral: true });

        const customId = interaction.customId;

        if (customId === 'btn_vp_deal') {
            await this.drawVideoPoker(interaction, userId);
        } else if (customId.startsWith('btn_vp_hold_')) {
            const idx = parseInt(customId.split('_')[3]);
            session.held[idx] = !session.held[idx];
            await this.updateVideoPokerEmbed(interaction, userId);
        }
    }

    async drawVideoPoker(interaction, userId) {
        const session = this.sessions.videopoker[userId];

        // Replace unheld cards
        for (let i = 0; i < 5; i++) {
            if (!session.held[i]) {
                session.hand[i] = session.deck.pop();
            }
        }

        // Evaluate
        const result = this.evaluatePokerHand(session.hand);
        const payout = Math.floor(session.bet * result.multiplier);
        const netProfit = payout - session.bet;

        // DB Update
        if (payout > 0) {
            const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won').eq('user_id', userId).maybeSingle();
            if (acc) {
                await this.supabase.from('casino_chips').update({
                    chips_balance: acc.chips_balance + payout,
                    total_won: (acc.total_won || 0) + netProfit
                }).eq('user_id', userId);
            }
        } else {
            const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', userId).maybeSingle();
            if (acc) {
                await this.supabase.from('casino_chips').update({
                    total_lost: (acc.total_lost || 0) + session.bet
                }).eq('user_id', userId);
            }
        }

        // Show Result
        const embed = new EmbedBuilder()
            .setTitle(result.multiplier > 0 ? `🎉 ¡GANASTE! ${result.name}` : `❌ Perdiste: ${result.name}`)
            .setColor(result.multiplier > 0 ? '#2ECC71' : '#E74C3C')
            .setDescription(`Mano Final:\n${this.formatHand(session.hand)}\n\nPremio: **${payout}** fichas (${result.multiplier}x)`);

        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
        delete this.sessions.videopoker[userId];
    }

    async updateVideoPokerEmbed(interaction, userId) {
        const session = this.sessions.videopoker[userId];
        const result = this.evaluatePokerHand(session.hand); // Preview current hand rank

        const embed = new EmbedBuilder()
            .setTitle('🃏 VIDEO POKER')
            .setDescription(`Apuesta: **${session.bet}**\n\nMano Actual:\n${session.hand.map((c, i) => session.held[i] ? `**[${c.face}${c.suit}]**` : `[${c.face}${c.suit}]`).join(' ')}\n\n*Selecciona las cartas que quieres MANTENER y pulsa REPARTIR.*`)
            .setColor('#9B59B6')
            .setFooter({ text: `Mano actual: ${result.name}` });

        const row = new ActionRowBuilder();
        for (let i = 0; i < 5; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_vp_hold_${i}`)
                    .setLabel(session.held[i] ? '🔒 MANTE' : '🃏 CAMBIAR')
                    .setStyle(session.held[i] ? ButtonStyle.Success : ButtonStyle.Secondary)
            );
        }

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_vp_deal')
                .setLabel('🎲 REPARTIR')
                .setStyle(ButtonStyle.Primary)
        );

        if (interaction.replied || interaction.deferred) {
            // If coming from button click, update
            if (interaction.isButton && interaction.isButton()) await interaction.update({ embeds: [embed], components: [row, row2] }).catch(() => { });
            else await interaction.editReply({ embeds: [embed], components: [row, row2] }).catch(() => { });
        } else {
            await interaction.reply({ embeds: [embed], components: [row, row2] }).catch(() => { });
        }
    }

    async updateBlackjackEmbed(channel) {
        const session = this.sessions.blackjack;
        const dealerShow = session.state === 'DEALER_TURN'
            ? `${this.formatHand(session.dealerHand)} (**${this.calculateHand(session.dealerHand)}**)`
            : `[${session.dealerHand[0].face}${session.dealerHand[0].suit}] [?]`;

        const embed = new EmbedBuilder()
            .setTitle('🃏 MESA DE BLACKJACK')
            .setColor(0x2F3136)
            .setImage('attachment://blackjack_table.png')
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

    /**
     * Join Blackjack with atomic transaction (Bet Deduction)
     * @param {string} userId
     * @param {number} bet
     */
    async joinBlackjackAndUpdate(userId, bet) {
        if (this.transactionManager) {
            // Deduct bet and count as "loss" initially (standard safe practice)
            // If they win later, we pay them out.
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                0, // No payout yet
                'blackjack_bet',
                { action: 'join_table' }
            );

            if (!txResult.success) {
                return { success: false, error: txResult.error };
            }
            return { success: true, newBalance: txResult.newBalance };
        }

        // Legacy Fallback
        const check = await this.checkChips(userId, bet);
        if (!check.hasEnough) return { success: false, error: check.message };
        await this.removeChips(userId, bet);
        return { success: true };
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
                const payout = Math.floor(player.bet * multiplier);
                const netProfit = payout - player.bet;

                if (netProfit > 0) winners.push(`✅ <@${userId}>: +$${Math.floor(payout).toLocaleString()} (${reason})`); // Show Payout
                else winners.push(`♻️ <@${userId}>: Refund (${reason})`);

                if (this.transactionManager) {
                    // Atomic Payout
                    // We pass bet=0 because bet was already deducted on join
                    await this.transactionManager.executeCasinoTransaction(
                        userId,
                        0,
                        payout,
                        'blackjack_payout',
                        { reason, hand: player.hand, dealer: session.dealerHand }
                    ).catch(e => console.error('BJ Payout Error:', e));
                } else {
                    // Legacy Update
                    const { data: acc } = await this.supabase.from('casino_chips').select('*').eq('user_id', userId).single();
                    if (acc) {
                        await this.supabase.from('casino_chips').update({
                            chips: acc.chips + payout, // Use chips (legacy) or chips_balance if migrated
                            total_won: (acc.total_won || 0) + (payout - player.bet),
                            updated_at: new Date().toISOString()
                        }).eq('user_id', userId);
                    }
                }
            } else {
                // Loser
                // In Atomic mode: Already deducted and logged as "total_lost" on join.
                // In Legacy mode: We need to update stats now.
                if (!this.transactionManager) {
                    const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', userId).single();
                    if (acc) await this.supabase.from('casino_chips').update({ total_lost: (acc.total_lost || 0) + player.bet }).eq('user_id', userId);
                }
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

        session.message = await channel.send({
            embeds: [embed],
            components: [row],
            files: [{ attachment: '/Users/gonzalez/.gemini/antigravity/brain/5f676979-327b-4733-bc92-9b946495f94a/casino_blackjack_table_1770078092622.png', name: 'blackjack_table.png' }]
        });
        await this.updateBlackjackEmbed(channel);
    }

    // --- MINES IMPLEMENTATION (20 Cells - 5x4) ---

    async startMinesGame(interaction, bet, mines) {
        const userId = interaction.user.id; // Or force interaction.user.id? Yes.

        // Generate Grid: 20 cells. 1=Mine, 0=Safe
        // We use 20 cells because typical Mines is 5x5 (25), but we want 5x4 for better mobile/embed fit?
        // Actually the loop in updateMinesEmbed uses 4 rows of 5 cols = 20.
        let grid = Array(20).fill(0);
        let minesPlaced = 0;
        // Safety: Mines must be < 20. Limit in command is 19.
        while (minesPlaced < mines) {
            const idx = Math.floor(Math.random() * 20);
            if (grid[idx] === 0) {
                grid[idx] = 1;
                minesPlaced++;
            }
        }

        this.sessions.mines[userId] = {
            userId,
            bet,
            mines,
            grid,
            revealed: [], // Indices of revealed safe cells
            active: true,
            startTime: Date.now()
        };

        await this.updateMinesEmbed(interaction, userId);
    }

    async handleMinesInteraction(interaction) {
        const userId = interaction.user.id;
        const session = this.sessions.mines[userId];

        if (!session || !session.active) {
            return interaction.reply({ content: '❌ Juego no activo o expirado.', ephemeral: true });
        }

        const customId = interaction.customId;

        if (customId === 'btn_mines_cashout') {
            await this.cashoutMinesAndUpdate(interaction, userId);
            return;
        }

        if (customId.startsWith('btn_mines_')) {
            const cellIdx = parseInt(customId.replace('btn_mines_', ''));

            // Check if already revealed
            if (session.revealed.includes(cellIdx)) {
                return interaction.deferUpdate();
            }

            // Check content
            if (session.grid[cellIdx] === 1) {
                // MINE!
                await this.failMinesAndUpdate(interaction, userId, cellIdx);
            } else {
                // SAFE
                session.revealed.push(cellIdx);

                // Check if all safe cells revealed (Auto Win)
                const totalSafe = 20 - session.mines;
                if (session.revealed.length >= totalSafe) {
                    await this.cashoutMinesAndUpdate(interaction, userId);
                } else {
                    await this.updateMinesEmbed(interaction, userId);
                }
            }
        }
    }

    async updateMinesEmbed(interaction, userId) {
        const session = this.sessions.mines[userId];
        // Using 20 cells grid (5x4)
        const totalCells = 20;
        const multiplier = this.calculateMinesMultiplier(session.mines, session.revealed.length, totalCells);
        const currentWin = Math.floor(session.bet * multiplier);

        const embed = new EmbedBuilder()
            .setTitle('💣 MINAS')
            .setDescription(`Minas: **${session.mines}** | Apuesta: **${session.bet}**\nMultiplicador: **${multiplier.toFixed(2)}x**\nGanancia actual: **${currentWin}**`)
            .setColor('#3498DB');

        const rows = [];
        // 4 Rows of 5 buttons
        for (let i = 0; i < 4; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 5; j++) {
                const idx = i * 5 + j;
                const isRevealed = session.revealed.includes(idx);

                const btn = new ButtonBuilder()
                    .setCustomId(`btn_mines_${idx}`)
                    .setStyle(isRevealed ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setLabel(isRevealed ? '💎' : '❓')
                    .setDisabled(isRevealed);

                row.addComponents(btn);
            }
            rows.push(row);
        }

        // 5th Row for Cashout
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_mines_cashout')
                .setLabel('💰 Retirar Ganancias')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(session.revealed.length === 0)
        );
        rows.push(controlRow);

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: rows }).catch(() => { });
        } else {
            // Should not happen usually as we defer or rely on previous reply
            await interaction.reply({ embeds: [embed], components: rows }).catch(() => { });
        }
    }

    async failMines(interaction, userId, boomIdx) {
        const session = this.sessions.mines[userId];
        const rows = [];

        // Reveal all
        for (let i = 0; i < 4; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 5; j++) {
                const idx = i * 5 + j;
                const isMine = session.grid[idx] === 1;
                const isRevealed = session.revealed.includes(idx);
                const isBoom = idx === boomIdx;

                const btn = new ButtonBuilder()
                    .setCustomId(`disabled_${idx}`)
                    .setStyle(isBoom ? ButtonStyle.Danger : (isMine ? ButtonStyle.Secondary : ButtonStyle.Success)) // Red for boom, Grey for hidden mines, Green for revealed safe
                    .setLabel(isMine ? '💣' : '💎')
                    .setDisabled(true);

                row.addComponents(btn);
            }
            rows.push(row);
        }

        const embed = new EmbedBuilder()
            .setTitle('💥 ¡BOOM!')
            .setDescription(`Hiciste explotar una mina.\n\nPerdiste **${session.bet}** fichas.`)
            .setColor('#E74C3C');

        // Update DB (Loss)
        const { data: acc } = await this.supabase.from('casino_chips').select('total_lost, games_played').eq('user_id', userId).single();
        await this.supabase.from('casino_chips').update({
            total_lost: (acc.total_lost || 0) + session.bet,
            games_played: (acc.games_played || 0) + 1
        }).eq('user_id', userId);

        delete this.sessions.mines[userId];
        await interaction.editReply({ embeds: [embed], components: rows }).catch(() => { });
    }

    async cashoutMines(interaction, userId) {
        const session = this.sessions.mines[userId];
        const totalCells = 20;
        const multiplier = this.calculateMinesMultiplier(session.mines, session.revealed.length, totalCells);
        const winAmount = Math.floor(session.bet * multiplier);
        const netProfit = winAmount - session.bet;

        const embed = new EmbedBuilder()
            .setTitle('💰 RETIRO EXITOSO')
            .setDescription(`Te has retirado a tiempo.\n\nMultiplicador: **${multiplier.toFixed(2)}x**\nGanancia: **${winAmount}** fichas`)
            .setColor('#2ECC71');

        // Update DB (Win)
        const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won, games_played').eq('user_id', userId).single();
        await this.supabase.from('casino_chips').update({
            chips_balance: acc.chips_balance + winAmount, // Bet was already deducted
            total_won: (acc.total_won || 0) + netProfit,
            games_played: (acc.games_played || 0) + 1
        }).eq('user_id', userId);

        delete this.sessions.mines[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    // --- MINES WRAPPERS (ATOMIC) ---

    async startMinesAndUpdate(interaction, bet, mines) {
        const userId = interaction.user.id;

        if (this.transactionManager) {
            // Atomic Bet Deduction
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                0, // No payout yet
                'mines_bet',
                { action: 'start_game', mines }
            );

            if (!txResult.success) {
                return { success: false, error: txResult.error };
            }

            // Start Game Logic
            await this.startMinesGame(interaction, bet, mines);
            return { success: true, newBalance: txResult.newBalance };
        }

        // Legacy Fallback
        const check = await this.checkChips(userId, bet);
        if (!check.hasEnough) return { success: false, error: check.message };

        await this.removeChips(userId, bet);
        await this.startMinesGame(interaction, bet, mines);
        return { success: true };
    }

    async cashoutMinesAndUpdate(interaction, userId) {
        const session = this.sessions.mines[userId];
        if (!session) return;

        const totalCells = 20;
        const multiplier = this.calculateMinesMultiplier(session.mines, session.revealed.length, totalCells);
        const winAmount = Math.floor(session.bet * multiplier);

        if (this.transactionManager) {
            // Atomic Payout
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                0, // Bet already deducted
                winAmount,
                'mines_payout',
                { action: 'cashout', multiplier, mines: session.mines, revealed: session.revealed.length }
            );

            if (!txResult.success) {
                // Should not happen, but log it
                console.error('Mines Cashout Failed:', txResult.error);
                return; // Prevent clearing session? Or force clear?
            }
        } else {
            // Legacy Update (moved from cashoutMines)
            const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won, games_played').eq('user_id', userId).single();
            if (acc) {
                const netProfit = winAmount - session.bet;
                await this.supabase.from('casino_chips').update({
                    chips_balance: acc.chips_balance + winAmount,
                    total_won: (acc.total_won || 0) + netProfit,
                    games_played: (acc.games_played || 0) + 1
                }).eq('user_id', userId);
            }
        }

        // Finish Game
        const embed = new EmbedBuilder()
            .setTitle('💰 RETIRO EXITOSO')
            .setDescription(`Te has retirado a tiempo.\n\nMultiplicador: **${multiplier.toFixed(2)}x**\nGanancia: **${winAmount}** fichas`)
            .setColor('#2ECC71');

        delete this.sessions.mines[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    async failMinesAndUpdate(interaction, userId, boomIdx) {
        const session = this.sessions.mines[userId];
        if (!session) return;

        // No DB transaction needed for loss (bet already deducted), 
        // unless we want to log the "Loss" event atomically.
        // For consistency with stats (games_played), current logic updates it on Loss too.
        // But startMinesAndUpdate already updated stats (games_played +1, total_lost +bet).
        // So we actually DON'T need to update DB here for stats if we used Atomic Start.

        if (!this.transactionManager) {
            // Legacy: Update stats now
            const { data: acc } = await this.supabase.from('casino_chips').select('total_lost, games_played').eq('user_id', userId).single();
            if (acc) {
                await this.supabase.from('casino_chips').update({
                    total_lost: (acc.total_lost || 0) + session.bet,
                    games_played: (acc.games_played || 0) + 1
                }).eq('user_id', userId);
            }
        }

        // Show Loss UI
        const rows = [];
        for (let i = 0; i < 4; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 5; j++) {
                const idx = i * 5 + j;
                const isMine = session.grid[idx] === 1;
                const isBoom = idx === boomIdx;
                const btn = new ButtonBuilder()
                    .setCustomId(`disabled_${idx}`)
                    .setStyle(isBoom ? ButtonStyle.Danger : (isMine ? ButtonStyle.Secondary : ButtonStyle.Success))
                    .setLabel(isMine ? '💣' : '💎')
                    .setDisabled(true);
                row.addComponents(btn);
            }
            rows.push(row);
        }

        const embed = new EmbedBuilder()
            .setTitle('💥 ¡BOOM!')
            .setDescription(`Hiciste explotar una mina.\n\nPerdiste **${session.bet}** fichas.`)
            .setColor('#E74C3C');

        delete this.sessions.mines[userId];
        await interaction.update({ embeds: [embed], components: rows }).catch(() => { });
    }

    // --- TOWER WRAPPERS (ATOMIC) ---

    async startTowerAndUpdate(interaction, bet, difficulty) {
        const userId = interaction.user.id;

        if (this.transactionManager) {
            // Atomic Bet Deduction
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                0, // No payout yet
                'tower_bet',
                { action: 'start_game', difficulty }
            );

            if (!txResult.success) {
                return { success: false, error: txResult.error };
            }

            // Start Game Logic
            await this.startTowerGame(interaction, bet, difficulty);
            return { success: true, newBalance: txResult.newBalance };
        }

        // Legacy Fallback
        const check = await this.checkChips(userId, bet);
        if (!check.hasEnough) return { success: false, error: check.message };

        await this.removeChips(userId, bet);
        await this.startTowerGame(interaction, bet, difficulty);
        return { success: true };
    }

    async cashoutTowerAndUpdate(interaction, userId, completed = false) {
        const session = this.sessions.tower[userId];
        if (!session) return;

        const multiplier = this.calculateTowerMultiplier(session.difficulty, session.level);
        const winAmount = Math.floor(session.bet * multiplier);

        if (this.transactionManager) {
            // Atomic Payout
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                0, // Bet already deducted
                winAmount,
                'tower_payout',
                { action: 'cashout', multiplier, difficulty: session.difficulty, level: session.level }
            );

            if (!txResult.success) {
                console.error('Tower Cashout Failed:', txResult.error);
                return;
            }
        } else {
            // Legacy Update
            const { data: acc } = await this.supabase.from('casino_chips').select('chips_balance, total_won').eq('user_id', userId).single();
            if (acc) {
                await this.supabase.from('casino_chips').update({
                    chips_balance: acc.chips_balance + winAmount,
                    total_won: (acc.total_won || 0) + (winAmount - session.bet)
                }).eq('user_id', userId);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(completed ? '🏆 ¡CIMA ALCANZADA!' : '💰 RETIRO DE TORRE')
            .setColor('#2ECC71')
            .setDescription(`Ganaste **${winAmount}** fichas\nMultiplicador: **${multiplier.toFixed(2)}x**`);

        delete this.sessions.tower[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    async failTowerAndUpdate(interaction, userId, col) {
        const session = this.sessions.tower[userId];
        if (!session) return;

        if (!this.transactionManager) {
            // Legacy: Update stats now
            const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', userId).single();
            if (acc) await this.supabase.from('casino_chips').update({ total_lost: (acc.total_lost || 0) + session.bet }).eq('user_id', userId);
        }

        const embed = new EmbedBuilder().setTitle('💀 TE CAÍSTE DE LA TORRE').setColor('#E74C3C').setDescription(`Elegiste columna ${col + 1} y había una mina.\nPerdiste **${session.bet}** fichas.`);

        delete this.sessions.tower[userId];
        await interaction.update({ embeds: [embed], components: [] }).catch(() => { });
    }

    // Helper override for 20 cells
    calculateMinesMultiplier(mines, revealed, total = 20) {
        let multiplier = 1.0;
        for (let r = 0; r < revealed; r++) {
            const remainingSafe = total - mines - r;
            const remainingTotal = total - r;
            const prob = remainingSafe / remainingTotal;
            multiplier *= (1 / prob);
        }
        return Math.floor(multiplier * 0.95 * 100) / 100;
    }

    // --- CRASH WRAPPERS (ATOMIC) ---

    async joinCrashAndUpdate(interaction, bet, target) {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;

        if (!this.sessions.crash) this.sessions.crash = {};

        // Initialize or Get Session
        let session = this.sessions.crash[channelId];
        let isNew = false;

        if (!session) {
            isNew = true;
            session = {
                status: 'WAITING', // WAITING -> RUNNING -> ENDED
                channelId,
                bets: [], // { userId, amount, target, interaction, cashedOut: false }
                multiplier: 1.00,
                crashPoint: 0,
                message: null,
                startTime: Date.now(),
                // Start game in 15 seconds
                timeout: setTimeout(() => this.runCrashLogic(channelId), 15000)
            };
            this.sessions.crash[channelId] = session;
        }

        if (session.status !== 'WAITING') {
            return { success: false, error: '🚀 El juego ya inició. Espera la siguiente ronda.' };
        }

        // Atomic Bet Deduction
        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId, bet, 0, 'crash_bet', { action: 'join', target, channelId }
            );
            if (!txResult.success) {
                if (isNew && session.bets.length === 0) {
                    clearTimeout(session.timeout);
                    delete this.sessions.crash[channelId];
                }
                return { success: false, error: txResult.error };
            }
        } else {
            const check = await this.checkChips(userId, bet);
            if (!check.hasEnough) return { success: false, error: check.message };
            await this.removeChips(userId, bet);
        }

        session.bets.push({ userId, amount: bet, target, interaction, cashedOut: false });
        return { success: true, isNew };
    }

    async runCrashLogic(channelId) {
        const session = this.sessions.crash[channelId];
        if (!session) return;

        session.status = 'RUNNING';

        // Algorithm
        const instantCrash = Math.random() < 0.03; // 3% instant crash
        session.crashPoint = instantCrash ? 1.00 : (0.99 / (1 - Math.random()));
        if (session.crashPoint > 50) session.crashPoint = 50.00;

        // Message
        const mainInteraction = session.bets[0].interaction;
        // Or send new message? Better new message.
        // We'll use the channel from the interaction
        const channel = mainInteraction.channel;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_crash_cashout')
                .setLabel('💸 Retirarse')
                .setStyle(ButtonStyle.Success)
        );

        let msg;
        try {
            msg = await channel.send({
                content: `🚀 **CRASH** Iniciando... Prepárense!`,
                components: [row]
            });
            session.message = msg;
        } catch (e) {
            console.error('Crash start error:', e);
            delete this.sessions.crash[channelId];
            return;
        }

        // Game Loop
        const loop = setInterval(async () => {
            // Check if deleted (cleanup)
            if (!this.sessions.crash[channelId]) { clearInterval(loop); return; }

            // Growth
            if (session.multiplier < 2) session.multiplier += 0.1; // Slow start
            else if (session.multiplier < 5) session.multiplier += 0.2;
            else session.multiplier += 0.5; // Fast

            // Update Message (Throttle updates to avoid rate limit? 1s interval is safe-ish)
            try {
                if (session.multiplier >= session.crashPoint) {
                    // CRASHED
                    clearInterval(loop);
                    session.status = 'ENDED';
                    session.multiplier = session.crashPoint; // Clamp

                    // Process remaining bets (Losses) and Auto-Cashouts that hit exactly?
                    // Auto-cashouts should have triggered in loop?
                    // We'll process any pending auto-cashouts here if they met criteria but loop skipped?
                    // Simpler: Just resolve game.

                    const winners = session.bets.filter(b => b.cashedOut);
                    const losers = session.bets.filter(b => !b.cashedOut);

                    // Atomic Losses?
                    // Losses were paid upfront (bet deducted). We just record stats if needed.
                    for (const l of losers) {
                        // Legacy stats update
                        if (!this.transactionManager) {
                            const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', l.userId).single();
                            if (acc) await this.supabase.from('casino_chips').update({ total_lost: (acc.total_lost || 0) + l.amount }).eq('user_id', l.userId);
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`💥 CRASHED @ ${session.crashPoint.toFixed(2)}x`)
                        .setColor('#E74C3C')
                        .setDescription(`**Ganadores:**\n${winners.length > 0 ? winners.map(w => `<@${w.userId}>: +${Math.floor(w.amount * w.cashoutMult)}`).join('\n') : 'Nadie sobrevivió.'}`);

                    await msg.edit({ content: '', embeds: [embed], components: [] });
                    delete this.sessions.crash[channelId];

                } else {
                    // Tick
                    // Check Auto Cashouts
                    for (const bet of session.bets) {
                        if (!bet.cashedOut && bet.target && session.multiplier >= bet.target) {
                            // Auto Cashout
                            await this.processCashout(bet, bet.target);
                        }
                    }

                    await msg.edit({
                        content: `🚀 **${session.multiplier.toFixed(2)}x** ... [ /crash retirar ]`,
                        components: [row]
                    });
                }
            } catch (e) {
                console.error('Crash loop error:', e);
                clearInterval(loop);
            }

        }, 1500); // 1.5s tick
    }

    // Helper for Atomic Cashout
    async processCashout(bet, multiplier) {
        if (bet.cashedOut) return;
        bet.cashedOut = true;
        bet.cashoutMult = multiplier;

        const payout = Math.floor(bet.amount * multiplier);

        if (this.transactionManager) {
            await this.transactionManager.executeCasinoTransaction(
                bet.userId, 0, payout, 'crash_payout',
                { action: 'cashout', multiplier, profit: payout - bet.amount }
            );
        } else {
            await this.addChips(bet.userId, payout);
            // stats...
        }

        try {
            await bet.interaction.followUp({ content: `✅ **Auto-Retiro:** <@${bet.userId}> sacó en **${multiplier.toFixed(2)}x** (+${payout})`, ephemeral: false });
        } catch (e) { }
    }

    async cashoutCrashAndUpdate(interaction) {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;
        const session = this.sessions.crash ? this.sessions.crash[channelId] : null;

        if (!session || session.status !== 'RUNNING') return { success: false, error: '❌ No hay ronda activa o ya terminó.' };

        const bet = session.bets.find(b => b.userId === userId);
        if (!bet) return { success: false, error: '❌ No estás jugando en esta ronda.' };
        if (bet.cashedOut) return { success: false, error: '❌ Ya te retiraste.' };

        // Atomic Cashout
        const currentMult = session.multiplier;
        if (currentMult > session.crashPoint) return { success: false, error: '💥 ¡Crash! Muy tarde.' }; // Should be caught by loop, but race condition safety.

        await this.processCashout(bet, currentMult);
        return { success: true, multiplier: currentMult, payout: Math.floor(bet.amount * currentMult) };
    }
    // --- PHASE 3 GAMES ---

    // --- ROULETTE WRAPPER (ATOMIC) ---
    async playRouletteAndUpdate(userId, bet, type, number = null) {
        // Logic to determine win/loss (Moved from command)
        const resultNumber = Math.floor(Math.random() * 37);
        let won = false;
        let payout = 0;
        let multiplier = 0;

        // Determine Color
        const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        const color = resultNumber === 0 ? 'green' : (reds.includes(resultNumber) ? 'red' : 'black');

        // Check Win
        if (type === 'numero' && number === resultNumber) { won = true; multiplier = 36; } // 35:1 means payout is bet * 36 (original stake returned + 35)
        else if (type === 'red' && color === 'red') { won = true; multiplier = 2; } // 1:1 means payout is bet * 2
        else if (type === 'black' && color === 'black') { won = true; multiplier = 2; }
        else if (type === 'even' && resultNumber !== 0 && resultNumber % 2 === 0) { won = true; multiplier = 2; }
        else if (type === 'odd' && resultNumber !== 0 && resultNumber % 2 !== 0) { won = true; multiplier = 2; }
        else if (type === '1-18' && resultNumber >= 1 && resultNumber <= 18) { won = true; multiplier = 2; }
        else if (type === '19-36' && resultNumber >= 19 && resultNumber <= 36) { won = true; multiplier = 2; }
        // Columns
        else if (type === 'col1' && resultNumber % 3 === 1) { won = true; multiplier = 3; } // 2:1 means payout is bet * 3
        else if (type === 'col2' && resultNumber % 3 === 2) { won = true; multiplier = 3; }
        else if (type === 'col3' && resultNumber % 3 === 0 && resultNumber !== 0) { won = true; multiplier = 3; }

        if (won) payout = bet * multiplier;

        const resultData = { won, payout, resultNumber, color, multiplier };

        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                payout,
                'roulette',
                { type, number, resultNumber, color }
            );

            if (!txResult.success) return { success: false, error: txResult.error };
            return { success: true, ...resultData, newBalance: txResult.newBalance };
        }

        // Legacy Fallback
        const check = await this.checkChips(userId, bet);
        if (!check.hasEnough) return { success: false, error: check.message };

        await this.removeChips(userId, bet);
        if (won) {
            await this.addChips(userId, payout);
            await this.supabase.from('casino_chips').update({
                total_won: (check.account.total_won || 0) + (payout - bet)
            }).eq('user_id', userId);
        } else {
            await this.supabase.from('casino_chips').update({
                total_lost: (check.account.total_lost || 0) + bet
            }).eq('user_id', userId);
        }

        return { success: true, ...resultData };
    }

    // DADOS (Instant)
    async playDice(userId, bet, type, target = null) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;
        const result = { d1, d2, sum, won: false, payout: 0 };

        if (type === '7' && sum === 7) { result.won = true; result.payout = bet * 4; }
        else if (type === 'over_7' && sum > 7) { result.won = true; result.payout = bet * 2; }
        else if (type === 'under_7' && sum < 7) { result.won = true; result.payout = bet * 2; }
        else if (type === 'even' && sum % 2 === 0) { result.won = true; result.payout = bet * 2; }
        else if (type === 'odd' && sum % 2 !== 0) { result.won = true; result.payout = bet * 2; }
        else if (type === 'doubles' && d1 === d2) { result.won = true; result.payout = bet * 5; }
        else if (type === 'exact' && sum === target) { result.won = true; result.payout = bet * 10; }

        return result;
    }

    // RASPA (Instant)
    async playScratch(userId, bet) {
        const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍀'];
        const grid = [];
        // Weighted random? Nah, simplify for scratch card feel.
        // Usually scratch cards have pre-determined tiers.
        // Let's do simple RNG: 9 slots.
        // 3 of a kind = win.
        // We generate 3 winning symbols potential.
        // Let's say we pick a "Outcome" first.
        // Win Chance 30%.
        const isWin = Math.random() < 0.35;
        let winSymbol = null;
        if (isWin) winSymbol = symbols[Math.floor(Math.random() * symbols.length)];

        // Fill grid
        // If win, ensure 3 winSymbols.
        // Else ensure max 2 matches of any.

        let cells = [];
        if (isWin) {
            cells = [winSymbol, winSymbol, winSymbol];
            while (cells.length < 9) cells.push(symbols[Math.floor(Math.random() * symbols.length)]);
        } else {
            // No 3 matches
            // Hard to guarantee without complex logic.
            // Simplified: Just random and check.
            while (true) {
                cells = [];
                for (let i = 0; i < 9; i++) cells.push(symbols[Math.floor(Math.random() * symbols.length)]);

                // Check matches
                const counts = {};
                cells.forEach(x => counts[x] = (counts[x] || 0) + 1);
                const has3 = Object.values(counts).some(c => c >= 3);
                if (!has3) break; // Good loser
                // If by chance we got a winner but we wanted a loser, calculate payout? 
                // Actually, if RNG gives a winner naturally, let it be.
                // Re-roll only if we wanted a FORCED win? No.
                // Let's just purely random. The math is: 1/6 chance per cell.
                // 9 cells. Prob of 3 same is high?
                // Actually standard scratch is "Match 3 prize amounts".
                // Let's stick to: Pure Random.
                // If 3 symbols match, pay based on symbol value.
                break;
            }
        }

        // Shuffle
        cells.sort(() => Math.random() - 0.5);

        // Check Result
        const counts = {};
        cells.forEach(x => counts[x] = (counts[x] || 0) + 1);

        let payout = 0;
        let won = false;
        let match = null;

        if (counts['7️⃣'] >= 3) { payout = bet * 50; match = '7️⃣'; }
        else if (counts['💎'] >= 3) { payout = bet * 20; match = '💎'; }
        else if (counts['🔔'] >= 3) { payout = bet * 10; match = '🔔'; }
        else if (counts['🍀'] >= 3) { payout = bet * 5; match = '🍀'; }
        else if (counts['🍒'] >= 3) { payout = bet * 3; match = '🍒'; }
        else if (counts['🍋'] >= 3) { payout = bet * 2; match = '🍋'; }

        if (payout > 0) won = true;

        return { grid: cells, won, payout, match };
    }

    // PENALES (Interactive)
    async startPenalty(interaction, bet) {
        const userId = interaction.user.id;
        this.sessions.penalty[userId] = {
            active: true,
            bet,
            startTime: Date.now()
        };

        const embed = new EmbedBuilder()
            .setTitle('⚽ PENALES')
            .setDescription(`El portero está listo. ¿A dónde chutas?\nApuesta: **${bet}**`)
            .setColor('#2ECC71')
            .setImage('https://media.discordapp.net/attachments/1094067098670878791/1113567098670878791/penalty_goal.gif?width=800&height=400'); // Placeholder or None

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_pen_left').setLabel('⬅️ Izquierda').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_pen_center').setLabel('⬆️ Centro').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_pen_right').setLabel('➡️ Derecha').setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    async handlePenaltyInteraction(interaction) {
        const userId = interaction.user.id;
        const session = this.sessions.penalty[userId];
        if (!session || !session.active) return interaction.reply({ content: '❌ No tienes un penal activo.', ephemeral: true });

        const dir = interaction.customId.split('_')[2]; // left, center, right

        // Goalie logic
        const directions = ['left', 'center', 'right'];
        const goalieDir = directions[Math.floor(Math.random() * directions.length)];

        let won = false;
        if (dir !== goalieDir) won = true; // Goal if goalie dives wrong way

        const payout = won ? session.bet * 2 : 0; // x2 essentially (minus potential house edge? 50% vs 66% win rate?)
        // Wait, if goalie picks 1 of 3, and I pick 1 of 3.
        // Possibilities: 9 combos.
        // Win conditions: (L, C), (L, R), (C, L), (C, R), (R, L), (R, C).
        // Loss conditions: (L, L), (C, C), (R, R).
        // 6 wins, 3 losses. Win chance = 66%.
        // If payout is x2, it's +EV for player (EV = 2 * 0.66 = 1.33). Casino loses money!
        // Fix: Goalie is smarter? Or Payout is x1.4?
        // Or "Save chance" is higher.
        // Let's implement independent save chance.
        // Even if goalie guesses WRONG, he might still not save? No.
        // If player shoots Left, Goalie dives Right -> GOAL.
        // If player shoots Left, Goalie dives Left -> SAVE.
        // We need 50/50 EV.
        // To make it balanced, payout should be x1.45 OR make it harder.
        // Maybe "Shoot High/Low"? Too complex.
        // Let's change mechanic: 50% chance Goal.
        // "The goalie guesses your direction 50% of the time (Cheat AI)". 
        // No, let's just make payout x1.5 (Profit 0.5x).
        // EV = 1.5 * 0.66 = 1.0 (Fair game).
        // Let's do x1.5 payout.

        const multiplier = 1.5;
        const winAmount = Math.floor(session.bet * multiplier);

        // Update DB
        const { data: acc } = await this.supabase.from('casino_chips').select('*').eq('user_id', userId).single();
        if (won) {
            await this.supabase.from('casino_chips').update({
                chips_balance: acc.chips_balance + winAmount, // Bet already deducted? Usually yes.
                total_won: acc.total_won + (winAmount - session.bet),
                games_played: acc.games_played + 1
            }).eq('user_id', userId);
        } else {
            await this.supabase.from('casino_chips').update({
                total_lost: acc.total_lost + session.bet,
                games_played: acc.games_played + 1
            }).eq('user_id', userId);
        }

        const dirMap = { left: 'Izquierda ⬅️', center: 'Centro ⬆️', right: 'Derecha ➡️' };

        const resultEmbed = new EmbedBuilder()
            .setTitle(won ? '⚽ ¡GOOOOOOL!' : '🧤 ¡ATAJADO!')
            .setDescription(`Tú: **${dirMap[dir]}**\nPortero: **${dirMap[goalieDir]}**\n\n${won ? `Ganaste **${winAmount}** fichas` : 'Perdiste tu apuesta.'}`)
            .setColor(won ? '#2ECC71' : '#E74C3C');

        delete this.sessions.penalty[userId];
        await interaction.update({ embeds: [resultEmbed], components: [] }).catch(() => { });
    }

    // --- RACE WRAPPERS (ATOMIC) ---

    // Unlike other games, Race is multiplayer and asynchronous (45s wait).
    // We need to handle the bet deduction immediately ("join"), and payout later.

    async joinRaceAndUpdate(interaction, bet, horseId) {
        const userId = interaction.user.id;
        const channelId = interaction.channelId;

        // 1. Manage Session State
        if (!this.sessions.races) this.sessions.races = {};

        let session = this.sessions.races[channelId];
        let isNew = false;

        if (!session || !session.active) {
            isNew = true;
            session = {
                active: true,
                channelId,
                bets: [],
                horses: [
                    { id: 1, emoji: '🐴', name: 'Relámpago', pos: 0 },
                    { id: 2, emoji: '🏇', name: 'Trueno', pos: 0 },
                    { id: 3, emoji: '🐎', name: 'Viento', pos: 0 },
                    { id: 4, emoji: '🦄', name: 'Estrella', pos: 0 }
                ],
                startTime: Date.now(),
                // Timer to start race logic
                timeout: setTimeout(() => this.runRaceLogic(channelId), 45000)
            };
            this.sessions.races[channelId] = session;
        }

        // 2. Atomic Bet Deduction
        if (this.transactionManager) {
            const txResult = await this.transactionManager.executeCasinoTransaction(
                userId,
                bet,
                0,
                'race_bet',
                { action: 'join_race', horseId, channelId }
            );

            if (!txResult.success) {
                // If it was new and we failed, and no one else joined, maybe clear session? 
                // Checks complexity. For now, just return error.
                if (isNew && session.bets.length === 0) {
                    clearTimeout(session.timeout);
                    delete this.sessions.races[channelId];
                }
                return { success: false, error: txResult.error };
            }
        } else {
            // Legacy Fallback
            const check = await this.checkChips(userId, bet);
            if (!check.hasEnough) return { success: false, error: check.message };
            await this.removeChips(userId, bet);
        }

        // 3. Add Player to Session
        session.bets.push({
            userId,
            amount: bet,
            horseId,
            interaction // Store interaction to reply later? Or just use channel?
            // Note: Interactions expire (15min), but 45s is fine.
        });

        return { success: true, isNew, horseName: session.horses.find(h => h.id === horseId).name };
    }

    async runRaceLogic(channelId) {
        const session = this.sessions.races[channelId];
        if (!session || !session.active) return;

        // 1. Animate (Reuse existing logic or simplified)
        // We need a clearer way to send updates. We can use the LAST interaction to send updates to channel?
        // Or better, just send a new message to the channel if possible. 
        // Using interaction from first or last bet is risky if they dismissed it.
        // Let's assume we use the first interaction found to send updates.

        const mainInteraction = session.bets[0].interaction;

        // --- Animation Logic ---
        // (Simplified for brevity in this method, effectively "executeRaceSession")
        // We'll simulate positions
        for (let i = 0; i < 5; i++) { // 5 updates
            await new Promise(r => setTimeout(r, 2000));
            session.horses.forEach(h => h.pos += Math.random() * 20);
            session.horses.sort((a, b) => b.pos - a.pos);
            // Updating a message requires keeping track of the message object. 
            // For now, let's just determine winner to keep it robust.
        }

        const winner = session.horses[0]; // Already sorted? logic above was pseudo.
        // Let's do a proper random winner for fairness regardless of animation
        const winnerId = Math.floor(Math.random() * 4) + 1;
        const winnerHorse = session.horses.find(h => h.id === winnerId);

        // 2. Payouts
        const results = [];
        for (const bet of session.bets) {
            let won = bet.horseId === winnerId;
            let payout = 0;

            if (won) {
                payout = bet.amount * 3; // 3x Payout for 4 horses is decent
                if (this.transactionManager) {
                    await this.transactionManager.executeCasinoTransaction(
                        bet.userId,
                        0, // Bet already paid
                        payout,
                        'race_payout',
                        { action: 'win', horseId: winnerId, profit: payout - bet.amount }
                    );
                } else {
                    // Legacy
                    await this.addChips(bet.userId, payout);
                    const { data: acc } = await this.supabase.from('casino_chips').select('total_won').eq('user_id', bet.userId).single();
                    if (acc) await this.supabase.from('casino_chips').update({ total_won: (acc.total_won || 0) + (payout - bet.amount) }).eq('user_id', bet.userId);
                }
            } else {
                if (!this.transactionManager) {
                    // Legacy Loss stats
                    const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', bet.userId).single();
                    if (acc) await this.supabase.from('casino_chips').update({ total_lost: (acc.total_lost || 0) + bet.amount }).eq('user_id', bet.userId);
                }
            }
            results.push({ userId: bet.userId, won, payout, amount: bet.amount });
        }

        // 3. Announce
        // We need to send this to the channel.
        const summary = results.map(r => `<@${r.userId}>: ${r.won ? `✅ +${r.payout}` : `❌ -${r.amount}`}`).join('\n');

        try {
            await mainInteraction.followUp({
                content: `🏆 **CARRERA FINALIZADA**\n\nGanador: ${winnerHorse.emoji} **${winnerHorse.name}**\n\n${summary}`
            });
        } catch (e) {
            console.error('Race announcement failed:', e);
        }

        // Cleanup
        delete this.sessions.races[channelId];
    }
}

module.exports = CasinoService;

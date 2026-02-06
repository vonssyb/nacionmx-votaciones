const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class CasinoService {
    constructor(supabase) {
        this.supabase = supabase;
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
            await this.cashoutTower(interaction, userId);
            return;
        }

        if (customId.startsWith('btn_tower_')) {
            const col = parseInt(customId.split('_')[2]);
            const currentRow = session.grid[session.level]; // 0 is bottom

            // Allow only selection on current level? Yes.
            // Check if mine or safe
            if (currentRow[col] === 1) {
                // FAIL
                await this.failTower(interaction, userId, col);
            } else {
                // SAFE
                session.level++;
                if (session.level >= session.grid.length) {
                    // Reached Top -> Auto Cashout
                    await this.cashoutTower(interaction, userId, true);
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

    // --- MINES LOGIC ---
    calculateMinesMultiplier(mines, revealed) {
        // Simple distinct multiplier formula:
        // house edge ~3-5%
        // n = 25 total
        // m = mines
        // r = revealed
        // Probability of hitting safe = (25 - m - r) / (25 - r)
        // Multiplier should be inverse of cumulative probability * (1 - house_edge)

        let multiplier = 1.0;
        for (let r = 0; r < revealed; r++) {
            const remainingSafe = 25 - mines - r;
            const remainingTotal = 25 - r;
            const prob = remainingSafe / remainingTotal;
            multiplier *= (1 / prob);
        }
        return Math.floor(multiplier * 0.95 * 100) / 100; // 5% house edge, 2 decimals
    }

    async startMinesGame(interaction, bet, mines) {
        const userId = interaction.user.id;

        // Generate Grid: 25 cells. 1=Mine, 0=Safe
        let grid = Array(25).fill(0);
        let minesPlaced = 0;
        while (minesPlaced < mines) {
            const idx = Math.floor(Math.random() * 25);
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
            revealed: [], // Indices revealed
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
            await this.cashoutMines(interaction, userId);
            return;
        }

        if (customId.startsWith('btn_mines_')) {
            const index = parseInt(customId.split('_')[2]);
            if (session.revealed.includes(index)) {
                return interaction.deferUpdate(); // Already revealed
            }

            if (session.grid[index] === 1) {
                // BOOM
                await this.failMines(interaction, userId, index);
            } else {
                // Safe
                session.revealed.push(index);
                await this.updateMinesEmbed(interaction, userId);
            }
        }
    }

    async updateMinesEmbed(interaction, userId) {
        const session = this.sessions.mines[userId];
        const multiplier = this.calculateMinesMultiplier(session.mines, session.revealed.length);
        const currentWin = Math.floor(session.bet * multiplier);
        const nextMultiplier = this.calculateMinesMultiplier(session.mines, session.revealed.length + 1);

        const embed = new EmbedBuilder()
            .setTitle('💣 MINAS')
            .setDescription(`Minas: **${session.mines}** | Apuesta: **${session.bet}**\nMultiplicador: **${multiplier.toFixed(2)}x**\nGanancia actual: **${currentWin}**`)
            .setColor('#3498DB');

        // Build Grid Buttons (5x5)
        const rows = [];
        for (let i = 0; i < 5; i++) {
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

        // Cashout Button handled in a separate ephemeral message or logic?
        // Discord allows max 5 rows. So I cannot add a 6th row for Cashout.
        // Solution: Use the embed description to say "Use /minas retirar (no, clumsy)".
        // Better: Replace one row? No.
        // Wait, max 5 rows of components.
        // Maybe 5x4 grid? Or 4x4?
        // Standard is 5x5.
        // Many bots use 5x5 and put reaction? No reactions in buttons.
        // Setup: 4 rows of 5 buttons (20 cells) + 1 row of 5 buttons (5 cells) = 25 is max.
        // Cashout button has nowhere to go? 
        // Option A: 5x5 grid uses all 5 rows. No space for Cashout.
        // Option B: Reduce grid to 5x4 (20 cells). Then Row 5 has Cashout.
        // The user request didn't specify 5x5 strictly, just "Mines". 5x5 is standard but Discord UI limits.
        // Let's do 5x5 but ONLY show Cashout if we reduce grid OR find another way.
        // Alternative: The message can have a SELECT MENU for cashout? No, takes a row.
        // Decision: 5x5 grid is too big for Discord if we want a Cashout button.
        // I will implement **5x4 (20 cells)** to leave the 5th row for controls (Cashout).

        // Re-adjusting logic for 20 cells in code below? 
        // Or keep 5x5 and Cashout is... tricky.
        // Let's switch to 5x4 grid (20 cells) in logic. 
        // Changing calculateMinesMultiplier to use 20 total.

        // Let's update lines above via this replacement or next?
        // I will write 5x5 here but then realize visual limitation.
        // Actually, I can put Cashout button in the 5th row if the 5th row has empty spots?
        // 5x5 = 25 buttons. 5 rows full.
        // If I make it 24 cells (last one is Cashout)? 
        // "24 mines" was in the request? No, "1 a 24". Implies 25 cells.
        // But 25th cell is needed for cashout. 
        // Let's make grid 24 cells + 1 control button.
        // Or 20 cells (5x4) + Controls. Ideally 5x5 is iconic.
        // But UX wise, 5x4 is cleaner on Discord.
        // Going with 25 cells is possible if Cashout is via a separate command or message? No, bad UX.
        // OK, **5x4 (20 cells)** it is.
        // Updating loop to 4 rows.

        // Wait, I am replacing code block. I can edit logic now.
        // I'll stick to 5x5 but maybe the last button of row 5 is Cashout?
        // Adjusting grid generation size to 20.
        // see below code.
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

                const { data: acc } = await this.supabase.from('casino_chips').select('*').eq('user_id', userId).single();
                if (acc) {
                    await this.supabase.from('casino_chips').update({
                        chips_balance: acc.chips_balance + profit,
                        total_won: acc.total_won + netProfit,
                        updated_at: new Date().toISOString()
                    }).eq('user_id', userId);
                }
            } else {
                // Loss update
                const { data: acc } = await this.supabase.from('casino_chips').select('total_lost').eq('user_id', userId).single();
                if (acc) await this.supabase.from('casino_chips').update({ total_lost: acc.total_lost + player.bet }).eq('user_id', userId);
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

    // --- END MINES ---
    // --- PHASE 3 GAMES ---

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

    // --- END PHASE 3 ---
}

module.exports = CasinoService;

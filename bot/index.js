require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const BillingService = require('./services/BillingService');
const TaxService = require('./services/TaxService');
const CompanyService = require('./services/CompanyService');
const StakingService = require('./services/StakingService');
const SlotsService = require('./services/SlotsService');
const taxService = new TaxService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const companyService = new CompanyService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

// 1. Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// -- EXPRESS SERVER FOR RENDER (Keeps the bot alive) --
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Nacion MX Bot is running!'));
app.listen(port, () => console.log(`🌐 Web server listening on port ${port}`));
// -----------------------------------------------------

// 2. Initialize Supabase Client
// NOTE: These should be Service Role keys if you want the bot to bypass RLS, 
// or standard keys if RLS allows anon access. For a bot, Service Role is usually best 
// to see everything, but BE CAREFUL not to expose it in public repos.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Configuration
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID; // Channel to send banking logs
const CANCELLATIONS_CHANNEL_ID = '1450610756663115879'; // Channel for Role Cancellations
const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;

// Initialize Billing Service
const billingService = new BillingService(client);

// Initialize Economy Services
let stakingService, slotsService; // Will initialize after supabase is ready

// -- GLOBAL STOCK MARKET SYSTEM --
let globalStocks = [
    // Crypto (mayor volatilidad)
    { symbol: 'BTC', name: 'Bitcoin', base: 842693, current: 842693, type: 'Cripto', volatility: 0.03 },
    { symbol: 'ETH', name: 'Ethereum', base: 55473, current: 55473, type: 'Cripto', volatility: 0.04 },
    { symbol: 'SOL', name: 'Solana', base: 2889, current: 2889, type: 'Cripto', volatility: 0.05 },

    // Tech Companies (volatilidad media)
    { symbol: 'TSLA', name: 'Tesla Inc.', base: 4535, current: 4535, type: 'Empresa', volatility: 0.02 },
    { symbol: 'AMZN', name: 'Amazon', base: 3195, current: 3195, type: 'Empresa', volatility: 0.015 },
    { symbol: 'VNSSB', name: 'Vonssyb Studios', base: 2496, current: 2496, type: 'Empresa', volatility: 0.012 }, // 🎮 Premium tech

    // Mexican Companies (volatilidad baja, precios realistas)
    { symbol: 'ALPEK', name: 'Alpek S.A.B. de C.V.', base: 147, current: 147, type: 'Empresa', volatility: 0.02 },
    { symbol: 'WALMEX', name: 'Walmart México', base: 449, current: 449, type: 'Empresa', volatility: 0.015 },
    { symbol: 'FEMSA', name: 'FEMSA', base: 1205, current: 1205, type: 'Empresa', volatility: 0.01 },
    { symbol: 'AMX', name: 'América Móvil', base: 800, current: 800, type: 'Empresa', volatility: 0.012 },
    { symbol: 'NMX', name: 'Nación MX Corp', base: 500, current: 500, type: 'Empresa', volatility: 0.025 }
];

// LOG CHANNELS
const LOG_CREACION_TARJETA = '1450343644652507136';
const LOG_EMPRESAS = '1452346918620500041';
const LOG_LICENCIAS = '1450262813548482665';
const LOG_TIENDA = '1452499876737978438';
const LOG_POLICIA = '1399106787558424629';

// CASINO SESSION MANAGERS (Multiplayer)
const casinoSessions = {
    roulette: {
        active: false,
        bets: [], // [{userId, username, betType, amount, interaction}]
        spinNumber: null,
        closeTime: null,
        channel: null,
        timeout: null
    },
    race: {
        active: false,
        bets: [], // [{userId, username, horseId, amount, interaction}]
        horses: [],
        winner: null,
        closeTime: null,
        channel: null,
        timeout: null
    }
};

// Start a roulette session (30 sec betting window)
function startRouletteSession(interaction) {
    if (casinoSessions.roulette.active) return false;

    casinoSessions.roulette = {
        active: true,
        bets: [],
        spinNumber: Math.floor(Math.random() * 37),
        closeTime: Date.now() + 30000,
        channel: interaction.channelId,
        timeout: setTimeout(() => executeRouletteSession(interaction), 30000)
    };
    return true;
}

// CASINO HELPER FUNCTIONS
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function animateSlots(interaction, symbols) {
    const frames = [
        '🎰 **GIRANDO...**\n⚡⚡⚡',
        `🎰 **SLOTS**\n${symbols[0]} ? ?`,
        `🎰 **SLOTS**\n${symbols[0]} ${symbols[1]} ?`,
        `🎰 **SLOTS**\n${symbols[0]} ${symbols[1]} ${symbols[2]}`
    ];
    for (let i = 0; i < frames.length; i++) {
        await interaction.editReply(frames[i]);
        await sleep(i === 0 ? 800 : 600);
    }
}

async function animateDice(interaction) {
    const frames = [
        '🎲 **Lanzando dados...**\n🎲🎲',
        '🎲 **Lanzando dados...**\n🎲🎲\n.',
        '🎲 **Lanzando dados...**\n🎲🎲\n..',
        '🎲 **Lanzando dados...**\n🎲🎲\n...'
    ];
    for (const frame of frames) {
        await interaction.editReply(frame);
        await sleep(400);
    }
}

async function animateRoulette(interaction, spin) {
    const sequence = [];
    for (let i = 0; i < 8; i++) {
        sequence.push(Math.floor(Math.random() * 37));
    }
    sequence.push(spin);

    for (let i = 0; i < sequence.length; i++) {
        const delay = i < 5 ? 300 : i < 7 ? 500 : 800;
        await interaction.editReply(`🎡 **GIRANDO...**\n\n🔵 ${sequence[i]}`);
        await sleep(delay);
    }
}

async function animateCrash(interaction, crashPoint, cashout) {
    let mult = 1.00;
    const steps = 15;
    const increment = (cashout - 1.00) / steps;

    while (mult < cashout && mult < crashPoint) {
        mult += increment;
        const emoji = mult < 1.5 ? '🚀' : mult < 2.5 ? '🚀🚀' : '🚀🚀🚀';
        await interaction.editReply(`${emoji} **SUBIENDO!**\n\n**${mult.toFixed(2)}x**`);
        await sleep(200);
    }
}

// Execute roulette session (called after timeout)
async function executeRouletteSession(firstInteraction) {
    const session = casinoSessions.roulette;
    if (!session.active || session.bets.length === 0) {
        session.active = false;
        return;
    }

    const spin = session.spinNumber;
    const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = reds.includes(spin);
    const isBlack = spin > 0 && !isRed;
    const color = spin === 0 ? '🟢' : isRed ? '🔴' : '🔵';

    // Animate for all players
    for (const bet of session.bets) {
        await animateRoulette(bet.interaction, spin);
    }

    // Calculate and distribute payouts
    for (const bet of session.bets) {
        let won = false, mult = 1;
        const betType = bet.betType;
        const numero = bet.numero;

        if (betType === 'numero' && spin === numero) { won = true; mult = 35; }
        else if (betType === 'red' && isRed) { won = true; mult = 1; }
        else if (betType === 'black' && isBlack) { won = true; mult = 1; }
        else if (betType === 'even' && spin > 0 && spin % 2 === 0) { won = true; mult = 1; }
        else if (betType === 'odd' && spin > 0 && spin % 2 === 1) { won = true; mult = 1; }
        else if (betType === '1-18' && spin >= 1 && spin <= 18) { won = true; mult = 1; }
        else if (betType === '19-36' && spin >= 19 && spin <= 36) { won = true; mult = 1; }
        else if (betType === '1st12' && spin >= 1 && spin <= 12) { won = true; mult = 2; }
        else if (betType === '2nd12' && spin >= 13 && spin <= 24) { won = true; mult = 2; }
        else if (betType === '3rd12' && spin >= 25 && spin <= 36) { won = true; mult = 2; }
        else if (betType === 'col1' && spin > 0 && (spin - 1) % 3 === 0) { won = true; mult = 2; }
        else if (betType === 'col2' && spin > 0 && (spin - 2) % 3 === 0) { won = true; mult = 2; }
        else if (betType === 'col3' && spin > 0 && (spin - 3) % 3 === 0) { won = true; mult = 2; }

        const payout = won ? bet.amount * (mult + 1) : 0;

        if (payout > 0) {
            await supabase.from('casino_chips').update({
                chips: (bet.currentChips - bet.amount + payout),
                total_won: (bet.totalWon || 0) + payout,
                games_played: (bet.gamesPlayed || 0) + 1
            }).eq('user_id', bet.userId);
        } else {
            await supabase.from('casino_chips').update({
                total_lost: (bet.totalLost || 0) + bet.amount,
                games_played: (bet.gamesPlayed || 0) + 1
            }).eq('user_id', bet.userId);
        }

        const resultText = won ? `✅ **¡GANAS!** +${payout} (${mult + 1}x)` : `❌ **Perdiste** -${bet.amount}`;
        await bet.interaction.editReply(`🎡 **RULETA MULTIJUGADOR**\n\n${color} **${spin}**\n\n👥 ${session.bets.length} jugadores\nTu apuesta: **${betType.toUpperCase()}**\n${resultText}\n💼 ${(bet.currentChips - bet.amount + payout).toLocaleString()} fichas`);
    }

    session.active = false;
    session.bets = [];
}

// Start race session (45 sec betting window)
function startRaceSession(interaction) {
    if (casinoSessions.race.active) return false;

    const horses = [
        { id: 1, emoji: '🐴', name: 'Relámpago', pos: 0 },
        { id: 2, emoji: '🏇', name: 'Trueno', pos: 0 },
        { id: 3, emoji: '🐎', name: 'Viento', pos: 0 },
        { id: 4, emoji: '🦄', name: 'Estrella', pos: 0 }
    ];

    casinoSessions.race = {
        active: true,
        bets: [],
        horses: horses,
        winner: null,
        closeTime: Date.now() + 45000,
        channel: interaction.channelId,
        timeout: setTimeout(() => executeRaceSession(interaction), 45000)
    };
    return true;
}

// Execute race session
async function executeRaceSession(firstInteraction) {
    const session = casinoSessions.race;
    if (!session.active || session.bets.length === 0) {
        session.active = false;
        return;
    }

    // Animate for all players
    for (const bet of session.bets) {
        await animateRace(bet.interaction, session.horses);
    }

    session.horses.sort((a, b) => b.pos - a.pos);
    const winner = session.horses[0].id;

    // Distribute payouts
    for (const bet of session.bets) {
        const won = winner === bet.horseId;
        const payout = won ? bet.amount * 3 : 0;

        if (payout > 0) {
            await supabase.from('casino_chips').update({
                chips: (bet.currentChips - bet.amount + payout),
                total_won: (bet.totalWon || 0) + payout,
                games_played: (bet.gamesPlayed || 0) + 1
            }).eq('user_id', bet.userId);
        } else {
            await supabase.from('casino_chips').update({
                total_lost: (bet.totalLost || 0) + bet.amount,
                games_played: (bet.gamesPlayed || 0) + 1
            }).eq('user_id', bet.userId);
        }

        const resultText = won ? `✅ **¡GANAS!** +${payout} (3x)` : `❌ **Perdiste** -${bet.amount}`;
        const yourHorse = session.horses.find(h => h.id === bet.horseId);
        await bet.interaction.editReply(`🏇 **CARRERAS MULTIJUGADOR**\n\n🏆 Ganador: ${session.horses[0].emoji} **${session.horses[0].name}**\n👥 ${session.bets.length} jugadores\nTu apuesta: ${yourHorse.emoji} **${yourHorse.name}**\n\n${resultText}\n💼 ${(bet.currentChips - bet.amount + payout).toLocaleString()} fichas`);
    }

    session.active = false;
    session.bets = [];
}


async function animateRace(interaction, horses) {
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

        await interaction.editReply(display);
        await sleep(1000);
    }
}


// GLOBAL CASINO SESSIONS (MULTIPLAYER)
let raceSession = {
    isOpen: false,
    bets: [], // { userId, horseId, amount, interaction }
    timer: null,
    startTime: null
};

let russianRouletteSession = {
    isOpen: false,
    players: [], // { userId, amount, name, interaction }
    timer: null,
    startTime: null
};


async function getDebitCard(discordId) {
    const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', discordId).eq('status', 'active').maybeSingle();
    return card;
}

function updateStockPrices() {
    console.log('📉 Actualizando precios de bolsa...');
    globalStocks = globalStocks.map(stock => {
        // Use stock-specific volatility (crypto more volatile than companies)
        const volatility = stock.volatility || 0.02; // Default 2%

        // Random walk: +/- volatility (e.g., ±2% to ±5% depending on asset)
        const variance = (Math.random() * (volatility * 2)) - volatility;
        const newPrice = Math.floor(stock.current * (1 + variance));

        // Realistic limits: 50% to 200% of base price
        // This prevents crashes to near-zero and unrealistic pumps
        const minPrice = Math.floor(stock.base * 0.5);  // Can go down 50%
        const maxPrice = Math.floor(stock.base * 2.0);  // Can go up 100%

        let finalPrice = newPrice;
        if (finalPrice < minPrice) finalPrice = minPrice;
        if (finalPrice > maxPrice) finalPrice = maxPrice;

        // Extra safety: never below 1
        if (finalPrice < 1) finalPrice = 1;

        return { ...stock, current: finalPrice };
    });
    console.log('✅ Precios actualizados:', globalStocks.map(s => `${s.symbol}: $${s.current}`).join(', '));
}

// Card Tiers Configuration (Global - used in multiple commands)
const CARD_TIERS = {
    // DEBIT CARDS (3)
    'NMX Débito': {
        limit: 0, interest: 0, cost: 100, max_balance: 50000,
        benefits: ['App móvil básica', 'Transferencias gratis', 'Soporte estándar']
    },
    'NMX Débito Plus': {
        limit: 0, interest: 0, cost: 500, max_balance: 150000,
        benefits: ['Cashback 0.5%', 'Alertas SMS', 'Retiros sin comisión']
    },
    'NMX Débito Gold': {
        limit: 0, interest: 0, cost: 1000, max_balance: Infinity,
        benefits: ['Cashback 1.5%', 'Seguro de compras', 'Soporte prioritario', 'Sin límite de saldo']
    },

    // PERSONAL CREDIT CARDS (10)
    'NMX Start': {
        limit: 15000, interest: 15, cost: 2000, max_balance: Infinity,
        benefits: ['Sin anualidad 1er año', 'App móvil incluida']
    },
    'NMX Básica': {
        limit: 30000, interest: 12, cost: 4000, max_balance: Infinity,
        benefits: ['Cashback 1%', 'Seguro básico de compras', 'Meses sin intereses']
    },
    'NMX Plus': {
        limit: 50000, interest: 10, cost: 6000, max_balance: Infinity,
        benefits: ['Cashback 2%', 'Protección de compras', 'Asistencia en viajes']
    },
    'NMX Plata': {
        limit: 100000, interest: 8, cost: 10000, max_balance: Infinity,
        benefits: ['Cashback 3%', 'Seguro de viaje', 'Concierge básico', 'Acceso salas VIP (2/año)']
    },
    'NMX Oro': {
        limit: 250000, interest: 7, cost: 15000, max_balance: Infinity,
        benefits: ['Cashback 4%', 'Lounge aeropuerto ilimitado', 'Asistencia 24/7', 'Seguro médico viajes']
    },
    'NMX Rubí': {
        limit: 500000, interest: 6, cost: 25000, max_balance: Infinity,
        benefits: ['Cashback 5%', 'Concierge premium', 'Eventos exclusivos', 'Upgrades de vuelos']
    },
    'NMX Black': {
        limit: 1000000, interest: 5, cost: 40000, max_balance: Infinity,
        benefits: ['Cashback 6%', 'Priority Pass', 'Asesor financiero dedicado', 'Reservas premium']
    },
    'NMX Diamante': {
        limit: 2000000, interest: 3, cost: 60000, max_balance: Infinity,
        benefits: ['Cashback 7%', 'Mayordomo personal', 'Eventos VIP', 'Primera clase gratis']
    },
    'NMX Zafiro': {
        limit: 5000000, interest: 2.5, cost: 100000, max_balance: Infinity,
        benefits: ['Cashback 8%', 'Jet privado (-50%)', 'Reservas imposibles', 'Experiencias únicas']
    },
    'NMX Platino Elite': {
        limit: 10000000, interest: 2, cost: 150000, max_balance: Infinity,
        benefits: ['Cashback 10%', 'Jet privado ilimitado', 'Ultra exclusivo', 'Gestión patrimonial']
    },

    // BUSINESS CREDIT CARDS (9)
    'NMX Business Start': {
        limit: 50000, interest: 2, cost: 8000, max_balance: Infinity,
        benefits: ['Crédito renovable', 'Reportes mensuales', 'Tarjetas empleados (3)']
    },
    'NMX Business Gold': {
        limit: 100000, interest: 1.5, cost: 15000, max_balance: Infinity,
        benefits: ['Cashback empresarial 1%', 'Reportes detallados', 'Tarjetas (10)', 'Asesoría contable']
    },
    'NMX Business Platinum': {
        limit: 200000, interest: 1.2, cost: 20000, max_balance: Infinity,
        benefits: ['Acceso prioritario', 'Sin comisiones internacionales', 'Tarjetas ilimitadas']
    },
    'NMX Business Elite': {
        limit: 500000, interest: 1, cost: 35000, max_balance: Infinity,
        benefits: ['Línea flexible', 'Seguro viajes corporativo', 'Descuentos proveedores (5%)']
    },
    'NMX Corporate': {
        limit: 1000000, interest: 0.7, cost: 50000, max_balance: Infinity,
        benefits: ['Beneficio fiscal máximo', 'Asesor financiero', 'Integración contable']
    },
    'NMX Corporate Plus': {
        limit: 5000000, interest: 0.5, cost: 100000, max_balance: Infinity,
        benefits: ['Financiamiento proyectos', 'Líneas adicionales', 'M&A advisory', 'Networking']
    },
    'NMX Enterprise': {
        limit: 10000000, interest: 0.4, cost: 200000, max_balance: Infinity,
        benefits: ['Soluciones corporativas', 'Trade finance', 'Hedging divisas', 'IPO assistance']
    },
    'NMX Conglomerate': {
        limit: 25000000, interest: 0.3, cost: 350000, max_balance: Infinity,
        benefits: ['Fiscalidad internacional', 'M&A', 'Banca de inversión', 'Family office']
    },
    'NMX Supreme': {
        limit: 50000000, interest: 0.2, cost: 500000, max_balance: Infinity,
        benefits: ['Todo incluido', 'Mercado capitales', 'Emisión deuda', 'C-Suite advisory']
    }
};

// ==========================================
// 🎮 GLOBAL GAME SESSIONS & HELPERS
// ==========================================

// LOGGING HELPER
async function logToChannel(guild, channelId, embed) {
    if (!guild || !channelId) return;
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`[LOGGING] Failed to log to ${channelId}:`, err);
    }
}

// Helper to check chips (Global)
async function checkChips(userId, amount) {
    const { data: account } = await supabase
        .from('casino_chips')
        .select('chips_balance')
        .eq('discord_user_id', userId)
        .maybeSingle();

    if (!account) {
        return { hasEnough: false, message: '❌ No tienes cuenta de casino. Compra fichas con `/casino fichas comprar`' };
    }

    if (account.chips_balance < amount) {
        return {
            hasEnough: false,
            message: `❌ Fichas insuficientes.\n\nTienes: ${account.chips_balance.toLocaleString()}\nNecesitas: ${amount.toLocaleString()}`
        };
    }

    return { hasEnough: true, balance: account.chips_balance };
}

let rouletteSession = {
    isOpen: false,
    bets: [],
    timer: null,
    startTime: null
};

let crashSession = {
    isOpen: false,
    bets: [], // { userId, amount, targetMultiplier }
    timer: null,
    startTime: null,
    multiplier: 1.00,
    crashed: false
};

let blackjackSession = {
    isOpen: false,
    players: {}, // { userId: { hand: [], bet: 0, status: 'PLAYING'|'STAND'|'BUST' } }
    dealerHand: [],
    deck: [],
    timer: null,
    startTime: null,
    state: 'LOBBY' // LOBBY, PLAYING, DEALER_TURN, ENDED
};



const startCrashGame = async (channel) => {
    crashSession.isOpen = false;
    let multiplier = 1.00;
    // Crash Point Algorithm (similar to Bustabit/Roobet)
    // 1% instant crash chance (1.00x)
    const instantCrash = Math.random() < 0.03;
    let crashPoint = instantCrash ? 1.00 : (0.99 / (1 - Math.random()));

    // Cap at reasonable max for Discord (e.g. 50x to avoid infinite loops)
    if (crashPoint > 50) crashPoint = 50.00;

    const msg = await channel.send({
        content: `🚀 **CRASH** Lanzamiento iniciado... \n\n📈 Multiplicador: **1.00x**`
    });

    const interval = setInterval(async () => {
        // Growth function
        if (multiplier < 2) multiplier *= 1.25;
        else if (multiplier < 5) multiplier *= 1.2;
        else multiplier *= 1.1;

        if (multiplier >= crashPoint) {
            clearInterval(interval);
            multiplier = crashPoint; // Clamp

            // Generate Results
            let description = `💥 **CRASHED @ ${crashPoint.toFixed(2)}x**\n\n`;
            let totalPaid = 0;
            const winners = [];

            for (const bet of crashSession.bets) {
                // Determine Win/Loss
                const userTarget = bet.target;
                if (userTarget <= crashPoint) {
                    // WIN
                    const profit = Math.floor(bet.amount * userTarget);
                    totalPaid += profit;
                    winners.push(`✅ <@${bet.userId}> retiró en **${userTarget}x** -> +$${profit.toLocaleString()}`);

                    // Update DB (Refund + Profit)
                    const { data: acc } = await supabase.from('casino_chips').select('*').eq('discord_user_id', bet.userId).single();
                    if (acc) {
                        await supabase.from('casino_chips').update({
                            chips_balance: acc.chips_balance + profit,
                            total_won: acc.total_won + (profit - bet.amount),
                            updated_at: new Date().toISOString()
                        }).eq('discord_user_id', bet.userId);
                    }

                    // Log
                    await supabase.from('casino_history').insert({
                        discord_user_id: bet.userId,
                        game_type: 'crash',
                        bet_amount: bet.amount,
                        result_amount: profit - bet.amount,
                        multiplier: userTarget,
                        game_data: { crashPoint, target: userTarget }
                    });

                } else {
                    // LOSS
                    // Already deducted. Log.
                    await supabase.from('casino_history').insert({
                        discord_user_id: bet.userId,
                        game_type: 'crash',
                        bet_amount: bet.amount,
                        result_amount: -bet.amount,
                        multiplier: 0,
                        game_data: { crashPoint, target: userTarget }
                    });

                    // Update Stats (Loss)
                    const { data: acc } = await supabase.from('casino_chips').select('total_lost').eq('discord_user_id', bet.userId).single();
                    if (acc) {
                        await supabase.from('casino_chips').update({ total_lost: acc.total_lost + bet.amount }).eq('discord_user_id', bet.userId);
                    }
                }
            }

            // Edit Final Message
            const resultEmbed = new EmbedBuilder()
                .setTitle(`📉 CRASH FINALIZADO`)
                .setDescription(description + (winners.length > 0 ? `**Ganadores:**\n${winners.join('\n')}` : '😢 Todos estrellados.'))
                .setColor(0xFF4500)
                .setFooter({ text: `Punto de Crash: ${crashPoint.toFixed(2)}x` });

            await msg.edit({ content: `💥 **CRASHED @ ${crashPoint.toFixed(2)}x**`, embeds: [resultEmbed] });

            // Notify original replies
            for (const bet of crashSession.bets) {
                try {
                    if (bet.target <= crashPoint) {
                        await bet.interaction.editReply(`✅ Retiraste en **${bet.target}x** antes del crash (${crashPoint.toFixed(2)}x)`);
                    } else {
                        await bet.interaction.editReply(`❌ Te estrellaste. Buscabas **${bet.target}x** pero crash fue **${crashPoint.toFixed(2)}x**`);
                    }
                } catch (e) { }
            }

            // Reset
            crashSession.bets = [];
            crashSession.timer = null;

        } else {
            // Update Message
            await msg.edit(`🚀 **${multiplier.toFixed(2)}x** ... subiendo`);
        }
    }, 2000); // 2 seconds per tick
};

// === BLACKJACK HELPERS ===
const BJ_SUITS = ['♠', '♥', '♦', '♣'];
const BJ_FACES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const BJ_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

function createDeck() {
    let deck = [];
    for (const s of BJ_SUITS) for (const f of BJ_FACES) deck.push({ face: f, suit: s, value: BJ_VALUES[f] });
    return deck.sort(() => Math.random() - 0.5);
}

function calculateHand(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) { value += card.value; if (card.face === 'A') aces++; }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return value;
}

async function dealerPlay(channel) {
    blackjackSession.state = 'DEALER_TURN';

    // Dealer hits until 17
    let dealerVal = calculateHand(blackjackSession.dealerHand);
    while (dealerVal < 17) {
        blackjackSession.dealerHand.push(blackjackSession.deck.pop());
        dealerVal = calculateHand(blackjackSession.dealerHand);
    }

    // Determine Winners
    let winners = [];
    let totalPaid = 0;

    for (const userId in blackjackSession.players) {
        const player = blackjackSession.players[userId];
        const playerVal = calculateHand(player.hand);

        let win = false;
        let multiplier = 0;
        let reason = '';

        if (player.status === 'BUST') {
            multiplier = 0; reason = 'Bust';
        } else if (dealerVal > 21) {
            win = true; multiplier = 2; reason = 'Dealer Bust';
        } else if (playerVal > dealerVal) {
            win = true; multiplier = 2; reason = 'Higher Hand';
        } else if (playerVal === dealerVal) {
            win = true; multiplier = 1; reason = 'Push'; // Refund
        } else {
            multiplier = 0; reason = 'Lower Hand';
        }

        // Blackjack specific payout (3:2) if player has 21 with 2 cards? 
        // Logic simplified to 2x (1:1) for simplicity or standard rules. 
        // Let's check Implementation Plan. "Victoria: 2x | Blackjack: 2.5x | Empate: 1x"
        if (playerVal === 21 && player.hand.length === 2 && (dealerVal !== 21 || blackjackSession.dealerHand.length !== 2)) {
            multiplier = 2.5; reason = 'Blackjack!';
        }

        if (multiplier > 0) {
            const profit = Math.floor(player.bet * multiplier);
            totalPaid += profit;
            const netProfit = profit - player.bet;

            if (netProfit > 0) winners.push(`✅ <@${userId}>: +$${profit.toLocaleString()} (${reason})`);
            else winners.push(`♻️ <@${userId}>: Refund (${reason})`);

            const { data: acc } = await supabase.from('casino_chips').select('*').eq('discord_user_id', userId).single();
            if (acc) {
                await supabase.from('casino_chips').update({
                    chips_balance: acc.chips_balance + profit,
                    total_won: acc.total_won + netProfit,
                    updated_at: new Date().toISOString()
                }).eq('discord_user_id', userId);
            }

            // Log
            await supabase.from('casino_history').insert({
                discord_user_id: userId,
                game_type: 'blackjack',
                bet_amount: player.bet,
                result_amount: netProfit,
                multiplier: multiplier,
                game_data: { playerVal, dealerVal, reason }
            });
        } else {
            // Loss logic
            await supabase.from('casino_history').insert({
                discord_user_id: userId,
                game_type: 'blackjack',
                bet_amount: player.bet,
                result_amount: -player.bet,
                multiplier: 0,
                game_data: { playerVal, dealerVal, reason }
            });
            const { data: acc } = await supabase.from('casino_chips').select('total_lost').eq('discord_user_id', userId).single();
            if (acc) await supabase.from('casino_chips').update({ total_lost: acc.total_lost + player.bet }).eq('discord_user_id', userId);
        }
    }

    // Final Embed
    const embed = new EmbedBuilder()
        .setTitle('🃏 BLACKJACK FINALIZADO')
        .setColor(0x000000)
        .addFields({ name: '🤵 Dealer', value: `${formatHand(blackjackSession.dealerHand)} (**${dealerVal}**)`, inline: false });

    // Add players status
    let playerList = '';
    for (const userId in blackjackSession.players) {
        const p = blackjackSession.players[userId];
        const val = calculateHand(p.hand);
        playerList += `<@${userId}>: ${formatHand(p.hand)} (**${val}**) - ${p.status}\n`;
    }
    embed.setDescription(playerList);

    if (winners.length > 0) embed.addFields({ name: '🎉 Resultados', value: winners.join('\n').substring(0, 1024), inline: false });
    else embed.addFields({ name: '😢 Resultados', value: 'La casa gana.', inline: false });

    await channel.send({ content: '🃏 **Ronda Terminada**', embeds: [embed] });

    // Reset
    blackjackSession.players = {};
    blackjackSession.dealerHand = [];
    blackjackSession.deck = [];
    blackjackSession.state = 'LOBBY';
    blackjackSession.timer = null;
}

function formatHand(hand) {
    return hand.map(c => `[${c.face}${c.suit}]`).join(' ');
}

async function updateBlackjackEmbed(channel) {
    const dealerShow = blackjackSession.state === 'DEALER_TURN'
        ? `${formatHand(blackjackSession.dealerHand)} (**${calculateHand(blackjackSession.dealerHand)}**)`
        : `[${blackjackSession.dealerHand[0].face}${blackjackSession.dealerHand[0].suit}] [?]`;

    const embed = new EmbedBuilder()
        .setTitle('🃏 MESA DE BLACKJACK')
        .setColor(0x2F3136)
        .addFields({ name: '🤵 Dealer', value: dealerShow, inline: false });

    let desc = '';
    for (const userId in blackjackSession.players) {
        const p = blackjackSession.players[userId];
        const val = calculateHand(p.hand);
        desc += `<@${userId}>: ${formatHand(p.hand)} (**${val}**) ${p.status === 'PLAYING' ? '🤔' : (p.status === 'BUST' ? '💥' : '🛑')}\n`;
    }
    embed.setDescription(desc || 'Esperando jugadores...');

    // We try to edit the last message if we saved it, but difficult in global func. 
    // We will just send a new one logic? No, spammy.
    // Better: We saved the "gameMsg" in session?
    if (blackjackSession.message) {
        try { await blackjackSession.message.edit({ embeds: [embed] }); } catch (e) { }
    }
}

const startBlackjackGame = async (channel) => {
    blackjackSession.isOpen = false;
    blackjackSession.state = 'PLAYING';
    blackjackSession.deck = createDeck();
    blackjackSession.dealerHand = [blackjackSession.deck.pop(), blackjackSession.deck.pop()];

    // Deal 2 to everyone
    for (const userId in blackjackSession.players) {
        blackjackSession.players[userId].hand = [blackjackSession.deck.pop(), blackjackSession.deck.pop()];
        const val = calculateHand(blackjackSession.players[userId].hand);
        if (val === 21) blackjackSession.players[userId].status = 'STAND'; // Auto stand on natural
    }

    // Embed
    const embed = new EmbedBuilder()
        .setTitle('🃏 BLACKJACK ACTIVO')
        .setDescription('La ronda ha comenzado. Usen los botones para jugar.')
        .setColor(0x00CED1);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_bj_hit').setLabel('Pedir Carta').setStyle(ButtonStyle.Success).setEmoji('🃏'),
        new ButtonBuilder().setCustomId('btn_bj_stand').setLabel('Plantarse').setStyle(ButtonStyle.Danger).setEmoji('🛑')
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    blackjackSession.message = msg;
    await updateBlackjackEmbed(channel);
};



async function handleBlackjackAction(interaction) {
    const userId = interaction.user.id;
    const action = interaction.customId;

    if (!blackjackSession.players[userId]) return interaction.reply({ content: '⛔ No estás en esta partida.', ephemeral: true });

    const player = blackjackSession.players[userId];
    if (player.status !== 'PLAYING') return interaction.reply({ content: '⛔ Ya terminaste tu turno.', ephemeral: true });

    if (action === 'btn_bj_hit') {
        player.hand.push(blackjackSession.deck.pop());
        const val = calculateHand(player.hand);
        if (val > 21) player.status = 'BUST';
        else if (val === 21) player.status = 'STAND';
        await interaction.deferUpdate();
    } else if (action === 'btn_bj_stand') {
        player.status = 'STAND';
        await interaction.deferUpdate();
    }

    await updateBlackjackEmbed(interaction.channel);

    const allDone = Object.values(blackjackSession.players).every(p => p.status !== 'PLAYING');
    if (allDone) {
        await dealerPlay(interaction.channel);
    }
}

client.once('ready', async () => {
    console.log(`🤖 Bot iniciado como ${client.user.tag}!`);
    console.log(`📡 Conectado a Supabase: ${supabaseUrl}`);

    // Update Status to indicate DEBUG MODE
    // Status Normal
    client.user.setActivity('Nación MX | /ayuda', { type: ActivityType.Playing });

    // Start Auto-Billing Cron
    billingService.startCron();

    // Initialize Economy Services
    stakingService = new StakingService(supabase);
    slotsService = new SlotsService(supabase);
    console.log('✅ Economy services initialized (Staking, Slots)');

    // Start Stock Market Loop (Updates every 10 minutes)
    updateStockPrices(); // Initial update
    setInterval(updateStockPrices, 10 * 60 * 1000);



    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    const commands = require('./commands');

    try {
        console.log('🔄 Iniciando actualización de comandos...');

        if (GUILD_ID) {
            // Check if bot is actually in the guild
            const targetGuild = client.guilds.cache.get(GUILD_ID);
            if (!targetGuild) {
                console.error(`❌ CRITICAL ERROR: El bot NO ESTÁ en el servidor con ID '${GUILD_ID}'.`);
                // ... logs ...
            } else {
                console.log(`✅ Verificado: Estoy dentro del servidor '${targetGuild.name}'`);
            }

            // TEST READ ACCESS
            try {
                console.log('🧐 Verificando comandos actuales en la API...');
                const currentCommands = await rest.get(Routes.applicationGuildCommands(client.user.id, GUILD_ID));
                console.log(`📋 El bot ya tiene ${currentCommands.length} comandos registrados en la nube.`);
            } catch (readError) {
                console.error('❌ ERROR DE LECTURA (Scope?):', readError);
            }

            // Register Guild Commands (Overwrite)
            // DISABLED ON RENDER DUE TO IP BLOCK / TIMEOUTS
            // RUN `node bot/manual_register.js` LOCALLY TO UPDATE COMMANDS
            console.log('⚠️ AUTO-REGISTRO DESACTIVADO: Se omite la carga de comandos para evitar Timeouts en Render.');
            console.log('   -> Ejecuta `node bot/manual_register.js` en tu PC si necesitas actualizar comandos.');

            /*
            console.log(`✨ Registrando SOLO 1 COMANDO (ping) en: '${GUILD_ID}'...`);
            console.log(`🔑 Client ID: ${client.user.id}`);
            // console.log('📦 Payloads:', JSON.stringify(commands, null, 2)); // Too verbose for 17 commands
    
            // Timeout implementation to prevent hanging indefinitely
            const registrationTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT: La conexión con Discord API tardó demasiado (>30s).')), 30000)
            );
    
            try {
                await Promise.race([
                    rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands }),
                    registrationTimeout
                ]);
                console.log('✅ Comandos (PING) verificados y limpios (REST PUT Success).');
            } catch (putError) {
                console.error('❌ FATAL REST ERROR:', putError);
                // Optionally Fallback to Global? catch -> log
            }
            */

        } else {
            console.log('⚠️ GUILD_ID no encontrado o vacío. Registrando Globalmente (No recomendado para desarrollo).');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
        }
    } catch (error) {
        console.error('❌ Error gestionando comandos (General Catch):', error);
    }

    // Start listening to Supabase changes

});

// Interaction Handler (Slash Commands)

// ========================================
// UNIVERSAL PAYMENT SYSTEM
// ========================================

async function getAvailablePaymentMethods(userId, guildId) {
    const methods = {
        cash: { available: true, label: '💵 Efectivo', value: 'cash' },
        debit: { available: false, label: '💳 Débito', value: 'debit', card: null },
        credit: { available: false, label: '🔖 Crédito', value: 'credit', card: null },
        businessCredit: { available: false, label: '🏢 Crédito Empresa', value: 'business_credit', card: null }
    };

    try {

        // Check debit card
        const { data: debitCard, error: debitError } = await supabase
            .from('debit_cards')
            .select('*')
            .eq('discord_user_id', userId)
            .eq('status', 'active')
            .maybeSingle();

        if (debitCard) {
            methods.debit.available = true;
            methods.debit.card = debitCard;
        }

        // Check personal credit card
        const { data: citizen, error: citError } = await supabase
            .from('citizens')
            .select('id')
            .eq('discord_id', userId)
            .maybeSingle();

        if (citizen) {
            const { data: creditCard, error: credError } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('citizen_id', citizen.id)
                .maybeSingle();

            if (creditCard) {
                const availableCredit = creditCard.credit_limit - creditCard.current_balance;
                if (availableCredit > 0) {
                    methods.credit.available = true;
                    methods.credit.card = creditCard;
                    methods.credit.availableCredit = availableCredit;
                }
            }
        }

        // Check business credit (company + business credit card)
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('*')
            .contains('owner_ids', [userId]);

        if (companies && companies.length > 0) {
            // Check if company has business credit card
            const { data: businessCard, error: bizError } = await supabase
                .from('business_credit_cards')
                .select('*')
                .eq('company_id', companies[0].id)
                .maybeSingle();

            if (businessCard) {
                methods.businessCredit.available = true;
                methods.businessCredit.card = businessCard;
                methods.businessCredit.company = companies[0];
            }
        }
    } catch (error) {
        console.error('[getAvailablePaymentMethods] Error:', error);
    }

    return methods;
}

function createPaymentReceipt(concept, amount, method, txId) {
    const methodIcons = {
        'cash': '💵 Efectivo',
        'debit': '🏦 Banco (Débito)',
        'credit': '💳 Crédito Personal',
        'business': '🏢 Crédito Empresa'
    };

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Pago Exitoso')
        .addFields(
            { name: '🧾 Concepto', value: concept, inline: false },
            { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
            { name: '💳 Método', value: methodIcons[method] || method, inline: true },
            { name: '🔖 ID Transacción', value: `\`${txId}\``, inline: false }
        )
        .setFooter({ text: 'Nación MX - Sistema de Pagos' })
        .setTimestamp();

    return embed;
}

function createPaymentButtons(availableMethods, prefix = 'pay') {
    const buttons = [];

    if (availableMethods.cash.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_cash`)
            .setLabel(availableMethods.cash.label)
            .setStyle(ButtonStyle.Primary));
    }

    if (availableMethods.debit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_debit`)
            .setLabel(availableMethods.debit.label)
            .setStyle(ButtonStyle.Success));
    }

    if (availableMethods.credit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_credit`)
            .setLabel(availableMethods.credit.label)
            .setStyle(ButtonStyle.Danger));
    }

    if (availableMethods.businessCredit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_business`)
            .setLabel(availableMethods.businessCredit.label)
            .setStyle(ButtonStyle.Secondary));
    }

    return new ActionRowBuilder().addComponents(buttons);
}

// Create rich payment embed with transaction details
function createPaymentEmbed(concept, amount, availableMethods) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 Confirmar Pago')
        .setDescription(`**${concept}**\n\n💵 **Total:** $${amount.toLocaleString()}`)
        .addFields(
            { name: '📊 Métodos Disponibles', value: getAvailableMethodsText(availableMethods), inline: false }
        )
        .setFooter({ text: 'Selecciona tu método de pago preferido ⬇️' })
        .setTimestamp();

    return embed;
}

function getAvailableMethodsText(methods) {
    const available = [];
    if (methods.cash.available) available.push('💵 **Efectivo** - Pago inmediato');
    if (methods.debit.available) available.push('🏦 **Banco (Débito)** - Desde tu cuenta');
    if (methods.credit.available) {
        const credit = methods.credit.availableCredit || 0;
        available.push(`💳 **Crédito Personal** - Disponible: $${credit.toLocaleString()}`);
    }
    if (methods.businessCredit.available) {
        const bizCredit = methods.businessCredit.card;
        const available = bizCredit ? (bizCredit.credit_limit - bizCredit.current_balance) : 0;
        available.push(`🏢 **Crédito Empresa** - Disponible: $${available.toLocaleString()}`);
    }

    return available.join('\n') || '❌ No hay métodos de pago disponibles';
}


async function processPayment(method, userId, guildId, amount, description, availableMethods) {
    try {
        if (method === 'cash') {
            const balance = await billingService.ubService.getUserBalance(guildId, userId);
            if ((balance.cash || 0) < amount) {
                return { success: false, error: `❌ Efectivo insuficiente.\nNecesitas: $${amount.toLocaleString()}\nTienes: $${(balance.cash || 0).toLocaleString()}` };
            }
            await billingService.ubService.removeMoney(guildId, userId, amount, description, 'cash');
            return { success: true, method: '💵 Efectivo', source: 'cash' };
        }

        if (method === 'debit') {
            if (!availableMethods.debit.available) {
                return { success: false, error: '❌ No tienes tarjeta de débito activa.' };
            }
            const balance = await billingService.ubService.getUserBalance(guildId, userId);
            if ((balance.bank || 0) < amount) {
                return { success: false, error: `❌ Saldo bancario insuficiente.\nNecesitas: $${amount.toLocaleString()}\nTienes: $${(balance.bank || 0).toLocaleString()}` };
            }
            await billingService.ubService.removeMoney(guildId, userId, amount, description, 'bank');
            return { success: true, method: '💳 Débito', source: 'bank' };
        }

        if (method === 'credit') {
            if (!availableMethods.credit.available || !availableMethods.credit.card) {
                return { success: false, error: '❌ No tienes tarjeta de crédito.' };
            }
            const creditCard = availableMethods.credit.card;
            const available = creditCard.credit_limit - creditCard.current_balance;
            if (available < amount) {
                return { success: false, error: `❌ Crédito insuficiente.\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}` };
            }
            await supabase.from('credit_cards').update({
                current_balance: creditCard.current_balance + amount
            }).eq('id', creditCard.id);
            return { success: true, method: '🔖 Crédito', source: 'credit' };
        }

        if (method === 'business') {
            if (!availableMethods.businessCredit.available || !availableMethods.businessCredit.card) {
                return { success: false, error: '❌ No tienes crédito empresarial disponible.' };
            }
            const businessCard = availableMethods.businessCredit.card;
            const available = businessCard.credit_limit - businessCard.current_balance;
            if (available < amount) {
                return { success: false, error: `❌ Crédito empresarial insuficiente.\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}` };
            }
            await supabase.from('business_credit_cards').update({
                current_balance: businessCard.current_balance + amount
            }).eq('id', businessCard.id);
            return { success: true, method: '🏢 Crédito Empresa', source: 'business_credit' };
        }

        return { success: false, error: '❌ Método de pago no válido.' };
    } catch (error) {
        console.error('[processPayment] Error:', error);
        return { success: false, error: '❌ Error procesando el pago.' };
    }
}


// Interaction deduplication cache
const processedInteractions = new Set();
setInterval(() => processedInteractions.clear(), 60000); // Clear every minute

client.on('interactionCreate', async interaction => {
    console.log(`[DEBUG] RAW INTERACTION: ${interaction.isCommand() ? 'CMD' : 'BTN/OTHER'} ${interaction.commandName || interaction.customId}`);
    // Deduplicate interactions
    if (processedInteractions.has(interaction.id)) {
        console.log(`[DEBUG] Skipping duplicate interaction: ${interaction.id}`);
        return;
    }
    processedInteractions.add(interaction.id);

    // BUTTON: Investment Collection
    if (interaction.isButton() && interaction.customId.startsWith('btn_collect_')) {
        await interaction.deferReply({ ephemeral: true });
        const invId = interaction.customId.replace('btn_collect_', '');

        // Fetch Inv
        const { data: inv } = await supabase.from('investments').select('*').eq('id', invId).single();
        if (!inv || inv.status !== 'active') return interaction.editReply('❌ Inversión no válida o ya cobrada.');

        // Payout
        await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, inv.payout_amount, `Retiro Inversión ${inv.id}`);
        await supabase.from('investments').update({ status: 'completed' }).eq('id', invId);

        await interaction.editReply(`✅ **¡Ganancia Cobrada!**\nHas recibido **$${inv.payout_amount.toLocaleString()}** en tu cuenta.`);
    }


    // BUTTON: Debit Card Upgrade (User accepts offer)
    if (interaction.isButton() && interaction.customId.startsWith('btn_udp_upgrade_')) {


        // Parse customId: btn_udp_upgrade_{cardId}_{TierName_With_Underscores}
        // Example: btn_udp_upgrade_123_NMX_Débito_Gold
        const parts = interaction.customId.split('_');
        const cardId = parts[3];
        const targetTierRaw = parts.slice(4).join('_'); // Rejoin: "NMX_Débito_Gold"
        const targetTier = targetTierRaw.replace(/_/g, ' '); // Convert to: "NMX Débito Gold"

        console.log('[DEBUG] Upgrade button - Target tier:', targetTier, '| Available tiers:', Object.keys(CARD_TIERS));

        if (!targetTier || !CARD_TIERS[targetTier]) {
            return interaction.followUp({
                content: `❌ Error: Nivel de tarjeta inválido.\nBuscado: "${targetTier}"\nDisponibles: ${Object.keys(CARD_TIERS).filter(k => k.includes('Débito')).join(', ')}`,
                ephemeral: true
            });
        }


        // Fetch current card
        const { data: card, error: cardError } = await supabase
            .from('debit_cards')
            .select('*')
            .eq('id', cardId)
            .single();

        if (cardError || !card) {
            return interaction.reply({
                content: `❌ Tarjeta no encontrada.\nID buscado: ${cardId}\nError: ${cardError?.message || 'Unknown'}`,
                ephemeral: true
            });
        }

        // Get REAL balance from UnbelievaBoat (not Supabase cache)
        const realBalance = await billingService.ubService.getUserBalance(interaction.guildId, card.discord_user_id, 'bank');

        console.log('[DEBUG] Upgrade - Card lookup:', {
            cardId,
            found: true,
            supabaseBalance: card.balance,
            realBalance: realBalance,
            userId: card.discord_user_id
        });

        const tierInfo = CARD_TIERS[targetTier];

        // Extract bank balance from UnbelievaBoat response
        const bankBalance = typeof realBalance === 'object' ? realBalance.bank : realBalance;

        console.log('[DEBUG] Upgrade - Tier info:', { targetTier, cost: tierInfo.cost, bankBalance });

        // Check balance (use REAL balance from UnbelievaBoat)
        if (bankBalance < tierInfo.cost) {
            return interaction.reply({
                content: `❌ **Fondos insuficientes**\n\nCosto: **$${tierInfo.cost.toLocaleString()}**\nTu saldo: **$${bankBalance.toLocaleString()}**\nTarjeta: ${card.card_tier}\nID: ${cardId.slice(0, 8)}...`,
                ephemeral: true
            });
        }

        // Deduct money from UnbelievaBoat (source of truth)
        await billingService.ubService.removeMoney(
            interaction.guildId,
            card.discord_user_id,
            tierInfo.cost,
            `Mejora de tarjeta a ${targetTier}`,
            'bank'
        );

        // Update card tier in Supabase (for display only, NOT for balance validation)
        const { error: updateError } = await supabase
            .from('debit_cards')
            .update({
                card_tier: targetTier
            })
            .eq('id', cardId);

        if (updateError) {
            console.error('[upgrade] Error:', updateError);
            // Rollback the money deduction
            await billingService.ubService.addMoney(
                interaction.guildId,
                card.discord_user_id,
                tierInfo.cost,
                'Rollback: Error en mejora de tarjeta',
                'bank'
            );
            return interaction.followUp({ content: '❌ Error al procesar la mejora.', ephemeral: true });
        }

        // Success - update original message to remove buttons
        await interaction.deferUpdate();
        await interaction.editReply({ components: [] });

        const newBalance = bankBalance - tierInfo.cost;

        await interaction.followUp({
            content: `✅ **¡Mejora Completada!**\n\n🎉 Nueva tarjeta: **${targetTier}**\n💰 Costo: $${tierInfo.cost.toLocaleString()}\n💳 Nuevo saldo: $${newBalance.toLocaleString()}\n📊 Límite: ${tierInfo.max_balance === Infinity ? '♾️ Ilimitado' : '$' + tierInfo.max_balance.toLocaleString()}`,
            ephemeral: false
        });
    }

    // EMPRESA COBRAR - Payment Buttons
    // BUTTON: Casino Payment
    if (interaction.isButton() && interaction.customId.startsWith('casino_pay_')) {
        await interaction.deferUpdate();
        const method = interaction.customId.replace('casino_pay_', '');
        const userId = interaction.user.id;

        // Get user chips to find pending amount
        const { data: userChips } = await supabase.from('casino_chips').select('*').eq('user_id', userId).maybeSingle();
        if (!userChips) return interaction.followUp({ content: '❌ Error: No se encontró información de fichas.', ephemeral: true });

        // For casino, we need to get the amount from the message (parse from embed or message)
        const embedDesc = interaction.message.embeds[0]?.description;
        const amountMatch = embedDesc.match(/\$([0-9,]+)/);
        const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0;

        if (amount <= 0) return interaction.followUp({ content: '❌ No se pudo determinar el monto.', ephemeral: true });

        const pm = await getAvailablePaymentMethods(userId, interaction.guildId);
        const result = await processPayment(method, userId, interaction.guildId, amount, 'Compra de fichas casino', pm);

        if (!result.success) {
            return interaction.followUp({ content: result.error, ephemeral: true });
        }

        // Credit the chips
        await supabase.from('casino_chips').update({ chips: (userChips.chips || 0) + amount }).eq('user_id', userId);

        return interaction.followUp({ content: `✅ Pago exitoso con ${result.method}\n💰 +${amount} fichas\n🎰 Total: ${((userChips.chips || 0) + amount).toLocaleString()} fichas`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('pay_')) {
        const parts = interaction.customId.split('_');
        const paymentMethod = parts[1]; // cash, debit, credit, cancel

        if (paymentMethod === 'cancel') {
            await interaction.update({
                content: '❌ Pago cancelado por el cliente.',
                embeds: [],
                components: []
            });
            return;
        }

        const amount = parseFloat(parts[2]);
        const companyId = parts[3];

        await interaction.deferUpdate();

        try {
            // Get company data
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.followUp({ content: '❌ Empresa no encontrada.', ephemeral: true });
            }

            // Get original message to find reason
            const originalEmbed = interaction.message.embeds[0];
            const reason = originalEmbed.fields.find(f => f.name === '🧾 Concepto')?.value || 'Servicio';

            let paymentSuccess = false;
            let paymentDetails = '';
            let transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // Process payment based on method
            if (paymentMethod === 'cash') {
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.cash < amount) {
                    return interaction.followUp({
                        content: `❌ **Efectivo insuficiente**\n\nNecesitas: $${amount.toLocaleString()}\nTienes: $${balance.cash.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Remove cash from client
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago a ${company.name}: ${reason}`, 'cash');

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = '💵 Efectivo';

            } else if (paymentMethod === 'debit') {
                const { data: debitCard } = await supabase
                    .from('debit_cards')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!debitCard) {
                    return interaction.followUp({
                        content: '❌ No tienes tarjeta de débito activa.',
                        ephemeral: true
                    });
                }

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.bank < amount) {
                    return interaction.followUp({
                        content: `❌ **Saldo insuficiente en débito**\n\nNecesitas: $${amount.toLocaleString()}\nTienes: $${balance.bank.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Remove from client's bank (debit)
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago débito a ${company.name}: ${reason}`, 'bank');

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = '💳 Tarjeta de Débito';

            } else if (paymentMethod === 'credit') {
                // Get user's credit card
                const { data: creditCards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('discord_id', interaction.user.id)
                    .eq('status', 'active')
                    .order('card_limit', { ascending: false })
                    .limit(1);

                if (!creditCards || creditCards.length === 0) {
                    return interaction.followUp({
                        content: '❌ No tienes tarjetas de crédito activas.',
                        ephemeral: true
                    });
                }

                const card = creditCards[0];
                const available = card.card_limit - (card.current_balance || 0);

                if (available < amount) {
                    return interaction.followUp({
                        content: `❌ **Crédito insuficiente**\n\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Update credit card balance
                await supabase
                    .from('credit_cards')
                    .update({
                        current_balance: (card.current_balance || 0) + amount,
                        last_transaction_at: new Date().toISOString()
                    })
                    .eq('id', card.id);

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = `💳 Crédito (${card.card_name})`;
            }

            if (paymentSuccess) {
                // Update message to show success
                await interaction.editReply({
                    content: '✅ Pago procesado exitosamente',
                    embeds: [],
                    components: []
                });

                // Generate digital receipt
                const receiptEmbed = new EmbedBuilder()
                    .setTitle('🧾 Comprobante de Pago')
                    .setColor(0x00FF00)
                    .setDescription(`Transacción completada exitosamente`)
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '👤 Cliente', value: interaction.user.tag, inline: true },
                        { name: '📝 Concepto', value: reason, inline: false },
                        { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '💳 Método', value: paymentDetails, inline: true },
                        { name: '🔖 ID Transacción', value: `\`${transactionId}\``, inline: false },
                        { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'Banco Nacional • Comprobante Digital' })
                    .setTimestamp();

                // Send receipt to client
                try {
                    await interaction.user.send({
                        content: '📧 **Comprobante de tu pago**',
                        embeds: [receiptEmbed]
                    });
                } catch (dmError) {
                    console.log('Could not DM client receipt:', dmError.message);
                }

                // Send receipt to company owner(s)
                for (const ownerId of company.owner_ids) {
                    try {
                        const owner = await client.users.fetch(ownerId);
                        await owner.send({
                            content: '💰 **Nueva venta registrada**',
                            embeds: [receiptEmbed]
                        });
                    } catch (ownerDmError) {
                        console.log('Could not DM owner receipt:', ownerDmError.message);
                    }
                }

                // Log transaction (optional, if you want to track in DB)
                await supabase
                    .from('company_transactions')
                    .insert({
                        company_id: companyId,
                        client_id: interaction.user.id,
                        amount: amount,
                        description: reason,
                        payment_method: paymentMethod,
                        transaction_id: transactionId
                    });
            }

        } catch (error) {
            console.error('Payment error:', error);
            await interaction.followUp({
                content: '❌ Error procesando el pago. Contacta a un administrador.',
                ephemeral: true
            });
        }

        return;
    }

    // STRING SELECT MENU: Company Selection
    if (interaction.customId === 'select_company_menu') {
        await interaction.deferUpdate();

        const companyId = interaction.values[0];
        const { data: company } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();

        if (!company) {
            return interaction.editReply({ content: '❌ Empresa no encontrada.', components: [] });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏢 ${company.name} - Panel de Control`)
            .setColor(0x5865F2)
            .setDescription(`Gestión completa de tu empresa`)
            .addFields(
                { name: '💰 Saldo', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                { name: '👥 Empleados', value: `${(company.employee_count || 0)}`, inline: true },
                { name: '🚗 Vehículos', value: `${company.vehicles || 0}`, inline: true },
                { name: '📍 Ubicación', value: company.location || 'No especificada', inline: true },
                { name: '🏷️ Tipo', value: company.industry_type, inline: true },
                { name: '🔒 Privacidad', value: company.is_private ? 'Privada' : 'Pública', inline: true }
            )
            .setThumbnail(company.logo_url)
            .setFooter({ text: 'Sistema Empresar ial Nación MX' })
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`company_hire_${companyId}`).setLabel('👥 Contratar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`company_fire_${companyId}`).setLabel('🚫 Despedir').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`company_payroll_${companyId}`).setLabel('💵 Pagar Nómina').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`company_withdraw_${companyId}`).setLabel('💸 Retirar Fondos').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`company_stats_${companyId}`).setLabel('📊 Estadísticas').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row1, row2] });
        return;
    }

    // STRING SELECT: Payroll Group Selection
    if (interaction.customId && interaction.customId.startsWith('payroll_select_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const companyId = parts[2];
        const groupId = interaction.values[0];

        try {
            // Get payroll group members
            const { data: members } = await supabase
                .from('payroll_members')
                .select('*')
                .eq('group_id', groupId);

            if (!members || members.length === 0) {
                return interaction.editReply({
                    content: '❌ Este grupo no tiene empleados.\n\nAgrega empleados con `/nomina agregar`',
                    components: []
                });
            }

            // Calculate total
            let total = 0;
            members.forEach(m => total += m.salary);

            // Get company info
            const { data: company } = await supabase
                .from('companies')
                .select('name')
                .eq('id', companyId)
                .single();

            // Show payment method selector (use universal requestPaymentMethod)
            const paymentResult = await requestPaymentMethod(
                interaction,
                interaction.user.id,
                total,
                `Nómina - ${members.length} empleados`
            );

            if (!paymentResult.success) {
                return interaction.editReply({ content: paymentResult.error, components: [] });
            }

            // Pay each employee
            let report = `✅ **Nómina Pagada**\n\n🏢 Empresa: ${company?.name || 'N/A'}\n💰 Total: $${total.toLocaleString()}\n💳 Método: ${paymentResult.method}\n\n**Empleados:**\n`;

            for (const m of members) {
                await billingService.ubService.addMoney(
                    interaction.guildId,
                    m.member_discord_id,
                    m.salary,
                    `Nómina de ${interaction.user.username}`
                );
                report += `✅ <@${m.member_discord_id}>: $${m.salary.toLocaleString()}\n`;
            }

            await interaction.editReply({ content: report, components: [] });

        } catch (error) {
            console.error('[payroll_select] Error:', error);
            await interaction.editReply({
                content: `❌ Error procesando nómina: ${error.message}`,
                components: []
            });
        }
        return;
    }

    // BUTTON: Pay Business Credit Card Debt
    if (interaction.isButton() && interaction.customId.startsWith('pay_biz_debt_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const method = parts[3]; // 'cash' or 'bank'
        const cardId = parts[4];
        const amount = parseFloat(parts[5]);

        try {
            // Get card info
            const { data: card } = await supabase
                .from('business_credit_cards')
                .select('*, companies!inner(name)')
                .eq('id', cardId)
                .single();

            if (!card) {
                return interaction.followUp({ content: '❌ Tarjeta no encontrada.', ephemeral: true });
            }

            // Remove money from user
            await billingService.ubService.removeMoney(
                interaction.guildId,
                interaction.user.id,
                amount,
                `Pago tarjeta empresarial: ${card.companies.name}`,
                method
            );

            // Reduce debt
            const newDebt = (card.current_balance || 0) - amount;
            await supabase
                .from('business_credit_cards')
                .update({
                    current_balance: newDebt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', cardId);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Pago de Deuda Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Se abonó **$${amount.toLocaleString()}** a tu tarjeta empresarial`)
                .addFields(
                    { name: '🏢 Empresa', value: card.companies.name, inline: true },
                    { name: '💳 Tarjeta', value: card.card_name, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💰 Abono', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Deuda Anterior', value: `$${(card.current_balance || 0).toLocaleString()}`, inline: true },
                    { name: '📈 Nueva Deuda', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: '💳 Método', value: method === 'cash' ? '💵 Efectivo' : '🏦 Banco', inline: false }
                )
                .setFooter({ text: '¡Excelente manejo financiero!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error('[pay_biz_debt] Error:', error);
            await interaction.followUp({
                content: `❌ Error procesando pago: ${error.message}`,
                ephemeral: true
            });
        }
        return;
    }

    // BUTTON: Company Payroll (from panel)
    if (interaction.isButton() && interaction.customId.startsWith('company_payroll_')) {
        await interaction.deferReply({ ephemeral: false });

        const companyId = interaction.customId.split('_')[2];

        try {
            // Get payroll groups for this company
            const { data: groups } = await supabase
                .from('payroll_groups')
                .select('*')
                .eq('owner_discord_id', interaction.user.id);

            if (!groups || groups.length === 0) {
                return interaction.editReply({
                    content: `❌ **No tienes grupos de nómina**\n\nCrea uno con \`/nomina crear nombre:MiGrupo\``
                });
            }

            // Show selector of payroll groups
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`payroll_select_${companyId}`)
                .setPlaceholder('Selecciona grupo de nómina a pagar')
                .addOptions(groups.map(g => ({
                    label: g.name,
                    description: `Grupo de nómina`,
                    value: g.id.toString(),
                    emoji: '💼'
                })));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('💼 Pagar Nómina Empresarial')
                .setColor(0x5865F2)
                .setDescription(`Selecciona qué grupo de nómina pagar:`);

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[company_payroll] Error:', error);
            await interaction.editReply({ content: '❌ Error obteniendo grupos de nómina.' });
        }
        return;
    }

    // BUTTON: Company Withdraw Funds
    if (interaction.isButton() && interaction.customId.startsWith('company_withdraw_')) {
        await interaction.deferReply({ ephemeral: false });

        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.editReply('❌ Empresa no encontrada.');
            }

            const balance = company.balance || 0;

            if (balance === 0) {
                return interaction.editReply(`❌ **Sin fondos para retirar**\n\n🏢 ${company.name}\n💰 Balance: $0\n\nGenera ingresos con \`/empresa cobrar\``);
            }

            const embed = new EmbedBuilder()
                .setTitle(`💸 Retirar Fondos - ${company.name}`)
                .setColor(0xFFD700)
                .setDescription(`Balance disponible: **$${balance.toLocaleString()}**\n\nResponde con el monto que deseas retirar.\n\n⚠️ Se cobrará **10% de impuesto** sobre el retiro.`)
                .setFooter({ text: 'Tienes 60 segundos para responder' });

            await interaction.editReply({ embeds: [embed] });

            // Wait for message response
            const filter = m => m.author.id === interaction.user.id;
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
                .catch(() => null);

            if (!collected) {
                return interaction.followUp({ content: '⏱️ Tiempo agotado.', ephemeral: true });
            }

            const amount = parseFloat(collected.first().content.replace(/[$,]/g, ''));

            if (isNaN(amount) || amount <= 0) {
                return interaction.followUp({ content: '❌ Monto inválido.', ephemeral: true });
            }

            if (amount > balance) {
                return interaction.followUp({ content: `❌ Fondos insuficientes. Balance: $${balance.toLocaleString()}`, ephemeral: true });
            }

            // Calculate tax (10%)
            const tax = amount * 0.10;
            const netAmount = amount - tax;

            // Remove from company
            await supabase
                .from('companies')
                .update({ balance: balance - amount })
                .eq('id', companyId);

            // Add to user (cash)
            await billingService.ubService.addMoney(
                interaction.guildId,
                interaction.user.id,
                netAmount,
                `Retiro de ${company.name}`,
                'cash'
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Retiro Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Fondos retirados de **${company.name}**`)
                .addFields(
                    { name: '💰 Monto Bruto', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Impuesto (10%)', value: `$${tax.toLocaleString()}`, inline: true },
                    { name: '💵 Recibido', value: `$${netAmount.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Los fondos están en tu efectivo personal' })
                .setTimestamp();

            await interaction.followUp({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('[company_withdraw] Error:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
        return;
    }

    // ============================================================
    // COMPANY VEHICLE ADDITION HANDLERS
    // ============================================================

    // BUTTON: Add Vehicle to Company
    if (interaction.isButton() && interaction.customId.startsWith('company_addvehicle_')) {
        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.reply({ content: '❌ Empresa no encontrada.', ephemeral: true });
            }

            if (!company.owner_ids.includes(interaction.user.id)) {
                return interaction.reply({ content: '⛔ Solo los dueños pueden agregar vehículos.', ephemeral: true });
            }

            const vehicleMenu = new StringSelectMenuBuilder()
                .setCustomId(`vehicle_select_${companyId}`)
                .setPlaceholder('Selecciona el tipo de vehículo')
                .addOptions([
                    { label: 'Ejecutiva Ligera', description: '$420,000 - Vehículo ligero para ejecutivos', value: 'ejecutiva_ligera', emoji: '🚗' },
                    { label: 'Operativa de Servicio', description: '$550,000 - Vehículo para operaciones', value: 'operativa_servicio', emoji: '🚙' },
                    { label: 'Carga Pesada', description: '$850,000 - Camión de carga', value: 'carga_pesada', emoji: '🚚' },
                    { label: 'Ejecutiva Premium', description: '$1,200,000 - Vehículo premium de lujo', value: 'ejecutiva_premium', emoji: '🚘' },
                    { label: 'Asistencia Industrial', description: '$1,500,000 - Vehículo industrial pesado', value: 'asistencia_industrial', emoji: '🚛' }
                ]);

            const row = new ActionRowBuilder().addComponents(vehicleMenu);

            await interaction.reply({
                content: `🚗 **Selecciona el tipo de vehículo para ${company.name}**`,
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('[company_addvehicle]', error);
            await interaction.reply({ content: '❌ Error cargando opciones.', ephemeral: true });
        }
        return;
    }

    // SELECT MENU: Vehicle Type Selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vehicle_select_')) {
        await interaction.deferUpdate();

        const companyId = interaction.customId.split('_')[2];
        const vehicleType = interaction.values[0];

        const VEHICLE_COSTS = {
            'ejecutiva_ligera': 420000,
            'operativa_servicio': 550000,
            'carga_pesada': 850000,
            'ejecutiva_premium': 1200000,
            'asistencia_industrial': 1500000
        };

        const VEHICLE_NAMES = {
            'ejecutiva_ligera': '🚗 Ejecutiva Ligera',
            'operativa_servicio': '🚙 Operativa de Servicio',
            'carga_pesada': '🚚 Carga Pesada',
            'ejecutiva_premium': '🚘 Ejecutiva Premium',
            'asistencia_industrial': '🚛 Asistencia Industrial'
        };

        const cost = VEHICLE_COSTS[vehicleType];
        const name = VEHICLE_NAMES[vehicleType];

        try {
            const pmVehicle = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
            const pbVehicle = createPaymentButtons(pmVehicle, 'vehicle_pay');
            const vehicleEmbed = createPaymentEmbed(name, cost, pmVehicle);

            await interaction.editReply({
                content: `💰 **Compra de vehículo para la empresa**`,
                embeds: [vehicleEmbed],
                components: [pbVehicle]
            });

            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('vehicle_pay_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const method = i.customId.replace('vehicle_pay_', '');

                    const paymentResult = await processPayment(method, interaction.user.id, interaction.guildId, cost, `[Vehículo] ${name}`, pmVehicle);

                    if (!paymentResult.success) {
                        return i.editReply({ content: paymentResult.error, embeds: [], components: [] });
                    }

                    const { data: company } = await supabase.from('companies').select('vehicle_count').eq('id', companyId).single();
                    await supabase.from('companies').update({ vehicle_count: (company.vehicle_count || 0) + 1 }).eq('id', companyId);

                    const vehicleRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`company_addvehicle_${companyId}`).setLabel('➕ Agregar Otro Vehículo').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`company_finish_${companyId}`).setLabel('✅ Finalizar').setStyle(ButtonStyle.Success)
                    );

                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Vehículo Agregado')
                        .setDescription(`${name}\n\n💰 Pagado: $${cost.toLocaleString()}\n💳 Método: ${paymentResult.method}`)
                        .addFields({ name: '🚗 Total de Vehículos', value: `${(company.vehicle_count || 0) + 1}`, inline: true })
                        .setTimestamp();

                    await i.editReply({ content: '¿Deseas agregar más vehículos?', embeds: [successEmbed], components: [vehicleRow] });

                } catch (error) {
                    console.error('[vehicle payment]', error);
                    await i.editReply({ content: '❌ Error procesando pago.', embeds: [], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: '⏰ Tiempo agotado.', embeds: [], components: [] });
                }
            });

        } catch (error) {
            console.error('[vehicle_select]', error);
            await interaction.editReply({ content: '❌ Error procesando vehículo.', components: [] });
        }
        return;
    }

    // BUTTON: Finish Adding Vehicles
    if (interaction.isButton() && interaction.customId.startsWith('company_finish_')) {
        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase.from('companies').select('name, vehicle_count').eq('id', companyId).single();

            const finalEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏢 Empresa Completada')
                .setDescription(`**${company.name}**\n\nRegistro finalizado exitosamente.`)
                .addFields({ name: '🚗 Vehículos Registrados', value: `${company.vehicle_count || 0}`, inline: true })
                .setTimestamp();

            await interaction.update({ content: '✅ Configuración de empresa completada!', embeds: [finalEmbed], components: [] });

        } catch (error) {
            console.error('[company_finish]', error);
            await interaction.update({ content: '✅ Empresa finalizada.', components: [] });
        }
        return;
    }

    // BUTTON: Company Stats
    if (interaction.isButton() && interaction.customId.startsWith('company_stats_')) {
        await interaction.deferReply({ ephemeral: false });

        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.editReply('❌ Empresa no encontrada.');
            }

            // Get business credit card if exists
            const { data: bizCard } = await supabase
                .from('business_credit_cards')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'active')
                .single();

            const embed = new EmbedBuilder()
                .setTitle(`📊 Estadísticas - ${company.name}`)
                .setColor(0x5865F2)
                .setThumbnail(company.logo_url)
                .addFields(
                    { name: '🏷️ Industria', value: company.industry_type, inline: true },
                    { name: '📍 Ubicación', value: company.location || 'N/A', inline: true },
                    { name: '🔒 Tipo', value: company.is_private ? 'Privada' : 'Pública', inline: true },
                    { name: '💰 Balance', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                    { name: '👥 Empleados', value: `${company.employee_count || 0}`, inline: true },
                    { name: '🚗 Vehículos', value: `${company.vehicles || 0}`, inline: true }
                );

            if (bizCard) {
                const debt = bizCard.current_balance || 0;
                const available = bizCard.credit_limit - debt;
                embed.addFields({
                    name: '💳 Crédito Empresarial',
                    value: `**${bizCard.card_name}**\n📊 Deuda: $${debt.toLocaleString()}\n💵 Disponible: $${available.toLocaleString()}`,
                    inline: false
                });
            }

            embed.addFields(
                { name: '📅 Creada', value: `<t:${Math.floor(new Date(company.created_at).getTime() / 1000)}:R>`, inline: false }
            );

            embed.setFooter({ text: 'Sistema Empresarial Nación MX' });
            embed.setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[company_stats] Error:', error);
            await interaction.editReply({ content: '❌ Error obteniendo estadísticas.' });
        }
        return;
    }

    if (interaction.isButton()) { return; }

    // Only process slash commands
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply({ content: `🏓 Pong! Latencia: **${ping}ms**. API: **${Math.round(client.ws.ping)}ms**.`, ephemeral: false });
    }


    else if (commandName === 'ayuda') {
        const initialEmbed = new EmbedBuilder()
            .setTitle('📘 Centro de Ayuda Nación MX')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Selecciona una categoría en el menú de abajo para ver los comandos disponibles.**\n\nAquí encontrarás toda la información sobre el sistema financiero, legal y de entretenimiento.')
            // .setImage('https://i.imgur.com/K3pW4kC.png') 
            .setFooter({ text: 'Usa el menú desplegable para navegar' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Economía').setDescription('Débito, Transferencias, Efectivo').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas de Crédito, Buró, Pagos').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas & Negocios').setDescription('Gestión de Empresas, Terminal POS').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones & Bolsa').setDescription('Acciones, Crypto, Plazos Fijos').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Slots, Ruleta, Caballos, Juegos').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Legal & Policial').setDescription('Multas, Antecedentes, Fichajes').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Utilidades').setDescription('Ping, Balance, Notificaciones').setValue('utils').setEmoji('⚙️'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({ embeds: [initialEmbed], components: [row], ephemeral: false });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 }); // 5 mins

        collector.on('collect', async i => {
            if (i.customId !== 'help_category') return;

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Economía')
                        .addFields(
                            { name: '`/debito estado`', value: 'Ver tu saldo bancario y número de tarjeta.' },
                            { name: '`/debito depositar`', value: 'Depositar efectivo a tu cuenta (Inmediato).' },
                            { name: '`/debito retirar`', value: 'Retirar dinero del banco (Inmediato).' },
                            { name: '`/debito transferir`', value: 'Transferir a otro usuario (Banco a Banco, 5 min).' },
                            { name: '`/transferir`', value: 'Transferencia SPEI inmediata (Solo Banco).' },
                            { name: '`/depositar`', value: 'Depósito en efectivo a terceros (OXXO, 4 horas).' },
                            { name: '`/giro`', value: 'Envío de efectivo por paquetería (24 horas).' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Deudas')
                        .addFields(
                            { name: '`/credito info`', value: 'Ver estado de cuenta, límite y corte.' },
                            { name: '`/credito pagar`', value: 'Pagar deuda de tarjeta.' },
                            { name: '`/credito buro`', value: 'Ver tu historial crediticio.' },
                            { name: '`/top-morosos`', value: 'Ver quién debe más en el servidor.' },
                            { name: '`/top-ricos`', value: 'Ver quién tiene mejor Score Crediticio.' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Registrar una nueva empresa ($50k).' },
                            { name: '`/empresa menu`', value: 'Panel de gestión (pagar nómina, ver saldo).' },
                            { name: '`/empresa cobrar`', value: 'Generar cobro para clientes (Terminal POS).' },
                            { name: '`/empresa credito`', value: 'Solicitar crédito empresarial.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .addFields(
                            { name: '`/bolsa precios`', value: 'Ver precios de acciones/crypto.' },
                            { name: '`/bolsa comprar`', value: 'Invertir en activos.' },
                            { name: '`/bolsa vender`', value: 'Vender activos.' },
                            { name: '`/bolsa portafolio`', value: 'Ver tus rendimientos.' },
                            { name: '`/inversion nueva`', value: 'Abrir plazo fijo (CDT).' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino Nación MX')
                        .setDescription('¡Apuesta y gana! La casa (casi) nunca pierde.')
                        .addFields(
                            { name: '`/casino fichas comprar`', value: 'Comprar fichas (1 ficha = $1).' },
                            { name: '`/casino fichas retirar`', value: 'Cambiar fichas por dinero.' },
                            { name: '`/jugar slots`', value: 'Tragamonedas clásica.' },
                            { name: '`/jugar dados`', value: 'Adivina suma (Mayor/Menor).' },
                            { name: '`/jugar ruleta`', value: 'Ruleta (Rojo/Negro/Número).' },
                            { name: '`/jugar crash`', value: '¡Sal antes de que explote!' },
                            { name: '`/jugar caballos`', value: 'Carreras.' },
                            { name: '`/jugar gallos`', value: 'Pelea de gallos.' },
                            { name: '`/jugar rusa`', value: 'Ruleta Rusa (Peligroso).' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Legal & Policial')
                        .addFields(
                            { name: '`/fichar`', value: 'Buscar antecedentes penales (Policía).' },
                            { name: '`/multa`', value: 'Imponer multa (Policía/Juez).' },
                            { name: '`/impuestos pagar`', value: 'Pagar impuestos pendientes.' },
                            { name: '`/licencia registrar`', value: 'Registrar licencia de conducir.' }
                        );
                    break;
                case 'utils':
                    newEmbed.setTitle('⚙️ Utilidades')
                        .addFields(
                            { name: '`/balanza`', value: 'Resumen financiero total (Net Worth).' },
                            { name: '`/notificaciones`', value: 'Activar/desactivar DMs del banco.' },
                            { name: '`/ping`', value: 'Ver latencia del bot.' },
                            { name: '`/rol`', value: 'Asignarse roles de trabajo.' }
                        );
                    break;
            }

            await i.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            // Optional: Disable on timeout
        });
    }



    else if (commandName === 'tarjeta') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'info') {
            const file = new AttachmentBuilder(path.join(__dirname, 'assets', 'banco_mexico_banner.png'));

            // Debit Cards (3 tiers)
            const debitCards = [
                { name: 'NMX Débito', cost: '$100', desc: 'Cuenta básica con débito.' },
                { name: 'NMX Débito Plus', cost: '$500', desc: 'Mayor límite de transferencias.' },
                { name: 'NMX Débito Gold', cost: '$1,000', desc: 'Sin límites, cashback en compras.' }
            ];

            const personalCards = [
                { name: 'NMX Start', limit: '15k', interest: '15%', cost: '$2k', desc: 'Ideal para iniciar historial.' },
                { name: 'NMX Básica', limit: '30k', interest: '12%', cost: '$4k', desc: 'Gastos moderados y frecuentes.' },
                { name: 'NMX Plus', limit: '50k', interest: '10%', cost: '$6k', desc: 'Más poder adquisitivo.' },
                { name: 'NMX Plata', limit: '100k', interest: '8%', cost: '$10k', desc: 'Beneficios exclusivos.' },
                { name: 'NMX Oro', limit: '250k', interest: '7%', cost: '$15k', desc: 'Estatus y comodidad.' },
                { name: 'NMX Rubí', limit: '500k', interest: '6%', cost: '$25k', desc: 'Lujo al alcance.' },
                { name: 'NMX Black', limit: '1M', interest: '5%', cost: '$40k', desc: 'Prestigio total.' },
                { name: 'NMX Diamante', limit: '2M', interest: '3%', cost: '$60k', desc: 'Poder ilimitado.' },
                { name: 'NMX Zafiro', limit: '5M', interest: '2.5%', cost: '$100k', desc: 'Ultra premium ⭐' },
                { name: 'NMX Platino Elite', limit: '10M', interest: '2%', cost: '$150k', desc: 'Máximo nivel personal 👑' }
            ];

            const businessCards = [
                { name: 'Business Start', limit: '50k', interest: '2%', cost: '$8k', desc: 'Emprendedores • Crédito renovable • Reportes mensuales.' },
                { name: 'Business Gold', limit: '100k', interest: '1.5%', cost: '$15k', desc: 'Pymes • Mejor rendimiento • Cashback 1% en compras.' },
                { name: 'Business Platinum', limit: '200k', interest: '1.2%', cost: '$20k', desc: 'Expansión • Acceso prioritario • Sin comisiones internacionales.' },
                { name: 'Business Elite', limit: '500k', interest: '1%', cost: '$35k', desc: 'Corp • Línea crédito flexible • Seguro de viajes incluido.' },
                { name: 'NMX Corporate', limit: '1M', interest: '0.7%', cost: '$50k', desc: 'Industrias • Máximo beneficio fiscal • Asesor financiero dedicado.' },
                { name: 'Corporate Plus', limit: '5M', interest: '0.5%', cost: '$100k', desc: 'Corporativos grandes ⭐' },
                { name: 'Enterprise', limit: '10M', interest: '0.4%', cost: '$200k', desc: 'Empresas transnacionales 🏢' },
                { name: 'Conglomerate', limit: '25M', interest: '0.3%', cost: '$350k', desc: 'Conglomerados 🌟' },
                { name: 'Supreme', limit: '50M', interest: '0.2%', cost: '$500k', desc: 'Top tier empresarial 👑' }
            ];

            const embed = new EmbedBuilder()
                .setTitle('Información Oficial - Banco Nacional')
                .setColor(0x00FF00)
                .setImage('attachment://banco_mexico_banner.png')
                .setDescription('El **Banco Nacional** ofrece productos financieros para personas y empresas. Revisa nuestro catálogo completo.')
                .addFields({
                    name: '💡 Comandos Útiles',
                    value: '>>> **`/balanza`** - Ver tu dinero total (Efec + Banco + Crédito).\n**`/depositar`** - Depósito general (Cualquier usuario).\n**`/transferir`** - Transferencia Débito (Requiere Tarjeta ambos).\n**`/giro`** - Envío diferido (24h).\n**`/credito estado`** - Ver deuda y límite.\n**`/credito pagar`** - Abonar a tu deuda.\n**`/impuestos`** - Consultar impuestos.',
                    inline: false
                });


            // Debit Cards Field
            let dText = '';
            debitCards.forEach(c => {
                dText += `💳 **${c.name}**\n`;
                dText += `└ Costo: **${c.cost}** | ${c.desc}\n`;
            });

            // Personal Cards Field
            let pText = '';
            personalCards.forEach(c => {
                pText += `👤 **${c.name}**\n`;
                pText += `└ Límite: **$${c.limit}** | Costo: **${c.cost}** | Interés: **${c.interest}**\n`;
            });

            // Business Cards Field - SPLIT INTO 2 TO AVOID 1024 CHAR LIMIT
            let bText1 = '';
            let bText2 = '';

            // First 5 cards
            businessCards.slice(0, 5).forEach(c => {
                bText1 += `🏢 **${c.name}**\n`;
                bText1 += `└ Límite: **$${c.limit}** | Costo: **${c.cost}** | Interés: **${c.interest}**\n`;
                bText1 += `└ ${c.desc}\n`;
            });

            // Last 4 cards + instructions
            businessCards.slice(5).forEach(c => {
                bText2 += `🏢 **${c.name}**\n`;
                bText2 += `└ Límite: **$${c.limit}** | Costo: **${c.cost}** | Interés: **${c.interest}**\n`;
                bText2 += `└ ${c.desc}\n`;
            });

            bText2 += `\n💡 **¿Cómo solicitar?**\n`;
            bText2 += `1️⃣ Abre un ticket en <#1450269843600310373>\n`;
            bText2 += `2️⃣ Un asesor te ayudará con el proceso\n`;
            bText2 += `3️⃣ Usa \`/empresa credito\` para usar tu línea`;

            embed.addFields(
                { name: '🏦 Tarjetas de Débito', value: dText, inline: false },
                { name: '💳 Tarjetas de Crédito Personales', value: pText, inline: false },
                { name: '🏭 Tarjetas Empresariales (1/2)', value: bText1, inline: false },
                { name: '🏭 Tarjetas Empresariales (2/2)', value: bText2, inline: false }
            );

            embed.setFooter({ text: 'Banco Nacional RP • Intereses semanales (Domingos) • Pagos obligatorios' });

            await interaction.reply({ embeds: [embed], files: [file] });
        }

        else if (subcommand === 'ver') {
            const cardName = interaction.options.getString('nombre');

            // Card database with detailed info
            const allCards = {
                'NMX Start': { limit: 2000, interest: 3, score: 0, tier: 'Inicial', benefits: ['Sin anualidad', 'App móvil incluida'], color: 0x808080 },
                'NMX Básica': { limit: 4000, interest: 2.5, score: 30, tier: 'Básica', benefits: ['Cashback 1%', 'Seguro básico'], color: 0x4169E1 },
                'NMX Plus': { limit: 6000, interest: 2, score: 50, tier: 'Plus', benefits: ['Cashback 2%', 'Protección de compras'], color: 0x32CD32 },
                'NMX Plata': { limit: 10000, interest: 1.5, score: 60, tier: 'Premium', benefits: ['Cashback 3%', 'Seguro de viaje', 'Concierge'], color: 0xC0C0C0 },
                'NMX Oro': { limit: 15000, interest: 1.2, score: 70, tier: 'Elite', benefits: ['Cashback 4%', 'Lounge aero', 'Asistencia 24/7'], color: 0xFFD700 },
                'NMX Rubí': { limit: 25000, interest: 1, score: 80, tier: 'Elite Plus', benefits: ['Cashback 5%', 'Concierge premium', 'Eventos exclusivos'], color: 0xE0115F },
                'NMX Black': { limit: 40000, interest: 0.8, score: 85, tier: 'Black', benefits: ['Cashback 6%', 'Prioridad máxima', 'Gestor personal'], color: 0x000000 },
                'NMX Diamante': { limit: 60000, interest: 0.5, score: 90, tier: 'Diamante', benefits: ['Cashback 8%', 'Servicios ilimitados', 'Sin límites'], color: 0xB9F2FF },
                'NMX Business Start': { limit: 50000, interest: 2, score: 70, tier: 'Empresarial', benefits: ['Facturación integrada', 'Control de gastos'], color: 0x1E90FF },
                'NMX Business Gold': { limit: 100000, interest: 1.5, score: 75, tier: 'Corporativa', benefits: ['Tarjetas adicionales', 'Reportes avanzados'], color: 0xFFD700 },
                'NMX Business Platinum': { limit: 200000, interest: 1.2, score: 80, tier: 'Corporativa Plus', benefits: [' Cuentas por pagar', 'API de integración'], color: 0xE5E4E2 },
                'NMX Business Elite': { limit: 500000, interest: 1, score: 85, tier: 'Elite Corp', benefits: ['Línea directa CFO', 'Asesoría fiscal'], color: 0x4B0082 },
                'NMX Corporate': { limit: 1000000, interest: 0.7, score: 90, tier: 'Corporate', benefits: ['Gestor dedicado', 'Términos personalizados', 'Liquidez ilimitada'], color: 0x800020 }
            };

            const card = allCards[cardName];

            if (!card) {
                return await interaction.reply({ content: '❌ Tarjeta no encontrada.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 ${cardName}`)
                .setColor(card.color)
                .setDescription(`**Nivel:** ${card.tier}`)
                .addFields(
                    { name: '💰 Límite de Crédito', value: `$${card.limit.toLocaleString()}`, inline: true },
                    { name: '📊 Interés Semanal', value: `${card.interest}%`, inline: true },
                    { name: '⭐ Score Requerido', value: `${card.score}+/100`, inline: true },
                    { name: '✨ Beneficios', value: card.benefits.map(b => `• ${b}`).join('\n'), inline: false },
                    { name: '📅 Corte', value: 'Domingos 11:59 PM', inline: true },
                    { name: '💡 Cómo Solicitar', value: 'Contacta al Staff del banco con tu DNI', inline: false }
                )
                .setFooter({ text: 'Banco Nacional RP' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    else if (commandName === 'registrar-tarjeta') {
        // DEFER IMMEDIATELY before anything else
        await interaction.deferReply({ ephemeral: false });

        try {

            // === ROLE-BASED AUTHORIZATION ===
            const BANKER_ROLES = {
                REGULAR: '1450591546524307689',      // Banquero
                EXECUTIVE: '1451291919320748275'     // Ejecutivo Banquero
            };

            const isExecutiveBanker = interaction.member.roles.cache.has(BANKER_ROLES.EXECUTIVE);
            const isRegularBanker = interaction.member.roles.cache.has(BANKER_ROLES.REGULAR);
            const isAdmin = interaction.member.permissions.has('Administrator');

            // Check if user has any banker role or is admin
            if (!isExecutiveBanker && !isRegularBanker && !isAdmin) {
                return interaction.editReply('⛔ **Permiso Denegado**\n\nSolo el personal bancario puede registrar tarjetas.\n👥 Roles requeridos: Banquero o Ejecutivo Banquero');
            }

            const targetUser = interaction.options.getUser('usuario');
            if (!targetUser) return interaction.editReply('❌ Debes especificar un usuario.');

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply('⛔ **Seguridad:** No puedes registrarte una tarjeta a ti mismo. Pide a otro banquero que lo haga.');
            }

            const holderName = interaction.options.getString('nombre_titular');
            const cardType = interaction.options.getString('tipo');

            if (cardType.startsWith('separator')) return interaction.editReply('❌ Selección inválida: Has elegido un separador.');

            // === CARD TYPE AUTHORIZATION (Banker Tier) ===
            const regularBankerAllowedCards = [
                'NMX Débito', 'NMX Débito Plus', 'NMX Débito Gold',
                'NMX Start', 'NMX Básica', 'NMX Plus', 'NMX Plata',
                'NMX Oro', 'NMX Rubí', 'NMX Black', 'NMX Diamante'
            ];

            // Regular bankers can only offer cards up to Diamante
            if (isRegularBanker && !isExecutiveBanker && !isAdmin) {
                if (!regularBankerAllowedCards.includes(cardType)) {
                    return interaction.editReply(
                        `⛔ **Permiso Denegado**\n\n` +
                        `No tienes autorización para ofrecer **${cardType}**.\n\n` +
                        `💼 **Banquero Regular:**\n` +
                        `└ Tarjetas de débito\n` +
                        `└ Tarjetas personales hasta **NMX Diamante**\n\n` +
                        `👔 **Ejecutivo Banquero:**\n` +
                        `└ Todas las tarjetas personales\n` +
                        `└ Tarjetas empresariales\n` +
                        `└ Tarjetas premium (Zafiro, Platino Elite)`
                    );
                }
            }

            // Business Card Validation
            if (cardType.includes('Business') || cardType.includes('Corporate')) {
                const { data: companies } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('owner_id', targetUser.id)
                    .limit(1);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('⛔ **Requisito Empresarial:** El usuario debe ser dueño de una empresa registrada para solicitar tarjetas Business/Corporate.');
                }
            }

            const dniPhoto = interaction.options.getAttachment('foto_dni');
            const notes = interaction.options.getString('notas') || 'Sin notas';

            // CARD STATS MAP (Global)
            const stats = CARD_TIERS[cardType || 'NMX Start'] || CARD_TIERS['NMX Start'];

            // 2. Find Citizen (Optional check, but we need to link it eventually. If not found, create one?)
            // The user said "pide foto de dni, nombre del titular". This implies we might be CREATING the citizen logic here or just linking.
            // I'll search for citizen by Discord ID. If not found, I will create one using the provided Name.
            let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (!citizen) {
                return interaction.editReply({
                    content: `❌ **Error:** El usuario <@${targetUser.id}> no está registrado en el censo.\n⚠️ **Acción Requerida:** Usa el comando \`/fichar vincular\` para registrar su Nombre y DNI antes de emitir una tarjeta.`
                });
            }
            // Update name?
            if (citizen.full_name !== holderName) {
                await supabase.from('citizens').update({ full_name: holderName }).eq('id', citizen.id);
            }

            // 3. Send Interactive Offer
            const isDebit = cardType.includes('Débito');
            const offerEmbed = new EmbedBuilder()
                .setTitle(isDebit ? '💳 Oferta de Tarjeta de Débito' : '💳 Oferta de Tarjeta de Crédito')
                .setColor(0xD4AF37)
                .setDescription(`Hola <@${targetUser.id}>,\nEl Banco Nacional te ofrece una tarjeta **${cardType}**.\n\n**Titular:** ${holderName}\n\n**Detalles del Contrato:**`);

            // Add fields based on card type
            if (isDebit) {
                // Debit cards show max_balance, not credit limit
                offerEmbed.addFields(
                    { name: 'Límite de Almacenamiento', value: stats.max_balance === Infinity ? 'Ilimitado ♾️' : `$${stats.max_balance.toLocaleString()}`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Tipo', value: '🏦 Débito', inline: true },
                    { name: 'Notas', value: notes }
                );
            } else {
                // Credit cards show limit and interest
                offerEmbed.addFields(
                    { name: 'Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${stats.interest}%`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Notas', value: notes }
                );
            }

            offerEmbed
                .setThumbnail(dniPhoto.url)
                .setFooter({ text: 'Tienes 5 minutos para aceptar. Revisa los términos antes.' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('btn_terms').setLabel('📄 Ver Términos').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_accept').setLabel('✅ Aceptar y Pagar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_reject').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
                );

            // Send to channel (Public)
            const message = await interaction.channel.send({ content: `<@${targetUser.id}>`, embeds: [offerEmbed], components: [row] });
            await interaction.editReply(`✅ Oferta enviada a <@${targetUser.id}> para tarjeta **${cardType}**.`);

            // 4. Collector
            const filter = i => i.user.id === targetUser.id;
            const collector = message.createMessageComponentCollector({ filter, time: 300000 }); // 5 min

            collector.on('collect', async i => {
                if (i.customId === 'btn_terms') {
                    const tycEmbed = new EmbedBuilder()
                        .setTitle('📜 Términos y Condiciones')
                        .setColor(0x333333)
                        .setDescription(`**📜 CONTRATO DE TARJETA DE CRÉDITO - BANCO NACIONAL**
                    
**1. OBLIGACIÓN DE PAGO**
El titular se compromete a realizar pagos semanales de al menos el **25% de la deuda total** antes del corte (Domingo 11:59 PM).

**2. INTERESES ORDINARIOS**
El saldo no liquidado generará un interés semanal según el nivel de la tarjeta (Ver tabla de tasas).

**3. CONSECUENCIAS DE IMPAGO**
- **1 Semana de atraso:** Reporte negativo en Buró y cobro de intereses sobre saldo vencido.
- **2 Semanas de atraso:** Bloqueo temporal de la tarjeta y congelamiento de activos.
- **3 Semanas de atraso:** Embargo de bienes y boletín de búsqueda policial por fraude.

**4. USO DE LA TARJETA**
Esta tarjeta es personal e intransferible. El titular es responsable de todos los cargos realizados con ella. El Banco Nacional colaborará con la policía en caso de compras ilegales.`);
                    await i.reply({ embeds: [tycEmbed], ephemeral: false });
                }
                else if (i.customId === 'btn_reject') {
                    await i.update({ content: '❌ Oferta rechazada.', components: [] });
                    collector.stop();
                }
                else if (i.customId === 'btn_accept') {

                    const payRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reg_pay_cash').setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reg_pay_bank').setLabel('🏦 Banco (UB)').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('reg_pay_debit').setLabel('💳 Débito (NMX)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: '💳 **Selecciona método de pago para la apertura:**', embeds: [], components: [payRow] });
                }
                else if (['reg_pay_cash', 'reg_pay_bank', 'reg_pay_debit'].includes(i.customId)) {
                    await i.deferUpdate();
                    try {
                        // 1. Check Funds & Charge
                        if (stats.cost > 0) {
                            if (i.customId === 'reg_pay_cash') {
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.cash || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente efectivo. Tienes: $${(bal.cash || 0).toLocaleString()}`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'cash');
                            }
                            else if (i.customId === 'reg_pay_bank') {
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente en Banco UB. Tienes: $${(bal.bank || 0).toLocaleString()}`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'bank');
                            }
                            else if (i.customId === 'reg_pay_debit') {
                                // Unified with Bank
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente en Banco/Débito.`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'bank');
                            }
                        }

                        // *** DEBIT CARD LOGIC ***
                        if (cardType.includes('Débito')) {
                            const cardNumber = '4279' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
                            const { error: insertError } = await supabase.from('debit_cards').insert([{
                                discord_user_id: targetUser.id,
                                citizen_id: citizen.id,
                                card_number: cardNumber,
                                card_tier: cardType,
                                balance: 0,
                                status: 'active'
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            // Send notification to channel
                            try {
                                const notifChannel = await client.channels.fetch('1452346918620500041');
                                if (notifChannel) {
                                    const notifEmbed = new EmbedBuilder()
                                        .setColor('#00D26A')
                                        .setTitle('💳 Nueva Tarjeta de Débito Registrada')
                                        .addFields(
                                            { name: '👤 Titular', value: `${holderName} (<@${targetUser.id}>)`, inline: false },
                                            { name: '🏦 Tipo', value: cardType, inline: true },
                                            { name: '💳 Número', value: `\`${cardNumber}\``, inline: true },
                                            { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: false }
                                        )
                                        .setTimestamp();
                                    await notifChannel.send({ embeds: [notifEmbed] });
                                }
                            } catch (notifError) {
                                console.error('[registrar-tarjeta] Notification error:', notifError);
                            }

                            await message.edit({
                                content: `✅ **Cuenta de Débito Abierta** para **${holderName}**.\n💳 Número: \`${cardNumber}\`\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        } else {
                            // *** CREDIT CARD LOGIC (Original) ***
                            const { error: insertError } = await supabase.from('credit_cards').insert([{
                                citizen_id: citizen.id,
                                discord_user_id: targetUser.id,
                                card_type: cardType,
                                card_name: cardType,
                                card_limit: stats.limit,
                                current_balance: 0,
                                interest_rate: stats.interest / 100,
                                status: 'active',
                                next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            // LOGGING: New Card
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🔖 Nueva Tarjeta de Crédito Registrada')
                                .setColor('#FFD700')
                                .addFields(
                                    { name: '👤 Titular', value: `${holderName} (<@${targetUser.id}>)`, inline: false },
                                    { name: '💳 Tipo', value: cardType, inline: true },
                                    { name: '💰 Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                                    { name: '📊 Interés', value: `${stats.interest}%`, inline: true },
                                    { name: '👮 Registrado por', value: `<@${interaction.user.id}>`, inline: false }
                                )
                                .setFooter({ text: 'Banco Nacional RP' })
                                .setTimestamp();

                            logToChannel(targetUser.client.guilds.cache.get(interaction.guildId), LOG_CREACION_TARJETA, logEmbed);

                            await message.edit({
                                content: `✅ **Tarjeta Activada** para **${holderName}**. Cobro de $${stats.cost.toLocaleString()} realizado.\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        }

                    } catch (err) {
                        console.error(err);
                        await i.followUp({ content: `❌ Error procesando: ${err.message}`, ephemeral: false });
                    }
                    collector.stop();
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) message.edit({ content: '⚠️ Oferta expirada.', components: [] });
            });

        } catch (error) {
            console.error('[registrar-tarjeta] Critical Error:', error);
        }
    }

    else if (commandName === 'credito') {
        await interaction.deferReply({ ephemeral: false }); // Global defer to prevent timeouts

        const subCmd = interaction.options.getSubcommand();
        const isPrivate = interaction.options.getBoolean('privado') ?? false;

        if (subCmd === 'buro') {

            const { data: citizen } = await supabase.from('citizens').select('id, full_name, credit_score').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado.');

            const score = citizen.credit_score || 100;
            // Generate ASCII Progress Bar: [████████░░] 80/100
            const filled = Math.round(score / 10); // 0-10
            const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

            const embed = new EmbedBuilder()
                .setTitle(`📉 Buró Financiero: ${citizen.full_name}`)
                .setColor(score > 60 ? 0x00FF00 : (score > 30 ? 0xFFA500 : 0xFF0000))
                .addFields(
                    { name: 'Score Crediticio', value: `${bar} **${score}/100**` },
                    { name: 'Estado', value: score > 60 ? '✅ Excelente' : (score > 30 ? '⚠️ Regular' : '⛔ RIESGO (Acceso Limitado)') }
                )
                .setFooter({ text: 'Mantén un buen historial pagando tus tarjetas a tiempo.' });

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'info' && interaction.options.getSubcommandGroup() !== 'admin') {

            const { data: citizen } = await supabase.from('citizens').select('id, full_name, dni').eq('discord_id', interaction.user.id).limit(1).maybeSingle();
            if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado.');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).limit(1).maybeSingle();
            if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

            const embed = new EmbedBuilder()
                .setTitle(`💳 ${userCard.card_type} | Banco Nacional`)
                .setColor(0x000000) // Classic Black/Dark
                .addFields(
                    { name: 'Titular', value: citizen.full_name, inline: true },
                    { name: 'DNI', value: citizen.dni || 'N/A', inline: true },
                    { name: 'Estado', value: userCard.status === 'active' ? '✅ Activa' : '⛔ Bloqueada', inline: true },
                    { name: 'Emisión', value: `<t:${Math.floor(new Date(userCard.created_at).getTime() / 1000)}:D>`, inline: true },
                    { name: 'Corte', value: 'Domingos', inline: true }
                )
                .setFooter({ text: `ID: ${userCard.id.split('-')[0]}...` }); // Short ID like a card number snippet

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'estado') {

            // FIX: Query 'citizens' table instead of 'profiles' because credit_cards are linked to citizens.
            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) {
                return interaction.editReply('❌ No tienes un ciudadano vinculado a tu Discord. Contacta a un administrador en el Panel.');
            }

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!userCard) {
                return interaction.editReply('❌ No tienes una tarjeta activa actualmente.');
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 Estado de Cuenta: ${userCard.card_type}`)
                .setColor(0xD4AF37)
                .addFields(
                    { name: 'Deuda Actual', value: `$${userCard.current_balance.toLocaleString()}`, inline: true },
                    { name: 'Límite', value: `$${userCard.credit_limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${userCard.interest_rate}%`, inline: true }
                )
                .setFooter({ text: 'El corte es cada domingo a medianoche.' });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'pedir-prestamo') {

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Función Desactivada')
                    .setColor(0xFF0000)
                    .setDescription('Las tarjetas de crédito ahora funcionan como **método de pago directo**.\n\n**No puedes retirar efectivo**, pero puedes usar tu tarjeta para pagar:\n• Multas\n• Licencias\n• Empresas\n• Transferencias\n\nAl pagar, selecciona "💳 Crédito" como método de pago.')
                    .setFooter({ text: 'Banco Nacional - Nuevas Políticas de Crédito' })
                ]
            });
        }

        else if (subCmd === 'pagar') {

            // Robust amount handling
            const amount = interaction.options.getNumber('monto') || interaction.options.getInteger('monto');
            if (!amount || amount <= 0) return interaction.editReply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: isPrivate });

            try {
                // 1. Find User (Citizen) & Card
                // Note: removed profile join to avoid crashes
                const { data: citizen } = await supabase.from('citizens').select('id, discord_id').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (!citizen) return interaction.editReply({ content: '❌ No tienes cuenta vinculada (Citizen).', ephemeral: isPrivate });

                const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (!userCard) return interaction.editReply({ content: '❌ No tienes una tarjeta activa.', ephemeral: isPrivate });

                if (amount > userCard.current_balance) {
                    return interaction.editReply({ content: `⚠️ Solo debes **$${userCard.current_balance.toLocaleString()}**. No puedes pagar más de lo que debes.`, ephemeral: isPrivate });
                }

                // 2. CHECK FUNDS FIRST (User Request)
                try {
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                    // Check cash + bank (or just cash? usually cash is for hand payments, bank for transfers. Let's assume Total or Cash.
                    // Discord economy bots usually prioritize Cash or Bank. Let's check Total to be safe, or check documentation/preference.
                    // User screenshot shows Cash: 10k, Bank: 0, Total: 10k.
                    // Let's check Total Liquid Assets.
                    const userMoney = balance.total || (balance.cash + balance.bank);

                    if (userMoney < amount) {
                        return interaction.editReply({ content: `❌ **Fondos Insuficientes**. \nTienes: $${userMoney.toLocaleString()} \nIntentas pagar: $${amount.toLocaleString()}`, ephemeral: isPrivate });
                    }

                    // 3. Take Money from UnbelievaBoat
                    // Show payment selector  
                    const pmCred = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
                    const pbCred = createPaymentButtons(pmCred, 'cred_pay');
                    const paymentEmbed = createPaymentEmbed(`💳 Pago de Crédito: ${userCard.card_type}`, amount, pmCred);
                    await interaction.editReply({ embeds: [paymentEmbed], components: [pbCred] });
                    const fCred = i => i.user.id === interaction.user.id && i.customId.startsWith('cred_pay_');
                    const cCred = interaction.channel.createMessageComponentCollector({ filter: fCred, time: 60000, max: 1 });
                    cCred.on('collect', async (i) => {
                        try { await i.deferUpdate(); } catch (err) { return; }
                        const prCred = await processPayment(i.customId.replace('cred_pay_', ''), interaction.user.id, interaction.guildId, amount, `Pago Tarjeta ${userCard.card_type}`, pmCred);
                        if (!prCred.success) return i.editReply({ content: prCred.error, components: [] });

                        const newDebt = userCard.current_balance - amount;
                        await supabase.from('credit_cards').update({ current_balance: newDebt }).eq('id', userCard.id);
                        await i.editReply({ content: `✅ Pago procesado (${prCred.method})\n💳 ${userCard.card_type}\n💰 Pagado: $${amount.toLocaleString()}\n📊 Nuevo saldo: $${newDebt.toLocaleString()}`, components: [] });
                    });
                    cCred.on('end', c => { if (c.size === 0) interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }); });
                    return;
                } catch (err) {
                    console.error('[credito] Error:', err);
                    return interaction.editReply({ content: '❌ Error procesando pago.', components: [] });
                }
            } catch (err) {
                console.error('[credito-pagar] Error:', err);
                return interaction.editReply({ content: '❌ Error procesando solicitud.', ephemeral: isPrivate });
            }
        }



        else if (interaction.options.getSubcommandGroup() === 'admin') {
            // Permission Check
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '⛔ Solo administradores pueden usar esto.', ephemeral: false });
            }

            const subCmdAdmin = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('usuario');

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '⛔ **Seguridad:** No puedes usar comandos administrativos sobre tu propia cuenta.', ephemeral: true });
            }

            // Already deferred globally at command start

            // Resolve Citizen (Credit Cards are linked to CITIZENS, not Profiles directly)
            // 1. Try to find via Citizens table first
            const { data: citizen } = await supabase.from('citizens').select('id, full_name, credit_score, discord_id').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) return interaction.editReply('❌ Este usuario no tiene un ciudadano vinculado (No tiene registro en el sistema financiero).');

            const { data: userCard } = await supabase.from('credit_cards')
                .select('*')
                .eq('citizen_id', citizen.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!userCard) return interaction.editReply('❌ Este usuario no tiene tarjetas registradas.');

            if (subCmdAdmin === 'info') {
                const embed = new EmbedBuilder()
                    .setTitle(`📂 Info Bancaria: ${citizen.full_name}`)
                    .setColor(0x0000FF)
                    .addFields(
                        { name: 'Tarjeta', value: userCard.card_type || 'Desconocida', inline: true },
                        { name: 'Estado', value: userCard.status || 'Desconocido', inline: true },
                        { name: 'Deuda', value: `$${(userCard.current_balance || 0).toLocaleString()}`, inline: true },
                        { name: 'Límite', value: `$${(userCard.card_limit || userCard.credit_limit || 0).toLocaleString()}`, inline: true },
                        { name: 'Discord ID', value: targetUser.id, inline: true }
                    );
                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'historial') {
                // Get citizen balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                const cash = balance.cash || 0;
                const bank = balance.bank || 0;

                // Get all credit cards
                const { data: allCards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('citizen_id', citizen.id)
                    .order('created_at', { ascending: false });

                let totalCreditLimit = 0;
                let totalDebt = 0;
                let totalAvailable = 0;

                if (allCards && allCards.length > 0) {
                    allCards.forEach(card => {
                        const limit = card.card_limit || card.credit_limit || 0;
                        const debt = card.current_balance || 0;
                        totalCreditLimit += limit;
                        totalDebt += debt;
                        totalAvailable += (limit - debt);
                    });
                }

                // Get transaction history (payments made)
                const { data: payments } = await supabase
                    .from('credit_card_payments')
                    .select('*')
                    .eq('card_id', userCard.id)
                    .order('payment_date', { ascending: false })
                    .limit(10);

                let totalPaid = 0;
                let interestPaid = 0;

                if (payments) {
                    payments.forEach(p => {
                        totalPaid += (p.amount || 0);
                        interestPaid += (p.interest_amount || 0);
                    });
                }

                // Calculate usage stats
                const cardAge = userCard.created_at ? Math.floor((Date.now() - new Date(userCard.created_at)) / (1000 * 60 * 60 * 24)) : 0;
                const utilizationRate = totalCreditLimit > 0 ? Math.round((totalDebt / totalCreditLimit) * 100) : 0;

                // Get credit score
                const { data: citizenScore } = await supabase
                    .from('citizens')
                    .select('credit_score')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                const creditScore = citizenScore?.credit_score || 100;

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Historial Financiero: ${citizen.full_name}`)
                    .setColor(0x1E90FF)
                    .setDescription(`Análisis completo para decisiones de crédito`)
                    .addFields(
                        { name: '💰 Efectivo', value: `$${cash.toLocaleString()}`, inline: true },
                        { name: '🏦 Banco/Débito', value: `$${bank.toLocaleString()}`, inline: true },
                        { name: '📈 Score Crediticio', value: `${creditScore}/100`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**TARJETAS DE CRÉDITO**', inline: false },
                        { name: '💳 Límite Total', value: `$${totalCreditLimit.toLocaleString()}`, inline: true },
                        { name: '📊 Deuda Total', value: `$${totalDebt.toLocaleString()}`, inline: true },
                        { name: '✅ Disponible', value: `$${totalAvailable.toLocaleString()}`, inline: true },
                        { name: '📉 Utilización', value: `${utilizationRate}%`, inline: true },
                        { name: '📅 Antigüedad', value: `${cardAge} días`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**HISTORIAL DE PAGOS**', inline: false },
                        { name: '💵 Total Pagado', value: `$${totalPaid.toLocaleString()}`, inline: true },
                        { name: '📈 Intereses Pagados', value: `$${interestPaid.toLocaleString()}`, inline: true },
                        { name: '🎁 Puntos Acumulados', value: `${userCard.reward_points || 0} pts`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**RECOMENDACIÓN**', inline: false },
                        {
                            name: '💡 Análisis', value:
                                utilizationRate < 30 && creditScore > 70
                                    ? '✅ **EXCELENTE** - Cliente apto para upgrade'
                                    : utilizationRate > 70
                                        ? '⚠️ **PRECAUCIÓN** - Alta utilización de crédito'
                                        : creditScore < 50
                                            ? '❌ **RIESGO** - Score bajo, no recomendar upgrade'
                                            : '📊 **REGULAR** - Monitorear comportamiento',
                            inline: false
                        }
                    )
                    .setFooter({ text: `Reporte generado por ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'puntos') {
                // Fetch Citizen to get Score (not profile, Score is on citizens now)
                const { data: citizenData } = await supabase.from('citizens').select('id, full_name, credit_score').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

                if (!citizenData) return interaction.editReply('❌ No tiene un ciudadano vinculado.');

                const amountChange = interaction.options.getInteger('cantidad');
                const reason = interaction.options.getString('razon');

                let currentScore = citizenData.credit_score || 100;
                let newScore = currentScore + amountChange;

                // Clamp 0-100
                if (newScore > 100) newScore = 100;
                if (newScore < 0) newScore = 0;

                await supabase.from('citizens').update({ credit_score: newScore }).eq('id', citizenData.id);

                const embed = new EmbedBuilder()
                    .setTitle('📉 Ajuste de Buró Financiero')
                    .setColor(amountChange >= 0 ? 0x00FF00 : 0xFF0000)
                    .setDescription(`El score de **${citizenData.full_name}** ha sido actualizado por **${interaction.user.tag}**.`)
                    .addFields(
                        { name: 'Cambio', value: `${amountChange > 0 ? '+' : ''}${amountChange}`, inline: true },
                        { name: 'Nuevo Score', value: `${newScore}/100`, inline: true },
                        { name: 'Motivo', value: reason }
                    );

                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'perdonar') {
                await supabase.from('credit_cards').update({ current_balance: 0 }).eq('id', userCard.id);
                await supabase.from('transaction_logs').insert([{
                    card_id: userCard.id,
                    discord_user_id: targetUser.id,
                    amount: userCard.current_balance,
                    type: 'ADJUSTMENT',
                    status: 'SUCCESS',
                    metadata: { type: 'FORGIVE', by: interaction.user.tag }
                }]);
                await interaction.editReply(`✅ Deuda perdonada para **${citizen.full_name}**. Deuda actual: $0.`);
            }

            else if (subCmdAdmin === 'congelar') {
                await supabase.from('credit_cards').update({ status: 'FROZEN' }).eq('id', userCard.id);
                await interaction.editReply(`❄️ Tarjeta de **${citizen.full_name}** ha sido **CONGELADA**.`);
            }

            else if (subCmdAdmin === 'descongelar') {
                await supabase.from('credit_cards').update({ status: 'ACTIVE' }).eq('id', userCard.id);
                await interaction.editReply(`🔥 Tarjeta de **${citizen.full_name}** ha sido **DESCONGELADA** y está Activa.`);
            }


            else if (subCmdAdmin === 'ofrecer-upgrade') {
                // Robust Citizen Lookup
                let citizenData = null;
                // let userCard is defined in outer scope, but we might need to refresh it or specifically get the citizen from it

                // 1. Try to find via Credit Card (Strongest link if they have one)
                const { data: cardData } = await supabase
                    .from('credit_cards')
                    .select('*, citizens!inner(id, full_name, credit_score, discord_id)')
                    .eq('citizens.discord_id', targetUser.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (cardData) {
                    citizenData = cardData.citizens;
                } else {
                    // 2. Fallback: Find citizen directly (if they don't have a card yet)
                    const { data: cData } = await supabase
                        .from('citizens')
                        .select('id, full_name, credit_score')
                        .eq('discord_id', targetUser.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    citizenData = cData;
                }

                if (!citizenData) {
                    return interaction.editReply('❌ No tiene un ciudadano vinculado.');
                }

                const score = citizenData.credit_score || 100;

                // Require good credit score (>70) to offer upgrade
                if (score < 70) {
                    return interaction.editReply(`❌ **${citizen.full_name}** tiene un Score de ${score}/100. Se requiere mínimo 70 puntos para ofrecer un upgrade.`);
                }

                // Card tier ladder
                // Card tier ladder & Stats
                const cardStats = {
                    'NMX Start': { limit: 15000, interest: 15, cost: 2000 },
                    'NMX Básica': { limit: 30000, interest: 12, cost: 4000 },
                    'NMX Plus': { limit: 50000, interest: 10, cost: 6000 },
                    'NMX Plata': { limit: 100000, interest: 8, cost: 10000 },
                    'NMX Oro': { limit: 250000, interest: 7, cost: 15000 },
                    'NMX Rubí': { limit: 500000, interest: 6, cost: 25000 },
                    'NMX Black': { limit: 1000000, interest: 5, cost: 40000 },
                    'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000 }
                };
                const tiers = Object.keys(cardStats);

                const currentTier = userCard.card_type;
                const currentIndex = tiers.indexOf(currentTier);

                if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
                    return interaction.editReply(`ℹ️ **${citizenData.full_name}** ya tiene la mejor tarjeta disponible: **${currentTier}**.`);
                }

                const nextTier = tiers[currentIndex + 1];
                const nextStats = cardStats[nextTier];

                // Button for User to Accept
                const upgradeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`btn_upgrade_${targetUser.id}_${nextTier.replace(/ /g, '_')}`)
                        .setLabel(`Aceptar y Pagar $${nextStats.cost.toLocaleString()}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💳'),
                    new ButtonBuilder()
                        .setCustomId(`btn_cancel_upgrade_${targetUser.id}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

                // Send Offer to Channel Publicly (Ticket)
                const offerEmbed = new EmbedBuilder()
                    .setTitle('🎁 ¡Oferta Exclusiva de Banco Nacional!')
                    .setColor(0xFFD700)
                    .setDescription(`Estimado/a <@${targetUser.id}>,\n\nDado tu excelente historial crediticio (Score: **${score}/100**), el Banco Nacional te ofrece una **mejora de tarjeta**.\n\n**Beneficios:**\n✅ Nuevo Límite: $${nextStats.limit.toLocaleString()}\n✅ Tasa Interés: ${nextStats.interest}%`)
                    .addFields(
                        { name: 'Tarjeta Actual', value: currentTier, inline: true },
                        { name: 'Nueva Oferta', value: `✨ **${nextTier}**`, inline: true },
                        { name: 'Coste Mejora', value: `$${nextStats.cost.toLocaleString()}`, inline: true },
                        { name: 'Ejecutivo Asignado', value: '<@1451291919320748275>', inline: false }
                    )
                    .setFooter({ text: 'Pulsa el botón para aceptar la mejora inmediata.' })
                    .setTimestamp();

                await interaction.editReply({
                    content: `🔔 Atención <@${targetUser.id}>`,
                    embeds: [offerEmbed],
                    components: [upgradeRow]
                });
            }
        }
        else if (subCmd === 'debug') {
            await interaction.deferReply({ ephemeral: false });

            const userId = interaction.user.id;
            const userName = interaction.user.tag;
            let output = `🔍 **Diagnóstico de Usuario**\n`;
            output += `Discord ID: \`${userId}\`\n`;
            output += `Usuario: ${userName}\n\n`;

            // 1. Search in Citizens with loose matching
            // Try explicit match
            const { data: exactMatch, error: exactError } = await supabase.from('citizens').select('*').eq('discord_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (exactMatch) {
                output += `✅ **Ciudadano Encontrado (Match Exacto)**\n`;
                output += `ID: ${exactMatch.id}\nNombre: ${exactMatch.full_name}\nDNI: ${exactMatch.dni}\nDiscordID en DB: \`${exactMatch.discord_id}\`\n\n`;

                const { data: card } = await supabase.from('credit_cards').select('*').eq('citizen_id', exactMatch.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (card) {
                    output += `✅ **Tarjeta Encontrada**\nTipo: ${card.card_type}\nEstado: ${card.status}\n`;
                } else {
                    output += `⚠️ **Sin Tarjeta vinculada al ciudadano.**\n`;
                }

            } else {
                output += `❌ **No se encontró coincidencia exacta en Citizens.**\n`;
                if (exactError) output += `Error DB: ${exactError.message}\n`;

                // Try fuzzy search or list recent to help Staff identify the correct record
                const { data: potentials } = await supabase.from('citizens').select('full_name, discord_id').limit(5).order('created_at', { ascending: false });
                output += `\n📋 **Últimos 5 registros (Para comparar):**\n`;
                if (potentials) {
                    potentials.forEach(p => {
                        output += `- ${p.full_name}: \`${p.discord_id}\`\n`;
                    });
                }
            }

            // Check Profiles just in case
            const { data: profile } = await supabase.from('profiles').select('*').eq('discord_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (profile) {
                output += `\n✅ **Perfil Web Encontrado (profiles)**\nRole: ${profile.role}\n`;
            } else {
                output += `\n⚠️ **Sin Perfil Web (profiles)**\n`;
            }

            await interaction.editReply(output.substring(0, 1999));
        }
    }

    else if (commandName === 'info') {
        await interaction.deferReply();

        try {
            const { data: companies, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('[/info] Error:', error);
                return interaction.editReply('❌ Error obteniendo información de empresas.');
            }

            if (!companies || companies.length === 0) {
                return interaction.editReply('📋 No hay empresas registradas todavía.');
            }

            const pages = [];
            for (const company of companies) {
                let ownersText = 'Sin propietarios';
                if (company.owner_ids && company.owner_ids.length > 0) {
                    ownersText = company.owner_ids.map(id => `<@${id}>`).join(', ');
                }

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')  // Gold/Yellow for business
                    .setTitle(`🏢 ${company.name || 'Sin nombre'}`)
                    .setDescription(company.description || '_Sin descripción disponible_')
                    .addFields(
                        { name: '👥 Propietarios', value: ownersText, inline: false },
                        { name: '💼 Tipo de Negocio', value: company.business_type || 'No especificado', inline: true },
                        {
                            name: '📅 Registrada', value: new Date(company.created_at).toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            }), inline: true
                        }
                    );

                // Address/Location
                if (company.address) {
                    embed.addFields({ name: '📍 Ubicación', value: company.address, inline: false });
                }

                // Discord server (required)
                if (company.discord_server) {
                    embed.addFields({ name: '💬 Servidor Discord', value: company.discord_server, inline: false });
                }

                // Business hours if available
                if (company.hours) {
                    embed.addFields({ name: '🕐 Horario', value: company.hours, inline: false });
                }

                // Add logo as thumbnail
                if (company.logo_url) {
                    embed.setThumbnail(company.logo_url);
                }

                // Add location photo as main image
                if (company.location_photo_url) {
                    embed.setImage(company.location_photo_url);
                }

                embed.setFooter({ text: `Empresa ${pages.length + 1}/${companies.length} • Directorio de Nación MX` })
                    .setTimestamp();

                pages.push(embed);
            }

            let currentPage = 0;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('info_prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('info_next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(pages.length === 1)
            );

            const message = await interaction.editReply({ embeds: [pages[0]], components: pages.length > 1 ? [row] : [] });

            if (pages.length > 1) {
                const collector = message.createMessageComponentCollector({ time: 180000 });
                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Solo tú puedes navegar.', ephemeral: true });
                    await i.deferUpdate();
                    if (i.customId === 'info_next') currentPage++;
                    else currentPage--;
                    const newRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('info_prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('info_next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === pages.length - 1)
                    );
                    await i.editReply({ embeds: [pages[currentPage]], components: [newRow] });
                });
                collector.on('end', () => interaction.editReply({ components: [] }).catch(() => { }));
            }
        } catch (err) {
            console.error('[/info] Error:', err);
            return interaction.editReply('❌ Error inesperado.');
        }
    }

    else if (commandName === 'rol') {
        await interaction.deferReply({ ephemeral: false });
        const subCmd = interaction.options.getSubcommand();
        if (subCmd === 'cancelar') {

            const targetUser = interaction.options.getString('usuario');
            const reason = interaction.options.getString('razon');
            const location = interaction.options.getString('ubicacion');
            const proof1 = interaction.options.getAttachment('prueba1');
            const proof2 = interaction.options.getAttachment('prueba2');

            // Insert into DB
            const { error } = await supabase.from('rp_cancellations').insert([{
                moderator_discord_id: interaction.user.id,
                moderator_name: interaction.user.tag,
                target_user: targetUser,
                reason: reason,
                location: location,
                proof_url_1: proof1 ? proof1.url : null,
                proof_url_2: proof2 ? proof2.url : null
            }]);

            if (error) {
                console.error(error);
                return interaction.editReply('❌ Error guardando el reporte en la base de datos.');
            }

            // Create Embed
            const embed = new EmbedBuilder()
                .setTitle('🚨 CANCELACIÓN DE ROL')
                .setColor(0xFF0000)
                .addFields(
                    { name: '👤 Usuario Sancionado', value: targetUser, inline: true },
                    { name: '👮 Moderador', value: interaction.user.tag, inline: true },
                    { name: '📍 Ubicación', value: location, inline: false },
                    { name: '📝 Razón', value: reason, inline: false }
                )
                .setTimestamp();

            if (proof1) embed.setImage(proof1.url);
            if (proof2) embed.setThumbnail(proof2.url);

            // Try to send to configured channel
            const logChannelId = process.env.RP_LOGS_CHANNEL_ID || process.env.NOTIFICATION_CHANNEL_ID;
            let published = false;

            if (logChannelId) {
                try {
                    const channel = await client.channels.fetch(logChannelId);
                    if (channel) {
                        await channel.send({ embeds: [embed] });
                        published = true;
                    }
                } catch (e) {
                    console.error('Error publishing report:', e);
                }
            }

            if (published) {
                await interaction.editReply('✅ Reporte de cancelación enviado y publicado exitosamente.');
            } else {
                // Return embed to user if channel not found
                await interaction.editReply({
                    content: '✅ Reporte guardado en base de datos. (No se encontró canal de logs público)',
                    embeds: [embed]
                });
            }
        }
    }



    else if (commandName === 'multa') {
        await interaction.deferReply();

        // 1. Role Check (Policia: 1416867605976715363)
        if (!interaction.member.roles.cache.has('1416867605976715363') && !interaction.member.permissions.has('Administrator')) {
            return interaction.editReply({ content: '⛔ No tienes placa de policía (Rol Requerido).', ephemeral: false });
        }

        const targetUser = interaction.options.getUser('usuario');
        const amount = interaction.options.getNumber('monto');
        const reason = interaction.options.getString('razon');

        // 2. Find Citizen
        let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!citizen) {
            // Auto-register "John Doe" so we can fine him
            // Use targetUser.globalName or username as fallback
            const displayName = targetUser.globalName || targetUser.username;
            console.log(`Auto-registering ${displayName} for fine...`);

            const { data: newCit, error: createError } = await supabase.from('citizens').insert([{
                discord_id: targetUser.id,
                full_name: displayName,
                dni: 'PENDING_MULTA',
                credit_score: 50 // Penalty for not being registered? Or default 100.
            }]).select('id, full_name').single();

            if (createError || !newCit) return interaction.editReply(`❌ Error creando registro temporal: ${createError?.message}`);

            citizen = newCit; // Assign to continue logic
        }

        // 3. Request Payment Method
        const paymentResult = await requestPaymentMethod(
            interaction,
            targetUser.id,
            amount,
            `🚔 Multa: ${reason}`
        );

        let status = 'UNPAID';
        let paymentMethod = 'ninguno';

        if (paymentResult.success) {
            status = 'PAID';
            paymentMethod = paymentResult.method;
        }

        // 4. Record Fine
        const { error: fineError } = await supabase.from('fines').insert([{
            citizen_id: citizen.id,
            officer_discord_id: interaction.user.id,
            amount: amount,
            reason: reason,
            status: status
        }]);

        const paymentMethodLabel = paymentMethod === 'cash' ? '💵 Efectivo' : paymentMethod === 'bank' ? '🏦 Banco/Débito' : paymentMethod === 'credit' ? '💳 Crédito' : '⏳ Pendiente';

        const embed = new EmbedBuilder()
            .setTitle('🚔 Multa Aplicada')
            .setColor(status === 'PAID' ? 0xFF0000 : 0xFFA500)
            .addFields(
                { name: 'Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Monto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Estado', value: status === 'PAID' ? '✅ Pagado' : '⏳ Pendiente', inline: true },
                { name: 'Método de Pago', value: paymentMethodLabel, inline: true },
                { name: 'Motivo', value: reason, inline: false },
                { name: 'Oficial', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });
    }

    else if (commandName === 'fichar') {
        await interaction.deferReply({ ephemeral: false });
        const subCmd = interaction.options.getSubcommand();

        // --- SUBCOMMAND: VINCULAR (STAFF ONLY) ---
        if (subCmd === 'vincular') {
            // 1. Role Check (Staff Banco: 1450591546524307689)
            if (!interaction.member.roles.cache.has('1450591546524307689') && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('⛔ No tienes permisos para vincular ciudadanos (Rol Staff Banco Requerido).');
            }

            const targetUser = interaction.options.getUser('usuario');
            const fullName = interaction.options.getString('nombre');
            const dniPhoto = interaction.options.getAttachment('dni');

            // 2. Check if Citizen exists (by Discord ID)
            let { data: existingCitizen } = await supabase.from('citizens').select('*').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (existingCitizen) {
                // Update existing
                const { error: updateError } = await supabase.from('citizens').update({ full_name: fullName, dni: dniPhoto.url }).eq('id', existingCitizen.id);
                if (updateError) return interaction.editReply(`❌ Error actualizando ciudadano: ${updateError.message}`);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Ciudadano Actualizado')
                    .setColor(0x00FF00)
                    .setDescription(`Los datos de <@${targetUser.id}> han sido actualizados.`)
                    .addFields(
                        { name: 'Nombre', value: fullName, inline: true },
                        { name: 'DNI (Foto)', value: '[Ver Documento](' + dniPhoto.url + ')', inline: true }
                    )
                    .setThumbnail(dniPhoto.url)
                    .setFooter({ text: `Vinculado por ${interaction.user.tag}` });
                return interaction.editReply({ embeds: [embed] });
            } else {
                // Create new
                const { error: createError } = await supabase.from('citizens').insert([{
                    discord_id: targetUser.id,
                    full_name: fullName,
                    dni: dniPhoto.url, // Store URL
                    credit_score: 100 // Default score
                }]);

                if (createError) return interaction.editReply(`❌ Error registrando ciudadano: ${createError.message}`);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Ciudadano Registrado y Vinculado')
                    .setColor(0x00FF00)
                    .setDescription(`Se ha creado un nuevo registro para <@${targetUser.id}>.`)
                    .addFields(
                        { name: 'Nombre', value: fullName, inline: true },
                        { name: 'DNI (Foto)', value: '[Ver Documento](' + dniPhoto.url + ')', inline: true }
                    )
                    .setThumbnail(dniPhoto.url)
                    .setFooter({ text: `Registrado por ${interaction.user.tag}` });
                return interaction.editReply({ embeds: [embed] });
            }
        }
    }


    if (commandName === 'saldo') {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        try {
            // Get UnbelievaBoat balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);

            // Get casino chips (if any)
            const { data: casinoData } = await supabase
                .from('casino_chips')
                .select('chips')
                .eq('user_id', targetUser.id)
                .single();

            const chips = casinoData?.chips || 0;

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`💰 Saldo de ${targetUser.username}`)
                .addFields(
                    { name: '💵 Efectivo', value: `$${(balance.cash || 0).toLocaleString()}`, inline: true },
                    { name: '🏦 Banco', value: `$${(balance.bank || 0).toLocaleString()}`, inline: true },
                    { name: '💎 Total', value: `$${(balance.total || 0).toLocaleString()}`, inline: true }
                )
                .setTimestamp();

            if (chips > 0) {
                embed.addFields({ name: '🎰 Fichas Casino', value: `${chips.toLocaleString()} fichas`, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[saldo] Error:', error);
            await interaction.editReply('❌ Error al obtener el saldo.');
        }
    }
    else if (commandName === 'empresa') {
        await interaction.deferReply();

        const subCmd = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            // ===== CREAR EMPRESA =====
            if (subCmd === 'crear') {
                const nombre = interaction.options.getString('nombre');
                const dueño = interaction.options.getUser('dueño');
                const tipoLocal = interaction.options.getString('tipo_local'); // Can be null
                const logo = interaction.options.getAttachment('logo');
                const fotoLocal = interaction.options.getAttachment('foto_local');
                const ubicacion = interaction.options.getString('ubicacion');
                const discordServer = interaction.options.getString('discord_server');
                const coDueño = interaction.options.getUser('co_dueño');
                const esPrivada = interaction.options.getBoolean('es_privada') || false;

                // Cost calculation
                const TRAMITE_FEE = 250000;
                const LOCAL_COSTS = {
                    'pequeño': 850000,
                    'mediano': 1750000,
                    'grande': 3200000,
                    'gigante': 5000000
                };

                // If no tipo_local specified, only charge tramite fee
                let totalCost = TRAMITE_FEE;
                if (tipoLocal) {
                    totalCost += LOCAL_COSTS[tipoLocal];
                }

                // Check if name is unique
                const { data: existing } = await supabase.from('companies').select('id').eq('name', nombre).maybeSingle();
                if (existing) {
                    return interaction.editReply({ content: '❌ Nombre ya existe.' });
                }

                // Show rich payment selector
                const pmEmpresa = await getAvailablePaymentMethods(dueño.id, interaction.guildId);
                const pbEmpresa = createPaymentButtons(pmEmpresa, 'emp_pay');
                const empresaEmbed = createPaymentEmbed(`🏢 ${nombre}`, totalCost, pmEmpresa);

                await interaction.editReply({
                    embeds: [empresaEmbed],
                    components: [pbEmpresa]
                });

                // Wait for payment method
                const filter = i => i.user.id === interaction.user.id && (i.customId.startsWith('emp_pay_') || i.customId.startsWith('emp_'));
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

                let paymentProcessed = false; // Prevent duplicate payments

                collector.on('collect', async (i) => {
                    try {
                        if (paymentProcessed) {
                            return i.deferUpdate().catch(() => { });
                        }

                        paymentProcessed = true;
                        // Important: deferUpdate must happen immediately
                        await i.deferUpdate();

                        const method = i.customId.replace('emp_pay_', '').replace('emp_', '');
                        console.log(`[empresa] Payment attempt: Method=${method}, Owner=${dueño.id}, Executor=${i.user.id}`);

                        // Process payment based on method - DUEÑO PAYS
                        if (method === 'cash' || method === 'bank') {
                            const balance = await billingService.ubService.getUserBalance(interaction.guildId, dueño.id);
                            const source = method === 'cash' ? 'cash' : 'bank';
                            if ((balance[source] || 0) < totalCost) {
                                paymentProcessed = false; // Allow retry
                                return i.editReply({ content: `❌ El dueño no tiene saldo suficiente en ${source === 'cash' ? 'efectivo' : 'banco'}.`, components: [] });
                            }
                            await billingService.ubService.removeMoney(interaction.guildId, dueño.id, totalCost, `Empresa: ${nombre}`, source);
                        } else if (method === 'debit' || method === 'credit') {
                            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', dueño.id).maybeSingle();
                            if (!citizen) {
                                paymentProcessed = false; // Allow retry
                                return i.editReply({ content: '❌ El dueño no tiene cuenta vinculada.', components: [] });
                            }

                            if (method === 'debit') {
                                // Correct column names: discord_user_id and status
                                const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', dueño.id).eq('status', 'active').maybeSingle();
                                if (!card) {
                                    paymentProcessed = false; // Allow retry
                                    return i.editReply({ content: '❌ El dueño no tiene tarjeta de débito activa.', components: [] });
                                }
                                const balance = await billingService.ubService.getUserBalance(interaction.guildId, dueño.id);
                                if ((balance.bank || 0) < totalCost) {
                                    paymentProcessed = false; // Allow retry
                                    return i.editReply({ content: '❌ Saldo bancario insuficiente del dueño.', components: [] });
                                }
                                await billingService.ubService.removeMoney(interaction.guildId, dueño.id, totalCost, `Empresa: ${nombre}`, 'bank');
                            } else {
                                const { data: card } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).maybeSingle();
                                if (!card) {
                                    paymentProcessed = false; // Allow retry
                                    return i.editReply({ content: '❌ El dueño no tiene tarjeta de crédito.', components: [] });
                                }
                                const available = card.credit_limit - card.current_balance;
                                if (available < totalCost) {
                                    paymentProcessed = false; // Allow retry
                                    return i.editReply({ content: `❌ Crédito insuficiente ($${available.toLocaleString()}).`, components: [] });
                                }
                                await supabase.from('credit_cards').update({ current_balance: card.current_balance + totalCost }).eq('id', card.id);
                            }
                        }

                        // Create company
                        const ownerIds = [dueño.id];
                        if (coDueño) ownerIds.push(coDueño.id);

                        const { data: newCompany, error } = await supabase.from('companies').insert({
                            name: nombre,
                            owner_id: dueño.id,
                            balance: 0,
                            created_at: new Date().toISOString(),
                            logo_url: logo?.url,
                            local_type: tipoLocal || 'pequeño',
                            local_photo_url: fotoLocal ? fotoLocal.url : null,
                            location: ubicacion,
                            // co_owner_id restored as requested
                            co_owner_id: coDueño ? coDueño.id : null,
                            is_private: esPrivada,
                            owner_ids: ownerIds,
                            vehicle_count: 0,
                            industry_type: 'General',
                            // discord_server restored as requested
                            discord_server: discordServer
                        }).select().single();

                        if (error) {
                            console.error('[empresa] DB Error:', error);
                            paymentProcessed = false;
                            // Refund money since DB insert failed
                            try {
                                // TODO: Implement refund logic or better yet, do payment in transaction
                                // For now, just show error
                            } catch (e) { }

                            return i.editReply({ content: `❌ Error creando empresa en BD: ${error.message || error.details || JSON.stringify(error)}`, components: [] });
                        }

                        // Add role to owner
                        try {
                            const member = await interaction.guild.members.fetch(dueño.id);
                            const role = interaction.guild.roles.cache.find(r => r.name === 'Empresario'); // Adjust role name
                            if (role) await member.roles.add(role);
                        } catch (e) {
                            console.error('Error adding role:', e);
                        }

                        console.log(`[empresa] Company created: ${newCompany.name} (${newCompany.id})`);

                        const embed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('🏢 Empresa Registrada')
                            .setThumbnail(logo?.url)
                            .addFields(
                                { name: '🏷️ Nombre', value: nombre, inline: true },
                                { name: '👔 Dueño', value: `<@${dueño.id}>`, inline: true },
                                { name: '🏠 Local', value: tipoLocal ? (tipoLocal.charAt(0).toUpperCase() + tipoLocal.slice(1)) : 'Sin Local', inline: true },
                                { name: '🚗 Vehículos', value: `${newCompany.vehicle_count}`, inline: true },
                                { name: '💰 Costo Total', value: `$${totalCost.toLocaleString()}`, inline: true },
                                { name: '🆔 ID Empresa', value: newCompany.id.substring(0, 8), inline: true }
                            )
                            .setTimestamp();

                        if (coDueño) embed.addFields({ name: '👥 Co-Dueño', value: `<@${coDueño.id}>`, inline: true });
                        if (fotoLocal) embed.setImage(fotoLocal.url);

                        // Add vehicle addition buttons
                        const vehicleRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`company_addvehicle_${newCompany.id}`)
                                .setLabel('➕ Agregar Vehículo')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`company_finish_${newCompany.id}`)
                                .setLabel('✅ Finalizar')
                                .setStyle(ButtonStyle.Success)
                        );

                        await i.editReply({
                            content: '✅ Empresa registrada exitosamente!\n\n¿Deseas agregar vehículos a tu empresa?',
                            embeds: [embed],
                            components: [vehicleRow]
                        });

                        // LOGGING: New Company
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🏢 Nueva Empresa Registrada')
                            .setColor('#00FF00')
                            .addFields(
                                { name: 'Empresa', value: nombre, inline: true },
                                { name: 'Dueño', value: `<@${dueño.id}>`, inline: true },
                                { name: 'Tipo Local', value: tipoLocal || 'Pequeño', inline: true },
                                { name: 'Costo', value: `$${totalCost.toLocaleString()}`, inline: true }
                            )
                            .setFooter({ text: `ID: ${newCompany.id}` })
                            .setTimestamp();

                        logToChannel(interaction.guild, LOG_EMPRESAS, logEmbed);

                    } catch (err) {
                        console.error('[empresa crear payment ERROR]', err);
                        paymentProcessed = false;
                        if (i.replied || i.deferred) {
                            return i.editReply({ content: `❌ Error inesperado: ${err.message}`, components: [] }).catch(() => { });
                        }
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }).catch(() => { });
                    }
                });

                return; // Exit crear subcommand
            }

            // ===== MENU =====
            if (subCmd === 'menu') {
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [userId]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.\nUsa `/empresa crear` para registrar una.');
                }

                const company = companies[0]; // Show first company

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle(`🏢 ${company.name}`)
                    .setThumbnail(company.logo_url)
                    .addFields(
                        { name: '💰 Balance', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                        { name: '🚗 Vehículos', value: `${company.vehicle_count}`, inline: true },
                        { name: '📍 Estado', value: company.status, inline: true }
                    );

                if (company.location) embed.addFields({ name: '📍 Ubicación', value: company.location });
                // Check both local_photo_url (new) and banner_url (old/legacy)
                const imageUrl = company.local_photo_url || company.banner_url;
                if (imageUrl) embed.setImage(imageUrl);

                return interaction.editReply({ embeds: [embed] });
            }



            // ===== CONTRATAR =====
            if (subCmd === 'contratar') {
                const targetUser = interaction.options.getUser('usuario');
                const sueldo = interaction.options.getNumber('sueldo');
                const puesto = interaction.options.getString('puesto') || 'Empleado';

                // Get owner's company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }
                const company = companies[0]; // First company

                // Check if already hired
                const { data: existing } = await supabase.from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('discord_user_id', targetUser.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (existing) {
                    return interaction.editReply(`❌ <@${targetUser.id}> ya es empleado de **${company.name}**.`);
                }

                // Add to employees
                const { error } = await supabase.from('company_employees').insert({
                    company_id: company.id,
                    discord_user_id: targetUser.id,
                    salary: sueldo,
                    role: puesto,
                    status: 'active',
                    hired_at: new Date().toISOString()
                });

                if (error) {
                    console.error('[empresa contratar]', error);
                    return interaction.editReply('❌ Error al contratar empleado.');
                }

                // LOGGING: Hire
                const logEmbed = new EmbedBuilder()
                    .setTitle('🤝 Nuevo Empleado Contratado')
                    .setColor('#00AAFF')
                    .setDescription(`🏢 **Empresa:** ${company.name}\n👤 **Empleado:** <@${targetUser.id}>\n💰 **Sueldo:** $${sueldo.toLocaleString()}\n👔 **Puesto:** ${puesto}`)
                    .setTimestamp();
                logToChannel(interaction.guild, LOG_EMPRESAS, logEmbed);

                return interaction.editReply(`✅ **Contratado:** <@${targetUser.id}> ha sido añadido a la nómina de **${company.name}** con sueldo de $${sueldo.toLocaleString()}.`);
            }

            // ===== DESPEDIR =====
            if (subCmd === 'despedir') {
                const targetUser = interaction.options.getUser('usuario');

                // Get owner's company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }
                const company = companies[0];

                // Check if employee exists
                const { data: employee } = await supabase.from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('discord_user_id', targetUser.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!employee) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no es un empleado activo de **${company.name}**.`);
                }

                // Fire (update status)
                const { error } = await supabase.from('company_employees')
                    .update({ status: 'fired', updated_at: new Date().toISOString() })
                    .eq('id', employee.id);

                if (error) {
                    console.error('[empresa despedir]', error);
                    return interaction.editReply('❌ Error al despedir empleado.');
                }

                // LOGGING: Fire
                const logEmbed = new EmbedBuilder()
                    .setTitle('🚪 Empleado Despedido')
                    .setColor('#FF0000')
                    .setDescription(`🏢 **Empresa:** ${company.name}\n👤 **Empleado:** <@${targetUser.id}>`)
                    .setTimestamp();
                logToChannel(interaction.guild, LOG_EMPRESAS, logEmbed);

                return interaction.editReply(`🚫 **Despedido:** <@${targetUser.id}> ha sido removido de la nómina de **${company.name}**.`);
            }

            // ===== EMPLEADOS =====
            if (subCmd === 'empleados') {
                // Get owner's company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                }
                const company = companies[0];

                const { data: employees } = await supabase.from('company_employees')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('status', 'active');

                if (!employees || employees.length === 0) {
                    return interaction.editReply(`🏢 **${company.name}** no tiene empleados activos.`);
                }

                const list = employees.map((e, i) =>
                    `${i + 1}. <@${e.discord_user_id}> - **${e.role}** - $${(e.salary || 0).toLocaleString()}`
                ).join('\n');

                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle(`👥 Empleados de ${company.name}`)
                    .setDescription(list)
                    .setFooter({ text: `Total: ${employees.length} empleados` });

                return interaction.editReply({ embeds: [embed] });
            }

            // ===== AGREGAR VEHICULO (STAFF ONLY) =====
            if (subCmd === 'agregar-vehiculo') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply('⛔ **Permiso Denegado**\nSolo el Staff puede agregar vehículos a las empresas.');
                }

                const targetOwner = interaction.options.getUser('empresa_usuario');
                const modelo = interaction.options.getString('modelo');
                const placa = interaction.options.getString('placa');

                const { data: companies } = await supabase.from('companies')
                    .select('*')
                    .contains('owner_ids', [targetOwner.id]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply(`❌ El usuario <@${targetOwner.id}> no tiene empresas registradas.`);
                }

                const company = companies[0];

                // Update vehicle count
                const newCount = (company.vehicle_count || 0) + 1;

                const { error } = await supabase.from('companies')
                    .update({ vehicle_count: newCount })
                    .eq('id', company.id);

                if (error) {
                    console.error('[empresa agregar-vehiculo]', error);
                    return interaction.editReply('❌ Error actualizando empresa.');
                }

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🚗 Vehículo Agregado')
                    .setDescription(`Se ha agregado un vehículo a la flotilla de **${company.name}**.\n\n👤 **Dueño:** <@${targetOwner.id}>\n🚙 **Modelo:** ${modelo}\n🔢 **Placa:** ${placa}\n\n📊 **Total Vehículos:** ${newCount}`);

                return interaction.editReply({ embeds: [embed] });
            }

            // ===== CREDITO =====
            // ===== CREDITO (Solicitar) =====
            if (subCmd === 'credito') {
                const monto = interaction.options.getNumber('monto');
                const razon = interaction.options.getString('razon') || 'Expansión de negocio';

                // Get company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);
                if (!companies || companies.length === 0) return interaction.editReply('❌ No tienes empresa.');
                const company = companies[0];

                // Check active loans
                const { data: activeLoan } = await supabase.from('company_loans')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (activeLoan) {
                    return interaction.editReply(`❌ Ya tienes un crédito activo de **$${activeLoan.amount.toLocaleString()}**. Págalo primero.`);
                }

                if (monto > 5000000) return interaction.editReply('❌ El límite de crédito inicial es de $5,000,000.');

                // Create loan
                const { error: loanError } = await supabase.from('company_loans').insert({
                    company_id: company.id,
                    amount: monto,
                    interest_rate: 0.05, // 5% weekly
                    status: 'active',
                    next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                });

                if (loanError) {
                    console.error(loanError);
                    return interaction.editReply('❌ Error solicitando crédito.');
                }

                // Add funds to company
                await supabase.from('companies').update({ balance: (company.balance || 0) + monto }).eq('id', company.id);

                return interaction.editReply(`✅ **Crédito Aprobado**\n\nSe han depositado **$${monto.toLocaleString()}** a la cuenta de **${company.name}**.\n📅 Primer pago (Interés + Capital) en 7 días.`);
            }

            // ===== CREDITO PAGAR =====
            if (subCmd === 'credito-pagar') {
                const monto = interaction.options.getNumber('monto');

                // Get company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);
                if (!companies || companies.length === 0) return interaction.editReply('❌ No tienes empresa.');
                const company = companies[0];

                // Check loan
                const { data: activeLoan } = await supabase.from('company_loans')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!activeLoan) return interaction.editReply('✅ No tienes deudas de crédito activas.');

                if ((company.balance || 0) < monto) return interaction.editReply('❌ Fondos insuficientes en la empresa.');

                // Pay
                const remaining = activeLoan.amount - monto;
                const newStatus = remaining <= 0 ? 'paid' : 'active';
                const actualPay = remaining < 0 ? activeLoan.amount : monto; // Don't overpay logic simplified

                // Deduct from company
                await supabase.from('companies').update({ balance: (company.balance || 0) - actualPay }).eq('id', company.id);

                // Update loan
                await supabase.from('company_loans').update({
                    amount: remaining <= 0 ? 0 : remaining,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                }).eq('id', activeLoan.id);

                if (newStatus === 'paid') {
                    return interaction.editReply(`🎉 **¡Crédito Liquidado!**\nHas pagado la totalidad de tu deuda.`);
                } else {
                    return interaction.editReply(`✅ **Abono Exitoso**\nPagado: $${actualPay.toLocaleString()}\nRestante: $${remaining.toLocaleString()}`);
                }
            }

            // ===== CREDITO INFO =====
            if (subCmd === 'credito-info') {
                // Get company
                const { data: companies } = await supabase.from('companies').select('*').contains('owner_ids', [userId]);
                if (!companies || companies.length === 0) return interaction.editReply('❌ No tienes empresa.');
                const company = companies[0];

                const { data: activeLoan } = await supabase.from('company_loans')
                    .select('*')
                    .eq('company_id', company.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!activeLoan) return interaction.editReply('✅ **Estado:** Sin deudas activas. Eres libre.');

                const embed = new EmbedBuilder()
                    .setTitle(`📉 Estado de Crédito - ${company.name}`)
                    .setColor('#FF0000')
                    .addFields(
                        { name: '💰 Deuda Actual', value: `$${activeLoan.amount.toLocaleString()}`, inline: true },
                        { name: '📊 Tasa Interés', value: `${activeLoan.interest_rate * 100}% Semanal`, inline: true },
                        { name: '📅 Vencimiento', value: `<t:${Math.floor(new Date(activeLoan.next_payment_due).getTime() / 1000)}:R>`, inline: false }
                    );

                return interaction.editReply({ embeds: [embed] });
            }


            // ===== LISTAR USUARIO (STAFF) =====
            if (subCmd === 'listar-usuario') {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply('⛔ Solo staff puede usar este comando.');
                }

                const targetUser = interaction.options.getUser('usuario');
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [targetUser.id]);

                if (!companies || companies.length === 0) {
                    return interaction.editReply(`ℹ️ ${targetUser.username} no tiene empresas registradas.`);
                }

                const list = companies.map((c, i) => `${i + 1}. **${c.name}** (${c.status}) - $${(c.balance || 0).toLocaleString()}`).join('\n');

                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle(`🏢 Empresas de ${targetUser.username}`)
                    .setDescription(list)
                    .setFooter({ text: `Total: ${companies.length} empresas` });

                return interaction.editReply({ embeds: [embed] });
            }

            // ===== COBRAR (Terminal POS) =====
            else if (subCmd === 'cobrar') {
                const cliente = interaction.options.getUser('cliente');
                const monto = interaction.options.getNumber('monto');
                const razon = interaction.options.getString('razon');

                // Check if user owns or co-owns a company
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [userId]);

                const company = companies && companies.length > 0 ? companies[0] : null;

                if (!company) {
                    return interaction.editReply('❌ No tienes una empresa registrada. Usa `/empresa crear`');
                }

                if (monto <= 0) {
                    return interaction.editReply('❌ El monto debe ser mayor a 0');
                }

                // Create payment request
                const embed = new EmbedBuilder()
                    .setTitle('🏪 Terminal POS - Cobro Pendiente')
                    .setColor('#FFD700')
                    .setDescription(`**${company.name}** te está cobrando`)
                    .addFields(
                        { name: '💵 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: '📝 Concepto', value: razon, inline: true },
                        { name: '🏢 Empresa', value: company.name, inline: false }
                    )
                    .setFooter({ text: 'Tienes 60 segundos para aceptar o rechazar' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('pos_accept')
                            .setLabel('✅ Pagar')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('pos_reject')
                            .setLabel('❌ Rechazar')
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.editReply({
                    content: `<@${cliente.id}> - Tienes un cobro pendiente`,
                    embeds: [embed],
                    components: [row]
                });

                // Wait for customer response
                const filter = i => i.user.id === cliente.id && (i.customId === 'pos_accept' || i.customId === 'pos_reject');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

                collector.on('collect', async (i) => {
                    await i.deferUpdate();

                    if (i.customId === 'pos_accept') {
                        // Check customer balance
                        const balance = await billingService.ubService.getUserBalance(interaction.guildId, cliente.id);

                        if ((balance.cash || 0) < monto) {
                            return i.editReply({
                                content: `❌ <@${cliente.id}> no tiene suficiente efectivo`,
                                components: []
                            });
                        }

                        // Process payment
                        await billingService.ubService.removeMoney(interaction.guildId, cliente.id, monto, `Pago a ${company.name}: ${razon}`, 'cash');

                        // Add to company balance
                        await supabase
                            .from('companies')
                            .update({ balance: company.balance + monto })
                            .eq('id', company.id);

                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Pago Exitoso')
                            .setColor('#00FF00')
                            .setDescription(`**${cliente.tag}** pagó a **${company.name}**`)
                            .addFields(
                                { name: '💵 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                                { name: '📝 Concepto', value: razon, inline: true }
                            )
                            .setTimestamp();

                        return i.editReply({
                            content: '',
                            embeds: [successEmbed],
                            components: []
                        });
                    } else {
                        const rejectEmbed = new EmbedBuilder()
                            .setTitle('❌ Pago Rechazado')
                            .setColor('#FF0000')
                            .setDescription(`**${cliente.tag}** rechazó el pago`)
                            .setTimestamp();

                        return i.editReply({
                            content: '',
                            embeds: [rejectEmbed],
                            components: []
                        });
                    }
                });

                collector.on('end', (collected) => {
                    if (collected.size === 0) {
                        const timeoutEmbed = new EmbedBuilder()
                            .setTitle('⏱️ Tiempo Agotado')
                            .setColor('#FFA500')
                            .setDescription('El cobro expiró sin respuesta')
                            .setTimestamp();

                        interaction.editReply({
                            content: '',
                            embeds: [timeoutEmbed],
                            components: []
                        }).catch(() => { });
                    }
                });
            }

        } catch (error) {
            console.error('[empresa] Error:', error);
            return interaction.editReply('❌ Error procesando el comando de empresa.');
        }
    }
    else if (commandName === 'inversion') {
        await interaction.deferReply(); // Global defer

        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'nueva') {
            const amount = interaction.options.getNumber('monto');
            if (amount < 5000) return interaction.editReply('❌ La inversión mínima es de **$5,000**.');

            // Check Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const userMoney = balance.total || (balance.cash + balance.bank);

            if (userMoney < amount) {
                return interaction.editReply(`❌ **Fondos Insuficientes**. Tienes: $${userMoney.toLocaleString()}`);
            }

            // Remove Money
            // Show payment selector
            const pmInv = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
            const pbInv = createPaymentButtons(pmInv, 'inv_pay');
            const paymentEmbed = createPaymentEmbed(`📈 Inversión a Plazo (${days} días, ${rate}% interés)`, amount, pmInv);
            await interaction.editReply({ embeds: [paymentEmbed], components: [pbInv] });
            const fInv = i => i.user.id === interaction.user.id && i.customId.startsWith('inv_pay_');
            const cInv = interaction.channel.createMessageComponentCollector({ filter: fInv, time: 60000, max: 1 });
            cInv.on('collect', async (i) => {
                try { await i.deferUpdate(); } catch (err) { console.error('[inv] defer:', err.message); return; }
                const prInv = await processPayment(i.customId.replace('inv_pay_', ''), interaction.user.id, interaction.guildId, amount, 'Inversión Plazo Fijo', pmInv);
                if (!prInv.success) return i.editReply({ content: prInv.error, components: [] });

                // Calculate Dates and Profit
                const now = new Date();
                const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
                const interestRate = 5;
                const payout = amount + (amount * (interestRate / 100));

                // Insert DB
                await supabase.from('investments').insert([{
                    discord_id: interaction.user.id,
                    invested_amount: amount,
                    interest_rate: interestRate,
                    start_date: now.toISOString(),
                    end_date: endDate.toISOString(),
                    payout_amount: payout,
                    status: 'active'
                }]);

                await i.editReply({ content: `✅ Inversión creada (${prInv.method}). Retorno: **$${payout.toLocaleString()}** en 7 días.`, components: [] });
            });
            cInv.on('end', c => { if (c.size === 0) interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }); });
            return;
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Inversión Plazo Fijo`);

            // Calculate Dates and Profit
            const now = new Date();
            const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 Days
            const interestRate = 5; // 5% weekly
            const payout = amount + (amount * (interestRate / 100));

            // Insert DB
            await supabase.from('investments').insert([{
                discord_id: interaction.user.id,
                invested_amount: amount,
                interest_rate: interestRate,
                start_date: now.toISOString(),
                end_date: endDate.toISOString(),
                payout_amount: payout,
                status: 'active'
            }]);

            // Log
            await supabase.from('banking_transactions').insert([{
                sender_discord_id: interaction.user.id,
                receiver_discord_id: null,
                amount: amount,
                type: 'investment',
                description: `Apertura Plazo Fijo (7 días al ${interestRate}%)`
            }]);

            const embed = new EmbedBuilder()
                .setTitle('📈 Inversión Exitosa')
                .setColor(0x00FF00)
                .setDescription(`Has invertido **$${amount.toLocaleString()}**.\n\n📅 **Vencimiento:** <t:${Math.floor(endDate.getTime() / 1000)}:R>\n💰 **Retorno Esperado:** $${payout.toLocaleString()}\n\n*El dinero está bloqueado hasta la fecha de vencimiento.*`);

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'estado') {
            await interaction.deferReply();
            const { data: investments } = await supabase.from('investments')
                .select('*')
                .eq('discord_id', interaction.user.id)
                .eq('status', 'active');

            if (!investments || investments.length === 0) return interaction.editReply('📉 No tienes inversiones activas.');

            const embed = new EmbedBuilder()
                .setTitle('💼 Portafolio de Inversiones')
                .setColor(0xD4AF37);

            const rows = []; // Component rows (buttons)

            let desc = '';
            for (const inv of investments) {
                const endDate = new Date(inv.end_date);
                const isReady = new Date() >= endDate;
                const statusIcon = isReady ? '🟢 **DISPONIBLE**' : '🔒 Bloqueado';

                desc += `**ID:** \`${inv.id.split('-')[0]}\` | Inversión: **$${inv.invested_amount.toLocaleString()}**\nRetorno: **$${inv.payout_amount.toLocaleString()}** | ${statusIcon}\nVence: <t:${Math.floor(endDate.getTime() / 1000)}:R>\n\n`;

                if (isReady) {
                    rows.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`btn_collect_${inv.id}`)
                            .setLabel(`Retirar $${inv.payout_amount.toLocaleString()} (ID: ${inv.id.split('-')[0]})`)
                            .setStyle(ButtonStyle.Success)
                    ));
                }
            }

            embed.setDescription(desc || 'Tus inversiones aparecerán aquí.');

            // Limit buttons to 5 rows
            await interaction.editReply({ embeds: [embed], components: rows.slice(0, 5) });
        }
    }



    else if (commandName === 'nomina') {
        await interaction.deferReply(); // Global defer

        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'crear') {
            const name = interaction.options.getString('nombre');
            await supabase.from('payroll_groups').insert([{ owner_discord_id: interaction.user.id, name: name }]);
            await interaction.editReply(`✅ Grupo de nómina **${name}** creado.`);
        }
        else if (subCmd === 'agregar') {
            const groupName = interaction.options.getString('grupo');
            const target = interaction.options.getUser('empleado');
            const salary = interaction.options.getNumber('sueldo');

            // Find group
            const { data: group } = await supabase.from('payroll_groups').select('id').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
            if (!group) return interaction.editReply('❌ No encontré ese grupo o no eres el dueño.');

            await supabase.from('payroll_members').upsert([{ group_id: group.id, member_discord_id: target.id, salary: salary }]);
            await interaction.editReply(`✅ **${target.username}** agregado a **${groupName}** con sueldo $${salary}.`);
        }
        else if (subCmd === 'pagar') {
            const groupName = interaction.options.getString('grupo');

            const { data: group } = await supabase.from('payroll_groups').select('id').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
            if (!group) return interaction.editReply('❌ Grupo no encontrado.');

            const { data: members } = await supabase.from('payroll_members').select('*').eq('group_id', group.id);
            if (!members || members.length === 0) return interaction.editReply('❌ El grupo no tiene empleados.');

            let total = 0;
            members.forEach(m => total += m.salary);

            // Check Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const userMoney = balance.total || (balance.cash + balance.bank);
            if (userMoney < total) return interaction.editReply(`❌ Fondos insuficientes. Necesitas **$${total.toLocaleString()}**.`);

            // Process
            let report = `💰 **Nómina Pagada: ${groupName}**\nTotal: $${total.toLocaleString()}\n\n`;

            // Deduct from Owner
            // Show payment selector
            const pmNom = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
            const pbNom = createPaymentButtons(pmNom, 'nom_pay');
            const paymentEmbed = createPaymentEmbed(`💼 Nómina${groupName ? ': ' + groupName : ''} (${members.length} empleados)`, total, pmNom);
            await interaction.editReply({ embeds: [paymentEmbed], components: [pbNom] });
            const fNom = i => i.user.id === interaction.user.id && i.customId.startsWith('nom_pay_');
            const cNom = interaction.channel.createMessageComponentCollector({ filter: fNom, time: 60000, max: 1 });
            cNom.on('collect', async (i) => {
                try { await i.deferUpdate(); } catch (err) { return; }
                const prNom = await processPayment(i.customId.replace('nom_pay_', ''), interaction.user.id, interaction.guildId, total, `Pago Nómina${groupName ? ': ' + groupName : ''}`, pmNom);
                if (!prNom.success) return i.editReply({ content: prNom.error, components: [] });

                let report = `💰 **Nómina Pagada** (${prNom.method})\nTotal: $${total.toLocaleString()}\n\n`;
                for (const m of members) {
                    await billingService.ubService.addMoney(interaction.guildId, m.member_discord_id, m.salary, `Nómina${groupName ? ' de ' + groupName : ''}`);
                    report += `✅ <@${m.member_discord_id}>: $${m.salary.toLocaleString()}\n`;
                }
                await i.editReply({ content: report, components: [] });
            });
            cNom.on('end', c => { if (c.size === 0) interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }); });
            return;
        }
    }

    else if (commandName === 'jugar') {
        await interaction.deferReply();
        const game = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Get user chips
        const { data: userChips } = await supabase.from('casino_chips').select('*').eq('user_id', userId).maybeSingle();
        if (!userChips || userChips.chips < 10) {
            return interaction.editReply('❌ No tienes suficientes fichas. Compra con `/casino fichas comprar`');
        }

        if (game === 'slots') {
            const bet = interaction.options.getInteger('apuesta');
            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes. Tienes: ${userChips.chips}`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            const symbols = ['🍒', '🍋', '🍊', '⭐', '💎'];
            const r1 = symbols[Math.floor(Math.random() * symbols.length)];
            const r2 = symbols[Math.floor(Math.random() * symbols.length)];
            const r3 = symbols[Math.floor(Math.random() * symbols.length)];

            // ANIMATE!
            await animateSlots(interaction, [r1, r2, r3]);

            let win = 0, mult = 0;
            if (r1 === r2 && r2 === r3) {
                mult = r1 === '💎' ? 50 : r1 === '⭐' ? 25 : 10;
                win = bet * mult;
            } else if (r1 === r2 || r2 === r3 || r1 === r3) {
                mult = 2;
                win = bet * 2;
            }

            if (win > 0) {
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + win, total_won: (userChips.total_won || 0) + win, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            }

            const resultEmoji = win > 0 ? (mult >= 25 ? '🎉🎉🎉' : '✅') : '❌';
            const resultText = win > 0 ? `**¡GANAS!** 💰 +${win} fichas (${mult}x)` : '**Perdiste** 💸';

            return interaction.editReply(`🎰 **SLOTS**\n${r1} ${r2} ${r3}\n\n${resultEmoji} ${resultText}\n💼 Balance: ${(userChips.chips - bet + win).toLocaleString()} fichas`);
        }

        else if (game === 'dice') {
            const bet = interaction.options.getInteger('apuesta');
            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2; // 2d6 = 2-12
            const choice = interaction.options.getString('tipo') || 'alto';

            // ANIMATE!
            await animateDice(interaction);

            let won = false;
            if (choice === 'alto' && roll >= 8) won = true;
            if (choice === 'bajo' && roll <= 6) won = true;
            if (choice === 'par' && roll % 2 === 0) won = true;
            if (choice === 'impar' && roll % 2 === 1) won = true;
            if (choice === 'siete' && roll === 7) won = true;

            const payout = choice === 'siete' ? (won ? bet * 4 : 0) : (won ? bet * 2 : 0);

            if (payout > 0) {
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + payout, total_won: (userChips.total_won || 0) + payout, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            }

            const diceEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            const d1 = Math.min(Math.floor(roll / 2) - 1, 5);
            const d2 = Math.min((roll - 2) % 6, 5);
            const resultText = won ? `✅ **¡GANAS!** +${payout}` : `❌ **Perdiste** -${bet}`;
            return interaction.editReply(`🎲 **DADOS**\n\n${diceEmoji[d1]} + ${diceEmoji[d2]} = **${roll}**\n\nApuesta: **${choice.toUpperCase()}**\n${resultText}\n💼 ${(userChips.chips - bet + payout).toLocaleString()} fichas`);
        }

        else if (game === 'blackjack') {
            const bet = interaction.options.getInteger('apuesta');
            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            const card = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
            let pTotal = card() + card();
            let dTotal = card() + card();

            // ANIMATE!
            await interaction.editReply(`🃏 **BLACKJACK**\n\nRepartiendo cartas...`);
            await sleep(800);
            await interaction.editReply(`🃏 **BLACKJACK**\n\nTu mano: **${pTotal}**\nDealer: **?**`);
            await sleep(800);

            while (pTotal < 17) {
                pTotal += card();
                await interaction.editReply(`🃏 **BLACKJACK**\n\nTomas carta...\nTu mano: **${pTotal}**\nDealer: **?**`);
                await sleep(600);
            }

            await interaction.editReply(`🃏 **BLACKJACK**\n\nTu mano: **${pTotal}**\nDealer revela: **${dTotal}**`);
            await sleep(800);

            while (dTotal < 17) {
                dTotal += card();
                await interaction.editReply(`🃏 **BLACKJACK**\n\nTu mano: **${pTotal}**\nDealer toma: **${dTotal}**`);
                await sleep(600);
            }

            let result = '', payout = 0;
            if (pTotal > 21) result = '❌ Te pasaste!';
            else if (dTotal > 21) { result = '✅ Dealer se pasó - GANAS'; payout = bet * 2; }
            else if (pTotal > dTotal) { result = '✅ GANAS'; payout = bet * 2; }
            else if (pTotal === dTotal) { result = '🟡 EMPATE'; payout = bet; }
            else result = '❌ Dealer gana';

            if (payout > 0) {
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + payout, total_won: (userChips.total_won || 0) + (payout - bet), games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            }

            return interaction.editReply(`🃏 **BLACKJACK**\n\nTu mano: **${pTotal}**\nDealer: **${dTotal}**\n\n${result}\n💼 ${(userChips.chips - bet + payout).toLocaleString()} fichas`);
        }

        else if (game === 'ruleta') {
            const betType = interaction.options.getString('tipo');
            const bet = interaction.options.getInteger('apuesta');
            const numero = interaction.options.getInteger('numero');

            if (userChips.chips < bet) return interaction.editReply(`❌ Insufficient chips`);

            // Check if there's an active session
            if (casinoSessions.roulette.active) {
                // Join existing session
                const timeLeft = Math.ceil((casinoSessions.roulette.closeTime - Date.now()) / 1000);
                if (timeLeft <= 0) return interaction.editReply('⏰ La sesión de ruleta se cerró. Espera el próximo spin.');

                await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

                casinoSessions.roulette.bets.push({
                    userId,
                    interaction,
                    betType,
                    numero,
                    amount: bet,
                    currentChips: userChips.chips,
                    totalWon: userChips.total_won || 0,
                    totalLost: userChips.total_lost || 0,
                    gamesPlayed: userChips.games_played || 0
                });

                return interaction.editReply(`🎡 **RULETA MULTIJUGADOR**\n\n👥 Te uniste a la sesión (${casinoSessions.roulette.bets.length} jugadores)\n💰 Apuesta: ${betType.toUpperCase()} - ${bet} fichas\n⏰ Spin en **${timeLeft}s**\n\n¡Suerte! 🍀`);
            } else {
                // Start new session
                const started = startRouletteSession(interaction);
                if (!started) return interaction.editReply('❌ Error iniciando sesión.');

                await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

                casinoSessions.roulette.bets.push({
                    userId,
                    interaction,
                    betType,
                    numero,
                    amount: bet,
                    currentChips: userChips.chips,
                    totalWon: userChips.total_won || 0,
                    totalLost: userChips.total_lost || 0,
                    gamesPlayed: userChips.games_played || 0
                });

                return interaction.editReply(`🎡 **RULETA MULTIJUGADOR INICIADA**\n\n🎰 Sesión abierta\n👤 Tú: ${betType.toUpperCase()} - ${bet} fichas\n⏰ Otros jugadores tienen **30 segundos** para unirse\n\n¡Esperando más apuestas! 🎲`);
            }
        }

        else if (game === 'crash') {
            const bet = interaction.options.getInteger('apuesta');
            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            const crashPoint = Math.random() < 0.03 ? 1.00 : (0.99 / (1 - Math.random()));
            const capped = Math.min(crashPoint, 50);
            const cashout = 1.5 + Math.random() * 2;

            // ANIMATE!
            await animateCrash(interaction, capped, cashout);

            let payout = 0;
            if (cashout < capped) {
                payout = Math.floor(bet * cashout);
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + payout, total_won: (userChips.total_won || 0) + (payout - bet), games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            }

            const resultText = payout > 0 ? `✅ **¡GANAS!** +${payout} fichas` : `💥 **CRASH!** Perdiste -${bet}`;
            return interaction.editReply(`🚀 **CRASH**\n\n💥 Crashed en: **${capped.toFixed(2)}x**\nTu cashout: **${cashout.toFixed(2)}x**\n\n${resultText}\n💼 ${(userChips.chips - bet + payout).toLocaleString()} fichas`);
        }

        else if (game === 'race') {
            const bet = interaction.options.getInteger('apuesta');
            const horse = interaction.options.getInteger('caballo');

            if (userChips.chips < bet) return interaction.editReply(`❌ Insufficient chips`);

            // Check if there's an active session
            if (casinoSessions.race.active) {
                // Join existing session
                const timeLeft = Math.ceil((casinoSessions.race.closeTime - Date.now()) / 1000);
                if (timeLeft <= 0) return interaction.editReply('⏰ La carrera se cerró. Espera la próxima.');

                await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

                const selectedHorse = casinoSessions.race.horses.find(h => h.id === horse);

                casinoSessions.race.bets.push({
                    userId,
                    interaction,
                    horseId: horse,
                    amount: bet,
                    currentChips: userChips.chips,
                    totalWon: userChips.total_won || 0,
                    totalLost: userChips.total_lost || 0,
                    gamesPlayed: userChips.games_played || 0
                });

                return interaction.editReply(`🏇 **CARRERAS MULTIJUGADOR**\n\n👥 Te uniste a la carrera (${casinoSessions.race.bets.length} jugadores)\n${selectedHorse.emoji} **${selectedHorse.name}** - ${bet} fichas\n⏰ Carrera en **${timeLeft}s**\n\n¡Que corra tu caballo! 🐎`);
            } else {
                // Start new session
                const started = startRaceSession(interaction);
                if (!started) return interaction.editReply('❌ Error iniciando sesión.');

                await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

                const selectedHorse = casinoSessions.race.horses.find(h => h.id === horse);

                casinoSessions.race.bets.push({
                    userId,
                    interaction,
                    horseId: horse,
                    amount: bet,
                    currentChips: userChips.chips,
                    totalWon: userChips.total_won || 0,
                    totalLost: userChips.total_lost || 0,
                    gamesPlayed: userChips.games_played || 0
                });

                return interaction.editReply(`🏇 **CARRERAS MULTIJUGADOR INICIADAS**\n\n🏁 Carrera abierta\n👤 Tú: ${selectedHorse.emoji} **${selectedHorse.name}** - ${bet} fichas\n⏰ Otros jugadores tienen **45 segundos** para unirse\n\n¡A las apuestas! 🎰`);
            }
        }

        else if (game === 'caballos') {
            const bet = interaction.options.getInteger('apuesta');
            const caballo = interaction.options.getInteger('caballo');

            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            await interaction.editReply('🏇 Preparando carrera...');
            await sleep(800);
            await interaction.editReply('🏁 `1  2  3  4`\n🏇🏇🏇🏇');
            await sleep(600);

            const winner = Math.floor(Math.random() * 4) + 1;

            await interaction.editReply(`🏁 **CARRERA!**\n\n${winner === 1 ? '🏆' : '🏇'} ${winner === 2 ? '🏆' : '🏇'} ${winner === 3 ? '🏆' : '🏇'} ${winner === 4 ? '🏆' : '🏇'}\n\nGanador: Caballo ${winner}`);

            if (winner === caballo) {
                const winAmount = bet * 3;
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
                return interaction.editReply(`🏇 **Caballo ${winner} GANÓ!**\n\n✅ ¡Acertaste! +${winAmount} fichas\n💼 ${(userChips.chips - bet + winAmount).toLocaleString()} fichas`);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
                return interaction.editReply(`🏇 **Caballo ${winner} ganó**\n\n❌ Perdiste ${bet} fichas\n💼 ${(userChips.chips - bet).toLocaleString()} fichas`);
            }
        }

        else if (game === 'gallos') {
            const bet = interaction.options.getInteger('apuesta');
            const gallo = interaction.options.getString('gallo');

            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            await interaction.editReply('🐓 Preparando pelea...');
            await sleep(1000);
            await interaction.editReply('🐓⚔️🐓 Gallo Rojo vs Gallo Azul');
            await sleep(800);
            await interaction.editReply('🐓💥🐓 ¡PELEA!');
            await sleep(1200);

            const winner = Math.random() > 0.5 ? 'rojo' : 'azul';
            const winnerEmoji = winner === 'rojo' ? '🔴' : '🔵';

            if (winner === gallo) {
                const winAmount = bet * 2;
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + winAmount, total_won: (userChips.total_won || 0) + winAmount, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
                return interaction.editReply(`🐓 **Gallo ${winner.toUpperCase()} ganó!** ${winnerEmoji}\n\n✅ +${winAmount} fichas\n💼 ${(userChips.chips - bet + winAmount).toLocaleString()} fichas`);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
                return interaction.editReply(`🐓 **Gallo ${winner.toUpperCase()} ganó** ${winnerEmoji}\n\n❌ -${bet} fichas\n💼 ${(userChips.chips - bet).toLocaleString()} fichas`);
            }
        }

        else if (game === 'rusa') {
            const bet = interaction.options.getInteger('apuesta');
            if (userChips.chips < bet) return interaction.editReply(`❌ Fichas insuficientes`);

            await supabase.from('casino_chips').update({ chips: userChips.chips - bet }).eq('user_id', userId);

            // MAXIMUM TENSION!
            await interaction.editReply(`🔫 **RULETA RUSA**\n\nCargando revólver...\n⚫⚫⚫⚫⚫🔴`);
            await sleep(1200);

            await interaction.editReply(`🔫 **RULETA RUSA**\n\nGirando tambor...\n🔄🔄🔄`);
            await sleep(1200);

            await interaction.editReply(`🔫 **RULETA RUSA**\n\nApuntando...\n😰😰😰`);
            await sleep(1500);

            const chamber = Math.floor(Math.random() * 6) + 1;
            const survived = chamber !== 1; // 1 bullet in chamber 1

            if (survived) {
                await interaction.editReply(`🔫 **RULETA RUSA**\n\n***CLICK***\n💥 Cámara vacía!`);
                await sleep(800);
            } else {
                await interaction.editReply(`🔫 **RULETA RUSA**\n\n***BANG!***\n💀💀💀`);
                await sleep(800);
            }

            const payout = survived ? bet * 5 : 0;

            if (survived) {
                await supabase.from('casino_chips').update({ chips: userChips.chips - bet + payout, total_won: (userChips.total_won || 0) + payout, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            } else {
                await supabase.from('casino_chips').update({ total_lost: (userChips.total_lost || 0) + bet, games_played: (userChips.games_played || 0) + 1 }).eq('user_id', userId);
            }

            const resultText = survived ? `✅ **¡SOBREVIVISTE!**\n💰 +${payout} fichas (5x)` : `☠️ **ELIMINADO**\n💸 Perdiste ${bet} fichas`;
            return interaction.editReply(`🔫 **RULETA RUSA**\n\nCámara: **${chamber}/6**\n${survived ? '💥 *Click*' : '💀 **BANG!**'}\n\n${resultText}\n💼 ${(userChips.chips - bet + payout).toLocaleString()} fichas`);
        }
    }


    else if (commandName === 'dar-robo') {
        await interaction.deferReply();

        // Role Check: Junta Directiva or Admin
        const member = interaction.member;
        const isJuntaDirectiva = member.roles.cache.some(role =>
            role.name.toLowerCase().includes('junta') ||
            role.name.toLowerCase().includes('directiva') ||
            role.name.toLowerCase().includes('admin') ||
            role.permissions.has('Administrator')
        );

        if (!isJuntaDirectiva) {
            return interaction.editReply('⛔ Este comando es solo para Junta Directiva.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const montoTotal = interaction.options.getInteger('monto');
        const montoCash = Math.floor(montoTotal * 0.25); // 25% of robbery amount

        try {
            // Add cash to target user
            await billingService.ubService.addMoney(
                interaction.guildId,
                targetUser.id,
                montoCash,
                `💰 Robo distribuido por ${interaction.user.tag}`,
                'cash'
            );

            const embed = new EmbedBuilder()
                .setTitle('💰 Dinero de Robo Distribuido')
                .setColor(0x00FF00)
                .setDescription(`Se ha distribuido el 25% del robo en efectivo.`)
                .addFields(
                    { name: '👤 Receptor', value: `<@${targetUser.id}>`, inline: true },
                    { name: '💵 Monto Total del Robo', value: `$${montoTotal.toLocaleString()}`, inline: true },
                    { name: '💰 Efectivo Entregado (25%)', value: `$${montoCash.toLocaleString()}`, inline: true },
                    { name: '👮 Autorizado por', value: interaction.user.tag, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Notify the recipient
            try {
                await targetUser.send({
                    content: `💰 **Has recibido dinero de un robo**`,
                    embeds: [embed]
                });
            } catch (dmError) {
                console.log('Could not DM user:', dmError.message);
            }

        } catch (error) {
            console.error('Error distribuyendo robo:', error);
            await interaction.editReply('❌ Error al distribuir el dinero. Verifica que el usuario exista.');
        }
    }


    else if (commandName === 'business') {
        await interaction.deferReply({ flags: 64 });
        const subcommand = interaction.options.getSubcommand();

        // Staff-only check
        const STAFF_ROLE_ID = '1450688555503587459'; // Same as empresa crear
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ Solo el staff puede gestionar tarjetas business.', flags: 64 });
        }

        if (subcommand === 'vincular') {

            const ownerUser = interaction.options.getUser('dueño');
            const cardType = interaction.options.getString('tipo');

            try {
                // 1. Check if owner has companies
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [ownerUser.id])
                    .eq('status', 'active');

                if (!companies || companies.length === 0) {
                    return interaction.editReply(`❌ <@${ownerUser.id}> no tiene empresas registradas.`);
                }

                // 2. If has multiple companies, ask which one
                if (companies.length > 1) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`business_select_${ownerUser.id}_${cardType}`)
                        .setPlaceholder('Selecciona la empresa')
                        .addOptions(
                            companies.map(c => ({
                                label: c.name,
                                description: `${c.industry_type} • ${c.is_private ? 'Privada' : 'Pública'}`,
                                value: c.id
                            }))
                        );

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    return interaction.editReply({
                        content: `📋 <@${ownerUser.id}> tiene **${companies.length} empresas**. Selecciona a cuál vincular la tarjeta:`,
                        components: [row]
                    });
                }

                // 3. Only one company, proceed directly
                const company = companies[0];

                // Card data map
                const cardData = {
                    'business_start': { name: 'Business Start', limit: 50000, interest: 0.02, cost: 8000 },
                    'business_gold': { name: 'Business Gold', limit: 100000, interest: 0.015, cost: 15000 },
                    'business_platinum': { name: 'Business Platinum', limit: 200000, interest: 0.012, cost: 20000 },
                    'business_elite': { name: 'Business Elite', limit: 500000, interest: 0.01, cost: 35000 },
                    'nmx_corporate': { name: 'NMX Corporate', limit: 1000000, interest: 0.007, cost: 50000 }
                };

                const card = cardData[cardType];

                // 4. Create business credit card
                const { error } = await supabase
                    .from('credit_cards')
                    .insert({
                        discord_id: ownerUser.id,
                        card_type: cardType,
                        card_name: card.name,
                        card_limit: card.limit,
                        current_balance: 0,
                        interest_rate: card.interest,
                        card_cost: card.cost,
                        status: 'active',
                        company_id: company.id,
                        approved_by: interaction.user.id
                    });

                if (error) throw error;

                const embed = new EmbedBuilder()
                    .setTitle('✅ Tarjeta Business Vinculada')
                    .setColor(0x00FF00)
                    .setDescription(`Tarjeta **${card.name}** vinculada exitosamente.`)
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '👤 Dueño', value: `<@${ownerUser.id}>`, inline: true },
                        { name: '💳 Tarjeta', value: card.name, inline: true },
                        { name: '💰 Límite', value: `$${card.limit.toLocaleString()}`, inline: true },
                        { name: '📊 Interés', value: `${(card.interest * 100).toFixed(2)}%`, inline: true },
                        { name: '💵 Costo', value: `$${card.cost.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Aprobado por ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send DM to owner
                try {
                    await ownerUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🎉 Tarjeta Business Aprobada')
                            .setColor(0x5865F2)
                            .setDescription(`Tu solicitud de **${card.name}** ha sido aprobada y vinculada a **${company.name}**.`)
                            .addFields(
                                { name: '💰 Límite de Crédito', value: `$${card.limit.toLocaleString()}`, inline: true },
                                { name: '📊 Tasa de Interés', value: `${(card.interest * 100).toFixed(2)}%`, inline: true },
                                { name: '💼 Uso', value: 'Usa \`/empresa credito\` para solicitar fondos.', inline: false }
                            )
                            .setFooter({ text: 'Sistema Financiero Nación MX' })
                        ]
                    });
                } catch (dmError) {
                    console.log('Could not DM owner:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error vinculando tarjeta business.');
            }
        }

        else if (subcommand === 'listar') {
            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('usuario');

            try {
                const { data: cards } = await supabase
                    .from('credit_cards')
                    .select('*, companies(name)')
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                if (!cards || cards.length === 0) {
                    return interaction.editReply(`📋 <@${targetUser.id}> no tiene tarjetas business activas.`);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`💼 Tarjetas Business de ${targetUser.tag}`)
                    .setColor(0x5865F2)
                    .setDescription(`Total: **${cards.length}** tarjeta(s) activa(s)`)
                    .setThumbnail(targetUser.displayAvatarURL());

                cards.forEach(card => {
                    const companyName = card.companies ? card.companies.name : 'Sin empresa';
                    embed.addFields({
                        name: `💳 ${card.card_name}`,
                        value: `🏢 Empresa: ${companyName}\n💰 Límite: $${card.card_limit.toLocaleString()}\n📊 Deuda: $${(card.current_balance || 0).toLocaleString()}\n📈 Disponible: $${(card.card_limit - (card.current_balance || 0)).toLocaleString()}`,
                        inline: false
                    });
                });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando tarjetas.');
            }
        }

        else if (subcommand === 'cancelar') {
            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('usuario');
            const razon = interaction.options.getString('razon');

            try {
                // Get all active business cards
                const { data: cards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                if (!cards || cards.length === 0) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no tiene tarjetas business activas.`);
                }

                // Cancel all
                await supabase
                    .from('credit_cards')
                    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: interaction.user.id, cancel_reason: razon })
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                await interaction.editReply(`✅ Se cancelaron **${cards.length}** tarjeta(s) business de <@${targetUser.id}>.\n**Razón:** ${razon}`);

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error cancelando tarjetas.');
            }
        }
    }


    if (commandName === 'balanza') {
        await interaction.deferReply();
        // Defer with error handling to prevent "Unknown interaction"
        try {
        } catch (err) {
            console.error('[ERROR] Failed to defer balanza:', err);
            return; // Exit early if defer fails
        }

        try {
            const cashBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            console.log(`[DEBUG] /balanza User: ${interaction.user.id} Balance Raw:`, cashBalance); // DEBUG LOG

            // Resolve Citizen ID for robust lookup
            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', interaction.user.id).maybeSingle();

            const { data: debitCard } = await supabase.from('debit_cards').select('balance').eq('discord_user_id', interaction.user.id).eq('status', 'active').maybeSingle();

            // Fetch Credit Cards via Citizen ID if available, else Discord ID
            let creditQuery = supabase.from('credit_cards').select('*').eq('status', 'active');
            if (citizen) {
                creditQuery = creditQuery.eq('citizen_id', citizen.id);
            } else {
                creditQuery = creditQuery.eq('discord_user_id', interaction.user.id);
            }
            const { data: creditCards } = await creditQuery;

            const cash = cashBalance.cash || 0;
            const bank = cashBalance.bank || 0;
            // Debit Card just checks if exists, balance comes from Bank
            const hasDebit = debitCard ? true : false;

            let creditAvailable = 0;
            let creditDebt = 0;
            if (creditCards) {
                creditCards.forEach(c => {
                    let limit = c.card_limit || c.credit_limit || 0;
                    if (limit === 0 && c.card_type && CARD_TIERS && CARD_TIERS[c.card_type]) {
                        limit = CARD_TIERS[c.card_type].limit || 0;
                    }
                    const debt = c.current_balance || 0;
                    creditAvailable += (limit - debt);
                    creditDebt += debt;
                });
            }

            // Total Liquid is Cash + Bank (Debit is same as Bank) + Avail Credit
            const totalLiquid = cash + bank + creditAvailable;

            const embed = new EmbedBuilder()
                .setTitle('💰 TU BALANZA FINANCIERA')
                .setColor(0x00D26A)
                .addFields(
                    { name: '💵 EFECTIVO', value: `\`\`\`$${cash.toLocaleString()}\`\`\``, inline: true },
                    { name: '🏦 BANCO / DÉBITO', value: `\`\`\`$${bank.toLocaleString()}\`\`\`\n${hasDebit ? '✅ Tarjeta Débito' : '📋 Cuenta Bancaria'}`, inline: true },
                    { name: '💳 CRÉDITO', value: `\`\`\`Disponible: $${creditAvailable.toLocaleString()}\nDeuda: $${creditDebt.toLocaleString()}\`\`\``, inline: false },
                    { name: '📊 PATRIMONIO TOTAL', value: `\`\`\`diff\n+ $${totalLiquid.toLocaleString()}\n\`\`\``, inline: false }
                )
                .setFooter({ text: 'Banco Nacional' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo tu balanza.');
        }
    }


    else if (commandName === 'top-ricos') {
        await interaction.deferReply();

        try {
            // Get all citizens with discord IDs
            const { data: citizens } = await supabase
                .from('citizens')
                .select('full_name, discord_id')
                .not('discord_id', 'is', null);

            if (!citizens || citizens.length === 0) {
                return interaction.editReply('❌ No hay datos disponibles.');
            }

            // Calculate total wealth for each citizen
            const wealthData = [];

            for (const citizen of citizens) {
                try {
                    // Get cash and bank balance from UnbelievaBoat
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, citizen.discord_id);
                    const cash = balance.cash || 0;
                    const bank = balance.bank || 0;

                    // Get debit card balance
                    const { data: debitCard } = await supabase
                        .from('debit_cards')
                        .select('balance')
                        .eq('discord_user_id', citizen.discord_id)
                        .eq('status', 'active')
                        .maybeSingle();
                    const debitBalance = debitCard?.balance || 0;

                    // Get investment portfolio value
                    const { data: investments } = await supabase
                        .from('investments')
                        .select('quantity, ticker')
                        .eq('discord_id', citizen.discord_id);

                    let investmentsValue = 0;
                    if (investments && investments.length > 0) {
                        const { data: prices } = await supabase
                            .from('market_prices')
                            .select('ticker, current_price');

                        const priceMap = {};
                        prices?.forEach(p => priceMap[p.ticker] = p.current_price);

                        investments.forEach(inv => {
                            const price = priceMap[inv.ticker] || 0;
                            investmentsValue += inv.quantity * price;
                        });
                    }

                    const totalWealth = cash + bank + debitBalance + investmentsValue;

                    wealthData.push({
                        name: citizen.full_name,
                        discord_id: citizen.discord_id,
                        total: totalWealth,
                        cash,
                        bank,
                        debit: debitBalance,
                        investments: investmentsValue
                    });
                } catch (error) {
                    console.error(`Error calculating wealth for ${citizen.full_name}:`, error);
                }
            }

            // Sort by total wealth descending
            wealthData.sort((a, b) => b.total - a.total);

            // GHOST MODE: Filter out Elite users with active privacy
            const { data: eliteUsers } = await supabase
                .from('privacy_accounts')
                .select('user_id')
                .eq('level', 'elite')
                .gt('expires_at', new Date().toISOString());

            const ghostIds = new Set(eliteUsers?.map(u => u.user_id) || []);
            const visibleWealth = wealthData.filter(w => !ghostIds.has(w.discord_id));

            // Take top 10 (excluding ghosts)
            const top10 = visibleWealth.slice(0, 10);

            if (top10.length === 0) {
                return interaction.editReply('❌ No se pudieron calcular las fortunas.');
            }

            const embed = new EmbedBuilder()
                .setTitle('💰 Top 10 - Ciudadanos Más Ricos')
                .setColor(0xFFD700)
                .setDescription('Ranking por patrimonio total (Efectivo + Banco + Débito + Inversiones)')
                .setTimestamp();

            let description = '';
            top10.forEach((person, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

                description += `${medal} **${person.name}** - $${person.total.toLocaleString()}\n`;
                description += `   💵 Efectivo: $${person.cash.toLocaleString()} | 🏦 Banco: $${person.bank.toLocaleString()}\n`;
                if (person.debit > 0 || person.investments > 0) {
                    description += `   💳 Débito: $${person.debit.toLocaleString()} | 📈 Inversiones: $${person.investments.toLocaleString()}\n`;
                }
                description += '\n';
            });

            embed.setDescription(description);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error calculando el ranking de riqueza.');
        }
    }

    // LICENCIA COMMAND
    else if (commandName === 'licencia') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'otorgar') {
            const targetUser = interaction.options.getUser('ciudadano');
            const tipo = interaction.options.getString('tipo');

            // License configurations
            const licenses = {
                'conducir': {
                    name: '🚗 Licencia de Conducir',
                    price: 1200,
                    roleId: '1413543909761614005',
                    requiresPolice: false
                },
                'arma_corta': {
                    name: '🔫 Licencia de Armas Cortas',
                    price: 1200,
                    roleId: '1413543907110682784',
                    requiresPolice: false
                },
                'arma_larga': {
                    name: '🎯 Licencia de Armas Largas',
                    price: 1500,
                    roleId: '1413541379803578431',
                    requiresPolice: true,
                    policeRoleId: '1450312637727375502'
                }
            };

            const license = licenses[tipo];
            if (!license) {
                return interaction.editReply('❌ Tipo de licencia inválido.');
            }

            // Check if issuer has police role for arma_larga
            if (license.requiresPolice) {
                const issuerMember = await interaction.guild.members.fetch(interaction.user.id);
                const hasPoliceRole = issuerMember.roles.cache.has(license.policeRoleId);
                const isAdmin = issuerMember.permissions.has('Administrator');

                if (!hasPoliceRole && !isAdmin) {
                    return interaction.editReply('⛔ Solo la Policía puede otorgar Licencias de Armas Largas.');
                }
            }

            try {
                // Check if user already has the license (role)
                const member = await interaction.guild.members.fetch(targetUser.id);
                if (member.roles.cache.has(license.roleId)) {
                    return interaction.editReply(`⚠️ ${targetUser.tag} ya tiene esta licencia.`);
                }

                // Show payment selector
                const pmLicense = await getAvailablePaymentMethods(targetUser.id, interaction.guildId);
                const pbLicense = createPaymentButtons(pmLicense, 'license_pay');
                const licenseEmbed = createPaymentEmbed(license.name, license.price, pmLicense);

                await interaction.editReply({
                    content: `📋 **Emitiendo licencia para** ${targetUser.tag}`,
                    embeds: [licenseEmbed],
                    components: [pbLicense]
                });

                // Wait for payment
                const filter = i => i.user.id === targetUser.id && i.customId.startsWith('license_pay_');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

                collector.on('collect', async i => {
                    try {
                        await i.deferUpdate();
                        const method = i.customId.replace('license_pay_', '');

                        // Process payment
                        const paymentResult = await processPayment(
                            method,
                            targetUser.id,
                            interaction.guildId,
                            license.price,
                            `[Licencia] ${license.name}`,
                            pmLicense
                        );

                        if (!paymentResult.success) {
                            return i.editReply({ content: paymentResult.error, embeds: [], components: [] });
                        }

                        // Assign role
                        await member.roles.add(license.roleId);

                        // Success message
                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Licencia Otorgada')
                            .setDescription(`${license.name}`)
                            .addFields(
                                { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                                { name: '💰 Costo', value: `$${license.price.toLocaleString()}`, inline: true },
                                { name: '💳 Método', value: paymentResult.method, inline: true },
                                { name: '👮 Emitida por', value: interaction.user.tag, inline: true }
                            )
                            .setFooter({ text: 'Licencia Oficial Nación MX' })
                            .setTimestamp();

                        await i.editReply({ content: '', embeds: [successEmbed], components: [] });

                        // LOGGING: License
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🪪 Nueva Licencia Otorgada')
                            .setColor('#00AAC0')
                            .addFields(
                                { name: 'Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                                { name: 'Licencia', value: licenseName, inline: true },
                                { name: 'Costo', value: `$${cost.toLocaleString()}`, inline: true },
                                { name: 'Autorizado por', value: `<@${interaction.user.id}>`, inline: false }
                            )
                            .setTimestamp();
                        logToChannel(interaction.guild, LOG_LICENCIAS, logEmbed);

                        // Try to DM citizen
                        try {
                            await targetUser.send({
                                content: `🪪 **Nueva Licencia Registrada**`,
                                embeds: [successEmbed]
                            });
                        } catch (dmError) {
                            console.log('Could not DM citizen:', dmError.message);
                        }

                    } catch (error) {
                        console.error('[licencia otorgar] Error:', error);
                        await i.editReply({ content: '❌ Error emitiendo licencia.', embeds: [], components: [] });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ content: '⏰ Tiempo agotado para el pago.', embeds: [], components: [] });
                    }
                });

            } catch (error) {
                console.error('[licencia] Error:', error);
                await interaction.editReply('❌ Error procesando licencia.');
            }
        }
    }

    // TIENDA COMMAND  
    else if (commandName === 'tienda') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ver') {
            await interaction.deferReply();

            try {
                const { data: items, error } = await supabase
                    .from('store_items')
                    .select('*')
                    .eq('active', true)
                    .order('display_order', { ascending: true });

                if (error) throw error;

                if (!items || items.length === 0) {
                    return interaction.editReply('🛒 La tienda está vacía por el momento.');
                }

                const itemsPerPage = 3;
                const pages = [];

                for (let i = 0; i < items.length; i += itemsPerPage) {
                    const pageItems = items.slice(i, i + itemsPerPage);
                    const embed = new EmbedBuilder()
                        .setTitle('🛒 Tienda Premium Nación MX')
                        .setColor('#FFD700')
                        .setDescription('💰 **Beneficios exclusivos para mejorar tu experiencia**\n\nUsa `/tienda comprar` para adquirir un item.')
                        .setFooter({ text: `Página ${Math.floor(i / itemsPerPage) + 1}/${Math.ceil(items.length / itemsPerPage)}` });

                    for (const item of pageItems) {
                        const benefits = item.benefits ? item.benefits.join('\n• ') : 'Sin descripción';
                        const duration = item.duration_days
                            ? `⏰ ${item.duration_days} días`
                            : item.duration_hours
                                ? `⏰ ${item.duration_hours} hora(s)`
                                : '♾️ Permanente';

                        const extraInfo = item.max_uses ? `\n🎫 Usos: ${item.max_uses}` : '';
                        const ticket = item.requires_ticket ? '\n📩 Requiere ticket para activación' : '';

                        embed.addFields({
                            name: `${item.icon_emoji} ${item.name} - $${item.price.toLocaleString()}`,
                            value: `${item.description}\n\n**Beneficios:**\n• ${benefits}\n${duration}${extraInfo}${ticket}`,
                            inline: false
                        });
                    }

                    pages.push(embed);
                }

                if (pages.length === 1) {
                    return interaction.editReply({ embeds: [pages[0]] });
                }

                let currentPage = 0;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('tienda_prev').setLabel('◀️ Anterior').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('tienda_next').setLabel('Siguiente ▶️').setStyle(ButtonStyle.Secondary)
                );

                await interaction.editReply({ embeds: [pages[0]], components: [row] });

                const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('tienda_');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 120000 });

                collector.on('collect', async i => {
                    if (i.customId === 'tienda_next') {
                        currentPage = (currentPage + 1) % pages.length;
                    } else if (i.customId === 'tienda_prev') {
                        currentPage = (currentPage - 1 + pages.length) % pages.length;
                    }
                    await i.update({ embeds: [pages[currentPage]] });
                });

                collector.on('end', () => {
                    interaction.editReply({ components: [] }).catch(() => { });
                });

            } catch (error) {
                console.error('[tienda ver] Error:', error);
                await interaction.editReply('❌ Error cargando la tienda.');
            }
        }

        else if (subcommand === 'comprar') {
            await interaction.deferReply();
            const itemKey = interaction.options.getString('item');
            const userId = interaction.user.id;

            try {
                const { data: item, error: itemError } = await supabase
                    .from('store_items')
                    .select('*')
                    .eq('item_key', itemKey)
                    .eq('active', true)
                    .single();

                if (itemError || !item) {
                    return interaction.editReply('❌ Item no encontrado o no disponible.');
                }

                const { data: existing } = await supabase
                    .from('user_purchases')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('item_key', itemKey)
                    .eq('status', 'active')
                    .maybeSingle();

                if (existing) {
                    const expiryDate = existing.expiration_date ? `\nExpira: <t:${Math.floor(new Date(existing.expiration_date).getTime() / 1000)}:R>` : '';
                    return interaction.editReply(`⚠️ Ya tienes este item activo.${expiryDate}`);
                }

                const pmStore = await getAvailablePaymentMethods(userId, interaction.guildId);
                const pbStore = createPaymentButtons(pmStore, 'store_pay');
                const storeEmbed = createPaymentEmbed(`${item.icon_emoji} ${item.name}`, item.price, pmStore);

                await interaction.editReply({ embeds: [storeEmbed], components: [pbStore] });

                const filter = i => i.user.id === userId && i.customId.startsWith('store_pay_');
                const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

                collector.on('collect', async i => {
                    try {
                        await i.deferUpdate();
                        const method = i.customId.replace('store_pay_', '');

                        const paymentResult = await processPayment(method, userId, interaction.guildId, item.price, `[Tienda] ${item.name}`, pmStore);

                        if (!paymentResult.success) {
                            return i.editReply({ content: paymentResult.error, embeds: [], components: [] });
                        }

                        let expirationDate = null;
                        if (item.duration_days) {
                            expirationDate = new Date();
                            expirationDate.setDate(expirationDate.getDate() + item.duration_days);
                        } else if (item.duration_hours) {
                            expirationDate = new Date();
                            expirationDate.setHours(expirationDate.getHours() + item.duration_hours);
                        }

                        const { data: purchase, error: purchaseError } = await supabase
                            .from('user_purchases')
                            .insert({
                                user_id: userId,
                                item_key: itemKey,
                                expiration_date: expirationDate ? expirationDate.toISOString() : null,
                                status: 'active',
                                uses_remaining: item.max_uses || null
                            })
                            .select()
                            .single();

                        if (purchaseError) throw purchaseError;

                        await supabase.from('purchase_transactions').insert({
                            user_id: userId,
                            item_key: itemKey,
                            amount_paid: item.price,
                            payment_method: method,
                            purchase_id: purchase.id,
                            transaction_type: 'purchase'
                        });

                        if (item.role_id) {
                            try {
                                const member = await interaction.guild.members.fetch(userId);
                                await member.roles.add(item.role_id);
                            } catch (roleError) {
                                console.error('[tienda] Role assignment error:', roleError);
                            }
                        }

                        const duration = item.duration_days
                            ? `\n⏰ Válido por **${item.duration_days} días**`
                            : item.duration_hours
                                ? `\n⏰ Válido por **${item.duration_hours} hora(s)**`
                                : '\n♾️ **Permanente**';

                        const ticketMsg = item.requires_ticket ? `\n\n📩 **Abre un ticket** en <#${item.ticket_channel_id}> para activar tu beneficio.` : '';

                        const successEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('✅ Compra Exitosa')
                            .setDescription(`${item.icon_emoji} **${item.name}**\n\n💰 Pagado: $${item.price.toLocaleString()}\n💳 Método: ${paymentResult.method}${duration}${ticketMsg}`)
                            .setFooter({ text: 'Gracias por tu compra!' })
                            .setTimestamp();

                        // LOGGING: Store
                        const logEmbed = new EmbedBuilder()
                            .setTitle('🛒 Nueva Compra en Tienda')
                            .setColor('#AA00FF')
                            .addFields(
                                { name: 'Cliente', value: `<@${userId}>`, inline: true },
                                { name: 'Item', value: item.name, inline: true },
                                { name: 'Precio', value: `$${item.price.toLocaleString()}`, inline: true },
                                { name: 'Método', value: paymentResult.method, inline: true }
                            )
                            .setTimestamp();
                        logToChannel(interaction.guild, LOG_TIENDA, logEmbed);

                        await i.editReply({ embeds: [successEmbed], components: [] });

                    } catch (error) {
                        console.error('[tienda comprar] Error:', error);
                        await i.editReply({ content: '❌ Error procesando la compra.', embeds: [], components: [] });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ content: '⏰ Tiempo agotado.', embeds: [], components: [] });
                    }
                });

            } catch (error) {
                console.error('[tienda comprar] Error:', error);
                await interaction.editReply('❌ Error procesando la compra.');
            }
        }
    }

    // ===================================================================
    // GAMIFICATION: CRIME & JOBS
    // ===================================================================

    else if (commandName === 'robar') {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('usuario');

        if (targetUser.id === interaction.user.id) return interaction.editReply('❌ No te puedes robar a ti mismo.');
        if (targetUser.bot) return interaction.editReply('❌ No puedes robar a un bot.');

        // Anti-Theft Protection Role Check
        const ANTI_THEFT_ROLE_ID = '1449947645383675939';
        if (interaction.member.roles.cache.has(ANTI_THEFT_ROLE_ID)) {
            return interaction.editReply('🛡️ **Protección Anti-Robo Activa**\nTienes un sistema de seguridad que te impide robar a otros usuarios.');
        }

        // Cooldown Check (2 Hours)
        const COOLDOWN_TIME = 2 * 60 * 60 * 1000;
        const cooldownKey = `rob_${interaction.user.id}`;
        const lastRob = casinoSessions[cooldownKey] || 0; // Reusing casinoSessions as simple cache or could use new Map

        // Note: Ideally use a dedicated Map for cooldowns, but for now using a global object or Map is fine. 
        // Let's assume we use a new Map for clarity or just add it to top level variable if needed.
        // Using `lastRob` from a Map. Let's create a global map in the file scope if not exists.

        if (Date.now() - lastRob < COOLDOWN_TIME) {
            const remaining = Math.ceil((COOLDOWN_TIME - (Date.now() - lastRob)) / 60000);
            return interaction.editReply(`⏳ **Cooldown Activo**\nDebes esperar **${remaining} minutos** para volver a robar.`);
        }

        try {
            // Get Victim Balance
            const victimBal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const victimCash = victimBal.cash || 0;

            if (victimCash < 500) {
                return interaction.editReply(`❌ ${targetUser.username} es demasiado pobre (Menos de $500 en efectivo).`);
            }

            // RNG Logic
            const chance = Math.random();
            const isSuccess = chance < 0.40; // 40% Success

            if (isSuccess) {
                // Success: Steal 5-15%
                const percent = (Math.random() * 0.10) + 0.05;
                const stealAmount = Math.floor(victimCash * percent);

                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stealAmount, `Robado por ${interaction.user.tag}`, 'cash');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, stealAmount, `Robo a ${targetUser.tag}`, 'cash');

                // Set Cooldown
                casinoSessions[cooldownKey] = Date.now();

                const embed = new EmbedBuilder()
                    .setTitle('🔫 ¡Robo Exitoso!')
                    .setColor('#00FF00')
                    .setDescription(`Le has robado **$${stealAmount.toLocaleString()}** a <@${targetUser.id}>.\n¡Corre antes de que llegue la policía!`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else {
                // Fail: Fine goes to victim as compensation
                const FINE_AMOUNT = 2000;
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, FINE_AMOUNT, 'Multa por intento de robo', 'cash');
                await billingService.ubService.addMoney(interaction.guildId, targetUser.id, FINE_AMOUNT, `Compensación de intento de robo por ${interaction.user.tag}`, 'cash');

                // Set Cooldown
                casinoSessions[cooldownKey] = Date.now();

                const embed = new EmbedBuilder()
                    .setTitle('🚨 ¡Te atrapó la policía!')
                    .setColor('#FF0000')
                    .setDescription(`Fallaste en el robo y fuiste arrestado.\n**Multa:** $${FINE_AMOUNT.toLocaleString()}\n💰 La multa fue dada a <@${targetUser.id}> como compensación.`)
                    .setImage('https://media1.tenor.com/m/1k_lJcQ6q8AAAAAC/gta-busted.gif')
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Log to Police
                const logEmbed = new EmbedBuilder()
                    .setTitle('🚔 Intento de Robo Frustrado')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'Criminal', value: `<@${interaction.user.id}>`, inline: true },
                        { name: 'Víctima', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Multa', value: `$${FINE_AMOUNT}`, inline: true },
                        { name: 'Ubicación', value: `<#${interaction.channel.id}>`, inline: false }
                    )
                    .setTimestamp();
                logToChannel(interaction.guild, LOG_POLICIA, logEmbed);
            }

        } catch (error) {
            console.error('[robar] Error:', error);
            await interaction.editReply('❌ Error procesando el robo.');
        }
    }
    // ENHANCED TRABAJAR & CRIMEN HANDLERS
    // Copy this content to replace the current handlers in index.js

    else if (commandName === 'trabajar') {
        await interaction.deferReply();
        const JOB_COOLDOWN = 60 * 60 * 1000;
        const jobKey = `job_${interaction.user.id}`;
        const lastJob = casinoSessions[jobKey] || 0;

        if (Date.now() - lastJob < JOB_COOLDOWN) {
            const remaining = Math.ceil((JOB_COOLDOWN - (Date.now() - lastJob)) / 60000);
            return interaction.editReply(`⏳ **Estás cansado**\nDebes descansar **${remaining} minutos**.`);
        }

        // Enhanced job selection with visuals
        const jobs = [
            { title: '🧠 Bibliotecario', desc: 'Código: XJ-9-DELTA', type: 'memory', code: 'XJ-9-DELTA', opts: ['XJ-9-DELTA', 'XK-9-DELTA', 'XJ-8-DELTA'], pay: [2000, 3000] },
            { title: '💣 Técnico EOD', desc: 'Cable correcto: VERDE', type: 'wires', wire: 'VERDE', opts: ['🔴 ROJO', '🟢 VERDE', '🔵 AZUL'], pay: [3000, 5000] },
            { title: '🚁 Piloto Rescate', desc: 'Víctima al NORTE', type: 'nav', dir: 'NORTE', opts: ['⬆️ NORTE', '⬇️ SUR', '⬅️ OESTE'], pay: [3500, 5500] },
            { title: '⛏️ Minero', desc: 'Elige veta (suerte)', type: 'luck', opts: ['⛏️ VETA 1', '⛏️ VETA 2', '⛏️ VETA 3'], pay: [4000, 7000] },
            { title: '💻 Programador', desc: 'sudo rm -rf /virus', type: 'typing', cmd: 'sudo rm -rf /virus', pay: [5500, 8500] },
            { title: '🧮 Contador', desc: '8500 - 3200 = ?', type: 'math', ans: '5300', pay: [2500, 3500] }
        ];

        const job = jobs[Math.floor(Math.random() * jobs.length)];

        // Create richvisual embed
        const embed = new EmbedBuilder()
            .setTitle(`${job.title}`)
            .setColor(0xFFA500)
            .setDescription(`**Tarea:** ${job.desc}\n\n💰 Pago: $${job.pay[0].toLocaleString()} - $${job.pay[1].toLocaleString()}`)
            .setFooter({ text: '⏱️ Tienes 20 segundos' })
            .setTimestamp();

        // Add visual ASCII art based on type
        if (job.type === 'memory') {
            embed.addFields({ name: '📚 MEMORIZA:', value: `\`\`\`\n${job.code}\n\`\`\`` });
            await interaction.editReply({ embeds: [embed] });

            // Countdown animation
            for (let i = 3; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                embed.setFooter({ text: `⏰ Desapareciendo en ${i}...` });
                await interaction.editReply({ embeds: [embed] });
            }

            // Hide and ask
            embed.setDescription(`¿Cuál era el código?`);
            embed.spliceFields(0, 1);
            embed.setFooter({ text: '❓ Selecciona la respuesta correcta' });

            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (job.type === 'wires') {
            embed.addFields({
                name: '💣 PANEL DE CONTROL',
                value: `\`\`\`\n🔴 ROJO\n🟢 VERDE\n🔵 AZUL\n\`\`\`\n⚠️ ¡Corta el cable ${job.wire}!`
            });

            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(opt.includes('VERDE') ? ButtonStyle.Success : ButtonStyle.Danger))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (job.type === 'nav') {
            embed.addFields({
                name: '🗺️ MAPA',
                value: `\`\`\`\n     🏔️\n  ⬅️ 🚁 ➡️\n     ⬇️\n\`\`\`\n🎯 Destino: **${job.dir}**`
            });

            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (job.type === 'luck') {
            embed.addFields({
                name: '⛏️ MINA DE ORO',
                value: `\`\`\`\n[1] 💎 ?\n[2] 💎 ?\n[3] 💎 ?\n\`\`\`\n🎲 Probabilidad: 50%`
            });

            const row = new ActionRowBuilder();
            job.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`job_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Secondary))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (job.type === 'typing') {
            embed.addFields({
                name: '💻 TERMINAL',
                value: `\`\`\`bash\n$ ${job.cmd}\n> _\n\`\`\`\n⌨️ Escribe el comando exacto`
            });
            await interaction.editReply({ embeds: [embed] });

        } else if (job.type === 'math') {
            embed.addFields({
                name: '🧮 CALCULADORA',
                value: `\`\`\`\n${job.desc}\n= ???\n\`\`\`\n🔢 Escribe tu respuesta`
            });
            await interaction.editReply({ embeds: [embed] });
        }

        // Collector for button/message responses
        if (job.type === 'typing' || job.type === 'math') {
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

            collector.on('collect', async m => {
                const userAnswer = m.content.trim();
                const correct = (job.type === 'typing' && userAnswer === job.cmd) ||
                    (job.type === 'math' && userAnswer === job.ans);

                if (correct) {
                    const pay = Math.floor(Math.random() * (job.pay[1] - job.pay[0] + 1)) + job.pay[0];
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, pay, `Trabajo: ${job.title}`, 'cash');
                    casinoSessions[jobKey] = Date.now();

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ ¡EXCELENTE TRABAJO!')
                        .setColor(0x00FF00)
                        .setDescription(`Has completado: **${job.title}**`)
                        .addFields({ name: '💰 Ganancia', value: `$${pay.toLocaleString()}`, inline: true })
                        .setFooter({ text: '¡Sigue así!' });

                    m.react('✅');
                    await interaction.followUp({ embeds: [successEmbed] });
                } else {
                    m.react('❌');
                    await interaction.followUp(`❌ Incorrecto. ${job.type === 'math' ? `La respuesta era: ${job.ans}` : ''}`);
                }
            });

        } else {
            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('job_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 20000, max: 1 });

            collector.on('collect', async i => {
                const selected = i.customId.replace('job_', '');
                let win = false;

                if (job.type === 'memory') win = selected === job.code;
                else if (job.type === 'wires') win = selected.includes(job.wire);
                else if (job.type === 'nav') win = selected.includes(job.dir);
                else if (job.type === 'luck') win = Math.random() > 0.5;

                if (win) {
                    const pay = Math.floor(Math.random() * (job.pay[1] - job.pay[0] + 1)) + job.pay[0];
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, pay, `Trabajo: ${job.title}`, 'cash');
                    casinoSessions[jobKey] = Date.now();

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ ¡EXCELENTE TRABAJO!')
                        .setColor(0x00FF00)
                        .setDescription(`Has completado: **${job.title}**`)
                        .addFields({ name: '💰 Ganancia', value: `$${pay.toLocaleString()}`, inline: true })
                        .setFooter({ text: '¡Descansa y vuelve en 1 hora!' })
                        .setTimestamp();

                    await i.update({ embeds: [successEmbed], components: [] });
                } else {
                    await i.update({
                        content: `❌ **Fallaste** en ${job.title}. Inténtalo de nuevo en 1 hora.`,
                        embeds: [],
                        components: []
                    });
                    casinoSessions[jobKey] = Date.now();
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp('⏱️ Se acabó el tiempo.').catch(() => { });
                }
            });
        }
    }

    else if (commandName === 'crimen') {
        await interaction.deferReply();
        const CRIME_COOLDOWN = 120 * 60 * 1000;
        const crimeKey = `crime_${interaction.user.id}`;
        const lastCrime = casinoSessions[crimeKey] || 0;

        if (Date.now() - lastCrime < CRIME_COOLDOWN) {
            const min = Math.ceil((CRIME_COOLDOWN - (Date.now() - lastCrime)) / 60000);
            return interaction.editReply(`🚓 **Buscado por la policía**\nEscóndete **${min} minutos**.`);
        }

        // Enhanced crimes with BALANCED risks/rewards (reduced 50-60%)
        const crimes = [
            { title: '💣 Bomba Nuclear', desc: 'Cable correcto: VERDE', type: 'wires', wire: 'VERDE', opts: ['🔴 ROJO', '🟢 VERDE', '🔵 AZUL', '🟡 AMARILLO', '⚫ NEGRO'], pay: [40000, 65000], fine: [15000, 25000] },
            { title: '🏛️ Museo Nacional', desc: 'Sala 3 - Código 842', type: 'memory', code: 'Sala 3 - 842', opts: ['Sala 3 - 842', 'Sala 2 - 842', 'Sala 3 - 824', 'Sala 4 - 842', 'Sala 3 - 248'], pay: [35000, 55000], fine: [12000, 20000] },
            { title: '🚓 Persecución', desc: 'Escapar a la IZQUIERDA', type: 'nav', dir: 'IZQUIERDA', opts: ['⬅️ IZQUIERDA', '➡️ DERECHA', '⬆️ ACELERAR', '⬇️ FRENAR'], pay: [25000, 40000], fine: [8000, 15000] },
            { title: '💎 Mansión', desc: 'Cruzar jardín minado', type: 'luck', opts: ['🚶 RUTA A', '🚶 RUTA B', '🚶 RUTA C', '🚶 RUTA D', '🚶 RUTA E'], luck: 0.20, pay: [45000, 70000], fine: [18000, 30000] },
            { title: '💻 Hackeo Banco', desc: 'inject_root_sql_bypass_admin', type: 'typing', cmd: 'inject_root_sql_bypass_admin', pay: [30000, 50000], fine: [10000, 18000] },
            { title: '🔐 Caja Fuerte Federal', desc: 'Código: 9-1-8-3-7', type: 'memory', code: '9-1-8-3-7', opts: ['9-1-8-3-7', '9-1-7-3-8', '1-9-8-3-7', '9-8-1-3-7', '9-1-3-8-7'], pay: [50000, 80000], fine: [20000, 35000] },
            { title: '🚁 Escape Aéreo', desc: 'Huir al NORTE entre edificios', type: 'nav', dir: 'NORTE', opts: ['⬆️ NORTE', '⬇️ SUR', '⬅️ OESTE', '➡️ ESTE', '💨 VERTICAL'], pay: [42000, 62000], fine: [16000, 28000] }
        ];

        const crime = crimes[Math.floor(Math.random() * crimes.length)];

        const embed = new EmbedBuilder()
            .setTitle(`☠️ ${crime.title}`)
            .setColor(0x880000)
            .setDescription(`**Misión:** ${crime.desc}\n\n💰 Botín: $${crime.pay[0].toLocaleString()} - $${crime.pay[1].toLocaleString()}\n🚨 Multa si fallas: $${crime.fine[0].toLocaleString()} - $${crime.fine[1].toLocaleString()}`)
            .setFooter({ text: '⚠️ ALTÍSIMO RIESGO - 15 Segundos' })
            .setTimestamp();

        // Similar structure to trabajar but with crime visuals
        if (crime.type === 'memory') {
            embed.addFields({ name: '🔐 MEMORIZA EL PLAN:', value: `\`\`\`\n${crime.code}\n\`\`\`` });
            await interaction.editReply({ embeds: [embed] });

            for (let i = 3; i > 0; i--) {
                await new Promise(r => setTimeout(r, 1000));
                embed.setFooter({ text: `⏰ Destruyendo evidencia en ${i}...` });
                await interaction.editReply({ embeds: [embed] });
            }

            embed.setDescription(`🕵️ ¿Cuál era el plan?`);
            embed.spliceFields(0, 1);

            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (crime.type === 'wires') {
            embed.addFields({
                name: '💣 BOMBA NUCLEAR',
                value: `\`\`\`\n╔═══════════╗\n║  ☢️ PELIGRO ☢️  ║\n║  🔴 🟢 🔵  ║\n║  10:00:00  ║\n╚═══════════╝\n\`\`\`\n⚠️ ¡CORTA EL CABLE ${crime.wire}!`
            });

            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (crime.type === 'nav') {
            embed.addFields({
                name: '🚔 PERSECUCIÓN',
                value: `\`\`\`\n  🚗💨\n━━━┃━━━\n🚓 ↑ 🚧\n━━━━━━━\n\`\`\`\n⚡ Gira a la ${crime.dir} ¡YA!`
            });

            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (crime.type === 'luck') {
            embed.addFields({
                name: '🏰 JARDÍN MINADO',
                value: `\`\`\`\n🏰 MANSIÓN 🏰\n[A] [B] [C] [D] [E]\n 💀  ?  💀  ?  💀\n\`\`\`\n⚠️ Probabilidad de éxito: 25%`
            });

            const row = new ActionRowBuilder();
            crime.opts.forEach(opt =>
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`crime_${opt}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Danger))
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

        } else if (crime.type === 'typing') {
            embed.addFields({
                name: '🖥️ TERMINAL BANCARIA',
                value: `\`\`\`bash\n🏦 BANCO CENTRAL\n> ACCESO DENEGADO\n> BYPASS...\n$ ${crime.cmd}\n\`\`\`\n⌨️ Ejecuta el comando`
            });
            await interaction.editReply({ embeds: [embed] });
        }

        // Collector (same logic but with crime penalties)
        if (crime.type === 'typing') {
            const filter = m => m.author.id === interaction.user.id;
            const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });

            collector.on('collect', async m => {
                if (m.content.trim() === crime.cmd) {
                    const pay = Math.floor(Math.random() * (crime.pay[1] - crime.pay[0] + 1)) + crime.pay[0];
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, pay, `Crimen: ${crime.title}`, 'cash');
                    casinoSessions[crimeKey] = Date.now();

                    const successEmbed = new EmbedBuilder()
                        .setTitle('💸 ¡ÉXITO CRIMINAL!')
                        .setColor(0x00FF00)
                        .setDescription(`Completaste: **${crime.title}**`)
                        .addFields({ name: '💰 Botín', value: `$${pay.toLocaleString()}`, inline: true })
                        .setFooter({ text: 'Aléjate de la escena del crimen' });

                    m.react('😈');
                    await interaction.followUp({ embeds: [successEmbed] });
                } else {
                    const fine = Math.floor(Math.random() * (crime.fine[1] - crime.fine[0] + 1)) + crime.fine[0];
                    await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, fine, `Multa: ${crime.title}`, 'cash');
                    casinoSessions[crimeKey] = Date.now();
                    m.react('🚔');
                    await interaction.followUp(`🚨 **ARRESTADO**. Fallaste. Multa: **$${fine.toLocaleString()}**`);
                }
            });

        } else {
            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('crime_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 20000, max: 1 });

            collector.on('collect', async i => {
                const selected = i.customId.replace('crime_', '');
                let win = false;

                if (crime.type === 'memory') win = selected === crime.code;
                else if (crime.type === 'wires') win = selected.includes(crime.wire);
                else if (crime.type === 'nav') win = selected.includes(crime.dir);
                else if (crime.type === 'luck') win = Math.random() > (crime.luck || 0.75);

                if (win) {
                    const pay = Math.floor(Math.random() * (crime.pay[1] - crime.pay[0] + 1)) + crime.pay[0];
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, pay, `Crimen: ${crime.title}`, 'cash');
                    casinoSessions[crimeKey] = Date.now();

                    const successEmbed = new EmbedBuilder()
                        .setTitle('💸 ¡ÉXITO CRIMINAL!')
                        .setColor(0x00FF00)
                        .setDescription(`Completaste: **${crime.title}**`)
                        .addFields({ name: '💰 Botín', value: `$${pay.toLocaleString()}`, inline: true })
                        .setFooter({ text: 'Escóndete por 2 horas' })
                        .setTimestamp();

                    await i.update({ embeds: [successEmbed], components: [] });
                } else {
                    const fine = Math.floor(Math.random() * (crime.fine[1] - crime.fine[0] + 1)) + crime.fine[0];
                    await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, fine, `Multa: ${crime.title}`, 'cash');
                    casinoSessions[crimeKey] = Date.now();

                    await i.update({
                        content: `🚨 **ARRESTADO** en ${crime.title}. Multa: **$${fine.toLocaleString()}**`,
                        embeds: [],
                        components: []
                    });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp('⏱️ Tiempo agotado. La policía te atrapó.').catch(() => { });
                    casinoSessions[crimeKey] = Date.now();
                }
            });
        }
    }

    else if (commandName === 'bolsa') {
        await interaction.deferReply();
        const subCmd = interaction.options.getSubcommand();

        // Dynamic Stock Market Engine
        const STOCKS = {};
        globalStocks.forEach(s => {
            STOCKS[s.symbol] = { name: s.name, basePrice: s.base, volatility: s.volatility };
        });

        const getStockPrice = (symbol) => {
            const stock = STOCKS[symbol];
            const date = new Date();
            const hour = date.getHours();
            const day = date.getDate();
            const seed = (day * 24) + hour;
            const change = Math.sin(seed * 0.5) * stock.volatility;
            return Math.floor(stock.basePrice * (1 + change));
        };

        if (subCmd === 'ver') {
            const embed = new EmbedBuilder()
                .setTitle('📈 Bolsa de Valores Nación MX')
                .setColor('#0099FF')
                .setDescription('Precios actualizados en tiempo real. ¡Compra barato, vende caro!')
                .setTimestamp();

            for (const [symbol, data] of Object.entries(STOCKS)) {
                const price = getStockPrice(symbol);
                const trend = price > data.basePrice ? '🟢 Alza' : '🔴 Baja';
                embed.addFields({
                    name: `${symbol} - ${data.name}`,
                    value: `💰 **$${price.toLocaleString()}**\n📊 Tendencia: ${trend}`,
                    inline: true
                });
            }
            return interaction.editReply({ embeds: [embed] });
        }

        if (subCmd === 'comprar') {
            const symbol = interaction.options.getString('empresa').toUpperCase();
            const qty = interaction.options.getNumber('cantidad');
            const method = interaction.options.getString('metodo') || 'bank';

            if (!STOCKS[symbol]) return interaction.editReply('❌ Empresa no cotizada. Usa `/bolsa ver`.');
            if (qty <= 0) return interaction.editReply('❌ Cantidad inválida.');

            const price = getStockPrice(symbol);
            const totalCost = price * qty;
            const fees = method === 'credit' ? 0.05 : 0.02;
            const costWithFee = Math.floor(totalCost * (1 + fees));

            // Check Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const methodLabel = method === 'cash' ? 'Efectivo' : method === 'credit' ? 'Crédito' : 'Banco';
            const funds = method === 'cash' ? (balance.cash || 0) : (balance.bank || 0);

            if (funds < costWithFee && method !== 'credit') {
                return interaction.editReply(`❌ **Fondos Insuficientes en ${methodLabel}**\nRequiere: $${costWithFee.toLocaleString()} (Incluye comisiones)\nTienes: $${funds.toLocaleString()}`);
            }

            const sourceType = method === 'cash' ? 'cash' : 'bank';
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, costWithFee, `Compra acciones ${symbol}`, sourceType);

            const { data: current } = await supabase.from('stock_portfolios').select('*').eq('discord_user_id', interaction.user.id).eq('stock_symbol', symbol).maybeSingle();

            if (current) {
                await supabase.from('stock_portfolios').update({ shares: current.shares + qty }).eq('id', current.id);
            } else {
                await supabase.from('stock_portfolios').insert({
                    discord_user_id: interaction.user.id,
                    stock_symbol: symbol,
                    shares: qty
                });
            }
            return interaction.editReply(`✅ **Compra Exitosa**\nComprado **${qty}** de **${symbol}** a $${price}.\nTotal: $${costWithFee.toLocaleString()} (${methodLabel})`);
        }

        if (subCmd === 'vender') {
            const symbol = interaction.options.getString('empresa').toUpperCase();
            const qty = interaction.options.getNumber('cantidad');

            if (!STOCKS[symbol]) return interaction.editReply('❌ Empresa no cotizada.');
            if (qty <= 0) return interaction.editReply('❌ Cantidad inválida.');

            const { data: current } = await supabase.from('stock_portfolios').select('*').eq('discord_user_id', interaction.user.id).eq('stock_symbol', symbol).maybeSingle();

            if (!current || current.shares < qty) {
                return interaction.editReply(`❌ No tienes suficientes acciones. Tienes: ${current ? current.shares : 0}`);
            }

            const price = getStockPrice(symbol);
            const totalVal = price * qty;
            const valWithFee = Math.floor(totalVal * 0.98); // 2% Broker Fee

            const newShares = current.shares - qty;
            if (newShares <= 0) {
                await supabase.from('stock_portfolios').delete().eq('id', current.id);
            } else {
                await supabase.from('stock_portfolios').update({ shares: newShares }).eq('id', current.id);
            }

            await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, valWithFee, `Venta acciones ${symbol}`, 'bank');
            return interaction.editReply(`✅ **Venta Exitosa**\nHas vendido **${qty}** de **${symbol}** a $${price}.\nRecibido: $${valWithFee.toLocaleString()}`);
        }

        if (subCmd === 'portafolio') {
            const { data: myStocks } = await supabase.from('stock_portfolios').select('*').eq('discord_user_id', interaction.user.id);
            if (!myStocks || myStocks.length === 0) return interaction.editReply('📉 No tienes inversiones activas.');

            let totalValue = 0;
            const embed = new EmbedBuilder().setTitle('💼 Mi Portafolio de Inversión').setColor('#FFD700');
            for (const stock of myStocks) {
                if (!STOCKS[stock.stock_symbol]) continue;
                const price = getStockPrice(stock.stock_symbol);
                const val = price * stock.shares;
                totalValue += val;
                embed.addFields({ name: `${stock.stock_symbol} (${stock.shares} acc.)`, value: `Val: $${val.toLocaleString()}`, inline: true });
            }
            embed.setDescription(`**Valor Total:** $${totalValue.toLocaleString()}`);
            return interaction.editReply({ embeds: [embed] });
        }
    }

    else if (commandName === 'debito') {
        await interaction.deferReply({ ephemeral: true });
        const subCmd = interaction.options.getSubcommand();
        const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);

        if (subCmd === 'estado') {
            // Fetch debit card info
            const { data: debitCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            const embed = new EmbedBuilder()
                .setTitle('💳 Estado de Cuenta')
                .setColor('#2F3136')
                .addFields(
                    { name: '🏦 Banco', value: `$${(balance.bank || 0).toLocaleString()}`, inline: true },
                    { name: '💵 Efectivo', value: `$${(balance.cash || 0).toLocaleString()}`, inline: true },
                    { name: '💰 Patrimonio Total', value: `$${((balance.bank || 0) + (balance.cash || 0)).toLocaleString()}`, inline: false }
                );

            if (debitCard) {
                embed.addFields(
                    { name: '💳 Tarjeta', value: `${debitCard.card_type}`, inline: true },
                    { name: '🔢 Número', value: `**** **** **** ${debitCard.card_number.slice(-4)}`, inline: true }
                );
            } else {
                embed.setFooter({ text: 'No tienes tarjeta de débito activa' });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subCmd === 'retirar') {
            const amount = interaction.options.getNumber('monto');
            if (amount <= 0) return interaction.editReply('❌ Monto inválido.');
            if ((balance.bank || 0) < amount) return interaction.editReply(`❌ **Fondos Insuficientes en Banco**\nTienes: $${(balance.bank || 0).toLocaleString()}`);

            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, 'Retiro cajero', 'bank');
            await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, amount, 'Retiro cajero', 'cash');
            return interaction.editReply(`✅ **Retiro Exitoso**\nRetiraste $${amount.toLocaleString()} del banco.`);
        }

        if (subCmd === 'depositar') {
            const amount = interaction.options.getNumber('monto');
            if (amount <= 0) return interaction.editReply('❌ Monto inválido.');
            if ((balance.cash || 0) < amount) return interaction.editReply(`❌ **Fondos Insuficientes en Efectivo**\nTienes: $${(balance.cash || 0).toLocaleString()}`);

            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, 'Depósito cajero', 'cash');
            await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, amount, 'Depósito cajero', 'bank');
            return interaction.editReply(`✅ **Depósito Exitoso**\nDepositaste $${amount.toLocaleString()} en el banco.`);
        }

        if (subCmd === 'transferir') {
            const targetUser = interaction.options.getUser('destinatario');
            const amount = interaction.options.getNumber('monto');
            const concepto = interaction.options.getString('concepto') || 'Transferencia';

            // Self-transfer check
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply('❌ No puedes transferirte a ti mismo.');
            }

            if (amount <= 0) return interaction.editReply('❌ Monto inválido.');
            if ((balance.bank || 0) < amount) {
                return interaction.editReply(`❌ **Fondos Insuficientes en Banco**\nRequiere: $${amount.toLocaleString()}\nTienes: $${(balance.bank || 0).toLocaleString()}`);
            }

            // Check recipient has debit card
            const { data: recipientCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', targetUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!recipientCard) {
                return interaction.editReply(`❌ ${targetUser.tag} no tiene una tarjeta de débito activa.`);
            }

            // Remove money from sender
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Transfer a ${targetUser.tag}`, 'bank');

            // Schedule transfer (5 minutes)
            const releaseDate = new Date(Date.now() + (5 * 60 * 1000));

            await supabase.from('pending_transfers').insert({
                sender_id: interaction.user.id,
                receiver_id: targetUser.id,
                amount: amount,
                reason: concepto,
                release_date: releaseDate.toISOString(),
                status: 'PENDING',
                transfer_type: 'debito'
            });

            const embed = new EmbedBuilder()
                .setTitle('💳 Transferencia Programada')
                .setColor(0x00FF00)
                .setDescription(`Transferencia a **${targetUser.tag}** en proceso.`)
                .addFields(
                    { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '⏱️ Tiempo', value: '5 minutos', inline: true },
                    { name: '📝 Concepto', value: concepto, inline: false }
                )
                .setFooter({ text: 'El dinero se acreditará automáticamente' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }

    else if (commandName === 'transferir') {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('destinatario');
        const amount = interaction.options.getNumber('monto');
        const concepto = interaction.options.getString('concepto') || 'Transferencia SPEI';

        // Self-transfer check
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply('❌ No puedes transferirte a ti mismo.');
        }

        if (amount <= 0) return interaction.editReply('❌ Monto inválido.');

        const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
        if ((balance.bank || 0) < amount) {
            return interaction.editReply(`❌ **Fondos Insuficientes en Banco**\nRequiere: $${amount.toLocaleString()}\nTienes: $${(balance.bank || 0).toLocaleString()}`);
        }

        // Check recipient has debit card
        const { data: recipientCard } = await supabase
            .from('debit_cards')
            .select('*')
            .eq('discord_user_id', targetUser.id)
            .eq('status', 'active')
            .maybeSingle();

        if (!recipientCard) {
            return interaction.editReply(`❌ ${targetUser.tag} no tiene una tarjeta de débito activa para recibir transferencias.`);
        }

        // GHOST MODE: Check if sender has Elite privacy
        const { data: senderPrivacy } = await supabase
            .from('privacy_accounts')
            .select('*')
            .eq('user_id', interaction.user.id)
            .eq('level', 'elite')
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        const senderName = senderPrivacy?.offshore_name || (senderPrivacy ? '🕶️ Usuario Anónimo' : interaction.user.tag);

        // Immediate transfer
        await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `SPEI a ${targetUser.tag}`, 'bank');
        await billingService.ubService.addMoney(interaction.guildId, targetUser.id, amount, `SPEI de ${senderName}`, 'bank');

        // Notify recipient if they have alerts
        const { data: recipientPrivacy } = await supabase
            .from('privacy_accounts')
            .select('alerts_enabled')
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (recipientPrivacy?.alerts_enabled) {
            try {
                await targetUser.send(`💰 **Transferencia Recibida**\n$${amount.toLocaleString()} de ${senderName}\nConcepto: ${concepto}`);
            } catch (e) { }
        }

        const embed = new EmbedBuilder()
            .setTitle('⚡ Transferencia SPEI Exitosa')
            .setColor(0x00FF00)
            .setDescription(`Transferencia inmediata a **${targetUser.tag}** completada.`)
            .addFields(
                { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: '💳 Destino', value: `*${recipientCard.card_number.slice(-4)}`, inline: true },
                { name: '📝 Concepto', value: concepto, inline: false },
                { name: '👤 Remitente', value: senderName, inline: true }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'casino') {
        await interaction.deferReply();
        const subCmd = interaction.options.getSubcommand();
        const bet = interaction.options.getNumber('apuesta');

        if (bet < 100) return interaction.editReply('❌ Apuesta mínima $100.');

        // Validate Funds
        const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
        const userCash = balance.cash || 0;
        if (userCash < bet) return interaction.editReply('❌ No tienes suficiente efectivo.');

        if (subCmd === 'blackjack') {
            const suits = ['♠️', '♥️', '♣️', '♦️'];
            const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            const deck = [];
            for (const s of suits) for (const v of values) deck.push({ value: v, suit: s });
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }

            const getCardValue = (card) => {
                if (['J', 'Q', 'K'].includes(card.value)) return 10;
                if (card.value === 'A') return 11;
                return parseInt(card.value);
            };

            const calculateScore = (hand) => {
                let score = 0;
                let aces = 0;
                for (const card of hand) {
                    score += getCardValue(card);
                    if (card.value === 'A') aces++;
                }
                while (score > 21 && aces > 0) {
                    score -= 10;
                    aces--;
                }
                return score;
            };

            const playerHand = [deck.pop(), deck.pop()];
            const dealerHand = [deck.pop(), deck.pop()];

            let playerScore = calculateScore(playerHand);
            const dealerVisible = `**${dealerHand[0].value}${dealerHand[0].suit}** | 🎴`;

            const getEmbed = (pScore, dScore, pHand, dHand, status = 'PLAYING') => {
                const color = status === 'WIN' ? '#00FF00' : (status === 'LOSE' ? '#FF0000' : '#FFFF00');
                return new EmbedBuilder()
                    .setTitle('🎰 Blackjack Nación MX')
                    .setColor(color)
                    .addFields(
                        { name: `Tus Cartas (${pScore})`, value: pHand.map(c => `[${c.value}${c.suit}]`).join(' '), inline: true },
                        { name: `Dealer (${status === 'PLAYING' ? '?' : dScore})`, value: status === 'PLAYING' ? dealerVisible : dHand.map(c => `[${c.value}${c.suit}]`).join(' '), inline: true },
                        { name: '💰 Apuesta', value: `$${bet.toLocaleString()}`, inline: false }
                    );
            };

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('hit').setLabel('Pedir Carta').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('stand').setLabel('Plantarse').setStyle(ButtonStyle.Success)
                );

            const msg = await interaction.editReply({ embeds: [getEmbed(playerScore, 0, playerHand, dealerHand)], components: [row] });

            if (playerScore === 21) {
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, Math.floor(bet * 1.5), 'Blackjack Win', 'cash');
                return interaction.editReply({ content: '🔥 **¡BLACKJACK!** Ganaste 3:2.', components: [] });
            }

            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, bet, 'Blackjack Bet', 'cash');

            const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            collector.on('collect', async i => {
                await i.deferUpdate();
                if (i.customId === 'hit') {
                    playerHand.push(deck.pop());
                    playerScore = calculateScore(playerHand);

                    if (playerScore > 21) {
                        collector.stop('bust');
                    } else {
                        await i.editReply({ embeds: [getEmbed(playerScore, 0, playerHand, dealerHand)], components: [row] });
                    }
                } else if (i.customId === 'stand') {
                    collector.stop('stand');
                }
            });

            collector.on('end', async (c, reason) => {
                if (reason === 'bust') {
                    await interaction.editReply({
                        embeds: [getEmbed(playerScore, calculateScore(dealerHand), playerHand, dealerHand, 'LOSE').setDescription('❌ **Te pasaste!** Perdiste tu apuesta.')],
                        components: []
                    });
                } else {
                    let dealerScore = calculateScore(dealerHand);
                    while (dealerScore < 17) {
                        dealerHand.push(deck.pop());
                        dealerScore = calculateScore(dealerHand);
                    }

                    let result = '';
                    let payout = 0;

                    if (dealerScore > 21 || playerScore > dealerScore) {
                        result = 'WIN';
                        payout = bet * 2;
                        await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, payout, 'Blackjack Win', 'cash');
                    } else if (playerScore === dealerScore) {
                        result = 'PUSH';
                        payout = bet;
                        await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, payout, 'Blackjack Push', 'cash');
                    } else {
                        result = 'LOSE';
                    }

                    const resultMsg = result === 'WIN' ? `✅ **¡GANASTE!** (Dealer: ${dealerScore})` : (result === 'PUSH' ? '🤝 **Empate** - Apuesta devuelta.' : `❌ **Perdiste.** (Dealer: ${dealerScore})`);

                    await interaction.editReply({
                        embeds: [getEmbed(playerScore, dealerScore, playerHand, dealerHand, result).setDescription(resultMsg)],
                        components: []
                    });
                }
            });
        }

        else if (subCmd === 'ruleta') {
            const option = interaction.options.getString('opcion');
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, bet, 'Ruleta Bet', 'cash');
            await interaction.editReply(`🎲 Girando ruleta...apostando **$${bet}** a **${option}**...`);

            setTimeout(async () => {
                const resultNum = Math.floor(Math.random() * 37);
                const colors = { 0: 'green' };
                const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                for (let i = 1; i <= 36; i++) {
                    if (!colors[i]) colors[i] = reds.includes(i) ? 'red' : 'black';
                }
                const resultColor = colors[resultNum];

                let win = false;
                let multiplier = 0;

                if (option === 'red' && resultColor === 'red') { win = true; multiplier = 2; }
                else if (option === 'black' && resultColor === 'black') { win = true; multiplier = 2; }
                else if (option === 'green' && resultColor === 'green') { win = true; multiplier = 14; }
                else if (option === 'low' && resultNum >= 1 && resultNum <= 18) { win = true; multiplier = 2; }
                else if (option === 'high' && resultNum >= 19 && resultNum <= 36) { win = true; multiplier = 2; }

                const embed = new EmbedBuilder()
                    .setTitle(`🎰 Resultado: [ ${resultNum} ${resultColor === 'red' ? '🔴' : (resultColor === 'black' ? '⚫' : '🟢')} ]`)
                    .setColor(win ? '#00FF00' : '#FF0000')
                    .setTimestamp();

                if (win) {
                    const payout = bet * multiplier;
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, payout, 'Ruleta Win', 'cash');
                    embed.setDescription(`🎉 **¡GANASTE!**\nRecibes: **$${payout.toLocaleString()}**`);
                } else {
                    embed.setDescription(`❌ **Perdiste.**\nLa casa gana.`);
                }
                await interaction.editReply({ content: '', embeds: [embed] });
            }, 4000);
        }

        else if (subCmd === 'fichas') {
            const accion = interaction.options.getString('accion');
            const cantidad = interaction.options.getNumber('cantidad');

            const FICHA_PRICE = 100; // $100 por ficha

            if (accion === 'comprar') {
                const costo = cantidad * FICHA_PRICE;

                if (userCash < costo) {
                    return interaction.editReply(`❌ **Fondos Insuficientes**\nNecesitas: $${costo.toLocaleString()}\nTienes: $${userCash.toLocaleString()}`);
                }

                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, costo, 'Compra fichas casino', 'cash');

                // Update or create chips record
                const { data: existing } = await supabase.from('casino_chips').select('*').eq('user_id', interaction.user.id).maybeSingle();

                if (existing) {
                    await supabase.from('casino_chips').update({
                        chips: existing.chips + cantidad
                    }).eq('user_id', interaction.user.id);
                } else {
                    await supabase.from('casino_chips').insert({
                        user_id: interaction.user.id,
                        chips: cantidad,
                        total_won: 0,
                        total_lost: 0,
                        games_played: 0
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎰 Compra de Fichas')
                    .setColor(0xFFD700)
                    .setDescription(`Has comprado **${cantidad} fichas** del casino`)
                    .addFields(
                        { name: '💰 Costo', value: `$${costo.toLocaleString()}`, inline: true },
                        { name: '🎲 Total Fichas', value: `${(existing?.chips || 0) + cantidad}`, inline: true }
                    )
                    .setFooter({ text: 'Usa las fichas en /jugar' });

                return interaction.editReply({ embeds: [embed] });

            } else if (accion === 'vender') {
                const { data: chips } = await supabase.from('casino_chips').select('*').eq('user_id', interaction.user.id).maybeSingle();

                if (!chips || chips.chips < cantidad) {
                    return interaction.editReply(`❌ **Fichas Insuficientes**\nTienes: ${chips?.chips || 0} fichas`);
                }

                const ganancia = cantidad * FICHA_PRICE;
                await supabase.from('casino_chips').update({
                    chips: chips.chips - cantidad
                }).eq('user_id', interaction.user.id);

                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, ganancia, 'Venta fichas casino', 'cash');

                const embed = new EmbedBuilder()
                    .setTitle('💵 Venta de Fichas')
                    .setColor(0x00FF00)
                    .setDescription(`Has vendido **${cantidad} fichas**`)
                    .addFields(
                        { name: '💰 Ganancia', value: `$${ganancia.toLocaleString()}`, inline: true },
                        { name: '🎲 Fichas Restantes', value: `${chips.chips - cantidad}`, inline: true }
                    );

                return interaction.editReply({ embeds: [embed] });
            }
        }
    }


    else if (commandName === 'top-morosos') {
        await interaction.deferReply();

        try {
            const { data: debtors } = await supabase
                .from('credit_cards')
                .select('current_balance, card_type, citizen_id, citizens!inner(full_name, discord_id)')
                .gt('current_balance', 0)
                .order('current_balance', { ascending: false })
                .limit(10);

            if (!debtors || debtors.length === 0) {
                return interaction.editReply('✅ ¡No hay deudores! Todos están al corriente.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📉 Top 10 - Mayores Deudas')
                .setColor(0xFF0000)
                .setTimestamp();

            let description = '';
            debtors.forEach((d, index) => {
                description += `${index + 1}. **${d.citizens.full_name}** - $${d.current_balance.toLocaleString()} (${d.card_type})\n`;
            });

            embed.setDescription(description);
            embed.setFooter({ text: 'Recuerda pagar tus tarjetas a tiempo' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo el ranking.');
        }
    }

    else if (commandName === 'depositar') {
        await interaction.deferReply();
        const destUser = interaction.options.getUser('destinatario');

        // Prevent self-transfer
        if (destUser.id === interaction.user.id) {
            return interaction.editReply('❌ No puedes depositarte a ti mismo. Usa `/debito depositar` para guardar efectivo en tu banco.');
        }

        const inputMonto = interaction.options.getString('monto');
        const razon = interaction.options.getString('razon') || 'Depósito en Efectivo';

        // Parse Amount
        let monto = 0;
        // Fetch balance early to handle 'todo'
        const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
        const cash = balance.cash || 0;

        if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
            monto = cash;
        } else {
            // Remove any non-numeric chars (e.g. $, commas) to be safe
            const cleanMonto = inputMonto.replace(/[^0-9.]/g, '');
            monto = parseFloat(cleanMonto);
        }

        // Security: Check for NaN, Finite, and positive amount
        if (isNaN(monto) || !isFinite(monto) || monto <= 0) {
            return interaction.editReply('❌ Monto inválido. Debes ingresar un número positivo mayor a 0.');
        }


        try {
            // 1. Check Sender CASH (OXXO Logic: You pay with cash)
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const cash = balance.cash || 0;

            if (cash < monto) {
                return interaction.editReply(`❌ No tienes suficiente **efectivo** en mano. Tienes: $${cash.toLocaleString()}`);
            }

            // 2. Check Recipient Debit Card
            const { data: destCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', destUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!destCard) {
                return interaction.editReply(`❌ El destinatario ${destUser.tag} no tiene una Tarjeta de Débito NMX activa para recibir depósitos.`);
            }

            // 3. Process Logic
            // Remove Cash from Sender instantly
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Depósito a ${destUser.tag}`, 'cash');

            // Schedule Pending Transfer (4 Hours Delay)
            const completionTime = new Date(Date.now() + (4 * 60 * 60 * 1000)); // 4 Hours

            await supabase.from('pending_transfers').insert({
                sender_id: interaction.user.id,
                receiver_id: destUser.id,
                amount: monto,
                reason: razon,
                release_date: completionTime.toISOString(),
                status: 'PENDING'
            });

            // GHOST MODE: Check sender privacy
            const { data: senderDepositPrivacy } = await supabase
                .from('privacy_accounts')
                .select('*')
                .eq('user_id', interaction.user.id)
                .eq('level', 'elite')
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            const depositSenderName = senderDepositPrivacy?.offshore_name || (senderDepositPrivacy ? '🕶️ Anónimo' : interaction.user.tag);

            // 4. Response
            const embed = new EmbedBuilder()
                .setTitle('🏪 Depósito Realizado')
                .setColor(0xFFA500)
                .setDescription(`Has depositado efectivo a la cuenta de **${destUser.tag}**.`)
                .addFields(
                    { name: '💸 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: '💳 Destino', value: `Tarjeta NMX *${destCard.card_number.slice(-4)}`, inline: true },
                    { name: '⏳ Tiempo estimado', value: '4 Horas', inline: false },
                    { name: '📝 Concepto', value: razon, inline: false },
                    { name: '👤 Remitente', value: depositSenderName, inline: true }
                )
                .setFooter({ text: 'El dinero llegará automáticamente cuando se procese.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando el depósito.');
        }
    }


    else if (commandName === 'giro') {
        await interaction.deferReply(); // Defer immediately

        const destUser = interaction.options.getUser('destinatario');
        const inputMonto = interaction.options.getString('monto');
        const razon = interaction.options.getString('razon') || 'Giro Postal';

        // Fetch balance early
        const senderBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);

        let monto = 0;
        if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
            monto = senderBalance.cash || 0;
        } else {
            // Remove any non-numeric chars
            const cleanMonto = inputMonto.replace(/[^0-9.]/g, '');
            monto = parseFloat(cleanMonto);
        }

        // Security: Check for NaN, Finite, and positive amount
        if (isNaN(monto) || !isFinite(monto) || monto <= 0) {
            return interaction.editReply({ content: '❌ Monto inválido. Debes ingresar un número positivo mayor a 0.' });
        }
        if (destUser.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes enviarte un giro a ti mismo.' });

        try {
            // Already fetched balance above.
            if ((senderBalance.cash || 0) < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Efectivo. Tienes $${(senderBalance.cash || 0).toLocaleString()}.`);
            }

            // 2. Create Pending Transfer FIRST (24h Delay)
            const releaseDate = new Date();
            releaseDate.setHours(releaseDate.getHours() + 24);

            const { error: insertError } = await supabase.from('giro_transfers').insert({
                sender_id: interaction.user.id,
                receiver_id: destUser.id,
                amount: monto,
                reason: razon,
                release_date: releaseDate.toISOString(),
                status: 'pending'
            });

            if (insertError) {
                console.error('[giro] Error:', insertError);
                return interaction.editReply(`❌ Error creando giro.\nDetalles: ${insertError.message}`);
            }

            // 3. Show payment selector
            // GHOST MODE: Check sender privacy
            const { data: senderGiroPrivacy } = await supabase
                .from('privacy_accounts')
                .select('*')
                .eq('user_id', interaction.user.id)
                .eq('level', 'elite')
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            const giroSenderName = senderGiroPrivacy?.offshore_name || (senderGiroPrivacy ? '🕶️ Anónimo' : interaction.user.tag);

            const pmGiro = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
            const pbGiro = createPaymentButtons(pmGiro, 'giro_pay');
            const paymentEmbed = createPaymentEmbed(`📮 Giro a ${destUser.tag} (Entrega 24h)`, monto, pmGiro);
            paymentEmbed.addFields({ name: '👤 Remitente', value: giroSenderName, inline: true });
            await interaction.editReply({ embeds: [paymentEmbed], components: [pbGiro] });
            const fGiro = i => i.user.id === interaction.user.id && i.customId.startsWith('giro_pay_');
            const cGiro = interaction.channel.createMessageComponentCollector({ filter: fGiro, time: 60000, max: 1 });
            cGiro.on('collect', async (i) => {
                await i.deferUpdate();
                const prGiro = await processPayment(i.customId.replace('giro_pay_', ''), interaction.user.id, interaction.guildId, monto, `[Giro] ${destUser.tag}`, pmGiro);
                if (!prGiro.success) return i.editReply({ content: prGiro.error, components: [] });
                await i.editReply({ content: `✅ **Giro Enviado** (${prGiro.method})\n\nDestinatario: **${destUser.tag}**\nMonto: **$${monto.toLocaleString()}**\nEntrega: 24 horas`, components: [] });
            });
            cGiro.on('end', collected => { if (collected.size === 0) interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }); });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando el giro postal.');
        }
    }

    else if (commandName === 'impuestos') {
        await interaction.deferReply();

        // Simple tax system: 5% tax on cash holdings over $1M
        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        try {
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
            const cash = balance.cash || 0;

            const TAX_THRESHOLD = 1000000;
            const TAX_RATE = 0.05;

            let taxAmount = 0;
            if (cash > TAX_THRESHOLD) {
                taxAmount = Math.floor((cash - TAX_THRESHOLD) * TAX_RATE);
            }

            const embed = new EmbedBuilder()
                .setColor(taxAmount > 0 ? '#FF0000' : '#00FF00')
                .setTitle(`💼 Estado Fiscal de ${targetUser.username}`)
                .addFields(
                    { name: '💵 Efectivo Actual', value: `$${cash.toLocaleString()}`, inline: true },
                    { name: '📊 Umbral Exento', value: `$${TAX_THRESHOLD.toLocaleString()}`, inline: true },
                    { name: '📈 Tasa de Impuesto', value: `${(TAX_RATE * 100)}%`, inline: true },
                    { name: '💸 Impuesto Estimado', value: taxAmount > 0 ? `$${taxAmount.toLocaleString()}` : 'Exento', inline: false }
                )
                .setFooter({ text: 'Sistema de impuestos sobre efectivo excedente' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[impuestos] Error:', error);
            await interaction.editReply('❌ Error al calcular impuestos.');
        }
    }

    // ===================================================================
    // ECONOMY COMMANDS: Stake, Slots, Fondos
    // ===================================================================

    else if (commandName === 'stake') {
        await interaction.deferReply();
        try {
        } catch (err) {
            console.error('[ERROR] Failed to defer stake:', err);
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'depositar') {
            const crypto = interaction.options.getString('crypto').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');
            const dias = interaction.options.getInteger('dias');

            if (!['BTC', 'ETH', 'SOL'].includes(crypto)) {
                return interaction.editReply('❌ Crypto inválida. Usa: BTC, ETH, SOL');
            }

            if (![7, 30, 90].includes(dias)) {
                return interaction.editReply('❌ Períodos válidos: 7, 30, o 90 días');
            }

            try {
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('stock_symbol', crypto)
                    .single();

                if (!portfolio || portfolio.shares < cantidad) {
                    return interaction.editReply('❌ No tienes suficiente crypto. Compra primero con `/bolsa comprar`');
                }

                await supabase
                    .from('stock_portfolios')
                    .update({ shares: portfolio.shares - cantidad })
                    .eq('id', portfolio.id);

                const stake = await stakingService.createStake(
                    interaction.user.id,
                    crypto,
                    cantidad,
                    dias
                );

                const rates = stakingService.rates[crypto];
                const apy = rates[dias] * 100;
                const estimatedEarnings = (cantidad * rates[dias] * dias / 365).toFixed(4);

                await interaction.editReply({
                    content: `✅ **Staking Exitoso!**\n\n🔒 **${cantidad}** ${crypto} bloqueado por **${dias} días**\n📊 APY: **${apy.toFixed(1)}%**\n💰 Earnings estimados: **${estimatedEarnings}** ${crypto}\n\n_Usa \`/stake mis-stakes\` para ver todos tus stakes._`
                });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error creando stake.');
            }
        }

        else if (subcommand === 'mis-stakes') {
            const stakes = await stakingService.getUserStakes(interaction.user.id);

            if (stakes.length === 0) {
                return interaction.editReply('📊 No tienes stakes activos. Usa `/stake depositar` para empezar.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🔒 Tus Stakes Activos')
                .setColor(0x00FF00)
                .setFooter({ text: 'Usa /stake retirar [id] para retirar stakes desbloqueados' });

            stakes.forEach(s => {
                const endDate = new Date(s.end_date);
                const isUnlocked = Date.now() > endDate.getTime();
                const status = isUnlocked ? '🔓 DESBLOQUEADO' : `🔒 Bloqueado hasta ${endDate.toLocaleDateString()}`;

                embed.addFields({
                    name: `${s.crypto_symbol} - ${s.amount} unidades`,
                    value: `APY: ${s.apy}%\n${status}\nID: \`${s.id.substring(0, 8)}\``
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subcommand === 'retirar') {
            const stakeId = interaction.options.getString('id');

            try {
                const { amount, earnings } = await stakingService.withdrawStake(stakeId, interaction.user.id);

                await interaction.editReply({
                    content: `✅ **Stake Retirado!**\n\n💰 Principal: **${amount}**\n📈 Ganancias: **${earnings.toFixed(4)}**\n🎉 Total: **${(amount + earnings).toFixed(4)}**`
                });

            } catch (error) {
                await interaction.editReply(`❌ ${error.message}`);
            }
        }
    }

    else if (commandName === 'slots') {
        await interaction.deferReply();
        try {
        } catch (err) {
            console.error('[ERROR] Failed to defer slots:', err);
            return;
        }

        const apuesta = interaction.options.getInteger('apuesta');

        if (apuesta < 100) {
            return interaction.editReply('❌ Apuesta mínima: $100');
        }

        try {
            const card = await getDebitCard(interaction.user.id);
            if (!card || card.balance < apuesta) {
                return interaction.editReply('❌ Saldo insuficiente en tarjeta de débito');
            }

            await supabase
                .from('debit_cards')
                .update({ balance: card.balance - apuesta })
                .eq('id', card.id);

            const { result, payout, win, jackpot, jackpotAmount } = await slotsService.spin(
                interaction.user.id,
                apuesta
            );

            if (payout > 0) {
                await supabase
                    .from('debit_cards')
                    .update({ balance: card.balance - apuesta + payout })
                    .eq('id', card.id);
            }

            const spinning = '🎰 | 🎰 | 🎰';
            const final = `${result.reel1} | ${result.reel2} | ${result.reel3}`;

            let message = `**SLOT MACHINE** 🎰\n\n${spinning}\n⬇️\n${final}\n\n`;

            if (jackpot) {
                message += `🎉🎉🎉 **JACKPOT!!!** 🎉🎉🎉\n💰 ¡Ganaste $${jackpotAmount.toLocaleString()} del jackpot!\n`;
            } else if (win) {
                const profit = payout - apuesta;
                message += `✅ **¡GANASTE!** 💰\nPago: $${payout.toLocaleString()} (+$${profit.toLocaleString()})\n`;
            } else {
                message += `❌ **Perdiste** $${apuesta.toLocaleString()}\n`;
            }

            const currentJackpot = await slotsService.getJackpot();
            message += `\n🏆 Jackpot actual: $${currentJackpot.toLocaleString()}`;

            await interaction.editReply(message);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error en slots');
        }
    }

    else if (commandName === 'fondos') {
        await interaction.deferReply();
        try {
        } catch (err) {
            console.error('[ERROR] Failed to defer fondos:', err);
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'ver') {
            const { data: funds } = await supabase
                .from('investment_funds')
                .select('*')
                .eq('active', true)
                .order('apy');

            const embed = new EmbedBuilder()
                .setTitle('💼 Fondos de Inversión Disponibles')
                .setColor(0x00BFFF)
                .setFooter({ text: 'Usa /fondos invertir [fondo] [monto]' });

            funds.forEach(f => {
                embed.addFields({
                    name: `${f.name} (${f.risk_level.toUpperCase()})`,
                    value: `📊 APY: ${f.apy}%\n💰 Mín: $${f.min_investment.toLocaleString()}\n📝 ${f.description}`
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subcommand === 'invertir') {
            const fondoNombre = interaction.options.getString('fondo');
            const monto = interaction.options.getInteger('monto');

            const { data: fund } = await supabase
                .from('investment_funds')
                .select('*')
                .ilike('name', `%${fondoNombre}%`)
                .single();

            if (!fund) {
                return interaction.editReply('❌ Fondo no encontrado. Usa `/fondos ver` para ver opciones.');
            }

            if (monto < fund.min_investment) {
                return interaction.editReply(`❌ Inversión mínima: $${fund.min_investment.toLocaleString()}`);
            }

            const card = await getDebitCard(interaction.user.id);
            if (!card || card.balance < monto) {
                return interaction.editReply('❌ Saldo insuficiente');
            }

            await supabase
                .from('debit_cards')
                .update({ balance: card.balance - monto })
                .eq('id', card.id);

            await supabase
                .from('fund_investments')
                .insert({
                    user_id: interaction.user.id,
                    fund_id: fund.id,
                    amount: monto,
                    current_value: monto
                });

            await interaction.editReply({
                content: `✅ **Inversión Exitosa!**\n\n💼 Fondo: **${fund.name}**\n💰 Monto: **$${monto.toLocaleString()}**\n📊 APY: **${fund.apy}%**\n⏰ Tus ganancias se calculan diariamente.\n\n_Usa \`/fondos mis-fondos\` para ver tu portafolio._`
            });
        }

        else if (subcommand === 'mis-fondos') {
            const { data: investments } = await supabase
                .from('fund_investments')
                .select(`
                    *,
                    investment_funds (name, apy, risk_level)
                `)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active');

            if (!investments || investments.length === 0) {
                return interaction.editReply('📊 No tienes inversiones activas. Usa `/fondos invertir`');
            }

            const embed = new EmbedBuilder()
                .setTitle('💼 Tus Inversiones')
                .setColor(0x00BFFF);

            investments.forEach(inv => {
                const fund = inv.investment_funds;
                embed.addFields({
                    name: fund.name,
                    value: `💰 Invertido: $${inv.amount.toLocaleString()}\n📊 APY: ${fund.apy}%\n📈 Nivel: ${fund.risk_level}`
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }
    }

    // PRIVACY SYSTEM HANDLER
    // Add this to index.js

    else if (commandName === 'privacidad') {
        await interaction.deferReply({ ephemeral: true });
        const subCmd = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        // Get current privacy status
        const { data: privacyData } = await supabase
            .from('privacy_accounts')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (subCmd === 'activar') {
            const nivel = interaction.options.getString('nivel');
            const costs = { basico: 50000, vip: 150000, elite: 500000 };
            const cost = costs[nivel];

            const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
            if ((balance.cash || 0) < cost) {
                return interaction.editReply(`❌ **Fondos Insuficientes**\nRequieres: $${cost.toLocaleString()}\nTienes: $${(balance.cash || 0).toLocaleString()}`);
            }

            await billingService.ubService.removeMoney(interaction.guildId, userId, cost, `Activación Privacidad ${nivel}`, 'cash');

            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);

            await supabase.from('privacy_accounts').upsert({
                user_id: userId,
                level: nivel,
                expires_at: expiresAt.toISOString(),
                activated_at: new Date().toISOString()
            });

            const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
            const embed = new EmbedBuilder()
                .setTitle('🕶️ Privacidad Activada')
                .setColor('#2F3136')
                .setDescription(`Nivel: ${icons[nivel]} **${nivel.toUpperCase()}**`)
                .addFields(
                    { name: 'Costo', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: 'Duración', value: '30 días', inline: true },
                    { name: 'Expira', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: 'Tu información bancaria ahora está protegida' });

            return interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'desactivar') {
            if (!privacyData) {
                return interaction.editReply('❌ No tienes privacidad activa');
            }

            await supabase.from('privacy_accounts').delete().eq('user_id', userId);
            return interaction.editReply('✅ Privacidad desactivada');
        }

        else if (subCmd === 'estado') {
            if (!privacyData) {
                return interaction.editReply('❌ No tienes privacidad activa\nUsa `/privacidad activar` para protegerte');
            }

            const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
            const now = new Date();
            const expires = new Date(privacyData.expires_at);
            const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

            const embed = new EmbedBuilder()
                .setTitle('🕶️ Tu Privacidad')
                .setColor('#2F3136')
                .setDescription(`Nivel: ${icons[privacyData.level]} **${privacyData.level.toUpperCase()}**`)
                .addFields(
                    { name: 'Activado', value: `<t:${Math.floor(new Date(privacyData.activated_at).getTime() / 1000)}:R>`, inline: true },
                    { name: 'Expira en', value: `${daysLeft} días`, inline: true },
                    { name: 'Offshore', value: privacyData.offshore_name || 'No configurado', inline: true }
                );

            if (privacyData.level === 'basico') {
                embed.addFields({ name: '✅ Beneficios', value: '• Saldo oculto\n• Inmunidad a robos\n• Transacciones privadas' });
            } else if (privacyData.level === 'vip') {
                embed.addFields({ name: '✅ Beneficios', value: '• Todo lo de Básico\n• Transferencias anónimas\n• Historial privado\n• Alertas de seguridad' });
            } else if (privacyData.level === 'elite') {
                embed.addFields({ name: '✅ Beneficios', value: '• Todo lo de VIP\n• Cuenta Offshore\n• Modo Fantasma\n• Bóveda de Emergencia\n• Anti-Secuestro' });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'upgrade') {
            if (!privacyData) {
                return interaction.editReply('❌ Primero activa un nivel con `/privacidad activar`');
            }

            const newLevel = interaction.options.getString('nuevo_nivel');
            const costs = { vip: 150000, elite: 500000 };
            const currentCosts = { basico: 50000, vip: 150000 };

            if (privacyData.level === 'elite') {
                return interaction.editReply('❌ Ya tienes el nivel máximo');
            }

            if (privacyData.level === 'vip' && newLevel === 'vip') {
                return interaction.editReply('❌ Ya tienes este nivel');
            }

            const upgradeCost = costs[newLevel] - currentCosts[privacyData.level];

            const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
            if ((balance.cash || 0) < upgradeCost) {
                return interaction.editReply(`❌ **Fondos Insuficientes** para upgrade\nRequieres: $${upgradeCost.toLocaleString()}`);
            }

            await billingService.ubService.removeMoney(interaction.guildId, userId, upgradeCost, `Upgrade Privacidad a ${newLevel}`, 'cash');
            await supabase.from('privacy_accounts').update({ level: newLevel }).eq('user_id', userId);

            return interaction.editReply(`✅ Privacidad mejorada a **${newLevel.toUpperCase()}**\nCosto: $${upgradeCost.toLocaleString()}`);
        }

        else if (subCmd === 'boveda') {
            if (!privacyData || privacyData.level !== 'elite') {
                return interaction.editReply('❌ Requiere nivel **Elite**');
            }

            const accion = interaction.options.getString('accion');
            const monto = interaction.options.getNumber('monto');

            const { data: vault } = await supabase
                .from('privacy_vault')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (accion === 'depositar') {
                if (!monto) return interaction.editReply('❌ Especifica un monto');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
                if ((balance.cash || 0) < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes`);
                }

                // Remove money first
                await billingService.ubService.removeMoney(interaction.guildId, userId, monto, 'Depósito Bóveda', 'cash');

                // Now update vault
                let vaultResult;
                if (vault) {
                    vaultResult = await supabase.from('privacy_vault').update({
                        amount: vault.amount + monto,
                        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    }).eq('user_id', userId);
                } else {
                    vaultResult = await supabase.from('privacy_vault').insert({
                        user_id: userId,
                        amount: monto,
                        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    });
                }

                // Check if vault operation failed
                if (vaultResult.error) {
                    console.error('[boveda depositar] Vault error:', vaultResult.error);
                    // ROLLBACK: Return money to user
                    await billingService.ubService.addMoney(interaction.guildId, userId, monto, 'Reembolso - Error depósito bóveda', 'cash');
                    return interaction.editReply(`❌ Error al guardar en bóveda. Tu dinero ha sido devuelto.\nContacta a un administrador.`);
                }

                return interaction.editReply(`🔒 **Depositado en Bóveda**\n$${monto.toLocaleString()}\nBloqueado por 7 días`);
            }

            else if (accion === 'retirar') {
                if (!vault || vault.amount <= 0) {
                    return interaction.editReply('❌ Bóveda vacía');
                }

                const lockTime = new Date(vault.locked_until);
                if (lockTime > new Date()) {
                    return interaction.editReply(`🔒 Bóveda bloqueada hasta <t:${Math.floor(lockTime.getTime() / 1000)}:R>`);
                }

                const amount = monto || vault.amount;
                if (amount > vault.amount) {
                    return interaction.editReply(`❌ No tienes suficiente en bóveda\nDisponible: $${vault.amount.toLocaleString()}`);
                }

                // Update vault FIRST to prevent race conditions
                const vaultResult = await supabase.from('privacy_vault').update({
                    amount: vault.amount - amount
                }).eq('user_id', userId);

                // Check if vault operation failed
                if (vaultResult.error) {
                    console.error('[boveda retirar] Vault error:', vaultResult.error);
                    return interaction.editReply(`❌ Error al retirar de bóveda.\nIntenta de nuevo o contacta a un administrador.`);
                }

                // Now add money safely
                await billingService.ubService.addMoney(interaction.guildId, userId, amount, 'Retiro Bóveda', 'cash');

                return interaction.editReply(`✅ Retirado de Bóveda: $${amount.toLocaleString()}`);
            }

            else if (accion === 'ver') {
                if (!vault) {
                    return interaction.editReply('📭 Bóveda vacía\nUsa `/privacidad boveda depositar` para agregar fondos');
                }

                const lockTime = new Date(vault.locked_until);
                const locked = lockTime > new Date();

                return interaction.editReply(`🔒 **Bóveda de Emergencia**\nBalance: $${vault.amount.toLocaleString()}\nEstado: ${locked ? `Bloqueada hasta <t:${Math.floor(lockTime.getTime() / 1000)}:R>` : '🔓 Disponible'}`);
            }
        }

        else if (subCmd === 'offshore') {
            if (!privacyData || privacyData.level !== 'elite') {
                return interaction.editReply('❌ Requiere nivel **Elite**');
            }

            const nombre = interaction.options.getString('nombre');

            await supabase.from('privacy_accounts').update({ offshore_name: nombre }).eq('user_id', userId);

            return interaction.editReply(`✅ Nombre Offshore configurado: **${nombre}**\nTus transferencias ahora mostrarán este nombre`);
        }

        else if (subCmd === 'panico') {
            if (!privacyData || privacyData.level !== 'elite') {
                return interaction.editReply('❌ Requiere nivel **Elite**');
            }

            const pin = interaction.options.getString('pin');

            if (pin.length !== 6 || !/^\d+$/.test(pin)) {
                return interaction.editReply('❌ El PIN debe ser de 6 dígitos numéricos');
            }

            // Get current balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
            const totalCash = balance.cash || 0;
            const totalBank = balance.bank || 0;
            const total = totalCash + totalBank;

            if (total > 0) {
                // REMOVE money from user accounts
                if (totalCash > 0) await billingService.ubService.removeMoney(interaction.guildId, userId, totalCash, 'Modo Pánico', 'cash');
                if (totalBank > 0) await billingService.ubService.removeMoney(interaction.guildId, userId, totalBank, 'Modo Pánico', 'bank');

                // SAVE to vault with breakdown
                const { data: vault } = await supabase.from('privacy_vault').select('*').eq('user_id', userId).maybeSingle();

                const vaultData = {
                    user_id: userId,
                    amount: total,
                    cash_saved: totalCash,
                    bank_saved: totalBank,
                    locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                };

                if (vault) {
                    await supabase.from('privacy_vault').update(vaultData).eq('user_id', userId);
                } else {
                    await supabase.from('privacy_vault').insert(vaultData);
                }

                await supabase.from('privacy_accounts').update({ panic_pin: pin }).eq('user_id', userId);

                return interaction.editReply(`🚨 **MODO PÁNICO ACTIVADO**\n\n💵 Efectivo guardado: $${totalCash.toLocaleString()}\n🏦 Banco guardado: $${totalBank.toLocaleString()}\n✅ Total en bóveda: $${total.toLocaleString()}\n\n**Tus cuentas ahora muestran $0**\nPIN guardado: usa el mismo PIN para recuperar`);
            } else {
                return interaction.editReply('❌ No tienes fondos para transferir');
            }
        }

        else if (subCmd === 'trial') {
            if (privacyData && privacyData.trial_used) {
                return interaction.editReply('❌ Ya usaste tu prueba gratis de 3 días');
            }

            const { data: existingTrial } = await supabase.from('privacy_accounts').select('trial_used').eq('user_id', userId).maybeSingle();

            if (existingTrial?.trial_used) {
                return interaction.editReply('❌ Ya usaste tu prueba gratis');
            }

            const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

            await supabase.from('privacy_accounts').upsert({
                user_id: userId,
                level: 'basico',
                expires_at: expiresAt.toISOString(),
                trial_used: true,
                activated_at: new Date().toISOString()
            });

            return interaction.editReply(`🎁 **Prueba Gratis Activada!**\n🥉 Privacidad Básica por 3 días\nExpira: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`);
        }

        else if (subCmd === 'dashboard') {
            if (!privacyData) {
                return interaction.editReply('❌ No tienes privacidad activa');
            }

            const { data: vault } = await supabase.from('privacy_vault').select('amount').eq('user_id', userId).maybeSingle();
            const { data: alertsData } = await supabase.from('privacy_alerts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);

            const icons = { basico: '🥉', vip: '🥈', elite: '🥇' };
            const daysLeft = Math.ceil((new Date(privacyData.expires_at) - new Date()) / (1000 * 60 * 60 * 24));

            const embed = new EmbedBuilder()
                .setTitle('🕶️ Privacy Dashboard')
                .setColor('#2F3136')
                .addFields(
                    { name: '🎫 Nivel', value: `${icons[privacyData.level]} ${privacyData.level.toUpperCase()}`, inline: true },
                    { name: '⏰ Expira en', value: `${daysLeft} días`, inline: true },
                    { name: '🔒 Bóveda', value: vault ? `$${vault.amount.toLocaleString()}` : '$0', inline: true }
                );

            if (privacyData.offshore_name) {
                embed.addFields({ name: '🏝️ Offshore', value: privacyData.offshore_name, inline: true });
            }

            if (privacyData.auto_renew) {
                embed.addFields({ name: '♻️ Auto-Renovación', value: '✅ Activa', inline: true });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'recuperar') {
            if (!privacyData || privacyData.level !== 'elite') {
                return interaction.editReply('❌ Solo usuarios Elite pueden tener modo pánico');
            }

            const pin = interaction.options.getString('pin');

            if (privacyData.panic_pin !== pin) {
                return interaction.editReply('❌ PIN incorrecto');
            }

            const { data: vault } = await supabase.from('privacy_vault').select('*').eq('user_id', userId).maybeSingle();

            if (!vault || vault.amount <= 0) {
                return interaction.editReply('❌ No hay fondos en bóveda');
            }

            // RESTORE exactly what was saved
            const cashToRestore = vault.cash_saved || 0;
            const bankToRestore = vault.bank_saved || 0;

            // Add back the exact amounts
            if (cashToRestore > 0) {
                await billingService.ubService.addMoney(interaction.guildId, userId, cashToRestore, 'Recuperación Pánico', 'cash');
            }
            if (bankToRestore > 0) {
                await billingService.ubService.addMoney(interaction.guildId, userId, bankToRestore, 'Recuperación Pánico', 'bank');
            }

            // Clear vault and PIN
            await supabase.from('privacy_vault').update({
                amount: 0,
                cash_saved: 0,
                bank_saved: 0
            }).eq('user_id', userId);
            await supabase.from('privacy_accounts').update({ panic_pin: null }).eq('user_id', userId);

            return interaction.editReply(`🔓 **Modo Pánico Desactivado**\n\n💵 Efectivo restaurado: $${cashToRestore.toLocaleString()}\n🏦 Banco restaurado: $${bankToRestore.toLocaleString()}\n✅ Total recuperado: $${vault.amount.toLocaleString()}\n\n**Tus cuentas han sido restauradas exactamente como estaban**`);
        }

        else if (subCmd === 'alertas') {
            const estado = interaction.options.getString('estado');
            const enabled = estado === 'on';

            await supabase.from('privacy_accounts').upsert({ user_id: userId, alerts_enabled: enabled }, { onConflict: 'user_id' });

            return interaction.editReply(`🔔 Alertas ${enabled ? '✅ activadas' : '❌ desactivadas'}`);
        }

        else if (subCmd === 'autorenovar') {
            if (!privacyData) {
                return interaction.editReply('❌ Primero activa privacidad');
            }

            const estado = interaction.options.getString('estado');
            const enabled = estado === 'on';

            await supabase.from('privacy_accounts').update({ auto_renew: enabled }).eq('user_id', userId);

            return interaction.editReply(`♻️ Auto-renovación ${enabled ? '✅ activada' : '❌ desactivada'}\n${enabled ? 'Se renovará automáticamente cada mes' : 'Deberás renovar manualmente'}`);
        }

        else if (subCmd === 'viaje') {
            const horas = interaction.options.getInteger('horas');
            const costo = 5000 * (horas / 24);

            const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
            if ((balance.cash || 0) < costo) {
                return interaction.editReply(`❌ Fondos insuficientes\nCosto: $${costo.toLocaleString()}`);
            }

            await billingService.ubService.removeMoney(interaction.guildId, userId, costo, 'Modo Viaje', 'cash');

            const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000);

            await supabase.from('privacy_accounts').upsert({
                user_id: userId,
                level: 'basico',
                expires_at: expiresAt.toISOString(),
                activated_at: new Date().toISOString()
            });

            return interaction.editReply(`✈️ **Modo Viaje Activado**\n🥉 Privacidad Básica por ${horas}h\nCosto: $${costo.toLocaleString()}\nExpira: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`);
        }

        else if (subCmd === 'referir') {
            const targetUser = interaction.options.getUser('usuario');

            if (targetUser.id === userId) {
                return interaction.editReply('❌ No puedes referirte a ti mismo');
            }

            let referralCode = privacyData?.referral_code;
            if (!referralCode) {
                referralCode = `PRIV${userId.slice(-6)}`;
                await supabase.from('privacy_accounts').update({ referral_code: referralCode }).eq('user_id', userId);
            }

            const { data: existingRef } = await supabase.from('privacy_referrals').select('*').eq('referee_id', targetUser.id).maybeSingle();

            if (existingRef) {
                return interaction.editReply('❌ Este usuario ya fue referido');
            }

            await supabase.from('privacy_referrals').insert({ referrer_id: userId, referee_id: targetUser.id });

            try {
                await targetUser.send(`🎁 **¡${interaction.user.tag} te refirió al Sistema de Privacidad!**\n\nActiva privacidad con código: \`${referralCode}\`\n✅ Ambos recibirán 10% descuento`);
            } catch (e) { }

            return interaction.editReply(`✅ Referencia enviada a ${targetUser.tag}\nCódigo: \`${referralCode}\`\nAmbos recibirán 10% descuento al suscribirse`);
        }

        else if (subCmd === 'familia') {
            if (!privacyData || privacyData.level === 'basico') {
                return interaction.editReply('❌ Requiere nivel VIP o Elite');
            }

            const accion = interaction.options.getString('accion');

            if (accion === 'add') {
                const miembro = interaction.options.getUser('miembro');

                if (!miembro) {
                    return interaction.editReply('❌ Especifica un miembro');
                }

                const extraCost = privacyData.level === 'vip' ? 75000 : 250000;

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
                if ((balance.cash || 0) < extraCost) {
                    return interaction.editReply(`❌ Costo adicional: $${extraCost.toLocaleString()}`);
                }

                await billingService.ubService.removeMoney(interaction.guildId, userId, extraCost, 'Plan Familiar', 'cash');

                await supabase.from('privacy_family').insert({ owner_id: userId, member_id: miembro.id, status: 'active' });

                await supabase.from('privacy_accounts').upsert({
                    user_id: miembro.id,
                    level: privacyData.level,
                    expires_at: privacyData.expires_at,
                    activated_at: new Date().toISOString()
                });

                return interaction.editReply(`👨‍👩‍👧 **Familia Actualizada**\n✅ ${miembro.tag} agregado\nCosto: $${extraCost.toLocaleString()}\nNivel compartido: ${privacyData.level.toUpperCase()}`);
            }

            else if (accion === 'list') {
                const { data: family } = await supabase.from('privacy_family').select('member_id').eq('owner_id', userId).eq('status', 'active');

                if (!family || family.length === 0) {
                    return interaction.editReply('👨‍👩‍👧 No tienes miembros familiares');
                }

                const members = family.map(f => `<@${f.member_id}>`).join(', ');
                return interaction.editReply(`👨‍👩‍👧 **Tu Familia:**\n${members}\n\nTodos comparten tu nivel: ${privacyData.level.toUpperCase()}`);
            }

            else if (accion === 'remove') {
                const miembro = interaction.options.getUser('miembro');

                if (!miembro) {
                    return interaction.editReply('❌ Especifica un miembro a remover');
                }

                const { data: familyMember } = await supabase
                    .from('privacy_family')
                    .select('*')
                    .eq('owner_id', userId)
                    .eq('member_id', miembro.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!familyMember) {
                    return interaction.editReply('❌ Este usuario no está en tu familia');
                }

                // Remove member from family
                await supabase
                    .from('privacy_family')
                    .update({ status: 'inactive' })
                    .eq('owner_id', userId)
                    .eq('member_id', miembro.id);

                // Remove their privacy access
                await supabase
                    .from('privacy_accounts')
                    .delete()
                    .eq('user_id', miembro.id);

                return interaction.editReply(`👨‍👩‍👧 **Familia Actualizada**\n❌ ${miembro.tag} removido\nSu acceso a privacidad ha sido desactivado.`);
            }
        }

        else if (subCmd === 'score') {
            let score = 0;

            if (privacyData) {
                if (privacyData.level === 'basico') score += 20;
                else if (privacyData.level === 'vip') score += 50;
                else if (privacyData.level === 'elite') score += 80;

                const daysActive = Math.floor((new Date() - new Date(privacyData.activated_at)) / (1000 * 60 * 60 * 24));
                score += Math.min(daysActive, 15);

                const { data: vault } = await supabase.from('privacy_vault').select('amount').eq('user_id', userId).maybeSingle();
                if (vault && vault.amount > 0) score += 5;

                if (privacyData.verified) score += 10;
                if (privacyData.auto_renew) score += 5;
            }

            let rank = '📈 Principiante';
            if (score >= 80) rank = '🏆 Elite Master';
            else if (score >= 60) rank = '⭐ Experto';
            else if (score >= 40) rank = '🎯 Intermedio';

            const embed = new EmbedBuilder()
                .setTitle('📊 Privacy Score')
                .setColor('#2F3136')
                .setDescription(`Tu puntuación: **${score}/100**\nRango: ${rank}`)
                .addFields({ name: '💡 Cómo Mejorar', value: '• Mantén privacidad activa\n• Usa la bóveda\n• Activa auto-renovación\n• Completa verificación' });

            return interaction.editReply({ embeds: [embed] });
        }
    }



    // IMPORTANT: Only delegate if interaction was NOT handled above
    // This prevents duplicate processing causing "Unknown interaction" errors
    //     if (!interaction.replied && !interaction.deferred) {
    //         console.log(`[DEBUG] Delegating interaction ${interaction.customId || interaction.commandName} to handleExtraCommands`);
    // 
    //         await handleExtraCommands(interaction);
    //     }
    // ===== SESION VOTING SYSTEM =====
    else if (commandName === 'sesion') {
        await interaction.deferReply();
        const subCmd = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        const juntaDirectivaRoleId = '1412882245735420006';

        if (subCmd === 'crear') {
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(juntaDirectivaRoleId)) {
                return interaction.editReply('❌ Solo la Junta Directiva puede crear votaciones.');
            }

            const horario = interaction.options.getString('horario');
            const minimo = interaction.options.getInteger('minimo') || 4;
            const imagenUrl = interaction.options.getString('imagen') || 'https://cdn.discordapp.com/attachments/885232074083143741/1453225155634663575/standard1.gif';

            // Check if there's already an active session
            const { data: existingSession } = await supabase
                .from('session_votes')
                .select('*')
                .eq('status', 'active')
                .maybeSingle();

            if (existingSession) {
                return interaction.editReply('❌ Ya hay una votación activa. Usa `/sesion cancelar` primero.');
            }

            // Create session
            const scheduledTime = new Date();
            scheduledTime.setHours(scheduledTime.getHours() + 2); // Default 2 hours from now

            const { data: newSession, error } = await supabase
                .from('session_votes')
                .insert({
                    created_by: userId,
                    scheduled_time: scheduledTime.toISOString(),
                    minimum_votes: minimo,
                    image_url: imagenUrl
                })
                .select()
                .single();

            if (error || !newSession) {
                console.error('Error creating session:', error);
                return interaction.editReply('❌ Error creando la votación.');
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle('🗳️ Votacion De Rol')
                .setColor(0xFFD700)
                .setDescription('Vota si podrás participar en la sesión de hoy')
                .addFields(
                    { name: '⏰ Horario de Rol', value: horario, inline: true },
                    { name: '🎯 Votos Necesarios', value: `${minimo}`, inline: true },
                    { name: '\u200B', value: '\u200B' }, // Spacer
                    { name: '✅ Participar en la sesion', value: '0 votos', inline: false },
                    { name: '📋 asistire, pero con retraso', value: '0 votos', inline: false },
                    { name: '❌ No podre asistir', value: '0 votos', inline: false }
                )
                .setImage(imagenUrl)
                .setFooter({ text: `hoy a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` })
                .setTimestamp();

            // Create buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`vote_yes_${newSession.id}`)
                        .setEmoji('✅')
                        .setLabel('Participar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`vote_late_${newSession.id}`)
                        .setEmoji('📋')
                        .setLabel('Con retraso')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`vote_no_${newSession.id}`)
                        .setEmoji('❌')
                        .setLabel('No podré')
                        .setStyle(ButtonStyle.Danger)
                );

            // Post to designated channel with ping
            const targetChannelId = '1412963363545284680';
            const pingRoleId = '1412899401000685588';

            try {
                const targetChannel = await client.channels.fetch(targetChannelId);
                if (targetChannel) {
                    const msg = await targetChannel.send({
                        content: `<@&${pingRoleId}>`,
                        embeds: [embed],
                        components: [row]
                    });

                    // Update session with message ID
                    await supabase
                        .from('session_votes')
                        .update({
                            message_id: msg.id,
                            channel_id: targetChannelId
                        })
                        .eq('id', newSession.id);

                    await interaction.editReply(`✅ Votación creada en <#${targetChannelId}>`);

                    // Set up button collector on the channel message
                    const collector = msg.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 });



                    collector.on('collect', async i => {
                        if (!i.customId.startsWith('vote_')) return;

                        const sessionId = i.customId.split('_')[2];
                        const voteType = i.customId.split('_')[1]; // yes, late, no

                        // Update or insert vote
                        await supabase.from('vote_responses').upsert({
                            session_id: sessionId,
                            user_id: i.user.id,
                            vote_type: voteType
                        }, { onConflict: 'session_id,user_id' });

                        // Get updated vote counts
                        const { data: votes } = await supabase
                            .from('vote_responses')
                            .select('vote_type')
                            .eq('session_id', sessionId);

                        const yesCount = votes?.filter(v => v.vote_type === 'yes').length || 0;
                        const lateCount = votes?.filter(v => v.vote_type === 'late').length || 0;
                        const noCount = votes?.filter(v => v.vote_type === 'no').length || 0;

                        // Update embed
                        const updatedEmbed = EmbedBuilder.from(embed)
                            .setFields(
                                { name: '⏰ Horario de Rol', value: horario, inline: true },
                                { name: '🎯 Votos Necesarios', value: `${minimo}`, inline: true },
                                { name: '\u200B', value: '\u200B' },
                                { name: '✅ Participar en la sesion', value: `${yesCount} votos`, inline: false },
                                { name: '📋 asistire, pero con retraso', value: `${lateCount} votos`, inline: false },
                                { name: '❌ No podre asistir', value: `${noCount} votos`, inline: false }
                            );

                        // Check if minimum reached
                        if (yesCount >= minimo) {
                            const { data: session } = await supabase
                                .from('session_votes')
                                .select('status')
                                .eq('id', sessionId)
                                .single();

                            if (session && session.status === 'active') {
                                // Mark as opened
                                await supabase
                                    .from('session_votes')
                                    .update({ status: 'opened' })
                                    .eq('id', sessionId);

                                updatedEmbed
                                    .setColor(0x00FF00)
                                    .setTitle('✅ SESIÓN CONFIRMADA - SERVIDOR ABIERTO')
                                    .setImage('https://cdn.discordapp.com/attachments/885232074083143741/1453225155185737749/standard.gif');

                                // Notify voters
                                const { data: allVoters } = await supabase
                                    .from('vote_responses')
                                    .select('user_id')
                                    .eq('session_id', sessionId)
                                    .in('vote_type', ['yes', 'late']);

                                for (const voter of (allVoters || [])) {
                                    try {
                                        const user = await client.users.fetch(voter.user_id);
                                        await user.send(`🎮 **¡SERVIDOR ABIERTO!**\nSe alcanzó el mínimo de ${minimo} votos. ¡Hora de rolear!`);
                                    } catch (e) { }
                                }
                            }
                        }

                        await i.update({ embeds: [updatedEmbed], components: [row] });
                    });
                } else {
                    return interaction.editReply('❌ No se encontró el canal de votaciones.');
                }
            } catch (channelError) {
                console.error('Channel error:', channelError);
                return interaction.editReply('❌ Error al acceder al canal de votaciones.');
            }
        }

        else if (subCmd === 'cancelar') {
            const { data: session } = await supabase
                .from('session_votes')
                .select('*')
                .eq('status', 'active')
                .maybeSingle();

            if (!session) {
                return interaction.editReply('❌ No hay votación activa.');
            }

            // Check if user is JD
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(juntaDirectivaRoleId) && session.created_by !== userId) {
                return interaction.editReply('❌ Solo la Junta Directiva o el creador pueden cancelar la votación.');
            }

            await supabase
                .from('session_votes')
                .update({ status: 'cancelled' })
                .eq('id', session.id);

            return interaction.editReply('✅ Votación cancelada.');
        }

        else if (subCmd === 'forzar') {
            // Junta Directiva only
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(juntaDirectivaRoleId)) {
                return interaction.editReply('❌ Solo la Junta Directiva puede forzar la apertura.');
            }

            const { data: session } = await supabase
                .from('session_votes')
                .select('*')
                .eq('status', 'active')
                .maybeSingle();

            if (!session) {
                return interaction.editReply('❌ No hay votación activa.');
            }

            await supabase
                .from('session_votes')
                .update({ status: 'opened' })
                .eq('id', session.id);

            // Update the original voting message with OPEN embed
            let embedUpdated = false;
            try {
                if (!session.channel_id || !session.message_id) {
                    console.error('Missing channel_id or message_id:', session);
                    return interaction.editReply('❌ No se pudo encontrar el mensaje de votación original.');
                }

                const channel = await client.channels.fetch(session.channel_id);
                if (!channel) {
                    console.error('Channel not found:', session.channel_id);
                    return interaction.editReply('❌ No se encontró el canal de votaciones.');
                }

                const message = await channel.messages.fetch(session.message_id);
                if (!message) {
                    console.error('Message not found:', session.message_id);
                    return interaction.editReply('❌ No se encontró el mensaje de votación.');
                }

                const openEmbed = new EmbedBuilder()
                    .setTitle('✅ SESIÓN CONFIRMADA - SERVIDOR ABIERTO')
                    .setColor(0x00FF00)
                    .setDescription('🎮 **¡El servidor ha sido ABIERTO por la Junta Directiva!**\n\n¡Hora de rolear!')
                    .setImage('https://cdn.discordapp.com/attachments/885232074083143741/1453225155185737749/standard.gif')
                    .setFooter({ text: `Apertura forzada por ${interaction.user.tag}` })
                    .setTimestamp();

                await message.edit({ embeds: [openEmbed], components: [] });
                embedUpdated = true;
                console.log('Successfully updated voting embed for session:', session.id);
            } catch (updateError) {
                console.error('Error updating voting message:', updateError);
                return interaction.editReply(`❌ Error actualizando el embed: ${updateError.message}`);
            }

            // Notify all voters
            const { data: allVoters } = await supabase
                .from('vote_responses')
                .select('user_id')
                .eq('session_id', session.id)
                .in('vote_type', ['yes', 'late']);

            for (const voter of (allVoters || [])) {
                try {
                    const user = await client.users.fetch(voter.user_id);
                    await user.send(`🎮 **¡SERVIDOR ABIERTO (Forzado por Junta Directiva)!**\n¡Hora de rolear!`);
                } catch (e) { }
            }

            return interaction.editReply('✅ Servidor abierto forzadamente. Embed actualizado y participantes notificados.');
        }

        if (subCmd === 'cerrar') {
            // Junta Directiva only
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(juntaDirectivaRoleId)) {
                return interaction.editReply('❌ Solo la Junta Directiva puede cerrar el servidor.');
            }

            const razon = interaction.options.getString('razon') || 'Sesión finalizada';

            // Close any active/opened session in DB
            await supabase
                .from('session_votes')
                .update({ status: 'cancelled' })
                .in('status', ['active', 'opened']);

            // Clean up channel messages
            const targetChannelId = '1412963363545284680';
            try {
                const channel = await client.channels.fetch(targetChannelId);
                if (channel) {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    if (messages.size > 0) {
                        await channel.bulkDelete(messages, true).catch(err => console.log("Error deleting messages:", err.message));
                    }
                }
            } catch (cleanupError) {
                console.log("Channel cleanup warning:", cleanupError.message);
            }

            const embed = new EmbedBuilder()
                .setTitle('🔴 SERVIDOR CERRADO')
                .setColor(0xFF0000)
                .setImage('https://cdn.discordapp.com/attachments/885232074083143741/1453225156188049458/standard2.gif')
                .setDescription(`⚠️ **La sesión de rol ha finalizado.**\n\n📝 **Razón:** ${razon}\n\nGracias por participar en **Nación MX**. \n¡Esperamos verlos en la próxima sesión!`)
                .setFooter({ text: `Cerrado por ${interaction.user.tag}` })
                .setTimestamp();

            // Send to the designated channel
            try {
                const channel = await client.channels.fetch(targetChannelId);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                }
            } catch (sendError) {
                console.error('Error sending close embed:', sendError);
            }

            return interaction.editReply({ content: '✅ Servidor cerrado. Canal limpiado y anuncio enviado.', ephemeral: true });
        }

        if (subCmd === 'mantenimiento') {
            // Junta Directiva only
            const member = await interaction.guild.members.fetch(userId);
            if (!member.roles.cache.has(juntaDirectivaRoleId)) {
                return interaction.editReply('❌ Solo la Junta Directiva puede activar mantenimiento.');
            }

            const duracion = interaction.options.getString('duracion') || 'Indefinido';
            const razon = interaction.options.getString('razon') || 'Mejoras y optimización';

            const embed = new EmbedBuilder()
                .setTitle('🛠️ MANTENIMIENTO EN PROCESO')
                .setColor(0xFFA500)
                .setDescription(`⚠️ **El servidor se encuentra en mantenimiento.**\n\n⏳ **Duración estimada:** ${duracion}\n📝 **Motivo:** ${razon}`)
                .setFooter({ text: 'Por favor, no intenten entrar hasta nuevo aviso.' })
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });
            return interaction.editReply({ content: '✅ Anuncio de mantenimiento enviado.', ephemeral: true });
        }
    }
});

// Global Error Handlers to prevent crash
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Login to Discord with error handling
console.log('🔐 Attempting Discord login...');
console.log('Token present:', !!process.env.DISCORD_TOKEN);
console.log('Token length:', process.env.DISCORD_TOKEN?.length || 0);
console.log('Token starts with:', process.env.DISCORD_TOKEN?.substring(0, 20) || 'MISSING');
console.log('Token ends with:', process.env.DISCORD_TOKEN?.substring(process.env.DISCORD_TOKEN.length - 10) || 'MISSING');
console.log('Expected start: MTQ1MDcwMTYxNzY4NTk5');
console.log('Expected end: f0W9A');

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ CRITICAL: Discord login failed!');
    console.error('Error:', error);
    console.error('Error code:', error.code);
    console.error('Token:', process.env.DISCORD_TOKEN ? 'Present but invalid' : 'MISSING');
    process.exit(1);
});

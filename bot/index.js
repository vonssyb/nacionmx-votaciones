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
    { symbol: 'BTC', name: 'Bitcoin', base: 850000, current: 850000, type: 'Cripto', volatility: 0.03 },
    { symbol: 'ETH', name: 'Ethereum', base: 55000, current: 55000, type: 'Cripto', volatility: 0.04 },
    { symbol: 'SOL', name: 'Solana', base: 2800, current: 2800, type: 'Cripto', volatility: 0.05 },

    // Tech Companies (volatilidad media)
    { symbol: 'TSLA', name: 'Tesla Inc.', base: 4500, current: 4500, type: 'Empresa', volatility: 0.02 },
    { symbol: 'AMZN', name: 'Amazon', base: 3200, current: 3200, type: 'Empresa', volatility: 0.015 },
    { symbol: 'VNSSB', name: 'Vonssyb Studios', base: 2500, current: 2500, type: 'Empresa', volatility: 0.012 }, // 🎮 Premium tech

    // Mexican Companies (volatilidad baja, precios realistas)
    { symbol: 'PEMEX', name: 'Petróleos Mexicanos', base: 150, current: 150, type: 'Empresa', volatility: 0.02 },
    { symbol: 'WALMEX', name: 'Walmart México', base: 450, current: 450, type: 'Empresa', volatility: 0.015 },
    { symbol: 'FEMSA', name: 'FEMSA', base: 1200, current: 1200, type: 'Empresa', volatility: 0.01 },
    { symbol: 'NMX', name: 'Nación MX Corp', base: 500, current: 500, type: 'Empresa', volatility: 0.025 }
];

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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    const commands = [
        {
            name: 'ping',
            description: 'Comprueba si el bot está vivo'
        },
        {
            name: 'fichar',
            description: 'Inicia o Termina tu turno - Entrada/Salida',
            options: [
                {
                    name: 'vincular',
                    description: 'Vincular ciudadano al sistema - Solo Bancarios',
                    type: 1, // SUB_COMMAND
                    options: [
                        { name: 'usuario', description: 'Usuario de Discord a vincular', type: 6, required: true },
                        { name: 'nombre', description: 'Nombre y Apellido RP', type: 3, required: true },
                        { name: 'dni', description: 'Foto del DNI', type: 11, required: true }
                    ]
                }
            ]
        },
        {
            name: 'ayuda',
            description: 'Muestra los comandos bancarios disponibles - Cheat Sheet'
        },
        {
            name: 'estado',
            description: 'Cambia el estado del servidor - CMD Staff',
            options: [
                {
                    name: 'seleccion',
                    description: 'Nuevo estado del servidor',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🟢 Abierto', value: 'open' },
                        { name: '🟠 Mantenimiento', value: 'maintenance' },
                        { name: '🔴 Cerrado', value: 'closed' }
                    ]
                }
            ]
        },
        {
            name: 'registrar-tarjeta',
            description: 'Registrar nueva tarjeta - Staff Banco',
            options: [
                { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true },
                { name: 'nombre_titular', description: 'Nombre completo del titular RP', type: 3, required: true },
                {
                    name: 'tipo',
                    description: 'Nivel de la tarjeta',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '💳 NMX Débito ($100)', value: 'NMX Débito' },
                        { name: '💳 NMX Débito Plus ($500)', value: 'NMX Débito Plus' },
                        { name: '💳 NMX Débito Gold ($1k)', value: 'NMX Débito Gold' },
                        { name: '--- CRÉDITO ---', value: 'separator_credit' },
                        { name: '💳 NMX Start ($2k)', value: 'NMX Start' },
                        { name: '💳 NMX Básica ($4k)', value: 'NMX Básica' },
                        { name: '💳 NMX Plus ($6k)', value: 'NMX Plus' },
                        { name: '💳 NMX Plata ($10k)', value: 'NMX Plata' },
                        { name: '💳 NMX Oro ($15k)', value: 'NMX Oro' },
                        { name: '💳 NMX Rubí ($25k)', value: 'NMX Rubí' },
                        { name: '💳 NMX Black ($40k)', value: 'NMX Black' },
                        { name: '💳 NMX Diamante ($60k)', value: 'NMX Diamante' },
                        { name: '💳 NMX Zafiro ($100k)', value: 'NMX Zafiro' },
                        { name: '💳 NMX Platino Elite ($150k)', value: 'NMX Platino Elite' },
                        { name: '--- EMPRESARIAL ---', value: 'separator1' },
                        { name: '💳 NMX Business Start ($50k)', value: 'NMX Business Start' },
                        { name: '💳 NMX Business Gold ($100k)', value: 'NMX Business Gold' },
                        { name: '💳 NMX Business Platinum ($200k)', value: 'NMX Business Platinum' },
                        { name: '💳 NMX Business Elite ($500k)', value: 'NMX Business Elite' },
                        { name: '💳 NMX Corporate ($50k)', value: 'NMX Corporate' },
                        { name: '💳 NMX Corporate Plus ($100k)', value: 'NMX Corporate Plus' },
                        { name: '💳 NMX Enterprise ($200k)', value: 'NMX Enterprise' },
                        { name: '💳 NMX Conglomerate ($350k)', value: 'NMX Conglomerate' },
                        { name: '💳 NMX Supreme ($500k)', value: 'NMX Supreme' }
                    ]
                },
                { name: 'foto_dni', description: 'Foto del DNI/Identificación', type: 11, required: true },
                { name: 'notas', description: 'Notas opcionales', type: 3, required: false }
            ]
        },
        {
            name: 'tarjeta',
            description: 'Informacion sobre tarjetas disponibles - Catalogo',
            options: [
                {
                    name: 'info',
                    description: 'Ver el catalogo completo de tarjetas y sus beneficios',
                    type: 1
                },
                {
                    name: 'ver',
                    description: 'Ver detalles de una tarjeta especifica',
                    type: 1,
                    options: [
                        {
                            name: 'nombre',
                            description: 'Nombre de la tarjeta - Ej NMX Oro',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'NMX Start', value: 'NMX Start' },
                                { name: 'NMX Básica', value: 'NMX Básica' },
                                { name: 'NMX Plus', value: 'NMX Plus' },
                                { name: 'NMX Plata', value: 'NMX Plata' },
                                { name: 'NMX Oro', value: 'NMX Oro' },
                                { name: 'NMX Rubí', value: 'NMX Rubí' },
                                { name: 'NMX Black', value: 'NMX Black' },
                                { name: 'NMX Diamante', value: 'NMX Diamante' },
                                { name: 'NMX Zafiro', value: 'NMX Zafiro' },
                                { name: 'NMX Platino Elite', value: 'NMX Platino Elite' },
                                { name: '--- EMPRESARIAL ---', value: 'separator_business' },
                                { name: 'NMX Business Start', value: 'NMX Business Start' },
                                { name: 'NMX Business Gold', value: 'NMX Business Gold' },
                                { name: 'NMX Business Platinum', value: 'NMX Business Platinum' },
                                { name: 'NMX Business Elite', value: 'NMX Business Elite' },
                                { name: 'NMX Corporate', value: 'NMX Corporate' },
                                { name: 'NMX Corporate Plus', value: 'NMX Corporate Plus' },
                                { name: 'NMX Enterprise', value: 'NMX Enterprise' },
                                { name: 'NMX Conglomerate', value: 'NMX Conglomerate' },
                                { name: 'NMX Supreme', value: 'NMX Supreme' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'credito',
            description: 'Gestión de tu tarjeta de crédito NMX',
            options: [
                {
                    name: 'estado',
                    description: 'Ver tu deuda y estado actual',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'privado',
                            description: 'Ocultar respuesta - Visible solo para ti',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'pedir-prestamo',
                    description: 'Retira efectivo de tu tarjeta - Se suma a tu deuda',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'monto',
                            description: 'Cantidad a retirar',
                            type: 10, // NUMBER
                            required: true
                        },
                        {
                            name: 'privado',
                            description: 'Ocultar respuesta - Visible solo para ti',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'pagar',
                    description: 'Abona dinero a tu tarjeta de crédito',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'monto',
                            description: 'Cantidad a pagar',
                            type: 10, // NUMBER
                            required: true
                        },
                        {
                            name: 'privado',
                            description: 'Ocultar respuesta - Visible solo para ti',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'buro',
                    description: 'Ver tu Score de Buró Financiero',
                    type: 1
                },
                {
                    name: 'info',
                    description: 'Ver detalles del plástico - Titular Nivel Fecha',
                    type: 1
                },
                {
                    name: 'admin',
                    description: 'Herramientas Administrativas - Staff',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
                        {
                            name: 'puntos',
                            description: 'Modificar Score de Buró - Staff',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario afectado', type: 6, required: true },
                                { name: 'cantidad', description: 'Puntos a sumar o restar con signo -', type: 4, required: true },
                                { name: 'razon', description: 'Motivo del ajuste', type: 3, required: true }
                            ]
                        },
                        {
                            name: 'perdonar',
                            description: 'Perdonar la deuda de un usuario',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'congelar',
                            description: 'Congelar una tarjeta - No podrá usarse',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'descongelar',
                            description: 'Reactivar una tarjeta congelada',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'info',
                            description: 'Ver información completa de un usuario',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'historial',
                            description: 'Ver historial financiero completo y análisis de crédito',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a analizar', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'ofrecer-upgrade',
                            description: 'Enviar oferta de mejora de tarjeta por DM - Requiere buen Score',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Cliente a evaluar', type: 6, required: true }
                            ]
                        }
                    ]
                },
                {
                    name: 'debug',
                    description: 'Diagnóstico de cuenta - Usar si fallan comandos',
                    type: 1
                }
            ]
        },
        {
            name: 'rol',
            description: 'Gestión de Roles y Sanciones',
            options: [
                {
                    name: 'cancelar',
                    description: 'Reportar cancelación de rol de un usuario',
                    type: 1,
                    options: [
                        { name: 'usuario', description: 'Usuario sancionado - Nombre o ID', type: 3, required: true },
                        { name: 'razon', description: 'Motivo de la cancelación', type: 3, required: true },
                        { name: 'ubicacion', description: 'Lugar de los fatti/arresto', type: 3, required: true },
                        { name: 'prueba1', description: 'Evidencia principal - Imagen', type: 11, required: true },
                        { name: 'prueba2', description: 'Evidencia secundaria - Imagen', type: 11 }
                    ]
                }
            ]
        },

        {
            name: 'multa',
            description: 'Imponer una multa a un ciudadano - Policía',
            options: [
                { name: 'usuario', description: 'Ciudadano a multar', type: 6, required: true },
                { name: 'monto', description: 'Monto de la multa', type: 10, required: true },
                { name: 'razon', description: 'Motivo de la infracción', type: 3, required: true }
            ]
        },
        {
            name: 'depositar',
            description: 'Depositar efectivo a la cuenta de otro ciudadano (OXXO)',
            options: [
                { name: 'destinatario', description: 'Ciudadano a depositar', type: 6, required: true },
                { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true },
                { name: 'razon', description: 'Concepto del depósito', type: 3, required: false }
            ]
        },
        {
            name: 'giro',
            description: 'Envío de dinero por paquetería (Tarda 24 horas)',
            options: [
                { name: 'destinatario', description: 'Ciudadano a enviar', type: 6, required: true },
                { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
            ]
        },
        {
            name: 'movimientos',
            description: 'Ver historial de tus últimas transacciones',
            type: 1
        },
        {
            name: 'notificaciones',
            description: 'Activar/Desactivar notificaciones del banco por DM',
            options: [
                { name: 'activo', description: '¿Recibir notificaciones?', type: 5, required: true }
            ]
        },
        {
            name: 'top-morosos',
            description: 'Ranking de usuarios con mayor deuda en tarjetas',
            type: 1
        },
        {
            name: 'top-ricos',
            description: 'Ranking de usuarios con mejor Score Crediticio',
            type: 1
        },
        {
            name: 'inversion',
            description: 'Sistema de Inversión a Plazo Fijo',
            options: [
                {
                    name: 'nueva',
                    description: 'Abrir una nueva inversión - 7 días con 5% rendimiento',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad a bloquear', type: 10, required: true }
                    ]
                },
                {
                    name: 'estado',
                    description: 'Ver mis inversiones activas y retirar ganancias',
                    type: 1
                }
            ]
        },
        {
            name: 'impuestos',
            description: 'Consulta tu estado fiscal con el SAT',
            type: 1
        },
        {
            name: 'empresa',
            description: '🏢 Gestión de empresas y negocios',
            options: [
                {
                    name: 'crear',
                    description: 'Registrar una nueva empresa ($250k trámite + local + vehículos)',
                    type: 1,
                    options: [
                        { name: 'nombre', description: 'Nombre legal de la empresa (único)', type: 3, required: true },
                        { name: 'dueño', description: 'Dueño y responsable legal', type: 6, required: true },
                        {
                            name: 'tipo_local',
                            description: 'Tamaño del local/propiedad',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Pequeño ($850k)', value: 'pequeño' },
                                { name: 'Mediano ($1.75M)', value: 'mediano' },
                                { name: 'Grande ($3.2M)', value: 'grande' },
                                { name: 'Gigante ($5M)', value: 'gigante' }
                            ]
                        },
                        { name: 'logo', description: 'Logo de la empresa', type: 11, required: true },
                        { name: 'foto_local', description: 'Foto del local/establecimiento (Opcional)', type: 11, required: false },
                        { name: 'ubicacion', description: 'Ubicación RP del negocio', type: 3, required: false },
                        { name: 'co_dueño', description: 'Co-Dueño (Máx. 1)', type: 6, required: false },
                        {
                            name: 'es_privada',
                            description: '¿Es empresa privada? (Sí = más impuestos)',
                            type: 5,
                            required: false
                        },
                        {
                            name: 'vehiculo_1',
                            description: 'Primer vehículo (opcional)',
                            type: 3,
                            required: false,
                            choices: [
                                { name: 'Ejecutiva Ligera ($420k)', value: 'ejecutiva_ligera' },
                                { name: 'Operativa de Servicio ($550k)', value: 'operativa_servicio' },
                                { name: 'Carga Pesada ($850k)', value: 'carga_pesada' },
                                { name: 'Ejecutiva Premium ($1.2M)', value: 'ejecutiva_premium' },
                                { name: 'Asistencia Industrial ($1.5M)', value: 'asistencia_industrial' }
                            ]
                        },
                        {
                            name: 'vehiculo_2',
                            description: 'Segundo vehículo (opcional)',
                            type: 3,
                            required: false,
                            choices: [
                                { name: 'Ejecutiva Ligera ($420k)', value: 'ejecutiva_ligera' },
                                { name: 'Operativa de Servicio ($550k)', value: 'operativa_servicio' },
                                { name: 'Carga Pesada ($850k)', value: 'carga_pesada' },
                                { name: 'Ejecutiva Premium ($1.2M)', value: 'ejecutiva_premium' },
                                { name: 'Asistencia Industrial ($1.5M)', value: 'asistencia_industrial' }
                            ]
                        },
                        {
                            name: 'vehiculo_3',
                            description: 'Tercer vehículo (opcional)',
                            type: 3,
                            required: false,
                            choices: [
                                { name: 'Ejecutiva Ligera ($420k)', value: 'ejecutiva_ligera' },
                                { name: 'Operativa de Servicio ($550k)', value: 'operativa_servicio' },
                                { name: 'Carga Pesada ($850k)', value: 'carga_pesada' },
                                { name: 'Ejecutiva Premium ($1.2M)', value: 'ejecutiva_premium' },
                                { name: 'Asistencia Industrial ($1.5M)', value: 'asistencia_industrial' }
                            ]
                        }
                    ]
                },
                {
                    name: 'menu',
                    description: 'Panel de gestión de tu empresa',
                    type: 1
                },
                {
                    name: 'cobrar',
                    description: 'Generar cobro para clientes (Terminal POS)',
                    type: 1,
                    options: [
                        { name: 'cliente', description: 'Cliente a cobrar', type: 6, required: true },
                        { name: 'monto', description: 'Monto a cobrar', type: 10, required: true },
                        { name: 'razon', description: 'Concepto del cobro', type: 3, required: true }
                    ]
                },
                {
                    name: 'credito',
                    description: 'Solicitar crédito empresarial',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad a solicitar', type: 10, required: true },
                        { name: 'razon', description: 'Uso del crédito', type: 3, required: false }
                    ]
                },
                {
                    name: 'credito-pagar',
                    description: 'Pagar deuda de tarjeta empresarial',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad a pagar', type: 10, required: true }
                    ]
                },
                {
                    name: 'credito-info',
                    description: 'Ver estado de crédito empresarial',
                    type: 1
                },
                {
                    name: 'listar-usuario',
                    description: '👮 Ver empresas de un usuario (STAFF ONLY)',
                    type: 1,
                    options: [
                        { name: 'usuario', description: 'Usuario a investigar', type: 6, required: true }
                    ]
                }
            ]
        },
        {
            name: 'nomina',
            description: 'Gestión de Nóminas para Empresas',
            options: [
                {
                    name: 'crear',
                    description: 'Crear un nuevo grupo de pago',
                    type: 1,
                    options: [{ name: 'nombre', description: 'Nombre del grupo como Taller', type: 3, required: true }]
                },
                {
                    name: 'agregar',
                    description: 'Agregar empleado al grupo',
                    type: 1,
                    options: [
                        { name: 'grupo', description: 'Nombre del grupo', type: 3, required: true },
                        { name: 'empleado', description: 'Usuario a pagar', type: 6, required: true },
                        { name: 'sueldo', description: 'Monto a pagar', type: 10, required: true }
                    ]
                },
                {
                    name: 'pagar',
                    description: 'Pagar a todos los empleados del grupo',
                    type: 1,
                    options: [{ name: 'grupo', description: 'Nombre del grupo', type: 3, required: true }]
                }
            ]
        },
        {
            name: 'bolsa',
            description: 'Sistema de Bolsa de Valores y Criptomonedas',
            options: [
                {
                    name: 'precios',
                    description: 'Ver precios actuales del mercado',
                    type: 1
                },
                {
                    name: 'comprar',
                    description: 'Comprar acciones o criptomonedas',
                    type: 1,
                    options: [
                        { name: 'symbol', description: 'Simbolo de la accion - BTC, ETH, TSLA, etc', type: 3, required: true },
                        { name: 'cantidad', description: 'Numero de acciones a comprar', type: 10, required: true }
                    ]
                },
                {
                    name: 'vender',
                    description: 'Vender acciones o criptomonedas',
                    type: 1,
                    options: [
                        { name: 'symbol', description: 'Simbolo de la accion - BTC, ETH, TSLA, etc', type: 3, required: true },
                        { name: 'cantidad', description: 'Numero de acciones a vender', type: 10, required: true }
                    ]
                },
                {
                    name: 'portafolio',
                    description: 'Ver tus inversiones actuales',
                    type: 1
                },
                {
                    name: 'historial',
                    description: 'Ver tus ultimas transacciones',
                    type: 1
                }
            ]
        },
        {
            name: 'balanza',
            description: 'Ver tu balanza financiera completa'
        },
        {
            name: 'debito',
            description: 'Gestion de Tarjeta de Debito',
            options: [
                { name: 'estado', description: 'Ver balance debito', type: 1 },
                {
                    name: 'transferir',
                    description: 'Transferir debito a debito - Tarda 5 minutos',
                    type: 1,
                    options: [
                        { name: 'destinatario', description: 'Usuario', type: 6, required: true },
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                {
                    name: 'depositar',
                    description: 'Depositar efectivo en tu cuenta bancaria',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                {
                    name: 'retirar',
                    description: 'Retirar dinero del banco a efectivo',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                {
                    name: 'mejorar',
                    description: 'Ofrecer mejora de tarjeta de débito (Ejecutivos)',
                    type: 1,
                    options: [
                        { name: 'usuario', description: 'Cliente a ofrecer mejora', type: 6, required: true }
                    ]
                },
                { name: 'historial', description: 'Ver transacciones', type: 1 },
                { name: 'info', description: 'Ver información completa de tu tarjeta de débito', type: 1 },
                {
                    name: 'admin',
                    description: '👨‍💼 Comandos para ejecutivos bancarios',
                    type: 2,
                    options: [
                        {
                            name: 'info',
                            description: 'Ver info completa de tarjeta de un usuario',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a consultar', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'historial',
                            description: 'Ver historial de transacciones de débito',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a consultar', type: 6, required: true }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'casino',
            description: '🎰 Sistema de Casino Nación MX',
            options: [
                {
                    name: 'fichas',
                    description: 'Comprar o retirar fichas del casino',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
                        {
                            name: 'comprar',
                            description: 'Comprar fichas con tu dinero',
                            type: 1,
                            options: [
                                { name: 'cantidad', description: 'Cantidad de fichas (mín: 10)', type: 4, required: true, min_value: 10, max_value: 10000 }
                            ]
                        },
                        {
                            name: 'retirar',
                            description: 'Convertir fichas a dinero',
                            type: 1,
                            options: [
                                { name: 'cantidad', description: 'Cantidad de fichas a retirar', type: 4, required: true, min_value: 1 }
                            ]
                        }
                    ]
                },
                { name: 'saldo', description: 'Ver tus fichas y estadísticas', type: 1 },
                { name: 'info', description: '📖 Guía completa del casino (juegos, reglas, premios)', type: 1 },
                {
                    name: 'historial',
                    description: 'Ver tus últimas jugadas',
                    type: 1,
                    options: [
                        { name: 'juego', description: 'Filtrar por juego específico', type: 3, required: false }
                    ]
                },
                {
                    name: 'ranking',
                    description: 'Ver top ganadores del casino',
                    type: 1,
                    options: [
                        {
                            name: 'tipo',
                            description: 'Tipo de ranking',
                            type: 3,
                            required: false,
                            choices: [
                                { name: 'Más Fichas', value: 'chips' },
                                { name: 'Más Ganancias', value: 'profit' },
                                { name: 'Más Juegos', value: 'games' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'jugar',
            description: '🎮 Jugar a los juegos del casino',
            options: [
                // Slots
                {
                    name: 'slots',
                    description: '🎰 Tragamonedas de 3 rodillos',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar (mín: 10)', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Dice
                {
                    name: 'dice',
                    description: '🎲 Tira un dado y apuesta alto/bajo',
                    type: 1,
                    options: [
                        {
                            name: 'direccion',
                            description: 'Over (arriba) o Under (abajo)',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Over (Mayor que)', value: 'over' },
                                { name: 'Under (Menor que)', value: 'under' }
                            ]
                        },
                        { name: 'numero', description: 'Número 1-99', type: 4, required: true, min_value: 1, max_value: 99 },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 1 }
                    ]
                },
                // Blackjack
                {
                    name: 'blackjack',
                    description: '🃏 Clásico 21 contra la casa',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Ruleta
                {
                    name: 'ruleta',
                    description: '🎡 Ruleta europea',
                    type: 1,
                    options: [
                        {
                            name: 'tipo',
                            description: 'Tipo de apuesta',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Rojo', value: 'red' },
                                { name: 'Negro', value: 'black' },
                                { name: 'Par', value: 'even' },
                                { name: 'Impar', value: 'odd' },
                                { name: 'Número Exacto', value: 'number' }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 1 },
                        { name: 'numero', description: 'Si elegiste número exacto (0-36)', type: 4, required: false, min_value: 0, max_value: 36 }
                    ]
                },
                // Caballos
                {
                    name: 'caballos',
                    description: '🐴 Carrera de caballos',
                    type: 1,
                    options: [
                        {
                            name: 'caballo',
                            description: 'Elige tu caballo',
                            type: 4,
                            required: true,
                            choices: [
                                { name: '🐴 Caballo 1', value: 1 },
                                { name: '🐴 Caballo 2', value: 2 },
                                { name: '🐴 Caballo 3', value: 3 },
                                { name: '🐴 Caballo 4', value: 4 },
                                { name: '🐴 Caballo 5', value: 5 },
                                { name: '🐴 Caballo 6', value: 6 }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Crash
                {
                    name: 'crash',
                    description: '📉 Retira antes del crash - Multiplicador sube',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 },
                        { name: 'retiro', description: 'Multiplicador de retiro automático (Ej: 2.5)', type: 10, required: true, min_value: 1.01 }
                    ]
                },
                // Gallos
                {
                    name: 'gallos',
                    description: '🐓 Pelea de gallos',
                    type: 1,
                    options: [
                        {
                            name: 'gallo',
                            description: 'Elige tu gallo',
                            type: 3,
                            required: true,
                            choices: [
                                { name: '🔴 Gallo Rojo', value: 'red' },
                                { name: '🔵 Gallo Azul', value: 'blue' }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Ruleta Rusa
                {
                    name: 'ruleta-rusa',
                    description: '💀 ALTO RIESGO - Si pierdes, ban temporal',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar (máx: 100)', type: 4, required: true, min_value: 10, max_value: 100 }
                    ]
                }
            ]
        },
        {
            name: 'dar-robo',
            description: '💰 [Staff] Distribuir dinero de robo (25% en efectivo)',
            options: [
                {
                    name: 'usuario',
                    description: 'Usuario que recibirá el dinero',
                    type: 6,
                    required: true
                },
                {
                    name: 'monto',
                    description: 'Monto total del robo',
                    type: 4,
                    required: true,
                    min_value: 1
                }
            ]
        },
        // === NEW ECONOMY COMMANDS ===
        {
            name: 'stake',
            description: '🔒 Staking de crypto para ingresos pasivos',
            options: [
                {
                    name: 'depositar',
                    description: 'Stakear crypto por un período fijo',
                    type: 1,
                    options: [
                        { name: 'crypto', description: 'BTC, ETH o SOL', type: 3, required: true },
                        { name: 'cantidad', description: 'Cantidad a stakear', type: 10, required: true },
                        { name: 'dias', description: '7, 30 o 90 días', type: 4, required: true }
                    ]
                },
                {
                    name: 'mis-stakes',
                    description: 'Ver tus stakes activos',
                    type: 1
                },
                {
                    name: 'retirar',
                    description: 'Retirar un stake desbloqueado',
                    type: 1,
                    options: [
                        { name: 'id', description: 'ID del stake (primeros 8 caracteres)', type: 3, required: true }
                    ]
                }
            ]
        },
        {
            name: 'slots',
            description: '🎰 Tragamonedas con jackpot progresivo',
            options: [
                { name: 'apuesta', description: 'Cantidad a apostar (mín $100)', type: 4, required: true, min_value: 100 }
            ]
        },
        {
            name: 'fondos',
            description: '💼 Fondos de inversión - Set & Forget',
            options: [
                {
                    name: 'ver',
                    description: 'Ver fondos disponibles',
                    type: 1
                },
                {
                    name: 'invertir',
                    description: 'Invertir en un fondo',
                    type: 1,
                    options: [
                        { name: 'fondo', description: 'Conservador, Balanceado o Agresivo', type: 3, required: true },
                        { name: 'monto', description: 'Cantidad a invertir', type: 4, required: true }
                    ]
                },
                {
                    name: 'mis-fondos',
                    description: 'Ver mis inversiones',
                    type: 1
                }
            ]
        }
    ];

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
    // subscribeToNewCards(); // TODO: Implement this function or remove if not needed
    // subscribeToCancellations(); // TODO: Implement this function or remove if not needed
});

// Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    console.log(`[DEBUG] RAW INTERACTION: ${interaction.isCommand() ? 'CMD' : 'BTN/OTHER'} ${interaction.commandName || interaction.customId}`);
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
        try {
            await interaction.deferUpdate(); // Acknowledge button click immediately
        } catch (err) {
            console.error('[ERROR] Failed to defer btn_udp_upgrade:', err);
            return;
        }


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

        console.log('[DEBUG] Upgrade - Card lookup:', { cardId, found: !!card, error: cardError, balance: card?.balance });

        if (cardError || !card) {
            return interaction.reply({
                content: `❌ Tarjeta no encontrada.\nID buscado: ${cardId}\nError: ${cardError?.message || 'Unknown'}`,
                ephemeral: true
            });
        }

        const tierInfo = CARD_TIERS[targetTier];

        console.log('[DEBUG] Upgrade - Tier info:', { targetTier, cost: tierInfo.cost, userBalance: card.balance });

        // Check balance
        if (card.balance < tierInfo.cost) {
            return interaction.reply({
                content: `❌ **Fondos insuficientes**\n\nCosto: **$${tierInfo.cost.toLocaleString()}**\nTu saldo: **$${card.balance.toLocaleString()}**\nTarjeta: ${card.card_tier}\nID: ${cardId.slice(0, 8)}...`,
                ephemeral: true
            });
        }

        // Deduct cost and update card
        const newBalance = card.balance - tierInfo.cost;

        const { error: updateError } = await supabase
            .from('debit_cards')
            .update({
                card_tier: targetTier,
                balance: newBalance,
                max_balance: tierInfo.max_balance
            })
            .eq('id', cardId);

        if (updateError) {
            console.error('[upgrade] Error:', updateError);
            return interaction.reply({ content: '❌ Error al procesar la mejora.', ephemeral: true });
        }

        // Success - disable buttons and show result
        await interaction.update({ components: [] });

        await interaction.followUp({
            content: `✅ **¡Mejora Completada!**\n\n🎉 Nueva tarjeta: **${targetTier}**\n💰 Costo: $${tierInfo.cost.toLocaleString()}\n💳 Nuevo saldo: $${newBalance.toLocaleString()}\n📊 Límite: ${tierInfo.max_balance === Infinity ? '♾️ Ilimitado' : '$' + tierInfo.max_balance.toLocaleString()}`,
            ephemeral: false
        });
    }

    // EMPRESA COBRAR - Payment Buttons
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

    else if (commandName === 'estado') {
        await interaction.deferReply({ ephemeral: false }); // Defer first to prevent timeout

        // IDs Provided by User
        const TARGET_CHANNEL_ID = '1412963363545284680';
        const PING_ROLE_ID = '1412899401000685588';
        const action = interaction.options.getString('seleccion');

        try {
            const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
            if (!channel) return interaction.editReply('❌ No encontré el canal de estado.');

            // 1. Clear Channel Messages (Clean Slate)
            try {
                // Fetch last 100 messages and delete them
                const messages = await channel.messages.fetch({ limit: 100 });
                if (messages.size > 0) {
                    await channel.bulkDelete(messages, true).catch(err => console.log("Error deleting old messages:", err.message));
                }
            } catch (cleanupError) {
                console.log("Cleanup warning:", cleanupError.message);
            }

            let newName = channel.name;
            let embed = null;
            let msgContent = '';

            const robloxButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🎮 Unirme a NACIÓN MX')
                    .setURL('https://www.roblox.com/games/start?launchData=%7B%22psCode%22%3A%22NACIONMX%22%7D&placeId=2534724415')
                    .setStyle(ButtonStyle.Link)
            );

            if (action === 'open') {
                newName = '🟢・servidor-on';
                msgContent = `<@&${PING_ROLE_ID}>`;
                embed = new EmbedBuilder()
                    .setTitle('✅ NACIÓN MX ABIERTO')
                    .setDescription('¡El servidor se encuentra **ONLINE**! \n\nConéctate ahora y disfruta del mejor Roleplay de México. 🇲🇽✨')
                    .setColor(0x00FF00) // Green
                    .setThumbnail(client.user.displayAvatarURL())
                    .setTimestamp();
            } else if (action === 'maintenance') {
                newName = '🟠・mantenimiento';
                embed = new EmbedBuilder()
                    .setTitle('🛠️ EN MANTENIMIENTO')
                    .setDescription('Estamos aplicando mejoras y actualizaciones.\nPor favor espera, el servidor volverá pronto.')
                    .setColor(0xFFA500) // Orange
                    .setTimestamp();
            } else if (action === 'closed') {
                newName = '🔴・servidor-off';
                embed = new EmbedBuilder()
                    .setTitle('⛔ SERVIDOR CERRADO')
                    .setDescription('El servidor ha cerrado sus puertas por hoy.\n¡Nos vemos mañana!')
                    .setColor(0xFF0000) // Red
                    .setTimestamp();
            }

            // 2. Rename Channel
            await channel.setName(newName);

            // 3. Send Message
            // Open: Ping + Embed + Button
            if (action === 'open') {
                await channel.send({ content: msgContent, embeds: [embed], components: [robloxButton] });
            } else {
                // Others: Just Embed + Button (Button is always useful for "Try to join later" context, or we can omit it if closed. User asked "pon un boton", assuming for all or mainly Open. I'll add to all for consistency)
                await channel.send({ embeds: [embed], components: [robloxButton] });
            }

            await interaction.editReply(`✅ Estado actualizado a: **${action.toUpperCase()}**\nLimpieza de chat realizada.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hubo un error actualizando el estado. Revisa permisos del Bot (Manage Messages/Channels).');
        }
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
        try {
            await interaction.deferReply({ ephemeral: false });

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
                    await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago Tarjeta ${userCard.card_type}`);

                } catch (ubError) {
                    console.error("UB Payment Error:", ubError);
                    return interaction.editReply({ content: `❌ Error verificando fondos o procesando cobro: ${ubError.message}`, ephemeral: isPrivate });
                }

                // 4. Update DB
                const newDebt = userCard.current_balance - amount;
                const { error: dbError } = await supabase
                    .from('credit_cards')
                    .update({ current_balance: newDebt, last_payment_date: new Date().toISOString() })
                    .eq('id', userCard.id);

                if (dbError) {
                    console.error(dbError);
                    return interaction.editReply({ content: '❌ Pago recibido en efectivo, pero error al actualizar BD. Contacta a Staff.', ephemeral: isPrivate });
                }

                await interaction.editReply({ content: `✅ **Pago Exitoso**. \nHas pagado **$${amount.toLocaleString()}**.\nTu deuda restante es: **$${newDebt.toLocaleString()}**.`, ephemeral: isPrivate });

            } catch (err) {
                console.error("Payment Critical Error:", err);
                await interaction.editReply({ content: `❌ Error procesando el pago: ${err.message}`, ephemeral: isPrivate });
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

    else if (commandName === 'rol') {
        const subCmd = interaction.options.getSubcommand();
        if (subCmd === 'cancelar') {
            await interaction.deferReply({ ephemeral: false });

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

            await interaction.editReply('✅ Reporte de cancelación enviado exitosamente. Se publicará en breve.');
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
        const subCmd = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: false });

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
        await interaction.reply({ content: 'Esta función estará disponible pronto.', ephemeral: false });
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


    else if (commandName === 'licencia') {
        const subcommand = interaction.options.getSubcommand();

        // Staff-only check
        const STAFF_ROLE_ID = '1450688555503587459';
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ Solo el staff puede gestionar licencias.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const tipo = interaction.options.getString('tipo');

        const licenseData = {
            'conducir': { name: 'Licencia de Conducir', cost: 1200, emoji: '🚗' },
            'armas_largas': { name: 'Licencia de Armas Largas', cost: 1500, emoji: '🔫' },
            'armas_cortas': { name: 'Licencia de Armas Cortas', cost: 1200, emoji: '🔫' }
        };

        if (subcommand === 'registrar') {
            await interaction.deferReply({ flags: 64 });

            try {
                const license = licenseData[tipo];

                // Check if already has this license FIRST
                const { data: existing } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .eq('license_type', tipo)
                    .eq('status', 'active');

                if (existing && existing.length > 0) {
                    return interaction.editReply(`⚠️ <@${targetUser.id}> ya tiene esta licencia activa.`);
                }

                // Use universal payment system
                const paymentResult = await requestPaymentMethod(
                    interaction,
                    targetUser.id,
                    license.cost,
                    `${license.emoji} ${license.name}`
                );

                if (!paymentResult.success) {
                    return interaction.editReply(paymentResult.error);
                }

                // Register license
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 14); // 2 weeks validity

                await supabase
                    .from('licenses')
                    .insert({
                        discord_user_id: targetUser.id,
                        license_type: tipo,
                        license_name: license.name,
                        issued_by: interaction.user.id,
                        issued_at: new Date().toISOString(),
                        expires_at: expiryDate.toISOString(),
                        status: 'active'
                    });

                const paymentMethodLabel = paymentResult.method === 'cash' ? '💵 Efectivo' : paymentResult.method === 'bank' ? '🏦 Banco/Débito' : '💳 Crédito';

                const embed = new EmbedBuilder()
                    .setTitle(`${license.emoji} Licencia Registrada`)
                    .setColor(0x00FF00)
                    .setDescription(`**${license.name}** otorgada exitosamente`)
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                        { name: '💵 Costo', value: `$${license.cost.toLocaleString()}`, inline: true },
                        { name: '💳 Método de Pago', value: paymentMethodLabel, inline: true },
                        { name: '📅 Válida hasta', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:D>`, inline: false },
                        { name: '👮 Emitida por', value: interaction.user.tag, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Licencias Nación MX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], components: [] });

                // Send receipt to citizen
                try {
                    await targetUser.send({
                        content: `📜 **Nueva licencia registrada**`,
                        embeds: [embed]
                    });
                } catch (dmError) {
                    console.log('Could not DM citizen:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error registrando licencia.');
            }
        }

        else if (subcommand === 'revocar') {
            await interaction.deferReply({ flags: 64 });

            const razon = interaction.options.getString('razon');

            try {
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .eq('license_type', tipo)
                    .eq('status', 'active');

                if (!licenses || licenses.length === 0) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no tiene esta licencia activa.`);
                }

                // Revoke license
                await supabase
                    .from('licenses')
                    .update({
                        status: 'revoked',
                        revoked_by: interaction.user.id,
                        revoked_at: new Date().toISOString(),
                        revoke_reason: razon
                    })
                    .eq('id', licenses[0].id);

                const license = licenseData[tipo];

                const embed = new EmbedBuilder()
                    .setTitle(`${license.emoji} Licencia Revocada`)
                    .setColor(0xFF0000)
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                        { name: '📜 Licencia', value: license.name, inline: true },
                        { name: '📝 Razón', value: razon, inline: false },
                        { name: '👮 Revocada por', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Notify citizen
                try {
                    await targetUser.send({
                        content: `⚠️ **Licencia Revocada**`,
                        embeds: [embed]
                    });
                } catch (dmError) {
                    console.log('Could not DM citizen:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error revocando licencia.');
            }
        }

        else if (subcommand === 'ver') {
            await interaction.deferReply({ flags: 64 });

            try {
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .order('issued_at', { ascending: false });

                if (!licenses || licenses.length === 0) {
                    return interaction.editReply(`📋 <@${targetUser.id}> no tiene licencias registradas.`);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Licencias de ${targetUser.tag}`)
                    .setColor(0x5865F2)
                    .setThumbnail(targetUser.displayAvatarURL());

                const active = licenses.filter(l => l.status === 'active');
                const revoked = licenses.filter(l => l.status === 'revoked');
                const expired = licenses.filter(l => l.status === 'expired');

                if (active.length > 0) {
                    let activeText = '';
                    active.forEach(l => {
                        const license = licenseData[l.license_type];
                        const expiryTimestamp = Math.floor(new Date(l.expires_at).getTime() / 1000);
                        activeText += `${license.emoji} **${l.license_name}**\n└ Expira: <t:${expiryTimestamp}:R>\n`;
                    });
                    embed.addFields({ name: '✅ Activas', value: activeText, inline: false });
                }

                if (revoked.length > 0) {
                    let revokedText = '';
                    revoked.forEach(l => {
                        const license = licenseData[l.license_type];
                        revokedText += `${license.emoji} **${l.license_name}**\n└ Razón: ${l.revoke_reason}\n`;
                    });
                    embed.addFields({ name: '❌ Revocadas', value: revokedText, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando licencias.');
            }
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
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, total, `Pago Nómina: ${groupName}`);

            // Pay Employees
            for (const m of members) {
                await billingService.ubService.addMoney(interaction.guildId, m.member_discord_id, m.salary, `Nómina de ${interaction.user.username}`);
                report += `✅ <@${m.member_discord_id}>: $${m.salary.toLocaleString()}\n`;
            }

            await interaction.editReply(report);
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
        const subcommand = interaction.options.getSubcommand();

        // Staff-only check
        const STAFF_ROLE_ID = '1450688555503587459'; // Same as empresa crear
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ Solo el staff puede gestionar tarjetas business.', flags: 64 });
        }

        if (subcommand === 'vincular') {
            await interaction.deferReply({ flags: 64 });

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

    else if (commandName === 'bolsa') {
        await interaction.deferReply(); // Global defer to prevent timeouts

        const subcommand = interaction.options.getSubcommand();
        const hour = new Date().getHours();

        if (subcommand === 'precios') {
            const embed = new EmbedBuilder()
                .setTitle('📈 Bolsa de Valores & Cripto')
                .setColor(0x0000FF)
                .setDescription(`Precios en tiempo real (MXN). Actualizados a las ${hour}:00 hrs.`)
                .setTimestamp();

            globalStocks.forEach(s => {
                const trend = s.current > s.base ? '📈' : '📉'; // Simple trend logic vs base
                // For better trend, we'd compare vs prev, but base is fine for now
                embed.addFields({ name: `${trend} ${s.symbol} - ${s.name}`, value: `$${s.current.toLocaleString()} MXN`, inline: true });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subcommand === 'comprar') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.editReply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
            }

            try {
                const currentPrice = stock.current;
                const totalCost = currentPrice * cantidad;

                // Request Payment Method (Cash, Debit, Credit)
                const paymentResult = await requestPaymentMethod(
                    interaction,
                    interaction.user.id,
                    totalCost,
                    `📈 Compra de ${cantidad} acciones de ${symbol}`
                );

                if (!paymentResult.success) {
                    return interaction.editReply({ content: paymentResult.error, components: [] });
                }

                // Payment is already processed in requestPaymentMethod
                const methodLabel = paymentResult.method === 'credit' ? '💳 Crédito' : (paymentResult.method === 'cash' ? '💵 Efectivo' : '🏦 Banco/Débito');

                // Update portfolio
                const { data: existing } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('stock_symbol', symbol)
                    .single();

                if (existing) {
                    const totalShares = existing.shares + cantidad;
                    const newAvgPrice = ((existing.avg_buy_price * existing.shares) + (currentPrice * cantidad)) / totalShares;

                    await supabase
                        .from('stock_portfolios')
                        .update({ shares: totalShares, avg_buy_price: newAvgPrice })
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                } else {
                    await supabase
                        .from('stock_portfolios')
                        .insert({
                            discord_user_id: interaction.user.id,
                            stock_symbol: symbol,
                            shares: cantidad,
                            avg_buy_price: currentPrice
                        });
                }

                // Log transaction
                await supabase
                    .from('stock_transactions')
                    .insert({
                        discord_user_id: interaction.user.id,
                        stock_symbol: symbol,
                        transaction_type: 'BUY',
                        shares: cantidad,
                        price_per_share: currentPrice,
                        total_amount: totalCost
                    });

                const embed = new EmbedBuilder()
                    .setTitle('✅ Compra Exitosa')
                    .setColor(0x00FF00)
                    .setDescription(`Has comprado **${cantidad} acciones de ${symbol}**`)
                    .addFields(
                        { name: 'Precio por Acción', value: `$${currentPrice.toLocaleString()}`, inline: true },
                        { name: 'Total Pagado', value: `$${totalCost.toLocaleString()}`, inline: true },
                        { name: 'Balance Restante', value: `$${(balance.bank - totalCost).toLocaleString()}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error comprando acciones:', error);
                await interaction.editReply({ content: '❌ Error procesando la compra. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'vender') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.editReply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
            }

            try {
                // Check portfolio
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('stock_symbol', symbol)
                    .single();

                if (!portfolio || portfolio.shares < cantidad) {
                    return await interaction.editReply({
                        content: `❌ No tienes suficientes acciones. Tienes ${portfolio?.shares || 0} de ${symbol}.`,
                        ephemeral: false
                    });
                }

                const currentPrice = stock.current;
                const totalRevenue = currentPrice * cantidad;
                const profit = (currentPrice - portfolio.avg_buy_price) * cantidad;
                const profitEmoji = profit >= 0 ? '📈' : '📉';

                // Add money (Use BillingService wrapper if possible, or direct UB service)
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, totalRevenue, `Venta ${cantidad} ${symbol}`);

                // Update portfolio
                const newShares = portfolio.shares - cantidad;
                if (newShares <= 0) {
                    await supabase
                        .from('stock_portfolios')
                        .delete()
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                } else {
                    await supabase
                        .from('stock_portfolios')
                        .update({ shares: newShares })
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                }

                // Log transaction
                await supabase
                    .from('stock_transactions')
                    .insert({
                        discord_user_id: interaction.user.id,
                        stock_symbol: symbol,
                        transaction_type: 'SELL',
                        shares: cantidad,
                        price_per_share: currentPrice,
                        total_amount: totalRevenue
                    });

                const embed = new EmbedBuilder()
                    .setTitle('✅ Venta Exitosa')
                    .setColor(profit >= 0 ? 0x00FF00 : 0xFF0000)
                    .setDescription(`Has vendido **${cantidad} acciones de ${symbol}**`)
                    .addFields(
                        { name: 'Precio por Acción', value: `$${currentPrice.toLocaleString()} MXN`, inline: true },
                        { name: 'Total Recibido', value: `$${totalRevenue.toLocaleString()} MXN`, inline: true },
                        { name: profit >= 0 ? '📈 Ganancia' : '📉 Pérdida', value: `$${Math.abs(Math.floor(profit)).toLocaleString()} MXN`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error vendiendo acciones:', error);
                await interaction.editReply({ content: '❌ Error procesando la venta. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'portafolio') {
            try {
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id);

                if (!portfolio || portfolio.length === 0) {
                    return await interaction.editReply({ content: '📊 Tu portafolio está vacío. Usa `/bolsa comprar` para invertir.', ephemeral: false });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Portafolio de ${interaction.user.username}`)
                    .setColor(0xFFD700)
                    .setTimestamp();

                let totalInvested = 0;
                let totalCurrent = 0;

                portfolio.forEach(p => {
                    const stock = globalStocks.find(s => s.symbol === p.stock_symbol);
                    if (!stock) return;

                    const currentPrice = stock.current;
                    const invested = p.avg_buy_price * p.shares;
                    const currentValue = currentPrice * p.shares;
                    const profitLoss = currentValue - invested;
                    const profitEmoji = profitLoss >= 0 ? '📈' : '📉';

                    totalInvested += invested;
                    totalCurrent += currentValue;

                    embed.addFields({
                        name: `${profitEmoji} ${p.stock_symbol} (${p.shares} acciones)`,
                        value: `Compra: $${p.avg_buy_price.toLocaleString()} | Actual: $${currentPrice.toLocaleString()}\nValor: $${currentValue.toLocaleString()} | ${profitLoss >= 0 ? '📈 Ganancia' : '📉 Pérdida'}: $${Math.abs(profitLoss).toLocaleString()}`,
                        inline: false
                    });
                });

                const totalProfit = totalCurrent - totalInvested;
                const profitEmoji = totalProfit >= 0 ? '📈' : '📉';

                const profitLabel = totalProfit >= 0 ? '📈 Ganancia Total' : '📉 Pérdida Total';
                embed.setDescription(`**Total Invertido:** $${totalInvested.toLocaleString()}\n**Valor Actual:** $${totalCurrent.toLocaleString()}\n**${profitLabel}:** $${Math.abs(totalProfit).toLocaleString()}`);

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando portafolio:', error);
                await interaction.editReply({ content: '❌ Error obteniendo tu portafolio.', ephemeral: false });
            }
        }

        else if (subcommand === 'historial') {
            try {
                const { data: transactions } = await supabase
                    .from('stock_transactions')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (!transactions || transactions.length === 0) {
                    return await interaction.editReply({ content: '📜 No tienes transacciones registradas.', ephemeral: false });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Historial de Transacciones`)
                    .setColor(0x3498DB)
                    .setDescription(`Últimas ${transactions.length} transacciones`)
                    .setTimestamp();

                transactions.forEach(t => {
                    const typeEmoji = t.transaction_type === 'BUY' ? '🛒' : '💰';
                    const date = new Date(t.created_at).toLocaleDateString();

                    embed.addFields({
                        name: `${typeEmoji} ${t.transaction_type} - ${t.stock_symbol}`,
                        value: `${t.shares} acciones @ $${t.price_per_share.toLocaleString()} = $${t.total_amount.toLocaleString()}\n${date}`,
                        inline: true
                    });
                });

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando historial:', error);
                await interaction.editReply({ content: '❌ Error obteniendo tu historial.', ephemeral: false });
            }
        }
    }

    if (commandName === 'balanza') {
        // Defer with error handling to prevent "Unknown interaction"
        try {
            await interaction.deferReply();
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

    else if (commandName === 'debito') {
        const subcommand = interaction.options.getSubcommand();

        // === PRE-VALIDATION (Before Defer) ===
        // Quick check for common failure cases
        if (subcommand === 'estado' || subcommand === 'info') {
            // Quick check: Does user have a debit card? (use cache if available)
            const quickCard = await getDebitCard(interaction.user.id);
            if (!quickCard) {
                return interaction.reply({
                    content: '❌ No tienes una tarjeta de débito activa. Visita el Banco Nacional para abrir tu cuenta con `/registrar-tarjeta`.',
                    ephemeral: true
                });
            }
        }

        // Safe to defer now
        await interaction.deferReply();

        if (subcommand === 'estado') {
            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa. Visita el Banco Nacional para abrir tu cuenta con `/registrar-tarjeta`.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                const embed = new EmbedBuilder()
                    .setTitle('💳 Estado Tarjeta Débito')
                    .setColor(0x00CED1)
                    .addFields(
                        { name: 'Número', value: `\`${card.card_number}\``, inline: false },
                        { name: 'Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                        { name: 'Estado', value: '✅ Activa', inline: true }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando débito.');
            }
        }
        // Add this code between line 3561 (after estado closing }) and line 3563 (before depositar comment)

        // === MEJORAR (Upgrade Debit Card) ===
        // === MEJORAR (Upgrade Debit Card - STAFF ONLY) ===
        else if (subcommand === 'mejorar') {
            const BANK_EXEC_ROLE_ID = '1450688555503587459';
            if (!interaction.member.roles.cache.has(BANK_EXEC_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('⛔ Solo ejecutivos bancarios pueden ofrecer mejoras.');
            }

            const targetUser = interaction.options.getUser('usuario');

            try {
                const card = await getDebitCard(targetUser.id);
                if (!card) return interaction.editReply(`❌ ${targetUser.username} no tiene una tarjeta de débito activa.`);

                const currentTier = card.card_tier || 'NMX Débito';
                let nextTier = null;

                if (currentTier === 'NMX Débito') nextTier = 'NMX Débito Plus';
                else if (currentTier === 'NMX Débito Plus') nextTier = 'NMX Débito Gold';

                if (!nextTier) {
                    return interaction.editReply(`✨ La tarjeta de ${targetUser.username} (**${currentTier}**) ya es el nivel máximo.`);
                }

                const nextStats = CARD_TIERS[nextTier];
                const upgradeCost = nextStats.cost;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 Oferta de Mejora de Débito')
                    .setColor(0x00CED1)
                    .setDescription(`Hola <@${targetUser.id}>, el banco te invita a mejorar tu tarjeta **${currentTier}** a **${nextTier}**.`)
                    .addFields(
                        { name: '🌟 Nuevo Nivel', value: nextTier, inline: true },
                        { name: '💎 Beneficios', value: `Límite Máximo: $${nextStats.max_balance === Infinity ? 'Ilimitado' : nextStats.max_balance.toLocaleString()}`, inline: true },
                        { name: '💰 Costo de Mejora', value: `$${upgradeCost.toLocaleString()}`, inline: false }
                    )
                    .setFooter({ text: 'Acepta la oferta para procesar el cobro inmediatamente.' });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`btn_udp_upgrade_${card.id}_${nextTier.replace(/ /g, '_')}`)
                            .setLabel(`Aceptar Mejora ($${upgradeCost})`)
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳'),
                        new ButtonBuilder()
                            .setCustomId(`btn_cancel_upgrade_${targetUser.id}`)
                            .setLabel('Rechazar')
                            .setStyle(ButtonStyle.Danger)
                    );


                // Send to the channel, pinging the user
                await interaction.editReply({ content: `<@${targetUser.id}>`, embeds: [embed], components: [row] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error procesando la oferta de mejora.');
            }
        }

        // === TRANSFERIR (Debit to Debit - 5 min delay) ===
        else if (subcommand === 'transferir') {
            try {
                const destUser = interaction.options.getUser('destinatario');
                const inputMonto = interaction.options.getString('monto');

                if (destUser.id === interaction.user.id) {
                    return interaction.editReply('❌ No puedes transferir a ti mismo.');
                }

                // Check sender has debit card
                const senderCard = await getDebitCard(interaction.user.id);
                if (!senderCard) {
                    return interaction.editReply('❌ No tienes una tarjeta de débito activa para transferir.');
                }

                // Check receiver has debit card
                const receiverCard = await getDebitCard(destUser.id);
                if (!receiverCard) {
                    return interaction.editReply(`❌ **${destUser.username}** no tiene una tarjeta de débito activa para recibir transferencias.`);
                }

                // Get sender balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                let monto = 0;
                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = bankBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) {
                    return interaction.editReply('❌ El monto debe ser mayor a 0.');
                }

                if (bankBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes.\\n\\nSaldo en Banco: $${bankBalance.toLocaleString()}\\nIntentas transferir: $${monto.toLocaleString()}`);
                }

                // Check receiver card limit
                console.log('[DEBUG-TRANSFER] Receiver card object:', JSON.stringify(receiverCard, null, 2));
                console.log('[DEBUG-TRANSFER] Receiver card_tier:', receiverCard.card_tier);
                console.log('[DEBUG-TRANSFER] Available tiers:', Object.keys(CARD_TIERS));

                const receiverTier = CARD_TIERS[receiverCard.card_tier || 'NMX Débito'];
                console.log('[DEBUG-TRANSFER] Found tier:', receiverTier);

                const receiverMax = receiverTier ? (receiverTier.max_balance || Infinity) : Infinity;
                console.log('[DEBUG-TRANSFER] Max balance:', receiverMax);

                if (receiverMax !== Infinity) {
                    const receiverBal = await billingService.ubService.getUserBalance(interaction.guildId, destUser.id);
                    const receiverBank = receiverBal.bank || 0;
                    console.log('[DEBUG-TRANSFER] Receiver current bank:', receiverBank);
                    console.log('[DEBUG-TRANSFER] Would be after transfer:', receiverBank + monto);

                    if ((receiverBank + monto) > receiverMax) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('⛔ Transferencia Rechazada')
                            .setColor(0xFF0000)
                            .setDescription(`El destinatario no puede recibir esta cantidad porque excedería el límite de su tarjeta.`)
                            .addFields(
                                { name: '💳 Tipo de Tarjeta', value: receiverCard.card_tier || 'NMX Débito', inline: true },
                                { name: '📊 Límite Máximo', value: `$${receiverMax.toLocaleString()}`, inline: true },
                                { name: '💰 Saldo Actual', value: `$${receiverBank.toLocaleString()}`, inline: true },
                                { name: '🚫 Intentas Transferir', value: `$${monto.toLocaleString()}`, inline: true },
                                { name: '📈 Saldo Final Sería', value: `$${(receiverBank + monto).toLocaleString()}`, inline: true }
                            )
                            .setFooter({ text: 'El destinatario debe actualizar su tarjeta para recibir más dinero' });
                        return interaction.editReply({ embeds: [errorEmbed] });
                    }
                }

                // Deduct from sender immediately
                await billingService.ubService.removeMoney(
                    interaction.guildId,
                    interaction.user.id,
                    monto,
                    `Transferencia débito a ${destUser.tag}`,
                    'bank'
                );

                // Schedule transfer for 5 minutes
                const releaseDate = new Date();
                releaseDate.setMinutes(releaseDate.getMinutes() + 5);

                await supabase.from('pending_transfers').insert({
                    sender_id: interaction.user.id,
                    receiver_id: destUser.id,
                    amount: monto,
                    reason: 'Transferencia Interbancaria',
                    release_date: releaseDate.toISOString(),
                    status: 'PENDING'
                });

                // Log transaction
                await supabase.from('debit_transactions').insert([{
                    debit_card_id: senderCard.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'transfer_out',
                    amount: -monto,
                    description: `Transferencia a ${destUser.tag}`
                }]);

                const embed = new EmbedBuilder()
                    .setTitle('⏳ Transferencia Programada')
                    .setColor(0xFFA500)
                    .setDescription('Tu transferencia se procesará en 5 minutos.')
                    .addFields(
                        { name: 'De', value: interaction.user.tag, inline: true },
                        { name: 'Para', value: destUser.tag, inline: true },
                        { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Llegada Estimada', value: releaseDate.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' }), inline: false }
                    )
                    .setFooter({ text: 'Sistema Interbancario NMX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // EXECUTE TRANSFER AFTER 5 MINUTES
                setTimeout(async () => {
                    try {
                        // Credit receiver
                        await supabase
                            .from('debit_cards')
                            .update({ balance: receiverCard.balance + monto })
                            .eq('id', receiverCard.id);

                        // Log transaction for receiver
                        await supabase.from('debit_transactions').insert([{
                            debit_card_id: receiverCard.id,
                            discord_user_id: destUser.id,
                            transaction_type: 'transfer_in',
                            amount: monto,
                            description: `Giro de ${interaction.user.tag}`
                        }]);

                        // Notify receiver
                        try {
                            await destUser.send(`💰 **Transferencia Recibida**\n\nRecibiste **$${monto.toLocaleString()}** de ${interaction.user.username}\n🏦 Sistema Interbancario NMX`);
                        } catch (err) {
                            console.log('[TRANSFER] Could not DM recipient', err.message);
                        }

                        console.log(`[TRANSFER SUCCESS] $${monto} from ${interaction.user.id} to ${destUser.id}`);

                    } catch (error) {
                        console.error('[TRANSFER FAILED]', error);
                        // ROLLBACK: Return money to sender
                        try {
                            await billingService.ubService.addMoney(
                                interaction.guildId,
                                interaction.user.id,
                                monto,
                                'Devolución por fallo en transferencia',
                                'bank'
                            );
                            await interaction.user.send(`⚠️ **Error en Transferencia**\n\nTu transferencia de $${monto.toLocaleString()} a ${destUser.username} falló. El dinero ha sido devuelto.`);
                        } catch (rollbackErr) {
                            console.error('[ROLLBACK FAILED]', rollbackErr);
                        }
                    }
                }, 5 * 60 * 1000); // 5 minutes
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error procesando la transferencia.');
            }
        }


        // === DEPOSITAR (Cash -> Bank) ===
        // === DEPOSITAR (Cash -> Bank) ===
        else if (subcommand === 'depositar') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa para depositar.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const cashBalance = balance.cash || 0;
                const bankBalance = balance.bank || 0;

                const inputMonto = interaction.options.getString('monto');
                let monto = 0;

                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = cashBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) return interaction.editReply('❌ El monto debe ser un número mayor a 0.');

                if (cashBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes en efectivo.\n\nTienes: $${cashBalance.toLocaleString()}\nIntentas depositar: $${monto.toLocaleString()}`);
                }

                // Check Max Balance Limit (Tier based)
                const tier = CARD_TIERS[card.card_tier || 'NMX Débito'];
                const maxBal = tier ? (tier.max_balance || Infinity) : Infinity;
                if ((bankBalance + monto) > maxBal) {
                    return interaction.editReply(`⛔ **Límite de Saldo Excedido**\nTu tarjeta **${card.card_tier || 'NMX Débito'}** tiene un límite de almacenamiento de **$${maxBal.toLocaleString()}**.\nActual: $${bankBalance.toLocaleString()} + Depósito: $${monto.toLocaleString()} > Límite.\n\n💡 **Mejora a NMX Débito Gold para almacenamiento ilimitado.**`);
                }

                // Transfer from cash to bank
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, 'Depósito bancario', 'cash');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, monto, 'Depósito bancario', 'bank');

                // Log transaction
                await supabase.from('debit_transactions').insert({
                    debit_card_id: card.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'deposit',
                    amount: monto,
                    description: 'Depósito en sucursal/ATM'
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏧 Depósito Exitoso')
                    .setColor(0x00FF00)
                    .setDescription('Has depositado efectivo a tu cuenta bancaria.')
                    .addFields(
                        { name: 'Monto Depositado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Nuevo Saldo Banco', value: `$${(bankBalance + monto).toLocaleString()}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error realizando depósito.');
            }
        }

        else if (subcommand === 'retirar') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                const inputMonto = interaction.options.getString('monto');
                let monto = 0;

                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = bankBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) return interaction.editReply('❌ El monto debe ser un número mayor a 0.');

                if (bankBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes en banco.\n\nDisponible: $${bankBalance.toLocaleString()}\nIntentando retirar: $${monto.toLocaleString()}`);
                }

                // Transfer from bank to cash
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, 'Retiro de cajero', 'bank');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, monto, 'Retiro de cajero', 'cash');

                // Log transaction
                await supabase.from('debit_transactions').insert({
                    debit_card_id: card.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'withdrawal',
                    amount: -monto,
                    description: 'Retiro en cajero automático'
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏧 Retiro Exitoso')
                    .setColor(0x00FF00)
                    .setDescription('Has retirado efectivo de tu cuenta bancaria.')
                    .addFields(
                        { name: 'Monto Retirado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Nuevo Saldo Banco', value: `$${(bankBalance - monto).toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: 'El efectivo está ahora en tu billetera' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error realizando retiro.');
            }
        }




        else if (subcommand === 'historial') {
            try {
                const { data: transactions } = await supabase.from('debit_transactions').select('*').eq('discord_user_id', interaction.user.id).order('created_at', { ascending: false }).limit(10);
                if (!transactions || transactions.length === 0) return interaction.editReply('📭 Sin transacciones.');
                const embed = new EmbedBuilder().setTitle('📋 Historial Débito').setColor(0x00CED1);
                let desc = '';
                transactions.forEach(tx => {
                    const emoji = tx.amount > 0 ? '➕' : '➖';
                    const type = tx.transaction_type === 'deposit' ? 'Depósito' : tx.transaction_type === 'transfer_in' ? 'Recibido' : tx.transaction_type === 'transfer_out' ? 'Enviado' : tx.transaction_type;
                    desc += `${emoji} **${type}**: $${Math.abs(tx.amount).toLocaleString()} | Saldo: $${tx.balance_after.toLocaleString()}\n`;
                });
                embed.setDescription(desc);
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando historial.');
            }
        }

        // === INFO ===
        else if (subcommand === 'info') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                // Get recent transactions
                const { data: recentTxs } = await supabase
                    .from('debit_transactions')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                let txHistory = '';
                if (recentTxs && recentTxs.length > 0) {
                    recentTxs.forEach(tx => {
                        const emoji = tx.amount > 0 ? '➕' : '➖';
                        const tipo = tx.transaction_type === 'withdrawal' ? 'Retiro' :
                            tx.transaction_type === 'deposit' ? 'Depósito' :
                                tx.transaction_type === 'transfer_in' ? 'Recibido' : 'Enviado';
                        txHistory += `${emoji} ${tipo}: $${Math.abs(tx.amount).toLocaleString()}\n`;
                    });
                } else {
                    txHistory = 'Sin transacciones recientes';
                }

                const embed = new EmbedBuilder()
                    .setTitle('💳 Información Completa - Tarjeta de Débito')
                    .setColor(0x00CED1)
                    .setDescription(`Detalles de tu cuenta bancaria NMX`)
                    .addFields(
                        { name: '💳 Tipo de Tarjeta', value: card.card_tier || 'NMX Débito', inline: true },
                        { name: '🔢 Número de Tarjeta', value: `\`${card.card_number}\``, inline: false },
                        { name: '💰 Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                        { name: '📅 Fecha de Creación', value: `<t:${Math.floor(new Date(card.created_at).getTime() / 1000)}:D>`, inline: true },
                        { name: '✅ Estado', value: 'Activa', inline: true },
                        { name: '📊 Últimas Transacciones', value: txHistory, inline: false }
                    )
                    .setFooter({ text: 'Banco Nacional MX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando información.');
            }
        }

        // === ADMIN COMMANDS ===
        else if (subCommandGroup === 'admin') {
            // Check if user is bank executive
            const BANK_EXEC_ROLE_ID = '1450688555503587459'; // Same as company creator role
            if (!interaction.member.roles.cache.has(BANK_EXEC_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '⛔ Solo ejecutivos bancarios pueden usar estos comandos.', ephemeral: true });
            }

            const adminSubCmd = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('usuario');

            // === ADMIN INFO ===
            if (adminSubCmd === 'info') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    const card = await getDebitCard(targetUser.id);
                    if (!card) return interaction.editReply(`❌ ${targetUser.username} no tiene tarjeta de débito.`);

                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                    const bankBalance = balance.bank || 0;
                    const cashBalance = balance.cash || 0;

                    // Get transaction count and totals
                    const { data: txs } = await supabase
                        .from('debit_transactions')
                        .select('*')
                        .eq('discord_user_id', targetUser.id);

                    const totalTransactions = txs?.length || 0;
                    const totalDeposits = txs?.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0;
                    const totalWithdrawals = txs?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

                    const embed = new EmbedBuilder()
                        .setTitle(`👨‍💼 Análisis Bancario - ${targetUser.username}`)
                        .setColor(0x5865F2)
                        .setThumbnail(targetUser.displayAvatarURL())
                        .addFields(
                            { name: '🔢 Número de Tarjeta', value: `\`${card.card_number}\``, inline: false },
                            { name: '💰 Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                            { name: '💵 Saldo en Efectivo', value: `$${cashBalance.toLocaleString()}`, inline: true },
                            { name: '💼 Total Combinado', value: `$${(bankBalance + cashBalance).toLocaleString()}`, inline: true },
                            { name: '📊 Total Transacciones', value: `${totalTransactions}`, inline: true },
                            { name: '➕ Total Depósitos', value: `$${totalDeposits.toLocaleString()}`, inline: true },
                            { name: '➖ Total Retiros', value: `$${totalWithdrawals.toLocaleString()}`, inline: true },
                            { name: '📅 Cuenta Creada', value: `<t:${Math.floor(new Date(card.created_at).getTime() / 1000)}:R>`, inline: false }
                        )
                        .setFooter({ text: 'Información Confidencial - Solo para Ejecutivos' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error consultando información.');
                }
            }

            // === ADMIN HISTORIAL ===
            else if (adminSubCmd === 'historial') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    const { data: transactions } = await supabase
                        .from('debit_transactions')
                        .select('*')
                        .eq('discord_user_id', targetUser.id)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (!transactions || transactions.length === 0) {
                        return interaction.editReply(`❌ ${targetUser.username} no tiene historial.`);
                    }

                    let description = '';
                    transactions.forEach((tx, index) => {
                        const emoji = tx.amount > 0 ? '➕' : '➖';
                        let tipo = tx.transaction_type;
                        if (tipo === 'withdrawal') tipo = 'Retiro';
                        else if (tipo === 'deposit') tipo = 'Depósito';
                        else if (tipo === 'transfer_in') tipo = 'Recibido';
                        else if (tipo === 'transfer_out') tipo = 'Enviado';

                        const fecha = new Date(tx.created_at);
                        description += `${emoji} **${tipo}**: $${Math.abs(tx.amount).toLocaleString()} | <t:${Math.floor(fecha.getTime() / 1000)}:R>\n`;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle(`📋 Historial de Débito - ${targetUser.username}`)
                        .setColor(0x00CED1)
                        .setDescription(description)
                        .setFooter({ text: `Mostrando últimas ${transactions.length} transacciones` })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error cargando historial.');
                }
            }
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

            // Take top 10
            const top10 = wealthData.slice(0, 10);

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
        const destUser = interaction.options.getUser('destinatario');
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
            monto = parseFloat(inputMonto);
        }

        if (isNaN(monto) || monto <= 0) {
            return interaction.reply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: true });
        }

        await interaction.deferReply();

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

            // 4. Response
            const embed = new EmbedBuilder()
                .setTitle('🏪 Depósito Realizado')
                .setColor(0xFFA500)
                .setDescription(`Has depositado efectivo a la cuenta de **${destUser.tag}**.`)
                .addFields(
                    { name: '💸 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: '💳 Destino', value: `Tarjeta NMX *${destCard.card_number.slice(-4)}`, inline: true },
                    { name: '⏳ Tiempo estimado', value: '4 Horas', inline: false },
                    { name: '📝 Concepto', value: razon, inline: false }
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
            monto = parseFloat(inputMonto);
        }

        if (isNaN(monto) || monto <= 0) return interaction.editReply({ content: '❌ El monto debe ser mayor a 0.' });
        if (destUser.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes enviarte un giro a ti mismo.' });

        try {
            // Already fetched balance above.
            if ((senderBalance.cash || 0) < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Efectivo. Tienes $${(senderBalance.cash || 0).toLocaleString()}.`);
            }

            // 2. Create Pending Transfer FIRST (24h Delay)
            const releaseDate = new Date();
            releaseDate.setHours(releaseDate.getHours() + 24); // Pending for 24 hours

            const { error: insertError } = await supabase.from('giro_transfers').insert({
                sender_id: interaction.user.id,
                receiver_id: destUser.id,
                amount: monto,
                reason: razon,
                release_date: releaseDate.toISOString(),
                status: 'pending'
            });

            if (insertError) {
                console.error(insertError);
                return interaction.editReply('❌ Error creando la transferencia postal.');
            }

            // 3. Deduct Money from Sender NOW
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `[Giro Postal] A ${destUser.tag}`);

            // 4. Send Confirmation
            await interaction.editReply({
                content: `✅ **Giro Postal Enviado**\n\n- Destinatario: **${destUser.tag}**\n- Monto: **$${monto.toLocaleString()}**\n- Razón: ${razon}\n- **Se procesará en:** 24 horas\n\n_El dinero se debitó de tu efectivo. El destinatario lo recibirá mañana._`
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando el giro postal.');
        }
    }

    else if (commandName === 'impuestos') {
        await interaction.reply({ content: '🛠️ **Próximamente:** Sistema de impuestos dinámico.', ephemeral: true });
    }

    // ===================================================================
    // ECONOMY COMMANDS: Stake, Slots, Fondos
    // ===================================================================

    else if (commandName === 'stake') {
        try {
            await interaction.deferReply();
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
        try {
            await interaction.deferReply();
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
        try {
            await interaction.deferReply();
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


    // IMPORTANT: Only delegate if interaction was NOT handled above
    // This prevents duplicate processing causing "Unknown interaction" errors
    //     if (!interaction.replied && !interaction.deferred) {
    //         console.log(`[DEBUG] Delegating interaction ${interaction.customId || interaction.commandName} to handleExtraCommands`);
    // 
    //         await handleExtraCommands(interaction);
    //     }
});

// Global Error Handlers to prevent crash
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);

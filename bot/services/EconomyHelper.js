const BENEFIT_ROLES = {
    PREMIUM: '1412887172503175270',
    BOOSTER: '1423520675158691972',
    ULTRAPASS: '1414033620636532849'
};

const CARD_TIERS = {
    // DEBIT CARDS (3)
    'NMX Débito': {
        limit: 0, interest: 0, cost: 100, max_balance: 50000, score: 0, tier: 'Débito', color: 0x808080,
        benefits: ['Cuenta básica', 'Transferencias gratis', 'Soporte estándar']
    },
    'NMX Débito Plus': {
        limit: 0, interest: 0, cost: 500, max_balance: 150000, score: 0, tier: 'Débito', color: 0x4169E1,
        benefits: ['Mayor límite', 'Alertas SMS', 'Retiros sin comisión']
    },
    'NMX Débito Gold': {
        limit: 0, interest: 0, cost: 1000, max_balance: Infinity, score: 0, tier: 'Débito', color: 0xFFD700,
        benefits: ['Sin límites', 'Cashback 1.5%', 'Soporte prioritario']
    },

    // PERSONAL CREDIT CARDS (10)
    'NMX Start': {
        limit: 15000, interest: 15, cost: 2000, max_balance: Infinity, score: 0, tier: 'Personal', color: 0xA9A9A9,
        benefits: ['Ideal para historial', 'Sin anualidad 1er año', 'App móvil incluida']
    },
    'NMX Básica': {
        limit: 30000, interest: 12, cost: 4000, max_balance: Infinity, score: 30, tier: 'Personal', color: 0x87CEEB,
        benefits: ['Límite mejorado', 'Cashback 1%', 'Seguro básico']
    },
    'NMX Plus': {
        limit: 50000, interest: 10, cost: 6000, max_balance: Infinity, score: 50, tier: 'Plus', color: 0x32CD32,
        benefits: ['Límite superior', 'Cashback 2%', 'Protección de compras']
    },
    'NMX Plata': {
        limit: 100000, interest: 8, cost: 10000, max_balance: Infinity, score: 60, tier: 'Premium', color: 0xC0C0C0,
        benefits: ['Límite alto', 'Cashback 3%', 'Acceso salas VIP (2/año)']
    },
    'NMX Oro': {
        limit: 250000, interest: 7, cost: 15000, max_balance: Infinity, score: 70, tier: 'Elite', color: 0xFFD700,
        benefits: ['Límite Oro', 'Cashback 4%', 'Lounge aeropuerto ilimitado']
    },
    'NMX Rubí': {
        limit: 500000, interest: 6, cost: 25000, max_balance: Infinity, score: 80, tier: 'Elite Plus', color: 0xE0115F,
        benefits: ['Medio millón', 'Cashback 5%', 'Concierge premium']
    },
    'NMX Black': {
        limit: 1000000, interest: 5, cost: 40000, max_balance: Infinity, score: 85, tier: 'Black', color: 0x000000,
        benefits: ['Límite millonario', 'Cashback 6%', 'Priority Pass Total']
    },
    'NMX Diamante': {
        limit: 2000000, interest: 3, cost: 60000, max_balance: Infinity, score: 90, tier: 'Diamante', color: 0xB9F2FF,
        benefits: ['2 Millones', 'Cashback 8%', 'Mayordomo personal']
    },
    'NMX Zafiro': {
        limit: 5000000, interest: 2.5, cost: 100000, max_balance: Infinity, score: 95, tier: 'Zafiro', color: 0x0F52BA,
        benefits: ['5 Millones', 'Cashback 8%', 'Jet privado (-50%)']
    },
    'NMX Platino Elite': {
        limit: 10000000, interest: 2, cost: 150000, max_balance: Infinity, score: 98, tier: 'Platino Elite', color: 0xE5E4E2,
        benefits: ['10 Millones', 'Cashback 10%', 'Jet privado ilimitado']
    },

    // BUSINESS CREDIT CARDS (9)
    'NMX Business Start': {
        limit: 50000, interest: 2, cost: 8000, max_balance: Infinity, score: 70, tier: 'Business', color: 0x4682B4,
        benefits: ['Emprendedores', 'Crédito renovable', 'Reportes mensuales']
    },
    'NMX Business Gold': {
        limit: 100000, interest: 1.5, cost: 15000, max_balance: Infinity, score: 75, tier: 'Business', color: 0xFFD700,
        benefits: ['Pymes', 'Cashback 1%', 'Tarjetas adicionales']
    },
    'NMX Business Platinum': {
        limit: 200000, interest: 1.2, cost: 20000, max_balance: Infinity, score: 80, tier: 'Business', color: 0xE5E4E2,
        benefits: ['Expansión', 'Acceso prioritario', 'Sin comisiones intl']
    },
    'NMX Business Elite': {
        limit: 500000, interest: 1, cost: 35000, max_balance: Infinity, score: 85, tier: 'Business', color: 0x4B0082,
        benefits: ['Corporativo', 'Línea flexible', 'Seguro viajes']
    },
    'NMX Corporate': {
        limit: 1000000, interest: 0.7, cost: 50000, max_balance: Infinity, score: 90, tier: 'Corporate', color: 0x800020,
        benefits: ['Industrias', 'Beneficio fiscal', 'Asesor dedicado']
    },
    'NMX Corporate Plus': {
        limit: 5000000, interest: 0.5, cost: 100000, max_balance: Infinity, score: 92, tier: 'Corporate', color: 0xCD7F32,
        benefits: ['Grandes Corps', 'Financiamiento proyectos', 'Líneas extra']
    },
    'NMX Enterprise': {
        limit: 10000000, interest: 0.4, cost: 200000, max_balance: Infinity, score: 95, tier: 'Corporate', color: 0x2F4F4F,
        benefits: ['Transnacionales', 'Trade finance', 'Hedging']
    },
    'NMX Conglomerate': {
        limit: 25000000, interest: 0.3, cost: 350000, max_balance: Infinity, score: 98, tier: 'Supreme', color: 0x191970,
        benefits: ['Conglomerados', 'Fiscalidad internacional', 'M&A']
    },
    'NMX Supreme': {
        limit: 50000000, interest: 0.2, cost: 500000, max_balance: Infinity, score: 99, tier: 'Supreme', color: 0xFFFFFF,
        benefits: ['Top Tier', 'Mercado capitales', 'Todo incluido']
    }
};

const RP_RANK_ROLES = [
    { id: '1460053269748518984', name: 'Icono de Nación', salary: 1.80, shop: 0.50, license: 0.50, casino: 0.0, stocks: 0.0, score: 100, limit: 1.30, sanction_reduction: 0.50, appeal_priority: 4, fine_discount: 0.60, jail_reduction: 0.50 },
    { id: '1460051629184385146', name: 'Leyenda', salary: 1.60, shop: 0.65, license: 0.70, casino: 0.02, stocks: 0.0, score: 75, limit: 1.20, sanction_reduction: 0.40, appeal_priority: 3, fine_discount: 0.45, jail_reduction: 0.40 },
    { id: '1460051534053380219', name: 'Elite', salary: 1.45, shop: 0.75, license: 0.80, casino: 0.03, stocks: 0.05, score: 50, limit: 1.15, sanction_reduction: 0.30, appeal_priority: 3, fine_discount: 0.35, jail_reduction: 0.30 },
    { id: '1460051433331232893', name: 'Profesional', salary: 1.35, shop: 0.80, license: 0.80, casino: 0.03, stocks: 0.05, score: 30, limit: 1.10, sanction_reduction: 0.20, appeal_priority: 2, fine_discount: 0.25, jail_reduction: 0.20 },
    { id: '1460051350199996640', name: 'Veterano', salary: 1.25, shop: 0.85, license: 1.0, casino: 0.03, stocks: 0.08, score: 25, limit: 1.10, sanction_reduction: 0.15, appeal_priority: 2, fine_discount: 0.15, jail_reduction: 0.15 },
    { id: '1460051219186843670', name: 'Experimentado', salary: 1.20, shop: 0.88, license: 1.0, casino: 0.05, stocks: 0.08, score: 20, limit: 1.05, sanction_reduction: 0.10, appeal_priority: 1, fine_discount: 0.10, jail_reduction: 0.10 },
    { id: '1460051141071995104', name: 'Residente', salary: 1.15, shop: 0.90, license: 1.0, casino: 0.05, stocks: 0.10, score: 15, limit: 1.05, sanction_reduction: 0.05, appeal_priority: 1, fine_discount: 0.05, jail_reduction: 0.05 },
    { id: '1460051059568545884', name: 'Ciudadano', salary: 1.10, shop: 0.92, license: 1.0, casino: 0.05, stocks: 0.10, score: 10, limit: 1.0, sanction_reduction: 0, appeal_priority: 0, fine_discount: 0, jail_reduction: 0 },
    { id: '1460050977246679164', name: 'Habitante', salary: 1.05, shop: 0.95, license: 1.0, casino: 0.10, stocks: 0.10, score: 5, limit: 1.0, sanction_reduction: 0, appeal_priority: 0, fine_discount: 0, jail_reduction: 0 },
    { id: '1460050867473612840', name: 'Novato', salary: 1.0, shop: 1.0, license: 1.0, casino: 0.10, stocks: 0.10, score: 0, limit: 1.0, sanction_reduction: 0, appeal_priority: 0, fine_discount: 0, jail_reduction: 0 }
];

function applyRoleBenefits(member, baseAmount, type) {
    let finalAmount = baseAmount;
    let perks = [];

    // 1. RP RANK BENEFITS (Highest priority, only one applies)
    const userRank = RP_RANK_ROLES.find(rank => member.roles.cache.has(rank.id));

    if (userRank) {
        if (type === 'job' && userRank.salary > 1.0) {
            finalAmount = Math.floor(baseAmount * userRank.salary);
            perks.push(`[${userRank.name}] +${Math.round((userRank.salary - 1) * 100)}% Salario`);
        }
        if (type === 'shop' && userRank.shop < 1.0) {
            finalAmount = Math.floor(baseAmount * userRank.shop);
            perks.push(`[${userRank.name}] -${Math.round((1 - userRank.shop) * 100)}% Tienda`);
        }
        if (type === 'license' && userRank.license < 1.0) {
            finalAmount = Math.floor(baseAmount * userRank.license);
            perks.push(`[${userRank.name}] -${Math.round((1 - userRank.license) * 100)}% Licencias`);
        }
        if (type === 'casino_fee') {
            finalAmount = userRank.casino; // Returns the fee percentage (e.g. 0.03)
            if (userRank.casino === 0) perks.push(`[${userRank.name}] Sin Comisiones Casino`);
            else perks.push(`[${userRank.name}] Comis. Casino: ${userRank.casino * 100}%`);
        }
        if (type === 'stock_commission') {
            finalAmount = userRank.stocks;
            if (userRank.stocks === 0) perks.push(`[${userRank.name}] Sin Comisiones Bolsa`);
            else perks.push(`[${userRank.name}] Comis. Bolsa: ${userRank.stocks * 100}%`);
        }
        if (type === 'sanction_reduction') {
            finalAmount = userRank.sanction_reduction;
            if (userRank.sanction_reduction > 0) perks.push(`[${userRank.name}] -${userRank.sanction_reduction * 100}% Tiempo Sanción`);
        }
        if (type === 'credit_limit_bonus') {
            finalAmount = userRank.limit;
            if (userRank.limit > 1.0) perks.push(`[${userRank.name}] +${Math.round((userRank.limit - 1) * 100)}% Límite Crédito`);
        }
        if (type === 'credit_score_bonus') {
            finalAmount = userRank.score;
            if (userRank.score > 0) perks.push(`[${userRank.name}] +${userRank.score} Score Crediticio`);
        }
        if (type === 'appeals_priority') {
            finalAmount = userRank.appeal_priority || 0;
            if (userRank.appeal_priority > 0) perks.push(`[${userRank.name}] Prioridad de Apelación Nivel ${userRank.appeal_priority}`);
        }
        if (type === 'fine_discount') {
            finalAmount = userRank.fine_discount;
            if (baseAmount > 0) finalAmount = Math.floor(baseAmount * (1 - userRank.fine_discount));
            if (userRank.fine_discount > 0) perks.push(`[${userRank.name}] -${userRank.fine_discount * 100}% Multas`);
        }
        if (type === 'jail_reduction') {
            finalAmount = userRank.jail_reduction;
            if (baseAmount > 0) finalAmount = Math.floor(baseAmount * (1 - userRank.jail_reduction));
            if (userRank.jail_reduction > 0) perks.push(`[${userRank.name}] -${userRank.jail_reduction * 100}% Tiempo Cárcel`);
        }
    }

    // 2. STACKABLE BENEFITS (Premium, Booster, UltraPass)
    const isUltraPass = member.roles.cache.has(BENEFIT_ROLES.ULTRAPASS);
    const isBooster = member.roles.cache.has(BENEFIT_ROLES.BOOSTER);
    const isPremium = member.roles.cache.has(BENEFIT_ROLES.PREMIUM);

    // Salario (Cumulative)
    if (type === 'job') {
        const stackBonus = isUltraPass ? 2.0 : isBooster ? 1.5 : isPremium ? 1.25 : 1.0;
        if (stackBonus > 1.0) {
            finalAmount = Math.floor(finalAmount * stackBonus);
            perks.push(`[Stack] +${Math.round((stackBonus - 1) * 100)}% Bono Extra`);
        }
    }

    // Tienda/Business/Justicia (Cumulative)
    if (type === 'business_create' || type === 'shop' || type === 'fine_discount') {
        const stackDiscount = isUltraPass ? 0.50 : isBooster ? 0.20 : isPremium ? 0.10 : 0;

        // Special case: Legacy fine discount was 50% for all premium tiers
        let justiceStack = (type === 'fine_discount' && (isUltraPass || isBooster || isPremium)) ? 0.50 : stackDiscount;

        if (justiceStack > 0) {
            finalAmount = Math.floor(finalAmount * (1 - justiceStack));
            perks.push(`[Stack] -${justiceStack * 100}% Desc. Extra`);
        }
    }

    return { amount: finalAmount, perks };
}

async function getDebitCard(supabase, discordId) {
    const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', discordId).eq('status', 'active').maybeSingle();
    return card;
}

/**
 * Format money amount with proper localization
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: '$')
 * @returns {string}
 */
function formatMoney(amount, currency = '$') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return `${currency}0`;
    }

    return `${currency}${amount.toLocaleString('en-US')}`;
}

/**
 * Calculate tax on an amount
 * @param {number} amount - Amount to calculate tax on
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.15 for 15%)
 * @returns {{gross: number, tax: number, net: number}}
 */
function calculateTax(amount, taxRate) {
    const gross = Math.floor(amount);
    const tax = Math.floor(gross * taxRate);
    const net = gross - tax;

    return { gross, tax, net };
}

/**
 * Check if user has sufficient balance
 * @param {object} billingService - Billing service instance
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {number} requiredAmount - Required amount
 * @param {string} balanceType - Type of balance ('cash' or 'bank')
 * @returns {Promise<{sufficient: boolean, current: number}>}
 */
async function checkBalance(billingService, guildId, userId, requiredAmount, balanceType = 'cash') {
    try {
        const balance = await billingService.ubService.getBalance(guildId, userId);
        const current = balanceType === 'bank' ? balance.bank : balance.cash;

        return {
            sufficient: current >= requiredAmount,
            current
        };
    } catch (error) {
        console.error('[EconomyHelper] Error checking balance:', error);
        return { sufficient: false, current: 0 };
    }
}

/**
 * Get percentage utilization of credit card
 * @param {number} debt - Current debt
 * @param {number} limit - Credit limit
 * @returns {number} Utilization percentage
 */
function getCreditUtilization(debt, limit) {
    if (limit === 0) return 0;
    return Math.min(100, Math.round((debt / limit) * 100));
}

/**
 * Get user's highest RP rank
 * @param {GuildMember} member - Discord guild member
 * @returns {object|null} Rank data or null
 */
function getUserRPRank(member) {
    if (!member || !member.roles) return null;

    return RP_RANK_ROLES.find(rank => member.roles.cache.has(rank.id)) || null;
}

/**
 * Calculate compound interest
 * @param {number} principal - Principal amount
 * @param {number} rate - Interest rate (decimal, e.g., 0.05 for 5%)
 * @param {number} periods - Number of periods
 * @returns {number} Total amount after interest
 */
function calculateCompoundInterest(principal, rate, periods) {
    return Math.floor(principal * Math.pow(1 + rate, periods));
}

/**
 * Get card tier data by name
 * @param {string} cardName - Name of the card
 * @returns {object|null} Card tier data or null
 */
function getCardTier(cardName) {
    return CARD_TIERS[cardName] || null;
}

/**
 * Check if card is debit or credit
 * @param {string} cardName - Name of the card
 * @returns {string} 'debit' or 'credit'
 */
function getCardType(cardName) {
    const tier = CARD_TIERS[cardName];
    if (!tier) return 'unknown';

    return tier.tier === 'Débito' ? 'debit' : 'credit';
}

module.exports = {
    BENEFIT_ROLES,
    RP_RANK_ROLES,
    CARD_TIERS,
    applyRoleBenefits,
    getDebitCard,
    formatMoney,
    calculateTax,
    checkBalance,
    getCreditUtilization,
    getUserRPRank,
    calculateCompoundInterest,
    getCardTier,
    getCardType
};

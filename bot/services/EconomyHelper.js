const { BENEFIT_ROLES, CARD_TIERS, RP_RANK_ROLES } = require('../utils/economyConstants');
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

// Cache for dynamic economy values to reduce DB hits
// Key: `${guildId}_${key}`, Value: { val: value, exp: timestamp }
const economyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getDynamicSetting(supabase, guildId, key, defaultValue) {
    const cacheKey = `${guildId}_${key}`;
    const cached = economyCache.get(cacheKey);

    if (cached && Date.now() < cached.exp) {
        return cached.val;
    }

    try {
        const { data } = await supabase
            .from('server_settings')
            .select('value')
            .eq('guild_id', guildId)
            .eq('key', key)
            .maybeSingle();

        const value = data ? parseFloat(data.value) : defaultValue;
        economyCache.set(cacheKey, { val: value, exp: Date.now() + CACHE_TTL });
        return value;
    } catch (e) {
        console.error(`[EconomyHelper] Error fetching setting ${key}:`, e);
        return defaultValue;
    }
}

async function getDynamicTaxRate(supabase, guildId) {
    return await getDynamicSetting(supabase, guildId, 'global_tax_rate', 0.10);
}

async function getDynamicSalaryMultiplier(supabase, guildId) {
    return await getDynamicSetting(supabase, guildId, 'global_salary_multiplier', 1.0);
}

// Function to clear cache when settings are updated
function invalidateEconomyCache(guildId, key) {
    economyCache.delete(`${guildId}_${key}`);
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
    getCardType,
    getDynamicTaxRate,
    getDynamicSalaryMultiplier,
    invalidateEconomyCache
};

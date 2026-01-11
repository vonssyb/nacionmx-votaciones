const RP_RANK_ROLES = [
    { id: '1460050867473612840', name: 'Novato', salary: 1.0, shop: 1.0, license: 1.0, casino: 0.10, stocks: 0.10, score: 0, limit: 1.0 },
    { id: '1460050977246679164', name: 'Habitante', salary: 1.05, shop: 0.95, license: 1.0, casino: 0.10, stocks: 0.10, score: 5, limit: 1.0 },
    { id: '1460051059568545884', name: 'Ciudadano', salary: 1.10, shop: 0.92, license: 1.0, casino: 0.05, stocks: 0.10, score: 10, limit: 1.0 },
    { id: '1460051141071995104', name: 'Residente', salary: 1.15, shop: 0.90, license: 1.0, casino: 0.05, stocks: 0.10, score: 15, limit: 1.05 },
    { id: '1460051219186843670', name: 'Experimentado', salary: 1.20, shop: 0.88, license: 1.0, casino: 0.05, stocks: 0.08, score: 20, limit: 1.05 },
    { id: '1460051350199996640', name: 'Veterano', salary: 1.25, shop: 0.85, license: 1.0, casino: 0.03, stocks: 0.08, score: 25, limit: 1.10 },
    { id: '1460051433331232893', name: 'Profesional', salary: 1.35, shop: 0.80, license: 0.80, casino: 0.03, stocks: 0.05, score: 30, limit: 1.10 },
    { id: '1460051534053380219', name: 'Elite', salary: 1.45, shop: 0.75, license: 0.80, casino: 0.03, stocks: 0.05, score: 50, limit: 1.15 },
    { id: '1460051629184385146', name: 'Leyenda', salary: 1.60, shop: 0.65, license: 0.70, casino: 0.02, stocks: 0.0, score: 75, limit: 1.20 },
    { id: '1460051693092995174', name: 'Icono de Nación', salary: 1.80, shop: 0.50, license: 0.50, casino: 0.0, stocks: 0.0, score: 100, limit: 1.30 }
].reverse(); // Reverse so we find the highest rank first

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

    // Tienda/Business (Cumulative)
    if (type === 'business_create' || type === 'shop') {
        const stackDiscount = isUltraPass ? 0.50 : isBooster ? 0.20 : isPremium ? 0.10 : 0;
        if (stackDiscount > 0) {
            finalAmount = Math.floor(finalAmount * (1 - stackDiscount));
            perks.push(`[Stack] -${stackDiscount * 100}% Desc. Extra`);
        }
    }

    return { amount: finalAmount, perks };
}

async function getDebitCard(supabase, discordId) {
    const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', discordId).eq('status', 'active').maybeSingle();
    return card;
}

module.exports = {
    BENEFIT_ROLES,
    RP_RANK_ROLES,
    CARD_TIERS,
    applyRoleBenefits,
    getDebitCard
};

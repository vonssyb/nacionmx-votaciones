
const BENEFIT_ROLES = {
    PREMIUM: '1412887172503175270',
    BOOSTER: '1423520675158691972',
    ULTRAPASS: '1414033620636532849'
};

const CARD_TIERS = {
    // DEBIT CARDS
    'NMX Débito': {
        limit: 0, interest: 0, cost: 100, max_balance: 50000, score: 0, tier: 'Débito', color: 0x808080,
        benefits: ['Cuenta básica', 'Transferencias gratis', 'Soporte estándar']
    },
    'NMX Débito Plus': {
        limit: 0, interest: 0, cost: 5000, max_balance: 250000, score: 10, tier: 'Débito', color: 0x32CD32,
        benefits: ['Límite aumentado', 'Retiros gratis', 'Atención preferente']
    },
    'NMX Débito Gold': {
        limit: 0, interest: 0, cost: 20000, max_balance: 1000000, score: 20, tier: 'Débito', color: 0xFFD700,
        benefits: ['Límite alto', 'Seguro de fondos', 'Concierge básico']
    },
    'NMX Start': {
        limit: 15000, interest: 15, cost: 2000, max_balance: Infinity, score: 30, tier: 'Start', color: 0xCD7F32,
        benefits: ['Primer crédito', 'Construye historial', 'Sin anualidad']
    },
    'NMX Básica': {
        limit: 30000, interest: 12, cost: 4000, max_balance: Infinity, score: 40, tier: 'Básica', color: 0x4682B4,
        benefits: ['Crédito personal', 'Interés moderado', 'Descuentos básicos']
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
        limit: 500000, interest: 5, cost: 25000, max_balance: Infinity, score: 75, tier: 'Gold', color: 0xFFD700,
        benefits: ['1 Medio Millón', 'Cashback 5%', 'Seguro de viajes']
    },
    'NMX Rubí': {
        limit: 750000, interest: 4.5, cost: 35000, max_balance: Infinity, score: 80, tier: 'Rubí', color: 0xE0115F,
        benefits: ['Límite extendido', 'Cashback 5.5%', 'Salas VIP (4/año)']
    },
    'NMX Platino': {
        limit: 1000000, interest: 4, cost: 50000, max_balance: Infinity, score: 85, tier: 'Platinum', color: 0xE5E4E2,
        benefits: ['1 Millón', 'Cashback 6%', 'Concierge personal']
    },
    'NMX Diamante': {
        limit: 2000000, interest: 3, cost: 80000, max_balance: Infinity, score: 90, tier: 'Diamond', color: 0xB9F2FF,
        benefits: ['2 Millones', 'Cashback 7%', 'Eventos exclusivos']
    },
    'NMX Zafiro': {
        limit: 5000000, interest: 2.5, cost: 100000, max_balance: Infinity, score: 95, tier: 'Zafiro', color: 0x0F52BA,
        benefits: ['5 Millones', 'Cashback 8%', 'Jet privado (-50%)']
    },
    'NMX Platino Elite': {
        limit: 10000000, interest: 2, cost: 150000, max_balance: Infinity, score: 98, tier: 'Platino Elite', color: 0xE5E4E2,
        benefits: ['10 Millones', 'Cashback 10%', 'Jet privado ilimitado']
    },

    // CORPORATE
    'NMX Startup': {
        limit: 500000, interest: 0.8, cost: 20000, max_balance: Infinity, score: 80, tier: 'Corporate', color: 0x008080,
        benefits: ['PYMES', 'Nómina', 'Terminal TPV']
    },
    'NMX Corporate': {
        limit: 1000000, interest: 0.7, cost: 50000, max_balance: Infinity, score: 90, tier: 'Corporate', color: 0x800020,
        benefits: ['Industrias', 'Beneficio fiscal', 'Asesor dedicado']
    },
    'NMX Corporate Plus': {
        limit: 5000000, interest: 0.5, cost: 100000, max_balance: Infinity, score: 92, tier: 'Corporate', color: 0xCD7F32,
        benefits: ['Grandes Corps', 'Financiamiento proyectos', 'Líneas extra']
    },
    'NMX Black': {
        limit: 10000000, interest: 0.4, cost: 200000, max_balance: Infinity, score: 97, tier: 'Black', color: 0x000000,
        benefits: ['Global Corp', 'Sin límites', 'Auditoría gratuita']
    },
    'NMX Supreme': {
        limit: 50000000, interest: 0.2, cost: 500000, max_balance: Infinity, score: 99, tier: 'Supreme', color: 0xFFFFFF,
        benefits: ['Top Tier', 'Mercado capitales', 'Todo incluido']
    }
};


function applyRoleBenefits(member, baseAmount, type) {
    let finalAmount = baseAmount;
    let perks = [];

    // Role Checks
    const isUltraPass = member.roles.cache.has(BENEFIT_ROLES.ULTRAPASS);
    const isBooster = member.roles.cache.has(BENEFIT_ROLES.BOOSTER);
    const isPremium = member.roles.cache.has(BENEFIT_ROLES.PREMIUM);

    // Business Creation (Discounts)
    if (type === 'business_create') {
        const discount = isUltraPass ? 0.50 : isBooster ? 0.20 : isPremium ? 0.10 : 0;
        if (discount > 0) {
            finalAmount = Math.floor(baseAmount * (1 - discount));
            perks.push(`-${discount * 100}% Descuento`);
        }
    }

    // Licenses (Discounts in time or cost - assuming cost here)
    if (type === 'license') {
        const discount = isUltraPass ? 0.80 : isBooster ? 0.50 : isPremium ? 0.25 : 0;
        if (discount > 0) {
            finalAmount = Math.floor(baseAmount * (1 - discount));
            perks.push(`-${discount * 100}% Costo Licencia`);
        }
    }

    // Job Pay (Bonus)
    if (type === 'job') {
        const bonus = isUltraPass ? 2.0 : isBooster ? 1.5 : isPremium ? 1.25 : 1.0;
        if (bonus > 1.0) {
            finalAmount = Math.floor(baseAmount * bonus);
            perks.push(`+${Math.floor((bonus - 1) * 100)}% Salario`);
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
    CARD_TIERS,
    applyRoleBenefits,
    getDebitCard
};

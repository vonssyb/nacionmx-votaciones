import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase Credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CARD_LIMITS = {
    'NMX Plus': 50000,
    'NMX Plata': 100000,
    'NMX Oro': 500000,
    'NMX Platino': 1000000,
    'NMX Diamante': 2000000,
    'NMX Zafiro': 5000000,
    'NMX Platino Elite': 10000000,
    'NMX Startup': 500000,
    'NMX Corporate': 1000000,
    'NMX Corporate Plus': 5000000,
    'NMX Black': 10000000,
    'NMX Supreme': 50000000
};

async function fixCreditLimits() {
    console.log('🔧 Starting Credit Limit Fix...');

    // DEBUG: Fetch sample cards
    const { data: sample } = await supabase.from('credit_cards').select('id, card_type, credit_limit').limit(5);
    console.log('🔍 DEBUG SAMPLE CARDS:', sample);

    let totalUpdated = 0;

    for (const [tier, limit] of Object.entries(CARD_LIMITS)) {
        // Enforce limit on ALL cards of this tier
        const { data, error } = await supabase
            .from('credit_cards')
            .update({ credit_limit: limit })
            .eq('card_type', tier)
            .neq('credit_limit', limit) // Only update if different
            .select();

        if (error) {
            console.error(`❌ Error updating ${tier}:`, error.message);
        } else if (data.length > 0) {
            console.log(`✅ Updated ${data.length} cards for tier ${tier} to limit $${limit}`);
            totalUpdated += data.length;
        }
    }
    console.log(`✨ Credit Limit Fix Complete. Total cards updated: ${totalUpdated}`);
}

async function runCkCleanup() {
    console.log('\n🧹 Starting CK Cleanup (V2 Logic)...');

    // 1. Fetch all CK Records
    const { data: ckRegistry, error: ckError } = await supabase
        .from('ck_registry')
        .select('user_id, created_at');

    if (ckError) {
        console.error('❌ Error fetching CK Registry:', ckError.message);
        return;
    }

    console.log(`ℹ️ Analying ${ckRegistry.length} CK records...`);
    let deletedCredit = 0;
    let deletedDebit = 0;

    for (const ck of ckRegistry) {
        const discordId = ck.user_id;

        // A. Credit Cards (via Citizens)
        const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', discordId).maybeSingle();

        if (!citizen) {
            console.log(`⚠️ Citizen record not found for User ${discordId}. Cannot check credit cards.`);
        } else {
            // 2. Find cards for this citizen created BEFORE ckDate
            const { data: deadCards } = await supabase
                .from('credit_cards')
                .select('id, card_type, created_at')
                .eq('citizen_id', citizen.id)
                .lt('created_at', ck.created_at);

            if (deadCards && deadCards.length > 0) {
                console.log(`🔎 Found ${deadCards.length} dead credit cards for User ${discordId}... Deleting.`);
                const idsToDelete = deadCards.map(c => c.id);
                const { error: delErr } = await supabase.from('credit_cards').delete().in('id', idsToDelete);
                if (!delErr) deletedCredit += idsToDelete.length;
            }
        }

        // B. Debit Cards (via Discord ID)
        const { data: deadDebit } = await supabase
            .from('debit_cards')
            .select('id, created_at')
            .eq('discord_user_id', discordId)
            .lt('created_at', ck.created_at);

        if (deadDebit && deadDebit.length > 0) {
            const idsToDelete = deadDebit.map(c => c.id);
            const { error: delErr } = await supabase.from('debit_cards').delete().in('id', idsToDelete);
            if (!delErr) {
                console.log(`🗑️ Deleted ${idsToDelete.length} OLD debit cards for User ${discordId} (CK: ${ck.created_at})`);
                deletedDebit += idsToDelete.length;
            }
        }
    }

    console.log(`✨ CK Cleanup Complete. Deleted: ${deletedCredit} Credit Cards, ${deletedDebit} Debit Cards.`);
}

async function cleanupOrphanedCards() {
    console.log('\n👻 Starting Orphaned Cards Cleanup...');

    // 1. Get ALL valid citizen IDs
    // Assuming citizens table isn't massive (e.g. < 10k). If massive, pagination needed.
    // For specific task, simplistic fetch is fine.
    const { data: allCitizens, error: citError } = await supabase.from('citizens').select('id');
    if (citError) {
        console.error('❌ Error fetching citizens:', citError.message);
        return;
    }
    const validCitizenIds = new Set(allCitizens.map(c => c.id));
    console.log(`ℹ️ Found ${validCitizenIds.size} valid citizens.`);

    // 2. Scan Credit Cards for invalid citizen_id
    // We fetch in batches or all? Let's verify count.
    const { count } = await supabase.from('credit_cards').select('*', { count: 'exact', head: true });
    console.log(`ℹ️ Total Credit Cards: ${count}`);

    // Fetch all cards (pagination if > 1000)
    let allCards = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('credit_cards')
            .select('id, citizen_id')
            .range(from, from + batchSize - 1);

        if (error) break;
        if (!data || data.length === 0) break;
        allCards = allCards.concat(data);
        from += batchSize;
    }

    // 3. Identify Orphans
    const orphans = allCards.filter(card => !validCitizenIds.has(card.citizen_id));

    if (orphans.length > 0) {
        console.log(`🔎 Found ${orphans.length} ORPHANED credit cards (No citizen owner). Deleting...`);
        const ids = orphans.map(c => c.id);

        // Delete in batches of 100
        let deletedCount = 0;
        for (let i = 0; i < ids.length; i += 100) {
            const batch = ids.slice(i, i + 100);
            const { error: delErr } = await supabase.from('credit_cards').delete().in('id', batch);
            if (delErr) console.error('❌ Delete failed for batch:', delErr.message);
            else deletedCount += batch.length;
        }
        console.log(`🗑️ Successfully deleted ${deletedCount} orphaned cards.`);
    } else {
        console.log('✅ No orphaned credit cards found.');
    }
}

async function main() {
    await fixCreditLimits();
    await cleanupOrphanedCards();
    // await runCkCleanup(); // CK Cleanup relies on existing citizen links, so it's less effective if citizens are gone. Orphans covers it.
}

main();

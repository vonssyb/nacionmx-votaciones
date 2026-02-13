
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from parent directory (since we are in bot/migrations)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase Credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
    console.log('🗳️  Setting up Investigation Vote...');

    // 1. Deactivate all existing elections
    console.log('1️⃣  Deactivating existing elections...');
    const { error: updateError } = await supabase
        .from('elections')
        .update({ is_active: false })
        .eq('is_active', true);

    if (updateError) {
        console.error('❌ Error updating elections:', updateError);
        process.exit(1);
    }

    // 2. Create new election
    console.log('2️⃣  Creating new election: Resolución de Investigación en Curso...');
    const { data: electionData, error: insertError } = await supabase
        .from('elections')
        .insert({
            title: 'Resolución de Investigación en Curso',
            position: 'Referéndum Extraordinario',
            description: 'Votación extraordinaria para definir el futuro político tras la investigación en curso.',
            is_active: true,
            voting_open: true
        })
        .select()
        .single();

    if (insertError) {
        console.error('❌ Error creating election:', insertError);
        process.exit(1);
    }

    const electionId = electionData.id;
    console.log(`✅ Election created with ID: ${electionId}`);

    // 3. Create Candidates/Options
    console.log('3️⃣  Adding voting options...');
    const candidates = [
        {
            election_id: electionId,
            name: 'Movimiento Ciudadano asume el Poder',
            party: 'Resolución A',
            proposals: 'Se reconoce a Movimiento Ciudadano como ganador y asume el poder inmediatamente.',
            photo_url: 'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png',
            logo_url: 'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png'
        },
        {
            election_id: electionId,
            name: 'Repetir Elecciones',
            party: 'Resolución B',
            proposals: 'Se anulan los resultados previos y se convoca a nuevas elecciones generales.',
            photo_url: 'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png',
            logo_url: 'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png'
        }
    ];

    const { error: candidatesError } = await supabase
        .from('election_candidates')
        .insert(candidates);

    if (candidatesError) {
        console.error('❌ Error adding candidates:', candidatesError);
        console.error('⚠️ NOTE: The election was created but candidates failed. You may need to clean up manually.');
        process.exit(1);
    }

    console.log('✅ Candidates added successfully.');
    console.log('🎉 Migration completed! The Investigation Vote is now live.');
}

runMigration();

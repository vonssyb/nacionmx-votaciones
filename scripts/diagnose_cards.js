import { CARD_TIERS } from '../bot/services/EconomyHelper.js';

console.log('🔍 DIAGNOSTICANDO CARD_TIERS...\n');

const testCards = [
    'NMX Start',
    'NMX Básica',
    'NMX Débito',
    'NMX Débito Plus',
    'NMX Débito Gold',
    'NMX Rubí',
    'NMX Zafiro',
    'NMX Esmeralda',
    'NMX Diamante',
    'NMX Centurion'
];

let errors = 0;

testCards.forEach(card => {
    const stats = CARD_TIERS[card];
    if (!stats) {
        console.error(`❌ ERROR: La tarjeta "${card}" NO existe en CARD_TIERS.`);
        errors++;
    } else {
        if (typeof stats.max_balance === 'undefined' && typeof stats.limit === 'undefined') {
            console.error(`❌ ERROR: La tarjeta "${card}" no tiene max_balance ni limit.`);
            errors++;
        } else {
            console.log(`✅ OK: ${card} (Max Balance: ${stats.max_balance}, Limit: ${stats.limit})`);
        }
    }
});

console.log('\n-----------------------------------');
if (errors === 0) {
    console.log('✅ TODAS las tarjetas están definidas correctamente en el código LOCAL.');
    console.log('👉 Si el bot sigue fallando, ES PORQUE NO SE HA ACTUALIZADO EN EL SERVIDOR (REDEPLOY NECESARIO).');
} else {
    console.error(`❌ SE ENCONTRARON ${errors} ERRORES en la definición de tarjetas.`);
}

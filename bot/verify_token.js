require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

console.log('🕵️ Verificando Token de Discord...');
console.log(`🔑 Token en uso (primeros 5 chars): ${process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 5) + '...' : 'NO DEFINIDO'}`);

client.once('ready', () => {
    console.log(`✅ LOGIN EXITOSO! Logueado como ${client.user.tag}`);
    console.log('ℹ️ El token es correcto. El problema podría ser los permisos de la aplicación.');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ LOGIN FALLIDO:');
    console.error(err.message);
    if (err.message.includes('An invalid token was provided')) {
        console.error('👉 TU TOKEN ES INCORRECTO O HA CADUCADO. Necesitas generar uno nuevo en el Portal de Desarrolladores.');
    }
    process.exit(1);
});

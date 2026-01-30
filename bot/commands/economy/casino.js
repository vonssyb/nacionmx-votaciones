const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('🎰 Menú principal y ayuda del Casino NacionMX'),

    async execute(interaction, client, supabase) {
        const embed = new EmbedBuilder()
            .setTitle('🎰 CASINO NACIONMX - GUÍA DE JUEGOS')
            .setDescription('Bienvenido al casino. Aquí tienes la lista de comandos disponibles para jugar y apostar tus fichas.')
            .setColor('#F1C40F')
            .setThumbnail('https://media.discordapp.net/attachments/1094067098670878791/1113567098670878791/casino_logo.png?width=200&height=200') // Placeholder
            .addFields(
                {
                    name: '💳 ECONOMÍA',
                    value: '`/fichas ver` - Ver tu saldo\n`/fichas comprar` - Comprar fichas\n`/fichas vender` - Vender fichas\n`/fichas transferir` - Enviar fichas a otro usuario'
                },
                {
                    name: '🎲 JUEGOS DE MESA (Multiplayer)',
                    value: '`/blackjack` - Juega al 21 contra el dealer (x1.5 / x2.5)\n`/ruleta` - Apuesta a números y colores (x2 - x36)\n`/carrera` - Apuesta a caballos ganadores\n`/coinflip` - Duelo cara o cruz contra otro usuario'
                },
                {
                    name: '🚀 ALTAS APUESTAS (Solitario)',
                    value: '`/minas` - Encuentra diamantes en el campo minado (x1.1 - x50+)\n`/torre` - Escala la torre sin pisar trampas (x1.3 - x20)\n`/crash` - Retírate antes de que el cohete estalle (Pendiente)'
                },
                {
                    name: '⚡ JUEGOS RÁPIDOS',
                    value: '`/dados` - Lanza dados (7, Mayor/Menor, Pares) (x2 - x5)\n`/penales` - Tanda de penales contra el portero (x1.5)\n`/raspa` - Tarjeta de raspar instantánea (x2 - x50)'
                }
            )
            .setFooter({ text: '⚠️ Juega con responsabilidad. El casino siempre tiene una ligera ventaja matemática.' });

        await interaction.reply({ embeds: [embed] });
    }
};

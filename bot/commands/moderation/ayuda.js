const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('📘 Ver comandos de moderación y staff'),

    async execute(interaction, client, supabase) {
        const embed = new EmbedBuilder()
            .setTitle('👮 Centro de Ayuda - Nación MX Portal')
            .setColor(0xFF0000) // Red for moderation
            .setDescription('**Comandos disponibles para Staff y Moderación**\n\n')
            .addFields(
                {
                    name: '🚨 Sanciones',
                    value: '`/sancion` - Aplicar sanciones (SA, warns, bans, blacklists)\n' +
                        '`/ver_sancion` - Consultar historial de sanciones de un usuario\n' +
                        '`/eliminar_sancion` - Eliminar una sanción del historial\n' +
                        '`/convertir_sa` - Convertir warns en SA',
                    inline: false
                },
                {
                    name: '📋 Apelaciones',
                    value: '`/aceptar_apelacion` - Aprobar una apelación pendiente\n' +
                        '`/rechazar_apelacion` - Rechazar una apelación',
                    inline: false
                },
                {
                    name: '⚠️ Warns',
                    value: '`/editar_warn` - Editar motivo de un warn existente\n' +
                        '`/mis_warns` - Ver tus propios warns (cualquier usuario)\n' +
                        '`/ver_warns` - Ver warns de otro usuario (Staff)\n' +
                        '`/limpiar_historial` - Limpiar todos los warns de un usuario',
                    inline: false
                },
                {
                    name: '👮 Staff',
                    value: '`/rol` - Asignar roles de facciones o trabajo\n' +
                        '`/multa` - Aplicar multa a un usuario\n' +
                        '`/licencia` - Registrar/verificar licencias de conducir\n' +
                        '`/sesion` - Registro de sesiones de staff\n' +
                        '`/fichar` - Buscar antecedentes penales',
                    inline: false
                },
                {
                    name: '⚙️ Utilidades',
                    value: '`/ping` - Ver latencia del bot\n' +
                        '`/info` - Información del servidor\n' +
                        '`/ayuda` - Mostrar este menú',
                    inline: false
                }
            )
            .setFooter({ text: 'Nación MX Portal • Bot de Moderación' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};

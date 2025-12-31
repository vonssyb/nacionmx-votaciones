const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mis_warns')
        .setDescription('Ver mi historial de sanciones y warns activos'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            if (!interaction.client.services || !interaction.client.services.sanctions) {
                return interaction.editReply('❌ El servicio de sanciones no está disponible.');
            }

            const sanctions = await interaction.client.services.sanctions.getUserSanctions(interaction.user.id);
            const counts = await interaction.client.services.sanctions.getSanctionCounts(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor('#FFD700') // Gold for Warning
                .setTitle(`📂 Mi Historial de Sanciones`)
                .setDescription(`Aquí están tus sanciones activas en **${interaction.guild.name}**.`)
                .addFields(
                    { name: '📊 Resumen', value: `Warns: **${counts.general}** | SAs: **${counts.sa}** | Notificaciones: **${counts.notificacion}**`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Sistema de Sanciones Nación MX' });

            if (sanctions && sanctions.length > 0) {
                // Show last 5 to avoid overflow
                const recentSanctions = sanctions.slice(0, 5);
                let descriptionList = '';

                recentSanctions.forEach(s => {
                    const icon = s.type === 'general' ? '📜' : (s.type === 'sa' ? '🚨' : '📢');
                    const date = new Date(s.created_at).toLocaleDateString('es-MX');
                    const evidenceLink = s.evidence_url ? ` [📸 Ver Evidencia](${s.evidence_url})` : '';
                    const expiration = s.expires_at ? ` (Expira: ${new Date(s.expires_at).toLocaleDateString('es-MX')})` : '';
                    descriptionList += `**${icon} [${date}]**${evidenceLink} - ${s.reason}${expiration}\n`;
                });

                embed.addFields({ name: '📝 Últimos Registros', value: descriptionList || 'Sin detalles.' });
            } else {
                embed.addFields({ name: '✅ Estado', value: 'No tienes sanciones activas. ¡Sigue así!' });
                embed.setColor('#00FF00'); // Green for clean
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al obtener tu historial.');
        }
    }
};

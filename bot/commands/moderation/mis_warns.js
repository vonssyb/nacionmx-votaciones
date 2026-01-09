const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mis_warns')
        .setDescription('Ver mi historial de sanciones y warns activos'),

    async execute(interaction) {
        // await interaction.deferReply({ flags: [64] });

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
                    let icon = '📜';
                    let displayType = s.action_type || (s.type === 'general' ? 'Sanción' : 'Notificación');

                    if (s.type === 'sa') { icon = '🚨'; displayType = 'SA'; }
                    else if (s.type === 'notificacion') { icon = '📢'; displayType = 'Notif'; }

                    if (displayType.toLowerCase().includes('blacklist')) icon = '⛔';
                    if (displayType.toLowerCase().includes('ban')) icon = '🔨';

                    const date = new Date(s.created_at).toLocaleDateString('es-MX');
                    const evidenceLink = s.evidence_url ? ` [📸 Ver Evidencia](${s.evidence_url})` : '';
                    const descriptionText = s.description ? `\n> *${s.description}*` : '';
                    const expiration = s.expires_at ? ` | ⏳ Expira: ${new Date(s.expires_at).toLocaleDateString('es-MX')}` : '';
                    // Truncate logic to avoid "Invalid string length" (Limit 1024)
                    // We need enough space for the Ref + Description
                    let baseLine = `**${icon} ${displayType}** [${date}]${evidenceLink} - **Ref:** ${s.reason}${expiration}`;

                    // Truncate reason if too long
                    if (baseLine.length > 900) {
                        baseLine = baseLine.substring(0, 900) + '...';
                    }

                    descriptionText = s.description ? `\n> *${s.description}*` : '';
                    if (descriptionText.length > 100) {
                        descriptionText = descriptionText.substring(0, 100) + '...*';
                    }

                    let line = `${baseLine}${descriptionText}\n`;

                    if (s.status === 'appealed') {
                        line = `✨ **[APELADA]** ${line}`;
                    }
                    descriptionList += line;
                });

                embed.addFields({ name: '📝 Últimos Registros', value: descriptionList || 'Sin detalles.' });

                // Check for truncation flag
                // We actually implemented truncation in the loop but didn't track a global flag. 
                // Let's rely on checking if any part was truncated in a clearer way or just always offer the file if list > 5 or long text?
                // Cleaner: Generate the file content during the loop.

            } else {
                embed.addFields({ name: '✅ Estado', value: 'No tienes sanciones activas. ¡Sigue así!' });
                embed.setColor('#00FF00'); // Green for clean
            }

            // --- FULL TRANSCRIPT GENERATION ---
            const files = [];
            // If we have sanctions, generate a full readable report
            if (sanctions && sanctions.length > 0) {
                const fullReport = sanctions.map(s => {
                    const date = new Date(s.created_at).toLocaleDateString('es-MX');
                    const time = new Date(s.created_at).toLocaleTimeString('es-MX');
                    const type = s.action_type || s.type;
                    const evidence = s.evidence_url || 'N/A';
                    const expiration = s.expires_at ? new Date(s.expires_at).toLocaleDateString('es-MX') : 'Permanente';

                    return `[${date} ${time}] ${type.toUpperCase()}\n----------------------------------------\nRazón: ${s.reason}\nDescripción: ${s.description || 'N/A'}\nEvidencia: ${evidence}\nExpira: ${expiration}\nID Sanción: ${s.id}\n\n`;
                }).join('');

                // Attach if list is long OR if we truncated stuff (hard to track exact truncation state without var, but safe to just provide it for detailed reading)
                // Let's always provide it if there are more than 3 items or lengthy text.
                // For now, let's provide it always if there are *any* sanctions, as "Historial Completo.txt"
                const buffer = Buffer.from(fullReport, 'utf-8');
                const attachment = new AttachmentBuilder(buffer, { name: `Historial_Sanciones_${interaction.user.username}.txt` });
                files.push(attachment);
            }

            await interaction.editReply({ embeds: [embed], files: files });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al obtener tu historial.');
        }
    }
};

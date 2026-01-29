const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rol')
        .setDescription('🎭 Gestión de Roles RP y Reportes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancelar')
                .setDescription('Reportar cancelación de rol de un usuario (Bad RP)')
                .addStringOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario sancionado - Nombre o Discord ID')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('razon')
                        .setDescription('Motivo de la cancelación del rol')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('ubicacion')
                        .setDescription('Lugar donde ocurrió (ciudad, coordenadas, etc.)')
                        .setRequired(true))
                .addAttachmentOption(option =>
                    option.setName('prueba1')
                        .setDescription('Evidencia principal - Imagen/Video')
                        .setRequired(true))
                .addAttachmentOption(option =>
                    option.setName('prueba2')
                        .setDescription('Evidencia secundaria - Imagen/Video (Opcional)')
                        .setRequired(false))
        ),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({ flags: [64] }); // Ephemeral

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'cancelar') {
            const usuario = interaction.options.getString('usuario');
            const razon = interaction.options.getString('razon');
            const ubicacion = interaction.options.getString('ubicacion');
            const prueba1 = interaction.options.getAttachment('prueba1');
            const prueba2 = interaction.options.getAttachment('prueba2');

            const REPORT_CHANNEL_ID = '1456035521141670066'; // Security/Sanctions Channel

            try {
                // Create report embed
                const reportEmbed = new EmbedBuilder()
                    .setTitle('🚫 REPORTE: Cancelación de Rol (Bad RP)')
                    .setColor('#E74C3C')
                    .addFields(
                        { name: '👤 Usuario Reportado', value: usuario, inline: true },
                        { name: '📍 Ubicación', value: ubicacion, inline: true },
                        { name: '👮 Reportado por', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
                        { name: '📝 Razón', value: razon, inline: false },
                        { name: '🔗 Evidencia', value: prueba2 ? 'Ver imágenes adjuntas' : 'Ver imagen adjunta', inline: false }
                    )
                    .setFooter({ text: 'Sistema de Reportes - Nación MX' })
                    .setTimestamp();

                // Set primary evidence as embed image
                if (prueba1) {
                    reportEmbed.setImage(prueba1.url);
                }

                // Send to report channel via LogManager
                if (client.services && client.services.logManager) {
                    // Add second evidence if exists (Logic in LogManager handles single embed usually, 
                    // but here we might want multiple. LogManager.log takes ONE embed.
                    // We can just log twice or modify LogManager? 
                    // Or just rely on the first embed. 'prueba2' is optional.
                    // Let's keep it simple: Log the main embed. If prueba2 exists, we might miss it if LogManager doesn't support arrays.
                    // The original code sent a payload { embeds: [e1, e2] }.
                    // My LogManager.log implementation takes ONE embed.
                    // I should probably update LogManager to accept an array of embeds OR just send one for now.
                    // Given the constraint, I'll send the second evidence as a second log or just ignore it for now/append link to description.

                    if (prueba2) {
                        reportEmbed.addFields({ name: '📎 Evidencia 2', value: `[Ver Imagen](${prueba2.url})`, inline: false });
                    }

                    const success = await client.services.logManager.log('REPORT', reportEmbed);

                    if (success) {
                        // Confirm to reporter
                        await interaction.editReply({
                            content: '✅ **Reporte de Cancelación enviado exitosamente**\n\n' +
                                '📬 El equipo de moderación ha sido notificado.\n' +
                                '📊 Tu reporte ha sido registrado en el canal de seguridad.\n\n' +
                                `🆔 Usuario: **${usuario}**\n` +
                                `📍 Ubicación: **${ubicacion}**`
                        });

                        // Log to audit
                        await client.services.logManager.logAudit(
                            'Rol Cancelado (Bad RP)',
                            `Usuario afectado: ${usuario}\nUbicación: ${ubicacion}\nRazón: ${razon}`,
                            interaction.user
                        );
                    } else {
                        await interaction.editReply('❌ Error: No se pudo enviar al canal de reportes (LogManager fetch failed).');
                    }

                } else {
                    // Fallback if LogManager missing
                    await interaction.editReply('❌ Error: Servicio de LogManager no disponible.');
                }

            } catch (error) {
                console.error('[rol cancelar] Error:', error);
                await interaction.editReply('❌ Error al enviar el reporte. Contacta a un administrador.');
            }
        }
    }
};

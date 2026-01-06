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
        await interaction.deferReply({ flags: [64] }); // Ephemeral

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

                // Send to report channel
                const channel = await client.channels.fetch(REPORT_CHANNEL_ID);
                if (channel) {
                    const messagePayload = { embeds: [reportEmbed] };

                    // If there's a second evidence, attach it separately
                    if (prueba2) {
                        const secondEvidenceEmbed = new EmbedBuilder()
                            .setTitle('📎 Evidencia Secundaria')
                            .setImage(prueba2.url)
                            .setColor('#95A5A6');
                        messagePayload.embeds.push(secondEvidenceEmbed);
                    }

                    await channel.send(messagePayload);

                    // Confirm to reporter
                    await interaction.editReply({
                        content: '✅ **Reporte de Cancelación enviado exitosamente**\n\n' +
                            '📬 El equipo de moderación ha sido notificado.\n' +
                            '📊 Tu reporte ha sido registrado en el canal de seguridad.\n\n' +
                            `🆔 Usuario: **${usuario}**\n` +
                            `📍 Ubicación: **${ubicacion}**`
                    });

                    // Log to audit
                    await client.logAudit(
                        'Rol Cancelado (Bad RP)',
                        `Usuario afectado: ${usuario}\nUbicación: ${ubicacion}\nRazón: ${razon}`,
                        interaction.user,
                        null,
                        0xE74C3C
                    );

                } else {
                    await interaction.editReply('❌ Error: No se pudo encontrar el canal de reportes.');
                }

            } catch (error) {
                console.error('[rol cancelar] Error:', error);
                await interaction.editReply('❌ Error al enviar el reporte. Contacta a un administrador.');
            }
        }
    }
};

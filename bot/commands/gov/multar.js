const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multar')
        .setDescription('🚦 Multar por infracción de tránsito')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a multar')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('foto')
                .setDescription('Evidencia fotográfica de la infracción')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('articulo')
                .setDescription('Artículo del Código de Tránsito (ej: 60, 61, 62)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('observaciones')
                .setDescription('Detalles adicionales de la infracción')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({});

        const FINE_CHANNEL_ID = '1398888981655064607';
        const FINE_LOGS_CHANNEL_ID = '1457583225085100283';
        const TRANSIT_ROLE_ID = '1416867605976715363'; // Policía de Tránsito / Federal

        const FINE_ARTICLE = 'Art. 60'; // Conducción Temeraria
        const FINE_AMOUNT = 2000;

        try {
            // 1. Validate channel
            if (interaction.channelId !== FINE_CHANNEL_ID) {
                return interaction.editReply({
                    content: `❌ **Canal Incorrecto**\n\nEste comando solo puede usarse en <#${FINE_CHANNEL_ID}>.`,
                    flags: [64]
                });
            }

            // 2. Validate permissions (only Transit Police)
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasTransitRole = member.roles.cache.has(TRANSIT_ROLE_ID);

            if (!hasTransitRole) {
                return interaction.editReply({
                    content: '❌ **Sin Autorización**\n\nSolo la Policía de Tránsito puede emitir multas.',
                    flags: [64]
                });
            }

            // 3. Get options
            const targetUser = interaction.options.getUser('usuario');
            const evidencia = interaction.options.getAttachment('foto');
            const observaciones = interaction.options.getString('observaciones') || 'Ninguna';
            const articuloInput = interaction.options.getString('articulo') || '60';

            const { calculateSentence } = require('../../data/penalCode');
            const sentence = calculateSentence(articuloInput);
            const calcFine = sentence.totalFine || 2000;
            const calcArt = sentence.reason || `Art. ${articuloInput}`;

            // 4. Validate target
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ No puedes multarte a ti mismo.',
                    flags: [64]
                });
            }

            // 5. Deduct money
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubToken = process.env.UNBELIEVABOAT_TOKEN;

            if (!ubToken) {
                return interaction.editReply('❌ Error de configuración del bot.');
            }

            const ubService = new UnbelievaBoatService(ubToken);

            try {
                await ubService.removeMoney(
                    interaction.guildId,
                    targetUser.id,
                    calcFine,
                    0, // From cash
                    `Multa de tránsito: ${calcArt}`
                );
            } catch (ubError) {
                console.error('[multar] UB error:', ubError);
                return interaction.editReply(`❌ Error al procesar multa: ${ubError.message}`);
            }

            // 6. Save to database
            await supabase.from('traffic_fines').insert({
                guild_id: interaction.guildId,
                user_id: targetUser.id,
                user_tag: targetUser.tag,
                issued_by: interaction.user.id,
                issued_by_tag: interaction.user.tag,
                article: calcArt,
                fine_amount: calcFine,
                observations: observaciones,
                evidence_url: evidencia.url
            });

            // 7. Send DM to fined user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚦 MULTA DE TRÁNSITO')
                    .setColor('#FFA500')
                    .setDescription('Has recibido una infracción de tránsito.')
                    .addFields(
                        { name: '📜 Artículo', value: calcArt, inline: true },
                        { name: '💰 Monto', value: `$${calcFine.toLocaleString()}`, inline: true },
                        { name: '👮 Oficial', value: `${interaction.user.tag}`, inline: false }
                    )
                    .setFooter({ text: 'Paga tu multa y cumple las normas de tránsito' })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('[multar] Could not DM user:', dmError.message);
            }

            // 8. Public embed
            const publicEmbed = new EmbedBuilder()
                .setTitle('🚦 MULTA DE TRÁNSITO')
                .setColor('#FFA500')
                .addFields(
                    { name: '👤 Infractor', value: `<@${targetUser.id}>`, inline: true },
                    { name: '👮 Oficial', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '📜 Artículo', value: calcArt, inline: true },
                    { name: '💰 Monto', value: `$${calcFine.toLocaleString()}`, inline: true },
                    { name: '📝 Observaciones', value: observaciones, inline: false }
                )
                .setImage(evidencia.url)
                .setFooter({ text: 'Nación MX | Policía de Tránsito' })
                .setTimestamp();

            await interaction.editReply({ embeds: [publicEmbed] });

            // 9. Send to logs
            const logsChannel = await client.channels.fetch(FINE_LOGS_CHANNEL_ID);
            if (logsChannel) {
                await logsChannel.send({ embeds: [publicEmbed] });
            }

            // Report Misión Diaria
            if (client.missionManager) {
                // "Multa" counts as traffic stop or citation
                await client.missionManager.reportProgress(interaction.user.id, 'traffic_stop', 1);
            }

        } catch (error) {
            console.error('[multar] Error:', error);
            await interaction.editReply('❌ Error al procesar la multa. Contacta a un administrador.');
        }
    }
};

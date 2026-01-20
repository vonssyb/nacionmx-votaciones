const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpiar_historial')
        .setDescription('Archivar sanciones antiguas (Clean Slate) para un usuario')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario al que se le limpiará el historial')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('meses')
                .setDescription('Archivar sanciones más antiguas de X meses (Por defecto: 6)')
                .setRequired(false)),

    async execute(interaction) {
        // await interaction.deferReply({ flags: [64] });

        // Security Check: Only Admins (Double Check)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('🛑 No tienes permisos para usar este comando.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const months = interaction.options.getInteger('meses') || 6;

        try {
            if (!interaction.client.services || !interaction.client.services.sanctions) {
                return interaction.editReply('❌ El servicio de sanciones no está disponible.');
            }

            // SELF-ACTION DETECTION
            if (targetUser.id === interaction.user.id) {
                const SelfActionService = require('../../services/SelfActionService');
                const selfActionService = new SelfActionService(interaction.client, interaction.client.supabase);

                if (!selfActionService.canApproveSelfAction(interaction.member)) {
                    const requestId = `${Date.now()}_${interaction.user.id}`;
                    await selfActionService.requestSuperiorApproval({
                        actionType: 'history_clear',
                        executor: interaction.user,
                        target: targetUser,
                        guildId: interaction.guildId,
                        details: `Intento de auto-limpieza de historial\nCriterio: Sanciones mayores a ${months} meses`,
                        approveButtonId: `sa_approve_clearhistory_${requestId}_${months}`,
                        rejectButtonId: `sa_reject_clearhistory_${requestId}`,
                        metadata: {
                            months: months
                        }
                    });

                    return interaction.editReply('⚠️ **Auto-Limpieza de Historial Detectada**\n\nNo puedes limpiar tu propio historial sin aprobación.\nSe ha enviado una solicitud a un superior para revisión.');
                }
                console.log(`[SelfAction] Superior ${interaction.user.tag} self-clearing history - Allowed`);
            }

            // Perform Archive
            const archivedCount = await interaction.client.services.sanctions.archiveOldSanctions(targetUser.id, months);

            if (archivedCount > 0) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('🧹 Historial Limpiado (Clean Slate)')
                    .setDescription(`Se han archivado exitosamente **${archivedCount}** sanciones antiguas de ${targetUser.tag}.`)
                    .addFields(
                        { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
                        { name: '📅 Antigüedad', value: `Más de ${months} meses`, inline: true },
                        { name: '🔒 Estado', value: 'Las sanciones han pasado a estado "archived".', inline: false }
                    )
                    .setColor(0x00FF00) // Green
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // AUDIT LOG
                if (interaction.client.logAudit) {
                    await interaction.client.logAudit(
                        'Clean Slate Ejecutado',
                        `**Admin:** ${interaction.user.tag}\n**Objetivo:** ${targetUser.tag}\n**Sanciones Archivadas:** ${archivedCount}\n**Criterio:** > ${months} meses`,
                        interaction.user,
                        targetUser,
                        0x00FF00
                    );
                }

                // Optional: Notify User
                try {
                    await targetUser.send({
                        content: `🎉 **¡Buenas noticias!**\nTu historial de sanciones en **${interaction.guild.name}** ha sido depurado.\nSe han archivado **${archivedCount}** sanciones antiguas (más de ${months} meses) debido a tu buena conducta reciente.`
                    });
                } catch (e) { /* Ignore DM fail */ }

            } else {
                await interaction.editReply(`ℹ️ No se encontraron sanciones activas de tipo 'general' con más de **${months} meses** de antigüedad para ${targetUser.tag}.`);
            }

        } catch (error) {
            console.error('Error in limpiar_historial:', error);
            await interaction.editReply('❌ Ocurrió un error al intentar limpiar el historial.');
        }
    }
};

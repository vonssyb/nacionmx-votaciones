const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagBits } = require('discord.js');
const logger = require('../../services/Logger');

const LOG_CHANNEL = '1457457209268109516'; // Canal de logs de ausencias

module.exports = {
    data: new SlashCommandBuilder()
        .setName('actualizar-ausencias')
        .setDescription('🔧 [ADMIN] Agregar botón de finalización a ausencias antiguas')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Cantidad de mensajes a revisar (máximo 100)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagBits.Administrator),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const limit = interaction.options.getInteger('cantidad') || 50;

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);

            if (!logChannel) {
                return interaction.editReply('❌ No se pudo encontrar el canal de logs de ausencias.');
            }

            // Fetch recent messages
            const messages = await logChannel.messages.fetch({ limit });

            let updated = 0;
            let skipped = 0;

            for (const [, message] of messages) {
                // Check if it's a bot message with an absence embed
                if (message.author.id !== client.user.id) {
                    skipped++;
                    continue;
                }

                if (message.embeds.length === 0) {
                    skipped++;
                    continue;
                }

                const embed = message.embeds[0];

                // Check if it's an absence format
                if (!embed.title?.includes('Formato de Inactividad')) {
                    skipped++;
                    continue;
                }

                // Check if it already has buttons
                if (message.components.length > 0) {
                    skipped++;
                    continue;
                }

                // Extract user from embed
                const nameField = embed.fields.find(f => f.name.includes('Nombre en el servidor'));
                const plateField = embed.fields.find(f => f.name.includes('Placa de Staff'));

                if (!nameField || !plateField) {
                    skipped++;
                    continue;
                }

                // Try to find user ID from the embed
                // Usually the plate field has the user tag, we need to find the actual user
                const guildMembers = await interaction.guild.members.fetch();
                const targetMember = guildMembers.find(m =>
                    m.displayName === nameField.value ||
                    m.user.tag === plateField.value
                );

                if (!targetMember) {
                    skipped++;
                    continue;
                }

                // Add button
                const terminateButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`end_absence_${targetMember.id}_${interaction.user.id}`)
                        .setLabel('❌ Finalizar Ausencia Anticipadamente')
                        .setStyle(ButtonStyle.Danger)
                );

                try {
                    await message.edit({
                        embeds: message.embeds,
                        components: [terminateButton]
                    });
                    updated++;
                } catch (e) {
                    logger.warn(`Failed to update message ${message.id}: ${e.message}`);
                    skipped++;
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Actualización de Ausencias Completada')
                .setDescription(`Se revisaron **${messages.size}** mensajes en el canal de logs.`)
                .addFields(
                    { name: '✅ Actualizados', value: updated.toString(), inline: true },
                    { name: '⏭️ Omitidos', value: skipped.toString(), inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            logger.errorWithContext('Error actualizando ausencias', error, interaction);
            await interaction.editReply('❌ Ocurrió un error al actualizar las ausencias.');
        }
    }
};

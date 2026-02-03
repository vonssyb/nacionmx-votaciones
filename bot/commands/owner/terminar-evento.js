const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const EventService = require('../../services/EventService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('terminar-evento')
        .setDescription('🔧 [ADMIN] Termina el evento activo del servidor manualmente')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, supabase) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Check if there's an active event
            const activeEvent = await EventService.getActiveEvent(supabase);
            if (!activeEvent) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ No hay eventos activos')
                        .setDescription('No hay ningún evento en curso para terminar.')
                        .setFooter({ text: 'Usa /forzar-evento para iniciar uno' })
                    ]
                });
            }

            // End the event
            const success = await EventService.endEvent(
                activeEvent.id,
                client,
                null, // Announcement channel handled by Service
                supabase
            );

            if (!success) {
                return interaction.editReply('❌ Error al terminar el evento.');
            }

            // Confirmation
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Evento Terminado')
                    .setDescription(`**${activeEvent.event_name}** ha sido finalizado manualmente.`)
                    .setFooter({ text: `Terminado por ${interaction.user.tag}` })
                    .setTimestamp()
                ]
            });

        } catch (error) {
            console.error('Error in terminar-evento:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al terminar el evento.', embeds: [] }
                : { content: '❌ Error al terminar el evento.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

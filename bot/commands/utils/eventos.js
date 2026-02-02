const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventService = require('../../services/EventService');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventos')
        .setDescription('Ver el evento activo del servidor'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const activeEvent = await EventService.getActiveEvent();

            if (!activeEvent) {
                const embed = new EmbedBuilder()
                    .setColor(0x9E9E9E)
                    .setTitle('📅 Sin Eventos Activos')
                    .setDescription('No hay eventos activos en este momento.\n\n🎲 Los eventos aparecen aleatoriamente y traen bonificaciones especiales para todos los jugadores.')
                    .setTimestamp()
                    .setFooter({ text: 'Sistema de Eventos' });

                return interaction.editReply({ embeds: [embed] });
            }

            const eventInfo = EventService.getEventInfo(activeEvent);

            const embed = new EmbedBuilder()
                .setColor(0x4CAF50)
                .setTitle(`${eventInfo.emoji} ${activeEvent.event_name}`)
                .setDescription(activeEvent.description)
                .addFields(
                    {
                        name: '📊 Efectos',
                        value: eventInfo.multiplier !== 1.0
                            ? `Multiplicador: **${eventInfo.multiplier}x**`
                            : 'Efectos especiales activos',
                        inline: true
                    },
                    {
                        name: '⏱️ Tiempo Restante',
                        value: `<t:${eventInfo.endTimestamp}:R>`,
                        inline: true
                    }
                )
                .setTimestamp()
                .setFooter({ text: '¡Aprovecha el evento antes de que termine!' });

            // Add tips based on event type
            let tip = '';
            switch (activeEvent.event_type) {
                case 'DOUBLE_SALARY':
                    tip = '💡 **Consejo:** ¡Usa `/fichar` ahora para obtener el doble de sueldo!';
                    break;
                case 'CASINO_LUCK':
                    tip = '💡 **Consejo:** Los juegos de casino tienen mejores probabilidades.';
                    break;
                case 'DOUBLE_XP':
                    tip = '💡 **Consejo:** ¡Realiza actividades para ganar el doble de experiencia!';
                    break;
                case 'FESTIVAL':
                    tip = '💡 **Consejo:** Todas las actividades tienen bonos aleatorios.';
                    break;
                case 'RUSH_HOUR':
                    tip = '💡 **Consejo:** Los cooldowns están reducidos.';
                    break;
                case 'CRISIS':
                    tip = '💡 **Consejo:** Momento perfecto para ahorrar o invertir.';
                    break;
            }

            if (tip) {
                embed.addFields({
                    name: '\u200b',
                    value: tip,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in eventos command:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al obtener información del evento.', embeds: [] }
                : { content: '❌ Error al obtener información del evento.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

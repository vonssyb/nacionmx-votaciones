const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const EventService = require('../../services/EventService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forzar-evento')
        .setDescription('🔧 [ADMIN] Fuerza el inicio de un evento del servidor')
        .addStringOption(option =>
            option
                .setName('tipo')
                .setDescription('Tipo de evento a iniciar')
                .setRequired(true)
                .addChoices(
                    // Eventos Positivos - Economía
                    { name: '💰 Doble Sueldo', value: 'DOUBLE_SALARY' },
                    { name: '💵 Boom Económico (x3 sueldo)', value: 'TRIPLE_WORK' },
                    { name: '🌟 Hora Dorada (x2.5 todo)', value: 'GOLDEN_HOUR' },
                    { name: '💎 Lluvia de Diamantes', value: 'MILLIONAIRE_RAIN' },
                    // Eventos Positivos - Casino/Suerte
                    { name: '🎰 Suerte de Casino', value: 'CASINO_LUCK' },
                    { name: '🎲 Fiebre de Jackpot', value: 'JACKPOT_FEVER' },
                    { name: '🍀 Día de Suerte', value: 'LUCKY_DAY' },
                    // Eventos Positivos - XP
                    { name: '⭐ Doble Experiencia', value: 'DOUBLE_XP' },
                    { name: '🌠 Mega Experiencia (x3)', value: 'MEGA_XP' },
                    // Eventos Positivos - Generales
                    { name: '🎉 Festival de la Ciudad', value: 'FESTIVAL' },
                    { name: '⚡ Hora Pico', value: 'RUSH_HOUR' },
                    { name: '🍻 Hora Feliz', value: 'HAPPY_HOUR' },
                    // Eventos Negativos - Economía
                    { name: '📉 Crisis Económica', value: 'CRISIS' },
                    { name: '📊 Inflación Galopante', value: 'INFLATION' },
                    { name: '💸 Temporada de Impuestos', value: 'TAX_SEASON' },
                    { name: '💔 Colapso del Mercado', value: 'MARKET_CRASH' },
                    // Eventos Negativos - Mala Suerte
                    { name: '🌧️ Mala Racha', value: 'BAD_LUCK' },
                    { name: '😈 Día Maldito', value: 'CURSED_DAY' },
                    // Eventos Especiales
                    { name: '🎭 Modo Caos', value: 'CHAOS_MODE' },
                    { name: '🎫 Locura de Lotería', value: 'LOTTERY_MANIA' },
                    { name: '❓ Evento Misterioso', value: 'MYSTERY_EVENT' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('duracion')
                .setDescription('Duración del evento en horas (opcional, usa duración por defecto)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(24)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, supabase) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const eventType = interaction.options.getString('tipo');
            const customDuration = interaction.options.getInteger('duracion');

            // Check if there's already an active event
            const activeEvent = await EventService.getActiveEvent(supabase);
            if (activeEvent) {
                const eventInfo = EventService.getEventInfo(activeEvent);
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('❌ Ya hay un evento activo')
                        .setDescription(`**${eventInfo.name}**\\n${eventInfo.description}`)
                        .addFields({
                            name: '⏱️ Tiempo Restante',
                            value: `<t:${eventInfo.endTimestamp}:R>`,
                            inline: true
                        })
                        .setFooter({ text: 'Espera a que termine o usa /terminar-evento para finalizarlo' })
                    ]
                });
            }

            const eventConfig = EventService.eventTypes[eventType];
            if (!eventConfig) {
                return interaction.editReply('❌ Tipo de evento inválido.');
            }

            const moment = require('moment-timezone');
            const now = moment().tz('America/Mexico_City');
            const duration = customDuration || eventConfig.duration;
            const endTime = now.clone().add(duration, 'hours');

            // Create event in database
            const { data: newEvent, error } = await supabase
                .from('server_events')
                .insert([{
                    event_type: eventType,
                    event_name: eventConfig.name,
                    description: eventConfig.description,
                    multiplier: eventConfig.multiplier,
                    event_data: { emoji: eventConfig.emoji },
                    start_time: now.toISOString(),
                    end_time: endTime.toISOString(),
                    is_active: true,
                    created_by: interaction.user.id
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating event:', error);
                return interaction.editReply('❌ Error al crear el evento.');
            }

            // Announce in channel
            // Channel is now hardcoded in EventService
            try {
                await EventService.announceEvent(client, null, newEvent, 'start');
            } catch (announceError) {
                console.error('Error announcing event:', announceError);
            }

            // Schedule event end
            const durationMs = duration * 60 * 60 * 1000;
            setTimeout(async () => {
                await EventService.endEvent(newEvent.id, client, null, supabase);
            }, durationMs);

            // Confirmation embed
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Evento Iniciado Manualmente')
                    .setDescription(`**${eventConfig.name}**\\n${eventConfig.description}`)
                    .addFields(
                        {
                            name: '⏱️ Duración',
                            value: `${duration} hora${duration > 1 ? 's' : ''}`,
                            inline: true
                        },
                        {
                            name: '📊 Multiplicador',
                            value: `**${eventConfig.multiplier}x**`,
                            inline: true
                        },
                        {
                            name: '⏰ Finaliza',
                            value: `<t:${Math.floor(endTime.valueOf() / 1000)}:R>`,
                            inline: true
                        }
                    )
                    .setFooter({ text: `Iniciado por ${interaction.user.tag}` })
                    .setTimestamp()
                ]
            });

        } catch (error) {
            console.error('Error in forzar-evento:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al forzar el evento.', embeds: [] }
                : { content: '❌ Error al forzar el evento.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

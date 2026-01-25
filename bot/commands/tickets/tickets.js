const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Gestión administrativa de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('Ver estadísticas de tickets'))
        .addSubcommand(sub => sub
            .setName('close-old')
            .setDescription('Cerrar tickets inactivos por X días')
            .addIntegerOption(opt => opt
                .setName('days')
                .setDescription('Días de inactividad')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(30)))
        .addSubcommand(sub => sub
            .setName('purge-closed')
            .setDescription('Eliminar canales de tickets cerrados hace X días')
            .addIntegerOption(opt => opt
                .setName('days')
                .setDescription('Días desde el cierre')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(90)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Listar todos los tickets')
            .addStringOption(opt => opt
                .setName('status')
                .setDescription('Filtrar por estado')
                .setRequired(false)
                .addChoices(
                    { name: 'Abiertos', value: 'OPEN' },
                    { name: 'Cerrados', value: 'CLOSED' },
                    { name: 'Esperando Valoración', value: 'AWAITING_RATING' }
                ))),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'stats') {
            await interaction.deferReply();

            const cleanupService = client.services?.ticketCleanup;
            if (!cleanupService) {
                return interaction.editReply('❌ Servicio de limpieza no disponible');
            }

            const stats = await cleanupService.getStats();

            const embed = new EmbedBuilder()
                .setTitle('📊 Estadísticas de Tickets')
                .addFields(
                    { name: '📂 Tickets Abiertos', value: `${stats.open}`, inline: true },
                    { name: '📅 Cerrados Hoy', value: `${stats.closedToday}`, inline: true },
                    { name: '📆 Cerrados (Semana)', value: `${stats.closedWeek}`, inline: true },
                    { name: '📊 Cerrados (Mes)', value: `${stats.closedMonth}`, inline: true },
                    { name: '⭐ Rating Promedio', value: `${stats.avgRating}`, inline: true },
                    { name: '🤖 Resueltos por IA', value: `${stats.aiResolved}`, inline: true }
                )
                .setColor(0x5865F2)
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'close-old') {
            await interaction.deferReply();

            const days = interaction.options.getInteger('days');
            const hours = days * 24;

            const now = new Date();
            const threshold = new Date(now.getTime() - (hours * 60 * 60 * 1000));

            const { data: tickets } = await supabase
                .from('tickets')
                .select('*')
                .eq('status', 'OPEN')
                .lt('last_active_at', threshold.toISOString());

            if (!tickets || tickets.length === 0) {
                return interaction.editReply(`✅ No hay tickets inactivos por más de ${days} días.`);
            }

            let closed = 0;
            const discordTranscripts = require('discord-html-transcripts');

            for (const ticket of tickets) {
                try {
                    const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
                    if (!channel) continue;

                    // Generate transcript
                    const attachment = await discordTranscripts.createTranscript(channel, {
                        limit: -1,
                        returnType: 'attachment',
                        filename: `bulk-close-${channel.name}.html`,
                        saveImages: true
                    });

                    // Send to user
                    if (ticket.creator_id) {
                        try {
                            const creator = await client.users.fetch(ticket.creator_id);
                            await creator.send({
                                content: `🔒 Tu ticket fue cerrado por inactividad (${days}+ días).`,
                                files: [attachment]
                            });
                        } catch (e) { }
                    }

                    // Update DB
                    await supabase
                        .from('tickets')
                        .update({
                            status: 'CLOSED',
                            closed_at: now.toISOString(),
                            closure_reason: `bulk_close_${days}d`,
                            closed_by_id: interaction.user.id
                        })
                        .eq('id', ticket.id);

                    // Delete channel
                    await channel.delete(`Bulk close: ${days}+ days inactive`);
                    closed++;
                } catch (err) {
                    console.error(`Error closing ticket #${ticket.id}:`, err.message);
                }
            }

            return interaction.editReply(`✅ Se cerraron **${closed}** tickets inactivos por más de ${days} días.`);
        }

        if (subcommand === 'purge-closed') {
            await interaction.deferReply();

            const days = interaction.options.getInteger('days');

            const cleanupService = client.services?.ticketCleanup;
            if (!cleanupService) {
                return interaction.editReply('❌ Servicio de limpieza no disponible');
            }

            const deleted = await cleanupService.purgeClosedChannels(days);

            return interaction.editReply(`✅ Se eliminaron **${deleted}** canales de tickets cerrados hace más de ${days} días.`);
        }

        if (subcommand === 'list') {
            await interaction.deferReply({ ephemeral: true });

            const status = interaction.options.getString('status') || 'OPEN';

            let query = supabase.from('tickets').select('*').eq('status', status);

            const { data: tickets } = await query.limit(20);

            if (!tickets || tickets.length === 0) {
                return interaction.editReply(`No hay tickets con estado **${status}**.`);
            }

            let description = '';
            for (const ticket of tickets) {
                const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);
                const channelName = channel ? `<#${channel.id}>` : '❌ Canal eliminado';
                const user = ticket.creator_id ? `<@${ticket.creator_id}>` : 'Desconocido';
                description += `• **#${ticket.id}** - ${channelName} | ${user}\\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Tickets (${status})`)
                .setDescription(description || 'Sin tickets')
                .setColor(0x5865F2)
                .setFooter({ text: `Mostrando ${tickets.length} tickets` });

            return interaction.editReply({ embeds: [embed] });
        }
    }
};

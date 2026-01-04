const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sesion')
        .setDescription('🗳️ Sistema de votaciones para sesiones de rol')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('Crear una votación para abrir el servidor')
                .addStringOption(option => option.setName('horario').setDescription('Horario de inicio (ej: 3, 21:00)').setRequired(true))
                .addIntegerOption(option => option.setName('minimo').setDescription('Votos mínimos necesarios').setMinValue(2).setMaxValue(20))
                .addStringOption(option => option.setName('imagen').setDescription('URL de imagen personalizada')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancelar')
                .setDescription('Cancelar la votación activa'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('forzar')
                .setDescription('🔒 Abrir servidor sin mínimo de votos (Staff)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cerrar')
                .setDescription('🔒 Cerrar servidor (Staff)')
                .addStringOption(option => option.setName('razon').setDescription('Razón del cierre')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mantenimiento')
                .setDescription('🛠️ Activar modo mantenimiento (Staff)')
                .addStringOption(option => option.setName('duracion').setDescription('Tiempo estimado (ej: 1 hora)'))
                .addStringOption(option => option.setName('razon').setDescription('Motivo del mantenimiento'))),

    async execute(interaction) {
        // Use client attached to interaction
        const client = interaction.client;
        // Access Supabase from client (assuming it's attached as client.supabase)
        // If not attached in index.js, we might need to require it or passed in context.
        // Step 4049 showed `client.supabase = supabase;` line 46. So it is attached.
        const supabase = client.supabase;

        const subCmd = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guild = interaction.guild;
        const channelIds = {
            voting: '1412963363545284680', // Replace with Env Var if possible
            pingRole: '1412899401000685588'
        };

        const juntaDirectivaRoleId = '1412882245735420006';

        // Helper: Rename Channel
        async function renameChannel(channelId, newName) {
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel) {
                    await channel.setName(newName);
                    return true;
                }
            } catch (error) {
                console.error('Channel rename error:', error);
            }
            return false;
        }

        if (subCmd === 'crear') {
            await interaction.deferReply();

            // Check Permissions
            if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('❌ Solo la Junta Directiva puede crear votaciones.');
            }

            const horario = interaction.options.getString('horario');
            const minimo = interaction.options.getInteger('minimo') || 4;
            const imagenUrl = interaction.options.getString('imagen') || 'https://cdn.discordapp.com/attachments/885232074083143741/1453225155634663575/standard1.gif';

            // Check active session
            const { data: existingSession } = await supabase
                .from('session_votes')
                .select('*')
                .eq('status', 'active')
                .maybeSingle();

            if (existingSession) {
                return interaction.editReply('❌ Ya hay una votación activa. Usa `/sesion cancelar` primero.');
            }

            // Create Session
            const scheduledTime = new Date();
            scheduledTime.setHours(scheduledTime.getHours() + 2);

            const { data: newSession, error } = await supabase
                .from('session_votes')
                .insert({
                    created_by: userId,
                    scheduled_time: scheduledTime.toISOString(),
                    minimum_votes: minimo,
                    image_url: imagenUrl
                })
                .select()
                .single();

            if (error || !newSession) {
                console.error('Error creating session:', error);
                return interaction.editReply('❌ Error creando la votación en BD.');
            }

            // Create Embed
            const embed = new EmbedBuilder()
                .setTitle('🗳️ Votacion De Rol')
                .setColor(0xFFD700)
                .setDescription('Vota si podrás participar en la sesión de hoy')
                .addFields(
                    { name: '⏰ Horario de Rol', value: horario, inline: true },
                    { name: '🎯 Votos Necesarios', value: `${minimo}`, inline: true },
                    { name: '\u200B', value: '\u200B' },
                    { name: '✅ Participar en la sesion', value: '0 votos', inline: false },
                    { name: '📋 asistire, pero con retraso', value: '0 votos', inline: false },
                    { name: '❌ No podre asistir', value: '0 votos', inline: false }
                )
                .setImage(imagenUrl)
                .setFooter({ text: `hoy a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`vote_yes_${newSession.id}`).setEmoji('✅').setLabel('Participar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`vote_late_${newSession.id}`).setEmoji('📋').setLabel('Con retraso').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`vote_no_${newSession.id}`).setEmoji('❌').setLabel('No podré').setStyle(ButtonStyle.Danger)
                );

            const targetChannel = await client.channels.fetch(channelIds.voting);
            if (!targetChannel) return interaction.editReply('❌ No se encontró el canal de votaciones.');

            await renameChannel(channelIds.voting, '🗳️・votaciones');
            const msg = await targetChannel.send({
                content: `<@&${channelIds.pingRole}>`,
                embeds: [embed],
                components: [row]
            });

            await supabase.from('session_votes').update({ message_id: msg.id, channel_id: channelIds.voting }).eq('id', newSession.id);

            await interaction.editReply(`✅ Votación creada en <#${channelIds.voting}>`);

            // --- NOTE: Interaction Collector logic for button clicks should be in a global handler or persisting collector --
            // Because this code finishes execution, a local collector would die if the bot restarts.
            // The existing `createMessageComponentCollector` in index.js.bak was flawed for persistence.
            // A global `interactionCreate` for buttons starting with `vote_` is better.
            // I will assume the global button handler handles `vote_` (I need to verify or implement it).
        }
        else if (subCmd === 'cancelar') {
            await interaction.deferReply();

            const { data: session } = await supabase.from('session_votes').select('*').eq('status', 'active').maybeSingle();
            if (!session) return interaction.editReply('❌ No hay votación activa.');

            // Check permissions
            if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && session.created_by !== userId) {
                return interaction.editReply('❌ Permiso denegado.');
            }

            await supabase.from('session_votes').update({ status: 'cancelled' }).eq('id', session.id);
            await renameChannel(session.channel_id || channelIds.voting, '⏸️・sesiones');

            // Try to delete message
            try {
                const ch = await client.channels.fetch(session.channel_id);
                if (ch && session.message_id) await ch.messages.delete(session.message_id);
            } catch (e) { console.log('Error deleting voting msg:', e.message); }

            await interaction.editReply('✅ Votación cancelada.');
        }
        else {
            await interaction.reply({ content: '❌ Subcomando no implementado aún en esta versión modular.', ephemeral: true });
        }
    }
};

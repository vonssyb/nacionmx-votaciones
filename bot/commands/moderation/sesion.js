const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
                .addStringOption(option => option.setName('razon').setDescription('Razón del cierre').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mantenimiento')
                .setDescription('🛠️ Activar modo mantenimiento (Staff)')
                .addStringOption(option => option.setName('duracion').setDescription('Tiempo estimado (ej: 1 hora)'))
                .addStringOption(option => option.setName('razon').setDescription('Motivo del mantenimiento')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('asistentes')
                .setDescription('📋 Ver asistentes de la última sesión')),

    async execute(interaction) {
        // Ensure deferral if not already handled
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply().catch(() => { });
        }

        try {
            // Use client attached to interaction
            const client = interaction.client;
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

            // Helper: Update ERLC Config
            function updateErlcLock(isLocked) {
                try {
                    const configPath = path.join(__dirname, '../../data/erlc_config.json');
                    let config = {};
                    if (fs.existsSync(configPath)) {
                        config = JSON.parse(fs.readFileSync(configPath));
                    }
                    config.locked = isLocked;
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log(`[ERLC] Server Locked state updated to: ${isLocked}`);
                } catch (e) {
                    console.error('[ERLC] Error updating config:', e.message);
                }
            }

            // NOTE: index_moderacion.js auto-defers, so no need to call deferReply() here.

            if (subCmd === 'crear') {
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

                const targetChannel = await client.channels.fetch(channelIds.voting).catch(() => null);
                if (!targetChannel) return interaction.editReply('❌ No se encontró el canal de votaciones (ID incorrecta o sin permisos).');

                renameChannel(channelIds.voting, '🗳️・votaciones').catch(console.error);
                const msg = await targetChannel.send({
                    content: `<@&${channelIds.pingRole}>`,
                    embeds: [embed],
                    components: [row]
                });

                await supabase.from('session_votes').update({ message_id: msg.id, channel_id: channelIds.voting }).eq('id', newSession.id);

                await interaction.editReply(`✅ Votación creada en <#${channelIds.voting}>`);
            }
            else if (subCmd === 'cancelar') {
                const { data: session } = await supabase.from('session_votes').select('*').eq('status', 'active').maybeSingle();
                if (!session) return interaction.editReply('❌ No hay votación activa.');

                // Check permissions
                if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && session.created_by !== userId) {
                    return interaction.editReply('❌ Permiso denegado.');
                }

                await supabase.from('session_votes').update({ status: 'cancelled' }).eq('id', session.id);
                renameChannel(session.channel_id || channelIds.voting, '⏸️・sesiones').catch(console.error);

                // Try to delete message
                try {
                    const ch = await client.channels.fetch(session.channel_id);
                    if (ch && session.message_id) await ch.messages.delete(session.message_id);
                } catch (e) { console.log('Error deleting voting msg:', e.message); }

                updateErlcLock(true); // Close server if vote cancelled
                await interaction.editReply('✅ Votación cancelada. Servidor Cerrado.');
            }
            else if (subCmd === 'forzar') {
                // Check Permissions
                if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply('❌ Solo la Junta Directiva puede forzar la sesión.');
                }

                // Find any 'active' session (pending vote) to upgrade, or create new 'live' session
                let { data: session } = await supabase.from('session_votes').select('*').eq('status', 'active').maybeSingle();

                if (!session) {
                    // Create a new session record if none exists
                    const { data: newSession, error } = await supabase.from('session_votes').insert({
                        created_by: userId,
                        scheduled_time: new Date().toISOString(),
                        minimum_votes: 0,
                        status: 'live', // Mark as live immediately
                        channel_id: channelIds.voting
                    }).select().single();
                    session = newSession;
                } else {
                    // Update existing session
                    await supabase.from('session_votes').update({ status: 'live' }).eq('id', session.id);
                }

                const targetChannel = await client.channels.fetch(channelIds.voting).catch(() => null);
                if (targetChannel) {
                    // --- 1. GENERATE ATTENDANCE REPORT (Before clearing) ---
                    const REPORT_CHANNEL_ID = '1398891368398585886';
                    if (session) {
                        try {
                            const { data: participants } = await supabase
                                .from('session_vote_participants')
                                .select('user_id, vote_type')
                                .eq('session_id', session.id);

                            if (participants && participants.length > 0) {
                                const yesMentions = participants.filter(p => p.vote_type === 'yes').map(p => `<@${p.user_id}>`);
                                const lateMentions = participants.filter(p => p.vote_type === 'late').map(p => `<@${p.user_id}>`);
                                const noMentions = participants.filter(p => p.vote_type === 'no').map(p => `<@${p.user_id}>`);

                                const reportEmbed = new EmbedBuilder()
                                    .setTitle('📋 Reporte de Asistencia - Apertura de Sesión')
                                    .setColor(0x00BFFF) // Deep Sky Blue
                                    .setDescription(`Resumen de votaciones para la sesión iniciada por <@${interaction.user.id}>`)
                                    .addFields(
                                        {
                                            name: `✅ Confirmados (${yesMentions.length})`,
                                            value: yesMentions.length > 0 ? yesMentions.join(', ') : 'Ninguno',
                                            inline: false
                                        },
                                        {
                                            name: `📋 Con Retraso (${lateMentions.length})`,
                                            value: lateMentions.length > 0 ? lateMentions.join(', ') : 'Ninguno',
                                            inline: false
                                        },
                                        {
                                            name: `❌ No Asistirán (${noMentions.length})`,
                                            value: noMentions.length > 0 ? noMentions.join(', ') : 'Ninguno',
                                            inline: false
                                        }
                                    )
                                    .setTimestamp();

                                const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
                                if (reportChannel) {
                                    await reportChannel.send({ embeds: [reportEmbed] });
                                    console.log(`[Sesion] Attendance report sent to ${REPORT_CHANNEL_ID}`);
                                } else {
                                    console.warn(`[Sesion] Report channel ${REPORT_CHANNEL_ID} not found.`);
                                }
                            }
                        } catch (reportErr) {
                            console.error('[Sesion] Error generating attendance report:', reportErr);
                        }
                    }

                    // --- 2. CLEAR CHANNEL (Legacy Behavior) ---
                    try {
                        const messages = await targetChannel.messages.fetch({ limit: 100 });
                        if (messages.size > 0) await targetChannel.bulkDelete(messages, true).catch(() => { });
                    } catch (e) { console.log('Error clearing channel:', e.message); }

                    renameChannel(channelIds.voting, '✅・servidor-abierto').catch(console.error);

                    // Rich Embed
                    const openEmbed = new EmbedBuilder()
                        .setTitle('✅ SESIÓN CONFIRMADA - SERVIDOR ABIERTO')
                        .setColor(0x00FF00)
                        .setDescription(`🎮 **¡El servidor ha sido ABIERTO por la Junta Directiva!**\n\n¡Hora de rolear!`)
                        .setImage('https://cdn.discordapp.com/attachments/885232074083143741/1453225155185737749/standard.gif')
                        .setFooter({ text: `Apertura forzada por ${interaction.user.tag}` })
                        .setTimestamp();

                    // Button
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('🎮 Unirse al Servidor')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://www.roblox.com/games/start?launchData=%7B%22psCode%22%3A%22NACIONMX%22%7D&placeId=2534724415')
                        );

                    await targetChannel.send({ content: `<@&${channelIds.pingRole}>`, embeds: [openEmbed], components: [row] });
                }

                updateErlcLock(false); // UNLOCK SERVER
                await interaction.editReply('✅ **Sesión Forzada Correctamente.** El servidor ha sido ABIERTO en ERLC.');
            }
            else if (subCmd === 'cerrar') {
                // Check Permissions
                if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply('❌ Solo la Junta Directiva puede cerrar la sesión.');
                }

                // Find 'live' or 'active' session
                const { data: session } = await supabase.from('session_votes').select('*').or('status.eq.live,status.eq.active').maybeSingle();

                if (session) {
                    await supabase.from('session_votes').update({ status: 'closed', ended_at: new Date().toISOString() }).eq('id', session.id);
                }

                const razon = interaction.options.getString('razon');
                const targetChannel = await client.channels.fetch(channelIds.voting).catch(e => {
                    console.error("Error fetching voting channel:", e);
                    return null;
                });

                if (targetChannel) {
                    renameChannel(channelIds.voting, '🔴・servidor-cerrado').catch(console.error);

                    // Clear Channel messages (Legacy Behavior)
                    try {
                        const messages = await targetChannel.messages.fetch({ limit: 100 });
                        if (messages.size > 0) await targetChannel.bulkDelete(messages, true).catch(() => { });
                    } catch (e) { console.log('Error clearing channel:', e.message); }

                    const embed = new EmbedBuilder()
                        .setTitle('🔴 SERVIDOR CERRADO')
                        .setColor(0xFF0000)
                        .setImage('https://cdn.discordapp.com/attachments/885232074083143741/1453225156188049458/standard2.gif')
                        .setDescription(`⚠️ **La sesión de rol ha finalizado.**\n\n📝 **Razón:** ${razon}\n\nGracias por participar en **Nación MX**. \n¡Esperamos verlos en la próxima sesión!`)
                        .setFooter({ text: `Cerrado por ${interaction.user.tag}` })
                        .setTimestamp();

                    await targetChannel.send({ embeds: [embed] });
                }

                updateErlcLock(true); // LOCK SERVER

                // Send ERLC Global Message
                if (client.services && client.services.erlc) {
                    await client.services.erlc.runCommand(`:m 🔴 SERVIDOR CERRADO: ${razon}`);
                    console.log('[ERLC] Sent server close message');
                }

                await interaction.editReply(`✅ Sesión cerrada: ${razon}. Servidor ERLC Bloqueado.`);
            }
            else if (subCmd === 'mantenimiento') {
                // Check Permissions
                if (!interaction.member.roles.cache.has(juntaDirectivaRoleId) && !interaction.member.permissions.has('Administrator')) {
                    return interaction.editReply('❌ Permiso denegado.');
                }

                const duracion = interaction.options.getString('duracion') || 'Indefinido';
                const razon = interaction.options.getString('razon') || 'Mantenimiento programado';
                const targetChannel = await client.channels.fetch(channelIds.voting).catch(() => null);

                if (targetChannel) {
                    renameChannel(channelIds.voting, '🟠・mantenimiento').catch(console.error);

                    const embed = new EmbedBuilder()
                        .setTitle('🛠️ SISTEMA EN MANTENIMIENTO')
                        .setColor(0xFFA500)
                        .setDescription(`⚠️ **El servidor se encuentra en mantenimiento.**\n\n⏳ **Duración estimada:** ${duracion}\n📝 **Motivo:** ${razon}`)
                        .setFooter({ text: 'Por favor, no intenten entrar hasta nuevo aviso.' })
                        .setTimestamp();

                    await targetChannel.send({ embeds: [embed] });
                }

                updateErlcLock(true); // LOCK SERVER
                await interaction.editReply('✅ Modo mantenimiento activado. Servidor ERLC Bloqueado.');
            }
            else if (subCmd === 'asistentes') {
                // Fetch last live, opened or closed session
                const { data: lastSession, error } = await supabase
                    .from('session_votes')
                    .select('*')
                    .in('status', ['live', 'opened', 'closed'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error || !lastSession) {
                    return interaction.editReply('❌ No se encontró ninguna sesión completada.');
                }

                // Fetch all votes for this session
                const { data: votes } = await supabase
                    .from('session_vote_participants')
                    .select('*')
                    .eq('session_id', lastSession.id);

                if (!votes || votes.length === 0) {
                    return interaction.editReply('❌ No hay registro de asistentes para la última sesión.');
                }

                // Categorize votes
                const onTime = votes.filter(v => v.vote_type === 'yes');
                const late = votes.filter(v => v.vote_type === 'late');
                const absent = votes.filter(v => v.vote_type === 'no');

                // Format user lists
                const formatUsers = (userList) => {
                    if (userList.length === 0) return 'Ninguno';
                    return userList.map(v => `<@${v.user_id}>`).join(', ');
                };

                const embed = new EmbedBuilder()
                    .setTitle('📋 Asistentes de Última Sesión')
                    .setColor(0x00FF00)
                    .setDescription(`**Sesión creada:** <t:${Math.floor(new Date(lastSession.created_at).getTime() / 1000)}:F>`)
                    .addFields(
                        { name: `✅ Asistieron a Tiempo (${onTime.length})`, value: formatUsers(onTime), inline: false },
                        { name: `⏰ Llegaron Tarde (${late.length})`, value: formatUsers(late), inline: false },
                        { name: `❌ No Asistieron (${absent.length})`, value: formatUsers(absent), inline: false }
                    )
                    .setFooter({ text: `Total de votos: ${votes.length}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
            else {
                await interaction.editReply({ content: '❌ Subcomando desconocido.' });
            }
        } catch (error) {
            console.error('Error executing sesion command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(`❌ Error al ejecutar el comando: ${error.message}`).catch(() => { });
            } else {
                await interaction.reply({ content: `❌ Error al ejecutar el comando: ${error.message}`, ephemeral: true }).catch(() => { });
            }
        }
    }
};

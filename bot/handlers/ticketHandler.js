const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { generateAIResponse } = require('./ticketMessageHandler');

// --- CONFIGURACIÓN PRINCIPAL ---
const TICKET_CONFIG = {
    CAT_GENERAL: '1414066417019392000',
    CAT_VIP: '1450225651935219854',
    CAT_BUGS: '1459987769932648680',
    ROLE_COMMON: '1412887167654690908',
    ROLE_BLACKLIST: '1451703422800625777',
    ROLE_CK: '1450938106395234526',
    LOG_TRANSCRIPTS: '1414065296704016465',
    LOG_FEEDBACK: '1412964502114402384',
    USER_DEV: '826637667718266880',
    VIP_ACCESS_ROLES: ['1414033620636532849', '1412887172503175270', '1423520675158691972', '1449950535166726317']
};

const TICKET_TYPES = {
    'ticket_general': { title: 'Soporte General', category: TICKET_CONFIG.CAT_GENERAL, role: TICKET_CONFIG.ROLE_COMMON, emoji: '🔧', prefix: 'soporte' },
    'ticket_reportes': { title: 'Reportes y Sanciones', category: TICKET_CONFIG.CAT_GENERAL, role: TICKET_CONFIG.ROLE_COMMON, emoji: '🚨', prefix: 'reporte' },
    'ticket_blacklist': { title: 'Blacklist | Apelación', category: TICKET_CONFIG.CAT_GENERAL, role: TICKET_CONFIG.ROLE_BLACKLIST, emoji: '📜', prefix: 'apelacion' },
    'ticket_trabajo': { title: 'Facciones y Trabajo', category: TICKET_CONFIG.CAT_GENERAL, role: TICKET_CONFIG.ROLE_COMMON, emoji: '💼', prefix: 'faccion' },
    'ticket_ck': { title: 'Solicitud FEC / CK', category: TICKET_CONFIG.CAT_GENERAL, role: TICKET_CONFIG.ROLE_CK, emoji: '☠️', prefix: 'ck' },
    'ticket_vip': { title: 'Atención VIP', category: TICKET_CONFIG.CAT_VIP, role: TICKET_CONFIG.ROLE_COMMON, emoji: '💎', vipOnly: true, prefix: 'vip' },
    'ticket_bug': { title: 'Falla con el Bot', category: TICKET_CONFIG.CAT_BUGS, role: null, pingUser: TICKET_CONFIG.USER_DEV, emoji: '🤖', prefix: 'bug' }
};

module.exports = {
    async handleTicketInteraction(interaction, client, supabase) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

        const { customId } = interaction;
        let ticketTypeKey = null;

        // --- 1. SELECCIÓN ---
        if (interaction.isStringSelectMenu() && customId === 'ticket_main_menu') ticketTypeKey = interaction.values[0];
        if (interaction.isButton()) {
            if (customId === 'ticket_btn_vip') ticketTypeKey = 'ticket_vip';
            if (customId === 'ticket_btn_bug') ticketTypeKey = 'ticket_bug';
        }

        // --- 2. VALIDACIONES PREVIAS (Blacklist / Horario) ---
        if (ticketTypeKey) {
            // A) Check Blacklist BD (with 2s timeout to prevent Interaction Failure)
            const checkBlacklist = supabase.from('ticket_blacklist').select('user_id').eq('user_id', interaction.user.id).single();
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 2000));

            const result = await Promise.race([checkBlacklist, timeoutPromise]);

            if (!result.timeout && result.data) {
                return interaction.reply({ content: '🚫 Estás vetado del sistema de soporte.', ephemeral: true });
            }

            // Night-time warning removed - was causing duplicates


            const config = TICKET_TYPES[ticketTypeKey];
            if (!config) return false;

            if (config.vipOnly) {
                const hasVipRole = interaction.member.roles.cache.some(r => TICKET_CONFIG.VIP_ACCESS_ROLES.includes(r.id));
                if (!hasVipRole) return interaction.reply({ content: '🚫 Acceso VIP requerido.', ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId(`modal_create_main_${ticketTypeKey}`).setTitle(config.title);
            const fields = [];

            if (ticketTypeKey === 'ticket_reportes') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_who').setLabel("Usuario a reportar:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_infraction').setLabel("Tipo de infracción cometida:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_context').setLabel("Describe lo sucedido (contexto completo):").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900),
                    new TextInputBuilder().setCustomId('q_proofs').setLabel("Cuentas con pruebas claras?").setStyle(TextInputStyle.Short).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_blacklist') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_staff').setLabel("Staff sancionador:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_reason').setLabel("Motivo (Ban/Warn):").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_defense').setLabel("Justificación de apelación:").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900)
                );
            } else if (ticketTypeKey === 'ticket_ck') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_char_name').setLabel("Nombre de tu personaje:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_target_name').setLabel("Nombre del objetivo:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_lore').setLabel("Historia y justificación del rol (lore):").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900),
                    new TextInputBuilder().setCustomId('q_proofs').setLabel("Pruebas del rol (+16 horas):").setStyle(TextInputStyle.Paragraph).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_trabajo') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_faction').setLabel("¿A qué facción deseas postularte?:").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_roles').setLabel("ya tienes roles?").setStyle(TextInputStyle.Short).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_bug') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_location').setLabel("¿En qué parte ocurre el error?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_desc').setLabel("Describe el fallo y cómo reproducirlo:").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900)
                );
            } else if (ticketTypeKey === 'ticket_vip') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_vip_needs').setLabel("¿En qué necesitas atención prioritaria?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)
                );
            } else {
                // ticket_general
                fields.push(
                    new TextInputBuilder().setCustomId('q_topic').setLabel("Tema: (Duda / Queja / Sugerencia)").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_situation').setLabel("Explica tu situación clara y detallada:").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
                );
            }

            fields.forEach(f => modal.addComponents(new ActionRowBuilder().addComponents(f)));
            try {
                await interaction.showModal(modal);
            } catch (err) {
                if (err.code === 10062 || err.code === 40060) {
                    console.warn(`[TICKET] Interaction obsolete (Modal): ${err.message}`);
                    return false;
                }
                throw err;
            }
            return true;
        }

        // --- 3. CREATE LOGIC (Submit) ---
        // MODAL DE CALIFICACIÓN SUBMISSION
        if (interaction.isModalSubmit() && customId === 'rating_modal') {
            await interaction.deferReply({ ephemeral: true });

            const ratingStars = interaction.fields.getTextInputValue('rating_stars');
            const comments = interaction.fields.getTextInputValue('rating_comments') || 'Sin comentarios';

            // Validar que sea 1-5
            const rating = parseInt(ratingStars);
            if (isNaN(rating) || rating < 1 || rating > 5) {
                await interaction.editReply('❌ La calificación debe ser un número entre 1 y 5.');
                return true;
            }

            // Verificar que sea el creador del ticket
            const { data: ticketOwner } = await supabase
                .from('tickets')
                .select('creator_id')
                .eq('channel_id', interaction.channel.id)
                .single();

            if (!ticketOwner || ticketOwner.creator_id !== interaction.user.id) {
                await interaction.editReply('❌ Solo el creador del ticket puede calificar.');
                return true;
            }

            // Procesar cierre de ticket
            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            const discordTranscripts = require('discord-html-transcripts');
            const attachment = await discordTranscripts.createTranscript(interaction.channel, { limit: -1, returnType: 'attachment', filename: `close-${interaction.channel.name}.html`, saveImages: true });

            // Log Transcripts
            const logChannel = client.channels.cache.get(TICKET_CONFIG.LOG_TRANSCRIPTS);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Ticket Cerrado')
                    .addFields(
                        { name: 'Ticket', value: interaction.channel.name, inline: true },
                        { name: 'Rating', value: `${'⭐'.repeat(rating)}`, inline: true },
                        { name: 'Comentarios', value: comments.substring(0, 200), inline: false }
                    )
                    .setColor(0x2B2D31);
                await logChannel.send({ embeds: [logEmbed], files: [attachment] });
            }

            // Log Feedback
            const feedbackChannel = client.channels.cache.get(TICKET_CONFIG.LOG_FEEDBACK);
            if (feedbackChannel) {
                await feedbackChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('Nueva Valoración')
                        .addFields(
                            { name: 'Rating', value: '⭐'.repeat(rating), inline: true },
                            { name: 'Staff', value: ticket?.claimed_by_id ? `<@${ticket.claimed_by_id}>` : 'General', inline: true },
                            { name: 'Comentarios', value: comments.substring(0, 1000), inline: false }
                        )
                        .setColor(rating >= 4 ? 0x57F287 : 0xED4245)
                    ]
                });
            }

            // Actualizar ticket en DB
            await supabase.from('tickets').update({
                status: 'CLOSED',
                closed_at: new Date().toISOString(),
                rating,
                feedback_comments: comments
            }).eq('channel_id', interaction.channel.id);

            // DM al creador
            if (ticket && ticket.creator_id) {
                try {
                    const creator = await client.users.fetch(ticket.creator_id);
                    await creator.send({ content: `Tu ticket ha sido cerrado. Gracias por tu feedback.`, files: [attachment] });
                } catch (e) { }
            }

            await interaction.editReply('✅ ¡Gracias por tu calificación!');
            await interaction.channel.send('✅ Cerrando...');

            setTimeout(() => {
                interaction.channel.delete().catch(e => console.log('Channel already deleted'));
            }, 3000);

            return true;
        }

        if (interaction.isModalSubmit() && customId.startsWith('modal_create_main_')) {
            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (err) {
                if (err.code === 10062 || err.code === 40060) {
                    console.warn(`[TICKET] Interaction obsolete (Defer): ${err.message}`);
                    return;
                }
                console.error('[TICKET] Defer Error:', err);
                return;
            }
            const typeKey = customId.replace('modal_create_main_', '');
            const config = TICKET_TYPES[typeKey];
            if (!config) return interaction.editReply('❌ Config Error.');

            let description = `**Tipo:** ${config.title}\n**Usuario:** <@${interaction.user.id}>\n\n`;

            // Append fields dynamically
            const labelMap = {
                // General
                'q_topic': 'Tema',
                'q_situation': 'Situación',
                // Reportes
                'q_who': 'Reportado',
                'q_infraction': 'Infracción',
                'q_context': 'Contexto',
                'q_proofs': 'Pruebas',
                // Blacklist / Apelación
                'q_staff': 'Staff Sancionador',
                'q_reason': 'Razón',
                'q_defense': 'Justificación',
                // CK
                'q_char_name': 'Personaje',
                'q_target_name': 'Objetivo',
                'q_lore': 'Lore / Historia',
                // Facciones
                'q_faction': 'Facción',
                'q_roles': 'Roles Previos',
                // Bugs
                'q_location': 'Ubicación',
                'q_desc': 'Descripción',
                // VIP
                'q_vip_needs': 'Solicitud VIP'
            };

            interaction.fields.fields.forEach(field => {
                const politeLabel = labelMap[field.customId] || field.customId;
                description += `**${politeLabel}:** ${field.value}\n`;
            });
            // (Note: cleaner formatting possible but this ensures all data is captured)

            try {
                const cleanName = interaction.user.username.replace(/[^a-z0-9\-_]/g, '').toLowerCase().substring(0, 15);
                const channelName = `${config.prefix}-${cleanName}`;

                const permissionOverwrites = [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ];

                // STAFF VIEW ONLY (Muted logic)
                if (config.role) {
                    permissionOverwrites.push({
                        id: config.role,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages] // Cannot speak until claimed
                    });
                }

                if (config.pingUser) permissionOverwrites.push({ id: config.pingUser, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: config.category,
                    topic: `ID: ${interaction.user.id} | ${config.title}`,
                    permissionOverwrites
                });

                // --- CRM: USER HISTORY QUERY ---
                let userHistoryText = "• Primer Ticket";
                try {
                    const { count: ticketCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('creator_id', interaction.user.id);
                    // Suponiendo tabla 'sanctions' o 'fines' existente. Si no, comentar.
                    const { count: sanctionCount } = await supabase.from('arrests_fines').select('*', { count: 'exact', head: true }).eq('discord_user_id', interaction.user.id);

                    if (ticketCount > 0) {
                        userHistoryText = `• Tickets Previos: **${ticketCount}**\n• Sanciones/Arrestos: **${sanctionCount || 0}**`;
                    }
                } catch (crmError) {
                    console.error('CRM Error:', crmError);
                }

                await supabase.from('tickets').insert([{
                    guild_id: interaction.guild.id,
                    channel_id: ticketChannel.id,
                    creator_id: interaction.user.id,
                    status: 'OPEN',
                    last_active_at: new Date().toISOString()
                }]);

                const embed = new EmbedBuilder()
                    .setTitle(`${config.emoji} ${config.title}`)
                    .setDescription(description.substring(0, 4000))
                    .addFields({ name: '👤 Historial del Ciudadano (CRM)', value: userHistoryText, inline: false })
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Reclama el ticket para responder' }).setTimestamp();

                let pings = `<@${interaction.user.id}>`;
                const staffRoleID = config.role;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Success).setEmoji('✋')
                );

                const welcomeMsg = await ticketChannel.send({ content: pings, embeds: [embed], components: [row] });
                await welcomeMsg.pin().catch(() => { }); // PIN WELCOME MESSAGE

                // --- IA ANALYSIS ---
                console.log(`[DEBUG] Ticket Created. Attempting AI Analysis for: ${channelName}`);
                try {
                    const aiAnswer = await generateAIResponse(description);
                    console.log(`[DEBUG] AI Response Result:`, aiAnswer?.startsWith('ERROR') ? "FAIL" : "SUCCESS");

                    if (aiAnswer && !aiAnswer.startsWith('ERROR')) {
                        const aiRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('btn_ai_close').setLabel('✅ Me sirvió, cerrar ticket').setStyle(ButtonStyle.Success).setEmoji('🔒'),
                            new ButtonBuilder().setCustomId(`btn_ai_help_${staffRoleID || 'none'}`).setLabel('👮 Aún necesito Staff').setStyle(ButtonStyle.Secondary).setEmoji('📢')
                        );

                        const aiEmbed = new EmbedBuilder()
                            .setTitle('🤖 Respuesta Automática')
                            .setDescription(aiAnswer)
                            .setColor(0x5865F2)
                            .setFooter({ text: '¿Te ayudó esta respuesta?' });

                        await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [aiEmbed], components: [aiRow] });
                        console.log(`[DEBUG] AI Embed sent to ${channelName}`);
                    } else {
                        // ACOPLAMIENTO: Si la IA falla o no trae respuesta
                        const errorMsg = aiAnswer || "Respuesta nula desconocida";
                        console.log(`[DEBUG] AI Failed: ${errorMsg}`);

                        if (config.role) await ticketChannel.send({ content: `📢 <@&${config.role}>` });

                        // Mensaje de debug visible para el admin
                        await ticketChannel.send({ content: `⚠️ **Debug IA:** ${errorMsg}` });
                    }
                } catch (e) {
                    console.error('[DEBUG] AI Error in Ticket Handler:', e);
                    if (config.role) await ticketChannel.send({ content: `📢 <@&${config.role}>` });
                    await ticketChannel.send({ content: `⚠️ **Debug IA:** Excepción Fatal (${e.message})` });
                }

                await interaction.editReply(`✅ Ticket creado: ${ticketChannel}`);

            } catch (err) {
                console.error(err);
                await interaction.editReply('❌ Error al crear. Verifica permisos/categorías.');
            }
            return true;
        }

        // --- 4. ACCIONES (Claim / Close / Feedback) ---
        // Reuse same logic from previous steps
        // --- 4. ACCIONES (Claim / Unclaim Logic) ---
        if (customId === 'btn_claim_ticket') {
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
                interaction.member.roles.cache.has('1412887167654690908') || // Staff
                interaction.member.roles.cache.has('1412882248411381872'); // Administración
            if (!isStaff) return interaction.reply({ content: '🚫 Solo Staff.', ephemeral: true });

            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (!ticket) return interaction.reply({ content: '❌ Error: Ticket no encontrado en DB.', ephemeral: true });

            // A) UNCLAIM (Si ya lo tiene reclamado el usuario actual)
            if (ticket.claimed_by_id === interaction.user.id) {
                await supabase.from('tickets').update({ claimed_by_id: null }).eq('channel_id', interaction.channel.id);

                // RESTORE PERMISSIONS (Staff Viewing, No one writing except User)
                // We need the Role ID. Best way is to fetch from ticket_panels using ticket.panel_id if possible, or try to guess from overwrites.
                // For simplified logic, we assume we want to reset channel perms to "Listen Mode".
                // Since we don't have the explicit role ID easily without a join, we can iterate channel overwrites or assume default.

                // TRICK: Fetch panel config via panel_id
                const { data: panel } = await supabase.from('ticket_panels').select('support_role_id').eq('id', ticket.panel_id).single();
                const roleId = panel?.support_role_id;

                if (roleId) {
                    await interaction.channel.permissionOverwrites.edit(roleId, {
                        ViewChannel: true,
                        SendMessages: false, // Mute again
                        AttachFiles: false
                    });
                }

                await interaction.channel.permissionOverwrites.delete(interaction.user.id); // Remove individual override

                await interaction.reply({ content: `👐 **Ticket Liberado** por <@${interaction.user.id}>. Otros staff pueden verlo.` });
                await interaction.channel.setTopic(interaction.channel.topic.replace(/ \| Staff: .*/, ''));
                return true;
            }

            // B) PREVENT STEAL (Si lo tiene otro)
            if (ticket.claimed_by_id) {
                return interaction.reply({ content: `⚠️ Ticket ya reclamado por <@${ticket.claimed_by_id}>`, ephemeral: true });
            }

            // C) CLAIM (Si está libre)
            await supabase.from('tickets').update({ claimed_by_id: interaction.user.id }).eq('channel_id', interaction.channel.id);

            const { data: panel } = await supabase.from('ticket_panels').select('support_role_id').eq('id', ticket.panel_id).single();
            const roleId = panel?.support_role_id;

            // HIDE from other staff, SHOW for claimer
            if (roleId) {
                await interaction.channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: false // Hide from others
                });
            }
            // Add Claimer explicitly
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                AttachFiles: true
            });

            await interaction.channel.setTopic(`${interaction.channel.topic} | Staff: ${interaction.user.tag}`);
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✋ **Atendido por** <@${interaction.user.id}>\nEl ticket ahora es privado entre tú y el usuario.`).setColor(0x2ECC71)] });
            return true;
        }

        if (customId === 'btn_close_ticket_ask') {
            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.creator_id === interaction.user.id) {
                return interaction.reply({ content: '🚫 Espera al Staff para cerrar.', ephemeral: true });
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close_ticket_confirm').setLabel('Confirmar Cerrar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('btn_cancel_close').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: '¿Cerrar ticket?', components: [row] });
            return true;
        }

        if (customId === 'btn_cancel_close') {
            await interaction.message.delete().catch(() => { });
            return true;
        }

        if (customId === 'btn_close_ticket_confirm') {
            await interaction.message.delete().catch(() => { });

            // Get Creator ID to ping THEM, not the Staff closing it
            const { data: ticket } = await supabase.from('tickets').select('creator_id').eq('channel_id', interaction.channel.id).single();
            const targetUser = ticket?.creator_id || interaction.user.id;

            const embed = new EmbedBuilder().setTitle('🔒 Finalizado').setDescription('Califica la atención:\n\n⭐ Da clic en **Calificar** para escribir tu calificación (1-5 estrellas) y comentarios.').setColor(0xFEE75C);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_rating_modal').setEmoji('✍️').setLabel('Calificar').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('feedback_s').setLabel('Omitir').setStyle(ButtonStyle.Secondary)
            );
            await interaction.channel.send({ content: `<@${targetUser}>`, embeds: [embed], components: [row] });
            return true;
        }

        // MODAL DE CALIFICACIÓN
        if (customId === 'open_rating_modal') {
            // Solo el creador puede calificar
            const { data: ticketData } = await supabase
                .from('tickets')
                .select('creator_id')
                .eq('channel_id', interaction.channel.id)
                .single();

            if (!ticketData || ticketData.creator_id !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ Solo el creador del ticket puede calificar la atención.',
                    ephemeral: true
                });
            }

            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

            const modal = new ModalBuilder()
                .setCustomId('rating_modal')
                .setTitle('📝 Calificar Atención');

            const ratingInput = new TextInputBuilder()
                .setCustomId('rating_stars')
                .setLabel('⭐ Calificación (1-5 estrellas)')
                .setPlaceholder('Escribe un número del 1 al 5')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(1)
                .setRequired(true);

            const commentsInput = new TextInputBuilder()
                .setCustomId('rating_comments')
                .setLabel('💬 Comentarios')
                .setPlaceholder('Escribe tus comentarios sobre la atención recibida...')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(500)
                .setRequired(false);

            const row1 = new ActionRowBuilder().addComponents(ratingInput);
            const row2 = new ActionRowBuilder().addComponents(commentsInput);

            modal.addComponents(row1, row2);
            await interaction.showModal(modal);
            return true;
        }

        if (['feedback_5', 'feedback_3', 'feedback_1', 'feedback_s'].includes(customId)) {
            await interaction.deferUpdate();
            let rating = (customId === 'feedback_5') ? 5 : (customId === 'feedback_3') ? 3 : (customId === 'feedback_1') ? 1 : null;

            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            const attachment = await discordTranscripts.createTranscript(interaction.channel, { limit: -1, returnType: 'attachment', filename: `close-${interaction.channel.name}.html`, saveImages: true });

            const logChannel = client.channels.cache.get(TICKET_CONFIG.LOG_TRANSCRIPTS);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setTitle('Ticket Cerrado').addFields({ name: 'Ticket', value: interaction.channel.name, inline: true }, { name: 'Rating', value: rating ? `${rating} ⭐` : 'N/A', inline: true }).setColor(0x2B2D31);
                await logChannel.send({ embeds: [logEmbed], files: [attachment] });
            }

            if (rating) {
                const feedbackChannel = client.channels.cache.get(TICKET_CONFIG.LOG_FEEDBACK);
                if (feedbackChannel) await feedbackChannel.send({ embeds: [new EmbedBuilder().setTitle('Nueva Valoración').addFields({ name: 'Rating', value: '⭐'.repeat(rating) }, { name: 'Staff', value: ticket?.claimed_by_id ? `<@${ticket.claimed_by_id}>` : 'General' }).setColor(rating >= 4 ? 0x57F287 : 0xED4245)] });
                await supabase.from('tickets').update({ status: 'CLOSED', closed_at: new Date().toISOString(), rating }).eq('channel_id', interaction.channel.id);
            } else {
                await supabase.from('tickets').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('channel_id', interaction.channel.id);
            }

            if (ticket && ticket.creator_id) {
                try {
                    const creator = await client.users.fetch(ticket.creator_id);
                    await creator.send({ content: `Tu ticket ha cerrado.`, files: [attachment] });
                } catch (e) { }
            }

            await interaction.channel.send('✅ Cerrando...');
            setTimeout(() => { if (interaction.channel) interaction.channel.delete().catch(() => { }); }, 4000);
            return true;
        }

        if (customId === 'btn_ai_close') {
            // MARK AS AI SOLVED
            await supabase.from('tickets').update({
                status: 'CLOSED',
                closed_at: new Date().toISOString(),
                closed_by_ai: true,
                rating: 5 // Asumimos 5 estrellas si la cierra el usuario feliz
            }).eq('channel_id', interaction.channel.id);

            // Log simple
            console.log(`[AI-STATS] Ticket ${interaction.channel.name} closed by AI.`);

            await interaction.reply({ content: '🤖 ¡Me alegra haber ayudado! Cerrando ticket...' });

            // Generate Transcript and Delete (reuse logic or simple delete)
            const attachment = await discordTranscripts.createTranscript(interaction.channel, { limit: -1, returnType: 'attachment', filename: `ai-close-${interaction.channel.name}.html`, saveImages: true });
            const logChannel = client.channels.cache.get(TICKET_CONFIG.LOG_TRANSCRIPTS);
            if (logChannel) await logChannel.send({ content: `🤖 **Ticket Resuelto por IA**`, files: [attachment] });

            setTimeout(() => interaction.channel.delete().catch(() => { }), 4000);
            return true;
        }

        if (customId.startsWith('btn_ai_help_')) {
            const roleId = customId.replace('btn_ai_help_', '');
            await interaction.deferUpdate();

            if (roleId && roleId !== 'none') {
                // DAR PERMISO AL ROL DE VER EL CANAL
                await interaction.channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    AttachFiles: true
                });

                await interaction.channel.send({ content: `🔔 <@&${roleId}>, el usuario ha solicitado asistencia humana. (Acceso concedido)` });
            } else {
                await interaction.channel.send({ content: `🔔 Staff, el usuario solicita asistencia.` });
            }

            // Disable button to prevent spam
            await interaction.editReply({ components: [] });
            return true;
        }

        // --- 🤖 AI ACTION CONFIRMATION ---
        if (customId.startsWith('ai_confirm_')) {
            // 1. Verify Staff Permission
            const member = interaction.member;
            if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && !member.roles.cache.has(TICKET_CONFIG.ROLE_COMMON)) {
                return interaction.reply({ content: '⛔ Solo el Staff puede confirmar acciones de la IA.', ephemeral: true });
            }

            // 2. Parse JSON from Embed
            const embed = interaction.message.embeds[0];
            if (!embed || !embed.description) return interaction.reply({ content: '❌ Error: No se encontró la descripción de la acción.', ephemeral: true });

            const jsonMatch = embed.description.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) return interaction.reply({ content: '❌ Error: No se pudo leer el JSON de la acción.', ephemeral: true });

            let actionData;
            try {
                actionData = JSON.parse(jsonMatch[1]);
            } catch (e) {
                return interaction.reply({ content: '❌ Error al procesar datos de la acción.', ephemeral: true });
            }

            await interaction.deferReply();

            // 3. Execute Action
            if (customId.includes('GRANT_ROLE')) {
                const { role_name, user_id } = actionData;
                let targetMember;

                try {
                    // Try to fetch member strictly. If user_id is missing, try to find the ticket owner?
                    if (!user_id) {
                        // Fallback attempt: Get ticket owner from DB? Too slow?
                        // Let's rely on AI providing it. The prompt says it should.
                        return interaction.editReply('❌ El JSON de la IA no incluía el ID del usuario.');
                    }
                    targetMember = await interaction.guild.members.fetch(user_id);
                } catch (err) {
                    return interaction.editReply(`❌ No se encontró al usuario con ID: ${user_id}`);
                }

                // Find Role (Name or ID)
                const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === role_name.toLowerCase() || r.id === role_name);
                if (!role) return interaction.editReply(`❌ No encontré el rol: **${role_name}**. Verifica que el nombre sea exacto.`);

                try {
                    await targetMember.roles.add(role);
                    await interaction.channel.send(`✅ **Acción Ejecutada:** Rol ${role} asignado a ${targetMember} por IA (Confirmado por ${interaction.user}).`);
                    await interaction.message.delete(); // Delete proposal
                } catch (err) {
                    await interaction.editReply(`❌ Error de permisos al dar rol: \`${err.message}\`. Revisa la jerarquía del Bot.`);
                }
            } else if (customId.includes('REMOVE_SANCTION')) {
                // Placeholder for future DB integration
                await interaction.editReply('ℹ️ La eliminación automática de sanciones aún no está conectada. Por favor, hazlo manualmente.');
            } else {
                await interaction.editReply('❓ Acción desconocida.');
            }

            return true;
        }

        if (customId === 'ai_reject') {
            const member = interaction.member;
            if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && !member.roles.cache.has(TICKET_CONFIG.ROLE_COMMON)) {
                return interaction.reply({ content: '⛔ Solo Staff.', ephemeral: true });
            }
            await interaction.message.delete();
            await interaction.reply({ content: '🗑️ Propuesta rechazada.', ephemeral: true });
            return true;
        }

        // --- APROBACIÓN DE ACCIONES IA ---
        if (customId.startsWith('approve_action:')) {
            const actionHash = customId.split(':')[1];

            // Recuperar datos de la acción
            const actionData = global.pendingActions?.get(actionHash);
            if (!actionData) {
                await interaction.reply({
                    content: '❌ Esta acción ha expirado o ya fue procesada.',
                    ephemeral: true
                });
                return true;
            }

            const { type: actionType, userId, data, reason } = actionData;

            // Verificar permisos por tipo de acción
            const ACTION_PERMISSIONS = {
                refund_money: [
                    '1457554145719488687', // Encargado de Economía
                    '1412882245735420006', // Junta Directiva
                    '1412887195014557787'  // Co-Owner
                ],
                remove_sanction: [
                    '1451703422800625777', // Encargado de Apelaciones
                    '1412882245735420006', // Junta Directiva
                    '1412887195014557787'  // Co-Owner
                ],
                grant_role: [
                    '1412887167654690908', // Staff (ROLE_COMMON)
                    '1412882245735420006', // Junta Directiva
                    '1412887195014557787'  // Co-Owner
                ],
                apply_ck: [
                    '1412887167654690908', // Encargado de CK (usa ROLE_COMMON por ahora)
                    '1412882245735420006', // Junta Directiva
                    '1412887195014557787'  // Co-Owner
                ]
            };

            const requiredRoles = ACTION_PERMISSIONS[actionType] || [];
            const hasPermission = interaction.member.roles.cache.some(r => requiredRoles.includes(r.id));

            if (!hasPermission) {
                await interaction.reply({
                    content: '❌ No tienes permisos para aprobar esta acción.',
                    ephemeral: true
                });
                return true;
            }

            await interaction.deferReply({ ephemeral: false });

            try {
                const supabase = interaction.client.supabase;
                const targetUser = await interaction.client.users.fetch(userId.replace(/[<@>]/g, ''));

                let resultMessage = '';

                switch (actionType) {
                    case 'refund_money':
                        const amount = parseInt(data);

                        // Dar dinero usando UnbelievaBoat API
                        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
                        const ubToken = process.env.UNBELIEVABOAT_TOKEN;
                        if (!ubToken) throw new Error('UNBELIEVABOAT_TOKEN no configurado');

                        const ubService = new UnbelievaBoatService(ubToken, supabase);
                        const transactionResult = await ubService.addMoney(
                            interaction.guildId,
                            targetUser.id,
                            amount,
                            `Devolución: ${reason}`,
                            'cash'
                        );

                        if (!transactionResult || !transactionResult.newBalance) {
                            throw new Error('Transacción fallida');
                        }

                        const newCash = transactionResult.newBalance.cash;

                        resultMessage = `✅ **Devolución Aprobada**\n\n💰 Monto: $${amount.toLocaleString()}\n👤 Usuario: ${targetUser}\n👮 Aprobado por: ${interaction.user}\n📝 Razón: ${reason}`;
                        resultMessage = `✅ **Devolución Aprobada**\n\n💰 Monto: $${amount.toLocaleString()}\n👤 Usuario: ${targetUser}\n💼 Nuevo Balance: $${newCash.toLocaleString()}\n👮 Aprobado por: ${interaction.user}\n📝 Razón: ${reason}`;
                        // Notificar al usuario
                        try {
                            await targetUser.send(`💰 Se te han devuelto $${amount.toLocaleString()} por: ${reason}`);
                        } catch (e) {
                            // DMs cerrados
                        }
                        break;

                    case 'remove_sanction':
                        const sanctionId = parseInt(actionData);
                        const { error: sanctionError } = await supabase
                            .from('sanctions')
                            .update({ status: 'revoked', revoked_by: interaction.user.id, revoked_reason: reason })
                            .eq('id', sanctionId);

                        if (sanctionError) throw sanctionError;

                        resultMessage = `✅ **Sanción Removida**\n\n🆔 ID Sanción: #${sanctionId}\n👤 Usuario: ${targetUser}\n👮 Aprobado por: ${interaction.user}\n📝 Razón: ${reason}`;

                        // Notificar al usuario
                        try {
                            await targetUser.send(`✅ Tu sanción #${sanctionId} ha sido revocada. Razón: ${reason}`);
                        } catch (e) { }
                        break;

                    case 'apply_ck':
                        const ckCommand = interaction.client.commands.get('ck');
                        if (!ckCommand) throw new Error('Comando CK no encontrado');

                        const fakeInteraction = {
                            ...interaction,
                            options: {
                                getSubcommand: () => 'aplicar',
                                getUser: (name) => name === 'usuario' ? targetUser : null,
                                getString: (name) => {
                                    if (name === 'tipo') return 'CK Administrativo';
                                    if (name === 'razon') return data;
                                    return null;
                                },
                                getAttachment: (name) => {
                                    if (name === 'evidencia') {
                                        return { url: 'https://via.placeholder.com/300.png?text=CK', contentType: 'image/png' };
                                    }
                                    return null;
                                }
                            }
                        };

                        try {
                            await ckCommand.execute(fakeInteraction);
                            resultMessage = `✅ **CK Aplicado**\n\n👤 Usuario: ${targetUser}\n👮 Aprobado por: ${interaction.user}\n📝 Razón: ${data}`;
                            try {
                                await targetUser.send(`🔴 CK aplicado. Razón: ${data}`);
                            } catch (e) { }
                        } catch (ckError) {
                            throw new Error(`Error: ${ckError.message}`);
                        }
                        break;

                    case 'grant_role':
                        const roleName = data;
                        const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

                        if (!role) {
                            throw new Error(`Rol "${roleName}" no encontrado`);
                        }

                        const member = await interaction.guild.members.fetch(targetUser.id);
                        await member.roles.add(role);

                        resultMessage = `✅ **Rol Otorgado**\n\n👑 Rol: ${role}\n👤 Usuario: ${targetUser}\n👮 Aprobado por: ${interaction.user}\n📝 Razón: ${reason}`;

                        // Notificar al usuario
                        try {
                            await targetUser.send(`👑 Se te ha otorgado el rol **${role.name}**. Razón: ${reason}`);
                        } catch (e) { }
                        break;
                }

                // Audit log
                if (interaction.client.logAudit) {
                    await interaction.client.logAudit(
                        `Acción IA Aprobada: ${actionType}`,
                        resultMessage,
                        interaction.user,
                        targetUser,
                        0x00FF00
                    );
                }

                await interaction.editReply({ content: resultMessage });

                // Deshabilitar botón
                const disabledButton = ButtonBuilder.from(interaction.message.components[0].components[0])
                    .setDisabled(true)
                    .setLabel('✅ Aprobado');
                const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                await interaction.message.edit({ components: [disabledRow] });

            } catch (error) {
                console.error('Error ejecutando acción:', error);
                await interaction.editReply({
                    content: `❌ Error ejecutando acción: ${error.message}`
                });
            }

            return true;
        }

        // --- ESCALAMIENTO MANUAL A STAFF ---
        if (customId === 'escalate_to_staff') {
            await interaction.deferUpdate();
            const STAFF_ROLE_ID = '1412887167654690908'; // ROLE_COMMON
            await interaction.channel.send({
                content: `🚨 <@&${STAFF_ROLE_ID}> - **<@${interaction.user.id}> ha solicitado atención del Staff**\n\nEste ticket requiere soporte humano. Un moderador lo revisará pronto.`,
            });
            return true;
        }

        return false;
    }
};

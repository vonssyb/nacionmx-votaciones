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
            // A) Check Blacklist BD
            const { data: isBanned } = await supabase.from('ticket_blacklist').select('*').eq('user_id', interaction.user.id).single();
            if (isBanned) return interaction.reply({ content: '🚫 Estás vetado del sistema de soporte por mal comportamiento.', ephemeral: true });

            // B) Check Horario (Opcional - solo Warning)
            const hora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false });
            // Si es entre 2 AM y 9 AM
            const isNight = (hora >= 2 && hora < 9);
            if (isNight) {
                await interaction.channel.send({ content: '💤 **Nota:** Nuestro staff duerme a estas horas. Deja tu mensaje y te responderemos en la mañana.', ephemeral: true }).catch(() => { });
                // No bloqueamos, solo avisamos (o bloqueamos si prefieres)
            }

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
                    new TextInputBuilder().setCustomId('q_who').setLabel("¿A quién reportas?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_rule').setLabel("¿Qué regla rompió?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_when').setLabel("¿Dónde/Cuándo ocurrió?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_proof').setLabel("Pruebas (Links obligatorios)").setStyle(TextInputStyle.Paragraph).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_blacklist') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_sanction').setLabel("Sanción Actual").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_why').setLabel("Motivo de la Sanción").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_regret').setLabel("¿Reconoces el error?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_type').setLabel("Tipo de Apelación").setStyle(TextInputStyle.Short).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_ck') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_char').setLabel("Nombre del Personaje").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_motive').setLabel("Motivo de Rol (CK)").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_prior').setLabel("¿Rol Previo? (Contexto)").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_proof').setLabel("Pruebas del Rol (Links)").setStyle(TextInputStyle.Paragraph).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_trabajo') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_role_req').setLabel("¿Solicitas un rol? (Si/No)").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_role_name').setLabel("Nombre del Rol (Si aplica)").setStyle(TextInputStyle.Short).setRequired(false),
                    new TextInputBuilder().setCustomId('q_details').setLabel("Detalles / Experiencia").setStyle(TextInputStyle.Paragraph).setRequired(false)
                );
            } else if (ticketTypeKey === 'ticket_bug') {
                // Modified for Bugs based on User Request/Context
                fields.push(
                    new TextInputBuilder().setCustomId('q_reason').setLabel("Descubre el fallo/bug").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_impede').setLabel("¿Te impide jugar/rolear?").setStyle(TextInputStyle.Short).setRequired(true)
                );
            } else {
                // General & VIP
                fields.push(new TextInputBuilder().setCustomId('q_reason').setLabel("Describe tu problema o duda").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000));
            }

            fields.forEach(f => modal.addComponents(new ActionRowBuilder().addComponents(f)));
            await interaction.showModal(modal);
            return true;
        }

        // --- 3. CREATE LOGIC (Submit) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_create_main_')) {
            await interaction.deferReply({ ephemeral: true });
            const typeKey = customId.replace('modal_create_main_', '');
            const config = TICKET_TYPES[typeKey];
            if (!config) return interaction.editReply('❌ Config Error.');

            let description = `**Tipo:** ${config.title}\n**Usuario:** <@${interaction.user.id}>\n\n`;

            // Append fields dynamically
            interaction.fields.fields.forEach(field => {
                // Intenta buscar el label original si es posible, o usa el value
                description += `**${field.customId}**: ${field.value}\n`;
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
                if (config.role) permissionOverwrites.push({ id: config.role, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                if (config.pingUser) permissionOverwrites.push({ id: config.pingUser, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: config.category,
                    topic: `ID: ${interaction.user.id} | ${config.title}`,
                    permissionOverwrites
                });

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
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Sistema de Soporte' }).setTimestamp();

                let pings = `<@${interaction.user.id}>`;
                // NOTA: Ya no hacemos ping al rol automáticamente si queremos que la IA intente resolverlo primero.
                // Pero para seguridad, guardamos el Rol en una variable para usarlo si piden ayuda.
                const staffRoleID = config.role;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Success).setEmoji('✋')
                );

                await ticketChannel.send({ content: pings, embeds: [embed], components: [row] });

                // --- IA ANALYSIS ---
                try {
                    const aiAnswer = await generateAIResponse(description);
                    if (aiAnswer) {
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
                    } else {
                        // Fallback: Si la IA falla o no responde, hacemos ping al staff manual
                        if (config.role) await ticketChannel.send({ content: `📢 <@&${config.role}>` });
                    }
                } catch (e) {
                    // Fallback error
                    if (config.role) await ticketChannel.send({ content: `📢 <@&${config.role}>` });
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
        if (customId === 'btn_claim_ticket') {
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
            if (!isStaff) return interaction.reply({ content: '🚫 Solo Staff.', ephemeral: true });

            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.claimed_by_id) return interaction.reply({ content: `⚠️ Reclamado por <@${ticket.claimed_by_id}>`, ephemeral: true });

            await supabase.from('tickets').update({ claimed_by_id: interaction.user.id }).eq('channel_id', interaction.channel.id);
            await interaction.channel.setTopic(`${interaction.channel.topic} | Staff: ${interaction.user.tag}`);
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Ticket reclamado por <@${interaction.user.id}>`).setColor(0x2ECC71)] });
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
            const embed = new EmbedBuilder().setTitle('🔒 Finalizado').setDescription('Califica la atención:').setColor(0xFEE75C);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('feedback_5').setEmoji('⭐').setLabel('Excelente').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('feedback_3').setEmoji('😐').setLabel('Regular').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('feedback_1').setEmoji('😡').setLabel('Mal').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('feedback_s').setLabel('Omitir').setStyle(ButtonStyle.Secondary)
            );
            await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
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
            setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
            return true;
        }

        if (customId === 'btn_ai_close') {
            // Reutilizamos la lógica de cierre confirmada
            // O directamente saltamos a la confirmación
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close_ticket_confirm').setLabel('Confirmar Cerrar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('btn_cancel_close').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: '¿Cerrar ticket?', components: [row] });
            return true;
        }

        if (customId.startsWith('btn_ai_help_')) {
            const roleId = customId.replace('btn_ai_help_', '');
            await interaction.deferUpdate();

            if (roleId && roleId !== 'none') {
                await interaction.channel.send({ content: `🔔 <@&${roleId}>, el usuario ha solicitado asistencia humana.` });
            } else {
                await interaction.channel.send({ content: `🔔 Staff, el usuario solicita asistencia.` });
            }

            // Disable button
            await interaction.editReply({ components: [] });
            return true;
        }

        return false;
    }
};

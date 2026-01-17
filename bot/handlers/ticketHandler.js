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

// --- CONFIGURACIÓN PRINCIPAL (IDs PROPORCIONADOS) ---
const TICKET_CONFIG = {
    // Categorías
    CAT_GENERAL: '1414066417019392000',
    CAT_VIP: '1450225651935219854',
    CAT_BUGS: '1459987769932648680',

    // Roles Staff
    ROLE_COMMON: '1412887167654690908', // Soporte Gral, Reportes, Trabajo, VIP
    ROLE_BLACKLIST: '1451703422800625777',
    ROLE_CK: '1450938106395234526',

    // Log Channel Transcripts
    LOG_TRANSCRIPTS: '1414065296704016465',

    // Usuarios Específicos
    USER_DEV: '826637667718266880', // Fallas con el bot

    // Roles VIP (Acceso)
    VIP_ACCESS_ROLES: [
        '1414033620636532849',
        '1412887172503175270',
        '1423520675158691972',
        '1449950535166726317'
    ]
};

// Mapa de Opciones -> Configuración
const TICKET_TYPES = {
    'ticket_general': {
        title: 'Soporte General',
        category: TICKET_CONFIG.CAT_GENERAL,
        role: TICKET_CONFIG.ROLE_COMMON,
        emoji: '🔧'
    },
    'ticket_reportes': {
        title: 'Reportes y Sanciones',
        category: TICKET_CONFIG.CAT_GENERAL,
        role: TICKET_CONFIG.ROLE_COMMON,
        emoji: '🚨'
    },
    'ticket_blacklist': {
        title: 'Blacklist | Apelación',
        category: TICKET_CONFIG.CAT_GENERAL,
        role: TICKET_CONFIG.ROLE_BLACKLIST,
        emoji: '📜'
    },
    'ticket_trabajo': {
        title: 'Facciones y Trabajo',
        category: TICKET_CONFIG.CAT_GENERAL,
        role: TICKET_CONFIG.ROLE_COMMON,
        emoji: '💼'
    },
    'ticket_ck': {
        title: 'Solicitud FEC / CK',
        category: TICKET_CONFIG.CAT_GENERAL,
        role: TICKET_CONFIG.ROLE_CK,
        emoji: '☠️'
    },
    'ticket_vip': {
        title: 'Atención VIP',
        category: TICKET_CONFIG.CAT_VIP,
        role: TICKET_CONFIG.ROLE_COMMON,
        emoji: '💎',
        vipOnly: true
    },
    'ticket_bug': {
        title: 'Falla con el Bot',
        category: TICKET_CONFIG.CAT_BUGS,
        role: null,
        pingUser: TICKET_CONFIG.USER_DEV,
        emoji: '🤖'
    }
};

module.exports = {
    async handleTicketInteraction(interaction, client, supabase) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

        const { customId } = interaction;
        let ticketTypeKey = null;

        // --- 1. SELECCIÓN DE TIPO ---
        if (interaction.isStringSelectMenu() && customId === 'ticket_main_menu') ticketTypeKey = interaction.values[0];
        if (interaction.isButton()) {
            if (customId === 'ticket_btn_vip') ticketTypeKey = 'ticket_vip';
            if (customId === 'ticket_btn_bug') ticketTypeKey = 'ticket_bug';
        }

        // --- 2. MOSTRAR MODAL (Preguntas Dinámicas) ---
        if (ticketTypeKey) {
            const config = TICKET_TYPES[ticketTypeKey];
            if (!config) return false;

            // VIP Check
            if (config.vipOnly) {
                const hasVipRole = interaction.member.roles.cache.some(r => TICKET_CONFIG.VIP_ACCESS_ROLES.includes(r.id));
                if (!hasVipRole) return interaction.reply({ content: '🚫 Solo usuarios VIP pueden abrir este ticket.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_create_main_${ticketTypeKey}`)
                .setTitle(config.title);

            // Campos del Modal según el Tipo
            const fields = [];

            if (ticketTypeKey === 'ticket_reportes') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_who').setLabel("¿A quién estás reportando?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_rule').setLabel("¿Qué regla rompió?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_when').setLabel("¿Cuándo y dónde ocurrió?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_proof').setLabel("¿Tienes pruebas claras? (Links)").setStyle(TextInputStyle.Paragraph).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_blacklist') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_sanction').setLabel("¿Qué sanción tienes actualmente?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_why').setLabel("¿Por qué fuiste sancionado?").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_regret').setLabel("¿Reconoces el error cometido?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_type').setLabel("¿Qué tipo de apelación requieres?").setStyle(TextInputStyle.Short).setRequired(true)
                );
            } else if (ticketTypeKey === 'ticket_trabajo') {
                // Assuming Image 3 logic implies generic work/role questions or similar
                fields.push(
                    new TextInputBuilder().setCustomId('q_role_req').setLabel("¿Solicitas un rol? (Si/No)").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_role_name').setLabel("Si respondiste 'sí', ¿qué rol necesitas?").setStyle(TextInputStyle.Short).setRequired(false),
                    new TextInputBuilder().setCustomId('q_details').setLabel("Detalles adicionales").setStyle(TextInputStyle.Paragraph).setRequired(false)
                );
            } else if (ticketTypeKey === 'ticket_ck') {
                fields.push(
                    new TextInputBuilder().setCustomId('q_char').setLabel("¿Qué personaje está involucrado?").setStyle(TextInputStyle.Short).setRequired(true),
                    new TextInputBuilder().setCustomId('q_motive').setLabel("¿Cuál es el motivo RP?").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_prior').setLabel("¿Hubo rol previo que lo justifique?").setStyle(TextInputStyle.Paragraph).setRequired(true),
                    new TextInputBuilder().setCustomId('q_proof').setLabel("¿Tienes pruebas del rol? (Links)").setStyle(TextInputStyle.Paragraph).setRequired(true)
                );
            } else {
                // General, VIP, Bug (Simple)
                fields.push(
                    new TextInputBuilder().setCustomId('q_reason').setLabel("¿Cuál es tu problema o duda?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
                );
            }

            fields.forEach(f => modal.addComponents(new ActionRowBuilder().addComponents(f)));
            await interaction.showModal(modal);
            return true;
        }

        // --- 3. CREAR TICKET (Submit) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_create_main_')) {
            await interaction.deferReply({ ephemeral: true });
            const typeKey = customId.replace('modal_create_main_', '');
            const config = TICKET_TYPES[typeKey];
            if (!config) return interaction.editReply('❌ Error de config.');

            // Build Description from Fields
            let description = `**Usuario:** <@${interaction.user.id}>\n**Tipo:** ${config.title}\n\n`;

            try {
                if (typeKey === 'ticket_reportes') {
                    description += `**Reportado:** ${interaction.fields.getTextInputValue('q_who')}\n`;
                    description += `**Regla:** ${interaction.fields.getTextInputValue('q_rule')}\n`;
                    description += `**Dónde:** ${interaction.fields.getTextInputValue('q_when')}\n`;
                    description += `**Pruebas:**\n${interaction.fields.getTextInputValue('q_proof')}`;
                } else if (typeKey === 'ticket_blacklist') {
                    description += `**Sanción:** ${interaction.fields.getTextInputValue('q_sanction')}\n`;
                    description += `**Motivo:** ${interaction.fields.getTextInputValue('q_why')}\n`;
                    description += `**Reconoce:** ${interaction.fields.getTextInputValue('q_regret')}\n`;
                    description += `**Tipo Apelación:** ${interaction.fields.getTextInputValue('q_type')}`;
                } else if (typeKey === 'ticket_ck') {
                    description += `**Personaje:** ${interaction.fields.getTextInputValue('q_char')}\n`;
                    description += `**Motivo RP:** ${interaction.fields.getTextInputValue('q_motive')}\n`;
                    description += `**Rol Previo:** ${interaction.fields.getTextInputValue('q_prior')}\n`;
                    description += `**Pruebas:**\n${interaction.fields.getTextInputValue('q_proof')}`;
                } else if (typeKey === 'ticket_trabajo') {
                    description += `**¿Solicita Rol?:** ${interaction.fields.getTextInputValue('q_role_req')}\n`;
                    description += `**Rol:** ${interaction.fields.getTextInputValue('q_role_name')}\n`;
                    description += `**Detalles:**\n${interaction.fields.getTextInputValue('q_details')}`;
                } else {
                    description += `**Consulta:**\n${interaction.fields.getTextInputValue('q_reason')}`;
                }
            } catch (e) {
                description += `*(No se pudieron leer todos los campos)*`;
            }

            // Create Channel
            try {
                const channelName = `${config.emoji}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9\-_]/g, '');

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

                // DB Insert
                await supabase.from('tickets').insert([{
                    guild_id: interaction.guild.id,
                    channel_id: ticketChannel.id,
                    creator_id: interaction.user.id,
                    status: 'OPEN'
                }]);

                // Embed & Pings
                let pings = `<@${interaction.user.id}>`;
                if (config.role) pings += ` <@&${config.role}>`;
                if (config.pingUser) pings += ` <@${config.pingUser}>`;

                const embed = new EmbedBuilder()
                    .setTitle(`${config.emoji} Nuevo Ticket: ${config.title}`)
                    .setDescription(description)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Sistema de Tickets Nación MX' })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Success).setEmoji('✋')
                );

                await ticketChannel.send({ content: pings, embeds: [embed], components: [row] });
                await interaction.editReply(`✅ Ticket creado: ${ticketChannel}`);

            } catch (err) {
                console.error(err);
                await interaction.editReply('❌ Error al crear el canal.');
            }
            return true;
        }

        // --- 4. ACCIONES (Claim, Close) ---

        // CLAIM
        if (customId === 'btn_claim_ticket') {
            await interaction.deferReply();

            // Check Permissions (Only those with ViewChannel can claim, usually staff)
            // But we can check specifically for staff roles if strictness is needed.
            // For now, assuming anyone who can see the button (staff + creator) 
            // BUT Creator shouldn't claim their own ticket effectively in a "Staff" way.
            // Let's rely on the role check or DB.

            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
            // Simple check: If they have ManageMessages, they are likely staff. Or check specific roles.

            if (!isStaff) return interaction.editReply({ content: '🚫 No tienes permisos para reclamar tickets.' });

            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.claimed_by_id) return interaction.editReply(`⚠️ Ya reclamado por <@${ticket.claimed_by_id}>.`);

            await supabase.from('tickets').update({ claimed_by_id: interaction.user.id }).eq('channel_id', interaction.channel.id);
            await interaction.channel.setTopic(`${interaction.channel.topic} | Staff: ${interaction.user.tag}`);
            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`✅ Ticket atendido por <@${interaction.user.id}>`).setColor(0x2ECC71)] });
            return true;
        }

        // CLOSE ASK
        if (customId === 'btn_close_ticket_ask') {
            // STAFF ONLY CHECK
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) || interaction.member.roles.cache.has(TICKET_CONFIG.ROLE_COMMON);
            // Ajustar lógica de permisos según necesidad estricta.
            // El usuario dijo: "el usuario no puede cerrar el ticket tiene que cerrarlo el staff"

            // Check if user is the creator?
            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.creator_id === interaction.user.id) {
                // It's the creator trying to close
                // Allow user to REQUEST closure? Or deny completely?
                // "el usuario no puede cerrar" usually means they shouldn't have the button or the button errors.
                return interaction.reply({ content: '🚫 Solo el Staff puede cerrar el ticket. Por favor espera a que un administrador lo finalice.', ephemeral: true });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close_ticket_confirm').setLabel('Confirmar Cierre & Transcript').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('btn_cancel_close').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: '¿Estás seguro de cerrar este ticket?', components: [row] });
            return true;
        }

        // CLOSE CONFIRM
        if (customId === 'btn_close_ticket_confirm') {
            await interaction.update({ content: '🔒 Cerrando ticket y generando logs...', components: [] });

            // Generate Transcript
            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1,
                returnType: 'attachment',
                filename: `transcript-${interaction.channel.name}.html`,
                saveImages: true,
                footerText: "Nacion MX • Transcript Oficial",
                poweredBy: false
            });

            // 1. Send to Log Channel
            const logChannel = client.channels.cache.get(TICKET_CONFIG.LOG_TRANSCRIPTS);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📄 Nuevo Transcript de Ticket')
                    .addFields(
                        { name: 'Canal', value: interaction.channel.name, inline: true },
                        { name: 'Cerrado por', value: interaction.user.tag, inline: true },
                        { name: 'Fecha', value: new Date().toLocaleString(), inline: true }
                    )
                    .setColor(0x2B2D31)
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed], files: [attachment] });
            }

            // 2. DM User (Creator) - Optional but good practice
            // Need to fetch creator from DB or Topic parsing
            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.creator_id) {
                try {
                    const creator = await client.users.fetch(ticket.creator_id);
                    await creator.send({
                        content: `Tu ticket **${interaction.channel.name}** ha sido cerrado. Aquí tienes una copia del historial.`,
                        files: [attachment]
                    });
                } catch (e) {
                    // DM Closed
                }
            }

            // Close logic
            await supabase.from('tickets').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('channel_id', interaction.channel.id);

            // Delete Channel
            setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
            return true;
        }

        if (customId === 'btn_cancel_close') {
            await interaction.message.delete().catch(() => { });
            return true;
        }

        return false;
    }
};

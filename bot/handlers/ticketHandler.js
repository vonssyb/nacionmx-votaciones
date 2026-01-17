const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType
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
        category: TICKET_CONFIG.CAT_GENERAL, // ¿O tiene categoría propia? Asumo General si no se especificó otra.
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
        category: TICKET_CONFIG.CAT_GENERAL, // El usuario dio ID 'ck 1450938106395234526' como Rol? Sí.
        role: TICKET_CONFIG.ROLE_CK,
        emoji: '☠️'
    },
    // Botones Especiales
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
        role: null, // Atiende el DEV
        pingUser: TICKET_CONFIG.USER_DEV,
        emoji: '🤖'
    }
};

module.exports = {
    async handleTicketInteraction(interaction, client, supabase) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

        const { customId } = interaction;
        let ticketTypeKey = null;

        // --- 1. MENÚ DESPLEGABLE ---
        if (interaction.isStringSelectMenu() && customId === 'ticket_main_menu') {
            ticketTypeKey = interaction.values[0];
        }

        // --- 2. BOTONES ESPECIALES ---
        if (interaction.isButton()) {
            if (customId === 'ticket_btn_vip') ticketTypeKey = 'ticket_vip';
            if (customId === 'ticket_btn_bug') ticketTypeKey = 'ticket_bug';
        }

        // --- 3. PROCESAR APERTURA (Si se detectó un tipo) ---
        if (ticketTypeKey) {
            const config = TICKET_TYPES[ticketTypeKey];
            if (!config) return false;

            // Verificación VIP
            if (config.vipOnly) {
                const hasVipRole = interaction.member.roles.cache.some(r => TICKET_CONFIG.VIP_ACCESS_ROLES.includes(r.id));
                if (!hasVipRole) {
                    return interaction.reply({
                        content: '🚫 **Acceso Denegado:** Esta opción es exclusiva para usuarios VIP.',
                        ephemeral: true
                    });
                }
            }

            // Modal para Razón
            const modal = new ModalBuilder()
                .setCustomId(`modal_create_main_${ticketTypeKey}`)
                .setTitle(config.title);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason_input')
                .setLabel('Cuéntanos más detalles')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe tu consulta o problema...')
                .setRequired(true)
                .setMaxLength(1000);

            const row = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return true;
        }

        // --- 4. CREAR CANAL (POST-MODAL) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_create_main_')) {
            await interaction.deferReply({ ephemeral: true });

            const typeKey = customId.replace('modal_create_main_', '');
            const config = TICKET_TYPES[typeKey];
            const reason = interaction.fields.getTextInputValue('reason_input');

            if (!config) return interaction.editReply('❌ Error de configuración.');

            // Crear Canal
            try {
                const channelName = `${config.emoji}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9\-_]/g, ''); // Sanitize

                // Permisos Base
                const permissionOverwrites = [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ];

                // Agregar Rol o Usuario de Soporte
                if (config.role) {
                    permissionOverwrites.push({
                        id: config.role,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    });
                }

                if (config.pingUser) {
                    permissionOverwrites.push({
                        id: config.pingUser,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: config.category,
                    topic: `Ticket: ${config.title} | Usuario: ${interaction.user.id}`,
                    permissionOverwrites: permissionOverwrites
                });

                // Registrar en BD (para consistencia y transcripts)
                await supabase.from('tickets').insert([{
                    guild_id: interaction.guild.id,
                    channel_id: ticketChannel.id,
                    creator_id: interaction.user.id,
                    status: 'OPEN',
                    panel_id: null // Panel manual/hardcoded
                }]);

                // Mensaje de Bienvenida + Ping
                let mentionString = `<@${interaction.user.id}>`;
                if (config.role) mentionString += ` <@&${config.role}>`;
                if (config.pingUser) mentionString += ` <@${config.pingUser}>`;

                const embed = new EmbedBuilder()
                    .setTitle(`${config.emoji} ${config.title}`)
                    .setDescription(`Hola <@${interaction.user.id}>, gracias por contactarnos.\n\n**Asunto:**\n${reason}`)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Sistema de Soporte • Nación MX' })
                    .setTimestamp();

                const rowCtrl = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                    new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('btn_transcript_ticket').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📝')
                );

                await ticketChannel.send({ content: mentionString, embeds: [embed], components: [rowCtrl] });

                await interaction.editReply({ content: `✅ Ticket creado: ${ticketChannel}` });

            } catch (err) {
                console.error('Error creating smart ticket:', err);
                await interaction.editReply('❌ Hubo un error al crear el canal. Verifica permisos/categoría.');
            }
            return true;
        }

        // --- 5. LÓGICA EXISTENTE (Cerrar, Claim, Transcript) ---
        // Se mantiene igual que la versión anterior, reutilizamos los mismos botones

        // CLAIM
        if (customId === 'btn_claim_ticket') {
            await interaction.deferReply();
            const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
            if (ticket && ticket.claimed_by_id) return interaction.editReply(`⚠️ Ya reclamado por <@${ticket.claimed_by_id}>.`);

            await supabase.from('tickets').update({ claimed_by_id: interaction.user.id }).eq('channel_id', interaction.channel.id);
            await interaction.channel.setTopic(`${interaction.channel.topic} | Atiende: ${interaction.user.tag}`);
            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`✅ Ticket reclamado por <@${interaction.user.id}>`).setColor(0x2ECC71)] });
            return true;
        }

        // CLOSE ASK
        if (customId === 'btn_close_ticket_ask') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close_ticket_confirm').setLabel('Confirmar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('btn_cancel_close').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ content: '¿Cerrar ticket?', components: [row] });
            return true;
        }

        // CANCEL
        if (customId === 'btn_cancel_close') {
            await interaction.message.delete().catch(() => { });
            return true;
        }

        // CLOSE CONFIRM
        if (customId === 'btn_close_ticket_confirm') {
            await interaction.reply('🔒 Generando transcript y cerrando...');
            const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                limit: -1, returnType: 'attachment', filename: `transcript-${interaction.channel.name}.html`, saveImages: true
            });

            // Enviar DM
            try { await interaction.user.send({ content: `Transcript: ${interaction.channel.name}`, files: [attachment] }); } catch (e) { }

            await supabase.from('tickets').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('channel_id', interaction.channel.id);

            setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
            return true;
        }

        // TRANSCRIPT
        if (customId === 'btn_transcript_ticket') {
            await interaction.deferReply({ ephemeral: true });
            const attachment = await discordTranscripts.createTranscript(interaction.channel, { limit: -1, returnType: 'attachment', filename: `trans-${interaction.channel.name}.html` });
            await interaction.editReply({ content: '📝', files: [attachment] });
            return true;
        }

        // --- HANDLER BOTONES SETUP (OLD) ---
        // (Podemos dejar el handler viejo aquí si se quiere soportar ambos, o eliminarlo)
        if (customId === 'btn_create_ticket_panel') {
            // ... Logic OLD (Simpler) if needed ...
        }

        return false;
    }
};

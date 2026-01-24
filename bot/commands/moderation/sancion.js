const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const NotificationTemplates = require('../../services/NotificationTemplates');
const StorageService = require('../../services/StorageService');
const moment = require('moment-timezone');
const { applyRoleBenefits } = require('../../services/EconomyHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sancion')
        .setDescription('Sistema de Sanciones Profesional Nación MX')
        .setDescription('Sistema de Sanciones Profesional Nación MX')
        // REQUIRED OPTIONS FIRST
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de sanción/documento')
                .setRequired(true)
                .addChoices(
                    { name: '📜 Sanción General (Reporte)', value: 'general' },
                    { name: '🚨 Sanción Administrativa (SA)', value: 'sa' },
                    { name: '📢 Notificación', value: 'notificacion' }
                ))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Código de Regla (General) / Detalle (SA) / Asunto (Notificación)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Descripción de los hechos o cuerpo del mensaje')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('evidencia')
                .setDescription('Evidencia obligatoria (Imagen/Video)')
                .setRequired(true))
        // OPTIONAL OPTIONS AFTER
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a sancionar (si está en el servidor)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('discord_id')
                .setDescription('ID de Discord (si el usuario salió del servidor)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('accion')
                .setDescription('Solo para Sanción General: Tipo de castigo')
                .setRequired(false)
                .addChoices(
                    { name: 'Advertencia Verbal', value: 'Advertencia Verbal' },
                    { name: 'Warn (Advertencia)', value: 'Warn' },
                    { name: 'Ban Temporal ERLC', value: 'Ban Temporal ERLC' },
                    { name: 'Ban Permanente ERLC', value: 'Ban Permanente ERLC' },
                    { name: 'Kick ERLC', value: 'Kick ERLC' },
                    { name: 'Kick Discord', value: 'Kick Discord' },
                    { name: 'Ban Temporal Discord', value: 'Ban Temporal Discord' },
                    { name: 'Ban Permanente Discord', value: 'Ban Permanente Discord' },
                    { name: 'Timeout / Mute', value: 'Timeout' }, // Added Timeout
                    { name: 'Blacklist', value: 'Blacklist' }
                ))
        .addStringOption(option =>
            option.setName('tipo_blacklist')
                .setDescription('Solo si accción es Blacklist')
                .setRequired(false)
                .addChoices(
                    { name: 'Moderación', value: 'Blacklist Moderacion' },
                    { name: 'Facciones Policiales', value: 'Blacklist Facciones Policiales' },
                    { name: 'Cartel', value: 'Blacklist Cartel' },
                    { name: 'Política', value: 'Blacklist Politica' },
                    { name: 'Empresas', value: 'Blacklist Empresas' },
                    { name: 'Influencer', value: 'Blacklist Influencer' },
                    { name: 'TOTAL (Ban Permanente)', value: 'Blacklist Total' }
                ))
        .addStringOption(option =>
            option.setName('duracion')
                .setDescription('Tiempo (ej: 10m, 2h, 1d, 1s=semana, 1w=mes)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('roblox_usuario')
                .setDescription('Username/ID Roblox (Búsqueda DB y Ban ERLC)')
                .setRequired(false)),

    async execute(interaction) {
        // 1. Get Options EARLY to decide ephemeral state
        const type = interaction.options.getString('tipo');
        const accion = interaction.options.getString('accion');

        // ... (Permissions retained) ...
        const ROLES_CONFIG = {
            LEVEL_4_BOARD: ['1412882245735420006', '1456020936229912781', '1451703422800625777', '1454985316292100226'],
            LEVEL_3_ADMIN: ['1412882248411381872'],
            LEVEL_2_STAFF: ['1412887079612059660'],
            LEVEL_1_TRAINING: ['1412887167654690908']
        };
        const memberRoles = interaction.member.roles.cache;
        // Determine User Level
        let userLevel = 0;
        if (memberRoles.some(r => ROLES_CONFIG.LEVEL_4_BOARD.includes(r.id))) userLevel = 4;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_3_ADMIN.includes(r.id))) userLevel = 3;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_2_STAFF.includes(r.id))) userLevel = 2;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_1_TRAINING.includes(r.id))) userLevel = 1;

        if (userLevel === 0) return interaction.followUp({ content: '⛔ **Acceso Denegado:** No tienes rango suficiente.', flags: [64] });

        // Helper to check levels
        const hasRole = (roleIds) => roleIds.some(id => memberRoles.has(id));
        const isBoard = hasRole(ROLES_CONFIG.LEVEL_4_BOARD);
        const isAdmin = hasRole(ROLES_CONFIG.LEVEL_3_ADMIN) || isBoard;
        const isStaff = hasRole(ROLES_CONFIG.LEVEL_2_STAFF) || isAdmin;
        const isTraining = hasRole(ROLES_CONFIG.LEVEL_1_TRAINING) || isStaff;

        // Permission Checks (Blacklist, SA, etc)
        if (accion === 'Blacklist' && !isBoard) return interaction.followUp({ content: '🛑 **Acceso Denegado (Nivel 4)**', flags: [64] });
        if (((type === 'sa') || (accion === 'Ban Permanente ERLC') || (accion === 'Ban Temporal ERLC')) && !isAdmin)
            return interaction.followUp({ content: '🛑 **Acceso Denegado (Nivel 3)**', flags: [64] });
        if (((accion === 'Ban Permanente Discord') || (accion === 'Ban Temporal Discord') || (accion === 'Kick Discord')) && !isBoard)
            return interaction.followUp({ content: '🛑 **Acceso Denegado (Nivel 4)**', flags: [64] });
        if (!isTraining) return interaction.followUp({ content: '🛑 **Acceso Denegado**', flags: [64] });

        // Deferral handled globally by index_moderacion.js
        // const isEphemeral = (type === 'notificacion');
        // // await interaction.deferReply({ flags: isEphemeral ? [64] : [] });

        // --- GET TARGET USER (Support 3 methods) ---
        const usuarioMention = interaction.options.getUser('usuario');
        const discordIdInput = interaction.options.getString('discord_id');
        // UNIFIED ROBLOX INPUT
        const robloxInput = interaction.options.getString('roblox_usuario');

        let targetUser = null;
        let targetDiscordId = null;

        if (usuarioMention) {
            // Method 1: Direct mention
            targetUser = usuarioMention;
            targetDiscordId = usuarioMention.id;
        } else if (discordIdInput) {
            // Method 2: Discord ID
            targetDiscordId = discordIdInput.trim();
            try {
                targetUser = await interaction.client.users.fetch(targetDiscordId);
            } catch (error) {
                return interaction.editReply(`❌ No se pudo encontrar el usuario con ID: ${targetDiscordId}`);
            }
        } else if (robloxInput) {
            // Method 3: Roblox Unified Lookup (Name or ID)
            // Try to find citizen by roblox_username OR roblox_id
            const { data: citizen } = await interaction.client.supabase
                .from('citizens')
                .select('discord_id, roblox_username')
                .or(`roblox_username.ilike.${robloxInput.trim()},roblox_id.eq.${robloxInput.trim()}`)
                .maybeSingle();

            if (!citizen) {
                // Not found in DB. 
                // If the action is ERLC-only, we might proceed without a Discord User?
                // But for Sancion General/SA we need a user.
                if (accion && accion.includes('ERLC')) {
                    // Proceed without discord targetUser (will only execute ERLC command)
                    // targetUser remains null.
                } else {
                    return interaction.editReply(`❌ No se encontró ningún ciudadano vinculado con: **${robloxInput}**`);
                }
            } else {
                targetDiscordId = citizen.discord_id;
                try {
                    targetUser = await interaction.client.users.fetch(targetDiscordId);
                } catch (error) {
                    targetUser = { id: targetDiscordId, tag: `${citizen.roblox_username} (ID: ${targetDiscordId})`, bot: false };
                }
            }
        } else {
            return interaction.editReply('❌ Debes especificar: **@usuario**, **discord_id**, o **roblox_usuario**.');
        }

        // --- GET OTHER OPTIONS ---
        const motivo = interaction.options.getString('motivo');
        const descripcion = interaction.options.getString('descripcion');
        const tipoBlacklist = interaction.options.getString('tipo_blacklist');
        const duracionInput = interaction.options.getString('duracion'); // String input

        // Handle Attachment
        const evidenciaAttachment = interaction.options.getAttachment('evidencia');
        let evidencia = evidenciaAttachment ? evidenciaAttachment.url : null;

        // **PERSISTENCE**: Upload to Supabase Storage if possible
        if (evidencia && interaction.client.supabase) {
            try {
                await interaction.editReply({ content: '🔄 Procesando evidencia y guardando en la nube...' });
                const publicUrl = await StorageService.uploadEvidence(
                    interaction.client.supabase,
                    evidencia,
                    evidenciaAttachment.name
                );

                if (publicUrl) {
                    evidencia = publicUrl;
                    console.log(`[Sancion] Evidence uploaded to Supabase: ${publicUrl}`);
                } else {
                    console.warn('[Sancion] Failed to upload evidence to Supabase. Using original Discord URL.');
                }
            } catch (storageErr) {
                console.error('[Sancion] Storage Service Error:', storageErr);
            }
        }


        const date = moment().tz('America/Mexico_City').format('DD/MM/YYYY');
        const time = moment().tz('America/Mexico_City').format('HH:mm');

        // --- DURATION PARSING ---
        let durationMs = 0;
        let durationText = '';

        if (duracionInput) {
            const unit = duracionInput.slice(-1).toLowerCase();
            const val = parseInt(duracionInput.slice(0, -1));

            if (!isNaN(val)) {
                // User Mapping: m=min, h=hour, d=day, s=semana(week), w=mes(month)
                if (unit === 'm') { durationMs = val * 60 * 1000; durationText = `${val} Minutos`; }
                else if (unit === 'h') { durationMs = val * 3600 * 1000; durationText = `${val} Horas`; }
                else if (unit === 'd') { durationMs = val * 24 * 3600 * 1000; durationText = `${val} Días`; }
                else if (unit === 's') { durationMs = val * 7 * 24 * 3600 * 1000; durationText = `${val} Semanas`; }
                else if (unit === 'w') { durationMs = val * 30 * 24 * 3600 * 1000; durationText = `${val} Meses`; }
                else {
                    // Fallback if just number = days
                    durationMs = val * 24 * 3600 * 1000; durationText = `${val} Días`;
                }
            }

            // --- RANK-BASED REDUCTION ---
            try {
                const guild = interaction.guild;
                const member = await guild.members.fetch(targetDiscordId).catch(() => null);
                if (member) {
                    const { amount: reductionPercentage, perks } = applyRoleBenefits(member, 0, 'sanction_reduction');
                    if (reductionPercentage > 0) {
                        const originalDuration = durationMs;
                        durationMs = Math.floor(durationMs * (1 - reductionPercentage));

                        // Update duration text to show original vs reduced
                        const originalText = durationText;
                        const reducedVal = Math.floor(val * (1 - reductionPercentage));

                        // Recalculate duration text for the embed
                        if (unit === 'm') durationText = `${reducedVal} Minutos (Reducido de ${originalText})`;
                        else if (unit === 'h') durationText = `${reducedVal} Horas (Reducido de ${originalText})`;
                        else if (unit === 'd') durationText = `${reducedVal} Días (Reducido de ${originalText})`;
                        else if (unit === 's') durationText = `${reducedVal} Semanas (Reducido de ${originalText})`;
                        else if (unit === 'w') durationText = `${reducedVal} Meses (Reducido de ${originalText})`;
                        else durationText = `${reducedVal} Días (Reducido de ${originalText})`;

                        console.log(`[Justice-System] Sanction reduced for ${targetDiscordId}: ${originalText} -> ${durationText} (${reductionPercentage * 100}% off)`);
                    }
                }
            } catch (reductionErr) {
                console.error('[Justice-System] Error calculating reduction:', reductionErr);
            }
        }

        let embedPayload = null;
        let actionResult = '';

        try {
            // Validation
            if ((type === 'general' || type === 'sa') && !targetUser) {
                return interaction.editReply({ content: '❌ Para Sanciones Generales y Administrativas, debes especificar un **usuario**.' });
            }

            if (accion === 'Blacklist' && !tipoBlacklist) {
                return interaction.editReply({ content: '❌ Si seleccionas Blacklist, debes especificar el **Tipo de Blacklist**.' });
            }

            // Calculate Expiration & Action Type
            let expirationDate = null;
            let finalActionType = accion || type;

            if (accion === 'Ban Temporal ERLC' && durationMs > 0) {
                expirationDate = moment().add(durationMs, 'ms').toISOString();
                finalActionType = `Ban Temporal (${durationText})`;
            } else if (accion === 'Timeout' && durationMs > 0) {
                expirationDate = moment().add(durationMs, 'ms').toISOString();
                finalActionType = `Timeout / Mute (${durationText})`;
            } else if (accion === 'Blacklist') {
                finalActionType = `Blacklist: ${tipoBlacklist}`;
            }

            // DB Record Preparation
            if (interaction.client.services && interaction.client.services.sanctions) {
                try {
                    const targetId = targetUser ? targetUser.id : 'UNKNOWN';
                    await interaction.client.services.sanctions.createSanction(
                        targetId,
                        interaction.user.id,
                        type,
                        motivo,
                        evidencia,
                        expirationDate,
                        finalActionType,
                        descripcion // Passed as description
                    );
                } catch (dbError) { console.error('DB Error:', dbError); }
            }

            // --- PERMISSIONS CHECKS (RBAC SYSTEM v2) ---
            const ROLES_CONFIG = {
                // Junta Directiva & Encargados (FULL ACCESS - Bypass Approval)
                LEVEL_4_BOARD: [
                    '1412882245735420006', // Junta Directiva
                    '1456020936229912781', // Encargado de Sanciones
                    '1451703422800625777', // Encargado de Apelaciones
                    '1454985316292100226'  // Encargado de Staff
                ],
                // Admins (FULL ACCESS - BUT REQUIRES APPROVAL for Critical)
                LEVEL_3_ADMIN: ['1412882248411381872'],
                // Staff (Kick/TempBan)
                LEVEL_2_STAFF: ['1412887079612059660'],
                // Training (Warns Only)
                LEVEL_1_TRAINING: ['1412887167654690908']
            };

            const memberRoles = interaction.member.roles.cache;

            // Helper to check levels
            const hasRole = (roleIds) => roleIds.some(id => memberRoles.has(id));
            const isBoard = hasRole(ROLES_CONFIG.LEVEL_4_BOARD);
            const isAdmin = hasRole(ROLES_CONFIG.LEVEL_3_ADMIN) || isBoard;
            const isStaff = hasRole(ROLES_CONFIG.LEVEL_2_STAFF) || isAdmin;
            const isTraining = hasRole(ROLES_CONFIG.LEVEL_1_TRAINING) || isStaff;

            // 1. Critical Actions Check (Blacklist, SA, Ban Perm) -> Requires Admin/Board
            const isCriticalAction = (type === 'sa') ||
                (accion === 'Blacklist') ||
                (accion === 'Ban Permanente ERLC');

            if (isCriticalAction && !isAdmin) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado (Nivel 3 Requerido)**\nSolo la **Administración y Junta Directiva** pueden aplicar Blacklists, SAs o Baneos Permanentes.'
                });
            }

            // 2. High Actions Check (Kick, Ban Temp) -> Requires Staff
            const isHighAction = (accion === 'Kick ERLC') || (accion === 'Ban Temporal ERLC');

            if (isHighAction && !isStaff) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado (Nivel 2 Requerido)**\nComo Staff en Entrenamiento, no puedes aplicar Kicks ni Baneos Temporales. Solicita ayuda a un Staff superior.'
                });
            }

            // 3. Basic Actions Check (Warns, Notif) -> Requires Training
            if (!isTraining) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado**\nNo tienes el rol de Staff necesario para usar este comando.'
                });
            }

            // --- TWO-MAN RULE: APPROVAL WORKFLOW ---
            // If it's a Critical Action AND user is Admin (but NOT Board/Encargado)
            if (isCriticalAction && isAdmin && !isBoard) {
                const APPROVAL_CHANNEL_ID = '1456047784724529316';
                const approvalChannel = interaction.client.channels.cache.get(APPROVAL_CHANNEL_ID);

                if (!approvalChannel) {
                    return interaction.editReply({ content: '⚠️ Error de Configuración: No se encuentra el canal de aprobaciones.' });
                }

                // Create Approval Request Embed
                const file = new AttachmentBuilder(path.join(__dirname, '../../assets/img/status/pendiente.png'), { name: 'pendiente.png' });

                const approvalEmbed = new EmbedBuilder()
                    // .setTitle('👮 Solicitud de Aprobación de Sanción') // Image has text
                    .setDescription(`Un Administrador ha solicitado una sanción crítica. Requiere aprobación de Junta/Encargados.`)
                    .addFields(
                        { name: '🛡️ Solicitante', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                        { name: '👤 Usuario Objetivo', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
                        { name: '⚖️ Tipo de Sanción', value: accion === 'Blacklist' ? `BLACKLIST (${tipoBlacklist})` : (accion || type), inline: false },
                        { name: '📝 Motivo', value: motivo, inline: false },
                        { name: '📸 Evidencia', value: evidencia || 'No adjunta', inline: false }
                    )
                    .setColor(0xFFA500) // Orange for Pending
                    .setImage('attachment://pendiente.png')
                    .setTimestamp();

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_sancion_${targetUser.id}`)
                        .setLabel('✅ Aprobar Sanción')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('reject_sancion')
                        .setLabel('❌ Rechazar')
                        .setStyle(ButtonStyle.Danger)
                );

                // Send to Approval Channel
                const sentMsg = await approvalChannel.send({
                    content: `<@&${ROLES_CONFIG.LEVEL_4_BOARD[0]}> <@&${ROLES_CONFIG.LEVEL_4_BOARD[1]}>`, // Ping Junta/Encargado
                    embeds: [approvalEmbed],
                    components: [buttons],
                    files: [file]
                });

                // Store metadata in cache (or relying on button handler to parse, but cache is safer for complex data)
                // For simplicity/reliability against restarts, we will encode ESSENTIALS in the handler 
                // BUT we need the full reason/evidence.
                // We'll attach the data to the message client-side properties if possible, or use a temporary Map if restarts are rare.
                // Best approach for now: The BUTTON HANDLER will read the EMBED fields to execute.

                return interaction.editReply({
                    content: `⏳ **Sanción Pausada por Seguridad (Two-Man Rule)**\n\nTu solicitud de **${accion}** ha sido enviada al canal de aprobaciones.\nDebe ser validada por un Encargado o Junta Directiva antes de aplicarse.`
                });
            }

            // --- ENFORCEMENT & BLACKLIST ROLE LOGIC (EXECUTED IF NO APPROVAL NEEDED OR APPROVED) ---

            // 0. Resolve Roblox Identifier (Lifted from legacy logic)
            let robloxIdentifier = null;
            if (accion && (accion.includes('ERLC') || accion === 'Blacklist')) {
                if (robloxInput) {
                    if (robloxInput.match(/^\d+$/)) {
                        robloxIdentifier = robloxInput;
                    } else {
                        // Minimal resolution attempt or pass raw username
                        robloxIdentifier = robloxInput.trim();
                    }
                } else if (targetUser) {
                    // Try from DB
                    const { data: citizen } = await interaction.client.supabase
                        .from('citizens')
                        .select('roblox_id, roblox_username')
                        .eq('discord_id', targetUser.id)
                        .maybeSingle();

                    if (citizen && (citizen.roblox_username || citizen.roblox_id)) {
                        robloxIdentifier = citizen.roblox_username || citizen.roblox_id;
                    }
                }
            }

            // 1. Execute via SanctionService
            if (interaction.client.services && interaction.client.services.sanctions) {
                try {
                    const result = await interaction.client.services.sanctions.executePunishment(
                        interaction,
                        targetUser,
                        type,
                        finalActionType, // Use calculated type (e.g. 'Blacklist: Moderacion')
                        motivo,
                        descripcion,
                        evidencia,
                        durationText,
                        durationMs,
                        robloxIdentifier
                    );

                    actionResult = result.messages.join('\n');
                    if (result.errors.length > 0) {
                        actionResult += '\n⚠️ **Observaciones:**\n' + result.errors.join('\n');
                    }
                } catch (svcError) {
                    console.error('[Sancion Cmd] Service Error:', svcError);
                    actionResult = `\n❌ Error ejecutando sanción: ${svcError.message}`;
                }
            } else {
                actionResult = '\n❌ Error: El Servicio de Sanciones no está inicializado.';
            }


            // Build Template
            if (type === 'general') {
                const sanctionTitle = (accion === 'Blacklist') ? `BLACKLIST: ${tipoBlacklist}` : accion;

                embedPayload = NotificationTemplates.officialSanction({
                    date, time, offender: targetUser, moderator: interaction.user,
                    ruleCode: motivo, description: descripcion, sanctionType: sanctionTitle,
                    duration: durationText, evidenceUrl: evidencia
                });

            } else if (type === 'sa') {
                embedPayload = NotificationTemplates.administrativeSanction({
                    date, offender: targetUser, reasonDetail: motivo
                });

            } else if (type === 'notificacion') {
                // Personal Notification (Targeted) - User is mandatory
                embedPayload = NotificationTemplates.personalNotification({
                    date, subject: motivo, body: descripcion, user: targetUser
                });
            }

            // CRITICAL FIX: BLACKLIST NOTIFICATION (Independent of Type)
            // Blacklist Notification (Independent of Type)
            if (accion === 'Blacklist') {
                const blChannelId = '1412957060168945747';
                try {
                    const blChannel = await interaction.client.channels.fetch(blChannelId);
                    if (blChannel) {
                        // Ensure we have an embed payload for the public log
                        let publicEmbed = embedPayload?.embeds?.[0];

                        // If type wasn't general, generate a fallback embed
                        if (type !== 'general' || !publicEmbed) {
                            const fallbackPayload = NotificationTemplates.officialSanction({
                                date, time, offender: targetUser, moderator: interaction.user,
                                ruleCode: motivo, description: descripcion, sanctionType: `BLACKLIST: ${tipoBlacklist}`,
                                duration: 'Permanente', evidenceUrl: evidencia
                            });
                            publicEmbed = fallbackPayload.embeds[0];
                        }

                        await blChannel.send({
                            content: (tipoBlacklist === 'Blacklist Total') ? '@everyone' : null,
                            embeds: [publicEmbed]
                        });
                        actionResult += `\n📢 **Notificación enviada al canal de Blacklists.**`;
                    } else {
                        actionResult += `\n⚠️ No se encontró el canal de Blacklists (${blChannelId}).`;
                    }
                } catch (blError) {
                    console.error('Error sending blacklist notification:', blError);
                    actionResult += `\n⚠️ Error al notificar Blacklist: ${blError.message}`;
                }
            }
            // Send to Context Channel (The one where command was used)
            const mentionEveryone = (type === 'notificacion' && !targetUser);
            await interaction.editReply({
                content: (mentionEveryone ? '@everyone ' : '') + (actionResult || ''),
                ...embedPayload
            });

            // AUDIT LOG
            if (interaction.client.logAudit) {
                await interaction.client.logAudit(
                    'Sanción Ejecutada',
                    `**Tipo:** ${type}\n**Acción:** ${accion || 'N/A'}\n**Motivo:** ${motivo}\n**Duración:** ${durationText || 'N/A'}\n**Evidencia:** ${evidencia || 'Sin evidencia'}`,
                    interaction.user,
                    targetUser,
                    type === 'sa' ? 0x8b0000 : 0xFFD700
                );
            }

            // DM User with Appeal Buttons
            if (targetUser && (type === 'general' || type === 'sa' || type === 'notificacion')) {
                try {
                    let appealButtons;

                    if (type === 'sa') {
                        // SA special appeal button - internal with confirmation
                        appealButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`appeal_sa_confirm_${targetUser.id}`)
                                .setLabel('📩 Apelar SA')
                                .setStyle(ButtonStyle.Danger)
                        );
                    } else {
                        // General sanctions - external appeal links
                        appealButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('📩 Apelar (Baneo/Perm)')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://melon.ly/form/7412242701552193536'),
                            new ButtonBuilder()
                                .setLabel('📝 Apelar (Otras Sanciones)')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://discord.com/channels/1398525215134318713/1398889153919189042')
                        );
                    }

                    await targetUser.send({
                        content: `Has recibido una sanción en **${interaction.guild.name}**.\\n${actionResult}`,
                        embeds: embedPayload.embeds,
                        components: [appealButtons]
                    });
                } catch (dmError) {
                    if (dmError.code === 50007) {
                        console.warn(`[Sancion] Cannot DM user ${targetUser.tag} (DMs closed/blocked).`);
                        actionResult += '\n⚠️ No se pudo enviar MD (Privacidad/Bloqueo).';
                    } else {
                        console.error('[Sancion] Failed to send DM to user:', dmError);
                        actionResult += '\n⚠️ Error al enviar MD.';
                    }
                }
            }

            // SA AUTO-ROLE LOGIC handled by SanctionService
            // NO DUPLICATE LOGIC HERE

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Hubo un error al procesar la sanción.' });
        }
    }
};

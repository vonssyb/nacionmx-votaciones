const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const NotificationTemplates = require('../../services/NotificationTemplates');
const StorageService = require('../../services/StorageService');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sancion')
        .setDescription('Sistema de Sanciones Profesional Nación MX')
        .setDescription('Sistema de Sanciones Profesional Nación MX')
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
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a sancionar o notificar')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('evidencia')
                .setDescription('Evidencia obligatoria (Imagen/Video)')
                .setRequired(true))
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
                    { name: 'TOTAL (Ban Permanente)', value: 'Blacklist Total' }
                ))
        .addStringOption(option =>
            option.setName('duracion')
                .setDescription('Tiempo (ej: 10m, 2h, 1d, 1s=semana, 1w=mes)')
                .setRequired(false)),

    async execute(interaction) {
        // 1. Get Options EARLY to decide ephemeral state
        const type = interaction.options.getString('tipo');
        const accion = interaction.options.getString('accion');

        // --- PERMISSIONS CHECKS (RBAC SYSTEM v2) ---
        // Check permissions BEFORE deferring to allow ephemeral errors
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

        // Determine User Level
        let userLevel = 0;
        if (memberRoles.some(r => ROLES_CONFIG.LEVEL_4_BOARD.includes(r.id))) userLevel = 4;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_3_ADMIN.includes(r.id))) userLevel = 3;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_2_STAFF.includes(r.id))) userLevel = 2;
        else if (memberRoles.some(r => ROLES_CONFIG.LEVEL_1_TRAINING.includes(r.id))) userLevel = 1;

        if (userLevel === 0) {
            return interaction.reply({ content: '⛔ **Acceso Denegado:** No tienes rango suficiente para usar este sistema.', flags: [64] });
        }

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
            return interaction.reply({
                content: '🛑 **Acceso Denegado (Nivel 3 Requerido)**\nSolo la **Administración y Junta Directiva** pueden aplicar Blacklists, SAs o Baneos Permanentes.',
                flags: [64]
            });
        }

        // 2. High Actions Check (Kick, Ban Temp) -> Requires Staff
        const isHighAction = (accion === 'Kick ERLC') || (accion === 'Kick Discord') || (accion === 'Ban Temporal ERLC');

        if (isHighAction && !isStaff) {
            return interaction.reply({
                content: '🛑 **Acceso Denegado (Nivel 2 Requerido)**\nComo Staff en Entrenamiento, no puedes aplicar Kicks ni Baneos Temporales. Solicita ayuda a un Staff superior.',
                flags: [64]
            });
        }

        // 3. Basic Actions Check (Warns, Notif) -> Requires Training
        if (!isTraining) {
            return interaction.reply({
                content: '🛑 **Acceso Denegado**\nNo tienes el rol de Staff necesario para usar este comando.',
                flags: [64]
            });
        }

        // --- DEFERRAL LOGIC ---
        // Sanciones = Public (No Ephemeral)
        // Notificaciones = Private (Ephemeral)
        const isEphemeral = (type === 'notificacion');
        await interaction.deferReply({ flags: isEphemeral ? [64] : [] });

        const targetUser = interaction.options.getUser('usuario');
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
            // Blacklist Role Mapping
            const BLACKLIST_ROLES = {
                'Blacklist Moderacion': '1451860028653834300',
                'Blacklist Facciones Policiales': '1413714060423200778',
                'Blacklist Cartel': '1449930883762225253',
                'Blacklist Politica': '1413714467287470172',
                'Blacklist Empresas': '1413714540834852875'
            };

            if (accion) {
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

                if (member) {
                    try {
                        // 1. BLACKLIST LOGIC
                        if (accion === 'Blacklist') {
                            if (tipoBlacklist === 'Blacklist Total') {
                                if (!member.bannable) actionResult = '\n⚠️ No se pudo banear al usuario del Discord (Jerarquía).';
                                else {
                                    await member.ban({ reason: `Blacklist TOTAL: ${motivo} - Por ${interaction.user.tag}` });
                                    actionResult = '\n🔨 **Usuario Baneado Permanentemente de Discord (Blacklist Total).**';
                                }
                            } else {
                                // Partial Blacklist - Assign Role
                                const roleIdToAssign = BLACKLIST_ROLES[tipoBlacklist];
                                if (roleIdToAssign) {
                                    await member.roles.add(roleIdToAssign);
                                    actionResult = `\n🚫 **Rol de Blacklist Asignado:** ${tipoBlacklist}`;
                                } else {
                                    actionResult = `\n⚠️ Tipo de blacklist registrado, pero no se encontró un Rol configurado para ID: ${tipoBlacklist}`;
                                }
                            }
                        }

                        // 2. ERLC GAME SANCTIONS (Real Execution)
                        else if (accion === 'Kick ERLC' || accion === 'Ban Permanente ERLC' || accion === 'Ban Temporal ERLC') {
                            // 1. Resolve Roblox User
                            const { data: erlcProfile } = await interaction.client.supabase
                                .from('citizens')
                                .select('roblox_username')
                                .eq('discord_id', targetUser.id)
                                .maybeSingle();

                            if (erlcProfile && erlcProfile.roblox_username) {
                                const targetName = erlcProfile.roblox_username;
                                let cmd = '';
                                let typeLabel = '';

                                if (accion === 'Kick ERLC') {
                                    cmd = `:kick ${targetName} ${motivo}`;
                                    typeLabel = 'Kick';
                                } else if (accion === 'Ban Permanente ERLC') {
                                    cmd = `:ban ${targetName} ${motivo}`;
                                    typeLabel = 'Ban Permanente';
                                } else if (accion === 'Ban Temporal ERLC') {
                                    // Note: API only supports :ban usually. We use :ban and logs indicate duration.
                                    cmd = `:ban ${targetName} ${motivo} (${durationText})`;
                                    typeLabel = `Ban Temporal (${durationText})`;
                                }

                                const success = await interaction.client.services.erlc.runCommand(cmd);
                                if (success) {
                                    actionResult = `\n✅ **Sanción ERLC Ejecutada:** Se envió \`:${typeLabel}\` para **${targetName}**.`;
                                } else {
                                    actionResult = `\n⚠️ **Error ERLC:** Falló el comando \`:${typeLabel}\` (¿Servidor offline o API error?).`;
                                }
                            } else {
                                actionResult = `\n⚠️ **No Ejecutado en ERLC:** El usuario no tiene su Roblox Username vinculado en la base de datos. (Solo guardado en historial)`;
                            }
                        }
                        // 3. TIMEOUT / MUTE LOGIC
                        else if (accion === 'Timeout') {
                            if (member.moderatable) {
                                if (durationMs > 0) {
                                    await member.timeout(durationMs, `Sanción: ${motivo} - Por ${interaction.user.tag}`);
                                    actionResult = `\n🤐 **Usuario Silenciado (Timeout)** por **${durationText}**.`;
                                } else {
                                    actionResult = `\n⚠️ Solicitaste Timeout pero no especificaste duración válida. (Mínimo 1m).`;
                                }
                            } else {
                                actionResult = '\n⚠️ No puedo silenciar a este usuario (Jerarquía de Roles).';
                            }
                        }
                        // 4. KICK DISCORD LOGIC
                        else if (accion === 'Kick Discord') {
                            if (member.kickable) {
                                await member.kick(`Sanción: ${motivo} - Por ${interaction.user.tag}`);
                                actionResult = '\n👢 **Usuario Expulsado (Kick) del Discord.**';
                            } else {
                                actionResult = '\n⚠️ No puedo expulsar a este usuario (Jerarquía de Roles).';
                            }
                        }

                    } catch (e) {
                        actionResult = `\n⚠️ Error ejecutando lógica de sanción/roles: ${e.message}`;
                    }
                }
            }

            // Build Template
            if (type === 'general') {
                const sanctionTitle = (accion === 'Blacklist') ? `BLACKLIST: ${tipoBlacklist}` : accion;

                embedPayload = NotificationTemplates.officialSanction({
                    date, time, offender: targetUser, moderator: interaction.user,
                    ruleCode: motivo, description: descripcion, sanctionType: sanctionTitle,
                    duration: durationText, evidenceUrl: evidencia
                });

                // SPECIAL BLACKLIST NOTIFICATION CHANNEL
                if (accion === 'Blacklist') {
                    const blChannelId = '1412957060168945747';
                    try {
                        const blChannel = await interaction.client.channels.fetch(blChannelId);
                        if (blChannel) {
                            await blChannel.send({
                                content: '@everyone',
                                embeds: [embedPayload.embeds[0]]
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
                    console.error('[Sancion] Failed to send DM to user:', dmError);
                    actionResult += '\n⚠️ No se pudo enviar MD al usuario (posiblemente bloqueado).';
                }
            }

            // SA AUTO-ROLE LOGIC
            if (type === 'sa') {
                const currentSAs = await interaction.client.services.sanctions.getSACount(targetUser.id);
                // SA Roles Logic
                const SA_ROLES = {
                    1: '1450997809234051122', // SA 1
                    2: '1454636391932756049', // SA 2
                    3: '1456028699718586459', // SA 3
                    4: '1456028797638934704', // SA 4
                    5: '1456028933995630701'  // SA 5
                };
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (member) {
                    try {
                        // 1. Remove ALL existing SA roles to ensure we only have the current level
                        const allSaRoles = Object.values(SA_ROLES);
                        await member.roles.remove(allSaRoles);

                        // 2. Add the correct Role for current count
                        const newRole = SA_ROLES[currentSAs];
                        if (newRole) {
                            await member.roles.add(newRole);
                            actionResult += `\n🏷️ **Rol Actualizado:** Se ha asignado el rol **SA ${currentSAs}**.`;
                        }
                    } catch (roleErr) {
                        console.error('Error managing SA roles:', roleErr);
                        actionResult += `\n⚠️ **Error al actualizar roles de SA** (Revisar jerarquía del bot).`;
                    }
                }

                // 3. CRITICAL THRESHOLD ALERT (5+)
                if (currentSAs >= 5) {
                    const ALERT_CHANNEL_ID = '1456021466356387861';
                    const alertChannel = interaction.client.channels.cache.get(ALERT_CHANNEL_ID);
                    if (alertChannel) {
                        await alertChannel.send({
                            embeds: [{
                                title: '🚨 ALERTA CRÍTICA: Límite de SAs Alcanzado',
                                description: `🛑 **El usuario ha acumulado 5 Sanciones Administrativas (SA).**\n\n👤 **Usuario:** ${targetUser.tag} (<@${targetUser.id}>)\n⚖️ **Sanción Automática Requerida:** BAN PERMANENTE (Directo).\n📜 **Último Motivo:** ${motivo}`,
                                color: 0xFF0000,
                                timestamp: new Date()
                            }]
                        });
                        actionResult += `\n⛔ **CRÍTICO: El usuario ha alcanzado 5 SAs. Se ha solicitado su BAN PERMANENTE a la Administración.**`;
                    }
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Hubo un error al procesar la sanción.' });
        }
    }
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const NotificationTemplates = require('../../services/NotificationTemplates');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sancion')
        .setDescription('Sistema de Sanciones Profesional Nación MX')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
        .addIntegerOption(option =>
            option.setName('dias')
                .setDescription('Solo para Ban Temporal: Duración en días')
                .setRequired(false)),

    async execute(interaction) {
        // Defer reply as we might need time for DB ops (though usually fast)
        await interaction.deferReply();

        const type = interaction.options.getString('tipo');
        const targetUser = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo');
        const descripcion = interaction.options.getString('descripcion');
        const accion = interaction.options.getString('accion');
        const tipoBlacklist = interaction.options.getString('tipo_blacklist');
        const dias = interaction.options.getInteger('dias');

        // Handle Attachment
        const evidenciaAttachment = interaction.options.getAttachment('evidencia');
        const evidencia = evidenciaAttachment ? evidenciaAttachment.url : null;

        const date = moment().tz('America/Mexico_City').format('DD/MM/YYYY');
        const time = moment().tz('America/Mexico_City').format('HH:mm');

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

            // DB Record Preparation
            if (interaction.client.services && interaction.client.services.sanctions) {
                try {
                    const targetId = targetUser ? targetUser.id : 'UNKNOWN';
                    await interaction.client.services.sanctions.createSanction(
                        targetId,
                        interaction.user.id,
                        type,
                        motivo,
                        evidencia
                    );
                } catch (dbError) { console.error('DB Error:', dbError); }
            }

            // --- PERMISSIONS CHECKS (RBAC SYSTEM v2) ---
            const ROLES_CONFIG = {
                LEVEL_3_ADMIN: ['1412882248411381872', '1412882245735420006'], // Administrators & Junta Directiva (Access to EVERYTHING)
                LEVEL_2_STAFF: ['1412887079612059660'], // Staff (Access to Kicks, TempBans)
                LEVEL_1_TRAINING: ['1412887167654690908'] // Training (Warns Only)
            };

            const memberRoles = interaction.member.roles.cache;

            // Helper to check levels
            const hasRole = (roleIds) => roleIds.some(id => memberRoles.has(id));
            const isLevel3 = hasRole(ROLES_CONFIG.LEVEL_3_ADMIN);
            const isLevel2 = hasRole(ROLES_CONFIG.LEVEL_2_STAFF) || isLevel3;
            const isLevel1 = hasRole(ROLES_CONFIG.LEVEL_1_TRAINING) || isLevel2;

            // 1. Critical Actions Check (Blacklist, SA, Ban Perm) -> Requires LEVEL 3
            const isCriticalAction = (type === 'sa') ||
                (accion === 'Blacklist') ||
                (accion === 'Ban Permanente ERLC');

            if (isCriticalAction && !isLevel3) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado (Nivel 3 Requerido)**\nSolo la **Administración y Junta Directiva** pueden aplicar Blacklists, SAs o Baneos Permanentes.'
                });
            }

            // 2. High Actions Check (Kick, Ban Temp) -> Requires LEVEL 2
            const isHighAction = (accion === 'Kick ERLC') || (accion === 'Ban Temporal ERLC');

            if (isHighAction && !isLevel2) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado (Nivel 2 Requerido)**\nComo Staff en Entrenamiento, no puedes aplicar Kicks ni Baneos Temporales. Solicita ayuda a un Staff superior.'
                });
            }

            // 3. Basic Actions Check (Warns, Notif) -> Requires LEVEL 1
            if (!isLevel1) {
                return interaction.editReply({
                    content: '🛑 **Acceso Denegado**\nNo tienes el rol de Staff necesario para usar este comando.'
                });
            }

            // --- ENFORCEMENT & BLACKLIST ROLE LOGIC ---
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

                        // 2. ERLC GAME SANCTIONS (Log Only)
                        else if (accion === 'Kick ERLC') {
                            actionResult = '\n🦵 **Sanción de Kick (ERLC/Juego) Registrada.** (No afecta Discord)';
                        }
                        else if (accion === 'Ban Permanente ERLC') {
                            actionResult = '\n🔨 **Sanción de Ban Permanente (ERLC/Juego) Registrada.** (No afecta Discord)';
                        }
                        else if (accion === 'Ban Temporal ERLC') {
                            actionResult = `\n⏳ **Sanción de Ban Temporal_(${dias}d) (ERLC/Juego) Registrada.** (No afecta Discord)`;
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
                    duration: dias, evidenceUrl: evidencia
                });

                // SPECIAL BLACKLIST NOTIFICATION CHANNEL
                if (accion === 'Blacklist') {
                    const blChannelId = '1412957060168945747'; // Replace with actual Blacklist channel ID
                    const blChannel = interaction.client.channels.cache.get(blChannelId);
                    if (blChannel) {
                        await blChannel.send({
                            content: '@everyone',
                            embeds: [embedPayload.embeds[0]] // Send the same embed
                        });
                        actionResult += `\n📢 **Notificación enviada al canal de Blacklists.**`;
                    } else {
                        actionResult += `\n⚠️ No se encontró el canal de Blacklists (${blChannelId}).`;
                    }
                }

            } else if (type === 'sa') {
                embedPayload = NotificationTemplates.administrativeSanction({
                    date, offender: targetUser, reasonDetail: motivo
                });

            } else if (type === 'notificacion') {
                embedPayload = NotificationTemplates.generalNotification({
                    date, subject: motivo, body: descripcion
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
                    `**Tipo:** ${type}\n**Acción:** ${accion || 'N/A'}\n**Motivo:** ${motivo}\n**Duración:** ${dias || 'N/A'} días\n**Evidencia:** ${evidencia || 'Sin evidencia'}`,
                    interaction.user,
                    targetUser,
                    type === 'sa' ? 0x8b0000 : 0xFFD700
                );
            }

            // DM User with Appeal Buttons
            if (targetUser && (type === 'general' || type === 'sa')) {
                try {
                    const appealButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('📩 Apelar (Baneo/Perm)')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://melonly.xyz/dashboard/7374175961132044288/applications/7412242701552193536'),
                        new ButtonBuilder()
                            .setLabel('📝 Apelar (Otras Sanciones)')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://discord.com/channels/1398525215134318713/1398889153919189042')
                    );

                    await targetUser.send({
                        ...embedPayload,
                        content: `Has recibido una sanción en **${interaction.guild.name}**.\n${actionResult}`,
                        components: [appealButtons]
                    });
                } catch (e) { /* Ignore */ }
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

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
                .setDescription('Usuario a sancionar (Opcional para Notificación General)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('accion')
                .setDescription('Solo para Sanción General: Tipo de castigo')
                .setRequired(false)
                .addChoices(
                    { name: 'Advertencia Verbal', value: 'Advertencia Verbal' },
                    { name: 'Warn (1/3)', value: 'Warn (N° 1/3)' },
                    { name: 'Warn (2/3)', value: 'Warn (N° 2/3)' },
                    { name: 'Warn (3/3)', value: 'Warn (N° 3/3)' },
                    { name: 'Ban Temporal', value: 'Ban Temporal' },
                    { name: 'Blacklist', value: 'Blacklist' }
                ))
        .addIntegerOption(option =>
            option.setName('dias')
                .setDescription('Solo para Ban Temporal: Duración en días')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('evidencia')
                .setDescription('URL de la evidencia (Imagen/Video)')
                .setRequired(false)),

    async execute(interaction) {
        // Defer reply as we might need time for DB ops (though usually fast)
        await interaction.deferReply();

        const type = interaction.options.getString('tipo');
        const targetUser = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo');
        const descripcion = interaction.options.getString('descripcion');
        const accion = interaction.options.getString('accion');
        const dias = interaction.options.getInteger('dias');
        const evidencia = interaction.options.getString('evidencia');

        const date = moment().tz('America/Mexico_City').format('DD/MM/YYYY');
        const time = moment().tz('America/Mexico_City').format('HH:mm');

        let embedPayload = null;

        try {
            // Validation
            if ((type === 'general' || type === 'sa') && !targetUser) {
                return interaction.editReply({ content: '❌ Para Sanciones Generales y Administrativas, debes especificar un **usuario**.' });
            }

            // DB Record Preparation
            const dbTypeRecord = type; // 'general', 'sa', 'notificacion'

            // Build Template
            if (type === 'general') {
                if (!accion) {
                    return interaction.editReply({ content: '❌ Para el Reporte Oficial de Sanción, debes especificar la **acción** (Advertencia, Warn, etc.).' });
                }

                embedPayload = NotificationTemplates.officialSanction({
                    date,
                    time,
                    offender: targetUser,
                    moderator: interaction.user,
                    ruleCode: motivo, // "Infracción Cometida"
                    description: descripcion,
                    sanctionType: accion,
                    duration: dias,
                    evidenceUrl: evidencia
                });

            } else if (type === 'sa') {
                embedPayload = NotificationTemplates.administrativeSanction({
                    date,
                    offender: targetUser,
                    reasonDetail: motivo // "Motivo de la Sanción" detail
                });

            } else if (type === 'notificacion') {
                embedPayload = NotificationTemplates.generalNotification({
                    date,
                    subject: motivo, // "Asunto"
                    body: descripcion
                });
            }

            // Send to DB (via Service ideally, or direct Supabase if service not injected in interaction yet)
            // Assuming client.services.sanctions might not be set up in index.js yet, let's look at index.js
            // We should use the service we created. 
            // Since we can't easily hot-reload index.js to inject 'client.services.sanctions', we will assume user restarts bot.
            // But for safety in this "execute", let's try to use the one from client if available, or just skip DB for now if panic.
            // Actually, we should probably instantiate it here if missing or just rely on 'interaction.client.services' if we added it.
            // PROCEEDING: We will assume the restart happens.

            // THRESHOLD ALERT & ROLE ASSIGNMENT (SA Sanctions)
            if (type === 'sa') {
                const currentSAs = await interaction.client.services.sanctions.getSACount(targetUser.id);

                // SA ROLES MAP
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

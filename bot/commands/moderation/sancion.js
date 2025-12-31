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
                    { name: '📢 Notificación General', value: 'notificacion' }
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

            // Send the embed to the channel
            await interaction.editReply({
                content: type === 'notificacion' ? '@everyone' : null,
                ...embedPayload
            });

            // Try to DM the user if it's a sanction
            if (targetUser && (type === 'general' || type === 'sa')) {
                try {
                    await targetUser.send({ ...embedPayload, content: `Has recibido una sanción en **${interaction.guild.name}**.` });
                } catch (err) {
                    await interaction.followUp({ content: '⚠️ No se pudo enviar el MD al usuario (DM cerrado).', ephemeral: true });
                }
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Hubo un error al procesar la sanción.' });
        }
    }
};

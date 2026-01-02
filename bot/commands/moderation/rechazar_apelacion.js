const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rechazar_apelacion')
        .setDescription('Rechazar una apelación y notificar al usuario (Solo Encargados)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('id_sancion')
                .setDescription('ID de la sanción apelada')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('Razón del rechazo (Explicación para el usuario)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // SECURITY CHECK: Specific Role/User ID Check
        const authorizedIds = [
            '1451703422800625777', // Encargado de Apelaciones
            '1456020936229912781', // The Boss / Administración Superior
            '1454985316292100226'  // Encargado de Staff
        ];

        const isAuthorized = authorizedIds.includes(interaction.user.id) ||
            interaction.member.roles.cache.has('1451703422800625777') ||
            interaction.member.roles.cache.has('1456020936229912781') ||
            interaction.member.roles.cache.has('1454985316292100226');

        if (!isAuthorized && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('🛑 No tienes permiso para gestionar apelaciones.');
        }

        const idSancion = interaction.options.getString('id_sancion');
        const reason = interaction.options.getString('razon');

        try {
            // 1. Verify Sanction Exists
            const sanction = await interaction.client.services.sanctions.getSanctionById(idSancion);
            if (!sanction) {
                return interaction.editReply(`❌ No se encontró ninguna sanción con ID: \`${idSancion}\``);
            }

            // 2. Prepare Notification Embed
            const rejectEmbed = new EmbedBuilder()
                .setTitle('⚖️ Resultado de Apelación: RECHAZADA')
                .setColor('#8B0000') // Dark Red
                .setDescription(`Tu apelación sobre la sanción (ID: \`${idSancion}\`) ha sido revisada por el Departamento de Apelaciones.`)
                .addFields(
                    { name: '📋 Resolución', value: 'La sanción se mantiene **ACTIVA** y **VÁLIDA**.', inline: false },
                    { name: '📝 Motivo del Rechazo / Comentarios', value: reason, inline: false }
                )
                .setFooter({ text: 'Decisión Final e Inapelable | Nación MX', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // 3. Notify User
            let dmStatus = '❌ No se pudo notificar al usuario (MD cerrado).';
            try {
                const user = await interaction.client.users.fetch(sanction.discord_user_id);
                if (user) {
                    await user.send({ embeds: [rejectEmbed] });
                    dmStatus = '✅ Usuario notificado por MD.';
                }
            } catch (e) {
                console.error('Failed to DM rejection:', e);
            }

            // 4. Log Audit
            if (interaction.client.logAudit) {
                await interaction.client.logAudit(
                    'Apelación Rechazada',
                    `**Sanción ID:** ${idSancion}\n**Admin:** ${interaction.user.tag}\n**Razón Rechazo:** ${reason}`,
                    interaction.user,
                    { id: sanction.discord_user_id, tag: 'Usuario Sancionado' },
                    0x8B0000
                );
            }

            // 5. Reply to Admin
            await interaction.editReply({
                content: `🔒 **Apelación Rechazada Correctamente.**\nLa sanción \`${idSancion}\` permanece activa.\n${dmStatus}`
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Ocurrió un error al procesar el rechazo.');
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quitar-rol')
        .setDescription('➖ Quitar un rol de un usuario (Solo Staff)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que quitar rol').setRequired(true))
        .addRoleOption(option => option.setName('rol').setDescription('Rol a quitar').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Razón del cambio').setRequired(false)),

    async execute(interaction) {
        // Deferral handled globally by index_moderacion.js
        // await interaction.deferReply();

        // Staff role check
        const ALLOWED_ROLES = [
            '1412882248411381872', // Administración
            '1412887079612059660', // Staff
            '1412887167654690908'  // Training
        ];

        const isStaff = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return interaction.editReply('❌ Solo el staff puede gestionar roles.');
        }

        const targetUser = interaction.options.getUser('usuario');
        const role = interaction.options.getRole('rol');
        const razon = interaction.options.getString('razon') || 'No especificada';

        // SELF-ACTION DETECTION
        if (targetUser.id === interaction.user.id) {
            const SelfActionService = require('../../services/SelfActionService');
            const selfActionService = new SelfActionService(interaction.client, interaction.client.supabase);

            if (!selfActionService.canApproveSelfAction(interaction.member)) {
                const requestId = `${Date.now()}_${interaction.user.id}`;
                await selfActionService.requestSuperiorApproval({
                    actionType: 'role_remove',
                    executor: interaction.user,
                    target: targetUser,
                    guildId: interaction.guildId,
                    details: `Intento de auto-remoción del rol **${role.name}**\nRazón: ${razon}`,
                    approveButtonId: `sa_approve_removerole_${requestId}_${role.id}`,
                    rejectButtonId: `sa_reject_removerole_${requestId}`,
                    metadata: {
                        role: `<@&${role.id}> (${role.name})`,
                        roleId: role.id,
                        reason: razon
                    }
                });

                return interaction.editReply('⚠️ **Auto-Remoción de Rol Detectada**\n\nNo puedes quitarte roles a ti mismo sin aprobación.\nSe ha enviado una solicitud a un superior para revisión.');
            }
            console.log(`[SelfAction] Superior ${interaction.user.tag} self-removing role ${role.name} - Allowed`);
        }

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Check if user doesn't have the role
            if (!member.roles.cache.has(role.id)) {
                return interaction.editReply(`⚠️ ${targetUser.tag} no tiene el rol ${role.name}.`);
            }

            // Remove role
            await member.roles.remove(role);

            // Wait briefly to ensure Discord processes the change
            await new Promise(resolve => setTimeout(resolve, 500));

            const embed = new EmbedBuilder()
                .setTitle('✅ Rol Removido')
                .setColor('#FF0000')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: '🎭 Rol', value: `${role.name}`, inline: true },
                    { name: '👮 Por', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[quitar-rol] Error:', error);
            await interaction.editReply('❌ Error al quitar el rol. Verifica que el bot tenga permisos suficientes.');
        }
    }
};

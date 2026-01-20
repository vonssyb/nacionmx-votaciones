const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('agregar-rol')
        .setDescription('➕ Agregar un rol a un usuario (Solo Staff)')
        .addUserOption(option => option.setName('usuario').setDescription('Usuario al que agregar rol').setRequired(true))
        .addRoleOption(option => option.setName('rol').setDescription('Rol a agregar').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Razón del cambio').setRequired(false)),

    async execute(interaction) {
        // Explicit defer to prevent timeout
        await interaction.deferReply();

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

            // Check if user can approve their own actions
            if (!selfActionService.canApproveSelfAction(interaction.member)) {
                // Send approval request to superiors
                const requestId = `${Date.now()}_${interaction.user.id}`;
                await selfActionService.requestSuperiorApproval({
                    actionType: 'role_add',
                    executor: interaction.user,
                    target: targetUser,
                    guildId: interaction.guildId,
                    details: `Intento de auto-asignación del rol **${role.name}**\nRazón: ${razon}`,
                    approveButtonId: `sa_approve_role_${requestId}_${role.id}`,
                    rejectButtonId: `sa_reject_role_${requestId}`,
                    metadata: {
                        role: `<@&${role.id}> (${role.name})`,
                        roleId: role.id,
                        reason: razon
                    }
                });

                return interaction.editReply('⚠️ **Auto-Asignación Detectada**\n\nNo puedes asignarte roles a ti mismo sin aprobación.\nSe ha enviado una solicitud a un superior para revisión.\n\nRecibirás una notificación cuando sea aprobada o rechazada.');
            }
            // If user CAN approve (is superior), log but allow
            console.log(`[SelfAction] Superior ${interaction.user.tag} self-assigning role ${role.name} - Allowed`);
        }

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);

            // Check if user already has the role
            if (member.roles.cache.has(role.id)) {
                return interaction.editReply(`⚠️ ${targetUser.tag} ya tiene el rol ${role.name}.`);
            }

            // --- JOB LIMIT CHECK ---
            const { PRINCIPAL_JOBS, SECONDARY_JOBS } = require('../../config/erlcEconomyEmergency');
            const JobValidator = require('../../services/JobValidator');

            let jobTypeToCheck = null;
            if (PRINCIPAL_JOBS.includes(role.id)) {
                jobTypeToCheck = 'PRINCIPAL';
            } else if (SECONDARY_JOBS.includes(role.id)) {
                jobTypeToCheck = 'SECONDARY';
            }

            if (jobTypeToCheck) {
                console.log(`[AddRole Debug] Validating ${role.name} (${role.id}) for ${member.user.tag}. Type: ${jobTypeToCheck}`);
                const validation = await JobValidator.validateNewJob(member, jobTypeToCheck, interaction.client.supabase);
                console.log('[AddRole Debug] Result:', validation);

                if (!validation.allowed) {
                    return interaction.editReply(validation.reason);
                }
            }

            // --- CK ROLE COOLDOWN CHECK ---
            const { data: cooldown } = await interaction.client.supabase
                .from('role_cooldowns')
                .select('*')
                .eq('user_id', targetUser.id)
                .eq('role_id', role.id)
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            if (cooldown) {
                const expiresDate = new Date(cooldown.expires_at).toLocaleDateString('es-MX');
                return interaction.editReply(`⛔ **Rol Bloqueado por CK**\nEste usuario tiene restringido el rol **${role.name}** debido a un CK reciente.\n\n📅 Desbloqueo: **${expiresDate}**`);
            }

            // Add role
            await member.roles.add(role);

            // Wait briefly to ensure Discord processes the change
            await new Promise(resolve => setTimeout(resolve, 500));

            const embed = new EmbedBuilder()
                .setTitle('✅ Rol Agregado')
                .setColor('#00FF00')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: '🎭 Rol', value: `${role.name}`, inline: true },
                    { name: '👮 Por', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[agregar-rol] Error:', error);
            await interaction.editReply('❌ Error al agregar el rol. Verifica que el bot tenga permisos suficientes.');
        }
    }
};

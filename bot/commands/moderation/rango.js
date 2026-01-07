const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rango')
        .setDescription('⚙️ Gestión de Rangos de Staff')
        .addSubcommand(subcommand =>
            subcommand
                .setName('promover')
                .setDescription('Subir de rango a un miembro del staff')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a promover').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('degradar')
                .setDescription('Bajar de rango a un miembro del staff')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a degradar').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('establecer')
                .setDescription('Asignar un rango específico')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario').setRequired(true))
                .addStringOption(option =>
                    option.setName('nivel')
                        .setDescription('Nuevo rango')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Nivel 1: Staff en Entrenamiento', value: '1' },
                            { name: 'Nivel 2: Moderador / Staff', value: '2' },
                            { name: 'Nivel 3: Administración', value: '3' },
                            { name: 'Nivel 4: Junta Directiva', value: '4' }
                        )
                ))
        .addSubcommand(subcommand =>
            subcommand.setName('lock')
                .setDescription('🔒 Bloquear ascensos de un usuario (Rank Lock)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('unlock')
                .setDescription('🔓 Desbloquear ascensos de un usuario')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        // --- CONFIGURATION ---
        // --- CONFIGURATION ---
        // Roles Hierarchy (Lowest to Highest)
        // IDs must match sancion.js config
        const RANGOS = [
            {
                name: 'Staff en Entrenamiento',
                level: 1,
                color: 0x3498DB, // Blue
                main_id: '1457558479287091417',
                roles: ['1457558479287091417', '1412887167654690908'] // Role + Staff Separator
            },
            {
                name: 'Moderador / Staff',
                level: 2,
                color: 0x2ECC71, // Green
                main_id: '1412887079612059660',
                roles: ['1412887079612059660', '1450242319121911848', '1450242487422812251', '1412887167654690908'] // Role + KeyMod + KeySeparator + StaffSeparator
            },
            {
                name: 'Administración',
                level: 3,
                color: 0xE74C3C, // Red
                main_id: '1412882248411381872', // Keeping original distinct ID to ensure hierarchy exists
                roles: ['1412882248411381872', '1450242210636365886', '1450242487422812251', '1412887167654690908'] // Role + KeyAdmin + KeySeparator + StaffSeparator
            },
            {
                name: 'Junta Directiva',
                level: 4,
                color: 0xF1C40F, // Gold
                main_id: '1412882245735420006',
                // JD gets Admin Keys + JD Role
                roles: ['1412882245735420006', '1450242210636365886', '1450242487422812251', '1412887167654690908']
            }
        ];

        // Roles that can manage staff
        const ALLOWED_MANAGERS = [
            '1412882245735420006', // Junta Directiva
            '1454985316292100226'  // Encargado de Staff
        ];

        // 1. Check Permissions (Manager Only)
        const isManager = interaction.member.roles.cache.some(r => ALLOWED_MANAGERS.includes(r.id)) || interaction.member.permissions.has('Administrator');

        if (!isManager) {
            return interaction.followUp({ content: '⛔ **Acceso Denegado:** Solo Junta Directiva y Encargados pueden gestionar rangos.', flags: [64] });
        }

        const targetUser = interaction.options.getUser('usuario');
        const subcommand = interaction.options.getSubcommand();

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            const LOCK_ROLE_NAME = '🔒 Rank Locked';

            // Find Lock Role
            let lockRole = interaction.guild.roles.cache.find(r => r.name === LOCK_ROLE_NAME);
            if (!lockRole && (subcommand === 'lock')) {
                // Create if doesn't exist and trying to lock
                try {
                    lockRole = await interaction.guild.roles.create({
                        name: LOCK_ROLE_NAME,
                        color: 0x000000,
                        reason: 'Sistema de Rank Lock Automático'
                    });
                } catch (e) {
                    return interaction.followUp('❌ Error: No existe el rol "🔒 Rank Locked" y no pude crearlo. Verifica mis permisos.');
                }
            }

            const isLocked = lockRole && member.roles.cache.has(lockRole.id);

            // HANDLE LOCK/UNLOCK COMMANDS
            if (subcommand === 'lock') {
                if (isLocked) return interaction.followUp(`⚠️ **${targetUser.tag}** ya tiene Rank Lock.`);
                await member.roles.add(lockRole);
                return interaction.followUp(`🔒 **RANK LOCK ACTIVADO** para ${targetUser.tag}.\n⛔ Este usuario ya no podrá ser promovido.`);
            }

            if (subcommand === 'unlock') {
                if (!isLocked) return interaction.followUp(`⚠️ **${targetUser.tag}** no tiene Rank Lock.`);
                await member.roles.remove(lockRole);
                return interaction.followUp(`🔓 **RANK LOCK RETIRADO** de ${targetUser.tag}.\n✅ Ahora puede ser promovido nuevamente.`);
            }


            // Determine Current Level
            let currentRankIndex = -1;
            // Iterate backwards (highest to lowest) to find highest rank
            for (let i = RANGOS.length - 1; i >= 0; i--) {
                if (member.roles.cache.has(RANGOS[i].main_id)) {
                    currentRankIndex = i;
                    break;
                }
            }

            let newRankIndex = -1;

            if (subcommand === 'promover') {
                // RANK LOCK CHECK
                if (isLocked) {
                    return interaction.followUp({
                        content: `🛑 **ACCIÓN BLOQUEADA**\n\nEl usuario **${targetUser.tag}** tiene un **RANK LOCK** activo.\nNo puede ser promovido hasta que un Directivo le quite el bloqueo con \`/rango unlock\`.`,
                        flags: [64]
                    });
                }

                if (currentRankIndex === -1) {
                    newRankIndex = 0; // Promote to Level 1
                } else if (currentRankIndex < RANGOS.length - 1) {
                    newRankIndex = currentRankIndex + 1;
                } else {
                    return interaction.followUp(`⚠️ **Error:** ${targetUser.tag} ya está en el rango máximo (${RANGOS[currentRankIndex].name}).`);
                }
            } else if (subcommand === 'degradar') {
                if (currentRankIndex === -1) {
                    return interaction.followUp(`⚠️ **Error:** ${targetUser.tag} no tiene rango de staff.`);
                } else if (currentRankIndex > 0) {
                    newRankIndex = currentRankIndex - 1;
                } else {
                    // Demote from Level 1 -> Remove Staff Role
                    newRankIndex = -2; // Special code for removal
                }
            } else if (subcommand === 'establecer') {
                const level = parseInt(interaction.options.getString('nivel'));
                newRankIndex = level - 1; // 1-based to 0-based
            }

            // EXECUTE CHANGES
            const changesLog = [];

            // 1. Remove ALL staff roles (to ensure clean slate)
            const allStaffRoleIds = [...new Set(RANGOS.flatMap(r => r.roles))];
            await member.roles.remove(allStaffRoleIds);

            let actionDescription = '';
            let color = 0x808080;

            if (newRankIndex >= 0) {
                // Add new rank roles
                const newRank = RANGOS[newRankIndex];
                await member.roles.add(newRank.roles);

                actionDescription = `✅ **Asignado Nuevo Rango:** <@&${newRank.main_id}> (${newRank.name})`;
                if (newRank.roles.length > 1) {
                    actionDescription += `\n🔑 **Roles Agregados:** ${newRank.roles.length} (Incluyendo Keys)`;
                }
                color = newRank.color;

                const oldRankName = currentRankIndex >= 0 ? RANGOS[currentRankIndex].name : 'Ninguno';
                changesLog.push(`De: ${oldRankName}`);
                changesLog.push(`A: ${newRank.name}`);

            } else if (newRankIndex === -2) {
                // Removed from staff
                actionDescription = '🔻 **Expulsado del Staff:** Se han retirado todos los roles de rango.';
                color = 0x000000;
                const oldRankName = currentRankIndex >= 0 ? RANGOS[currentRankIndex].name : 'Desconocido';
                changesLog.push(`De: ${oldRankName}`);
                changesLog.push('A: Ninguno (Civil)');
            }

            // Embed Response
            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Actualización de Rango Staff`)
                .setDescription(`${actionDescription}\n\n👤 **Usuario:** ${targetUser.tag}\n👮 **Gestionado por:** ${interaction.user.tag}`)
                .setColor(color)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.followUp({ embeds: [embed] });

            // --- ERLC SYNC ---
            let erlcSyncMsg = '';
            try {
                // Get Roblox ID
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('roblox_username, roblox_id')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                if (citizen && citizen.roblox_username) {
                    const ErlcService = require('../../services/ErlcService');
                    const erlcKey = process.env.ERLC_API_KEY;

                    if (erlcKey) {
                        const erlcService = new ErlcService(erlcKey);
                        let cmd = '';

                        if (newRankIndex >= 2) { // Level 3 (Admin) or 4 (Board)
                            cmd = `:admin ${citizen.roblox_username}`;
                        } else if (newRankIndex >= 0) { // Level 1 or 2 (Mod)
                            cmd = `:mod ${citizen.roblox_username}`;
                        } else { // Removed or Demoted below 0
                            cmd = `:removemod ${citizen.roblox_username}`;
                        }

                        await erlcService.runCommand(cmd);
                        erlcSyncMsg = `\n🎮 **ERLC Sincronizado:** Comando \`${cmd}\` enviado.`;

                        // Update embed with sync info
                        const updatedEmbed = EmbedBuilder.from(embed).setDescription(embed.data.description + erlcSyncMsg);
                        await interaction.editReply({ embeds: [updatedEmbed] });
                    }
                } else {
                    erlcSyncMsg = '\n⚠️ **No vinculado en ERLC:** No se pudieron actualizar permisos ingame.';
                    const updatedEmbed = EmbedBuilder.from(embed).setDescription(embed.data.description + erlcSyncMsg);
                    await interaction.editReply({ embeds: [updatedEmbed] });
                }
            } catch (erlcError) {
                console.error('ERLC Sync Error:', erlcError);
                // Don't fail the whole command, just log it
            }

            // Audit
            await client.logAudit(
                'Cambio de Rango Staff',
                `Usuario: <@${targetUser.id}>\nAcción: ${subcommand.toUpperCase()}\n${changesLog.join('\n')}`,
                interaction.user,
                targetUser,
                color
            );

        } catch (error) {
            console.error('[Rango] Error:', error);
            await interaction.followUp('❌ Error al gestionar los roles. Verifica que el bot tenga permisos superiores al rol que intenta asignar.');
        }
    }
};

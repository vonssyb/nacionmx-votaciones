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
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        // --- CONFIGURATION ---
        // Roles Hierarchy (Lowest to Highest)
        // IDs must match sancion.js config
        const RANGOS = [
            { id: '1412887167654690908', name: 'Staff en Entrenamiento', level: 1, color: 0x3498DB },
            { id: '1412887079612059660', name: 'Moderador / Staff', level: 2, color: 0x2ECC71 },
            { id: '1412882248411381872', name: 'Administración', level: 3, color: 0xE74C3C },
            { id: '1412882245735420006', name: 'Junta Directiva', level: 4, color: 0xF1C40F }
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

            // Determine Current Level
            let currentRankIndex = -1;
            // Iterate backwards (highest to lowest) to find highest rank
            for (let i = RANGOS.length - 1; i >= 0; i--) {
                if (member.roles.cache.has(RANGOS[i].id)) {
                    currentRankIndex = i;
                    break;
                }
            }

            let newRankIndex = -1;

            if (subcommand === 'promover') {
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

            // 1. Remove old ranks (Clean sweep mostly, but safer to just remove the one we know)
            // Strategy: Remove ALL staff roles to ensure clean state, then add the new one.
            const allStaffRoleIds = RANGOS.map(r => r.id);
            await member.roles.remove(allStaffRoleIds);

            let actionDescription = '';
            let color = 0x808080;

            if (newRankIndex >= 0) {
                // Add new rank
                const newRank = RANGOS[newRankIndex];
                await member.roles.add(newRank.id);
                actionDescription = `✅ **Asignado Nuevo Rango:** <@&${newRank.id}> (${newRank.name})`;
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

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
            subcommand.setName('expulsar')
                .setDescription('🚨 Expulsar miembro del Staff (Wipe completo)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
                .addStringOption(option => option.setName('razon').setDescription('Razón de la expulsión').setRequired(true)))
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
        // Defer reply immediately since this might take time (DB + ERLC + Discord API)
        await interaction.deferReply({});

        // --- CONFIGURATION ---
        // Roles Hierarchy (Lowest to Highest)
        const RANGOS = [
            {
                name: 'Staff en Entrenamiento',
                level: 1,
                badge_type: 'ST',
                color: 0x3498DB, // Blue
                main_id: '1457558479287091417',
                roles: ['1457558479287091417', '1412887167654690908'] // Role + Staff Separator
            },
            {
                name: 'Moderador / Staff',
                level: 2,
                badge_type: 'ST',
                color: 0x2ECC71, // Green
                main_id: '1412887079612059660',
                roles: ['1412887079612059660', '1450242319121911848', '1450242487422812251', '1412887167654690908'] // Role + KeyMod + KeySeparator + StaffSeparator
            },
            {
                name: 'Administración',
                level: 3,
                badge_type: 'AD',
                color: 0xE74C3C, // Red
                main_id: '1412882248411381872',
                // Admin gets: Admin Role + Key Mod + Key Separator + Staff Separator (NO KEY ADMIN)
                roles: ['1412882248411381872', '1450242319121911848', '1450242487422812251', '1412887167654690908']
            },
            {
                name: 'Junta Directiva',
                level: 4,
                badge_type: 'JD',
                color: 0xF1C40F, // Gold
                main_id: '1412882245735420006',
                // JD gets: JD Role + Admin Keys + Key Mod + Separators
                roles: ['1412882245735420006', '1450242210636365886', '1450242319121911848', '1450242487422812251', '1412887167654690908']
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

            // Handle Lock/Unlock Command Logic
            if (subcommand === 'lock' || subcommand === 'unlock') {
                if (!lockRole && subcommand === 'lock') {
                    try {
                        lockRole = await interaction.guild.roles.create({ name: LOCK_ROLE_NAME, color: 0x000000, reason: 'Rank Lock' });
                    } catch (e) { return interaction.followUp('❌ Error: No existe el rol "🔒 Rank Locked" y no pude crearlo. Verifica mis permisos.'); }
                }
                const isLocked = lockRole && member.roles.cache.has(lockRole.id);
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
            }

            const isLocked = lockRole && member.roles.cache.has(lockRole.id);

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
            let kickReason = '';

            // LOGIC FOR COMMANDS
            if (subcommand === 'expulsar') {
                kickReason = interaction.options.getString('razon');
                newRankIndex = -2; // Special code for removal
            } else if (subcommand === 'promover') {
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

            // --- EXECUTE CHANGES ---
            const changesLog = [];
            const allStaffRoleIds = [...new Set(RANGOS.flatMap(r => r.roles))];

            // Remove all roles first
            await member.roles.remove(allStaffRoleIds);

            let actionDescription = '';
            let color = 0x808080;
            let finalBadge = null;

            // HANDLE NICKNAME & BADGE
            const originalNickname = member.displayName;
            // Strip existing prefix if any [ST-00X] Name -> Name
            // Regex matches [AA-999] or similar
            const cleanName = originalNickname.replace(/^\[[A-Z]{2}-\d{3}\]\s*/, '');

            if (newRankIndex >= 0) { // Adding Rank
                const newRank = RANGOS[newRankIndex];
                await member.roles.add(newRank.roles);
                color = newRank.color;

                // --- BADGE SYSTEM ---
                // 1. Check if user already has a number for this type
                const { data: existingBadge } = await supabase
                    .from('staff_badges')
                    .select('*')
                    .eq('discord_id', targetUser.id)
                    .eq('badge_type', newRank.badge_type)
                    .maybeSingle();

                let badgeNumber = 1;
                if (existingBadge) {
                    badgeNumber = existingBadge.badge_number;
                } else {
                    // Assign new number
                    const { data: maxBadge } = await supabase
                        .from('staff_badges')
                        .select('badge_number')
                        .eq('badge_type', newRank.badge_type)
                        .order('badge_number', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    badgeNumber = (maxBadge?.badge_number || 0) + 1;

                    // Save to DB
                    await supabase.from('staff_badges').insert({
                        discord_id: targetUser.id,
                        badge_type: newRank.badge_type,
                        badge_number: badgeNumber
                    });
                }

                const badgeStr = `${newRank.badge_type}-${String(badgeNumber).padStart(3, '0')}`; // ST-001
                finalBadge = badgeStr;
                const newNickname = `[${badgeStr}] ${cleanName}`;

                try {
                    await member.setNickname(newNickname);
                    changesLog.push(`🏷️ **Placa Asignada:** ${badgeStr}`);
                } catch (nickError) {
                    changesLog.push(`⚠️ No pude cambiar apodo (Permisos insuficientes)`);
                }

                actionDescription = `✅ **Nuevo Rango:** <@&${newRank.main_id}> (${newRank.name})`;
                const oldRankName = currentRankIndex >= 0 ? RANGOS[currentRankIndex].name : 'Ninguno';
                changesLog.push(`De: ${oldRankName}`);
                changesLog.push(`A: ${newRank.name}`);

            } else if (newRankIndex === -2) { // Removing/Kicking
                actionDescription = subcommand === 'expulsar' ?
                    `🚨 **EXPULSADO DEL STAFF**\n📝 Razón: ${kickReason}` :
                    '🔻 **Expulsado del Staff** (Retiro de roles)';
                color = 0x000000;

                // Reset Nickname
                try {
                    await member.setNickname(cleanName); // Remove prefix
                    changesLog.push(`🏷️ Placa retirada`);
                } catch (e) { }

                if (subcommand === 'expulsar') {
                    // Notify User via DM
                    try {
                        await targetUser.send(`🚨 **HAS SIDO EXPULSADO DEL STAFF DE NACIÓN MX**\n\n📝 **Razón:** ${kickReason}\n👮 **Por:** ${interaction.user.tag}`);
                    } catch (e) { }
                }
                const oldRankName = currentRankIndex >= 0 ? RANGOS[currentRankIndex].name : 'Desconocido';
                changesLog.push(`De: ${oldRankName}`);
                changesLog.push('A: Ninguno (Civil)');
            }

            // --- EMBED ---
            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Gestión de Staff: ${subcommand.toUpperCase()}`)
                .setDescription(`${actionDescription}\n\n👤 **Usuario:** ${targetUser.tag}\n👮 **Mod:** ${interaction.user.tag}\n\n${changesLog.join('\n')}`)
                .setColor(color)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            await interaction.followUp({ embeds: [embed] });

            // --- ERLC SYNC ---
            let erlcSyncMsg = '';
            try {
                let robloxName = null;
                let source = 'db';

                // 1. Try DB Link
                const { data: citizen } = await supabase.from('citizens').select('roblox_username').eq('discord_id', targetUser.id).maybeSingle();
                if (citizen && citizen.roblox_username) {
                    robloxName = citizen.roblox_username;
                } else {
                    // 2. Fallback: Use Discord Name (Cleaned)
                    robloxName = cleanName.replace(/[^a-zA-Z0-9_]/g, ''); // Basic sanitization for Roblox
                    source = 'discord';
                }

                if (robloxName) {
                    const ErlcService = require('../../services/ErlcService');
                    const erlcKey = process.env.ERLC_API_KEY;

                    if (erlcKey) {
                        const erlcService = new ErlcService(erlcKey);
                        let cmd = '';

                        if (newRankIndex === 3) cmd = `:admin ${robloxName}`; // Level 4 JD
                        else if (newRankIndex >= 0) cmd = `:mod ${robloxName}`; // Level 1, 2, 3
                        else cmd = `:removemod ${robloxName}`;

                        // Try to execute
                        try {
                            const result = await erlcService.runCommand(cmd);
                            if (result && result.success === false && result.status === 404) {
                                throw new Error('Player offline'); // Trigger queue
                            }
                            erlcSyncMsg = `\n🎮 **ERLC:** Comando \`${cmd}\` enviado (${source === 'db' ? 'Vinculado' : 'Desde Discord'}).`;
                        } catch (erlcErr) {
                            // Queue System
                            console.log(`[ERLC Queue] Player offline or error. Queuing command: ${cmd}`);
                            await supabase.from('pending_erlc_commands').insert({
                                discord_id: targetUser.id,
                                roblox_username: robloxName,
                                command: cmd,
                                status: 'pending'
                            });
                            erlcSyncMsg = `\n⏳ **ERLC:** Cmd \`${cmd}\` encolado (${source === 'db' ? 'Vinculado' : 'Desde Discord'}).`;
                        }

                        const updatedEmbed = EmbedBuilder.from(embed).setDescription(embed.data.description + erlcSyncMsg);
                        await interaction.editReply({ embeds: [updatedEmbed] });
                    }
                } else {
                    erlcSyncMsg = '\n⚠️ **Error ERLC:** No se pudo determinar el nombre de usuario (Ni DB ni Discord válido).';
                    const updatedEmbed = EmbedBuilder.from(embed).setDescription(embed.data.description + erlcSyncMsg);
                    await interaction.editReply({ embeds: [updatedEmbed] });
                }
            } catch (e) {
                console.error('ERLC Sync Error:', e);
                // Don't fail the whole command, just log it
            }

            // Log Audit
            await client.logAudit('Gestión de Staff', `Acción: ${subcommand}\n${changesLog.join('\n')}`, interaction.user, targetUser, color);

        } catch (error) {
            console.error('[Rango] Error:', error);
            await interaction.followUp('❌ Error crítico gestionando rango. Verifica que el bot tenga permisos superiores al rol que intenta asignar.');
        }
    }
};

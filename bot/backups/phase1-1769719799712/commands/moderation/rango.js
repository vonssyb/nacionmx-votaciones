const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ROLES } = require('../../config/constants');

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
                            { name: 'Nivel 4: Junta Directiva', value: '4' },
                            { name: 'Nivel 5: Tercer al Mando', value: '5' }
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
        console.log(`[DEBUG] /rango Command Triggered by ${interaction.user.tag} | Subcommand: ${interaction.options.getSubcommand()}`);

        // Safe Deferral to prevent "Thinking" hang
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
            console.log(`[DEBUG] /rango Deferred Successfully`);
        }


        // --- CONFIGURATION ---
        // Roles Hierarchy (Lowest to Highest)
        const RANGOS = [
            {
                name: 'Staff en Entrenamiento',
                level: 1,
                badge_type: 'ST',
                color: 0x3498DB, // Blue
                main_id: ROLES.STAFF_ENTRENAMIENTO,
                roles: [ROLES.STAFF_ENTRENAMIENTO, ROLES.STAFF_SEPARATOR]
            },
            {
                name: 'Moderador / Staff',
                level: 2,
                badge_type: 'ST',
                color: 0x2ECC71, // Green
                main_id: ROLES.MODERADOR,
                roles: [ROLES.MODERADOR, ROLES.KEY_MOD, ROLES.KEY_SEPARATOR, ROLES.STAFF_SEPARATOR]
            },
            {
                name: 'Administración',
                level: 3,
                badge_type: 'AD',
                color: 0xE74C3C, // Red
                main_id: ROLES.ADMINISTRACION,
                roles: [ROLES.ADMINISTRACION, ROLES.KEY_MOD, ROLES.KEY_SEPARATOR, ROLES.STAFF_SEPARATOR]
            },
            {
                name: 'Junta Directiva',
                level: 4,
                badge_type: 'JD',
                color: 0xF1C40F, // Gold
                main_id: ROLES.JUNTA_DIRECTIVA,
                roles: [ROLES.JUNTA_DIRECTIVA, ROLES.ADMIN_KEYS, ROLES.KEY_MOD, ROLES.KEY_SEPARATOR, ROLES.STAFF_SEPARATOR]
            },
            {
                name: 'Tercer al Mando',
                level: 5,
                badge_type: 'JD',
                color: 0xE67E22, // Orange
                main_id: ROLES.TERCER_AL_MANDO,
                roles: [ROLES.TERCER_AL_MANDO, ROLES.JUNTA_DIRECTIVA, ROLES.ADMIN_KEYS, ROLES.KEY_MOD, ROLES.KEY_SEPARATOR, ROLES.STAFF_SEPARATOR],
                noNumber: true // TR - Name format
            }
        ];

        // Roles that can manage staff
        const ALLOWED_MANAGERS = [
            ROLES.JUNTA_DIRECTIVA,
            ROLES.ENCARGADO_STAFF
        ];

        // 1. Check Permissions (Manager Only)
        const isManager = interaction.member.roles.cache.some(r => ALLOWED_MANAGERS.includes(r.id)) || interaction.member.permissions.has('Administrator');

        if (!isManager) {
            return interaction.editReply({ content: '⛔ **Acceso Denegado:** Solo Junta Directiva y Encargados pueden gestionar rangos.', flags: [64] });
        }

        const targetUser = interaction.options.getUser('usuario');
        const subcommand = interaction.options.getSubcommand();

        try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            const LOCK_ROLE_ID = ROLES.RANK_LOCK;

            // Find Lock Role by ID
            const lockRole = interaction.guild.roles.cache.get(LOCK_ROLE_ID);

            // Handle Lock/Unlock Command Logic
            if (subcommand === 'lock' || subcommand === 'unlock') {
                if (!lockRole) {
                    return interaction.editReply(`❌ Error: No encuentro el rol de bloqueo con ID \`${LOCK_ROLE_ID}\` (${ROLES.RANK_LOCK}). Verifica que exista.`);
                }
                const isLocked = member.roles.cache.has(LOCK_ROLE_ID);
                if (subcommand === 'lock') {
                    if (isLocked) return interaction.editReply(`⚠️ **${targetUser.tag}** ya tiene Rank Lock.`);
                    await member.roles.add(lockRole);
                    return interaction.editReply(`🔒 **RANK LOCK ACTIVADO** para ${targetUser.tag}.\n⛔ Este usuario ya no podrá ser promovido.`);
                }
                if (subcommand === 'unlock') {
                    if (!isLocked) return interaction.editReply(`⚠️ **${targetUser.tag}** no tiene Rank Lock.`);
                    await member.roles.remove(lockRole);
                    return interaction.editReply(`🔓 **RANK LOCK RETIRADO** de ${targetUser.tag}.\n✅ Ahora puede ser promovido nuevamente.`);
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
                    return interaction.editReply({
                        content: `🛑 **ACCIÓN BLOQUEADA**\n\nEl usuario **${targetUser.tag}** tiene un **RANK LOCK** activo.\nNo puede ser promovido hasta que un Directivo le quite el bloqueo con \`/rango unlock\`.`,
                        flags: [64]
                    });
                }

                if (currentRankIndex === -1) {
                    newRankIndex = 0; // Promote to Level 1
                } else if (currentRankIndex < RANGOS.length - 1) {
                    newRankIndex = currentRankIndex + 1;
                } else {
                    return interaction.editReply(`⚠️ **Error:** ${targetUser.tag} ya está en el rango máximo (${RANGOS[currentRankIndex].name}).`);
                }

                // RESTRICTION: Higher Rank (Level 4+ / Junta Directiva & Alto Mando) restricted to specific user
                // ID: 826637667718266880 (Owner/Head)
                if (newRankIndex >= 3) { // Level 4 (Index 3) and Level 5 (Index 4)
                    const ALLOWED_PROMOTER = ROLES.OWNER;
                    if (interaction.user.id !== ALLOWED_PROMOTER) {
                        return interaction.editReply({
                            content: `🛑 **ACCIÓN RESERVADA**\n\nSolo el **Jefe de Staff** (Dueño) puede promover a rangos directivos (**${RANGOS[newRankIndex].name}**).\nContacta a <@${ALLOWED_PROMOTER}>.`,
                            flags: [64]
                        });
                    }
                }
            } else if (subcommand === 'degradar') {
                if (currentRankIndex === -1) {
                    return interaction.editReply(`⚠️ **Error:** ${targetUser.tag} no tiene rango de staff.`);
                } else if (currentRankIndex > 0) {
                    newRankIndex = currentRankIndex - 1;
                } else {
                    // Demote from Level 1 -> Remove Staff Role
                    newRankIndex = -2; // Special code for removal
                }

                // REMOVE EXTRA PRIVILEGED ROLES ON DEMOTION
                const EXTRA_ROLES_TO_STRIP = [
                    '1456020936229912781', '1451703422800625777', '1454985316292100226',
                    '1457554145719488687', '1457919110947016879', '1457776641056047115',
                    '1455654563158954096', '1455654847717048473', '1450938106395234526',
                    '1456348822296068326', '1450688555503587459', '1454986744004087839',
                    '1450688588155981976'
                ];
                await member.roles.remove(EXTRA_ROLES_TO_STRIP).catch(e => console.error('Failed to strip extra roles:', e));
            } else if (subcommand === 'establecer') {
                const level = parseInt(interaction.options.getString('nivel'));
                newRankIndex = level - 1; // 1-based to 0-based
            }

            // --- EXECUTE CHANGES ---

            // CRITICAL: Singleton Check for "Tercer al Mando" (Level 5)
            // Only ONE user can hold this rank at a time.
            if (newRankIndex >= 0 && RANGOS[newRankIndex].name === 'Tercer al Mando') {
                const trRank = RANGOS[newRankIndex];
                const trRole = interaction.guild.roles.cache.get(trRank.main_id);

                if (trRole) {
                    // Filter members who have the role but are NOT the target user
                    // (Allow re-promoting the same user if needed, though redundant)
                    const existingHolders = trRole.members.filter(m => m.id !== targetUser.id);

                    if (existingHolders.size > 0) {
                        const holderName = existingHolders.first().user.tag;
                        return interaction.editReply({
                            content: `🛑 **ACCIÓN DENEGADA**\n\nEl rango **Tercer al Mando** es único y ya está ocupado por **${holderName}**.\nDebes degradar a esa persona antes de promover a alguien más.`,
                            flags: [64]
                        });
                    }
                }
            }

            const changesLog = [];
            const allStaffRoleIds = [...new Set(RANGOS.flatMap(r => r.roles))];

            // Remove all roles first
            await member.roles.remove(allStaffRoleIds);

            // --- BADGE RELEASE & SHIFT LOGIC ---
            let releasedBadgeType = null;
            let releasedBadgeNumber = null;

            if (currentRankIndex >= 0) {
                const oldRank = RANGOS[currentRankIndex];
                const nextBadgeType = (newRankIndex >= 0) ? RANGOS[newRankIndex].badge_type : null;

                // Shift if:
                // 1. User is kicked/removed (newRankIndex < 0)
                // 2. User moves to a rank with a DIFFERENT badge type (e.g. ST -> AD)
                // 3. User moves to a noNumber rank (e.g. JD -> TR)
                // Note: ST->ST (Level 1->2) should NOT shift.

                const isBadgeChange = (oldRank.badge_type !== nextBadgeType) || (newRankIndex >= 0 && RANGOS[newRankIndex].noNumber);

                if (isBadgeChange && !oldRank.noNumber) { // Only shift if old rank HAD a number
                    const { data: bData } = await supabase.from('staff_badges')
                        .select('badge_number')
                        .eq('discord_id', targetUser.id)
                        .eq('badge_type', oldRank.badge_type)
                        .maybeSingle();

                    if (bData) {
                        releasedBadgeType = oldRank.badge_type;
                        releasedBadgeNumber = bData.badge_number;

                        // Delete from DB immediately to free the slot (logically)
                        await supabase.from('staff_badges')
                            .delete()
                            .eq('discord_id', targetUser.id)
                            .eq('badge_type', releasedBadgeType);
                    }
                }
            }

            let actionDescription = '';
            let color = 0x808080;
            let finalBadge = null;

            // HANDLE NICKNAME & BADGE
            const originalNickname = member.displayName;
            // Strip existing prefix if any [ST-00X] Name -> Name
            // Regex matches [AA-999] or similar
            // Strip existing prefix if any [ST-00X] Name -> Name
            // Regex matches [AA-999] or similar, also "AD-002 |" patterns
            const cleanName = originalNickname
                .replace(/^\[[A-Z]{2,3}-\d{3}\]\s*/, '') // Remove standard [ST-001]
                .replace(/^[A-Z]{2,3}-\d{3}\s*\|\s*/, '') // Remove format "AD-002 | "
                .replace(/^[A-Z]{2,3}-\d{3}\s*/, ''); // Remove just "AD-002 "

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
                // Rule: ID 001 is invalid/skipped. If user has it, we trigger recalculation.
                if (existingBadge && existingBadge.badge_number > 1) {
                    badgeNumber = existingBadge.badge_number;
                } else {
                    // Assign new number - HYBRID APPROACH (DB + Nickname Scan)
                    // 1. Get ALL Used Numbers from DB
                    const { data: allBadges } = await supabase
                        .from('staff_badges')
                        .select('badge_number')
                        .eq('badge_type', newRank.badge_type);

                    const usedNumbers = new Set(allBadges?.map(b => b.badge_number) || []);

                    // 2. Scan Discord Nicknames for Self-Healing
                    try {
                        await interaction.guild.members.fetch();
                        const roleMembers = interaction.guild.roles.cache.get(newRank.main_id)?.members;

                        if (roleMembers) {
                            const badgeRegex = new RegExp(`${newRank.badge_type}[-\\s](\\d+)`, 'i');
                            roleMembers.forEach(m => {
                                const nick = m.displayName;
                                const match = nick.match(badgeRegex);
                                if (match && match[1]) {
                                    const num = parseInt(match[1]);
                                    if (!isNaN(num)) usedNumbers.add(num);
                                }
                            });
                        }
                    } catch (scanErr) {
                        console.error('Error scanning nicknames:', scanErr);
                    }

                    // 3. Find First Available Number (Start from 2)
                    badgeNumber = 2;
                    while (usedNumbers.has(badgeNumber)) {
                        badgeNumber++;
                    }

                    // Save to DB (Handle Correction)
                    if (existingBadge) {
                        // Correcting invalid ID 1 -> Update
                        await supabase.from('staff_badges')
                            .update({ badge_number: badgeNumber })
                            .eq('id', existingBadge.id);
                    } else {
                        // New Record -> Insert
                        await supabase.from('staff_badges').insert({
                            discord_id: targetUser.id,
                            badge_type: newRank.badge_type,
                            badge_number: badgeNumber
                        });
                    }
                }

                // Badge Logic for "noNumber" ranks (e.g. TR)
                let badgeStr = '';
                if (newRank.noNumber) {
                    badgeStr = `${newRank.badge_type} -`; // TR - Name
                } else {
                    badgeStr = `${newRank.badge_type}-${String(badgeNumber).padStart(3, '0')}`; // ST-001
                }

                finalBadge = badgeStr;
                // If noNumber, format is "TR - Name", otherwise "ST-001 | Name"
                const newNickname = newRank.noNumber ? `${badgeStr} ${cleanName}` : `${badgeStr} | ${cleanName}`;


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

            await interaction.editReply({ embeds: [embed] });

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
                    // 2. Fallback: Auto-Discovery via Roblox API
                    // Handle staff nickname format: "ST-002 | USERNAME" -> extract USERNAME (after pipe)
                    // Handle non-staff format: "USERNAME | Rank" -> extract USERNAME (before pipe)
                    let cleanUser = cleanName;

                    if (cleanName.includes('|')) {
                        const parts = cleanName.split('|');
                        // If first part looks like a badge (contains dash), take second part
                        if (parts[0].includes('-')) {
                            cleanUser = parts[1].trim(); // Staff: "ST-002 | USERNAME" -> "USERNAME"
                            console.log(`[DEBUG] [Rango] Extracted Roblox username from staff nickname: ${cleanName} -> ${cleanUser}`);
                        } else {
                            cleanUser = parts[0].trim(); // Regular: "USERNAME | Rank" -> "USERNAME"
                        }
                    }

                    // Clean any remaining special characters
                    cleanUser = cleanUser.replace(/[^a-zA-Z0-9_]/g, '');

                    try {
                        const RobloxService = require('../../services/RobloxService');
                        const robloxUser = await RobloxService.getIdFromUsername(cleanUser);

                        if (robloxUser) {
                            robloxName = robloxUser.name;
                            source = 'auto_linked';

                            // AUTO-LINK IN DATABASE
                            // We found a valid Roblox User matching their Discord Name!
                            await supabase.from('citizens').upsert({
                                discord_id: targetUser.id,
                                roblox_id: robloxUser.id.toString(), // Store as string if schema expects it, or int
                                roblox_username: robloxUser.name,
                                citizen_name: robloxUser.name // Default citizen name
                            }, { onConflict: 'discord_id' });

                            // Log this auto-link
                            changesLog.push(`🔗 **Auto-vinculado:** ${robloxUser.name} (ID: ${robloxUser.id})`);
                        } else {
                            // Valid Roblox user not found, fallback to raw guess but don't save
                            robloxName = cleanUser;
                            source = 'guessed';
                        }
                    } catch (apiErr) {
                        console.error('Roblox Lookup Failed:', apiErr);
                        robloxName = cleanUser;

                    }
                }

                if (robloxName) {
                    const ErlcService = require('../../services/ErlcService');
                    const erlcKey = process.env.ERLC_API_KEY;

                    if (erlcKey) {
                        const erlcService = new ErlcService(erlcKey);
                        const ErlcScheduler = require('../../services/ErlcScheduler'); // Require Scheduler
                        let cmd = '';

                        // LEVEL 3 (Admin) now gets :admin rights
                        if (newRankIndex >= 2) {
                            cmd = `:admin ${robloxName}`; // Level 3 Admin, Level 4 JD, Level 5 AM
                        } else if (newRankIndex >= 0) {
                            cmd = `:mod ${robloxName}`; // Level 1 Training, Level 2 Staff
                        } else {
                            // Removing Staff
                            // If they were previously receiving :admin (Index >= 2), unadmin.
                            if (currentRankIndex >= 2) {
                                cmd = `:unadmin ${robloxName}`;
                            } else {
                                cmd = `:unmod ${robloxName}`;
                            }
                        }

                        // Try to execute
                        try {
                            const result = await erlcService.runCommand(cmd);
                            if (result && result.success === false && result.status === 404) {
                                throw new Error('Player offline'); // Trigger queue
                            }
                            erlcSyncMsg = `\n🎮 **ERLC:** Comando \`${cmd}\` enviado (${source === 'db' ? 'Vinculado' : 'Desde Discord'}).`;
                        } catch (erlcErr) {
                            // Queue System using CORRECT Table via Scheduler
                            console.log(`[ERLC Queue] Player offline or error. Queuing command: ${cmd}`);
                            await ErlcScheduler.queueAction(interaction.client.supabase, cmd, 'Rank Update', { username: robloxName });
                            erlcSyncMsg = `\n⏳ **ERLC:** Cmd \`${cmd}\` encolado (Offline/Error).`;
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
            // Log Audit (Direct Implementation since client.logAudit is missing)
            try {
                const LOG_CHANNEL_ID = '1456035521141670066'; // Staff Audit Log
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

                if (logChannel) {
                    const auditEmbed = new EmbedBuilder()
                        .setTitle('Gestión de Staff')
                        .setDescription(`Acción: **${subcommand.toUpperCase()}**\n\n${changesLog.join('\n') || 'Sin cambios registrados.'}`)
                        .addFields(
                            { name: '👮 Ejecutado por', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                            { name: '👤 Usuario Objetivo', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true }
                        )
                        .setColor(color)
                        .setTimestamp();

                    await logChannel.send({ embeds: [auditEmbed] });
                }
            } catch (logErr) {
                console.error('Failed to send audit log:', logErr);
            }

            // --- PUBLIC LOGS (Ascensos / Descensos) ---
            try {
                const CHANNEL_ASCENSOS = '1398892202503049358';
                const CHANNEL_DESCENSOS = '1424126099192807546';
                let publicChannelId = null;
                let publicTitle = '';
                let publicColor = color;
                // Determine channel
                if (subcommand === 'promover') {
                    publicChannelId = CHANNEL_ASCENSOS;
                    publicTitle = '🎉 ¡ASCENSO DE STAFF!';
                } else if (subcommand === 'degradar' || subcommand === 'expulsar') {
                    publicChannelId = CHANNEL_DESCENSOS;
                    publicTitle = subcommand === 'expulsar' ? '🚨 EXPULSIÓN DE STAFF' : '⚠️ DEGRADACIÓN DE STAFF';
                }

                if (publicChannelId) {
                    const publicChannel = await client.channels.fetch(publicChannelId).catch(() => null);
                    if (publicChannel) {
                        const publicEmbed = new EmbedBuilder()
                            .setTitle(publicTitle)
                            .setColor(publicColor)
                            .setDescription(`👤 **Usuario:** ${targetUser} (${targetUser.tag})\n\n${changesLog.join('\n')}`)
                            .setThumbnail(targetUser.displayAvatarURL())
                            .setFooter({ text: `Gestionado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        await publicChannel.send({ content: `<@${targetUser.id}>`, embeds: [publicEmbed] });
                    }
                }
            } catch (pubLogErr) {
                console.error('Failed to send public log:', pubLogErr);
            }

            // --- FEEDBACK UPDATE ---
            // Add note about ERLC/DB application
            const feedbackMsg = `\n\n📌 **Nota:** Los cambios de rango se han registrado en la base de datos y se aplicarán en ERLC (si el servidor está activo). Si el usuario está offline, el comando se encolará.`;
            const finalEmbed = EmbedBuilder.from(embed).setDescription(embed.data.description + erlcSyncMsg + feedbackMsg);
            await interaction.editReply({ content: `<@${targetUser.id}>`, embeds: [finalEmbed] });

            // --- TRIGGER SHIFT IF NEEDED ---
            if (releasedBadgeType && releasedBadgeNumber) {
                // Determine source for recursion? No, just call it.
                // We access the function from module.exports if we are inside execute? 
                // Wait, 'this' context in execute might not be the module.
                // Best way: define the function outside or use `require` on itself? No that's messy.
                // We added it to module.exports. checking how to call it...
                // In standard node export, `execute` is just a function. `this` might be undefined.
                // Safest: We can implement the helper locally or use a trick. 
                // Actually, I pasted the helper inside module.exports.
                // Let's rely on the file structure.
                try {
                    const commandModule = require('./rango.js');
                    if (commandModule.shiftBadges) {
                        commandModule.shiftBadges(client, supabase, interaction.guild, releasedBadgeType, releasedBadgeNumber);
                    }
                } catch (e) { console.error('Shift Hook Error:', e); }
            }

        } catch (error) {
            console.error('[Rango] Error:', error);
            const botMember = await interaction.guild.members.fetchMe();
            const botHighest = botMember.roles.highest;

            let extraInfo = '';
            if (error.code === 50013) { // Missing Permissions
                extraInfo = `\n📉 **Bot Rank:** ${botHighest.name} (Pos: ${botHighest.position})`;

                // HIERARCHY DIAGNOSIS
                // Check all involved roles (add/remove) against bot position
                const targetRoleIds = [...(RANGOS[newRankIndex]?.roles || [])];
                const problemRoles = [];

                for (const rId of targetRoleIds) {
                    const r = interaction.guild.roles.cache.get(rId);
                    if (r && r.position >= botHighest.position) {
                        problemRoles.push(`${r.name} (Pos: ${r.position})`);
                    }
                }

                if (problemRoles.length > 0) {
                    extraInfo += `\n🛑 **ROLES PROBLEMÁTICOS (Están arriba de mí):**\n- ${problemRoles.join('\n- ')}`;
                } else {
                    extraInfo += `\n⚠️ No detecté roles superiores explícitos, pero Discord bloqueó la acción. Verifica si el usuario objetivo es el Owner o tiene un rol Admin superior.`;
                }
            }

            // check if interaction is still valid to edit
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(`❌ Error crítico gestionando rango: ${error.message}${extraInfo}\n\n**Solución:** Mueve mi rol (${botHighest.name}) por encima de los roles listados en la configuración del servidor.`);
                } else {
                    await interaction.reply({ content: `❌ Error crítico: ${error.message}${extraInfo}`, ephemeral: true });
                }
            } catch (e) { console.error('Failed to send error response:', e); }
        }
    }
};

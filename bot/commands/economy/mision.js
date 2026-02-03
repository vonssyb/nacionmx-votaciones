const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mision')
        .setDescription('📋 Sistema de Misiones Diarias')
        .addSubcommand(subcommand =>
            subcommand
                .setName('diaria')
                .setDescription('Ver la misión del día'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('completar')
                .setDescription('Marcar misión como completada para un usuario (Staff Only)')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuario que completó la misión')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reclamar')
                .setDescription('Reclamar recompensa de una misión completada')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({});

        const subcommand = interaction.options.getSubcommand();
        const STAFF_ROLE_ID = '1450242487422812251';

        try {
            if (subcommand === 'diaria') {
                // Get today's mission
                const { data: mission } = await supabase
                    .from('daily_missions')
                    .select('*')
                    .eq('active_date', new Date().toISOString().split('T')[0])
                    .maybeSingle();

                if (!mission) {
                    return interaction.editReply('❌ No hay misión activa para hoy.');
                }

                // Check allowed_roles (if defined)
                if (mission.allowed_roles && mission.allowed_roles.length > 0) {
                    const member = interaction.member; // Already cached usually
                    const hasRole = member.roles.cache.some(r => mission.allowed_roles.includes(r.id));

                    if (!hasRole) {
                        return interaction.editReply({
                            content: '⛔ **Misión Bloqueada**\nEsta misión es exclusiva para miembros de Seguridad Pública (Fuerzas del Orden).',
                            embeds: []
                        });
                    }
                }

                // Check if user has completed it
                const { data: completion } = await supabase
                    .from('mission_completions')
                    .select('*')
                    .eq('mission_id', mission.id)
                    .eq('discord_id', interaction.user.id)
                    .maybeSingle();

                const statusText = completion
                    ? (completion.claimed ? '✅ Completada y Reclamada' : '⏳ Completada - Usa `/mision reclamar`')
                    : '🔄 Pendiente';

                // Calculate Progress Bar
                let progressText = '';
                if (!completion || !completion.claimed) {
                    const current = completion ? (completion.progress_current || 0) : 0;
                    const target = completion ? (completion.progress_target || mission.requirements?.count || 1) : (mission.requirements?.count || 1);
                    const percent = Math.min(100, Math.floor((current / target) * 100));

                    const filled = Math.floor(percent / 10);
                    const empty = 10 - filled;
                    const bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);

                    progressText = `\n\n**Progreso:**\n${bar} ${percent}%\n(${current} / ${target} ${mission.requirements?.type === 'shift_minutes' ? 'minutos' : 'acciones'})`;
                }

                const difficultyColors = {
                    'easy': '#2ECC71',
                    'medium': '#F39C12',
                    'hard': '#E74C3C'
                };

                const embed = new EmbedBuilder()
                    .setTitle(`📋 Misión Diaria - ${new Date().toLocaleDateString('es-MX')}`)
                    .setDescription(`**${mission.title}**\n\n${mission.description}${progressText}`)
                    .setColor(difficultyColors[mission.difficulty] || '#3498DB')
                    .addFields(
                        { name: '🎯 Dificultad', value: mission.difficulty.toUpperCase(), inline: true },
                        { name: '💰 Recompensa', value: `$${mission.reward_money.toLocaleString()}`, inline: true },
                        { name: '⭐ XP', value: `${mission.reward_xp} XP`, inline: true },
                        { name: '📊 Estado', value: statusText, inline: false }
                    )
                    .setFooter({ text: 'Las misiones cambian diariamente' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'completar') {
                // Staff only
                const member = await interaction.guild.members.fetch(interaction.user.id);
                if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has('Administrator')) {
                    return interaction.editReply('❌ Solo el Staff puede marcar misiones como completadas.');
                }

                const targetUser = interaction.options.getUser('usuario');

                // Get today's missions
                const { data: missions } = await supabase
                    .from('daily_missions')
                    .select('*')
                    .eq('active_date', new Date().toISOString().split('T')[0]);

                if (!missions || missions.length === 0) {
                    return interaction.editReply('❌ No hay misiones activas para hoy.');
                }

                // Determine target mission for this user
                // Same logic: Security -> General
                const targetMember = await interaction.guild.members.fetch(targetUser.id);
                let mission = null;

                const securityMission = missions.find(m => m.allowed_roles && m.allowed_roles.length > 0);
                if (securityMission) {
                    const isSecurity = targetMember.roles.cache.some(r => securityMission.allowed_roles.includes(r.id));
                    if (isSecurity) mission = securityMission;
                }
                if (!mission) mission = missions.find(m => !m.allowed_roles || m.allowed_roles.length === 0);

                if (!mission) {
                    return interaction.editReply('❌ El usuario no califica para ninguna misión activa hoy.');
                }

                // Check if already completed
                const { data: existing } = await supabase
                    .from('mission_completions')
                    .select('*')
                    .eq('mission_id', mission.id)
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                if (existing) {
                    return interaction.editReply(`❌ ${targetUser.tag} ya completó la misión "${mission.title}".`);
                }

                // ... (Continue insert)
                await supabase.from('mission_completions').insert({
                    mission_id: mission.id,
                    discord_id: targetUser.id,
                    progress_current: mission.requirements?.count || 1, // Full progress
                    progress_target: mission.requirements?.count || 1
                });

                return interaction.editReply(
                    `✅ Misión **"${mission.title}"** completada para ${targetUser.tag}.\n` +
                    `El usuario puede reclamar su recompensa con \`/mision reclamar\`.`
                );

            } else if (subcommand === 'reclamar') {
                // Get today's missions
                const { data: missions } = await supabase
                    .from('daily_missions')
                    .select('*')
                    .eq('active_date', new Date().toISOString().split('T')[0]);

                if (!missions || missions.length === 0) {
                    return interaction.editReply('❌ No hay misiones activas para hoy.');
                }

                // Find a completed but unclaimed mission for this user
                let completionToClaim = null;
                let missionToClaim = null;

                for (const m of missions) {
                    const { data: completion } = await supabase
                        .from('mission_completions')
                        .select('*')
                        .eq('mission_id', m.id)
                        .eq('discord_id', interaction.user.id)
                        .maybeSingle();

                    if (completion && !completion.claimed) {
                        // Check if completed (either by manual override OR tracking)
                        const target = completion.progress_target || m.requirements?.count || 1;
                        if (completion.progress_current >= target || completion.completed_at) {
                            completionToClaim = completion;
                            missionToClaim = m;
                            break; // Found one, claim it
                        }
                    }
                }

                if (!completionToClaim) {
                    return interaction.editReply('❌ No tienes misiones completadas pendientes de reclamar hoy.');
                }

                // ... (Proceed to claim missionToClaim using completionToClaim)
                const mission = missionToClaim;
                const completion = completionToClaim; // Redundant but keeping variable names consistent


                // Give rewards
                const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                const EventService = require('../../services/EventService');
                const activeEvent = await EventService.getActiveEvent(supabase);
                const ubToken = process.env.UNBELIEVABOAT_TOKEN;

                let finalMoney = mission.reward_money;
                let finalXP = mission.reward_xp;
                let eventLabel = '';

                if (activeEvent) {
                    // Money Events
                    const moneyEvents = [
                        'DOUBLE_SALARY', 'TRIPLE_WORK', 'GOLDEN_HOUR', 'MILLIONAIRE_RAIN',
                        'FESTIVAL', 'CRISIS', 'INFLATION'
                    ];

                    if (moneyEvents.includes(activeEvent.event_type)) {
                        finalMoney = Math.floor(finalMoney * activeEvent.multiplier);
                        eventLabel += `\n💰 ${activeEvent.event_name}: x${activeEvent.multiplier} Dinero`;
                    }

                    // XP Events
                    const xpEvents = ['DOUBLE_XP', 'MEGA_XP', 'GOLDEN_HOUR', 'FESTIVAL'];
                    if (xpEvents.includes(activeEvent.event_type)) {
                        // Use multiplier (default might be 2.0 for DOUBLE_XP)
                        let xpMult = activeEvent.multiplier;
                        if (activeEvent.event_type === 'DOUBLE_XP' && xpMult === 1) xpMult = 2.0; // Fallback

                        finalXP = Math.floor(finalXP * xpMult);
                        eventLabel += `\n⭐ ${activeEvent.event_name}: x${xpMult} XP`;
                    }
                }

                if (ubToken && finalMoney > 0) {
                    const ubService = new UnbelievaBoatService(ubToken);
                    await ubService.addMoney(
                        interaction.guildId,
                        interaction.user.id,
                        finalMoney,
                        0,
                        `Misión Diaria: ${mission.title}`
                    );
                }

                // Update XP if user_stats exists
                if (finalXP > 0) {
                    const { data: stats } = await supabase
                        .from('user_stats')
                        .select('*')
                        .eq('discord_id', interaction.user.id)
                        .maybeSingle();

                    if (stats) {
                        await supabase
                            .from('user_stats')
                            .update({ xp: (stats.xp || 0) + finalXP })
                            .eq('discord_id', interaction.user.id);
                    }
                }

                // Mark as claimed
                await supabase
                    .from('mission_completions')
                    .update({
                        claimed: true,
                        claimed_at: new Date().toISOString()
                    })
                    .eq('id', completion.id);

                const embed = new EmbedBuilder()
                    .setTitle('🎉 Recompensa Reclamada')
                    .setColor('#2ECC71')
                    .setDescription(`¡Has completado la misión **"${mission.title}"**!`)
                    .addFields(
                        { name: '💰 Dinero', value: `+$${finalMoney.toLocaleString()}`, inline: true },
                        { name: '⭐ XP', value: `+${finalXP} XP`, inline: true }
                    );

                if (eventLabel) {
                    embed.addFields({ name: '🎉 Bonus Evento', value: eventLabel, inline: false });
                }
                embed.setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[mision] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción.');
        }
    }
};

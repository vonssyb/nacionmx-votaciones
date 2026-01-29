const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('misiones')
        .setDescription('📋 Ver tus misiones diarias activas'),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply();

        try {
            const missionService = client.services.missions;
            const userId = interaction.user.id;

            // 1. Check existing missions or initialize
            let { data: userMissions } = await supabase
                .from('user_missions')
                .select('*, mission:missions(*)')
                .eq('user_id', userId)
                .eq('status', 'active')
                .gte('expires_at', new Date().toISOString());

            if (!userMissions || userMissions.length === 0) {
                // Initialize if none active
                userMissions = await missionService.initializeDailyMissions(userId);
            }

            if (!userMissions || userMissions.length === 0) {
                return interaction.editReply('❌ No hay misiones disponibles hoy. ¡Vuelve mañana!');
            }

            // 2. Build Embed
            const embed = new EmbedBuilder()
                .setTitle('📋 Misiones Diarias')
                .setColor(0x00BFFF)
                .setDescription('Completa estas tareas antes del reinicio diario para ganar recompensas.')
                .setTimestamp();

            const rows = [];

            for (const um of userMissions) {
                const m = um.mission;
                const p = um.progress || { current: 0, required: 1 };
                const pct = Math.min(100, Math.floor((p.current / p.required) * 100));

                // Progress Bar
                const barLength = 10;
                const filled = Math.round((pct / 100) * barLength);
                const bar = '🟦'.repeat(filled) + '⬜'.repeat(barLength - filled);

                embed.addFields({
                    name: `${m.icon} ${m.name} (${pct}%)`,
                    value: `${m.description}\n\`${bar}\` **${p.current}/${p.required}**\n🏆 **${m.rewards.xp} XP** | 💵 **$${m.rewards.money || 0}**`
                });

                // Add Claim Button if completed (handled by logic update, status becomes 'completed')
                // Wait, logic says status becomes 'completed' automatically in updateProgress.
            }

            // Check if any completed missions waiting to be claimed
            const { data: completedMissions } = await supabase
                .from('user_missions')
                .select('*, mission:missions(*)')
                .eq('user_id', userId)
                .eq('status', 'completed'); // Completed but not claimed

            if (completedMissions && completedMissions.length > 0) {
                embed.addFields({ name: '✨ ¡Misiones Completadas!', value: 'Reclama tus recompensas abajo.' });

                const row = new ActionRowBuilder();
                completedMissions.forEach(cm => {
                    const btn = new ButtonBuilder()
                        .setCustomId(`claim_mission_${cm.id}`)
                        .setLabel(`Reclamar: ${cm.mission.name}`)
                        .setStyle(ButtonStyle.Success);
                    row.addComponents(btn);
                });
                rows.push(row);
            }

            await interaction.editReply({ embeds: [embed], components: rows });

        } catch (error) {
            console.error('Error in /misiones:', error);
            await interaction.editReply('❌ Error al cargar misiones.');
        }
    }
};

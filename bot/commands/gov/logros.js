const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logros')
        .setDescription('🏆 Ver tus logros desbloqueados y por desbloquear')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver logros de otro usuario')
                .setRequired(false)
        ),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('usuario') || interaction.user;

            // Fetch User Achievements
            const { data: unlocked, error: uError } = await supabase
                .from('user_achievements')
                .select('*, achievement:achievements(*)')
                .eq('user_id', targetUser.id);

            // Fetch ALL Achievements
            const { data: allAchievements, error: aError } = await supabase
                .from('achievements')
                .select('*')
                .eq('is_hidden', false)
                .order('points', { ascending: true });

            if (uError || aError) throw (uError || aError);

            const unlockedIds = new Set(unlocked.map(u => u.achievement_id));
            const totalPoints = unlocked.reduce((sum, u) => sum + (u.achievement?.points || 0), 0);

            const totalCount = allAchievements.length;
            const unlockedCount = unlocked.length;
            const percentage = Math.round((unlockedCount / totalCount) * 100) || 0;

            // Pagination Logic (Simple slice for now, or Tabs via Embed)
            // Let's show:
            // 1. Stats Header
            // 2. Recent Unlocks (Top 3)
            // 3. Next to Unlock (Top 3 cheapest locked)

            const recent = unlocked
                .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
                .slice(0, 3);

            const locked = allAchievements
                .filter(a => !unlockedIds.has(a.id))
                .slice(0, 5); // Show first 5 locked

            const embed = new EmbedBuilder()
                .setTitle(`🏆 Logros de ${targetUser.username}`)
                .setColor(0xFFD700)
                .setDescription(`**Progreso:** ${unlockedCount}/${totalCount} (${percentage}%)\n**Puntos:** ${totalPoints} 🌟`)
                .setThumbnail(targetUser.displayAvatarURL());

            if (recent.length > 0) {
                const recentList = recent.map(u => {
                    const a = u.achievement;
                    const date = new Date(u.unlocked_at).toLocaleDateString();
                    return `✅ **${a.icon} ${a.name}**\n*${a.description}* (${date})`;
                }).join('\n\n');
                embed.addFields({ name: '🔓 Recientemente Desbloqueados', value: recentList });
            }

            if (locked.length > 0) {
                const lockedList = locked.map(a => {
                    return `🔒 **${a.name}**\n*${a.description}* | ${a.points} pts`;
                }).join('\n\n');
                embed.addFields({ name: '🎯 Siguientes Metas', value: lockedList });
            } else {
                embed.addFields({ name: '🎉 ¡Impresionante!', value: 'Has desbloqueado todos los logros visibles.' });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /logros:', error);
            await interaction.editReply('❌ Error al cargar logros.');
        }
    }
};

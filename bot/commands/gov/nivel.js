const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nivel')
        .setDescription('📊 Ver tu nivel, experiencia y estadísticas')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver perfil de otro usuario')
                .setRequired(false)
        ),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('usuario') || interaction.user;
            const levelService = client.services.levels;

            const stats = await levelService.getUserStats(targetUser.id);

            if (!stats) {
                return interaction.editReply({
                    content: targetUser.id === interaction.user.id
                        ? '❌ No tienes perfil creado aún. ¡Interactúa con el bot para ganar XP!'
                        : '❌ Este usuario no tiene perfil de estadísticas.'
                });
            }

            // --- ASCI RANK CARD (Text Based) ---
            const progressBarLength = 15;
            const progress = stats.progressPercent; // 0 to 100
            const filledBlocks = Math.round((progress / 100) * progressBarLength);
            const emptyBlocks = progressBarLength - filledBlocks;
            const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

            // Rank Badge logic (simple)
            let rankEmoji = '🌱'; // Common
            let color = 0x00FF00;
            if (stats.level >= 15) { rankEmoji = '🔷'; color = 0x0099FF; } // Rare
            if (stats.level >= 30) { rankEmoji = '🔮'; color = 0x9900FF; } // Epic
            if (stats.level >= 50) { rankEmoji = '👑'; color = 0xFFD700; } // Legendary

            const embed = new EmbedBuilder()
                .setTitle(`${rankEmoji} Perfil de Nivel: ${targetUser.username}`)
                .setColor(color)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Nivel Actual', value: `Top **${stats.level}**`, inline: true },
                    { name: 'Experiencia Total', value: `✨ **${stats.xp?.toLocaleString()}** XP`, inline: true },
                    { name: 'Siguiente Nivel', value: `\`${progressBar}\` ${progress}%\nFaltan **${(stats.nextLevelXP - stats.xp).toLocaleString()}** XP`, inline: false },
                    { name: 'Estadísticas', value: `💬 Comandos: **${stats.commands_used || 0}**\n💰 Ganado: **$${(stats.total_earned || 0).toLocaleString()}**\n🔥 Racha Login: **${stats.login_streak || 0} días**`, inline: false }
                )
                .setFooter({ text: 'Nación MX Levels System' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /nivel:', error);
            await interaction.editReply('❌ Ocurrió un error al obtener el perfil.');
        }
    }
};

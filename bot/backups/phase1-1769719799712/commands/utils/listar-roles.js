const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listar-roles')
        .setDescription('📋 Listar todos los roles del servidor con sus IDs (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            const roles = guild.roles.cache
                .sort((a, b) => b.position - a.position) // Sort by highest position first
                .map(role => {
                    // Skip @everyone
                    if (role.id === guild.id) return null;
                    return `**${role.name}**\n\`${role.id}\`\nMiembros: ${role.members.size}`;
                })
                .filter(r => r !== null);

            // Split into chunks of 10 roles per embed (Discord limit)
            const chunks = [];
            for (let i = 0; i < roles.length; i += 10) {
                chunks.push(roles.slice(i, i + 10));
            }

            const embeds = chunks.map((chunk, index) => {
                return new EmbedBuilder()
                    .setTitle(`📋 Roles del Servidor (${index + 1}/${chunks.length})`)
                    .setDescription(chunk.join('\n\n'))
                    .setColor('#5865F2')
                    .setFooter({ text: `Total: ${roles.length} roles` })
                    .setTimestamp();
            });

            // Send first embed
            await interaction.editReply({ embeds: [embeds[0]] });

            // Send remaining embeds as follow-ups
            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
            }

        } catch (error) {
            console.error('[listar-roles] Error:', error);
            await interaction.editReply('❌ Error listando roles.');
        }
    }
};

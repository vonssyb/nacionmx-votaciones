const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ver-coches')
        .setDescription('🚗 Ver tus vehículos registrados o los de otro usuario')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver vehículos de otro usuario (Opcional)')
                .setRequired(false)),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply();

        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        const { data: vehicles } = await supabase
            .from('vehicles')
            .select('*')
            .eq('guild_id', interaction.guildId)
            .eq('user_id', targetUser.id);

        if (!vehicles || vehicles.length === 0) {
            return interaction.editReply({
                content: targetUser.id === interaction.user.id
                    ? '❌ No tienes vehículos registrados.'
                    : `❌ <@${targetUser.id}> no tiene vehículos registrados.`
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🚗 Garaje de ${targetUser.username}`)
            .setColor('#3498DB')
            .setDescription(`Tiene **${vehicles.length}** vehículo(s) registrado(s).`);

        vehicles.forEach((car, index) => {
            embed.addFields({
                name: `${index + 1}. ${car.model} (${car.color})`,
                value: `🏷️ Placa: \`${car.plate}\`\n🚙 Tipo: ${car.type}`,
                inline: true
            });
        });

        await interaction.editReply({ embeds: [embed] });
    }
};

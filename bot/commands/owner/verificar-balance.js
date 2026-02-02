const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar-balance')
        .setDescription('🔍 [ADMIN] Verificar balance de un usuario en UnbelievaBoat')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a verificar')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('usuario');

        if (!process.env.UNBELIEVABOAT_TOKEN) {
            return interaction.editReply('❌ Token de UnbelievaBoat no configurado.');
        }

        try {
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

            // Get current balance
            const balance = await ubService.getUserBalance(interaction.guildId, user.id);

            const embed = new EmbedBuilder()
                .setTitle('💰 Verificación de Balance')
                .setDescription(`Balance de ${user.tag}`)
                .addFields(
                    { name: '💵 Efectivo', value: `$${(balance?.cash || 0).toLocaleString()}`, inline: true },
                    { name: '🏦 Banco', value: `$${(balance?.bank || 0).toLocaleString()}`, inline: true },
                    { name: '💎 Total', value: `$${((balance?.cash || 0) + (balance?.bank || 0)).toLocaleString()}`, inline: true }
                )
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error verificando balance:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }
};

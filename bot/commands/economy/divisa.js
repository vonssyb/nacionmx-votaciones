const { SlashCommandBuilder } = require('discord.js');
const { handleCurrencyCommand } = require('../../handlers/currencyHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divisa')
        .setDescription('💱 Gestión de Tasa de Cambio Peso/Dólar')
        .addSubcommand(subcommand =>
            subcommand
                .setName('tasa')
                .setDescription('📈 Ver la tasa de cambio actual (USD → MXN)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-tasa')
                .setDescription('⚙️ Admin: Establecer manualmente la tasa del día')
                .addNumberOption(option =>
                    option.setName('valor')
                        .setDescription('Nuevo precio del dólar (Ej. 19.50)')
                        .setRequired(true))),

    async execute(interaction, client, supabase) {
        const exchangeService = client.services.exchangeRate;
        if (!exchangeService) {
            return interaction.reply({ content: '❌ Servicio de Divisa no disponible.', ephemeral: true });
        }
        await handleCurrencyCommand(interaction, exchangeService);
    }
};

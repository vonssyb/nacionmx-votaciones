const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debito')
        .setDescription('🏦 Banco: Gestión de débito y transferencias')
        .addSubcommand(subcommand =>
            subcommand
                .setName('depositar')
                .setDescription('Guardar dinero en el banco (Efectivo → Banco)')
                .addNumberOption(option => option.setName('monto').setDescription('Cantidad a depositar').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirar')
                .setDescription('Sacar dinero del cajero (Banco → Efectivo)')
                .addNumberOption(option => option.setName('monto').setDescription('Cantidad a retirar').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('estado')
                .setDescription('Ver tu saldo bancario y tarjeta'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transferir')
                .setDescription('Transferir a otro usuario (Banco a Banco, 5 min)')
                .addUserOption(option => option.setName('destinatario').setDescription('Usuario a transferir').setRequired(true))
                .addNumberOption(option => option.setName('monto').setDescription('Cantidad a transferir').setRequired(true))
                .addStringOption(option => option.setName('concepto').setDescription('Concepto de la transferencia').setRequired(false))),

    async execute(interaction, client, supabase) {
        const { handleEconomyLegacy } = require('../../handlers/legacyEconomyHandler');
        await handleEconomyLegacy(interaction, client, supabase);
    }
};

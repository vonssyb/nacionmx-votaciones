const { SlashCommandBuilder } = require('discord.js');
const ATMHandler = require('../../handlers/atmHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cajero')
        .setDescription('🏧 Abrir el Cajero Automático (ATM)'),
    ephemeral: true,

    async execute(interaction, client, supabase) {
        const atm = new ATMHandler(client, supabase);
        return atm.showHome(interaction);
    }
};

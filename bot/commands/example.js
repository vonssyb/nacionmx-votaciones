/**
 * Modular Command Structure
 * Fase 5, Item #17: Modular Commands
 * 
 * Usage:
 * 1. Create command files in bot/commands/
 * 2. Export using this interface
 * 3. Auto-loaded by CommandRegistry
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('example')
        .setDescription('Example command'),

    /**
     * Execute the command
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} context - Services context
     */
    async execute(interaction, context) {
        await interaction.reply('Example command executed!');
    },

    /**
     * Optional: Autocomplete handler
     */
    async autocomplete(interaction, context) {
        // Handle autocomplete
    },

    /**
     * Optional: Permission check
     */
    async checkPermissions(interaction) {
        return true; // or false to deny
    },

    /**
     * Optional: Cooldown in seconds
     */
    cooldown: 5,

    /**
     * Optional: Category for help command
     */
    category: 'utility'
};

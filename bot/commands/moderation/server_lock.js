const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Comandos de administración del servidor ERLC')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('🔒 Cerrar el servidor (Kick automático a no-whitelisted)'))
        .addSubcommand(sub =>
            sub.setName('unlock')
                .setDescription('🔓 Abrir el servidor'))
        .addSubcommand(sub =>
            sub.setName('whitelist')
                .setDescription('➕ Añadir usuario a la whitelist')
                .addStringOption(option => option.setName('usuario').setDescription('Roblox Username').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('unwhitelist')
                .setDescription('➖ Remover usuario de la whitelist')
                .addStringOption(option => option.setName('usuario').setDescription('Roblox Username').setRequired(true))),

    async execute(interaction, client) {
        // No defer here, logic is fast enough or we handle it inside
        // Actually, file ops are sync/fast.

        const subcommand = interaction.options.getSubcommand();
        const configPath = path.join(__dirname, '../../data/erlc_config.json');

        // Load Config
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath));
        }
        if (!config.whitelist) config.whitelist = [];
        if (config.locked === undefined) config.locked = false;

        const saveConfig = () => fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        if (subcommand === 'lock') {
            config.locked = true;
            saveConfig();
            return interaction.reply('🔒 **SERVIDOR CERRADO**. Se expulsará automáticamente a quien entre (excepto whitelist).');
        }

        if (subcommand === 'unlock') {
            config.locked = false;
            saveConfig();
            // Clear pending kicks cache if exposed? (Can't access it easily here unless in client)
            if (client.erlcPendingKicks) client.erlcPendingKicks.clear();
            return interaction.reply('🔓 **SERVIDOR ABIERTO**. Todos pueden entrar.');
        }

        if (subcommand === 'whitelist') {
            const user = interaction.options.getString('usuario');
            if (!config.whitelist.includes(user)) {
                config.whitelist.push(user);
                saveConfig();
                return interaction.reply(`✅ \`${user}\` añadido a la whitelist.`);
            }
            return interaction.reply(`⚠️ \`${user}\` ya estaba en la whitelist.`);
        }

        if (subcommand === 'unwhitelist') {
            const user = interaction.options.getString('usuario');
            config.whitelist = config.whitelist.filter(u => u !== user);
            saveConfig();
            return interaction.reply(`🗑️ \`${user}\` removido de la whitelist.`);
        }
    }
};

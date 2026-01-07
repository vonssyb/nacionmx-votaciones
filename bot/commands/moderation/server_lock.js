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
            sub.setName('mensaje')
                .setDescription('📢 Enviar mensaje global al servidor')
                .addStringOption(opt => opt.setName('texto').setDescription('Mensaje').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('👢 Expulsar jugador')
                .addStringOption(opt => opt.setName('usuario').setDescription('Nombre exacto o :ID').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('ban')
                .setDescription('🚫 Banear jugador del servidor')
                .addStringOption(opt => opt.setName('usuario').setDescription('Nombre exacto o :ID').setRequired(true))
                .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(true))),

    async execute(interaction, client) {
        // Defer due to potential API delays
        // await interaction.deferReply();

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
            return interaction.editReply('🔒 **SERVIDOR CERRADO**. Se expulsará automáticamente a quien entre (excepto whitelist).');
        }

        if (subcommand === 'unlock') {
            config.locked = false;
            saveConfig();
            if (client.erlcPendingKicks) client.erlcPendingKicks.clear();
            return interaction.editReply('🔓 **SERVIDOR ABIERTO**. Todos pueden entrar.');
        }

        if (subcommand === 'whitelist') {
            const user = interaction.options.getString('usuario');
            if (!config.whitelist.includes(user)) {
                config.whitelist.push(user);
                saveConfig();
                return interaction.editReply(`✅ \`${user}\` añadido a la whitelist.`);
            }
            return interaction.editReply(`⚠️ \`${user}\` ya estaba en la whitelist.`);
        }

        if (subcommand === 'unwhitelist') {
            const user = interaction.options.getString('usuario');
            config.whitelist = config.whitelist.filter(u => u !== user);
            saveConfig();
            return interaction.editReply(`🗑️ \`${user}\` removido de la whitelist.`);
        }

        if (subcommand === 'mensaje') {
            const msg = interaction.options.getString('texto');
            const success = await client.services.erlc.runCommand(`:m ${msg}`);
            return interaction.editReply(success ? `📢 Mensaje enviado: "${msg}"` : '❌ Error enviando mensaje.');
        }

        if (subcommand === 'kick') {
            const user = interaction.options.getString('usuario');
            const reason = interaction.options.getString('razon');
            const success = await client.services.erlc.runCommand(`:kick ${user} ${reason}`);
            return interaction.editReply(success ? `👢 **${user}** expulsado por: ${reason}` : '❌ Error al expulsar (¿Usuario no encontrado?).');
        }

        if (subcommand === 'ban') {
            const user = interaction.options.getString('usuario');
            const reason = interaction.options.getString('razon');
            const success = await client.services.erlc.runCommand(`:ban ${user} ${reason}`);
            return interaction.editReply(success ? `🚫 **${user}** baneado por: ${reason}` : '❌ Error al banear.');
        }
    }
};

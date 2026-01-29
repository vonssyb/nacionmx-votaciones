const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('🔄 Recargar comandos del bot (Dev only)')
        .addStringOption(option =>
            option.setName('comando')
                .setDescription('Comando específico a recargar (opcional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const commandName = interaction.options.getString('comando');

        try {
            if (commandName) {
                // Reload specific command
                const command = client.commands.get(commandName);

                if (!command) {
                    return interaction.editReply(`❌ Comando \`${commandName}\` no encontrado.`);
                }

                // Find the command file
                const commandFolders = ['moderation', 'utils', 'economy', 'business', 'games', 'gov', 'owner'];
                let reloaded = false;

                for (const folder of commandFolders) {
                    const folderPath = path.join(__dirname, '..', 'commands', folder);
                    if (!fs.existsSync(folderPath)) continue;

                    const commandPath = path.join(folderPath, `${commandName}.js`);

                    if (fs.existsSync(commandPath)) {
                        delete require.cache[require.resolve(commandPath)];
                        const newCommand = require(commandPath);
                        client.commands.set(newCommand.data.name, newCommand);
                        reloaded = true;
                        await interaction.editReply(`✅ Comando \`${commandName}\` recargado exitosamente.`);
                        break;
                    }
                }

                if (!reloaded) {
                    return interaction.editReply(`❌ No se encontró el archivo del comando \`${commandName}\`.`);
                }

            } else {
                // Reload all commands
                client.commands.clear();
                let count = 0;

                const commandFolders = ['moderation', 'utils', 'economy', 'business', 'games', 'gov', 'owner'];

                for (const folder of commandFolders) {
                    const folderPath = path.join(__dirname, '..', 'commands', folder);
                    if (!fs.existsSync(folderPath)) continue;

                    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                    for (const file of commandFiles) {
                        const filePath = path.join(folderPath, file);
                        try {
                            delete require.cache[require.resolve(filePath)];
                            const command = require(filePath);
                            if (command.data) {
                                client.commands.set(command.data.name, command);
                                count++;
                            }
                        } catch (error) {
                            console.error(`Error reloading ${folder}/${file}:`, error);
                        }
                    }
                }

                await interaction.editReply(`✅ Recargados **${count}** comandos exitosamente.\n\n⚠️ **Nota:** Para ver cambios en Discord, ejecuta:\n\`\`\`\nnode deploy-commands-local.js\n\`\`\``);
            }

        } catch (error) {
            console.error('[reload] Error:', error);
            await interaction.editReply(`❌ Error recargando comandos: ${error.message}`);
        }
    }
};

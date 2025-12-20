/**
 * Command Registry - Auto-load and manage commands
 * Fase 5, Item #17: Modular Commands
 */

const fs = require('fs');
const path = require('path');
const logger = require('../services/Logger');

class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.cooldowns = new Map();
    }

    /**
     * Load all commands from commands directory
     */
    async loadCommands() {
        const commandsPath = path.join(__dirname, '../commands');

        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            logger.warn('Commands directory created');
            return;
        }

        const commandFiles = fs.readdirSync(commandsPath)
            .filter(file => file.endsWith('.js') && !file.startsWith('_'));

        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    this.commands.set(command.data.name, command);
                    logger.info(`Loaded command: ${command.data.name}`);
                } else {
                    logger.warn(`Invalid command structure in ${file}`);
                }
            } catch (error) {
                logger.errorWithContext(`Error loading command ${file}`, error);
            }
        }

        logger.info(`Loaded ${this.commands.size} commands`);
    }

    /**
     * Get command by name
     */
    getCommand(name) {
        return this.commands.get(name);
    }

    /**
     * Execute command with cooldown check
     */
    async executeCommand(interaction, context) {
        const command = this.getCommand(interaction.commandName);

        if (!command) {
            return interaction.reply({
                content: 'Comando no encontrado.',
                ephemeral: true
            });
        }

        // Permission check
        if (command.checkPermissions) {
            const hasPermission = await command.checkPermissions(interaction);
            if (!hasPermission) {
                return interaction.reply({
                    content: '❌ No tienes permiso para usar este comando.',
                    ephemeral: true
                });
            }
        }

        // Cooldown check
        if (command.cooldown) {
            const cooldownKey = `${interaction.user.id}-${command.data.name}`;
            const now = Date.now();
            const cooldownAmount = command.cooldown * 1000;

            if (this.cooldowns.has(cooldownKey)) {
                const expirationTime = this.cooldowns.get(cooldownKey) + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
                    return interaction.reply({
                        content: `⏱️ Espera ${timeLeft}s antes de usar este comando nuevamente.`,
                        ephemeral: true
                    });
                }
            }

            this.cooldowns.set(cooldownKey, now);
            setTimeout(() => this.cooldowns.delete(cooldownKey), cooldownAmount);
        }

        // Execute command
        try {
            await command.execute(interaction, context);
        } catch (error) {
            logger.errorWithContext('Error executing command', error, {
                command: command.data.name,
                user: interaction.user.id
            });

            const reply = {
                content: '❌ Hubo un error ejecutando este comando.',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    /**
     * Get all commands for registration
     */
    getCommandsForRegistration() {
        return Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
    }

    /**
     * Reload a specific command (hot reload)
     */
    reloadCommand(commandName) {
        const command = this.commands.get(commandName);
        if (!command) {
            throw new Error(`Command ${commandName} not found`);
        }

        const commandPath = path.join(__dirname, '../commands', `${commandName}.js`);
        delete require.cache[require.resolve(commandPath)];

        const newCommand = require(commandPath);
        this.commands.set(commandName, newCommand);

        logger.info(`Reloaded command: ${commandName}`);
        return newCommand;
    }
}

module.exports = CommandRegistry;

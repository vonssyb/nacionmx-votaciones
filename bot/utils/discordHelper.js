const logger = require('../services/Logger');

async function safeDefer(interaction, options = {}) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: options.ephemeral || false });
            // PATCH: Prevent double defer
            interaction.deferReply = async () => { };
            return true;
        }
        return true; // Already deferred/replied is considered "safe"
    } catch (e) {
        if (e.code === 10062 || e.message === 'Unknown interaction') {
            // Silently ignore "Unknown interaction" (Race condition or Timeout)
            return false;
        }
        logger.error(`Defer failed for ${interaction.commandName || 'component'}`, { error: e.message });
        return false;
    }
}

module.exports = { safeDefer };

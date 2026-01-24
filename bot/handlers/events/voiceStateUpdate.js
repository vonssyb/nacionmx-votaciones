const logger = require('../../services/Logger');
const { getVoiceConnection } = require('@discordjs/voice');

// Static Map to hold timers (Module Level State)
const vcDisconnectTimers = new Map();

module.exports = async (client, oldState, newState, supabase) => {
    // We only care if the bot is involved or if it affects the bot's channel
    const botId = client.user.id;

    // Check if I am connected to THIS guild
    const me = oldState.guild.members.me;
    if (!me || !me.voice || !me.voice.channelId) return;

    const botChannelId = me.voice.channelId;
    const botChannel = me.voice.channel;

    // Check if the event happened in the Bot's channel (User left/joined bot's channel)
    // OR if the bot itself moved
    if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) {
        // Event is irrelevant to bot's current channel
        return;
    }

    if (!botChannel) return;

    // Check if the channel is now empty (excluding bots)
    const humans = botChannel.members.filter(m => !m.user.bot);

    if (humans.size === 0) {
        // Channel is empty (only bots or just me)
        if (!vcDisconnectTimers.has(botChannel.id)) {
            logger.info(`Voice channel empty, disconnecting in 20s`, { channel: botChannel.name });
            const timeout = setTimeout(() => {
                // Re-check logic inside timeout
                if (me.voice.channelId === botChannel.id) { // Still in same channel?
                    const currentHumans = botChannel.members.filter(m => !m.user.bot);
                    if (currentHumans.size === 0) {
                        logger.info(`Disconnecting from voice channel due to inactivity`, { channel: botChannel.name });
                        const connection = getVoiceConnection(oldState.guild.id);
                        if (connection) connection.destroy();
                    }
                }
                vcDisconnectTimers.delete(botChannel.id);
            }, 20000); // 20 seconds
            vcDisconnectTimers.set(botChannel.id, timeout);
        }
    } else {
        // Channel is not empty, cancel any pending timer
        if (vcDisconnectTimers.has(botChannel.id)) {
            logger.info(`User joined voice channel, cancelling disconnect`, { channel: botChannel.name });
            clearTimeout(vcDisconnectTimers.get(botChannel.id));
            vcDisconnectTimers.delete(botChannel.id);
        }
    }
};

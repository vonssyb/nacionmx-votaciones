const { AttachmentBuilder } = require('discord.js');
const logger = require('../../services/Logger');
const ImageGenerator = require('../../utils/ImageGenerator');
const { CHANNELS, GUILDS } = require('../../config/constants');

module.exports = async (client, member, supabase) => {
    const MAIN_GUILDS = [GUILDS.MAIN, GUILDS.STAFF];
    if (!MAIN_GUILDS.includes(member.guild.id)) return;

    try {
        let welcomeChannelId, message;

        if (member.guild.id === GUILDS.MAIN) {
            // ORIGINAL SERVER CONFIG
            welcomeChannelId = CHANNELS.WELCOME_ORIGINAL;
            const VERIFY_CHANNEL_ID = CHANNELS.VERIFY;
            const DNI_CHANNEL_ID = CHANNELS.DNI;
            message = `<@${member.user.id}> **bienvenido al servidor** para verificarse usa el comando \`/verificar\` en <#${VERIFY_CHANNEL_ID}> y también crea tu dni con el comando \`/dni crear\` en el canal de <#${DNI_CHANNEL_ID}> **¡Bienvenido!**`;
        } else if (member.guild.id === GUILDS.STAFF) {
            // NEW MAIN SERVER CONFIG
            welcomeChannelId = CHANNELS.WELCOME_NEW;
            message = `<@${member.user.id}> **¡Bienvenido al servidor!** Nos alegra tenerte aquí. **¡Disfruta tu estancia!**`;

            // AUTO-DISCOVERY FALLBACK
            try {
                // If channel is invalid, try finding one named 'bienvenida'
                const channelCheck = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
                if (!channelCheck) {
                    const channels = await member.guild.channels.fetch();
                    const found = channels.find(ch => ch.type === 0 && ch.name.toLowerCase().includes('bienvenida'));
                    if (found) welcomeChannelId = found.id;
                }
            } catch (e) { /* ignore */ }
        }

        const welcomeChannel = await client.channels.fetch(welcomeChannelId).catch(() => null);
        if (!welcomeChannel) return;

        // Generate Luxury Image
        const buffer = await ImageGenerator.generateWelcome(member);
        const attachment = new AttachmentBuilder(buffer, { name: `bienvenida_${member.user.id}.png` });

        await welcomeChannel.send({
            content: message,
            files: [attachment]
        });

    } catch (err) {
        logger.errorWithContext('Welcome system error', err, { module: 'MOD' });
    }
};

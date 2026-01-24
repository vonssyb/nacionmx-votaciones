const { EmbedBuilder } = require('discord.js');
const logger = require('../../services/Logger');
const { CHANNELS, GUILDS } = require('../../config/constants');

module.exports = async (client, oldMessage, newMessage, supabase) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    const MAIN_GUILDS = [GUILDS.MAIN, GUILDS.STAFF];
    if (!MAIN_GUILDS.includes(oldMessage.guild.id)) return; // ONLY LOG MAIN SERVERS
    if (oldMessage.content === newMessage.content) return; // Ignore embed updates

    try {
        const logChannel = await client.channels.fetch(CHANNELS.LOGS_GENERAL).catch(() => null);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle(`✏️ Mensaje Editado`)
            .setColor('#FFA500')
            .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
            .setDescription(`[Ir al mensaje](${newMessage.url})`)
            .addFields(
                { name: 'Autor', value: `<@${oldMessage.author.id}>`, inline: true },
                { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
                { name: 'Antes', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*(Vacío)*' },
                { name: 'Después', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*(Vacío)*' }
            )
            .setFooter({ text: `ID: ${newMessage.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });

    } catch (err) {
        logger.errorWithContext('Error logging message update', err, { module: 'MOD' });
    }
};

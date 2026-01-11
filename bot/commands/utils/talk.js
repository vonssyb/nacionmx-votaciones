const { SlashCommandBuilder } = require('discord.js');
const voiceConfig = require('../../config/erlcVoiceChannels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('talk')
        .setDescription('🗣️ Enviar un mensaje de voz (TTS) a tu canal actual')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('📝 El mensaje que deseas decir')
                .setRequired(true)),

    async execute(interaction, client) {
        const message = interaction.options.getString('mensaje');
        const member = interaction.member;

        if (!member.voice.channelId) {
            return interaction.reply({ content: '❌ Debes estar en un canal de voz para usar este comando.', ephemeral: true });
        }

        const channelId = member.voice.channelId;
        const channelInfo = voiceConfig.getChannelInfo(channelId);

        // Whitelist check
        if (!channelInfo) {
            return interaction.reply({
                content: '❌ No se permite el uso de TTS en este canal.',
                ephemeral: true
            });
        }

        if (channelInfo.noTTS) {
            return interaction.reply({
                content: `❌ El canal **${channelInfo.name}** tiene el TTS desactivado.`,
                ephemeral: true
            });
        }

        try {
            // Echo to interaction so user knows it went through
            await interaction.reply({
                content: `🗣️ Diciendo: "${message}"`,
                ephemeral: true
            });

            // Dispatch to Swarm
            // We assume the moderation bot client has accessibility to the swarm service
            // Based on index_unified.js, the moderation bot client is where services are attached.
            const swarmService = client.services?.swarm;

            if (swarmService) {
                await swarmService.speak(member.guild.id, channelId, `${member.displayName} dice: ${message}`);
                console.log(`[Slash Command] 🗣️ /talk: ${member.user.tag} said "${message}" in ${channelInfo.name}`);
            } else {
                console.warn('[Slash Command] /talk: Swarm Service not found via client.services.swarm');
                // Fallback attempt: if attached directly to client
                if (client.swarmService) {
                    await client.swarmService.speak(member.guild.id, channelId, `${member.displayName} dice: ${message}`);
                } else {
                    throw new Error('Servicio de voz no disponible.');
                }
            }

        } catch (error) {
            console.error(`[Slash Command] /talk Error:`, error.message);
            await interaction.followUp({
                content: `❌ Error al reproducir el mensaje: ${error.message}`,
                ephemeral: true
            });
        }
    }
};

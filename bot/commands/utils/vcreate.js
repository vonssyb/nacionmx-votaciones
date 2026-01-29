const { SlashCommandBuilder, ChannelType } = require('discord.js');
const VoiceEmbeds = require('../../utils/voiceEmbeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vcreate')
        .setDescription('🎨 Crear un canal de voz temporal personalizado')
        .addStringOption(option =>
            option.setName('nombre')
                .setDescription('📝 Nombre del canal temporal')
                .setRequired(true)
                .setMaxLength(50))
        .addIntegerOption(option =>
            option.setName('limite_usuarios')
                .setDescription('👥 Límite de usuarios (0 = sin límite)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(99))
        .addIntegerOption(option =>
            option.setName('bitrate')
                .setDescription('🔊 Bitrate en kbps (64-384)')
                .setRequired(false)
                .setMinValue(64)
                .setMaxValue(384))
        .addIntegerOption(option =>
            option.setName('duracion_minutos')
                .setDescription('⏱️ Auto-eliminar después de X minutos (opcional)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(1440)),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const member = interaction.member;
        const channelName = interaction.options.getString('nombre');
        const userLimit = interaction.options.getInteger('limite_usuarios') || 0;
        const bitrate = (interaction.options.getInteger('bitrate') || 64) * 1000; // Convertir a bps
        const durationMinutes = interaction.options.getInteger('duracion_minutos');

        // Verificar que el usuario esté en un canal de voz
        if (!member.voice.channelId) {
            return interaction.editReply({
                content: '❌ Debes estar en un canal de voz para crear un canal temporal.\n💡 Únete a cualquier canal y vuelve a intentarlo.'
            });
        }

        // Verificar que existe el tempChannelManager
        if (!client.tempChannelManager) {
            console.error('[VCreate Command] tempChannelManager no está disponible');
            return interaction.editReply({
                content: '❌ El sistema de canales temporales no está disponible actualmente.'
            });
        }

        try {
            // Crear el canal temporal
            const { channel, data } = await client.tempChannelManager.createTemporaryChannel(
                interaction.guild,
                member,
                {
                    name: channelName,
                    userLimit: userLimit,
                    bitrate: bitrate,
                    durationMinutes: durationMinutes,
                    commandName: 'vcreate'
                }
            );

            // Mover al usuario al canal recién creado
            await member.voice.setChannel(channel.id);

            // Enviar embed de confirmación
            const embed = VoiceEmbeds.createChannelCreatedEmbed(channel, member);

            let messageContent = `🎉 Tu canal temporal **${channel.name}** ha sido creado!`;
            if (durationMinutes) {
                messageContent += `\n⏰ Se auto-eliminará en **${durationMinutes}** minutos`;
            } else {
                messageContent += `\n♻️ Se auto-eliminará cuando quede vacío`;
            }

            await interaction.editReply({
                content: messageContent,
                embeds: [embed]
            });

            console.log(`[VCreate Command] Canal temporal creado: ${channel.name} (${channel.id}) por ${member.user.tag}`);
        } catch (error) {
            console.error('[VCreate Command] Error:', error);

            let errorMessage = '❌ Error al crear el canal temporal';
            if (error.message.includes('máximo')) {
                errorMessage = `❌ ${error.message}`;
            } else if (error.message.includes('permisos')) {
                errorMessage = '❌ No tengo permisos suficientes para crear canales de voz';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};

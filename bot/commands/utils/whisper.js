const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const VoiceEmbeds = require('../../utils/voiceEmbeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whisper')
        .setDescription('🤫 Susurrar a otro usuario (mover a canal privado temporal)')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('👤 Usuario con quien quieres hablar en privado')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duracion')
                .setDescription('⏱️ Duración del whisper en segundos (default: 30)')
                .setRequired(false)
                .setMinValue(10)
                .setMaxValue(300)),

    async execute(interaction, client) {
        const member = interaction.member;
        const targetUser = interaction.options.getUser('usuario');
        const duration = interaction.options.getInteger('duracion') || 30;

        // Verificar que el usuario ejecutor esté en un canal de voz
        if (!member.voice.channelId) {
            return interaction.editReply({
                content: '❌ Debes estar en un canal de voz para usar whisper.'
            });
        }

        // Obtener el target member
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        if (!targetMember) {
            return interaction.editReply({
                content: '❌ No se pudo encontrar al usuario especificado.'
            });
        }

        // Verificar que el target esté en un canal de voz
        if (!targetMember.voice.channelId) {
            return interaction.editReply({
                content: `❌ ${targetUser.username} no está en un canal de voz actualmente.`
            });
        }

        // No permitir whisper a uno mismo
        if (member.id === targetUser.id) {
            return interaction.editReply({
                content: '❌ No puedes hacer whisper a ti mismo.'
            });
        }

        // Guardar los canales originales
        const fromOriginalChannel = member.voice.channel;
        const toOriginalChannel = targetMember.voice.channel;

        try {
            // Crear canal temporal de whisper
            const whisperChannelName = `🤫 Whisper: ${member.user.username} ↔ ${targetUser.username}`;

            const whisperChannel = await interaction.guild.channels.create({
                name: whisperChannelName,
                type: ChannelType.GuildVoice,
                parent: fromOriginalChannel.parentId, // Misma categoría
                userLimit: 2,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: targetUser.id,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel],
                    },
                ],
            });

            // Mover ambos usuarios al canal de whisper
            await member.voice.setChannel(whisperChannel.id);
            await targetMember.voice.setChannel(whisperChannel.id);

            // Enviar confirmación
            const embed = VoiceEmbeds.createWhisperEmbed(member.user, targetUser);

            await interaction.editReply({
                content: `🤫 Whisper iniciado con **${targetUser.username}**\n⏱️ Duración: **${duration}** segundos`,
                embeds: [embed]
            });

            // Notificar al usuario objetivo
            try {
                await targetUser.send({
                    content: `🤫 **${member.user.username}** ha iniciado un whisper contigo en **${interaction.guild.name}**\n⏱️ Duración: ${duration} segundos`
                });
            } catch (error) {
                // El usuario tiene DMs desactivados
                console.log(`[Whisper] No se pudo notificar a ${targetUser.tag} por DM`);
            }

            // Registrar whisper en la base de datos
            if (client.supabase) {
                const { error: logError } = await client.supabase
                    .from('whisper_logs')
                    .insert({
                        from_user_id: member.id,
                        to_user_id: targetUser.id,
                        duration_seconds: duration,
                        temp_channel_id: whisperChannel.id,
                        was_successful: true,
                        metadata: {
                            guild_id: interaction.guild.id,
                            from_channel: fromOriginalChannel.name,
                            to_channel: toOriginalChannel.name
                        }
                    });

                if (logError) {
                    console.error('[Whisper] Error registrando whisper:', logError);
                }
            }

            console.log(`[Whisper Command] ${member.user.tag} inició whisper con ${targetUser.tag} por ${duration}s`);

            // Programar retorno y eliminación del canal
            setTimeout(async () => {
                try {
                    // Intentar mover usuarios de vuelta
                    const memberStillInWhisper = interaction.guild.members.cache.get(member.id);
                    const targetStillInWhisper = interaction.guild.members.cache.get(targetUser.id);

                    if (memberStillInWhisper?.voice.channelId === whisperChannel.id) {
                        await memberStillInWhisper.voice.setChannel(fromOriginalChannel.id).catch(() => { });
                    }

                    if (targetStillInWhisper?.voice.channelId === whisperChannel.id) {
                        await targetStillInWhisper.voice.setChannel(toOriginalChannel.id).catch(() => { });
                    }

                    // Eliminar el canal de whisper
                    await whisperChannel.delete('Whisper finalizado');

                    console.log(`[Whisper Command] Whisper finalizado, canal eliminado`);
                } catch (error) {
                    console.error('[Whisper Command] Error finalizando whisper:', error);
                }
            }, duration * 1000);

        } catch (error) {
            console.error('[Whisper Command] Error:', error);

            await interaction.editReply({
                content: '❌ Error al crear el canal de whisper.\n💡 Asegúrate de que tengo permisos para crear canales.'
            });
        }
    }
};

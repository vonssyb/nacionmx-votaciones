const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const voiceConfig = require('../../config/erlcVoiceChannels');
const VoiceEmbeds = require('../../utils/voiceEmbeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vc')
        .setDescription('🎙️ Unirse a un canal de voz mediante un alias')
        .addStringOption(option =>
            option.setName('alias')
                .setDescription('📍 Alias del canal (ej: p1, b1, m1)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('arrastrar_usuario')
                .setDescription('👥 Arrastrar a otro usuario contigo (requiere permisos)')
                .setRequired(false)),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const abbreviation = interaction.options.getString('alias').toLowerCase();
        const targetUser = interaction.options.getUser('arrastrar_usuario');
        const member = interaction.member;

        if (!member.voice.channelId) {
            return interaction.editReply({
                content: '❌ Debes estar en un canal de voz para usar este comando.'
            });
        }

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) {
            return interaction.editReply({
                content: `❌ El alias \`${abbreviation}\` no fue encontrado.\n💡 Usa uno de los aliases disponibles: p1, p2, pg, c1, etc.`
            });
        }

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        const JUNTA_DIRECTIVA_ROLE = '1412882245735420006';
        const isJD = member.roles.cache.has(JUNTA_DIRECTIVA_ROLE);

        // Verificar permisos avanzados usando el manager
        if (client.voicePermissionManager) {
            const accessCheck = await client.voicePermissionManager.canAccessChannel(member, targetId);
            if (!accessCheck.allowed && !isJD) {
                return interaction.editReply({
                    content: `⛔ ${accessCheck.reason}`
                });
            }
        } else {
            // Fallback a verificación básica
            if (channelInfo && channelInfo.requiredRole && !isJD) {
                const allowedRoles = voiceConfig.ROLES[channelInfo.requiredRole];
                if (Array.isArray(allowedRoles)) {
                    if (!member.roles.cache.some(role => allowedRoles.includes(role.id))) {
                        return interaction.editReply({
                            content: `⛔ No tienes permisos para acceder al canal **${channelInfo.name || abbreviation}**.`
                        });
                    }
                } else if (allowedRoles && !member.roles.cache.has(allowedRoles)) {
                    return interaction.editReply({
                        content: `⛔ No tienes permisos para acceder al canal **${channelInfo.name || abbreviation}**.`
                    });
                }
            }
        }

        try {
            const channel = await client.channels.fetch(targetId);
            const membersInChannel = channel.members.size;

            // Mover al usuario principal
            await member.voice.setChannel(targetId);

            let responseText = `✅ Has sido movido a **${channelInfo?.name || abbreviation}**`;

            // Mostrar cuántos usuarios hay en el canal
            if (membersInChannel > 0) {
                responseText += `\n👥 Hay **${membersInChannel + 1}** usuario(s) en el canal`;
            }

            // Si se especificó un usuario para arrastrar
            if (targetUser) {
                const targetMember = interaction.guild.members.cache.get(targetUser.id);

                if (!targetMember) {
                    responseText += `\n⚠️ No se pudo encontrar al usuario ${targetUser.username}`;
                } else if (!targetMember.voice.channelId) {
                    responseText += `\n⚠️ ${targetUser.username} no está en un canal de voz`;
                } else {
                    // Verificar si tiene permisos para mover usuarios
                    const canMove = member.permissions.has(PermissionFlagsBits.MoveMembers) || isJD;

                    if (!canMove) {
                        responseText += `\n⚠️ No tienes permisos para mover a otros usuarios`;
                    } else {
                        try {
                            await targetMember.voice.setChannel(targetId);
                            responseText += `\n➕ ${targetUser.username} ha sido arrastrado al canal`;
                        } catch (error) {
                            console.error('[VC Command] Error moviendo usuario:', error);
                            responseText += `\n⚠️ No se pudo mover a ${targetUser.username}`;
                        }
                    }
                }
            }

            await interaction.editReply({
                content: responseText
            });

            console.log(`[Slash Command] 🎙️ /vc: ${member.user.tag} moved to ${channelInfo?.name || abbreviation}`);
        } catch (error) {
            console.error(`[Slash Command] /vc Error:`, error.message);
            await interaction.editReply({
                content: `❌ Error al moverte: ${error.message}`
            });
        }
    }
};

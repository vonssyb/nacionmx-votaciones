/**
 * @module handlers/moderation/voice/manager
 * @description Maneja el control de canales de voz
 * 
 * Este módulo gestiona:
 * - Botones de control de voz (vc_*)
 * - Permisos de canal
 * - Invitaciones y expulsiones
 * - Bloqueo/desbloqueo de canales
 * - Estadísticas de voz
 */

const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const VoiceEmbeds = require('../../../utils/voiceEmbeds');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class VoiceManager {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
    }

    /**
     * Maneja las interacciones de botones de voz
     * @param {Interaction} interaction - Discord button interaction
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction) {
        try {
            const { customId, member } = interaction;

            // Solo procesar botones de voz
            if (!customId.startsWith('vc_')) {
                return false;
            }

            // Verificar que el usuario esté en un canal de voz
            if (!member.voice.channelId) {
                await interaction.reply({
                    content: '❌ Debes estar en un canal de voz para usar este botón.',
                    ephemeral: true
                });
                return true;
            }

            const channel = member.voice.channel;

            logger.info('Processing voice control button', { customId, userId: member.id, channelId: channel.id });

            switch (customId) {
                case 'vc_refresh':
                    await this._handleRefresh(interaction, channel);
                    break;

                case 'vc_invite':
                    await this._handleInvite(interaction, channel);
                    break;

                case 'vc_stats':
                    await this._handleStats(interaction);
                    break;

                case 'vc_kick_user':
                    await this._handleKickUser(interaction, channel);
                    break;

                case 'vc_lock':
                    await this._handleLock(interaction, channel);
                    break;

                case 'vc_manage':
                    await this._handleManage(interaction, channel);
                    break;

                default:
                    logger.warn('Unknown voice control button', { customId });
                    return false;
            }

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'voice_control',
                customId: interaction.customId
            });
            return true;
        }
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    /**
     * Refrescar el panel de control
     * @private
     */
    async _handleRefresh(interaction, channel) {
        const member = interaction.member;

        // Verificar permisos
        let isOwner = false;
        let isModerator = false;

        if (this.client.tempChannelManager) {
            isOwner = await this.client.tempChannelManager.isChannelOwner(channel.id, member.id);
        }

        if (this.client.voicePermissionManager) {
            const modCheck = await this.client.voicePermissionManager.canModerateChannel(member, channel.id);
            isModerator = modCheck.allowed;
        } else {
            isModerator = member.permissions.has(PermissionFlagsBits.ManageChannels);
        }

        // Actualizar embed
        const embed = VoiceEmbeds.createControlPanel(channel, member);
        const components = VoiceEmbeds.createControlComponents(isOwner, isModerator);

        await interaction.update({
            embeds: [embed],
            components: components
        });

        logger.info('Voice control panel refreshed', { userId: member.id, channelId: channel.id });
    }

    /**
     * Invitar usuario al canal
     * @private
     */
    async _handleInvite(interaction, channel) {
        const guild = interaction.guild;
        const availableMembers = guild.members.cache
            .filter(m => !m.user.bot && m.voice.channelId !== channel.id)
            .first(25);

        if (availableMembers.length === 0) {
            await interaction.reply({
                content: '❌ No hay usuarios disponibles para invitar.',
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: `💡 Comparte este canal con tus amigos:\n🎵 **${channel.name}**\n📍 ID: \`${channel.id}\`\n\nPueden unirse usando \`/vc\` si tienen permisos, o puedes arrastrarlos si tienes permisos de moderación.`,
            ephemeral: true
        });

        logger.info('Voice invite info shown', { userId: interaction.user.id, channelId: channel.id });
    }

    /**
     * Mostrar estadísticas de voz del usuario
     * @private
     */
    async _handleStats(interaction) {
        const member = interaction.member;

        if (!this.client.voiceActivityHandler) {
            await interaction.reply({
                content: '❌ El sistema de estadísticas no está disponible.',
                ephemeral: true
            });
            return;
        }

        const stats = await this.client.voiceActivityHandler.getUserStats(member.id);

        if (!stats || stats.total_sessions === 0) {
            await interaction.reply({
                content: '📊 Aún no tienes actividad de voz registrada.',
                ephemeral: true
            });
            return;
        }

        const embed = VoiceEmbeds.createStatsEmbed(member.user, stats);

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });

        logger.info('Voice stats shown', { userId: member.id });
    }

    /**
     * Expulsar usuario del canal
     * @private
     */
    async _handleKickUser(interaction, channel) {
        const member = interaction.member;

        // Verificar permisos
        const canModerate = await this._canModerate(member, channel);

        if (!canModerate) {
            await interaction.reply({
                content: '❌ No tienes permisos para expulsar usuarios de este canal.',
                ephemeral: true
            });
            return;
        }

        // Mostrar select menu de usuarios
        const channelMembers = Array.from(channel.members.values()).filter(m => m.id !== member.id);

        if (channelMembers.length === 0) {
            await interaction.reply({
                content: '❌ No hay otros usuarios en el canal.',
                ephemeral: true
            });
            return;
        }

        const selectMenu = VoiceEmbeds.createUserSelectMenu(channelMembers, 'vc_select_kick_user');

        await interaction.reply({
            content: '👢 Selecciona el usuario a expulsar:',
            components: [selectMenu],
            ephemeral: true
        });
    }

    /**
     * Bloquear/desbloquear canal
     * @private
     */
    async _handleLock(interaction, channel) {
        const member = interaction.member;

        // Verificar permisos
        const canModerate = await this._canModerate(member, channel);

        if (!canModerate) {
            await interaction.reply({
                content: '❌ No tienes permisos para bloquear este canal.',
                ephemeral: true
            });
            return;
        }

        try {
            const everyoneRole = interaction.guild.roles.everyone;
            const currentPerms = channel.permissionOverwrites.cache.get(everyoneRole.id);
            const isLocked = currentPerms?.deny.has(PermissionFlagsBits.Connect);

            if (isLocked) {
                // Desbloquear
                await channel.permissionOverwrites.edit(everyoneRole, {
                    Connect: null
                });

                await interaction.reply({
                    content: '🔓 Canal desbloqueado. Ahora cualquiera puede unirse.',
                    ephemeral: true
                });

                logger.info('Voice channel unlocked', { userId: member.id, channelId: channel.id });
            } else {
                // Bloquear
                await channel.permissionOverwrites.edit(everyoneRole, {
                    Connect: false
                });

                await interaction.reply({
                    content: '🔒 Canal bloqueado. Solo usuarios con permisos específicos pueden unirse.',
                    ephemeral: true
                });

                logger.info('Voice channel locked', { userId: member.id, channelId: channel.id });
            }

            // Actualizar en DB si es canal temporal
            if (this.client.voicePermissionManager) {
                await this.client.voicePermissionManager.toggleChannelLock(channel.id, !isLocked, member.id);
            }
        } catch (error) {
            logger.errorWithContext('Error locking/unlocking channel', error, {
                userId: member.id,
                channelId: channel.id
            });

            await interaction.reply({
                content: '❌ Error al bloquear/desbloquear el canal.',
                ephemeral: true
            });
        }
    }

    /**
     * Abrir panel de gestión avanzada
     * @private
     */
    async _handleManage(interaction, channel) {
        const member = interaction.member;

        // Verificar permisos
        const canModerate = await this._canModerate(member, channel);

        if (!canModerate) {
            await interaction.reply({
                content: '❌ No tienes permisos para gestionar este canal.',
                ephemeral: true
            });
            return;
        }

        // Crear embed de gestión
        const embed = VoiceEmbeds.createChannelInfoEmbed(channel);

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('vc_change_bitrate')
                    .setLabel('Cambiar Bitrate')
                    .setEmoji('🔊')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('vc_change_limit')
                    .setLabel('Límite de Usuarios')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('vc_change_name')
                    .setLabel('Cambiar Nombre')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('vc_transfer_owner')
                    .setLabel('Transferir Ownership')
                    .setEmoji('👑')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({
            content: '⚙️ **Panel de Gestión del Canal**',
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true
        });

        logger.info('Voice management panel shown', { userId: member.id, channelId: channel.id });
    }

    /**
     * Verifica si un usuario puede moderar un canal
     * @private
     */
    async _canModerate(member, channel) {
        if (this.client.voicePermissionManager) {
            const modCheck = await this.client.voicePermissionManager.canModerateChannel(member, channel.id);
            return modCheck.allowed;
        }

        return member.permissions.has(PermissionFlagsBits.ManageChannels);
    }
}

module.exports = VoiceManager;

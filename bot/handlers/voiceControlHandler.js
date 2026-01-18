const VoiceEmbeds = require('../utils/voiceEmbeds');
const { PermissionFlagsBits, ChannelType } = require('discord.js');

/**
 * Handler para interacciones de botones del sistema de voz
 */
async function handleVoiceControlButtons(interaction, client, supabase) {
    const { customId, member } = interaction;

    // Solo procesar botones de voz
    if (!customId.startsWith('vc_')) {
        return false; // No manejado
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

    try {
        switch (customId) {
            case 'vc_refresh':
                await handleRefresh(interaction, channel, client);
                break;

            case 'vc_invite':
                await handleInvite(interaction, channel, client);
                break;

            case 'vc_stats':
                await handleStats(interaction, client);
                break;

            case 'vc_kick_user':
                await handleKickUser(interaction, channel, client);
                break;

            case 'vc_lock':
                await handleLock(interaction, channel, client);
                break;

            case 'vc_manage':
                await handleManage(interaction, channel, client);
                break;

            default:
                // Otros botones de voz que no manejamos aquí
                return false;
        }

        return true; // Manejado
    } catch (error) {
        console.error('[VoiceControlButtons] Error:', error);
        await interaction.reply({
            content: '❌ Error al procesar la acción.',
            ephemeral: true
        }).catch(() => { });
        return true;
    }
}

/**
 * Refrescar el panel de control
 */
async function handleRefresh(interaction, channel, client) {
    const member = interaction.member;

    // Verificar permisos
    let isOwner = false;
    let isModerator = false;

    if (client.tempChannelManager) {
        isOwner = await client.tempChannelManager.isChannelOwner(channel.id, member.id);
    }

    if (client.voicePermissionManager) {
        const modCheck = await client.voicePermissionManager.canModerateChannel(member, channel.id);
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
}

/**
 * Invitar usuario al canal
 */
async function handleInvite(interaction, channel, client) {
    const member = interaction.member;

    // Obtener todos los miembros del servidor que NO están en el canal
    const guild = interaction.guild;
    const availableMembers = guild.members.cache
        .filter(m => !m.user.bot && m.voice.channelId !== channel.id)
        .first(25); // Máximo 25 para select menu

    if (availableMembers.length === 0) {
        await interaction.reply({
            content: '❌ No hay usuarios disponibles para invitar.',
            ephemeral: true
        });
        return;
    }

    // Crear invite link o mensaje
    await interaction.reply({
        content: `💡 Comparte este canal con tus amigos:\n🎵 **${channel.name}**\n📍 ID: \`${channel.id}\`\n\nPueden unirse usando \`/vc\` si tienen permisos, o puedes arrastrarlos si tienes permisos de moderación.`,
        ephemeral: true
    });
}

/**
 * Mostrar estadísticas rápidas
 */
async function handleStats(interaction, client) {
    const member = interaction.member;

    if (!client.voiceActivityHandler) {
        await interaction.reply({
            content: '❌ El sistema de estadísticas no está disponible.',
            ephemeral: true
        });
        return;
    }

    const stats = await client.voiceActivityHandler.getUserStats(member.id);

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
}

/**
 * Expulsar usuario del canal
 */
async function handleKickUser(interaction, channel, client) {
    const member = interaction.member;

    // Verificar permisos
    let canModerate = false;

    if (client.voicePermissionManager) {
        const modCheck = await client.voicePermissionManager.canModerateChannel(member, channel.id);
        canModerate = modCheck.allowed;
    } else {
        canModerate = member.permissions.has(PermissionFlagsBits.MoveMembers);
    }

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
 */
async function handleLock(interaction, channel, client) {
    const member = interaction.member;

    // Verificar permisos
    let canModerate = false;

    if (client.voicePermissionManager) {
        const modCheck = await client.voicePermissionManager.canModerateChannel(member, channel.id);
        canModerate = modCheck.allowed;
    } else {
        canModerate = member.permissions.has(PermissionFlagsBits.ManageChannels);
    }

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
        } else {
            // Bloquear
            await channel.permissionOverwrites.edit(everyoneRole, {
                Connect: false
            });

            await interaction.reply({
                content: '🔒 Canal bloqueado. Solo usuarios con permisos específicos pueden unirse.',
                ephemeral: true
            });
        }

        // Actualizar en DB si es canal temporal
        if (client.voicePermissionManager) {
            await client.voicePermissionManager.toggleChannelLock(channel.id, !isLocked, member.id);
        }
    } catch (error) {
        console.error('[VoiceControl] Error locking channel:', error);
        await interaction.reply({
            content: '❌ Error al bloquear/desbloquear el canal.',
            ephemeral: true
        });
    }
}

/**
 * Abrir panel de gestión avanzada
 */
async function handleManage(interaction, channel, client) {
    const member = interaction.member;

    // Verificar permisos
    let canModerate = false;

    if (client.voicePermissionManager) {
        const modCheck = await client.voicePermissionManager.canModerateChannel(member, channel.id);
        canModerate = modCheck.allowed;
    } else {
        canModerate = member.permissions.has(PermissionFlagsBits.ManageChannels);
    }

    if (!canModerate) {
        await interaction.reply({
            content: '❌ No tienes permisos para gestionar este canal.',
            ephemeral: true
        });
        return;
    }

    // Crear embed de gestión
    const embed = VoiceEmbeds.createChannelInfoEmbed(channel);

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
}

module.exports = { handleVoiceControlButtons };

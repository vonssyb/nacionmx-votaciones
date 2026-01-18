const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

/**
 * Sistema de Embeds para Voice Channels
 * Generador de embeds y componentes interactivos para el sistema de voz
 */
class VoiceEmbeds {
    /**
     * Embed de panel de control de canal
     */
    static createControlPanel(channel, member, stats = {}) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🎛️ Panel de Control - ${channel.name}`)
            .setDescription(`Controla y gestiona el canal de voz actual`)
            .addFields(
                {
                    name: '📊 Estadísticas',
                    value: `👥 Usuarios: **${channel.members.size}**\n` +
                        `🔊 Bitrate: **${channel.bitrate / 1000}kbps**\n` +
                        `👤 Límite: **${channel.userLimit || 'Sin límite'}**`,
                    inline: true
                },
                {
                    name: '⚙️ Configuración',
                    value: `📍 Región: **Automática**\n` +
                        `🎵 Calidad: **Alta**\n` +
                        `🔒 Estado: **${channel.permissionsFor(channel.guild.roles.everyone).has('Connect') ? 'Abierto' : 'Restringido'}**`,
                    inline: true
                }
            )
            .setFooter({ text: `ID: ${channel.id}` })
            .setTimestamp();

        // Mostrar miembros si hay pocos
        if (channel.members.size > 0 && channel.members.size <= 10) {
            const membersList = channel.members
                .map(m => `${m.voice.deaf ? '🔇' : m.voice.mute ? '🔴' : '🟢'} ${m.user.username}`)
                .join('\n');

            embed.addFields({
                name: '👥 Miembros en el Canal',
                value: membersList || 'Ninguno',
                inline: false
            });
        }

        return embed;
    }

    /**
     * Componentes de control del panel
     */
    static createControlComponents(isOwner = false, isModerator = false) {
        const components = [];

        // Fila 1: Controles básicos
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('vc_refresh')
                    .setLabel('Actualizar')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('vc_invite')
                    .setLabel('Invitar Usuario')
                    .setEmoji('➕')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('vc_stats')
                    .setLabel('Estadísticas')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Fila 2: Controles de moderación (solo para owners/moderadores)
        if (isOwner || isModerator) {
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('vc_kick_user')
                        .setLabel('Expulsar Usuario')
                        .setEmoji('👢')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('vc_lock')
                        .setLabel('Bloquear Canal')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('vc_manage')
                        .setLabel('Gestionar')
                        .setEmoji('⚙️')
                        .setStyle(ButtonStyle.Secondary)
                );

            components.push(row1, row2);
        } else {
            components.push(row1);
        }

        return components;
    }

    /**
     * Embed de creación de canal temporal
     */
    static createChannelCreatedEmbed(channel, owner) {
        return new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Canal Temporal Creado')
            .setDescription(`Tu canal de voz temporal ha sido creado exitosamente`)
            .addFields(
                { name: '📝 Nombre', value: channel.name, inline: true },
                { name: '👤 Owner', value: owner.user.username, inline: true },
                { name: '🆔 ID', value: channel.id, inline: true },
                {
                    name: '⚙️ Configuración',
                    value: `🔊 Bitrate: **${channel.bitrate / 1000}kbps**\n` +
                        `👥 Límite: **${channel.userLimit || 'Sin límite'}**`,
                    inline: false
                },
                {
                    name: '🎮 Controles',
                    value: '• Usa `/vcontrol` para gestionar el canal\n' +
                        '• El canal se eliminará automáticamente cuando quede vacío\n' +
                        '• Tienes permisos completos como owner',
                    inline: false
                }
            )
            .setFooter({ text: 'Canal temporal • Se auto-eliminará cuando esté vacío' })
            .setTimestamp();
    }

    /**
     * Embed de estadísticas de voz
     */
    static createStatsEmbed(user, stats) {
        const totalHours = Math.floor((stats.total_duration_seconds || 0) / 3600);
        const totalMinutes = Math.floor(((stats.total_duration_seconds || 0) % 3600) / 60);

        const avgMinutes = Math.floor((stats.avg_session_duration || 0) / 60);
        const longestHours = Math.floor((stats.longest_session || 0) / 3600);
        const longestMinutes = Math.floor(((stats.longest_session || 0) % 3600) / 60);

        return new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 Estadísticas de Voz - ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '⏱️ Tiempo Total',
                    value: `**${totalHours}h ${totalMinutes}m**`,
                    inline: true
                },
                {
                    name: '🎯 Sesiones',
                    value: `**${stats.total_sessions || 0}**`,
                    inline: true
                },
                {
                    name: '📈 Promedio',
                    value: `**${avgMinutes}m**`,
                    inline: true
                },
                {
                    name: '🏆 Sesión Más Larga',
                    value: `**${longestHours}h ${longestMinutes}m**`,
                    inline: true
                },
                {
                    name: '🎵 Canales Únicos',
                    value: `**${stats.unique_channels || 0}**`,
                    inline: true
                },
                {
                    name: '🕐 Última Actividad',
                    value: stats.last_voice_activity
                        ? `<t:${Math.floor(new Date(stats.last_voice_activity).getTime() / 1000)}:R>`
                        : 'Nunca',
                    inline: true
                }
            )
            .setFooter({ text: 'Estadísticas del sistema de voz' })
            .setTimestamp();
    }

    /**
     * Embed de whisper iniciado
     */
    static createWhisperEmbed(fromUser, toUser) {
        return new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🤫 Whisper Iniciado')
            .setDescription(`Whisper privado entre usuarios`)
            .addFields(
                { name: 'De', value: fromUser.username, inline: true },
                { name: 'Para', value: toUser.username, inline: true }
            )
            .setFooter({ text: 'Ambos serán movidos a un canal privado temporalmente' })
            .setTimestamp();
    }

    /**
     * Embed de error
     */
    static createErrorEmbed(error, description = '') {
        return new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('❌ Error')
            .setDescription(description || error.message || 'Ha ocurrido un error')
            .setFooter({ text: 'Sistema de Voice Channels' })
            .setTimestamp();
    }

    /**
     * Embed de éxito
     */
    static createSuccessEmbed(title, description) {
        return new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Embed de información de canal
     */
    static createChannelInfoEmbed(channel, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📻 ${channel.name}`)
            .addFields(
                {
                    name: '👥 Usuarios Conectados',
                    value: `**${channel.members.size}**`,
                    inline: true
                },
                {
                    name: '🔊 Bitrate',
                    value: `**${channel.bitrate / 1000}kbps**`,
                    inline: true
                },
                {
                    name: '👤 Límite',
                    value: `**${channel.userLimit || 'Sin límite'}**`,
                    inline: true
                }
            );

        if (additionalInfo.owner) {
            embed.addFields({
                name: '👑 Owner',
                value: `<@${additionalInfo.owner}>`,
                inline: true
            });
        }

        if (additionalInfo.temporary) {
            embed.setFooter({ text: 'Canal Temporal • Se auto-eliminará cuando esté vacío' });
        }

        return embed;
    }

    /**
     * Select menu para seleccionar usuario del canal
     */
    static createUserSelectMenu(channelMembers, customId = 'vc_select_user') {
        const options = channelMembers.map(member => ({
            label: member.user.username,
            value: member.id,
            description: `${member.voice.deaf ? 'Deafened' : member.voice.mute ? 'Muted' : 'Speaking'}`,
            emoji: member.voice.deaf ? '🔇' : member.voice.mute ? '🔴' : '🟢'
        }));

        // Limitar a 25 opciones (límite de Discord)
        const limitedOptions = options.slice(0, 25);

        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(customId)
                    .setPlaceholder('Selecciona un usuario')
                    .addOptions(limitedOptions)
            );
    }

    /**
     * Embed de lista de canales disponibles
     */
    static createChannelListEmbed(channels, title = 'Canales Disponibles') {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🎵 ${title}`)
            .setDescription('Canales de voz disponibles y su estado actual')
            .setTimestamp();

        // Agrupar canales por categoría (si es posible)
        const channelList = channels.map(ch => {
            const userCount = ch.members?.size || 0;
            const status = userCount > 0 ? `🟢 ${userCount} usuario${userCount > 1 ? 's' : ''}` : '⚪ Vacío';
            return `${ch.name} - ${status}`;
        }).join('\n');

        if (channelList) {
            embed.setDescription(channelList);
        } else {
            embed.setDescription('No hay canales disponibles');
        }

        return embed;
    }

    /**
     * Embed de proximity voice info
     */
    static createProximityInfoEmbed() {
        return new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📡 Proximity Voice')
            .setDescription('Sistema de voz por proximidad para roleplay')
            .addFields(
                {
                    name: '🎯 ¿Cómo funciona?',
                    value: 'Tu canal de voz cambia automáticamente según tu ubicación en el servidor ERLC',
                    inline: false
                },
                {
                    name: '📍 Zonas',
                    value: '• Comisaría\n• Hospital\n• Banco\n• Cárcel\n• Zonas públicas',
                    inline: true
                },
                {
                    name: '📻 Radios',
                    value: 'Usa las radios para comunicarte globalmente con tu departamento',
                    inline: true
                }
            )
            .setFooter({ text: 'Proximity Voice • Integrado con ERLC' })
            .setTimestamp();
    }
}

module.exports = VoiceEmbeds;

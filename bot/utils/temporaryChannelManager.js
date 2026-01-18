const { PermissionFlagsBits, ChannelType } = require('discord.js');

/**
 * Gestor de Canales Temporales de Voz
 * Maneja la creación, eliminación y gestión de canales temporales
 */
class TemporaryChannelManager {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.cleanupInterval = null;
        this.CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
        this.MAX_CHANNELS_PER_USER = 3;
        this.DEFAULT_CATEGORY_ID = '1412882245605396617'; // Ajustar a tu categoría
    }

    /**
     * Iniciar el sistema de cleanup automático
     */
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(async () => {
            await this.cleanupEmptyChannels();
            await this.cleanupExpiredChannels();
        }, this.CLEANUP_INTERVAL_MS);

        console.log('[TemporaryChannelManager] Cleanup automático iniciado');
    }

    /**
     * Detener el cleanup automático
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Crear un canal temporal
     */
    async createTemporaryChannel(guild, owner, options = {}) {
        try {
            // Verificar límite de canales por usuario
            const userChannelCount = await this.getUserChannelCount(owner.id);
            if (userChannelCount >= this.MAX_CHANNELS_PER_USER) {
                throw new Error(`Ya tienes el máximo de ${this.MAX_CHANNELS_PER_USER} canales temporales activos`);
            }

            // Configuración del canal
            const channelOptions = {
                name: options.name || `${owner.user.username}'s Channel`,
                type: ChannelType.GuildVoice,
                parent: options.categoryId || this.DEFAULT_CATEGORY_ID,
                userLimit: options.userLimit || 0,
                bitrate: options.bitrate || 64000,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect],
                    },
                    {
                        id: owner.id,
                        allow: [
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers,
                            PermissionFlagsBits.DeafenMembers,
                            PermissionFlagsBits.ManageChannels,
                        ],
                    },
                ],
            };

            // Crear el canal en Discord
            const channel = await guild.channels.create(channelOptions);

            // Calcular expiración (si se especifica)
            const expiresAt = options.durationMinutes
                ? new Date(Date.now() + options.durationMinutes * 60 * 1000).toISOString()
                : null;

            // Guardar en base de datos
            const { data, error } = await this.supabase
                .from('temporary_voice_channels')
                .insert({
                    channel_id: channel.id,
                    owner_id: owner.id,
                    name: channel.name,
                    user_limit: channelOptions.userLimit,
                    bitrate: channelOptions.bitrate,
                    category_id: channelOptions.parent,
                    expires_at: expiresAt,
                    metadata: {
                        guild_id: guild.id,
                        created_by_command: options.commandName || 'vcreate',
                        custom_permissions: options.customPermissions || false,
                    }
                })
                .select()
                .single();

            if (error) {
                console.error('[TemporaryChannelManager] Error guardando canal en DB:', error);
                // Intentar eliminar el canal si falló la DB
                await channel.delete().catch(() => { });
                throw new Error('Error al guardar el canal en la base de datos');
            }

            console.log(`[TemporaryChannelManager] Canal temporal creado: ${channel.name} (${channel.id}) por ${owner.user.tag}`);

            return { channel, data };
        } catch (error) {
            console.error('[TemporaryChannelManager] Error creando canal temporal:', error);
            throw error;
        }
    }

    /**
     * Eliminar un canal temporal
     */
    async deleteTemporaryChannel(channelId, reason = 'Canal eliminado') {
        try {
            // Marcar como inactivo en DB
            const { error: dbError } = await this.supabase
                .from('temporary_voice_channels')
                .update({ is_active: false })
                .eq('channel_id', channelId);

            if (dbError) {
                console.error('[TemporaryChannelManager] Error marcando canal como inactivo:', dbError);
            }

            // Buscar y eliminar el canal en Discord
            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                await channel.delete(reason);
                console.log(`[TemporaryChannelManager] Canal eliminado: ${channel.name} (${channelId})`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[TemporaryChannelManager] Error eliminando canal:', error);
            return false;
        }
    }

    /**
     * Limpiar canales vacíos
     */
    async cleanupEmptyChannels() {
        try {
            const { data: channels, error } = await this.supabase
                .from('temporary_voice_channels')
                .select('*')
                .eq('is_active', true);

            if (error) {
                console.error('[TemporaryChannelManager] Error obteniendo canales activos:', error);
                return;
            }

            let cleanedCount = 0;

            for (const dbChannel of channels) {
                try {
                    const channel = await this.client.channels.fetch(dbChannel.channel_id).catch(() => null);

                    if (!channel) {
                        // Canal no existe en Discord, marcar como inactivo
                        await this.supabase
                            .from('temporary_voice_channels')
                            .update({ is_active: false })
                            .eq('channel_id', dbChannel.channel_id);
                        cleanedCount++;
                        continue;
                    }

                    // Si el canal está vacío, eliminarlo
                    if (channel.members.size === 0) {
                        await this.deleteTemporaryChannel(channel.id, 'Canal vacío - cleanup automático');
                        cleanedCount++;
                    }
                } catch (error) {
                    console.error(`[TemporaryChannelManager] Error procesando canal ${dbChannel.channel_id}:`, error);
                }
            }

            if (cleanedCount > 0) {
                console.log(`[TemporaryChannelManager] Cleanup completado: ${cleanedCount} canales eliminados`);
            }
        } catch (error) {
            console.error('[TemporaryChannelManager] Error en cleanup:', error);
        }
    }

    /**
     * Limpiar canales expirados
     */
    async cleanupExpiredChannels() {
        try {
            const { data: expiredChannels, error } = await this.supabase
                .from('temporary_voice_channels')
                .select('*')
                .eq('is_active', true)
                .not('expires_at', 'is', null)
                .lt('expires_at', new Date().toISOString());

            if (error) {
                console.error('[TemporaryChannelManager] Error obteniendo canales expirados:', error);
                return;
            }

            for (const channel of expiredChannels) {
                await this.deleteTemporaryChannel(channel.channel_id, 'Canal expirado');
            }

            if (expiredChannels.length > 0) {
                console.log(`[TemporaryChannelManager] ${expiredChannels.length} canales expirados eliminados`);
            }
        } catch (error) {
            console.error('[TemporaryChannelManager] Error limpiando canales expirados:', error);
        }
    }

    /**
     * Obtener cantidad de canales activos de un usuario
     */
    async getUserChannelCount(userId) {
        try {
            const { count, error } = await this.supabase
                .from('temporary_voice_channels')
                .select('*', { count: 'exact', head: true })
                .eq('owner_id', userId)
                .eq('is_active', true);

            if (error) {
                console.error('[TemporaryChannelManager] Error contando canales:', error);
                return 0;
            }

            return count || 0;
        } catch (error) {
            console.error('[TemporaryChannelManager] Error en getUserChannelCount:', error);
            return 0;
        }
    }

    /**
     * Verificar si un usuario es owner de un canal
     */
    async isChannelOwner(channelId, userId) {
        try {
            const { data, error } = await this.supabase
                .from('temporary_voice_channels')
                .select('owner_id')
                .eq('channel_id', channelId)
                .eq('is_active', true)
                .single();

            if (error || !data) return false;
            return data.owner_id === userId;
        } catch (error) {
            return false;
        }
    }

    /**
     * Obtener información de un canal temporal
     */
    async getChannelInfo(channelId) {
        try {
            const { data, error } = await this.supabase
                .from('temporary_voice_channels')
                .select('*')
                .eq('channel_id', channelId)
                .eq('is_active', true)
                .single();

            if (error) return null;
            return data;
        } catch (error) {
            return null;
        }
    }

    /**
     * Transferir ownership de un canal
     */
    async transferOwnership(channelId, newOwnerId) {
        try {
            const { error } = await this.supabase
                .from('temporary_voice_channels')
                .update({ owner_id: newOwnerId })
                .eq('channel_id', channelId)
                .eq('is_active', true);

            if (error) {
                console.error('[TemporaryChannelManager] Error transfiriendo ownership:', error);
                return false;
            }

            console.log(`[TemporaryChannelManager] Ownership transferido para canal ${channelId} a usuario ${newOwnerId}`);
            return true;
        } catch (error) {
            console.error('[TemporaryChannelManager] Error en transferOwnership:', error);
            return false;
        }
    }
}

module.exports = TemporaryChannelManager;

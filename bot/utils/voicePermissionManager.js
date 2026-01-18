const voiceConfig = require('../config/erlcVoiceChannels');

/**
 * Gestor de Permisos de Voz
 * Maneja verificación avanzada de permisos para canales de voz
 */
class VoicePermissionManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.JUNTA_DIRECTIVA_ROLE = '1412882245735420006';
    }

    /**
     * Verificar si un miembro puede acceder a un canal
     */
    async canAccessChannel(member, channelId) {
        try {
            // Junta Directiva tiene acceso a todo
            if (this.isJuntaDirectiva(member)) {
                return { allowed: true, reason: 'Junta Directiva' };
            }

            // Verificar configuración del canal
            const channelConfig = await this.getChannelConfig(channelId);

            // Verificar blacklist
            if (channelConfig?.blacklist?.includes(member.id)) {
                return { allowed: false, reason: 'Estás en la blacklist de este canal' };
            }

            // Verificar whitelist (si existe)
            if (channelConfig?.whitelist?.length > 0) {
                if (channelConfig.whitelist.includes(member.id)) {
                    return { allowed: true, reason: 'Whitelist' };
                } else {
                    return { allowed: false, reason: 'Este canal requiere whitelist' };
                }
            }

            // Verificar permisos de rol según configuración
            const channelInfo = voiceConfig.getChannelInfo(channelId);
            if (channelInfo?.requiredRole) {
                const hasRole = this.hasRequiredRole(member, channelInfo.requiredRole);
                if (!hasRole) {
                    return {
                        allowed: false,
                        reason: `No tienes el rol requerido para acceder a **${channelInfo.name}**`
                    };
                }
            }

            // Verificar permisos de Discord
            const channel = member.guild.channels.cache.get(channelId);
            if (channel && !channel.permissionsFor(member).has('Connect')) {
                return { allowed: false, reason: 'No tienes permisos de Discord para conectarte' };
            }

            return { allowed: true, reason: 'Acceso permitido' };
        } catch (error) {
            console.error('[VoicePermissionManager] Error verificando acceso:', error);
            return { allowed: false, reason: 'Error verificando permisos' };
        }
    }

    /**
     * Verificar si un miembro puede moderar un canal
     */
    async canModerateChannel(member, channelId) {
        try {
            // Junta Directiva puede moderar todo
            if (this.isJuntaDirectiva(member)) {
                return { allowed: true, reason: 'Junta Directiva' };
            }

            // Staff puede moderar
            if (this.isStaff(member)) {
                return { allowed: true, reason: 'Staff' };
            }

            // Owner de canal temporal puede moderar
            if (member.client.tempChannelManager) {
                const isOwner = await member.client.tempChannelManager.isChannelOwner(channelId, member.id);
                if (isOwner) {
                    return { allowed: true, reason: 'Owner del canal' };
                }
            }

            return { allowed: false, reason: 'No tienes permisos de moderación' };
        } catch (error) {
            console.error('[VoicePermissionManager] Error verificando moderación:', error);
            return { allowed: false, reason: 'Error verificando permisos' };
        }
    }

    /**
     * Verificar si tiene rol requerido
     */
    hasRequiredRole(member, requiredRoleKey) {
        const allowedRoles = voiceConfig.ROLES[requiredRoleKey];

        if (!allowedRoles) return true;

        if (Array.isArray(allowedRoles)) {
            return member.roles.cache.some(role => allowedRoles.includes(role.id));
        } else {
            return member.roles.cache.has(allowedRoles);
        }
    }

    /**
     * Verificar si es Junta Directiva
     */
    isJuntaDirectiva(member) {
        return member.roles.cache.has(this.JUNTA_DIRECTIVA_ROLE) ||
            member.roles.cache.some(role =>
                voiceConfig.ROLES.JUNTA_DIRECTIVA?.includes(role.id)
            );
    }

    /**
     * Verificar si es Staff
     */
    isStaff(member) {
        return member.roles.cache.some(role =>
            voiceConfig.ROLES.STAFF?.includes(role.id)
        );
    }

    /**
     * Obtener configuración del canal
     */
    async getChannelConfig(channelId) {
        try {
            const { data, error } = await this.supabase
                .from('voice_channel_configs')
                .select('*')
                .eq('channel_id', channelId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                console.error('[VoicePermissionManager] Error obteniendo config:', error);
            }

            return data;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en getChannelConfig:', error);
            return null;
        }
    }

    /**
     * Actualizar configuración del canal
     */
    async updateChannelConfig(channelId, config, updatedBy) {
        try {
            const { data, error } = await this.supabase
                .from('voice_channel_configs')
                .upsert({
                    channel_id: channelId,
                    config_data: config,
                    updated_by: updatedBy,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[VoicePermissionManager] Error actualizando config:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en updateChannelConfig:', error);
            return null;
        }
    }

    /**
     * Agregar usuario a whitelist
     */
    async addToWhitelist(channelId, userId, addedBy) {
        try {
            const config = await this.getChannelConfig(channelId);
            const whitelist = config?.whitelist || [];

            if (!whitelist.includes(userId)) {
                whitelist.push(userId);
            }

            const { error } = await this.supabase
                .from('voice_channel_configs')
                .upsert({
                    channel_id: channelId,
                    whitelist: whitelist,
                    updated_by: addedBy,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('[VoicePermissionManager] Error agregando a whitelist:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en addToWhitelist:', error);
            return false;
        }
    }

    /**
     * Agregar usuario a blacklist
     */
    async addToBlacklist(channelId, userId, addedBy) {
        try {
            const config = await this.getChannelConfig(channelId);
            const blacklist = config?.blacklist || [];

            if (!blacklist.includes(userId)) {
                blacklist.push(userId);
            }

            const { error } = await this.supabase
                .from('voice_channel_configs')
                .upsert({
                    channel_id: channelId,
                    blacklist: blacklist,
                    updated_by: addedBy,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('[VoicePermissionManager] Error agregando a blacklist:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en addToBlacklist:', error);
            return false;
        }
    }

    /**
     * Remover usuario de whitelist
     */
    async removeFromWhitelist(channelId, userId) {
        try {
            const config = await this.getChannelConfig(channelId);
            let whitelist = config?.whitelist || [];

            whitelist = whitelist.filter(id => id !== userId);

            const { error } = await this.supabase
                .from('voice_channel_configs')
                .update({ whitelist: whitelist })
                .eq('channel_id', channelId);

            if (error) {
                console.error('[VoicePermissionManager] Error removiendo de whitelist:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en removeFromWhitelist:', error);
            return false;
        }
    }

    /**
     * Remover usuario de blacklist
     */
    async removeFromBlacklist(channelId, userId) {
        try {
            const config = await this.getChannelConfig(channelId);
            let blacklist = config?.blacklist || [];

            blacklist = blacklist.filter(id => id !== userId);

            const { error } = await this.supabase
                .from('voice_channel_configs')
                .update({ blacklist: blacklist })
                .eq('channel_id', channelId);

            if (error) {
                console.error('[VoicePermissionManager] Error removiendo de blacklist:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en removeFromBlacklist:', error);
            return false;
        }
    }

    /**
     * Bloquear/desbloquear canal
     */
    async toggleChannelLock(channelId, locked, updatedBy) {
        try {
            const { error } = await this.supabase
                .from('voice_channel_configs')
                .upsert({
                    channel_id: channelId,
                    is_locked: locked,
                    updated_by: updatedBy,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('[VoicePermissionManager] Error cambiando lock:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[VoicePermissionManager] Error en toggleChannelLock:', error);
            return false;
        }
    }
}

module.exports = VoicePermissionManager;

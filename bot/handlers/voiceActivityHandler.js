/**
 * Handler de Actividad de Voz
 * Gestiona eventos de voz: join, leave, tracking, cleanup
 */
class VoiceActivityHandler {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.activeVoiceSessions = new Map(); // userId -> session data
    }

    /**
     * Inicializar el handler
     */
    initialize() {
        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            await this.handleVoiceStateUpdate(oldState, newState);
        });

        console.log('[VoiceActivityHandler] Handler inicializado');
    }

    /**
     * Manejar cambios en el estado de voz
     */
    async handleVoiceStateUpdate(oldState, newState) {
        try {
            const userId = newState.id;
            const oldChannelId = oldState.channelId;
            const newChannelId = newState.channelId;

            // Usuario se unió a un canal
            if (!oldChannelId && newChannelId) {
                await this.handleVoiceJoin(newState);
            }
            // Usuario salió de un canal
            else if (oldChannelId && !newChannelId) {
                await this.handleVoiceLeave(oldState);
            }
            // Usuario cambió de canal
            else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
                await this.handleVoiceLeave(oldState);
                await this.handleVoiceJoin(newState);
            }
            // Usuario cambió estado (mute, deaf, etc.)
            else if (oldChannelId === newChannelId) {
                await this.handleVoiceStateChange(oldState, newState);
            }
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en voiceStateUpdate:', error);
        }
    }

    /**
     * Manejar cuando un usuario se une a un canal
     */
    async handleVoiceJoin(voiceState) {
        try {
            const userId = voiceState.id;
            const channelId = voiceState.channelId;
            const channel = voiceState.channel;

            if (!channel) return;

            // Crear sesión en base de datos
            const { data, error } = await this.supabase
                .from('voice_activity')
                .insert({
                    user_id: userId,
                    channel_id: channelId,
                    channel_name: channel.name,
                    joined_at: new Date().toISOString(),
                    was_muted: voiceState.mute || false,
                    was_deafened: voiceState.deaf || false,
                    was_streaming: voiceState.streaming || false,
                    was_video: voiceState.selfVideo || false
                })
                .select()
                .single();

            if (error) {
                console.error('[VoiceActivityHandler] Error creando sesión de voz:', error);
                return;
            }

            // Guardar sesión activa en memoria
            this.activeVoiceSessions.set(userId, {
                sessionId: data.id,
                channelId: channelId,
                joinedAt: new Date(),
                isMuted: voiceState.mute || false,
                isDeafened: voiceState.deaf || false
            });

            console.log(`[VoiceActivityHandler] 🎤 ${voiceState.member.user.tag} se unió a ${channel.name}`);

            // Si el canal es temporal, cancelar su eliminación
            if (this.client.tempChannelManager) {
                const tempInfo = await this.client.tempChannelManager.getChannelInfo(channelId);
                if (tempInfo) {
                    console.log(`[VoiceActivityHandler] Canal temporal ${channel.name} ahora tiene ${channel.members.size} usuario(s)`);
                }
            }
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en handleVoiceJoin:', error);
        }
    }

    /**
     * Manejar cuando un usuario sale de un canal
     */
    async handleVoiceLeave(voiceState) {
        try {
            const userId = voiceState.id;
            const channelId = voiceState.channelId;
            const channel = voiceState.channel;

            const session = this.activeVoiceSessions.get(userId);
            if (!session) {
                // Intentar cerrar la sesión activa más reciente
                await this.closeOpenSession(userId);
                return;
            }

            // Actualizar sesión en base de datos
            const { error } = await this.supabase
                .from('voice_activity')
                .update({
                    left_at: new Date().toISOString()
                })
                .eq('id', session.sessionId);

            if (error) {
                console.error('[VoiceActivityHandler] Error cerrando sesión de voz:', error);
            }

            // Remover de sesiones activas
            this.activeVoiceSessions.delete(userId);

            console.log(`[VoiceActivityHandler] 👋 ${voiceState.member.user.tag} salió de ${channel?.name || 'canal'}`);

            // Si el canal es temporal y está vacío, programar eliminación
            if (channel && this.client.tempChannelManager) {
                const tempInfo = await this.client.tempChannelManager.getChannelInfo(channelId);
                if (tempInfo && channel.members.size === 0) {
                    console.log(`[VoiceActivityHandler] Canal temporal ${channel.name} quedó vacío - será eliminado por cleanup`);
                }
            }

            // Actualizar estadísticas agregadas
            await this.updateDailyStats(userId);
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en handleVoiceLeave:', error);
        }
    }

    /**
     * Manejar cambios en el estado de voz (mute, deaf, etc.)
     */
    async handleVoiceStateChange(oldState, newState) {
        try {
            const userId = newState.id;
            const session = this.activeVoiceSessions.get(userId);

            if (!session) return;

            // Actualizar estado en memoria
            session.isMuted = newState.mute || false;
            session.isDeafened = newState.deaf || false;

            // Opcionalmente actualizar en DB (para analytics)
            // Por ahora solo guardamos el estado inicial
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en handleVoiceStateChange:', error);
        }
    }

    /**
     * Cerrar sesión abierta (fallback)
     */
    async closeOpenSession(userId) {
        try {
            const { error } = await this.supabase
                .from('voice_activity')
                .update({
                    left_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .is('left_at', null)
                .order('joined_at', { ascending: false })
                .limit(1);

            if (error && error.code !== 'PGRST116') {
                console.error('[VoiceActivityHandler] Error cerrando sesión abierta:', error);
            }
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en closeOpenSession:', error);
        }
    }

    /**
     * Actualizar estadísticas diarias
     */
    async updateDailyStats(userId) {
        try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            // Obtener estadísticas del día
            const { data: todayStats, error: statsError } = await this.supabase
                .from('voice_activity')
                .select('channel_id, duration_seconds')
                .eq('user_id', userId)
                .gte('joined_at', `${today}T00:00:00`)
                .not('left_at', 'is', null);

            if (statsError) {
                console.error('[VoiceActivityHandler] Error obteniendo stats del día:', statsError);
                return;
            }

            const totalDuration = todayStats.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
            const channelsVisited = [...new Set(todayStats.map(s => s.channel_id))];

            // Upsert stats summary
            const { error: upsertError } = await this.supabase
                .from('voice_stats_summary')
                .upsert({
                    user_id: userId,
                    date: today,
                    total_sessions: todayStats.length,
                    total_duration_seconds: totalDuration,
                    channels_visited: channelsVisited,
                    last_updated: new Date().toISOString()
                });

            if (upsertError) {
                console.error('[VoiceActivityHandler] Error actualizando stats summary:', upsertError);
            }
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en updateDailyStats:', error);
        }
    }

    /**
     * Obtener estadísticas de un usuario
     */
    async getUserStats(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_voice_statistics')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[VoiceActivityHandler] Error obteniendo stats de usuario:', error);
                return null;
            }

            return data || {
                total_sessions: 0,
                total_duration_seconds: 0,
                avg_session_duration: 0,
                longest_session: 0,
                unique_channels: 0,
                last_voice_activity: null
            };
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en getUserStats:', error);
            return null;
        }
    }

    /**
     * Obtener canales más populares
     */
    async getPopularChannels(limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('popular_voice_channels')
                .select('*')
                .limit(limit);

            if (error) {
                console.error('[VoiceActivityHandler] Error obteniendo canales populares:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en getPopularChannels:', error);
            return [];
        }
    }

    /**
     * Cleanup de sesiones abiertas (al reiniciar el bot)
     */
    async cleanupOpenSessions() {
        try {
            console.log('[VoiceActivityHandler] Limpiando sesiones abiertas...');

            const { error } = await this.supabase
                .from('voice_activity')
                .update({
                    left_at: new Date().toISOString()
                })
                .is('left_at', null);

            if (error) {
                console.error('[VoiceActivityHandler] Error en cleanup:', error);
            } else {
                console.log('[VoiceActivityHandler] Sesiones abiertas cerradas correctamente');
            }
        } catch (error) {
            console.error('[VoiceActivityHandler] Error en cleanupOpenSessions:', error);
        }
    }

    /**
     * Obtener sesión activa de un usuario
     */
    getActiveSession(userId) {
        return this.activeVoiceSessions.get(userId);
    }

    /**
     * Verificar si un usuario está en voz
     */
    isUserInVoice(userId) {
        return this.activeVoiceSessions.has(userId);
    }
}

module.exports = VoiceActivityHandler;

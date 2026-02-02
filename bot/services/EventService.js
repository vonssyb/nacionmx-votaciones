const { supabase } = require('../config/supabaseClient');
const moment = require('moment-timezone');

/**
 * EventService - Manages server-wide random events
 * Events modify gameplay temporarily with multipliers/bonuses
 */
class EventService {
    constructor() {
        this.timezone = 'America/Mexico_City';
        this.eventTypes = {
            DOUBLE_SALARY: {
                name: '💰 Doble Sueldo',
                description: '¡Los sueldos pagan el doble! Aprovecha para fichar.',
                multiplier: 2.0,
                duration: 2, // hours
                emoji: '💰'
            },
            CASINO_LUCK: {
                name: '🎰 Suerte de Casino',
                description: '¡Mejores probabilidades en todos los juegos de casino!',
                multiplier: 1.5,
                duration: 3,
                emoji: '🎰'
            },
            CRISIS: {
                name: '📉 Crisis Económica',
                description: 'Los tiempos están difíciles... Ingresos reducidos temporalmente.',
                multiplier: 0.5,
                duration: 1,
                emoji: '📉'
            },
            FESTIVAL: {
                name: '🎉 Festival de la Ciudad',
                description: '¡Bonos aleatorios en todas las actividades!',
                multiplier: 1.25,
                duration: 4,
                emoji: '🎉'
            },
            DOUBLE_XP: {
                name: '⭐ Doble Experiencia',
                description: '¡Gana el doble de experiencia en todo!',
                multiplier: 2.0,
                duration: 2,
                emoji: '⭐'
            },
            RUSH_HOUR: {
                name: '⚡ Hora Pico',
                description: '¡Todo es más rápido! Cooldowns reducidos.',
                multiplier: 1.0,
                duration: 1,
                emoji: '⚡'
            }
        };
    }

    /**
     * Get current active event
     */
    async getActiveEvent() {
        try {
            const now = moment().tz(this.timezone);
            const { data, error } = await supabase
                .from('server_events')
                .select('*')
                .eq('is_active', true)
                .lte('start_time', now.toISOString())
                .gte('end_time', now.toISOString())
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting active event:', error);
            return null;
        }
    }

    /**
     * Start a new random event
     */
    async startRandomEvent(client, announcementChannelId) {
        try {
            // Check if there's already an active event
            const activeEvent = await this.getActiveEvent();
            if (activeEvent) {
                console.log('Event already active, skipping...');
                return null;
            }

            // Select random event type
            const eventTypeKeys = Object.keys(this.eventTypes);
            const randomType = eventTypeKeys[Math.floor(Math.random() * eventTypeKeys.length)];
            const eventConfig = this.eventTypes[randomType];

            const now = moment().tz(this.timezone);
            const endTime = now.clone().add(eventConfig.duration, 'hours');

            // Create event in database
            const { data: newEvent, error } = await supabase
                .from('server_events')
                .insert([{
                    event_type: randomType,
                    event_name: eventConfig.name,
                    description: eventConfig.description,
                    multiplier: eventConfig.multiplier,
                    event_data: { emoji: eventConfig.emoji },
                    start_time: now.toISOString(),
                    end_time: endTime.toISOString(),
                    is_active: true,
                    created_by: 'SYSTEM'
                }])
                .select()
                .single();

            if (error) throw error;

            // Announce event in channel
            if (client && announcementChannelId) {
                await this.announceEvent(client, announcementChannelId, newEvent, 'start');
            }

            // Schedule event end
            const durationMs = eventConfig.duration * 60 * 60 * 1000;
            setTimeout(async () => {
                await this.endEvent(newEvent.id, client, announcementChannelId);
            }, durationMs);

            console.log(`Started event: ${eventConfig.name} for ${eventConfig.duration}h`);
            return newEvent;
        } catch (error) {
            console.error('Error starting random event:', error);
            return null;
        }
    }

    /**
     * End an event
     */
    async endEvent(eventId, client, announcementChannelId) {
        try {
            // Get event details
            const { data: event, error: fetchError } = await supabase
                .from('server_events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (fetchError) throw fetchError;

            // Mark as inactive
            const { error } = await supabase
                .from('server_events')
                .update({ is_active: false })
                .eq('id', eventId);

            if (error) throw error;

            // Announce end
            if (client && announcementChannelId) {
                await this.announceEvent(client, announcementChannelId, event, 'end');
            }

            console.log(`Ended event: ${event.event_name}`);
            return true;
        } catch (error) {
            console.error('Error ending event:', error);
            return false;
        }
    }

    /**
     * Announce event in Discord channel
     */
    async announceEvent(client, channelId, event, phase) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) return;

            const eventConfig = this.eventTypes[event.event_type];
            const embed = {
                color: phase === 'start' ? 0x00FF00 : 0xFF6B6B,
                title: phase === 'start' ? '🎊 ¡EVENTO INICIADO!' : '⏰ ¡EVENTO FINALIZADO!',
                description: phase === 'start'
                    ? `**${event.event_name}**\n${event.description}`
                    : `**${event.event_name}** ha terminado. ¡Gracias por participar!`,
                fields: [],
                timestamp: new Date(),
                footer: { text: 'Sistema de Eventos' }
            };

            if (phase === 'start') {
                const endTime = moment(event.end_time).tz(this.timezone);
                embed.fields.push({
                    name: '⏱️ Duración',
                    value: `<t:${Math.floor(endTime.valueOf() / 1000)}:R>`,
                    inline: true
                });

                if (event.multiplier !== 1.0) {
                    embed.fields.push({
                        name: '📊 Multiplicador',
                        value: `**${event.multiplier}x**`,
                        inline: true
                    });
                }
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error announcing event:', error);
        }
    }

    /**
     * Apply event multiplier to a value
     */
    async applyEventMultiplier(baseValue, eventType = null) {
        try {
            const activeEvent = await this.getActiveEvent();
            if (!activeEvent) return baseValue;

            // If eventType specified, only apply if it matches
            if (eventType && activeEvent.event_type !== eventType) {
                return baseValue;
            }

            const multiplier = parseFloat(activeEvent.multiplier);
            return Math.floor(baseValue * multiplier);
        } catch (error) {
            console.error('Error applying event multiplier:', error);
            return baseValue;
        }
    }

    /**
     * Get event info for display
     */
    getEventInfo(event) {
        if (!event) return null;

        const now = moment().tz(this.timezone);
        const endTime = moment(event.end_time).tz(this.timezone);
        const timeRemaining = endTime.diff(now, 'minutes');

        return {
            name: event.event_name,
            description: event.description,
            multiplier: event.multiplier,
            emoji: event.event_data?.emoji || '🎊',
            timeRemaining,
            endTimestamp: Math.floor(endTime.valueOf() / 1000)
        };
    }
}

module.exports = new EventService();

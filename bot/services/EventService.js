const moment = require('moment-timezone');

/**
 * EventService - Manages server-wide random events
 * Events modify gameplay temporarily with multipliers/bonuses
 */
class EventService {
    constructor() {
        this.timezone = 'America/Mexico_City';
        this.eventTypes = {
            // === EVENTOS POSITIVOS - ECONOMÍA ===
            DOUBLE_SALARY: {
                name: '💰 Doble Sueldo',
                description: '¡Los sueldos pagan el doble! Aprovecha para fichar.',
                multiplier: 2.0,
                duration: 2,
                emoji: '💰',
                type: 'positive'
            },
            TRIPLE_WORK: {
                name: '💵 Boom Económico',
                description: '¡Triple paga en todos los trabajos! ¡La economía está en auge!',
                multiplier: 3.0,
                duration: 1,
                emoji: '💵',
                type: 'positive'
            },
            GOLDEN_HOUR: {
                name: '🌟 Hora Dorada',
                description: '¡Todo lo que toques se convierte en oro! Ganancias x2.5',
                multiplier: 2.5,
                duration: 1,
                emoji: '🌟',
                type: 'positive'
            },
            MILLIONAIRE_RAIN: {
                name: '💎 Lluvia de Diamantes',
                description: '¡Recompensas premium en todas las actividades!',
                multiplier: 1.8,
                duration: 2,
                emoji: '💎',
                type: 'positive'
            },

            // === EVENTOS POSITIVOS - CASINO Y SUERTE ===
            CASINO_LUCK: {
                name: '🎰 Suerte de Casino',
                description: '¡Mejores probabilidades en todos los juegos de casino!',
                multiplier: 1.5,
                duration: 3,
                emoji: '🎰',
                type: 'positive'
            },
            JACKPOT_FEVER: {
                name: '🎲 Fiebre de Jackpot',
                description: '¡Probabilidades de Jackpot aumentadas! Premia más seguido.',
                multiplier: 1.7,
                duration: 2,
                emoji: '🎲',
                type: 'positive'
            },
            LUCKY_DAY: {
                name: '🍀 Día de Suerte',
                description: '¡Tu suerte está por las nubes! Crímenes y apuestas favorecidos.',
                multiplier: 1.6,
                duration: 3,
                emoji: '🍀',
                type: 'positive'
            },

            // === EVENTOS POSITIVOS - XP Y PROGRESO ===
            DOUBLE_XP: {
                name: '⭐ Doble Experiencia',
                description: '¡Gana el doble de experiencia en todo!',
                multiplier: 2.0,
                duration: 2,
                emoji: '⭐',
                type: 'positive'
            },
            MEGA_XP: {
                name: '🌠 Mega Experiencia',
                description: '¡Experiencia triplicada! Sube de nivel rápido.',
                multiplier: 3.0,
                duration: 1,
                emoji: '🌠',
                type: 'positive'
            },

            // === EVENTOS POSITIVOS - GENERALES ===
            FESTIVAL: {
                name: '🎉 Festival de la Ciudad',
                description: '¡Bonos aleatorios en todas las actividades!',
                multiplier: 1.25,
                duration: 4,
                emoji: '🎉',
                type: 'positive'
            },
            RUSH_HOUR: {
                name: '⚡ Hora Pico',
                description: '¡Todo es más rápido! Cooldowns reducidos a la mitad.',
                multiplier: 1.3,
                duration: 1,
                emoji: '⚡',
                type: 'positive'
            },
            HAPPY_HOUR: {
                name: '🍻 Hora Feliz',
                description: '¡Todo tiene descuento y bonos! Compra y gana más.',
                multiplier: 1.4,
                duration: 2,
                emoji: '🍻',
                type: 'positive'
            },

            // === EVENTOS NEGATIVOS - ECONOMÍA ===
            CRISIS: {
                name: '📉 Crisis Económica',
                description: 'Los tiempos están difíciles... Ingresos reducidos temporalmente.',
                multiplier: 0.5,
                duration: 2,
                emoji: '📉',
                type: 'negative'
            },
            INFLATION: {
                name: '📊 Inflación Galopante',
                description: '¡Los precios se dispararon! Todo cuesta más y ganas menos.',
                multiplier: 0.4,
                duration: 1,
                emoji: '📊',
                type: 'negative'
            },
            TAX_SEASON: {
                name: '💸 Temporada de Impuestos',
                description: 'El gobierno está cobrando impuestos extras. -30% en todas las ganancias.',
                multiplier: 0.7,
                duration: 2,
                emoji: '💸',
                type: 'negative'
            },
            MARKET_CRASH: {
                name: '💔 Colapso del Mercado',
                description: '¡Pánico económico! Las ganancias se desplomaron.',
                multiplier: 0.3,
                duration: 1,
                emoji: '💔',
                type: 'negative'
            },

            // === EVENTOS NEGATIVOS - MALA SUERTE ===
            BAD_LUCK: {
                name: '🌧️ Mala Racha',
                description: 'Todo sale mal... Probabilidades reducidas en casino y crímenes.',
                multiplier: 0.6,
                duration: 2,
                emoji: '🌧️',
                type: 'negative'
            },
            CURSED_DAY: {
                name: '😈 Día Maldito',
                description: '¡Energías negativas rondan! Pierdes más seguido.',
                multiplier: 0.5,
                duration: 1,
                emoji: '😈',
                type: 'negative'
            },

            // === EVENTOS NEUTRALES/ESPECIALES ===
            CHAOS_MODE: {
                name: '🎭 Modo Caos',
                description: '¡Todo es impredecible! Ganancias y pérdidas aleatorias extremas.',
                multiplier: 1.0, // Se maneja diferente en el código
                duration: 2,
                emoji: '🎭',
                type: 'special'
            },
            LOTTERY_MANIA: {
                name: '🎫 Locura de Lotería',
                description: 'Premios gigantes pero probabilidades bajas. ¿Te arriesgas?',
                multiplier: 1.2,
                duration: 3,
                emoji: '🎫',
                type: 'special'
            },
            MYSTERY_EVENT: {
                name: '❓ Evento Misterioso',
                description: '¿Qué sucederá? Nadie lo sabe... Efectos sorpresa activos.',
                multiplier: 1.0,
                duration: 1,
                emoji: '❓',
                type: 'special'
            }
        };
    }

    /**
     * Get current active event
     */
    async getActiveEvent(supabase) {
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
    async startRandomEvent(client, announcementChannelId, supabase) {
        try {
            // Check if there's already an active event
            const activeEvent = await this.getActiveEvent(supabase);
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
            if (client) {
                await this.announceEvent(client, null, newEvent, 'start');
            }

            // Schedule event end
            const durationMs = eventConfig.duration * 60 * 60 * 1000;
            setTimeout(async () => {
                await this.endEvent(newEvent.id, client, null);
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
    async endEvent(eventId, client, announcementChannelId, supabase) {
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
            if (client) {
                await this.announceEvent(client, null, event, 'end');
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
    async announceEvent(client, _channelIdIgnored, event, phase) {
        try {
            const ANNOUNCEMENT_CHANNEL_ID = '1450290886335533126';
            const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
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
    async applyEventMultiplier(baseValue, eventType = null, supabase) {
        try {
            const activeEvent = await this.getActiveEvent(supabase);
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

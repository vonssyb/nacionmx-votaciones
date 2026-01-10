// Mapeo completo de Canales de Voz para ERLC
// ID Canal -> Nombre Human Readable
module.exports = {
    // Configuración global
    SETTINGS: {
        // Enviar mensaje al mismo canal de voz (Chat de Voz)
        SEND_TO_VOICE_CHAT: true,
        // Opcional: Mapear a canales de texto específicos si SEND_TO_VOICE_CHAT es false
        TEXT_CHANNEL_MAP: {}
    },

    // Lista de Canales Permitidos
    CHANNELS: {
        // --- ESPERA ---
        '1459640433297588401': 'Canal de Espera',
        '1449891847961841775': 'Espera para Staff',

        // --- AMBIENTES ---
        '1412966846273163396': 'Ambiente 1',
        '1459642544441786521': 'Ambiente 2',
        '1459642568756297951': 'Ambiente 3',
        '1459643217996943683': 'Ambiente 4',

        // --- ESCENARIOS ---
        '1459642733097652235': 'Escenario 1',
        '1459643100157841640': 'Escenario 2',
        '1459643138728792074': 'Escenario 3',
        '1459643117929238550': 'Escenario 4',
        '1459643177056080049': 'Escenario 5',
        '1459643198438768873': 'Escenario 6',

        // --- POLICÍA ---
        '1459646170476314765': 'Policía General',
        '1459645796256317617': 'Policía 1',
        '1459646124079054929': 'Policía 2',
        '1459646138498945368': 'Policía 3',
        '1459646153619669165': 'Policía 4',

        // --- CARTEL ---
        '1459646308145955019': 'Cartel General',
        '1459646253746098409': 'Cartel 1',
        '1459646266630996009': 'Cartel 2',
        '1459646277766611049': 'Cartel 3',
        '1459646293264826723': 'Cartel 4',

        // --- SOPORTE (Staff mueve usuarios aquí) ---
        '1412956423662469293': 'Soporte 1',
        '1412956477789966379': 'Soporte 2',
        '1412956507825377343': 'Soporte 3'
    },

    /**
     * Obtiene info del canal si está en la lista permitida
     * @param {string} channelId 
     */
    getChannelInfo(channelId) {
        const name = this.CHANNELS[channelId];
        return name ? { id: channelId, name } : null;
    }
};

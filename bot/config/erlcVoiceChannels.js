// Mapeo completo de Canales de Voz para ERLC
// ID Canal -> Nombre Human Readable y Abreviación
module.exports = {
    // ABREVIACIONES FÁCILES
    // [abr]: canal_id
    ALIASES: {
        // ESPERA
        'espera': '1459640433297588401', // Canal de Espera
        'staff': '1449891847961841775',  // Espera Staff

        // POLICIA (p1-p4)
        'pg': '1459646170476314765', // Policia General
        'p1': '1459645796256317617',
        'p2': '1459646124079054929',
        'p3': '1459646138498945368',
        'p4': '1459646153619669165',

        // CARTEL (c1-c4)
        'cg': '1459646308145955019', // Cartel General
        'c1': '1459646253746098409',
        'c2': '1459646266630996009',
        'c3': '1459646277766611049',
        'c4': '1459646293264826723',

        // AMBIENTES (a1-a4)
        'a1': '1412966846273163396',
        'a2': '1459642544441786521',
        'a3': '1459642568756297951',
        'a4': '1459643217996943683',

        // ESCENARIOS (e1-e6)
        'e1': '1459642733097652235',
        'e2': '1459643100157841640',
        'e3': '1459643138728792074',
        'e4': '1459643117929238550',
        'e5': '1459643177056080049',
        'e6': '1459643198438768873',

        // SOPORTE (s1-s3)
        's1': '1412956423662469293',
        's2': '1412956477789966379',
        's3': '1412956507825377343'
    },

    // Mapa inverso para logs y validación (ID -> Nombre)
    CHANNELS: {
        '1459640433297588401': 'Canal de Espera',
        '1449891847961841775': 'Espera Staff',

        // Policia
        '1459646170476314765': 'Policía General',
        '1459645796256317617': 'Policía 1',
        '1459646124079054929': 'Policía 2',
        '1459646138498945368': 'Policía 3',
        '1459646153619669165': 'Policía 4',

        // Cartel
        '1459646308145955019': 'Cartel General',
        '1459646253746098409': 'Cartel 1',
        '1459646266630996009': 'Cartel 2',
        '1459646277766611049': 'Cartel 3',
        '1459646293264826723': 'Cartel 4',

        // Ambientes
        '1412966846273163396': 'Ambiente 1',
        '1459642544441786521': 'Ambiente 2',
        '1459642568756297951': 'Ambiente 3',
        '1459643217996943683': 'Ambiente 4',

        // Escenarios
        '1459642733097652235': 'Escenario 1',
        '1459643100157841640': 'Escenario 2',
        '1459643138728792074': 'Escenario 3',
        '1459643117929238550': 'Escenario 4',
        '1459643177056080049': 'Escenario 5',
        '1459643198438768873': 'Escenario 6',

        // Soporte
        '1412956423662469293': 'Soporte 1',
        '1412956477789966379': 'Soporte 2',
        '1412956507825377343': 'Soporte 3'
    },

    getChannelInfo(channelId) {
        const name = this.CHANNELS[channelId];
        return name ? { id: channelId, name } : null;
    },

    getIdFromAlias(alias) {
        return this.ALIASES[alias.toLowerCase()] || null;
    }
};

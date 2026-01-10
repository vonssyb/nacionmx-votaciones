// Mapeo completo de Canales de Voz para ERLC
// ID Canal -> Nombre Human Readable, Abreviación y ROLES REQUERIDOS
module.exports = {
    // ROLES CONFIG (Reemplazar con IDs reales)
    ROLES: {
        JUNTA_DIRECTIVA: '1412882245735420006', // Junta Directiva Role ID
        STAFF: '1412887167654690908',          // Staff Role ID (Base)
        POLICIA: '1459648900221370428',        // Rol Policia
        CARTEL: '1459649033222684702'          // Rol Cartel
    },

    // ABREVIACIONES FÁCILES
    ALIASES: {
        // JUNTA DIRECTIVA
        'jd': '1412956722469011657',

        // STAFF
        'staff': '1412956666512543751',
        'espera': '1459640433297588401', // Cualquiera

        // POLICIA (p1-p4)
        'pg': '1459646170476314765',
        'p1': '1459645796256317617',
        'p2': '1459646124079054929',
        'p3': '1459646138498945368',
        'p4': '1459646153619669165',

        // CARTEL (c1-c4)
        'cg': '1459646308145955019',
        'c1': '1459646253746098409',
        'c2': '1459646266630996009',
        'c3': '1459646277766611049',
        'c4': '1459646293264826723',

        // AMBIENTES (a1-a4) - Sin restricción especial
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

    // Configuración de Permisos por Canal
    CHANNELS: {
        // Junta Directiva
        '1412956722469011657': { name: 'Junta Directiva', requiredRole: 'JUNTA_DIRECTIVA' },

        // Staff
        '1412956666512543751': { name: 'Staff', requiredRole: 'STAFF' },
        '1459640433297588401': { name: 'Canal de Espera', requiredRole: null },

        // Policía
        '1459646170476314765': { name: 'Policía General', requiredRole: 'POLICIA' },
        '1459645796256317617': { name: 'Policía 1', requiredRole: 'POLICIA' },
        '1459646124079054929': { name: 'Policía 2', requiredRole: 'POLICIA' },
        '1459646138498945368': { name: 'Policía 3', requiredRole: 'POLICIA' },
        '1459646153619669165': { name: 'Policía 4', requiredRole: 'POLICIA' },

        // Cartel
        '1459646308145955019': { name: 'Cartel General', requiredRole: 'CARTEL' },
        '1459646253746098409': { name: 'Cartel 1', requiredRole: 'CARTEL' },
        '1459646266630996009': { name: 'Cartel 2', requiredRole: 'CARTEL' },
        '1459646277766611049': { name: 'Cartel 3', requiredRole: 'CARTEL' },
        '1459646293264826723': { name: 'Cartel 4', requiredRole: 'CARTEL' },

        // Ambientes
        '1412966846273163396': { name: 'Ambiente 1' },
        '1459642544441786521': { name: 'Ambiente 2' },
        '1459642568756297951': { name: 'Ambiente 3' },
        '1459643217996943683': { name: 'Ambiente 4' },

        // Escenarios
        '1459642733097652235': { name: 'Escenario 1' },
        '1459643100157841640': { name: 'Escenario 2' },
        '1459643138728792074': { name: 'Escenario 3' },
        '1459643117929238550': { name: 'Escenario 4' },
        '1459643177056080049': { name: 'Escenario 5' },
        '1459643198438768873': { name: 'Escenario 6' },

        // Soporte
        '1412956423662469293': { name: 'Soporte 1' },
        '1412956477789966379': { name: 'Soporte 2' },
        '1412956507825377343': { name: 'Soporte 3' }
    },

    getChannelInfo(channelId) {
        return this.CHANNELS[channelId] || null;
    },

    getIdFromAlias(alias) {
        return this.ALIASES[alias.toLowerCase()] || null;
    }
};

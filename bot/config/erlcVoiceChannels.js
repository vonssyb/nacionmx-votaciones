module.exports = {

    ROLES: {
        JUNTA_DIRECTIVA: [
            '1412882245735420006', // Junta Directiva (el correcto)
            '1412967056730755143', // Junta Directiva viejo
            '1412967017639575562', // Junta Directiva viejo
            '1412887195014557787', // CO-OWNER
        ],
        STAFF: ['1412927576879661207', '1412887167654690908'], // Agregar ROLE_COMMON
        POLICIA: [
            '1398525215641702492', // Sheriff
            '1398525215641702491', // Sub Sheriff 
            '1398525215641702490', // Commander
            '1398525215629115488', // Captain
            '1398525215629115487', // Lieutenant
            '1398525215629115486', // Sergeant
            '1398525215629115485', // Corporal
            '1398525215629115484', // Master Trooper
            '1398525215629115483', // Senior Trooper
            '1398525215629115482', // Trooper
            '1398525215629115481', // Cadet
            '1416867605976715363', // POLICIA_TRANSITO
            '1412898911185797310'  // Guardia Nacional
        ],
        CARTEL: ['1459649033222684702'], // Rol Cartel
        AIC: ['1412898916021829903'], // Rol AIC Exclusivo
        POLICIA_FEDERAL: ['1412898913345863760'], // Rol PF Exclusivo
        PARAMEDICO: ['1413540726100332574'], // Rol Paramédico
        BOMBERO: ['1413540768471838761'], // Rol Bombero
        // Grupo de emergencias (Paramédicos + Bomberos + AIC para colaboración)
        EMERGENCIAS: [
            '1413540726100332574', // Paramédico
            '1413540768471838761', // Bombero
            '1412898916021829903'  // AIC (colaboración)
        ]
    },

    // ABREVIACIONES FÁCILES
    ALIASES: {
        // 👑 ADMINISTRACIÓN
        'jd': '1412956722469011657',
        'staff': '1412956666512543751',
        'espera': '1459640433297588401',

        // 👮 POLICÍA
        'pg': '1459646170476314765',
        'p1': '1459645796256317617',
        'p2': '1459646124079054929',
        'p3': '1459646138498945368',
        'p4': '1459646153619669165',

        // 👮‍♂️ POLICÍA FEDERAL
        'pf1': '1461133946703314985',
        'pf2': '1461133995944185998',

        // 🕵️ AIC
        'aic1': '1461129202450300988',
        'aic2': '1461129229277335765',

        // 🚑 MÉDICO / 🚒 BOMBEROS
        'mg': '1459948822024159262', // Médico General
        'bg': '1459948849601712381', // Bomberos General

        // 💀 CARTEL
        'cg': '1459646308145955019',
        'c1': '1459646253746098409',
        'c2': '1459646266630996009',
        'c3': '1459646277766611049',
        'c4': '1459646293264826723',

        // 🆘 SOPORTE (Requiere Staff)
        's1': '1412956423662469293',
        's2': '1412956477789966379',
        's3': '1412956507825377343',

        // 🎭 ROL - AMBIENTES
        'a1': '1412966846273163396',
        'a2': '1459642544441786521',
        'a3': '1459642568756297951',
        'a4': '1459643217996943683',

        // 🎭 ROL - ESCENARIOS
        'e1': '1459642733097652235',
        'e2': '1459643100157841640',
        'e3': '1459643138728792074',
        'e4': '1459643117929238550',
        'e5': '1459643177056080049',
        'e6': '1459643198438768873'
    },

    // Configuración de Permisos por Canal
    CHANNELS: {
        // Junta Directiva
        '1412956722469011657': { name: 'Junta Directiva', requiredRole: 'JUNTA_DIRECTIVA' },

        // Staff
        '1412956666512543751': { name: 'Staff', requiredRole: 'STAFF' },
        '1459640433297588401': { name: 'Canal de Espera', requiredRole: null, noTTS: true },

        // Policía
        '1459646170476314765': { name: 'Policía General', requiredRole: 'POLICIA' },
        '1459645796256317617': { name: 'Policía 1', requiredRole: 'POLICIA' },
        '1459646124079054929': { name: 'Policía 2', requiredRole: 'POLICIA' },
        '1459646138498945368': { name: 'Policía 3', requiredRole: 'POLICIA' },
        '1459646153619669165': { name: 'Policía 4', requiredRole: 'POLICIA' },

        // Policía Federal
        '1461133946703314985': { name: 'Policía Federal 1', requiredRole: 'POLICIA_FEDERAL', noTTS: false },
        '1461133995944185998': { name: 'Policía Federal 2', requiredRole: 'POLICIA_FEDERAL', noTTS: false },

        // AIC (solo usuarios con rol AIC)
        '1461129202450300988': { name: 'AIC 1', requiredRole: 'AIC', noTTS: false },
        '1461129229277335765': { name: 'AIC 2', requiredRole: 'AIC', noTTS: false },

        // Paramédicos (solo usuarios con rol PARAMEDICO)
        '1459948822024159262': { name: 'Médico General', requiredRole: 'PARAMEDICO' },

        // Bomberos (solo usuarios con rol BOMBERO)
        '1459948849601712381': { name: 'Bomberos General', requiredRole: 'BOMBERO' },

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
        '1412956423662469293': { name: 'Soporte 1', requiredRole: 'STAFF' },
        '1412956477789966379': { name: 'Soporte 2', requiredRole: 'STAFF' },
        '1412956507825377343': { name: 'Soporte 3', requiredRole: 'STAFF' }
    },

    getChannelInfo(channelId) {
        return this.CHANNELS[channelId] || null;
    },

    getIdFromAlias(alias) {
        return this.ALIASES[alias.toLowerCase()] || null;
    }
};

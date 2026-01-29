// ERLC Emergency & Economy Configuration
module.exports = {
    // Channels - Using staff logs for everything to simplify
    CHANNELS: {
        EMERGENCY_911: '1459942641541189714', // Dedicated 911 emergencies channel (newly created)
        STAFF_LOGS: '1459935483047051347',    // Staff logs (transactions, cobros, etc.)
        PAYMENT_REQUESTS: '1459935483047051347' // Same as staff logs
    },

    // Emergency Response Roles
    EMERGENCY_ROLES: {
        // Principal Roles
        EJERCITO: '1412898905842122872',
        FEC: '1459674442501456074',
        INFANTERIA_MARINA: '1412898908706963507',
        SSPC: '1457135315323195432',
        GUARDIA_NACIONAL: '1412898911185797310',
        AIC: '1412898916021829903',
        POLICIA_FEDERAL: '1412898913345863760',
        POLICIA_ESTATAL: '1455037616054341704',
        POLICIA_TRANSITO: '1416867605976715363',
        CARTEL: '1412899393493012540',
        CRIMINAL: '1412899390108209183',

        // Secondary Roles
        PRESIDENTE: '1412887183089471568',
        VICEPRESIDENTE: '1466165678980464802',
        SEC_ECONOMIA: '1466248918294593586',
        SEC_DEFENSA: '1466248809196818474',
        SEC_AMBIENTAL: '1466249013891305544',
        SEC_SALUD: '1466249089447497984',
        BOMBERO: '1412899382436827369',
        CAFETERO: '1457789055608557608',
        DOT: '1412899385519640707',
        GASOLINERO: '1458505462768079092',
        PARAMEDICO: '1413540726100332574',
        BASURERO: '1413540735487053924',
        REPORTERO: '1413540732760883311',
        JUEZ: '1413541371503185961',
        ABOGADO: '1412891683535982632',

        // Legacy/Other
        USCIS: '1457949662181851415'
    },

    // Categorization
    PRINCIPAL_JOBS: [
        '1412898905842122872', // Ejercito
        '1459674442501456074', // FEC
        '1412898908706963507', // Infantería de Marina
        '1457135315323195432', // SSPC
        '1412898911185797310', // Guardia Nacional
        '1412898916021829903', // AIC
        '1412898913345863760', // Policia federal
        '1455037616054341704', // Policía estatal
        '1416867605976715363', // Policía de tránsito
        '1412899393493012540', // Cartel
        '1412899390108209183'  // Criminal
    ],

    SECONDARY_JOBS: [
        '1412887183089471568', // Presidente
        '1466165678980464802', // Vicepresidente
        '1466248918294593586', // Sec. Economia
        '1466248809196818474', // Sec. Defensa
        '1466249013891305544', // Sec. Ambiental
        '1466249089447497984', // Sec. Salud
        '1412899382436827369', // Bombero
        '1457789055608557608', // Cafetero
        '1412899385519640707', // DOT
        '1458505462768079092', // Gasolinero
        '1413540726100332574', // Paramédico
        '1413540735487053924', // Basurero
        '1413540732760883311', // Reportero
        '1413541371503185961', // Juez
        '1412891683535982632'  // Abogado
    ],

    // Emergency Categories (for selective pinging)
    EMERGENCY_CATEGORIES: {
        'policia': ['POLICIA_FEDERAL', 'POLICIA_ESTATAL', 'POLICIA_TRANSITO', 'GUARDIA_NACIONAL'],
        'militar': ['EJERCITO', 'FEC', 'INFANTERIA_MARINA', 'SSPC'],
        'medico': ['PARAMEDICO'],
        'fuego': ['BOMBERO'],
        'gobierno': ['PRESIDENTE', 'VICEPRESIDENTE', 'SEC_ECONOMIA', 'SEC_DEFENSA', 'SEC_AMBIENTAL', 'SEC_SALUD'],
        'todos': ['POLICIA_FEDERAL', 'POLICIA_ESTATAL', 'POLICIA_TRANSITO', 'GUARDIA_NACIONAL',
            'EJERCITO', 'FEC', 'INFANTERIA_MARINA', 'SSPC', 'PARAMEDICO', 'BOMBERO', 'PRESIDENTE']
    },

    // Transaction limits
    TRANSACTION_LIMITS: {
        MAX_AMOUNT: 50000,
        MIN_AMOUNT: 1,
        COOLDOWN_MS: 10000 // 10 seconds
    },

    // Payment request settings
    PAYMENT_REQUEST: {
        TIMEOUT_MS: 300000 // 5 minutes
    },

    // Emergency voice channels for 911 alerts
    EMERGENCY_VOICE_CHANNELS: [
        '1459948822024159262', // Paramédicos
        '1459948849601712381', // Bomberos
        '1459646170476314765', // Policía 1
        '1459645796256317617', // Policía 2
        '1459646124079054929', // Policía 3
        '1459646138498945368', // Policía 4
        '1459646153619669165'  // Policía 5
    ]
};

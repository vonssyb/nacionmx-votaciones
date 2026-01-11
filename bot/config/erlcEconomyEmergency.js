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
        EJERCITO: '1412898905842122872',
        FEC: '1459674442501456074',
        INFANTERIA_MARINA: '1412898908706963507',
        SSPC: '1457135315323195432',
        GUARDIA_NACIONAL: '1412898911185797310',
        AIC: '1412898916021829903',
        POLICIA_FEDERAL: '1412898913345863760',
        USCIS: '1457949662181851415',
        POLICIA_ESTATAL: '1455037616054341704',
        POLICIA_TRANSITO: '1416867605976715363',
        BOMBERO: '1412899382436827369',
        PARAMEDICO: '1413540726100332574'
    },

    // Emergency Categories (for selective pinging)
    EMERGENCY_CATEGORIES: {
        'policia': ['POLICIA_FEDERAL', 'POLICIA_ESTATAL', 'POLICIA_TRANSITO', 'GUARDIA_NACIONAL'],
        'militar': ['EJERCITO', 'FEC', 'INFANTERIA_MARINA', 'SSPC'],
        'medico': ['PARAMEDICO'],
        'fuego': ['BOMBERO'],
        'todos': ['POLICIA_FEDERAL', 'POLICIA_ESTATAL', 'POLICIA_TRANSITO', 'GUARDIA_NACIONAL',
            'EJERCITO', 'FEC', 'INFANTERIA_MARINA', 'SSPC', 'PARAMEDICO', 'BOMBERO']
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
    }
};

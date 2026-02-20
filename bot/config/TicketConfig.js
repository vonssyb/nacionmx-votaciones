/**
 * Ticket System Configuration
 * Centralizes all IDs, Roles, and Constants for the ticket system.
 */

const TICKET_CONFIG = {
    // Categories
    CATEGORIES: {
        GENERAL: '1414066417019392000',
        VIP: '1450225651935219854',
        BUGS: '1459987769932648680',
        MCQUEEN: '1466551872750878769' // From mcqueenTicketHandler
    },

    // Roles
    ROLES: {
        STAFF_COMMON: '1412887167654690908', // Staff
        STAFF_ADMIN: '1412882248411381872',  // Administración
        STAFF_GENERAL: '1412887079612059660', // Staff General
        BLACKLIST_MOD: '1451703422800625777', // Encargado de Blacklists
        CK_MOD: '1450938106395234526',        // Encargado de CKs
        BANKER: '1450591546524307689',        // Banquero for Loans
        MCQUEEN_SALES: '1466558863342964800', // Asesor de ventas McQueen
        VIP_ACCESS: ['1414033620636532849', '1412887172503175270', '1423520675158691972', '1449950535166726317']
    },

    // Logs
    LOGS: {
        TRANSCRIPTS: '1414065296704016465',
        FEEDBACK: '1412964502114402384'
    },

    // Users
    USERS: {
        DEV: '826637667718266880'
    },

    // Ticket Types Configuration
    TYPES: {
        'ticket_general': {
            id: 'ticket_general',
            title: 'Soporte General',
            categoryId: 'GENERAL',
            roleId: 'STAFF_COMMON',
            emoji: '🔧',
            prefix: 'soporte'
        },
        'ticket_reportes': {
            id: 'ticket_reportes',
            title: 'Reportes y Sanciones',
            categoryId: 'GENERAL',
            roleId: 'STAFF_COMMON',
            emoji: '🚨',
            prefix: 'reporte'
        },
        'ticket_blacklist': {
            id: 'ticket_blacklist',
            title: 'Blacklist | Apelación',
            categoryId: 'GENERAL',
            roleId: 'BLACKLIST_MOD',
            emoji: '📜',
            prefix: 'apelacion'
        },
        'ticket_trabajo': {
            id: 'ticket_trabajo',
            title: 'Facciones y Trabajo',
            categoryId: 'GENERAL',
            roleId: 'STAFF_COMMON',
            emoji: '💼',
            prefix: 'faccion'
        },
        'ticket_prestamo': {
            id: 'ticket_prestamo',
            title: 'Solicitud de Préstamo',
            categoryId: 'GENERAL',
            roleId: 'BANKER',
            emoji: '💰',
            prefix: 'prestamo'
        },
        'ticket_ck': {
            id: 'ticket_ck',
            title: 'Solicitud FEC / CK',
            categoryId: 'GENERAL',
            roleId: 'CK_MOD',
            emoji: '☠️',
            prefix: 'ck'
        },
        'ticket_vip': {
            id: 'ticket_vip',
            title: 'Atención VIP',
            categoryId: 'VIP',
            roleId: 'STAFF_COMMON',
            emoji: '💎',
            vipOnly: true,
            prefix: 'vip'
        },
        'ticket_bug': {
            id: 'ticket_bug',
            title: 'Falla con el Bot',
            categoryId: 'BUGS',
            roleId: null,
            pingUserId: 'DEV',
            emoji: '🤖',
            prefix: 'bug'
        },
        // McQueen Specific Types - Merging them here for unification
        'ticket_compra_vehiculo': {
            id: 'ticket_compra_vehiculo',
            title: 'Compra de Vehículo',
            categoryId: 'MCQUEEN',
            roleId: 'MCQUEEN_SALES',
            emoji: '🚙',
            prefix: 'venta'
        },
        'ticket_soporte_tecnico': {
            id: 'ticket_soporte_tecnico',
            title: 'Soporte Técnico (McQueen)',
            categoryId: 'MCQUEEN',
            roleId: 'MCQUEEN_SALES',
            emoji: '🔧',
            prefix: 'taller'
        },
        'ticket_agendar_cita': {
            id: 'ticket_agendar_cita',
            title: 'Agendar Cita',
            categoryId: 'MCQUEEN',
            roleId: 'MCQUEEN_SALES',
            emoji: '📅',
            prefix: 'cita'
        },
        'ticket_recursos_humanos': {
            id: 'ticket_recursos_humanos',
            title: 'Recursos Humanos (McQueen)',
            categoryId: 'MCQUEEN',
            roleId: 'MCQUEEN_SALES',
            emoji: '💼',
            prefix: 'rrhh'
        }
    }
};

module.exports = TICKET_CONFIG;

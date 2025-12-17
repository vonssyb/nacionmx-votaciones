// =====================================================
// FINANCIAL SYSTEM COMMANDS
// Debit Cards, Balance, Taxes, Transfers
// =====================================================

// Command definitions to add to bot/index.js commands array

const financialCommands = [
    // ===== DEBITO COMMAND =====
    {
        name: 'debito',
        description: 'Gestion de Tarjeta de Debito',
        options: [
            {
                name: 'estado',
                description: 'Ver balance de tu tarjeta de debito',
                type: 1
            },
            {
                name: 'depositar',
                description: 'Depositar efectivo a debito - Tarda 4 horas',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a depositar', type: 10, required: true }
                ]
            },
            {
                name: 'transferir',
                description: 'Transferir de debito a debito - Tarda 5 minutos',
                type: 1,
                options: [
                    { name: 'destinatario', description: 'Usuario receptor', type: 6, required: true },
                    { name: 'monto', description: 'Cantidad a transferir', type: 10, required: true },
                    { name: 'razon', description: 'Concepto opcional', type: 3, required: false }
                ]
            },
            {
                name: 'historial',
                description: 'Ver ultimas 10 transacciones de debito',
                type: 1
            }
        ]
    },

    // ===== BALANZA COMMAND =====
    {
        name: 'balanza',
        description: 'Ver tu balanza financiera completa - Efectivo, Debito, Credito'
    },

    // ===== IMPUESTOS COMMAND (updated) =====
    {
        name: 'impuestos',
        description: 'Sistema de Impuestos Dinamicos',
        options: [
            {
                name: 'pendientes',
                description: 'Ver impuestos pendientes de pago',
                type: 1
            },
            {
                name: 'pagar',
                description: 'Pagar impuestos pendientes',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a pagar opcional - Default: total', type: 10, required: false }
                ]
            },
            {
                name: 'historial',
                description: 'Ver historial de pagos',
                type: 1
            }
        ]
    }
];

module.exports = { financialCommands };

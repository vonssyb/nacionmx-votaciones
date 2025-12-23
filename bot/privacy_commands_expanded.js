// PRIVACY ENHANCEMENTS - Add to commands.js
// Add these new subcommands to /privacidad command

// Replace the existing /privacidad command with this expanded version
{
    name: 'privacidad',
        description: '🕶️ Sistema de Privacidad Bancaria',
            options: [
                {
                    name: 'activar',
                    description: 'Activar protección de privacidad',
                    type: 1,
                    options: [{
                        name: 'nivel',
                        description: 'Nivel de protección',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '🥉 Básico ($50k/mes)', value: 'basico' },
                            { name: '🥈 VIP ($150k/mes)', value: 'vip' },
                            { name: '🥇 Elite ($500k/mes)', value: 'elite' }
                        ]
                    }]
                },
                {
                    name: 'trial',
                    description: '🎁 3 días gratis de privacidad Básica',
                    type: 1
                },
                {
                    name: 'desactivar',
                    description: 'Desactivar privacidad',
                    type: 1
                },
                {
                    name: 'estado',
                    description: 'Ver tu nivel de privacidad actual',
                    type: 1
                },
                {
                    name: 'dashboard',
                    description: '📊 Ver estadísticas completas',
                    type: 1
                },
                {
                    name: 'upgrade',
                    description: 'Mejorar tu nivel de privacidad',
                    type: 1,
                    options: [{
                        name: 'nuevo_nivel',
                        description: 'Nuevo nivel',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'VIP', value: 'vip' },
                            { name: 'Elite', value: 'elite' }
                        ]
                    }]
                },
                {
                    name: 'boveda',
                    description: 'Gestionar bóveda de emergencia (Elite)',
                    type: 1,
                    options: [
                        {
                            name: 'accion',
                            description: 'Acción',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Depositar', value: 'depositar' },
                                { name: 'Retirar', value: 'retirar' },
                                { name: 'Ver', value: 'ver' }
                            ]
                        },
                        { name: 'monto', description: 'Cantidad', type: 10, required: false }
                    ]
                },
                {
                    name: 'offshore',
                    description: 'Configurar nombre offshore (Elite)',
                    type: 1,
                    options: [{ name: 'nombre', description: 'Nombre falso para transacciones', type: 3, required: true }]
                },
                {
                    name: 'panico',
                    description: 'Activar modo pánico (Elite)',
                    type: 1,
                    options: [{ name: 'pin', description: 'PIN de 6 dígitos', type: 3, required: true }]
                },
                {
                    name: 'recuperar',
                    description: '🔓 Recuperar de modo pánico',
                    type: 1,
                    options: [{ name: 'pin', description: 'PIN usado al activar', type: 3, required: true }]
                },
                {
                    name: 'alertas',
                    description: '🔔 Configurar alertas de seguridad',
                    type: 1,
                    options: [{
                        name: 'estado',
                        description: 'Activar/Desactivar',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Activar', value: 'on' },
                            { name: 'Desactivar', value: 'off' }
                        ]
                    }]
                },
                {
                    name: 'autorenovar',
                    description: '♻️ Auto-renovación mensual',
                    type: 1,
                    options: [{
                        name: 'estado',
                        description: 'Activar/Desactivar',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Activar', value: 'on' },
                            { name: 'Desactivar', value: 'off' }
                        ]
                    }]
                },
                {
                    name: 'viaje',
                    description: '✈️ Activar privacidad temporal',
                    type: 1,
                    options: [{
                        name: 'horas',
                        description: 'Duración en horas (24-72)',
                        type: 4,
                        required: true,
                        min_value: 24,
                        max_value: 72
                    }]
                },
                {
                    name: 'referir',
                    description: '🎁 Referir a un amigo (10% descuento)',
                    type: 1,
                    options: [{ name: 'usuario', description: 'Usuario a referir', type: 6, required: true }]
                },
                {
                    name: 'familia',
                    description: '👨‍👩‍👧 Compartir privacidad con familia',
                    type: 1,
                    options: [
                        {
                            name: 'accion',
                            description: 'Acción',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Agregar', value: 'add' },
                                { name: 'Remover', value: 'remove' },
                                { name: 'Ver', value: 'list' }
                            ]
                        },
                        { name: 'miembro', description: 'Miembro familiar', type: 6, required: false }
                    ]
                },
                {
                    name: 'score',
                    description: '📈 Ver tu Privacy Score',
                    type: 1
                }
            ]
}

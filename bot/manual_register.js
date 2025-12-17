require('dotenv').config({ path: '../.env' }); // Load from root .env if run from bot/
const { REST, Routes } = require('discord.js');

const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;
const CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID || '1449884793398493349'; // Fallback or strict

if (!DISCORD_TOKEN) {
    console.error('❌ Error: No se encontró DISCORD_TOKEN en .env');
    process.exit(1);
}

const commands = [
    {
        name: 'ping',
        description: 'Comprueba si el bot está vivo',
        type: 1
    },
    {
        name: 'fichar',
        description: 'Inicia o Termina tu turno (Entrada/Salida)',
        options: [
            {
                name: 'vincular',
                description: 'Vincular ciudadano al sistema (Solo Bancarios)',
                type: 1, // SUB_COMMAND
                options: [
                    { name: 'usuario', description: 'Usuario de Discord a vincular', type: 6, required: true },
                    { name: 'nombre', description: 'Nombre y Apellido RP', type: 3, required: true },
                    { name: 'dni', description: 'Foto del DNI', type: 11, required: true }
                ]
            }
        ]
    },
    {
        name: 'ayuda',
        description: 'Muestra los comandos bancarios disponibles (Cheat Sheet)',
        type: 1
    },
    {
        name: 'estado',
        description: 'Cambia el estado del servidor (CMD Staff)',
        options: [
            {
                name: 'seleccion',
                description: 'Nuevo estado del servidor',
                type: 3,
                required: true,
                choices: [
                    { name: '🟢 Abierto', value: 'open' },
                    { name: '🟠 Mantenimiento', value: 'maintenance' },
                    { name: '🔴 Cerrado', value: 'closed' }
                ]
            }
        ]
    },
    {
        name: 'registrar-tarjeta',
        description: 'Registrar nueva tarjeta (Staff Banco)',
        options: [
            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true },
            { name: 'nombre_titular', description: 'Nombre completo del titular (RP)', type: 3, required: true },
            {
                name: 'tipo',
                description: 'Nivel de la tarjeta',
                type: 3,
                required: true,
                choices: [
                    { name: 'NMX Start ($2k)', value: 'NMX Start' },
                    { name: 'NMX Básica ($4k)', value: 'NMX Básica' },
                    { name: 'NMX Plus ($6k)', value: 'NMX Plus' },
                    { name: 'NMX Plata ($10k)', value: 'NMX Plata' },
                    { name: 'NMX Oro ($15k)', value: 'NMX Oro' },
                    { name: 'NMX Rubí ($25k)', value: 'NMX Rubí' },
                    { name: 'NMX Black ($40k)', value: 'NMX Black' },
                    { name: 'NMX Diamante ($60k)', value: 'NMX Diamante' }
                ]
            },
            { name: 'foto_dni', description: 'Foto del DNI/Identificación', type: 11, required: true },
            { name: 'notas', description: 'Notas opcionales', type: 3, required: false }
        ]
    },
    {
        name: 'credito',
        description: 'Gestión de tu tarjeta de crédito NMX',
        options: [
            {
                name: 'estado',
                description: 'Ver tu deuda y estado actual',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta (Visible solo para ti)',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'pedir-prestamo',
                description: 'Retira efectivo de tu tarjeta (Se suma a tu deuda)',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'monto',
                        description: 'Cantidad a retirar',
                        type: 10, // NUMBER
                        required: true
                    },
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta (Visible solo para ti)',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'pagar',
                description: 'Abona dinero a tu tarjeta de crédito',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'monto',
                        description: 'Cantidad a pagar',
                        type: 10, // NUMBER
                        required: true
                    },
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta (Visible solo para ti)',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'buro',
                description: 'Ver tu Score de Buró Financiero',
                type: 1
            },
            {
                name: 'info',
                description: 'Ver detalles del plástico (Titular, Nivel, Fecha)',
                type: 1
            },
            {
                name: 'admin',
                description: 'Herramientas Administrativas (Staff)',
                type: 2, // SUB_COMMAND_GROUP
                options: [
                    {
                        name: 'puntos',
                        description: 'Modificar Score de Buró (Staff)',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario afectado', type: 6, required: true },
                            { name: 'cantidad', description: 'Puntos a sumar (o restar con -)', type: 4, required: true },
                            { name: 'razon', description: 'Motivo del ajuste', type: 3, required: true }
                        ]
                    },
                    {
                        name: 'perdonar',
                        description: 'Perdonar la deuda de un usuario',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'congelar',
                        description: 'Congelar una tarjeta (No podrá usarse)',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'descongelar',
                        description: 'Reactivar una tarjeta congelada',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'info',
                        description: 'Ver información completa de un usuario',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'ofrecer-upgrade',
                        description: 'Enviar oferta de mejora de tarjeta por DM (Requiere buen Score)',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Cliente a evaluar', type: 6, required: true }
                        ]
                    }
                ]
            },
            {
                name: 'debug',
                description: 'Diagnóstico de cuenta (Usar si fallan comandos)',
                type: 1
            }
        ]
    },
    {
        name: 'rol',
        description: 'Gestión de Roles y Sanciones',
        options: [
            {
                name: 'cancelar',
                description: 'Reportar cancelación de rol de un usuario',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario sancionado (Nombre/ID)', type: 3, required: true },
                    { name: 'razon', description: 'Motivo de la cancelación', type: 3, required: true },
                    { name: 'ubicacion', description: 'Lugar de los hechos/arresto', type: 3, required: true },
                    { name: 'prueba1', description: 'Evidencia principal (Imagen)', type: 11, required: true },
                    { name: 'prueba2', description: 'Evidencia secundaria (Imagen)', type: 11 }
                ]
            }
        ]
    },

    {
        name: 'multa',
        description: 'Imponer una multa a un ciudadano (Policía)',
        options: [
            { name: 'usuario', description: 'Ciudadano a multar', type: 6, required: true },
            { name: 'monto', description: 'Monto de la multa', type: 10, required: true },
            { name: 'razon', description: 'Motivo de la infracción', type: 3, required: true }
        ]
    },
    {
        name: 'transferir',
        description: 'Enviar dinero a otro ciudadano (Sistema SPEI)',
        options: [
            { name: 'destinatario', description: 'Ciudadano que recibirá el dinero', type: 6, required: true },
            { name: 'monto', description: 'Cantidad a transferir', type: 10, required: true },
            { name: 'razon', description: 'Concepto de la transferencia', type: 3, required: false }
        ]
    },
    {
        name: 'movimientos',
        description: 'Ver historial de tus últimas transacciones',
        type: 1
    },
    {
        name: 'notificaciones',
        description: 'Activar/Desactivar notificaciones del banco por DM',
        options: [
            { name: 'activo', description: '¿Recibir notificaciones?', type: 5, required: true }
        ]
    },
    {
        name: 'top-morosos',
        description: 'Ranking de usuarios con mayor deuda en tarjetas',
        type: 1
    },
    {
        name: 'top-ricos',
        description: 'Ranking de usuarios con mejor Score Crediticio',
        type: 1
    },
    {
        name: 'inversion',
        description: 'Sistema de Inversión a Plazo Fijo',
        options: [
            {
                name: 'nueva',
                description: 'Abrir una nueva inversión (7 días, 5% rendimiento)',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a bloquear', type: 10, required: true }
                ]
            },
            {
                name: 'estado',
                description: 'Ver mis inversiones activas y retirar ganancias',
                type: 1
            }
        ]
    },
    {
        name: 'impuestos',
        description: 'Consulta tu estado fiscal con el SAT',
        type: 1
    },
    {
        name: 'nomina',
        description: 'Gestión de Nóminas para Empresas',
        options: [
            {
                name: 'crear',
                description: 'Crear un nuevo grupo de pago',
                type: 1,
                options: [{ name: 'nombre', description: 'Nombre del grupo (ej. Taller)', type: 3, required: true }]
            },
            {
                name: 'agregar',
                description: 'Agregar empleado al grupo',
                type: 1,
                options: [
                    { name: 'grupo', description: 'Nombre del grupo', type: 3, required: true },
                    { name: 'empleado', description: 'Usuario a pagar', type: 6, required: true },
                    { name: 'sueldo', description: 'Monto a pagar', type: 10, required: true }
                ]
            },
            {
                name: 'pagar',
                description: 'Pagar a todos los empleados del grupo',
                type: 1,
                options: [{ name: 'grupo', description: 'Nombre del grupo', type: 3, required: true }]
            }
        ]
    },
    {
        name: 'bolsa',
        description: 'Ver precios de acciones (Roleplay)',
        type: 1
    }
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🚀 Iniciando registro manual de ${commands.length} comandos...`);
        console.log(`🎯 Client ID: ${CLIENT_ID}`);
        console.log(`🏰 Guild ID: ${GUILD_ID}`);

        if (GUILD_ID) {
            console.log('📡 Enviando petición a Discord API (Guild)...');
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('✅ ÉXITO: Todos los comandos han sido registrados en el servidor.');
        } else {
            console.log('⚠️ Registrando Globalmente...');
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands }
            );
            console.log('✅ ÉXITO: Comandos globales registrados.');
        }
    } catch (error) {
        console.error('❌ ERROR FATAL:', error);
    }
})();

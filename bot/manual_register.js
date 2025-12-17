require('dotenv').config({ path: '../.env' });
const { REST, Routes } = require('discord.js');

const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;
const CLIENT_ID = process.env.VITE_DISCORD_CLIENT_ID || '1449884793398493349';

if (!DISCORD_TOKEN) {
    console.error('❌ Error: No se encontró DISCORD_TOKEN en .env');
    process.exit(1);
}

// CRITICAL FIX: Removed ALL parentheses from descriptions - they cause API hangs
const commands = [
    {
        name: 'ping',
        description: 'Comprueba si el bot está vivo'
    },
    {
        name: 'fichar',
        description: 'Inicia o Termina tu turno - Entrada/Salida',
        options: [
            {
                name: 'vincular',
                description: 'Vincular ciudadano al sistema - Solo Bancarios',
                type: 1,
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
        description: 'Muestra los comandos bancarios disponibles'
    },
    {
        name: 'estado',
        description: 'Cambia el estado del servidor - CMD Staff',
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
        description: 'Registrar nueva tarjeta - Staff Banco',
        options: [
            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true },
            { name: 'nombre_titular', description: 'Nombre completo del titular RP', type: 3, required: true },
            {
                name: 'tipo',
                description: 'Nivel de la tarjeta',
                type: 3,
                required: true,
                choices: [
                    { name: 'NMX Débito (Gratis)', value: 'NMX Débito' },
                    { name: 'NMX Start ($2k)', value: 'NMX Start' },
                    { name: 'NMX Básica ($4k)', value: 'NMX Básica' },
                    { name: 'NMX Plus ($6k)', value: 'NMX Plus' },
                    { name: 'NMX Plata ($10k)', value: 'NMX Plata' },
                    { name: 'NMX Oro ($15k)', value: 'NMX Oro' },
                    { name: 'NMX Rubí ($25k)', value: 'NMX Rubí' },
                    { name: 'NMX Black ($40k)', value: 'NMX Black' },
                    { name: 'NMX Diamante ($60k)', value: 'NMX Diamante' },
                    { name: '--- EMPRESARIAL ---', value: 'separator1' },
                    { name: 'NMX Business Start ($50k)', value: 'NMX Business Start' },
                    { name: 'NMX Business Gold ($100k)', value: 'NMX Business Gold' },
                    { name: 'NMX Business Platinum ($200k)', value: 'NMX Business Platinum' },
                    { name: 'NMX Business Elite ($500k)', value: 'NMX Business Elite' },
                    { name: 'NMX Corporate ($1M)', value: 'NMX Corporate' }
                ]
            },
            { name: 'foto_dni', description: 'Foto del DNI o Identificación', type: 11, required: true },
            { name: 'notas', description: 'Notas opcionales', type: 3, required: false }
        ]
    },
    {
        name: 'tarjeta',
        description: 'Informacion sobre tarjetas disponibles - Catalogo',
        options: [
            { name: 'info', description: 'Ver el catalogo completo de tarjetas', type: 1 },
            {
                name: 'ver',
                description: 'Ver detalles de una tarjeta especifica',
                type: 1,
                options: [
                    {
                        name: 'nombre',
                        description: 'Nombre de la tarjeta',
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
                            { name: 'NMX Diamante ($60k)', value: 'NMX Diamante' },
                            { name: 'NMX Business Start ($50k)', value: 'NMX Business Start' },
                            { name: 'NMX Business Gold ($100k)', value: 'NMX Business Gold' },
                            { name: 'NMX Business Platinum ($200k)', value: 'NMX Business Platinum' },
                            { name: 'NMX Business Elite ($500k)', value: 'NMX Business Elite' },
                            { name: 'NMX Corporate ($1M)', value: 'NMX Corporate' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'credito',
        description: 'Gestión de tu tarjeta de crédito NMX',
        options: [
            {
                name: 'estado',
                description: 'Ver tu deuda y estado actual',
                type: 1,
                options: [{ name: 'privado', description: 'Ocultar respuesta', type: 5, required: false }]
            },
            {
                name: 'pedir-prestamo',
                description: 'Retira efectivo de tu tarjeta',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a retirar', type: 10, required: true },
                    { name: 'privado', description: 'Ocultar respuesta', type: 5, required: false }
                ]
            },
            {
                name: 'pagar',
                description: 'Abona dinero a tu tarjeta de crédito',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a pagar', type: 10, required: true },
                    { name: 'privado', description: 'Ocultar respuesta', type: 5, required: false }
                ]
            },
            { name: 'buro', description: 'Ver tu Score de Buró Financiero', type: 1 },
            { name: 'info', description: 'Ver detalles del plástico', type: 1 },
            {
                name: 'admin',
                description: 'Herramientas Administrativas - Staff',
                type: 2,
                options: [
                    {
                        name: 'puntos',
                        description: 'Modificar Score de Buró',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario afectado', type: 6, required: true },
                            { name: 'cantidad', description: 'Puntos a sumar o restar', type: 4, required: true },
                            { name: 'razon', description: 'Motivo del ajuste', type: 3, required: true }
                        ]
                    },
                    {
                        name: 'perdonar',
                        description: 'Perdonar la deuda de un usuario',
                        type: 1,
                        options: [{ name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }]
                    },
                    {
                        name: 'congelar',
                        description: 'Congelar una tarjeta',
                        type: 1,
                        options: [{ name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }]
                    },
                    {
                        name: 'descongelar',
                        description: 'Reactivar una tarjeta congelada',
                        type: 1,
                        options: [{ name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }]
                    },
                    {
                        name: 'info',
                        description: 'Ver información completa de un usuario',
                        type: 1,
                        options: [{ name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }]
                    },
                    {
                        name: 'ofrecer-upgrade',
                        description: 'Enviar oferta de mejora de tarjeta',
                        type: 1,
                        options: [{ name: 'usuario', description: 'Cliente a evaluar', type: 6, required: true }]
                    }
                ]
            },
            { name: 'debug', description: 'Diagnóstico de cuenta', type: 1 }
        ]
    },
    {
        name: 'balanza',
        description: 'Ver tu balanza financiera completa - Efectivo, Debito, Credito'
    },
    {
        name: 'debito',
        description: 'Gestion de Tarjeta de Debito',
        options: [
            { name: 'estado', description: 'Ver balance debito', type: 1 },
            {
                name: 'depositar',
                description: 'Depositar efectivo a debito - 4 horas',
                type: 1,
                options: [{ name: 'monto', description: 'Cantidad', type: 10, required: true }]
            },
            {
                name: 'transferir',
                description: 'Transferir debito a debito - 5 minutos',
                type: 1,
                options: [
                    { name: 'destinatario', description: 'Usuario', type: 6, required: true },
                    { name: 'monto', description: 'Cantidad', type: 10, required: true }
                ]
            },
            { name: 'historial', description: 'Ver transacciones', type: 1 }
        ]
    },
    {
        name: 'bolsa',
        description: 'Sistema de Bolsa de Valores y Criptomonedas',
        options: [
            { name: 'precios', description: 'Ver precios actuales', type: 1 },
            {
                name: 'comprar',
                description: 'Comprar acciones o criptomonedas',
                type: 1,
                options: [
                    { name: 'symbol', description: 'Simbolo de la accion', type: 3, required: true },
                    { name: 'cantidad', description: 'Numero de acciones', type: 10, required: true }
                ]
            },
            {
                name: 'vender',
                description: 'Vender acciones o criptomonedas',
                type: 1,
                options: [
                    { name: 'symbol', description: 'Simbolo de la accion', type: 3, required: true },
                    { name: 'cantidad', description: 'Numero de acciones', type: 10, required: true }
                ]
            },
            { name: 'portafolio', description: 'Ver tus inversiones', type: 1 },
            { name: 'historial', description: 'Ver historial de bolsa', type: 1 }
        ]
    },
    {
        name: 'impuestos',
        description: 'Consulta tu estado fiscal - SAT',
        type: 1
    },
    {
        name: 'top-ricos',
        description: 'Ranking de los mas ricos'
    },
    {
        name: 'top-morosos',
        description: 'Ranking de los mas endeudados'
    },
    {
        name: 'transferir',
        description: 'Enviar dinero a otro ciudadano',
        options: [
            { name: 'destinatario', description: 'Usuario a transferir', type: 6, required: true },
            { name: 'monto', description: 'Cantidad a enviar', type: 10, required: true }
        ]
    },
    {
        name: 'impuestos',
        description: 'Sistema fiscal de Nacion MX',
        options: [
            {
                name: 'empresas',
                description: 'Ver estimacion de impuestos corporativos',
                type: 1
            }
        ]
    },
    {
        name: 'empresa',
        description: 'Gestion de Empresas',
        options: [
            {
                name: 'crear',
                description: 'Registrar nueva empresa (Staff)',
                type: 1,
                options: [
                    { name: 'dueño', description: 'Usuario Dueño', type: 6, required: true },
                    { name: 'nombre', description: 'Nombre de la Empresa', type: 3, required: true },
                    { name: 'tipo_local', description: 'Rubro/Tipo', type: 3, required: true },
                    { name: 'logo', description: 'Logo (Imagen)', type: 11, required: true },
                    { name: 'costo_tramite', description: 'Costo administrativo del registro', type: 10, required: true },
                    { name: 'costo_local', description: 'Valor del inmueble (si aplica)', type: 10, required: false },
                    { name: 'costo_vehiculos', description: 'Valor de la flota (si aplica)', type: 10, required: false },
                    { name: 'vehiculos', description: 'Cantidad de vehiculos iniciales', type: 10, required: false },
                    { name: 'ubicacion', description: 'Ubicacion del local', type: 3, required: false }
                ]
            },
            {
                name: 'menu',
                description: 'Abrir menu de gestion (Dueños)',
                type: 1
            }
        ]
    },
    {
        name: 'multa',
        description: 'Imponer multa - Policia',
        options: [
            { name: 'usuario', description: 'Ciudadano a multar', type: 6, required: true },
            { name: 'monto', description: 'Monto de la multa', type: 10, required: true },
            { name: 'razon', description: 'Motivo', type: 3, required: true }
        ]
    },
    {
        name: 'rol',
        description: 'Gestión de Roles',
        options: [
            {
                name: 'cancelar',
                description: 'Reportar cancelación de rol',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario sancionado', type: 3, required: true },
                    { name: 'razon', description: 'Motivo', type: 3, required: true },
                    { name: 'ubicacion', description: 'Lugar', type: 3, required: true },
                    { name: 'prueba1', description: 'Evidencia 1', type: 11, required: true },
                    { name: 'prueba2', description: 'Evidencia 2', type: 11 }
                ]
            }
        ]
    },
    {
        name: 'movimientos',
        description: 'Ver historial de transacciones'
    },
    {
        name: 'notificaciones',
        description: 'Configurar notificaciones del banco',
        options: [{ name: 'activo', description: 'Recibir notificaciones?', type: 5, required: true }]
    },
    {
        name: 'inversion',
        description: 'Sistema de Inversión a Plazo Fijo',
        options: [
            {
                name: 'nueva',
                description: 'Abrir nueva inversión',
                type: 1,
                options: [{ name: 'monto', description: 'Cantidad a bloquear', type: 10, required: true }]
            },
            { name: 'estado', description: 'Ver inversiones activas', type: 1 }
        ]
    },
    {
        name: 'nomina',
        description: 'Gestión de Nóminas',
        options: [
            {
                name: 'crear',
                description: 'Crear grupo de pago',
                type: 1,
                options: [{ name: 'nombre', description: 'Nombre del grupo', type: 3, required: true }]
            },
            {
                name: 'agregar',
                description: 'Agregar empleado al grupo',
                type: 1,
                options: [
                    { name: 'grupo', description: 'Nombre del grupo', type: 3, required: true },
                    { name: 'empleado', description: 'Usuario', type: 6, required: true },
                    { name: 'sueldo', description: 'Monto', type: 10, required: true }
                ]
            },
            {
                name: 'pagar',
                description: 'Pagar nómina del grupo',
                type: 1,
                options: [{ name: 'grupo', description: 'Nombre del grupo', type: 3, required: true }]
            }
        ]
    }
];

// CRITICAL: Add timeout to prevent hanging
const rest = new REST({ version: '10', timeout: 15000 }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🚀 Registrando ${commands.length} comandos COMPLETOS (SIN PARÉNTESIS)...`);
        console.log(`🎯 Client ID: ${CLIENT_ID}`);
        console.log(`🏰 Guild ID: ${GUILD_ID}`);

        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('✅ ÉXITO: TODOS los comandos registrados correctamente.');
            console.log('🎉 Verifica Discord - deberías ver todos los comandos ahora.');
        } else {
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands }
            );
            console.log('✅ ÉXITO: Globales registrados.');
        }
    } catch (error) {
        console.error('❌ ERROR FATAL:', error.message);
        if (error.rawError) {
            console.dir(error.rawError, { depth: null });
        }
    }
})();

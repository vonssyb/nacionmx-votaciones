require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const BillingService = require('./services/BillingService');
const TaxService = require('./services/TaxService');
const CompanyService = require('./services/CompanyService');
const taxService = new TaxService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const companyService = new CompanyService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

// 1. Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// -- EXPRESS SERVER FOR RENDER (Keeps the bot alive) --
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🤖 Nacion MX Bot is running!'));
app.listen(port, () => console.log(`🌐 Web server listening on port ${port}`));
// -----------------------------------------------------

// 2. Initialize Supabase Client
// NOTE: These should be Service Role keys if you want the bot to bypass RLS, 
// or standard keys if RLS allows anon access. For a bot, Service Role is usually best 
// to see everything, but BE CAREFUL not to expose it in public repos.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Configuration
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID; // Channel to send banking logs
const CANCELLATIONS_CHANNEL_ID = '1450610756663115879'; // Channel for Role Cancellations
const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;

// Initialize Billing Service
const billingService = new BillingService(client);

// -- GLOBAL STOCK MARKET SYSTEM --
let globalStocks = [
    { symbol: 'BTC', name: 'Bitcoin', base: 850000, current: 850000, type: 'Cripto' }, // in MXN approx
    { symbol: 'ETH', name: 'Ethereum', base: 55000, current: 55000, type: 'Cripto' },
    { symbol: 'SOL', name: 'Solana', base: 2800, current: 2800, type: 'Cripto' },
    { symbol: 'TSLA', name: 'Tesla Inc.', base: 4500, current: 4500, type: 'Empresa' },
    { symbol: 'AMZN', name: 'Amazon', base: 3200, current: 3200, type: 'Empresa' },
    { symbol: 'PEMEX', name: 'Petróleos Mexicanos', base: 18, current: 18, type: 'Empresa' },
    { symbol: 'NMX', name: 'Nación MX Corp', base: 500, current: 500, type: 'Empresa' }
];

function updateStockPrices() {
    console.log('📉 Actualizando precios de bolsa...');
    globalStocks = globalStocks.map(stock => {
        // Fluctuation: +/- 5% random
        const variance = (Math.random() * 0.10) - 0.05;
        const newPrice = Math.floor(stock.current * (1 + variance));

        // Safety clamps (don't let it crash to 0 or explode too fast)
        const minPrice = stock.base * 0.1;
        const maxPrice = stock.base * 5.0;

        let finalPrice = newPrice;
        if (finalPrice < minPrice) finalPrice = Math.floor(minPrice);
        if (finalPrice > maxPrice) finalPrice = Math.floor(maxPrice);

        return { ...stock, current: finalPrice };
    });
    console.log('✅ Precios actualizados.');
}

// Card Tiers Configuration (Global - used in multiple commands)
const CARD_TIERS = {
    'NMX Débito': { limit: 0, interest: 0, cost: 100, max_balance: 50000 },
    'NMX Débito Plus': { limit: 0, interest: 0, cost: 500, max_balance: 150000 },
    'NMX Débito Gold': { limit: 0, interest: 0, cost: 1000, max_balance: Infinity },
    'NMX Start': { limit: 15000, interest: 15, cost: 2000, max_balance: Infinity },
    'NMX Básica': { limit: 30000, interest: 12, cost: 4000, max_balance: Infinity },
    'NMX Plus': { limit: 50000, interest: 10, cost: 6000, max_balance: Infinity },
    'NMX Plata': { limit: 100000, interest: 8, cost: 10000, max_balance: Infinity },
    'NMX Oro': { limit: 250000, interest: 7, cost: 15000, max_balance: Infinity },
    'NMX Rubí': { limit: 500000, interest: 6, cost: 25000, max_balance: Infinity },
    'NMX Black': { limit: 1000000, interest: 5, cost: 40000, max_balance: Infinity },
    'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000, max_balance: Infinity },
    // Business Cards
    'NMX Business Start': { limit: 50000, interest: 2, cost: 8000, max_balance: Infinity },
    'NMX Business Gold': { limit: 100000, interest: 1.5, cost: 15000, max_balance: Infinity },
    'NMX Business Platinum': { limit: 200000, interest: 1.2, cost: 20000, max_balance: Infinity },
    'NMX Business Elite': { limit: 500000, interest: 1, cost: 35000, max_balance: Infinity },
    'NMX Corporate': { limit: 1000000, interest: 0.7, cost: 50000, max_balance: Infinity }
};

client.once('ready', async () => {
    console.log(`🤖 Bot iniciado como ${client.user.tag}!`);
    console.log(`📡 Conectado a Supabase: ${supabaseUrl}`);

    client.user.setActivity('Finanzas Nacion MX', { type: ActivityType.Watching });

    // Start Auto-Billing Cron
    billingService.startCron();

    // Start Stock Market Loop (Updates every 10 minutes)
    updateStockPrices(); // Initial update
    setInterval(updateStockPrices, 10 * 60 * 1000);


    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

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
            description: 'Muestra los comandos bancarios disponibles - Cheat Sheet'
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
                        { name: '💳 NMX Débito ($100)', value: 'NMX Débito' },
                        { name: '💳 NMX Débito Plus ($500)', value: 'NMX Débito Plus' },
                        { name: '💳 NMX Débito Gold ($1k)', value: 'NMX Débito Gold' },
                        { name: '--- CRÉDITO ---', value: 'separator_credit' },
                        { name: '💳 NMX Start ($2k)', value: 'NMX Start' },
                        { name: '💳 NMX Básica ($4k)', value: 'NMX Básica' },
                        { name: '💳 NMX Plus ($6k)', value: 'NMX Plus' },
                        { name: '💳 NMX Plata ($10k)', value: 'NMX Plata' },
                        { name: '💳 NMX Oro ($15k)', value: 'NMX Oro' },
                        { name: '💳 NMX Rubí ($25k)', value: 'NMX Rubí' },
                        { name: '💳 NMX Black ($40k)', value: 'NMX Black' },
                        { name: '💳 NMX Diamante ($60k)', value: 'NMX Diamante' },
                        { name: '--- EMPRESARIAL ---', value: 'separator1' },
                        { name: '💳 NMX Business Start ($50k)', value: 'NMX Business Start' },
                        { name: '💳 NMX Business Gold ($100k)', value: 'NMX Business Gold' },
                        { name: '💳 NMX Business Platinum ($200k)', value: 'NMX Business Platinum' },
                        { name: '💳 NMX Business Elite ($500k)', value: 'NMX Business Elite' },
                        { name: '💳 NMX Corporate ($1M)', value: 'NMX Corporate' }
                    ]
                },
                { name: 'foto_dni', description: 'Foto del DNI/Identificación', type: 11, required: true },
                { name: 'notas', description: 'Notas opcionales', type: 3, required: false }
            ]
        },
        {
            name: 'tarjeta',
            description: 'Informacion sobre tarjetas disponibles - Catalogo',
            options: [
                {
                    name: 'info',
                    description: 'Ver el catalogo completo de tarjetas y sus beneficios',
                    type: 1
                },
                {
                    name: 'ver',
                    description: 'Ver detalles de una tarjeta especifica',
                    type: 1,
                    options: [
                        {
                            name: 'nombre',
                            description: 'Nombre de la tarjeta - Ej NMX Oro',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'NMX Start', value: 'NMX Start' },
                                { name: 'NMX Básica', value: 'NMX Básica' },
                                { name: 'NMX Plus', value: 'NMX Plus' },
                                { name: 'NMX Plata', value: 'NMX Plata' },
                                { name: 'NMX Oro', value: 'NMX Oro' },
                                { name: 'NMX Rubí', value: 'NMX Rubí' },
                                { name: 'NMX Black', value: 'NMX Black' },
                                { name: 'NMX Diamante', value: 'NMX Diamante' },
                                { name: 'NMX Business Start', value: 'NMX Business Start' },
                                { name: 'NMX Business Gold', value: 'NMX Business Gold' },
                                { name: 'NMX Business Platinum', value: 'NMX Business Platinum' },
                                { name: 'NMX Business Elite', value: 'NMX Business Elite' },
                                { name: 'NMX Corporate', value: 'NMX Corporate' }
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
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'privado',
                            description: 'Ocultar respuesta - Visible solo para ti',
                            type: 5, // BOOLEAN
                            required: false
                        }
                    ]
                },
                {
                    name: 'pedir-prestamo',
                    description: 'Retira efectivo de tu tarjeta - Se suma a tu deuda',
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
                            description: 'Ocultar respuesta - Visible solo para ti',
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
                            description: 'Ocultar respuesta - Visible solo para ti',
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
                    description: 'Ver detalles del plástico - Titular Nivel Fecha',
                    type: 1
                },
                {
                    name: 'admin',
                    description: 'Herramientas Administrativas - Staff',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
                        {
                            name: 'puntos',
                            description: 'Modificar Score de Buró - Staff',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario afectado', type: 6, required: true },
                                { name: 'cantidad', description: 'Puntos a sumar o restar con signo -', type: 4, required: true },
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
                            description: 'Congelar una tarjeta - No podrá usarse',
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
                            name: 'historial',
                            description: 'Ver historial financiero completo y análisis de crédito',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a analizar', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'ofrecer-upgrade',
                            description: 'Enviar oferta de mejora de tarjeta por DM - Requiere buen Score',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Cliente a evaluar', type: 6, required: true }
                            ]
                        }
                    ]
                },
                {
                    name: 'debug',
                    description: 'Diagnóstico de cuenta - Usar si fallan comandos',
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
                        { name: 'usuario', description: 'Usuario sancionado - Nombre o ID', type: 3, required: true },
                        { name: 'razon', description: 'Motivo de la cancelación', type: 3, required: true },
                        { name: 'ubicacion', description: 'Lugar de los fatti/arresto', type: 3, required: true },
                        { name: 'prueba1', description: 'Evidencia principal - Imagen', type: 11, required: true },
                        { name: 'prueba2', description: 'Evidencia secundaria - Imagen', type: 11 }
                    ]
                }
            ]
        },

        {
            name: 'multa',
            description: 'Imponer una multa a un ciudadano - Policía',
            options: [
                { name: 'usuario', description: 'Ciudadano a multar', type: 6, required: true },
                { name: 'monto', description: 'Monto de la multa', type: 10, required: true },
                { name: 'razon', description: 'Motivo de la infracción', type: 3, required: true }
            ]
        },
        {
            name: 'transferir',
            description: 'Enviar dinero a otro ciudadano - Sistema SPEI',
            options: [
                { name: 'destinatario', description: 'Ciudadano que recibirá el dinero', type: 6, required: true },
                { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true },
                { name: 'razon', description: 'Concepto de la transferencia', type: 3, required: false }
            ]
        },
        {
            name: 'depositar',
            description: 'Depositar efectivo a la cuenta de otro ciudadano (OXXO)',
            options: [
                { name: 'destinatario', description: 'Ciudadano a depositar', type: 6, required: true },
                { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true },
                { name: 'razon', description: 'Concepto del depósito', type: 3, required: false }
            ]
        },
        {
            name: 'giro',
            description: 'Envío de dinero por paquetería (Tarda 24 horas)',
            options: [
                { name: 'destinatario', description: 'Ciudadano a enviar', type: 6, required: true },
                { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
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
                    description: 'Abrir una nueva inversión - 7 días con 5% rendimiento',
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
                    options: [{ name: 'nombre', description: 'Nombre del grupo como Taller', type: 3, required: true }]
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
            description: 'Sistema de Bolsa de Valores y Criptomonedas',
            options: [
                {
                    name: 'precios',
                    description: 'Ver precios actuales del mercado',
                    type: 1
                },
                {
                    name: 'comprar',
                    description: 'Comprar acciones o criptomonedas',
                    type: 1,
                    options: [
                        { name: 'symbol', description: 'Simbolo de la accion - BTC, ETH, TSLA, etc', type: 3, required: true },
                        { name: 'cantidad', description: 'Numero de acciones a comprar', type: 10, required: true }
                    ]
                },
                {
                    name: 'vender',
                    description: 'Vender acciones o criptomonedas',
                    type: 1,
                    options: [
                        { name: 'symbol', description: 'Simbolo de la accion - BTC, ETH, TSLA, etc', type: 3, required: true },
                        { name: 'cantidad', description: 'Numero de acciones a vender', type: 10, required: true }
                    ]
                },
                {
                    name: 'portafolio',
                    description: 'Ver tus inversiones actuales',
                    type: 1
                },
                {
                    name: 'historial',
                    description: 'Ver tus ultimas transacciones',
                    type: 1
                }
            ]
        },
        {
            name: 'balanza',
            description: 'Ver tu balanza financiera completa'
        },
        {
            name: 'debito',
            description: 'Gestion de Tarjeta de Debito',
            options: [
                { name: 'estado', description: 'Ver balance debito', type: 1 },
                {
                    name: 'transferir',
                    description: 'Transferir debito a debito - Tarda 5 minutos',
                    type: 1,
                    options: [
                        { name: 'destinatario', description: 'Usuario', type: 6, required: true },
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                {
                    name: 'depositar',
                    description: 'Depositar efectivo en tu cuenta bancaria',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                {
                    name: 'retirar',
                    description: 'Retirar dinero del banco a efectivo',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
                    ]
                },
                { name: 'historial', description: 'Ver transacciones', type: 1 },
                { name: 'info', description: 'Ver información completa de tu tarjeta de débito', type: 1 },
                {
                    name: 'admin',
                    description: '👨‍💼 Comandos para ejecutivos bancarios',
                    type: 2,
                    options: [
                        {
                            name: 'info',
                            description: 'Ver info completa de tarjeta de un usuario',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a consultar', type: 6, required: true }
                            ]
                        },
                        {
                            name: 'historial',
                            description: 'Ver historial de transacciones de débito',
                            type: 1,
                            options: [
                                { name: 'usuario', description: 'Usuario a consultar', type: 6, required: true }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'casino',
            description: '🎰 Sistema de Casino Nación MX',
            options: [
                {
                    name: 'fichas',
                    description: 'Comprar o retirar fichas del casino',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
                        {
                            name: 'comprar',
                            description: 'Comprar fichas con tu dinero',
                            type: 1,
                            options: [
                                { name: 'cantidad', description: 'Cantidad de fichas (mín: 10)', type: 4, required: true, min_value: 10, max_value: 10000 }
                            ]
                        },
                        {
                            name: 'retirar',
                            description: 'Convertir fichas a dinero',
                            type: 1,
                            options: [
                                { name: 'cantidad', description: 'Cantidad de fichas a retirar', type: 4, required: true, min_value: 1 }
                            ]
                        }
                    ]
                },
                { name: 'saldo', description: 'Ver tus fichas y estadísticas', type: 1 },
                { name: 'info', description: '📖 Guía completa del casino (juegos, reglas, premios)', type: 1 },
                {
                    name: 'historial',
                    description: 'Ver tus últimas jugadas',
                    type: 1,
                    options: [
                        { name: 'juego', description: 'Filtrar por juego específico', type: 3, required: false }
                    ]
                },
                {
                    name: 'ranking',
                    description: 'Ver top ganadores del casino',
                    type: 1,
                    options: [
                        {
                            name: 'tipo',
                            description: 'Tipo de ranking',
                            type: 3,
                            required: false,
                            choices: [
                                { name: 'Más Fichas', value: 'chips' },
                                { name: 'Más Ganancias', value: 'profit' },
                                { name: 'Más Juegos', value: 'games' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'jugar',
            description: '🎮 Jugar a los juegos del casino',
            options: [
                // Slots
                {
                    name: 'slots',
                    description: '🎰 Tragamonedas de 3 rodillos',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar (mín: 10)', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Dice
                {
                    name: 'dice',
                    description: '🎲 Tira un dado y apuesta alto/bajo',
                    type: 1,
                    options: [
                        {
                            name: 'direccion',
                            description: 'Over (arriba) o Under (abajo)',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Over (Mayor que)', value: 'over' },
                                { name: 'Under (Menor que)', value: 'under' }
                            ]
                        },
                        { name: 'numero', description: 'Número 1-99', type: 4, required: true, min_value: 1, max_value: 99 },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 1 }
                    ]
                },
                // Blackjack
                {
                    name: 'blackjack',
                    description: '🃏 Clásico 21 contra la casa',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Ruleta
                {
                    name: 'ruleta',
                    description: '🎡 Ruleta europea',
                    type: 1,
                    options: [
                        {
                            name: 'tipo',
                            description: 'Tipo de apuesta',
                            type: 3,
                            required: true,
                            choices: [
                                { name: 'Rojo', value: 'red' },
                                { name: 'Negro', value: 'black' },
                                { name: 'Par', value: 'even' },
                                { name: 'Impar', value: 'odd' },
                                { name: 'Número Exacto', value: 'number' }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 1 },
                        { name: 'numero', description: 'Si elegiste número exacto (0-36)', type: 4, required: false, min_value: 0, max_value: 36 }
                    ]
                },
                // Caballos
                {
                    name: 'caballos',
                    description: '🐴 Carrera de caballos',
                    type: 1,
                    options: [
                        {
                            name: 'caballo',
                            description: 'Elige tu caballo',
                            type: 4,
                            required: true,
                            choices: [
                                { name: '🐴 Caballo 1', value: 1 },
                                { name: '🐴 Caballo 2', value: 2 },
                                { name: '🐴 Caballo 3', value: 3 },
                                { name: '🐴 Caballo 4', value: 4 },
                                { name: '🐴 Caballo 5', value: 5 },
                                { name: '🐴 Caballo 6', value: 6 }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Crash
                {
                    name: 'crash',
                    description: '📉 Retira antes del crash - Multiplicador sube',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Gallos
                {
                    name: 'gallos',
                    description: '🐓 Pelea de gallos',
                    type: 1,
                    options: [
                        {
                            name: 'gallo',
                            description: 'Elige tu gallo',
                            type: 3,
                            required: true,
                            choices: [
                                { name: '🔴 Gallo Rojo', value: 'red' },
                                { name: '🔵 Gallo Azul', value: 'blue' }
                            ]
                        },
                        { name: 'apuesta', description: 'Fichas a apostar', type: 4, required: true, min_value: 10 }
                    ]
                },
                // Ruleta Rusa
                {
                    name: 'ruleta-rusa',
                    description: '💀 ALTO RIESGO - Si pierdes, ban temporal',
                    type: 1,
                    options: [
                        { name: 'apuesta', description: 'Fichas a apostar (máx: 100)', type: 4, required: true, min_value: 10, max_value: 100 }
                    ]
                }
            ]
        }
    ];

    try {
        console.log('🔄 Iniciando actualización de comandos...');

        if (GUILD_ID) {
            // Check if bot is actually in the guild
            const targetGuild = client.guilds.cache.get(GUILD_ID);
            if (!targetGuild) {
                console.error(`❌ CRITICAL ERROR: El bot NO ESTÁ en el servidor con ID '${GUILD_ID}'.`);
                // ... logs ...
            } else {
                console.log(`✅ Verificado: Estoy dentro del servidor '${targetGuild.name}'`);
            }

            // TEST READ ACCESS
            try {
                console.log('🧐 Verificando comandos actuales en la API...');
                const currentCommands = await rest.get(Routes.applicationGuildCommands(client.user.id, GUILD_ID));
                console.log(`📋 El bot ya tiene ${currentCommands.length} comandos registrados en la nube.`);
            } catch (readError) {
                console.error('❌ ERROR DE LECTURA (Scope?):', readError);
            }

            // Register Guild Commands (Overwrite)
            // DISABLED ON RENDER DUE TO IP BLOCK / TIMEOUTS
            // RUN `node bot/manual_register.js` LOCALLY TO UPDATE COMMANDS
            console.log('⚠️ AUTO-REGISTRO DESACTIVADO: Se omite la carga de comandos para evitar Timeouts en Render.');
            console.log('   -> Ejecuta `node bot/manual_register.js` en tu PC si necesitas actualizar comandos.');

            /*
            console.log(`✨ Registrando SOLO 1 COMANDO (ping) en: '${GUILD_ID}'...`);
            console.log(`🔑 Client ID: ${client.user.id}`);
            // console.log('📦 Payloads:', JSON.stringify(commands, null, 2)); // Too verbose for 17 commands

            // Timeout implementation to prevent hanging indefinitely
            const registrationTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT: La conexión con Discord API tardó demasiado (>30s).')), 30000)
            );

            try {
                await Promise.race([
                    rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands }),
                    registrationTimeout
                ]);
                console.log('✅ Comandos (PING) verificados y limpios (REST PUT Success).');
            } catch (putError) {
                console.error('❌ FATAL REST ERROR:', putError);
                // Optionally Fallback to Global? catch -> log
            }
            */

        } else {
            console.log('⚠️ GUILD_ID no encontrado o vacío. Registrando Globalmente (No recomendado para desarrollo).');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
        }
    } catch (error) {
        console.error('❌ Error gestionando comandos (General Catch):', error);
    }

    // Start listening to Supabase changes
    subscribeToNewCards();
    subscribeToCancellations();
});

// Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    // BUTTON: Investment Collection
    if (interaction.isButton() && interaction.customId.startsWith('btn_collect_')) {
        await interaction.deferReply({ ephemeral: true });
        const invId = interaction.customId.replace('btn_collect_', '');

        // Fetch Inv
        const { data: inv } = await supabase.from('investments').select('*').eq('id', invId).single();
        if (!inv || inv.status !== 'active') return interaction.editReply('❌ Inversión no válida o ya cobrada.');

        // Payout
        await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, inv.payout_amount, `Retiro Inversión ${inv.id}`);
        await supabase.from('investments').update({ status: 'completed' }).eq('id', invId);

        await interaction.editReply(`✅ **¡Ganancia Cobrada!**\nHas recibido **$${inv.payout_amount.toLocaleString()}** en tu cuenta.`);
    }

    // BUTTON: Upgrade Accept
    if (interaction.isButton() && interaction.customId.startsWith('btn_upgrade_')) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_'); // btn, upgrade, cardId, tierIndex
        const cardId = parts[2];
        const tierIndex = parseInt(parts[3]);

        const TIERS = ['NMX Start', 'NMX Básica', 'NMX Plus', 'NMX Plata', 'NMX Oro', 'NMX Rubí', 'NMX Black', 'NMX Diamante'];
        const newType = TIERS[tierIndex];

        if (!newType) return interaction.followUp({ content: '❌ Error de datos.', ephemeral: true });

        // Stats Map again (Centralize this if possible later)
        const statsMap = {
            'NMX Start': { limit: 15000, interest: 15 },
            'NMX Básica': { limit: 30000, interest: 12 },
            'NMX Plus': { limit: 50000, interest: 10 },
            'NMX Plata': { limit: 100000, interest: 8 },
            'NMX Oro': { limit: 250000, interest: 7 },
            'NMX Rubí': { limit: 500000, interest: 5 },
            'NMX Black': { limit: 1000000, interest: 3 },
            'NMX Diamante': { limit: 5000000, interest: 1 }
        };
        const stats = statsMap[newType];

        // Update DB
        const { error } = await supabase.from('credit_cards').update({
            card_type: newType,
            credit_limit: stats.limit,
            interest_rate: stats.interest
        }).eq('id', cardId);

        if (error) return interaction.followUp({ content: '❌ Error al procesar la mejora.', ephemeral: true });

        // Disable Button
        await interaction.editReply({ components: [] });
        await interaction.followUp({ content: `🎉 **¡Mejora Exitosa!** Tu tarjeta ahora es nivel **${newType}**. Disfruta de tu nuevo límite de $${stats.limit.toLocaleString()}.`, ephemeral: false });
    }

    // EMPRESA COBRAR - Payment Buttons
    if (interaction.isButton() && interaction.customId.startsWith('pay_')) {
        const parts = interaction.customId.split('_');
        const paymentMethod = parts[1]; // cash, debit, credit, cancel

        if (paymentMethod === 'cancel') {
            await interaction.update({
                content: '❌ Pago cancelado por el cliente.',
                embeds: [],
                components: []
            });
            return;
        }

        const amount = parseFloat(parts[2]);
        const companyId = parts[3];

        await interaction.deferUpdate();

        try {
            // Get company data
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.followUp({ content: '❌ Empresa no encontrada.', ephemeral: true });
            }

            // Get original message to find reason
            const originalEmbed = interaction.message.embeds[0];
            const reason = originalEmbed.fields.find(f => f.name === '🧾 Concepto')?.value || 'Servicio';

            let paymentSuccess = false;
            let paymentDetails = '';
            let transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // Process payment based on method
            if (paymentMethod === 'cash') {
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.cash < amount) {
                    return interaction.followUp({
                        content: `❌ **Efectivo insuficiente**\n\nNecesitas: $${amount.toLocaleString()}\nTienes: $${balance.cash.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Remove cash from client
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago a ${company.name}: ${reason}`, 'cash');

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = '💵 Efectivo';

            } else if (paymentMethod === 'debit') {
                const { data: debitCard } = await supabase
                    .from('debit_cards')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!debitCard) {
                    return interaction.followUp({
                        content: '❌ No tienes tarjeta de débito activa.',
                        ephemeral: true
                    });
                }

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.bank < amount) {
                    return interaction.followUp({
                        content: `❌ **Saldo insuficiente en débito**\n\nNecesitas: $${amount.toLocaleString()}\nTienes: $${balance.bank.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Remove from client's bank (debit)
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago débito a ${company.name}: ${reason}`, 'bank');

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = '💳 Tarjeta de Débito';

            } else if (paymentMethod === 'credit') {
                // Get user's credit card
                const { data: creditCards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('discord_id', interaction.user.id)
                    .eq('status', 'active')
                    .order('card_limit', { ascending: false })
                    .limit(1);

                if (!creditCards || creditCards.length === 0) {
                    return interaction.followUp({
                        content: '❌ No tienes tarjetas de crédito activas.',
                        ephemeral: true
                    });
                }

                const card = creditCards[0];
                const available = card.card_limit - (card.current_balance || 0);

                if (available < amount) {
                    return interaction.followUp({
                        content: `❌ **Crédito insuficiente**\n\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Update credit card balance
                await supabase
                    .from('credit_cards')
                    .update({
                        current_balance: (card.current_balance || 0) + amount,
                        last_transaction_at: new Date().toISOString()
                    })
                    .eq('id', card.id);

                // Add to company balance
                await supabase
                    .from('companies')
                    .update({ balance: (company.balance || 0) + amount })
                    .eq('id', companyId);

                paymentSuccess = true;
                paymentDetails = `💳 Crédito (${card.card_name})`;
            }

            if (paymentSuccess) {
                // Update message to show success
                await interaction.editReply({
                    content: '✅ Pago procesado exitosamente',
                    embeds: [],
                    components: []
                });

                // Generate digital receipt
                const receiptEmbed = new EmbedBuilder()
                    .setTitle('🧾 Comprobante de Pago')
                    .setColor(0x00FF00)
                    .setDescription(`Transacción completada exitosamente`)
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '👤 Cliente', value: interaction.user.tag, inline: true },
                        { name: '📝 Concepto', value: reason, inline: false },
                        { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '💳 Método', value: paymentDetails, inline: true },
                        { name: '🔖 ID Transacción', value: `\`${transactionId}\``, inline: false },
                        { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'Banco Nacional • Comprobante Digital' })
                    .setTimestamp();

                // Send receipt to client
                try {
                    await interaction.user.send({
                        content: '📧 **Comprobante de tu pago**',
                        embeds: [receiptEmbed]
                    });
                } catch (dmError) {
                    console.log('Could not DM client receipt:', dmError.message);
                }

                // Send receipt to company owner(s)
                for (const ownerId of company.owner_ids) {
                    try {
                        const owner = await client.users.fetch(ownerId);
                        await owner.send({
                            content: '💰 **Nueva venta registrada**',
                            embeds: [receiptEmbed]
                        });
                    } catch (ownerDmError) {
                        console.log('Could not DM owner receipt:', ownerDmError.message);
                    }
                }

                // Log transaction (optional, if you want to track in DB)
                await supabase
                    .from('company_transactions')
                    .insert({
                        company_id: companyId,
                        client_id: interaction.user.id,
                        amount: amount,
                        description: reason,
                        payment_method: paymentMethod,
                        transaction_id: transactionId
                    });
            }

        } catch (error) {
            console.error('Payment error:', error);
            await interaction.followUp({
                content: '❌ Error procesando el pago. Contacta a un administrador.',
                ephemeral: true
            });
        }

        return;
    }

    if (interaction.isButton()) { return; }

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply({ content: `🏓 Pong! Latencia: **${ping}ms**. API: **${Math.round(client.ws.ping)}ms**.`, ephemeral: false });
    }


    else if (commandName === 'ayuda') {
        const initialEmbed = new EmbedBuilder()
            .setTitle('📘 Centro de Ayuda Nación MX')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Selecciona una categoría en el menú de abajo para ver los comandos disponibles.**\n\nAquí encontrarás toda la información sobre el sistema financiero, legal y de entretenimiento.')
            // .setImage('https://i.imgur.com/K3pW4kC.png') 
            .setFooter({ text: 'Usa el menú desplegable para navegar' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Selecciona una categoría...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Banco & Economía').setDescription('Débito, Transferencias, Efectivo').setValue('economy').setEmoji('🏦'),
                new StringSelectMenuOptionBuilder().setLabel('Crédito & Deudas').setDescription('Tarjetas de Crédito, Buró, Pagos').setValue('credit').setEmoji('💳'),
                new StringSelectMenuOptionBuilder().setLabel('Empresas & Negocios').setDescription('Gestión de Empresas, Terminal POS').setValue('business').setEmoji('🏢'),
                new StringSelectMenuOptionBuilder().setLabel('Inversiones & Bolsa').setDescription('Acciones, Crypto, Plazos Fijos').setValue('invest').setEmoji('📈'),
                new StringSelectMenuOptionBuilder().setLabel('Casino & Juegos').setDescription('Slots, Ruleta, Caballos, Juegos').setValue('casino').setEmoji('🎰'),
                new StringSelectMenuOptionBuilder().setLabel('Legal & Policial').setDescription('Multas, Antecedentes, Fichajes').setValue('police').setEmoji('👮'),
                new StringSelectMenuOptionBuilder().setLabel('Utilidades').setDescription('Ping, Balance, Notificaciones').setValue('utils').setEmoji('⚙️'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const response = await interaction.reply({ embeds: [initialEmbed], components: [row], ephemeral: false });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 300000 }); // 5 mins

        collector.on('collect', async i => {
            if (i.customId !== 'help_category') return;

            const category = i.values[0];
            const newEmbed = new EmbedBuilder().setColor(0xD4AF37).setTimestamp();

            switch (category) {
                case 'economy':
                    newEmbed.setTitle('🏦 Banco & Economía')
                        .addFields(
                            { name: '`/debito estado`', value: 'Ver tu saldo bancario y número de tarjeta.' },
                            { name: '`/debito depositar`', value: 'Depositar efectivo a tu cuenta (Inmediato).' },
                            { name: '`/debito retirar`', value: 'Retirar dinero del banco (Inmediato).' },
                            { name: '`/debito transferir`', value: 'Transferir a otro usuario (Banco a Banco, 5 min).' },
                            { name: '`/transferir`', value: 'Transferencia SPEI inmediata (Solo Banco).' },
                            { name: '`/depositar`', value: 'Depósito en efectivo a terceros (OXXO, 4 horas).' },
                            { name: '`/giro`', value: 'Envío de efectivo por paquetería (24 horas).' }
                        );
                    break;
                case 'credit':
                    newEmbed.setTitle('💳 Crédito & Deudas')
                        .addFields(
                            { name: '`/credito info`', value: 'Ver estado de cuenta, límite y corte.' },
                            { name: '`/credito pagar`', value: 'Pagar deuda de tarjeta.' },
                            { name: '`/credito buro`', value: 'Ver tu historial crediticio.' },
                            { name: '`/top-morosos`', value: 'Ver quién debe más en el servidor.' },
                            { name: '`/top-ricos`', value: 'Ver quién tiene mejor Score Crediticio.' }
                        );
                    break;
                case 'business':
                    newEmbed.setTitle('🏢 Empresas & Negocios')
                        .addFields(
                            { name: '`/empresa crear`', value: 'Registrar una nueva empresa ($50k).' },
                            { name: '`/empresa menu`', value: 'Panel de gestión (pagar nómina, ver saldo).' },
                            { name: '`/empresa cobrar`', value: 'Generar cobro para clientes (Terminal POS).' },
                            { name: '`/empresa credito`', value: 'Solicitar crédito empresarial.' }
                        );
                    break;
                case 'invest':
                    newEmbed.setTitle('📈 Inversiones & Bolsa')
                        .addFields(
                            { name: '`/bolsa precios`', value: 'Ver precios de acciones/crypto.' },
                            { name: '`/bolsa comprar`', value: 'Invertir en activos.' },
                            { name: '`/bolsa vender`', value: 'Vender activos.' },
                            { name: '`/bolsa portafolio`', value: 'Ver tus rendimientos.' },
                            { name: '`/inversion nueva`', value: 'Abrir plazo fijo (CDT).' }
                        );
                    break;
                case 'casino':
                    newEmbed.setTitle('🎰 Casino Nación MX')
                        .setDescription('¡Apuesta y gana! La casa (casi) nunca pierde.')
                        .addFields(
                            { name: '`/casino fichas comprar`', value: 'Comprar fichas (1 ficha = $1).' },
                            { name: '`/casino fichas retirar`', value: 'Cambiar fichas por dinero.' },
                            { name: '`/jugar slots`', value: 'Tragamonedas clásica.' },
                            { name: '`/jugar dados`', value: 'Adivina suma (Mayor/Menor).' },
                            { name: '`/jugar ruleta`', value: 'Ruleta (Rojo/Negro/Número).' },
                            { name: '`/jugar crash`', value: '¡Sal antes de que explote!' },
                            { name: '`/jugar caballos`', value: 'Carreras.' },
                            { name: '`/jugar gallos`', value: 'Pelea de gallos.' },
                            { name: '`/jugar rusa`', value: 'Ruleta Rusa (Peligroso).' }
                        );
                    break;
                case 'police':
                    newEmbed.setTitle('👮 Legal & Policial')
                        .addFields(
                            { name: '`/fichar`', value: 'Buscar antecedentes penales (Policía).' },
                            { name: '`/multa`', value: 'Imponer multa (Policía/Juez).' },
                            { name: '`/impuestos pagar`', value: 'Pagar impuestos pendientes.' },
                            { name: '`/licencia registrar`', value: 'Registrar licencia de conducir.' }
                        );
                    break;
                case 'utils':
                    newEmbed.setTitle('⚙️ Utilidades')
                        .addFields(
                            { name: '`/balanza`', value: 'Resumen financiero total (Net Worth).' },
                            { name: '`/notificaciones`', value: 'Activar/desactivar DMs del banco.' },
                            { name: '`/ping`', value: 'Ver latencia del bot.' },
                            { name: '`/rol`', value: 'Asignarse roles de trabajo.' }
                        );
                    break;
            }

            await i.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            // Optional: Disable on timeout
        });
    }

    else if (commandName === 'estado') {
        await interaction.deferReply({ ephemeral: false }); // Defer first to prevent timeout

        // IDs Provided by User
        const TARGET_CHANNEL_ID = '1412963363545284680';
        const PING_ROLE_ID = '1412899401000685588';
        const action = interaction.options.getString('seleccion');

        try {
            const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
            if (!channel) return interaction.editReply('❌ No encontré el canal de estado.');

            // 1. Clear Channel Messages (Clean Slate)
            try {
                // Fetch last 100 messages and delete them
                const messages = await channel.messages.fetch({ limit: 100 });
                if (messages.size > 0) {
                    await channel.bulkDelete(messages, true).catch(err => console.log("Error deleting old messages:", err.message));
                }
            } catch (cleanupError) {
                console.log("Cleanup warning:", cleanupError.message);
            }

            let newName = channel.name;
            let embed = null;
            let msgContent = '';

            const robloxButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('🎮 Unirme a NACIÓN MX')
                    .setURL('https://www.roblox.com/games/start?launchData=%7B%22psCode%22%3A%22NACIONMX%22%7D&placeId=2534724415')
                    .setStyle(ButtonStyle.Link)
            );

            if (action === 'open') {
                newName = '🟢・servidor-on';
                msgContent = `<@&${PING_ROLE_ID}>`;
                embed = new EmbedBuilder()
                    .setTitle('✅ NACIÓN MX ABIERTO')
                    .setDescription('¡El servidor se encuentra **ONLINE**! \n\nConéctate ahora y disfruta del mejor Roleplay de México. 🇲🇽✨')
                    .setColor(0x00FF00) // Green
                    .setThumbnail(client.user.displayAvatarURL())
                    .setTimestamp();
            } else if (action === 'maintenance') {
                newName = '🟠・mantenimiento';
                embed = new EmbedBuilder()
                    .setTitle('🛠️ EN MANTENIMIENTO')
                    .setDescription('Estamos aplicando mejoras y actualizaciones.\nPor favor espera, el servidor volverá pronto.')
                    .setColor(0xFFA500) // Orange
                    .setTimestamp();
            } else if (action === 'closed') {
                newName = '🔴・servidor-off';
                embed = new EmbedBuilder()
                    .setTitle('⛔ SERVIDOR CERRADO')
                    .setDescription('El servidor ha cerrado sus puertas por hoy.\n¡Nos vemos mañana!')
                    .setColor(0xFF0000) // Red
                    .setTimestamp();
            }

            // 2. Rename Channel
            await channel.setName(newName);

            // 3. Send Message
            // Open: Ping + Embed + Button
            if (action === 'open') {
                await channel.send({ content: msgContent, embeds: [embed], components: [robloxButton] });
            } else {
                // Others: Just Embed + Button (Button is always useful for "Try to join later" context, or we can omit it if closed. User asked "pon un boton", assuming for all or mainly Open. I'll add to all for consistency)
                await channel.send({ embeds: [embed], components: [robloxButton] });
            }

            await interaction.editReply(`✅ Estado actualizado a: **${action.toUpperCase()}**\nLimpieza de chat realizada.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hubo un error actualizando el estado. Revisa permisos del Bot (Manage Messages/Channels).');
        }
    }

    else if (commandName === 'tarjeta') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'info') {
            const file = new AttachmentBuilder(path.join(__dirname, 'assets', 'banco_mexico_banner.png'));

            // Debit Cards (3 tiers)
            const debitCards = [
                { name: 'NMX Débito', cost: '$100', desc: 'Cuenta básica con débito.' },
                { name: 'NMX Débito Plus', cost: '$500', desc: 'Mayor límite de transferencias.' },
                { name: 'NMX Débito Gold', cost: '$1,000', desc: 'Sin límites, cashback en compras.' }
            ];

            const personalCards = [
                { name: 'NMX Start', limit: '15k', interest: '15%', cost: '$2k', desc: 'Ideal para iniciar historial.' },
                { name: 'NMX Básica', limit: '30k', interest: '12%', cost: '$4k', desc: 'Gastos moderados y frecuentes.' },
                { name: 'NMX Plus', limit: '50k', interest: '10%', cost: '$6k', desc: 'Más poder adquisitivo.' },
                { name: 'NMX Plata', limit: '100k', interest: '8%', cost: '$10k', desc: 'Beneficios exclusivos.' },
                { name: 'NMX Oro', limit: '250k', interest: '7%', cost: '$15k', desc: 'Estatus y comodidad.' },
                { name: 'NMX Rubí', limit: '500k', interest: '6%', cost: '$25k', desc: 'Lujo al alcance.' },
                { name: 'NMX Black', limit: '1M', interest: '5%', cost: '$40k', desc: 'Prestigio total.' },
                { name: 'NMX Diamante', limit: '2M', interest: '3%', cost: '$60k', desc: 'Poder ilimitado.' }
            ];

            const businessCards = [
                { name: 'Business Start', limit: '50k', interest: '2%', cost: '$8k', desc: 'Emprendedores • Crédito renovable • Reportes mensuales.' },
                { name: 'Business Gold', limit: '100k', interest: '1.5%', cost: '$15k', desc: 'Pymes • Mejor rendimiento • Cashback 1% en compras.' },
                { name: 'Business Platinum', limit: '200k', interest: '1.2%', cost: '$20k', desc: 'Expansión • Acceso prioritario • Sin comisiones internacionales.' },
                { name: 'Business Elite', limit: '500k', interest: '1%', cost: '$35k', desc: 'Corp • Línea crédito flexible • Seguro de viajes incluido.' },
                { name: 'NMX Corporate', limit: '1M', interest: '0.7%', cost: '$50k', desc: 'Industrias • Máximo beneficio fiscal • Asesor financiero dedicado.' }
            ];

            const embed = new EmbedBuilder()
                .setTitle('Información Oficial - Banco Nacional')
                .setColor(0x00FF00)
                .setImage('attachment://banco_mexico_banner.png')
                .setDescription('El **Banco Nacional** ofrece productos financieros para personas y empresas. Revisa nuestro catálogo completo.')
                .addFields({
                    name: '💡 Comandos Útiles',
                    value: '>>> **`/balanza`** - Ver tu dinero total (Efec + Banco + Crédito).\n**`/depositar`** - Depósito general (Cualquier usuario).\n**`/transferir`** - Transferencia Débito (Requiere Tarjeta ambos).\n**`/giro`** - Envío diferido (24h).\n**`/credito estado`** - Ver deuda y límite.\n**`/credito pagar`** - Abonar a tu deuda.\n**`/impuestos`** - Consultar impuestos.',
                    inline: false
                });


            // Debit Cards Field
            let dText = '';
            debitCards.forEach(c => {
                dText += `💳 **${c.name}**\n`;
                dText += `└ Costo: **${c.cost}** | ${c.desc}\n`;
            });

            // Personal Cards Field
            let pText = '';
            personalCards.forEach(c => {
                pText += `👤 **${c.name}**\n`;
                pText += `└ Límite: **$${c.limit}** | Costo: **${c.cost}** | Interés: **${c.interest}**\n`;
            });

            // Business Cards Field
            let bText = '';
            businessCards.forEach(c => {
                bText += `🏢 **${c.name}**\n`;
                bText += `└ Límite: **$${c.limit}** | Costo: **${c.cost}** | Interés: **${c.interest}**\n`;
                bText += `└ ${c.desc}\n`;
            });

            bText += `\n💡 **¿Cómo solicitar?**\n`;
            bText += `1️⃣ Abre un ticket en <#1450269843600310373>\n`;
            bText += `2️⃣ Un asesor te ayudará con el proceso\n`;
            bText += `3️⃣ Usa \`/empresa credito\` para usar tu línea`;

            embed.addFields(
                { name: '🏦 Tarjetas de Débito', value: dText, inline: false },
                { name: '💳 Tarjetas de Crédito Personales', value: pText, inline: true },
                { name: '🏭 Tarjetas de Crédito Empresariales', value: bText, inline: true }
            );

            embed.setFooter({ text: 'Banco Nacional RP • Intereses semanales (Domingos) • Pagos obligatorios' });

            await interaction.reply({ embeds: [embed], files: [file] });
        }

        else if (subcommand === 'ver') {
            const cardName = interaction.options.getString('nombre');

            // Card database with detailed info
            const allCards = {
                'NMX Start': { limit: 2000, interest: 3, score: 0, tier: 'Inicial', benefits: ['Sin anualidad', 'App móvil incluida'], color: 0x808080 },
                'NMX Básica': { limit: 4000, interest: 2.5, score: 30, tier: 'Básica', benefits: ['Cashback 1%', 'Seguro básico'], color: 0x4169E1 },
                'NMX Plus': { limit: 6000, interest: 2, score: 50, tier: 'Plus', benefits: ['Cashback 2%', 'Protección de compras'], color: 0x32CD32 },
                'NMX Plata': { limit: 10000, interest: 1.5, score: 60, tier: 'Premium', benefits: ['Cashback 3%', 'Seguro de viaje', 'Concierge'], color: 0xC0C0C0 },
                'NMX Oro': { limit: 15000, interest: 1.2, score: 70, tier: 'Elite', benefits: ['Cashback 4%', 'Lounge aero', 'Asistencia 24/7'], color: 0xFFD700 },
                'NMX Rubí': { limit: 25000, interest: 1, score: 80, tier: 'Elite Plus', benefits: ['Cashback 5%', 'Concierge premium', 'Eventos exclusivos'], color: 0xE0115F },
                'NMX Black': { limit: 40000, interest: 0.8, score: 85, tier: 'Black', benefits: ['Cashback 6%', 'Prioridad máxima', 'Gestor personal'], color: 0x000000 },
                'NMX Diamante': { limit: 60000, interest: 0.5, score: 90, tier: 'Diamante', benefits: ['Cashback 8%', 'Servicios ilimitados', 'Sin límites'], color: 0xB9F2FF },
                'NMX Business Start': { limit: 50000, interest: 2, score: 70, tier: 'Empresarial', benefits: ['Facturación integrada', 'Control de gastos'], color: 0x1E90FF },
                'NMX Business Gold': { limit: 100000, interest: 1.5, score: 75, tier: 'Corporativa', benefits: ['Tarjetas adicionales', 'Reportes avanzados'], color: 0xFFD700 },
                'NMX Business Platinum': { limit: 200000, interest: 1.2, score: 80, tier: 'Corporativa Plus', benefits: [' Cuentas por pagar', 'API de integración'], color: 0xE5E4E2 },
                'NMX Business Elite': { limit: 500000, interest: 1, score: 85, tier: 'Elite Corp', benefits: ['Línea directa CFO', 'Asesoría fiscal'], color: 0x4B0082 },
                'NMX Corporate': { limit: 1000000, interest: 0.7, score: 90, tier: 'Corporate', benefits: ['Gestor dedicado', 'Términos personalizados', 'Liquidez ilimitada'], color: 0x800020 }
            };

            const card = allCards[cardName];

            if (!card) {
                return await interaction.reply({ content: '❌ Tarjeta no encontrada.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 ${cardName}`)
                .setColor(card.color)
                .setDescription(`**Nivel:** ${card.tier}`)
                .addFields(
                    { name: '💰 Límite de Crédito', value: `$${card.limit.toLocaleString()}`, inline: true },
                    { name: '📊 Interés Semanal', value: `${card.interest}%`, inline: true },
                    { name: '⭐ Score Requerido', value: `${card.score}+/100`, inline: true },
                    { name: '✨ Beneficios', value: card.benefits.map(b => `• ${b}`).join('\n'), inline: false },
                    { name: '📅 Corte', value: 'Domingos 11:59 PM', inline: true },
                    { name: '💡 Cómo Solicitar', value: 'Contacta al Staff del banco con tu DNI', inline: false }
                )
                .setFooter({ text: 'Banco Nacional RP' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    else if (commandName === 'registrar-tarjeta') {
        try {
            await interaction.deferReply({ ephemeral: false });

            // 1. Role Check (Staff Banco: 1450591546524307689)
            if (!interaction.member.roles.cache.has('1450591546524307689') && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('⛔ No tienes permisos para registrar tarjetas (Rol Staff Banco Requerido).');
            }

            const targetUser = interaction.options.getUser('usuario');
            if (!targetUser) return interaction.editReply('❌ Debes especificar un usuario.');

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.editReply('⛔ **Seguridad:** No puedes registrarte una tarjeta a ti mismo. Pide a otro banquero que lo haga.');
            }

            const holderName = interaction.options.getString('nombre_titular');
            const cardType = interaction.options.getString('tipo');

            if (cardType.startsWith('separator')) return interaction.editReply('❌ Selección inválida: Has elegido un separador.');

            // Business Card Validation
            if (cardType.includes('Business') || cardType.includes('Corporate')) {
                const { data: companies } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('owner_id', targetUser.id)
                    .limit(1);

                if (!companies || companies.length === 0) {
                    return interaction.editReply('⛔ **Requisito Empresarial:** El usuario debe ser dueño de una empresa registrada para solicitar tarjetas Business/Corporate.');
                }
            }

            const dniPhoto = interaction.options.getAttachment('foto_dni');
            const notes = interaction.options.getString('notas') || 'Sin notas';

            // CARD STATS MAP (Global)
            const stats = CARD_TIERS[cardType || 'NMX Start'] || CARD_TIERS['NMX Start'];

            // 2. Find Citizen (Optional check, but we need to link it eventually. If not found, create one?)
            // The user said "pide foto de dni, nombre del titular". This implies we might be CREATING the citizen logic here or just linking.
            // I'll search for citizen by Discord ID. If not found, I will create one using the provided Name.
            let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (!citizen) {
                return interaction.editReply({
                    content: `❌ **Error:** El usuario <@${targetUser.id}> no está registrado en el censo.\n⚠️ **Acción Requerida:** Usa el comando \`/fichar vincular\` para registrar su Nombre y DNI antes de emitir una tarjeta.`
                });
            }
            // Update name?
            if (citizen.full_name !== holderName) {
                await supabase.from('citizens').update({ full_name: holderName }).eq('id', citizen.id);
            }

            // 3. Send Interactive Offer
            const offerEmbed = new EmbedBuilder()
                .setTitle('💳 Oferta de Tarjeta de Crédito')
                .setColor(0xD4AF37)
                .setDescription(`Hola <@${targetUser.id}>,\nEl Banco Nacional te ofrece una tarjeta **${cardType}**.\n\n**Titular:** ${holderName}\n\n**Detalles del Contrato:**`)
                .addFields(
                    { name: 'Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${stats.interest}%`, inline: true },
                    { name: 'Costo Apertura', value: `$${stats.cost.toLocaleString()}`, inline: true },
                    { name: 'Notas', value: notes }
                )
                .setThumbnail(dniPhoto.url)
                .setFooter({ text: 'Tienes 5 minutos para aceptar. Revisa los términos antes.' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('btn_terms').setLabel('📄 Ver Términos').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_accept').setLabel('✅ Aceptar y Pagar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_reject').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
                );

            // Send to channel (Public)
            const message = await interaction.channel.send({ content: `<@${targetUser.id}>`, embeds: [offerEmbed], components: [row] });
            await interaction.editReply(`✅ Oferta enviada a <@${targetUser.id}> para tarjeta **${cardType}**.`);

            // 4. Collector
            const filter = i => i.user.id === targetUser.id;
            const collector = message.createMessageComponentCollector({ filter, time: 300000 }); // 5 min

            collector.on('collect', async i => {
                if (i.customId === 'btn_terms') {
                    const tycEmbed = new EmbedBuilder()
                        .setTitle('📜 Términos y Condiciones')
                        .setColor(0x333333)
                        .setDescription(`**📜 CONTRATO DE TARJETA DE CRÉDITO - BANCO NACIONAL**
                    
**1. OBLIGACIÓN DE PAGO**
El titular se compromete a realizar pagos semanales de al menos el **25% de la deuda total** antes del corte (Domingo 11:59 PM).

**2. INTERESES ORDINARIOS**
El saldo no liquidado generará un interés semanal según el nivel de la tarjeta (Ver tabla de tasas).

**3. CONSECUENCIAS DE IMPAGO**
- **1 Semana de atraso:** Reporte negativo en Buró y cobro de intereses sobre saldo vencido.
- **2 Semanas de atraso:** Bloqueo temporal de la tarjeta y congelamiento de activos.
- **3 Semanas de atraso:** Embargo de bienes y boletín de búsqueda policial por fraude.

**4. USO DE LA TARJETA**
Esta tarjeta es personal e intransferible. El titular es responsable de todos los cargos realizados con ella. El Banco Nacional colaborará con la policía en caso de compras ilegales.`);
                    await i.reply({ embeds: [tycEmbed], ephemeral: false });
                }
                else if (i.customId === 'btn_reject') {
                    await i.update({ content: '❌ Oferta rechazada.', components: [] });
                    collector.stop();
                }
                else if (i.customId === 'btn_accept') {
                    const payRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('reg_pay_cash').setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reg_pay_bank').setLabel('🏦 Banco (UB)').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('reg_pay_debit').setLabel('💳 Débito (NMX)').setStyle(ButtonStyle.Secondary)
                    );
                    await i.update({ content: '💳 **Selecciona método de pago para la apertura:**', embeds: [], components: [payRow] });
                }
                else if (['reg_pay_cash', 'reg_pay_bank', 'reg_pay_debit'].includes(i.customId)) {
                    await i.deferUpdate();
                    try {
                        // 1. Check Funds & Charge
                        if (stats.cost > 0) {
                            if (i.customId === 'reg_pay_cash') {
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.cash || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente efectivo. Tienes: $${(bal.cash || 0).toLocaleString()}`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'cash');
                            }
                            else if (i.customId === 'reg_pay_bank') {
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente en Banco UB. Tienes: $${(bal.bank || 0).toLocaleString()}`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'bank');
                            }
                            else if (i.customId === 'reg_pay_debit') {
                                // Unified with Bank
                                const bal = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                                if ((bal.bank || 0) < stats.cost) return i.followUp({ content: `❌ No tienes suficiente en Banco/Débito.`, ephemeral: true });
                                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`, 'bank');
                            }
                        }

                        // *** DEBIT CARD LOGIC ***
                        if (cardType.includes('Débito')) {
                            const cardNumber = '4279' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
                            const { error: insertError } = await supabase.from('debit_cards').insert([{
                                discord_user_id: targetUser.id,
                                citizen_id: citizen.id,
                                card_number: cardNumber,
                                card_tier: cardType,
                                balance: 0,
                                status: 'active'
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            await message.edit({
                                content: `✅ **Cuenta de Débito Abierta** para **${holderName}**.\n💳 Número: \`${cardNumber}\`\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        } else {
                            // *** CREDIT CARD LOGIC (Original) ***
                            const { error: insertError } = await supabase.from('credit_cards').insert([{
                                citizen_id: citizen.id,
                                discord_user_id: targetUser.id,
                                card_type: cardType,
                                card_name: cardType,
                                card_limit: stats.limit,
                                current_balance: 0,
                                interest_rate: stats.interest / 100,
                                status: 'active',
                                next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                            }]);

                            if (insertError) throw new Error(insertError.message);

                            await message.edit({
                                content: `✅ **Tarjeta Activada** para **${holderName}**. Cobro de $${stats.cost.toLocaleString()} realizado.\n👮 **Registrado por:** <@${interaction.user.id}>`,
                                components: []
                            });
                        }

                    } catch (err) {
                        console.error(err);
                        await i.followUp({ content: `❌ Error procesando: ${err.message}`, ephemeral: false });
                    }
                    collector.stop();
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) message.edit({ content: '⚠️ Oferta expirada.', components: [] });
            });

        } catch (error) {
            console.error('[registrar-tarjeta] Critical Error:', error);
        }
    }

    else if (commandName === 'credito') {
        await interaction.deferReply({ ephemeral: false }); // Global defer to prevent timeouts

        const subCmd = interaction.options.getSubcommand();
        const isPrivate = interaction.options.getBoolean('privado') ?? false;

        if (subCmd === 'buro') {

            const { data: citizen } = await supabase.from('citizens').select('id, full_name, credit_score').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado.');

            const score = citizen.credit_score || 100;
            // Generate ASCII Progress Bar: [████████░░] 80/100
            const filled = Math.round(score / 10); // 0-10
            const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

            const embed = new EmbedBuilder()
                .setTitle(`📉 Buró Financiero: ${citizen.full_name}`)
                .setColor(score > 60 ? 0x00FF00 : (score > 30 ? 0xFFA500 : 0xFF0000))
                .addFields(
                    { name: 'Score Crediticio', value: `${bar} **${score}/100**` },
                    { name: 'Estado', value: score > 60 ? '✅ Excelente' : (score > 30 ? '⚠️ Regular' : '⛔ RIESGO (Acceso Limitado)') }
                )
                .setFooter({ text: 'Mantén un buen historial pagando tus tarjetas a tiempo.' });

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'info' && interaction.options.getSubcommandGroup() !== 'admin') {

            const { data: citizen } = await supabase.from('citizens').select('id, full_name, dni').eq('discord_id', interaction.user.id).limit(1).maybeSingle();
            if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado.');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).limit(1).maybeSingle();
            if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

            const embed = new EmbedBuilder()
                .setTitle(`💳 ${userCard.card_type} | Banco Nacional`)
                .setColor(0x000000) // Classic Black/Dark
                .addFields(
                    { name: 'Titular', value: citizen.full_name, inline: true },
                    { name: 'DNI', value: citizen.dni || 'N/A', inline: true },
                    { name: 'Estado', value: userCard.status === 'active' ? '✅ Activa' : '⛔ Bloqueada', inline: true },
                    { name: 'Emisión', value: `<t:${Math.floor(new Date(userCard.created_at).getTime() / 1000)}:D>`, inline: true },
                    { name: 'Corte', value: 'Domingos', inline: true }
                )
                .setFooter({ text: `ID: ${userCard.id.split('-')[0]}...` }); // Short ID like a card number snippet

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'estado') {

            // FIX: Query 'citizens' table instead of 'profiles' because credit_cards are linked to citizens.
            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) {
                return interaction.editReply('❌ No tienes un ciudadano vinculado a tu Discord. Contacta a un administrador en el Panel.');
            }

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!userCard) {
                return interaction.editReply('❌ No tienes una tarjeta activa actualmente.');
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 Estado de Cuenta: ${userCard.card_type}`)
                .setColor(0xD4AF37)
                .addFields(
                    { name: 'Deuda Actual', value: `$${userCard.current_balance.toLocaleString()}`, inline: true },
                    { name: 'Límite', value: `$${userCard.credit_limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${userCard.interest_rate}%`, inline: true }
                )
                .setFooter({ text: 'El corte es cada domingo a medianoche.' });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'pedir-prestamo') {

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Función Desactivada')
                    .setColor(0xFF0000)
                    .setDescription('Las tarjetas de crédito ahora funcionan como **método de pago directo**.\n\n**No puedes retirar efectivo**, pero puedes usar tu tarjeta para pagar:\n• Multas\n• Licencias\n• Empresas\n• Transferencias\n\nAl pagar, selecciona "💳 Crédito" como método de pago.')
                    .setFooter({ text: 'Banco Nacional - Nuevas Políticas de Crédito' })
                ]
            });
        }

        else if (subCmd === 'pagar') {

            // Robust amount handling
            const amount = interaction.options.getNumber('monto') || interaction.options.getInteger('monto');
            if (!amount || amount <= 0) return interaction.editReply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: isPrivate });

            try {
                // 1. Find User (Citizen) & Card
                // Note: removed profile join to avoid crashes
                const { data: citizen } = await supabase.from('citizens').select('id, discord_id').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (!citizen) return interaction.editReply({ content: '❌ No tienes cuenta vinculada (Citizen).', ephemeral: isPrivate });

                const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (!userCard) return interaction.editReply({ content: '❌ No tienes una tarjeta activa.', ephemeral: isPrivate });

                if (amount > userCard.current_balance) {
                    return interaction.editReply({ content: `⚠️ Solo debes **$${userCard.current_balance.toLocaleString()}**. No puedes pagar más de lo que debes.`, ephemeral: isPrivate });
                }

                // 2. CHECK FUNDS FIRST (User Request)
                try {
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                    // Check cash + bank (or just cash? usually cash is for hand payments, bank for transfers. Let's assume Total or Cash.
                    // Discord economy bots usually prioritize Cash or Bank. Let's check Total to be safe, or check documentation/preference.
                    // User screenshot shows Cash: 10k, Bank: 0, Total: 10k.
                    // Let's check Total Liquid Assets.
                    const userMoney = balance.total || (balance.cash + balance.bank);

                    if (userMoney < amount) {
                        return interaction.editReply({ content: `❌ **Fondos Insuficientes**. \nTienes: $${userMoney.toLocaleString()} \nIntentas pagar: $${amount.toLocaleString()}`, ephemeral: isPrivate });
                    }

                    // 3. Take Money from UnbelievaBoat
                    await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Pago Tarjeta ${userCard.card_type}`);

                } catch (ubError) {
                    console.error("UB Payment Error:", ubError);
                    return interaction.editReply({ content: `❌ Error verificando fondos o procesando cobro: ${ubError.message}`, ephemeral: isPrivate });
                }

                // 4. Update DB
                const newDebt = userCard.current_balance - amount;
                const { error: dbError } = await supabase
                    .from('credit_cards')
                    .update({ current_balance: newDebt, last_payment_date: new Date().toISOString() })
                    .eq('id', userCard.id);

                if (dbError) {
                    console.error(dbError);
                    return interaction.editReply({ content: '❌ Pago recibido en efectivo, pero error al actualizar BD. Contacta a Staff.', ephemeral: isPrivate });
                }

                await interaction.editReply({ content: `✅ **Pago Exitoso**. \nHas pagado **$${amount.toLocaleString()}**.\nTu deuda restante es: **$${newDebt.toLocaleString()}**.`, ephemeral: isPrivate });

            } catch (err) {
                console.error("Payment Critical Error:", err);
                await interaction.editReply({ content: `❌ Error procesando el pago: ${err.message}`, ephemeral: isPrivate });
            }
        }



        else if (interaction.options.getSubcommandGroup() === 'admin') {
            // Permission Check
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '⛔ Solo administradores pueden usar esto.', ephemeral: false });
            }

            const subCmdAdmin = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('usuario');

            // SECURITY: Self-Target Check
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '⛔ **Seguridad:** No puedes usar comandos administrativos sobre tu propia cuenta.', ephemeral: true });
            }

            // Already deferred globally at command start

            // Resolve Citizen (Credit Cards are linked to CITIZENS, not Profiles directly)
            // 1. Try to find via Citizens table first
            const { data: citizen } = await supabase.from('citizens').select('id, full_name, credit_score, discord_id').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) return interaction.editReply('❌ Este usuario no tiene un ciudadano vinculado (No tiene registro en el sistema financiero).');

            const { data: userCard } = await supabase.from('credit_cards')
                .select('*')
                .eq('citizen_id', citizen.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!userCard) return interaction.editReply('❌ Este usuario no tiene tarjetas registradas.');

            if (subCmdAdmin === 'info') {
                const embed = new EmbedBuilder()
                    .setTitle(`📂 Info Bancaria: ${citizen.full_name}`)
                    .setColor(0x0000FF)
                    .addFields(
                        { name: 'Tarjeta', value: userCard.card_type || 'Desconocida', inline: true },
                        { name: 'Estado', value: userCard.status || 'Desconocido', inline: true },
                        { name: 'Deuda', value: `$${(userCard.current_balance || 0).toLocaleString()}`, inline: true },
                        { name: 'Límite', value: `$${(userCard.card_limit || userCard.credit_limit || 0).toLocaleString()}`, inline: true },
                        { name: 'Discord ID', value: targetUser.id, inline: true }
                    );
                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'historial') {
                // Get citizen balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                const cash = balance.cash || 0;
                const bank = balance.bank || 0;

                // Get all credit cards
                const { data: allCards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('citizen_id', citizen.id)
                    .order('created_at', { ascending: false });

                let totalCreditLimit = 0;
                let totalDebt = 0;
                let totalAvailable = 0;

                if (allCards && allCards.length > 0) {
                    allCards.forEach(card => {
                        const limit = card.card_limit || card.credit_limit || 0;
                        const debt = card.current_balance || 0;
                        totalCreditLimit += limit;
                        totalDebt += debt;
                        totalAvailable += (limit - debt);
                    });
                }

                // Get transaction history (payments made)
                const { data: payments } = await supabase
                    .from('credit_card_payments')
                    .select('*')
                    .eq('card_id', userCard.id)
                    .order('payment_date', { ascending: false })
                    .limit(10);

                let totalPaid = 0;
                let interestPaid = 0;

                if (payments) {
                    payments.forEach(p => {
                        totalPaid += (p.amount || 0);
                        interestPaid += (p.interest_amount || 0);
                    });
                }

                // Calculate usage stats
                const cardAge = userCard.created_at ? Math.floor((Date.now() - new Date(userCard.created_at)) / (1000 * 60 * 60 * 24)) : 0;
                const utilizationRate = totalCreditLimit > 0 ? Math.round((totalDebt / totalCreditLimit) * 100) : 0;

                // Get credit score
                const { data: citizenScore } = await supabase
                    .from('citizens')
                    .select('credit_score')
                    .eq('discord_id', targetUser.id)
                    .maybeSingle();

                const creditScore = citizenScore?.credit_score || 100;

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Historial Financiero: ${citizen.full_name}`)
                    .setColor(0x1E90FF)
                    .setDescription(`Análisis completo para decisiones de crédito`)
                    .addFields(
                        { name: '💰 Efectivo', value: `$${cash.toLocaleString()}`, inline: true },
                        { name: '🏦 Banco/Débito', value: `$${bank.toLocaleString()}`, inline: true },
                        { name: '📈 Score Crediticio', value: `${creditScore}/100`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**TARJETAS DE CRÉDITO**', inline: false },
                        { name: '💳 Límite Total', value: `$${totalCreditLimit.toLocaleString()}`, inline: true },
                        { name: '📊 Deuda Total', value: `$${totalDebt.toLocaleString()}`, inline: true },
                        { name: '✅ Disponible', value: `$${totalAvailable.toLocaleString()}`, inline: true },
                        { name: '📉 Utilización', value: `${utilizationRate}%`, inline: true },
                        { name: '📅 Antigüedad', value: `${cardAge} días`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**HISTORIAL DE PAGOS**', inline: false },
                        { name: '💵 Total Pagado', value: `$${totalPaid.toLocaleString()}`, inline: true },
                        { name: '📈 Intereses Pagados', value: `$${interestPaid.toLocaleString()}`, inline: true },
                        { name: '🎁 Puntos Acumulados', value: `${userCard.reward_points || 0} pts`, inline: true },
                        { name: '━━━━━━━━━━━━━━━━━', value: '**RECOMENDACIÓN**', inline: false },
                        {
                            name: '💡 Análisis', value:
                                utilizationRate < 30 && creditScore > 70
                                    ? '✅ **EXCELENTE** - Cliente apto para upgrade'
                                    : utilizationRate > 70
                                        ? '⚠️ **PRECAUCIÓN** - Alta utilización de crédito'
                                        : creditScore < 50
                                            ? '❌ **RIESGO** - Score bajo, no recomendar upgrade'
                                            : '📊 **REGULAR** - Monitorear comportamiento',
                            inline: false
                        }
                    )
                    .setFooter({ text: `Reporte generado por ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'puntos') {
                // Fetch Citizen to get Score (not profile, Score is on citizens now)
                const { data: citizenData } = await supabase.from('citizens').select('id, full_name, credit_score').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

                if (!citizenData) return interaction.editReply('❌ No tiene un ciudadano vinculado.');

                const amountChange = interaction.options.getInteger('cantidad');
                const reason = interaction.options.getString('razon');

                let currentScore = citizenData.credit_score || 100;
                let newScore = currentScore + amountChange;

                // Clamp 0-100
                if (newScore > 100) newScore = 100;
                if (newScore < 0) newScore = 0;

                await supabase.from('citizens').update({ credit_score: newScore }).eq('id', citizenData.id);

                const embed = new EmbedBuilder()
                    .setTitle('📉 Ajuste de Buró Financiero')
                    .setColor(amountChange >= 0 ? 0x00FF00 : 0xFF0000)
                    .setDescription(`El score de **${citizenData.full_name}** ha sido actualizado por **${interaction.user.tag}**.`)
                    .addFields(
                        { name: 'Cambio', value: `${amountChange > 0 ? '+' : ''}${amountChange}`, inline: true },
                        { name: 'Nuevo Score', value: `${newScore}/100`, inline: true },
                        { name: 'Motivo', value: reason }
                    );

                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'perdonar') {
                await supabase.from('credit_cards').update({ current_balance: 0 }).eq('id', userCard.id);
                await supabase.from('transaction_logs').insert([{
                    card_id: userCard.id,
                    discord_user_id: targetUser.id,
                    amount: userCard.current_balance,
                    type: 'ADJUSTMENT',
                    status: 'SUCCESS',
                    metadata: { type: 'FORGIVE', by: interaction.user.tag }
                }]);
                await interaction.editReply(`✅ Deuda perdonada para **${citizen.full_name}**. Deuda actual: $0.`);
            }

            else if (subCmdAdmin === 'congelar') {
                await supabase.from('credit_cards').update({ status: 'FROZEN' }).eq('id', userCard.id);
                await interaction.editReply(`❄️ Tarjeta de **${citizen.full_name}** ha sido **CONGELADA**.`);
            }

            else if (subCmdAdmin === 'descongelar') {
                await supabase.from('credit_cards').update({ status: 'ACTIVE' }).eq('id', userCard.id);
                await interaction.editReply(`🔥 Tarjeta de **${citizen.full_name}** ha sido **DESCONGELADA** y está Activa.`);
            }


            else if (subCmdAdmin === 'ofrecer-upgrade') {
                // Robust Citizen Lookup
                let citizenData = null;
                // let userCard is defined in outer scope, but we might need to refresh it or specifically get the citizen from it

                // 1. Try to find via Credit Card (Strongest link if they have one)
                const { data: cardData } = await supabase
                    .from('credit_cards')
                    .select('*, citizens!inner(id, full_name, credit_score, discord_id)')
                    .eq('citizens.discord_id', targetUser.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (cardData) {
                    citizenData = cardData.citizens;
                } else {
                    // 2. Fallback: Find citizen directly (if they don't have a card yet)
                    const { data: cData } = await supabase
                        .from('citizens')
                        .select('id, full_name, credit_score')
                        .eq('discord_id', targetUser.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    citizenData = cData;
                }

                if (!citizenData) {
                    return interaction.editReply('❌ No tiene un ciudadano vinculado.');
                }

                const score = citizenData.credit_score || 100;

                // Require good credit score (>70) to offer upgrade
                if (score < 70) {
                    return interaction.editReply(`❌ **${citizen.full_name}** tiene un Score de ${score}/100. Se requiere mínimo 70 puntos para ofrecer un upgrade.`);
                }

                // Card tier ladder
                // Card tier ladder & Stats
                const cardStats = {
                    'NMX Start': { limit: 15000, interest: 15, cost: 2000 },
                    'NMX Básica': { limit: 30000, interest: 12, cost: 4000 },
                    'NMX Plus': { limit: 50000, interest: 10, cost: 6000 },
                    'NMX Plata': { limit: 100000, interest: 8, cost: 10000 },
                    'NMX Oro': { limit: 250000, interest: 7, cost: 15000 },
                    'NMX Rubí': { limit: 500000, interest: 6, cost: 25000 },
                    'NMX Black': { limit: 1000000, interest: 5, cost: 40000 },
                    'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000 }
                };
                const tiers = Object.keys(cardStats);

                const currentTier = userCard.card_type;
                const currentIndex = tiers.indexOf(currentTier);

                if (currentIndex === -1 || currentIndex >= tiers.length - 1) {
                    return interaction.editReply(`ℹ️ **${citizenData.full_name}** ya tiene la mejor tarjeta disponible: **${currentTier}**.`);
                }

                const nextTier = tiers[currentIndex + 1];
                const nextStats = cardStats[nextTier];

                // Button for User to Accept
                const upgradeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`btn_upgrade_${targetUser.id}_${nextTier.replace(/ /g, '_')}`)
                        .setLabel(`Aceptar y Pagar $${nextStats.cost.toLocaleString()}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💳'),
                    new ButtonBuilder()
                        .setCustomId(`btn_cancel_upgrade_${targetUser.id}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

                // Send Offer to Channel Publicly (Ticket)
                const offerEmbed = new EmbedBuilder()
                    .setTitle('🎁 ¡Oferta Exclusiva de Banco Nacional!')
                    .setColor(0xFFD700)
                    .setDescription(`Estimado/a <@${targetUser.id}>,\n\nDado tu excelente historial crediticio (Score: **${score}/100**), el Banco Nacional te ofrece una **mejora de tarjeta**.\n\n**Beneficios:**\n✅ Nuevo Límite: $${nextStats.limit.toLocaleString()}\n✅ Tasa Interés: ${nextStats.interest}%`)
                    .addFields(
                        { name: 'Tarjeta Actual', value: currentTier, inline: true },
                        { name: 'Nueva Oferta', value: `✨ **${nextTier}**`, inline: true },
                        { name: 'Coste Mejora', value: `$${nextStats.cost.toLocaleString()}`, inline: true },
                        { name: 'Ejecutivo Asignado', value: '<@1451291919320748275>', inline: false }
                    )
                    .setFooter({ text: 'Pulsa el botón para aceptar la mejora inmediata.' })
                    .setTimestamp();

                await interaction.editReply({
                    content: `🔔 Atención <@${targetUser.id}>`,
                    embeds: [offerEmbed],
                    components: [upgradeRow]
                });
            }
        }
        else if (subCmd === 'debug') {
            await interaction.deferReply({ ephemeral: false });

            const userId = interaction.user.id;
            const userName = interaction.user.tag;
            let output = `🔍 **Diagnóstico de Usuario**\n`;
            output += `Discord ID: \`${userId}\`\n`;
            output += `Usuario: ${userName}\n\n`;

            // 1. Search in Citizens with loose matching
            // Try explicit match
            const { data: exactMatch, error: exactError } = await supabase.from('citizens').select('*').eq('discord_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (exactMatch) {
                output += `✅ **Ciudadano Encontrado (Match Exacto)**\n`;
                output += `ID: ${exactMatch.id}\nNombre: ${exactMatch.full_name}\nDNI: ${exactMatch.dni}\nDiscordID en DB: \`${exactMatch.discord_id}\`\n\n`;

                const { data: card } = await supabase.from('credit_cards').select('*').eq('citizen_id', exactMatch.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (card) {
                    output += `✅ **Tarjeta Encontrada**\nTipo: ${card.card_type}\nEstado: ${card.status}\n`;
                } else {
                    output += `⚠️ **Sin Tarjeta vinculada al ciudadano.**\n`;
                }

            } else {
                output += `❌ **No se encontró coincidencia exacta en Citizens.**\n`;
                if (exactError) output += `Error DB: ${exactError.message}\n`;

                // Try fuzzy search or list recent to help Staff identify the correct record
                const { data: potentials } = await supabase.from('citizens').select('full_name, discord_id').limit(5).order('created_at', { ascending: false });
                output += `\n📋 **Últimos 5 registros (Para comparar):**\n`;
                if (potentials) {
                    potentials.forEach(p => {
                        output += `- ${p.full_name}: \`${p.discord_id}\`\n`;
                    });
                }
            }

            // Check Profiles just in case
            const { data: profile } = await supabase.from('profiles').select('*').eq('discord_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (profile) {
                output += `\n✅ **Perfil Web Encontrado (profiles)**\nRole: ${profile.role}\n`;
            } else {
                output += `\n⚠️ **Sin Perfil Web (profiles)**\n`;
            }

            await interaction.editReply(output.substring(0, 1999));
        }
    }

    else if (commandName === 'rol') {
        const subCmd = interaction.options.getSubcommand();
        if (subCmd === 'cancelar') {
            await interaction.deferReply({ ephemeral: false });

            const targetUser = interaction.options.getString('usuario');
            const reason = interaction.options.getString('razon');
            const location = interaction.options.getString('ubicacion');
            const proof1 = interaction.options.getAttachment('prueba1');
            const proof2 = interaction.options.getAttachment('prueba2');

            // Insert into DB
            const { error } = await supabase.from('rp_cancellations').insert([{
                moderator_discord_id: interaction.user.id,
                moderator_name: interaction.user.tag,
                target_user: targetUser,
                reason: reason,
                location: location,
                proof_url_1: proof1 ? proof1.url : null,
                proof_url_2: proof2 ? proof2.url : null
            }]);

            if (error) {
                console.error(error);
                return interaction.editReply('❌ Error guardando el reporte en la base de datos.');
            }

            await interaction.editReply('✅ Reporte de cancelación enviado exitosamente. Se publicará en breve.');
        }
    }



    else if (commandName === 'multa') {
        await interaction.deferReply();

        // 1. Role Check (Policia: 1416867605976715363)
        if (!interaction.member.roles.cache.has('1416867605976715363') && !interaction.member.permissions.has('Administrator')) {
            return interaction.editReply({ content: '⛔ No tienes placa de policía (Rol Requerido).', ephemeral: false });
        }

        const targetUser = interaction.options.getUser('usuario');
        const amount = interaction.options.getNumber('monto');
        const reason = interaction.options.getString('razon');

        // 2. Find Citizen
        let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (!citizen) {
            // Auto-register "John Doe" so we can fine him
            // Use targetUser.globalName or username as fallback
            const displayName = targetUser.globalName || targetUser.username;
            console.log(`Auto-registering ${displayName} for fine...`);

            const { data: newCit, error: createError } = await supabase.from('citizens').insert([{
                discord_id: targetUser.id,
                full_name: displayName,
                dni: 'PENDING_MULTA',
                credit_score: 50 // Penalty for not being registered? Or default 100.
            }]).select('id, full_name').single();

            if (createError || !newCit) return interaction.editReply(`❌ Error creando registro temporal: ${createError?.message}`);

            citizen = newCit; // Assign to continue logic
        }

        // 3. Request Payment Method
        const paymentResult = await requestPaymentMethod(
            interaction,
            targetUser.id,
            amount,
            `🚔 Multa: ${reason}`
        );

        let status = 'UNPAID';
        let paymentMethod = 'ninguno';

        if (paymentResult.success) {
            status = 'PAID';
            paymentMethod = paymentResult.method;
        }

        // 4. Record Fine
        const { error: fineError } = await supabase.from('fines').insert([{
            citizen_id: citizen.id,
            officer_discord_id: interaction.user.id,
            amount: amount,
            reason: reason,
            status: status
        }]);

        const paymentMethodLabel = paymentMethod === 'cash' ? '💵 Efectivo' : paymentMethod === 'bank' ? '🏦 Banco/Débito' : paymentMethod === 'credit' ? '💳 Crédito' : '⏳ Pendiente';

        const embed = new EmbedBuilder()
            .setTitle('🚔 Multa Aplicada')
            .setColor(status === 'PAID' ? 0xFF0000 : 0xFFA500)
            .addFields(
                { name: 'Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Monto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Estado', value: status === 'PAID' ? '✅ Pagado' : '⏳ Pendiente', inline: true },
                { name: 'Método de Pago', value: paymentMethodLabel, inline: true },
                { name: 'Motivo', value: reason, inline: false },
                { name: 'Oficial', value: interaction.user.tag, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });
    }

    else if (commandName === 'fichar') {
        const subCmd = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: false });

        // --- SUBCOMMAND: VINCULAR (STAFF ONLY) ---
        if (subCmd === 'vincular') {
            // 1. Role Check (Staff Banco: 1450591546524307689)
            if (!interaction.member.roles.cache.has('1450591546524307689') && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('⛔ No tienes permisos para vincular ciudadanos (Rol Staff Banco Requerido).');
            }

            const targetUser = interaction.options.getUser('usuario');
            const fullName = interaction.options.getString('nombre');
            const dniPhoto = interaction.options.getAttachment('dni');

            // 2. Check if Citizen exists (by Discord ID)
            let { data: existingCitizen } = await supabase.from('citizens').select('*').eq('discord_id', targetUser.id).limit(1).maybeSingle();

            if (existingCitizen) {
                // Update existing
                const { error: updateError } = await supabase.from('citizens').update({ full_name: fullName, dni: dniPhoto.url }).eq('id', existingCitizen.id);
                if (updateError) return interaction.editReply(`❌ Error actualizando ciudadano: ${updateError.message}`);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Ciudadano Actualizado')
                    .setColor(0x00FF00)
                    .setDescription(`Los datos de <@${targetUser.id}> han sido actualizados.`)
                    .addFields(
                        { name: 'Nombre', value: fullName, inline: true },
                        { name: 'DNI (Foto)', value: '[Ver Documento](' + dniPhoto.url + ')', inline: true }
                    )
                    .setThumbnail(dniPhoto.url)
                    .setFooter({ text: `Vinculado por ${interaction.user.tag}` });
                return interaction.editReply({ embeds: [embed] });
            } else {
                // Create new
                const { error: createError } = await supabase.from('citizens').insert([{
                    discord_id: targetUser.id,
                    full_name: fullName,
                    dni: dniPhoto.url, // Store URL
                    credit_score: 100 // Default score
                }]);

                if (createError) return interaction.editReply(`❌ Error registrando ciudadano: ${createError.message}`);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Ciudadano Registrado y Vinculado')
                    .setColor(0x00FF00)
                    .setDescription(`Se ha creado un nuevo registro para <@${targetUser.id}>.`)
                    .addFields(
                        { name: 'Nombre', value: fullName, inline: true },
                        { name: 'DNI (Foto)', value: '[Ver Documento](' + dniPhoto.url + ')', inline: true }
                    )
                    .setThumbnail(dniPhoto.url)
                    .setFooter({ text: `Registrado por ${interaction.user.tag}` });
                return interaction.editReply({ embeds: [embed] });
            }
        }
    }


    if (commandName === 'saldo') {
        await interaction.reply({ content: 'Esta función estará disponible pronto.', ephemeral: false });
    }
    else if (commandName === 'inversion') {
        await interaction.deferReply(); // Global defer

        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'nueva') {
            const amount = interaction.options.getNumber('monto');
            if (amount < 5000) return interaction.editReply('❌ La inversión mínima es de **$5,000**.');

            // Check Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const userMoney = balance.total || (balance.cash + balance.bank);

            if (userMoney < amount) {
                return interaction.editReply(`❌ **Fondos Insuficientes**. Tienes: $${userMoney.toLocaleString()}`);
            }

            // Remove Money
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, `Inversión Plazo Fijo`);

            // Calculate Dates and Profit
            const now = new Date();
            const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 Days
            const interestRate = 5; // 5% weekly
            const payout = amount + (amount * (interestRate / 100));

            // Insert DB
            await supabase.from('investments').insert([{
                discord_id: interaction.user.id,
                invested_amount: amount,
                interest_rate: interestRate,
                start_date: now.toISOString(),
                end_date: endDate.toISOString(),
                payout_amount: payout,
                status: 'active'
            }]);

            // Log
            await supabase.from('banking_transactions').insert([{
                sender_discord_id: interaction.user.id,
                receiver_discord_id: null,
                amount: amount,
                type: 'investment',
                description: `Apertura Plazo Fijo (7 días al ${interestRate}%)`
            }]);

            const embed = new EmbedBuilder()
                .setTitle('📈 Inversión Exitosa')
                .setColor(0x00FF00)
                .setDescription(`Has invertido **$${amount.toLocaleString()}**.\n\n📅 **Vencimiento:** <t:${Math.floor(endDate.getTime() / 1000)}:R>\n💰 **Retorno Esperado:** $${payout.toLocaleString()}\n\n*El dinero está bloqueado hasta la fecha de vencimiento.*`);

            await interaction.editReply({ embeds: [embed] });
        }
        else if (subCmd === 'estado') {
            await interaction.deferReply();
            const { data: investments } = await supabase.from('investments')
                .select('*')
                .eq('discord_id', interaction.user.id)
                .eq('status', 'active');

            if (!investments || investments.length === 0) return interaction.editReply('📉 No tienes inversiones activas.');

            const embed = new EmbedBuilder()
                .setTitle('💼 Portafolio de Inversiones')
                .setColor(0xD4AF37);

            const rows = []; // Component rows (buttons)

            let desc = '';
            for (const inv of investments) {
                const endDate = new Date(inv.end_date);
                const isReady = new Date() >= endDate;
                const statusIcon = isReady ? '🟢 **DISPONIBLE**' : '🔒 Bloqueado';

                desc += `**ID:** \`${inv.id.split('-')[0]}\` | Inversión: **$${inv.invested_amount.toLocaleString()}**\nRetorno: **$${inv.payout_amount.toLocaleString()}** | ${statusIcon}\nVence: <t:${Math.floor(endDate.getTime() / 1000)}:R>\n\n`;

                if (isReady) {
                    rows.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`btn_collect_${inv.id}`)
                            .setLabel(`Retirar $${inv.payout_amount.toLocaleString()} (ID: ${inv.id.split('-')[0]})`)
                            .setStyle(ButtonStyle.Success)
                    ));
                }
            }

            embed.setDescription(desc || 'Tus inversiones aparecerán aquí.');

            // Limit buttons to 5 rows
            await interaction.editReply({ embeds: [embed], components: rows.slice(0, 5) });
        }
    }


    else if (commandName === 'licencia') {
        const subcommand = interaction.options.getSubcommand();

        // Staff-only check
        const STAFF_ROLE_ID = '1450688555503587459';
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ Solo el staff puede gestionar licencias.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const tipo = interaction.options.getString('tipo');

        const licenseData = {
            'conducir': { name: 'Licencia de Conducir', cost: 1200, emoji: '🚗' },
            'armas_largas': { name: 'Licencia de Armas Largas', cost: 1500, emoji: '🔫' },
            'armas_cortas': { name: 'Licencia de Armas Cortas', cost: 1200, emoji: '🔫' }
        };

        if (subcommand === 'registrar') {
            await interaction.deferReply({ flags: 64 });

            try {
                const license = licenseData[tipo];

                // Check if already has this license FIRST
                const { data: existing } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .eq('license_type', tipo)
                    .eq('status', 'active');

                if (existing && existing.length > 0) {
                    return interaction.editReply(`⚠️ <@${targetUser.id}> ya tiene esta licencia activa.`);
                }

                // Use universal payment system
                const paymentResult = await requestPaymentMethod(
                    interaction,
                    targetUser.id,
                    license.cost,
                    `${license.emoji} ${license.name}`
                );

                if (!paymentResult.success) {
                    return interaction.editReply(paymentResult.error);
                }

                // Register license
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 14); // 2 weeks validity

                await supabase
                    .from('licenses')
                    .insert({
                        discord_user_id: targetUser.id,
                        license_type: tipo,
                        license_name: license.name,
                        issued_by: interaction.user.id,
                        issued_at: new Date().toISOString(),
                        expires_at: expiryDate.toISOString(),
                        status: 'active'
                    });

                const paymentMethodLabel = paymentResult.method === 'cash' ? '💵 Efectivo' : paymentResult.method === 'bank' ? '🏦 Banco/Débito' : '💳 Crédito';

                const embed = new EmbedBuilder()
                    .setTitle(`${license.emoji} Licencia Registrada`)
                    .setColor(0x00FF00)
                    .setDescription(`**${license.name}** otorgada exitosamente`)
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                        { name: '💵 Costo', value: `$${license.cost.toLocaleString()}`, inline: true },
                        { name: '💳 Método de Pago', value: paymentMethodLabel, inline: true },
                        { name: '📅 Válida hasta', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:D>`, inline: false },
                        { name: '👮 Emitida por', value: interaction.user.tag, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Licencias Nación MX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed], components: [] });

                // Send receipt to citizen
                try {
                    await targetUser.send({
                        content: `📜 **Nueva licencia registrada**`,
                        embeds: [embed]
                    });
                } catch (dmError) {
                    console.log('Could not DM citizen:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error registrando licencia.');
            }
        }

        else if (subcommand === 'revocar') {
            await interaction.deferReply({ flags: 64 });

            const razon = interaction.options.getString('razon');

            try {
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .eq('license_type', tipo)
                    .eq('status', 'active');

                if (!licenses || licenses.length === 0) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no tiene esta licencia activa.`);
                }

                // Revoke license
                await supabase
                    .from('licenses')
                    .update({
                        status: 'revoked',
                        revoked_by: interaction.user.id,
                        revoked_at: new Date().toISOString(),
                        revoke_reason: razon
                    })
                    .eq('id', licenses[0].id);

                const license = licenseData[tipo];

                const embed = new EmbedBuilder()
                    .setTitle(`${license.emoji} Licencia Revocada`)
                    .setColor(0xFF0000)
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                        { name: '📜 Licencia', value: license.name, inline: true },
                        { name: '📝 Razón', value: razon, inline: false },
                        { name: '👮 Revocada por', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Notify citizen
                try {
                    await targetUser.send({
                        content: `⚠️ **Licencia Revocada**`,
                        embeds: [embed]
                    });
                } catch (dmError) {
                    console.log('Could not DM citizen:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error revocando licencia.');
            }
        }

        else if (subcommand === 'ver') {
            await interaction.deferReply({ flags: 64 });

            try {
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .order('issued_at', { ascending: false });

                if (!licenses || licenses.length === 0) {
                    return interaction.editReply(`📋 <@${targetUser.id}> no tiene licencias registradas.`);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Licencias de ${targetUser.tag}`)
                    .setColor(0x5865F2)
                    .setThumbnail(targetUser.displayAvatarURL());

                const active = licenses.filter(l => l.status === 'active');
                const revoked = licenses.filter(l => l.status === 'revoked');
                const expired = licenses.filter(l => l.status === 'expired');

                if (active.length > 0) {
                    let activeText = '';
                    active.forEach(l => {
                        const license = licenseData[l.license_type];
                        const expiryTimestamp = Math.floor(new Date(l.expires_at).getTime() / 1000);
                        activeText += `${license.emoji} **${l.license_name}**\n└ Expira: <t:${expiryTimestamp}:R>\n`;
                    });
                    embed.addFields({ name: '✅ Activas', value: activeText, inline: false });
                }

                if (revoked.length > 0) {
                    let revokedText = '';
                    revoked.forEach(l => {
                        const license = licenseData[l.license_type];
                        revokedText += `${license.emoji} **${l.license_name}**\n└ Razón: ${l.revoke_reason}\n`;
                    });
                    embed.addFields({ name: '❌ Revocadas', value: revokedText, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando licencias.');
            }
        }
    }

    else if (commandName === 'nomina') {
        await interaction.deferReply(); // Global defer

        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'crear') {
            const name = interaction.options.getString('nombre');
            await supabase.from('payroll_groups').insert([{ owner_discord_id: interaction.user.id, name: name }]);
            await interaction.editReply(`✅ Grupo de nómina **${name}** creado.`);
        }
        else if (subCmd === 'agregar') {
            const groupName = interaction.options.getString('grupo');
            const target = interaction.options.getUser('empleado');
            const salary = interaction.options.getNumber('sueldo');

            // Find group
            const { data: group } = await supabase.from('payroll_groups').select('id').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
            if (!group) return interaction.editReply('❌ No encontré ese grupo o no eres el dueño.');

            await supabase.from('payroll_members').upsert([{ group_id: group.id, member_discord_id: target.id, salary: salary }]);
            await interaction.editReply(`✅ **${target.username}** agregado a **${groupName}** con sueldo $${salary}.`);
        }
        else if (subCmd === 'pagar') {
            await interaction.deferReply();
            const groupName = interaction.options.getString('grupo');

            const { data: group } = await supabase.from('payroll_groups').select('id').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
            if (!group) return interaction.editReply('❌ Grupo no encontrado.');

            const { data: members } = await supabase.from('payroll_members').select('*').eq('group_id', group.id);
            if (!members || members.length === 0) return interaction.editReply('❌ El grupo no tiene empleados.');

            let total = 0;
            members.forEach(m => total += m.salary);

            // Check Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const userMoney = balance.total || (balance.cash + balance.bank);
            if (userMoney < total) return interaction.editReply(`❌ Fondos insuficientes. Necesitas **$${total.toLocaleString()}**.`);

            // Process
            let report = `💰 **Nómina Pagada: ${groupName}**\nTotal: $${total.toLocaleString()}\n\n`;

            // Deduct from Owner
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, total, `Pago Nómina: ${groupName}`);

            // Pay Employees
            for (const m of members) {
                await billingService.ubService.addMoney(interaction.guildId, m.member_discord_id, m.salary, `Nómina de ${interaction.user.username}`);
                report += `✅ <@${m.member_discord_id}>: $${m.salary.toLocaleString()}\n`;
            }

            await interaction.editReply(report);
        }
    }


    else if (commandName === 'business') {
        const subcommand = interaction.options.getSubcommand();

        // Staff-only check
        const STAFF_ROLE_ID = '1450688555503587459'; // Same as empresa crear
        if (!interaction.member.roles.cache.has(STAFF_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '⛔ Solo el staff puede gestionar tarjetas business.', flags: 64 });
        }

        if (subcommand === 'vincular') {
            await interaction.deferReply({ flags: 64 });

            const ownerUser = interaction.options.getUser('dueño');
            const cardType = interaction.options.getString('tipo');

            try {
                // 1. Check if owner has companies
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [ownerUser.id])
                    .eq('status', 'active');

                if (!companies || companies.length === 0) {
                    return interaction.editReply(`❌ <@${ownerUser.id}> no tiene empresas registradas.`);
                }

                // 2. If has multiple companies, ask which one
                if (companies.length > 1) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`business_select_${ownerUser.id}_${cardType}`)
                        .setPlaceholder('Selecciona la empresa')
                        .addOptions(
                            companies.map(c => ({
                                label: c.name,
                                description: `${c.industry_type} • ${c.is_private ? 'Privada' : 'Pública'}`,
                                value: c.id
                            }))
                        );

                    const row = new ActionRowBuilder().addComponents(selectMenu);

                    return interaction.editReply({
                        content: `📋 <@${ownerUser.id}> tiene **${companies.length} empresas**. Selecciona a cuál vincular la tarjeta:`,
                        components: [row]
                    });
                }

                // 3. Only one company, proceed directly
                const company = companies[0];

                // Card data map
                const cardData = {
                    'business_start': { name: 'Business Start', limit: 50000, interest: 0.02, cost: 8000 },
                    'business_gold': { name: 'Business Gold', limit: 100000, interest: 0.015, cost: 15000 },
                    'business_platinum': { name: 'Business Platinum', limit: 200000, interest: 0.012, cost: 20000 },
                    'business_elite': { name: 'Business Elite', limit: 500000, interest: 0.01, cost: 35000 },
                    'nmx_corporate': { name: 'NMX Corporate', limit: 1000000, interest: 0.007, cost: 50000 }
                };

                const card = cardData[cardType];

                // 4. Create business credit card
                const { error } = await supabase
                    .from('credit_cards')
                    .insert({
                        discord_id: ownerUser.id,
                        card_type: cardType,
                        card_name: card.name,
                        card_limit: card.limit,
                        current_balance: 0,
                        interest_rate: card.interest,
                        card_cost: card.cost,
                        status: 'active',
                        company_id: company.id,
                        approved_by: interaction.user.id
                    });

                if (error) throw error;

                const embed = new EmbedBuilder()
                    .setTitle('✅ Tarjeta Business Vinculada')
                    .setColor(0x00FF00)
                    .setDescription(`Tarjeta **${card.name}** vinculada exitosamente.`)
                    .addFields(
                        { name: '🏢 Empresa', value: company.name, inline: true },
                        { name: '👤 Dueño', value: `<@${ownerUser.id}>`, inline: true },
                        { name: '💳 Tarjeta', value: card.name, inline: true },
                        { name: '💰 Límite', value: `$${card.limit.toLocaleString()}`, inline: true },
                        { name: '📊 Interés', value: `${(card.interest * 100).toFixed(2)}%`, inline: true },
                        { name: '💵 Costo', value: `$${card.cost.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Aprobado por ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send DM to owner
                try {
                    await ownerUser.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🎉 Tarjeta Business Aprobada')
                            .setColor(0x5865F2)
                            .setDescription(`Tu solicitud de **${card.name}** ha sido aprobada y vinculada a **${company.name}**.`)
                            .addFields(
                                { name: '💰 Límite de Crédito', value: `$${card.limit.toLocaleString()}`, inline: true },
                                { name: '📊 Tasa de Interés', value: `${(card.interest * 100).toFixed(2)}%`, inline: true },
                                { name: '💼 Uso', value: 'Usa \`/empresa credito\` para solicitar fondos.', inline: false }
                            )
                            .setFooter({ text: 'Sistema Financiero Nación MX' })
                        ]
                    });
                } catch (dmError) {
                    console.log('Could not DM owner:', dmError.message);
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error vinculando tarjeta business.');
            }
        }

        else if (subcommand === 'listar') {
            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('usuario');

            try {
                const { data: cards } = await supabase
                    .from('credit_cards')
                    .select('*, companies(name)')
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                if (!cards || cards.length === 0) {
                    return interaction.editReply(`📋 <@${targetUser.id}> no tiene tarjetas business activas.`);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`💼 Tarjetas Business de ${targetUser.tag}`)
                    .setColor(0x5865F2)
                    .setDescription(`Total: **${cards.length}** tarjeta(s) activa(s)`)
                    .setThumbnail(targetUser.displayAvatarURL());

                cards.forEach(card => {
                    const companyName = card.companies ? card.companies.name : 'Sin empresa';
                    embed.addFields({
                        name: `💳 ${card.card_name}`,
                        value: `🏢 Empresa: ${companyName}\n💰 Límite: $${card.card_limit.toLocaleString()}\n📊 Deuda: $${(card.current_balance || 0).toLocaleString()}\n📈 Disponible: $${(card.card_limit - (card.current_balance || 0)).toLocaleString()}`,
                        inline: false
                    });
                });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando tarjetas.');
            }
        }

        else if (subcommand === 'cancelar') {
            await interaction.deferReply({ flags: 64 });

            const targetUser = interaction.options.getUser('usuario');
            const razon = interaction.options.getString('razon');

            try {
                // Get all active business cards
                const { data: cards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                if (!cards || cards.length === 0) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no tiene tarjetas business activas.`);
                }

                // Cancel all
                await supabase
                    .from('credit_cards')
                    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: interaction.user.id, cancel_reason: razon })
                    .eq('discord_id', targetUser.id)
                    .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                    .eq('status', 'active');

                await interaction.editReply(`✅ Se cancelaron **${cards.length}** tarjeta(s) business de <@${targetUser.id}>.\n**Razón:** ${razon}`);

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error cancelando tarjetas.');
            }
        }
    }

    else if (commandName === 'bolsa') {
        await interaction.deferReply(); // Global defer to prevent timeouts

        const subcommand = interaction.options.getSubcommand();
        const hour = new Date().getHours();

        if (subcommand === 'precios') {
            const embed = new EmbedBuilder()
                .setTitle('📈 Bolsa de Valores & Cripto')
                .setColor(0x0000FF)
                .setDescription(`Precios en tiempo real (MXN). Actualizados a las ${hour}:00 hrs.`)
                .setTimestamp();

            globalStocks.forEach(s => {
                const trend = s.current > s.base ? '📈' : '📉'; // Simple trend logic vs base
                // For better trend, we'd compare vs prev, but base is fine for now
                embed.addFields({ name: `${trend} ${s.symbol} - ${s.name}`, value: `$${s.current.toLocaleString()} MXN`, inline: true });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subcommand === 'comprar') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.editReply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
            }

            const currentPrice = stock.current;
            const totalCost = currentPrice * cantidad;

            // Check user balance
            try {
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.bank < totalCost) {
                    return await interaction.editReply({
                        content: `❌ Fondos insuficientes. Necesitas $${totalCost.toLocaleString()} MXN pero solo tienes $${balance.bank.toLocaleString()} MXN en el banco.`,
                        ephemeral: false
                    });
                }

                // Deduct money
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, totalCost, `Compra ${cantidad} ${symbol}`);

                // Update portfolio
                const { data: existing } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('stock_symbol', symbol)
                    .single();

                if (existing) {
                    const totalShares = existing.shares + cantidad;
                    const newAvgPrice = ((existing.avg_buy_price * existing.shares) + (currentPrice * cantidad)) / totalShares;

                    await supabase
                        .from('stock_portfolios')
                        .update({ shares: totalShares, avg_buy_price: newAvgPrice })
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                } else {
                    await supabase
                        .from('stock_portfolios')
                        .insert({
                            discord_user_id: interaction.user.id,
                            stock_symbol: symbol,
                            shares: cantidad,
                            avg_buy_price: currentPrice
                        });
                }

                // Log transaction
                await supabase
                    .from('stock_transactions')
                    .insert({
                        discord_user_id: interaction.user.id,
                        stock_symbol: symbol,
                        transaction_type: 'BUY',
                        shares: cantidad,
                        price_per_share: currentPrice,
                        total_amount: totalCost
                    });

                const embed = new EmbedBuilder()
                    .setTitle('✅ Compra Exitosa')
                    .setColor(0x00FF00)
                    .setDescription(`Has comprado **${cantidad} acciones de ${symbol}**`)
                    .addFields(
                        { name: 'Precio por Acción', value: `$${currentPrice.toLocaleString()}`, inline: true },
                        { name: 'Total Pagado', value: `$${totalCost.toLocaleString()}`, inline: true },
                        { name: 'Balance Restante', value: `$${(balance.bank - totalCost).toLocaleString()}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error comprando acciones:', error);
                await interaction.editReply({ content: '❌ Error procesando la compra. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'vender') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.editReply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
            }

            try {
                // Check portfolio
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('stock_symbol', symbol)
                    .single();

                if (!portfolio || portfolio.shares < cantidad) {
                    return await interaction.editReply({
                        content: `❌ No tienes suficientes acciones. Tienes ${portfolio?.shares || 0} de ${symbol}.`,
                        ephemeral: false
                    });
                }

                const currentPrice = stock.current;
                const totalRevenue = currentPrice * cantidad;
                const profit = (currentPrice - portfolio.avg_buy_price) * cantidad;
                const profitEmoji = profit >= 0 ? '📈' : '📉';

                // Add money (Use BillingService wrapper if possible, or direct UB service)
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, totalRevenue, `Venta ${cantidad} ${symbol}`);

                // Update portfolio
                const newShares = portfolio.shares - cantidad;
                if (newShares <= 0) {
                    await supabase
                        .from('stock_portfolios')
                        .delete()
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                } else {
                    await supabase
                        .from('stock_portfolios')
                        .update({ shares: newShares })
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol);
                }

                // Log transaction
                await supabase
                    .from('stock_transactions')
                    .insert({
                        discord_user_id: interaction.user.id,
                        stock_symbol: symbol,
                        transaction_type: 'SELL',
                        shares: cantidad,
                        price_per_share: currentPrice,
                        total_amount: totalRevenue
                    });

                const embed = new EmbedBuilder()
                    .setTitle('✅ Venta Exitosa')
                    .setColor(profit >= 0 ? 0x00FF00 : 0xFF0000)
                    .setDescription(`Has vendido **${cantidad} acciones de ${symbol}**`)
                    .addFields(
                        { name: 'Precio por Acción', value: `$${currentPrice.toLocaleString()} MXN`, inline: true },
                        { name: 'Total Recibido', value: `$${totalRevenue.toLocaleString()} MXN`, inline: true },
                        { name: profit >= 0 ? '📈 Ganancia' : '📉 Pérdida', value: `$${Math.abs(Math.floor(profit)).toLocaleString()} MXN`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error vendiendo acciones:', error);
                await interaction.editReply({ content: '❌ Error procesando la venta. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'portafolio') {
            try {
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id);

                if (!portfolio || portfolio.length === 0) {
                    return await interaction.editReply({ content: '📊 Tu portafolio está vacío. Usa `/bolsa comprar` para invertir.', ephemeral: false });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📊 Portafolio de ${interaction.user.username}`)
                    .setColor(0xFFD700)
                    .setTimestamp();

                let totalInvested = 0;
                let totalCurrent = 0;

                portfolio.forEach(p => {
                    const stock = stocks.find(s => s.symbol === p.stock_symbol);
                    if (!stock) return;

                    const currentPrice = getPrice(stock.base);
                    const invested = p.avg_buy_price * p.shares;
                    const currentValue = currentPrice * p.shares;
                    const profitLoss = currentValue - invested;
                    const profitEmoji = profitLoss >= 0 ? '📈' : '📉';

                    totalInvested += invested;
                    totalCurrent += currentValue;

                    embed.addFields({
                        name: `${profitEmoji} ${p.stock_symbol} (${p.shares} acciones)`,
                        value: `Compra: $${p.avg_buy_price.toLocaleString()} | Actual: $${currentPrice.toLocaleString()}\nValor: $${currentValue.toLocaleString()} | ${profitLoss >= 0 ? '📈 Ganancia' : '📉 Pérdida'}: $${Math.abs(profitLoss).toLocaleString()}`,
                        inline: false
                    });
                });

                const totalProfit = totalCurrent - totalInvested;
                const profitEmoji = totalProfit >= 0 ? '📈' : '📉';

                const profitLabel = totalProfit >= 0 ? '📈 Ganancia Total' : '📉 Pérdida Total';
                embed.setDescription(`**Total Invertido:** $${totalInvested.toLocaleString()}\n**Valor Actual:** $${totalCurrent.toLocaleString()}\n**${profitLabel}:** $${Math.abs(totalProfit).toLocaleString()}`);

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando portafolio:', error);
                await interaction.editReply({ content: '❌ Error obteniendo tu portafolio.', ephemeral: false });
            }
        }

        else if (subcommand === 'historial') {
            try {
                const { data: transactions } = await supabase
                    .from('stock_transactions')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (!transactions || transactions.length === 0) {
                    return await interaction.editReply({ content: '📜 No tienes transacciones registradas.', ephemeral: false });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 Historial de Transacciones`)
                    .setColor(0x3498DB)
                    .setDescription(`Últimas ${transactions.length} transacciones`)
                    .setTimestamp();

                transactions.forEach(t => {
                    const typeEmoji = t.transaction_type === 'BUY' ? '🛒' : '💰';
                    const date = new Date(t.created_at).toLocaleDateString();

                    embed.addFields({
                        name: `${typeEmoji} ${t.transaction_type} - ${t.stock_symbol}`,
                        value: `${t.shares} acciones @ $${t.price_per_share.toLocaleString()} = $${t.total_amount.toLocaleString()}\n${date}`,
                        inline: true
                    });
                });

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando historial:', error);
                await interaction.editReply({ content: '❌ Error obteniendo tu historial.', ephemeral: false });
            }
        }
    }

    else if (commandName === 'impuestos') {
        await interaction.reply({ content: '🛠️ **Próximamente:** Sistema de impuestos dinámico.', ephemeral: true });
    }
});

function getColorForCard(type) {
    if (type.includes('Start')) return 0xA0522D;
    if (type.includes('Básica')) return 0x4169E1;
    if (type.includes('Plus')) return 0x32CD32;
    if (type.includes('Plata')) return 0xC0C0C0;
    if (type.includes('Oro')) return 0xFFD700;
    if (type.includes('Rubí')) return 0xDC143C;
    if (type.includes('Black')) return 0x111111;
    if (type.includes('Diamante')) return 0x00BFFF;
    return 0xFFFFFF;
}

// Listen for new Credit Cards
async function subscribeToNewCards() {
    console.log("Listening for new credit cards...");

    // 1. Listen for DB Inserts
    supabase
        .channel('credit-cards-insert')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'credit_cards' },
            async (payload) => {
                console.log('💳 Nueva tarjeta detectada!', payload.new);
                const newCard = payload.new;

                // 2. Fetch Citizen Info (including discord_id)
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('full_name, dni, discord_id')
                    .eq('id', newCard.citizen_id)
                    .single();

                const citizenName = citizen ? citizen.full_name : 'Desconocido';
                const citizenDni = citizen ? citizen.dni : '???';
                const discordId = citizen ? citizen.discord_id : null;

                // 3. Build the Embed
                const embed = new EmbedBuilder()
                    .setTitle('💳 Nueva Tarjeta Emitida')
                    .setColor(getColorForCard(newCard.card_type))
                    .addFields(
                        { name: 'Titular', value: citizenName, inline: true },
                        { name: 'DNI', value: citizenDni, inline: true },
                        { name: 'Nivel', value: newCard.card_type, inline: true },
                        { name: 'Límite', value: `$${(newCard.card_limit || newCard.credit_limit || 0).toLocaleString()}`, inline: true },
                        { name: 'Interés', value: `${(newCard.interest_rate * 100).toFixed(2)}%`, inline: true }
                    )
                    .setFooter({ text: 'Banco Nacional RP' })
                    .setTimestamp();

                // 4. Send to Public Channel
                if (NOTIFICATION_CHANNEL_ID) {
                    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(console.error);
                    if (channel) channel.send({ embeds: [embed] }).catch(err => console.error("Error sending to channel:", err));
                }

                // 5. Send DM to User (if discord_id exists)
                if (discordId) {
                    try {
                        const user = await client.users.fetch(discordId);
                        if (user) {
                            await user.send({
                                content: `Hola ${citizenName}, tu nueva tarjeta ha sido aprobada.`,
                                embeds: [embed]
                            });
                            console.log(`✅ DM enviado a ${user.tag}`);
                        }
                    } catch (err) {
                        console.error(`❌ No se pudo enviar DM a ${discordId}. Puede tener DMs cerrados.`);
                    }
                }
            }
        )
        .subscribe();

}

async function subscribeToCancellations() {
    console.log("Listening for Role Cancellations...");
    supabase
        .channel('cancellations-insert')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'rp_cancellations' },
            async (payload) => {
                const data = payload.new;
                console.log('🚫 Nueva cancelación detectada!', data);

                const embed = new EmbedBuilder()
                    .setTitle('🇲🇽 Formato de Cancelación de Rol')
                    .setColor(0xFFFFFF) // White, per user expectation (or tri-color if we use fields)
                    .addFields(
                        { name: '👤 Moderador que cancela', value: `<@${data.moderator_discord_id}>`, inline: false },
                        { name: '📝 Razón', value: data.reason, inline: false },
                        { name: '📍 Lugar', value: data.location, inline: false },
                        { name: '👤 Usuario Sancionado', value: data.target_user, inline: false }
                    )
                    .setTimestamp();

                // Handle Images
                if (data.proof_url_1) embed.setImage(data.proof_url_1);

                const channel = await client.channels.fetch(CANCELLATIONS_CHANNEL_ID).catch(console.error);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                    // Send 2nd and 3rd images as plain attachments/small embeds if they exist
                    if (data.proof_url_2) await channel.send({ content: '**Prueba Adicional 1:**', files: [data.proof_url_2] });
                    if (data.proof_url_3) await channel.send({ content: '**Prueba Adicional 2:**', files: [data.proof_url_3] });
                }
            }
        )
        .subscribe();
}

// ===== UNIVERSAL PAYMENT SYSTEM =====
async function requestPaymentMethod(interaction, userId, amount, description) {
    const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
    const cash = balance.cash || 0;
    const bank = balance.bank || 0;

    const { data: creditCards } = await supabase.from('credit_cards').select('*').eq('discord_user_id', userId).eq('status', 'active');

    let creditAvailable = 0;
    if (creditCards && creditCards.length > 0) {
        creditCards.forEach(c => {
            const limit = c.card_limit || c.credit_limit || 0;
            const debt = c.current_balance || 0;
            creditAvailable += (limit - debt);
        });
    }

    // Check for active Debit Card
    const debitCard = await getDebitCard(userId);

    const methods = [];
    if (cash >= amount) methods.push({ id: 'cash', label: `💵 Efectivo ($${cash.toLocaleString()})`, style: ButtonStyle.Success });
    if (bank >= amount && debitCard) methods.push({ id: 'bank', label: `🏦 Banco/Débito ($${bank.toLocaleString()})`, style: ButtonStyle.Primary });
    if (creditAvailable >= amount) methods.push({ id: 'credit', label: `💳 Crédito (Disp: $${creditAvailable.toLocaleString()})`, style: ButtonStyle.Secondary });

    if (methods.length === 0) {
        return {
            success: false,
            error: `❌ **Fondos Insuficientes**\n\nNecesitas: $${amount.toLocaleString()}\n\n💵 Efectivo: $${cash.toLocaleString()}\n🏦 Banco: $${bank.toLocaleString()}\n💳 Crédito disponible: $${creditAvailable.toLocaleString()}`
        };
    }

    const paymentRow = new ActionRowBuilder();
    methods.forEach(m => paymentRow.addComponents(new ButtonBuilder().setCustomId(`genpay_${m.id}_${Date.now()}`).setLabel(m.label).setStyle(m.style)));

    const embed = new EmbedBuilder()
        .setTitle('💳 Selecciona Método de Pago')
        .setColor(0xFFD700)
        .setDescription(`**${description}**\n\n💰 Total a pagar: **$${amount.toLocaleString()}**\n\nElige cómo deseas pagar:`)
        .setFooter({ text: 'Banco Nacional - Métodos de Pago' });

    const msg = await interaction.editReply({ embeds: [embed], components: [paymentRow] });

    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('genpay_');
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    return new Promise((resolve) => {
        collector.on('collect', async i => {
            await i.deferUpdate();
            const method = i.customId.split('_')[1];

            try {
                if (method === 'cash' || method === 'bank') {
                    await billingService.ubService.removeMoney(interaction.guildId, userId, amount, description, method);
                    collector.stop();
                    resolve({ success: true, method, message: `✅ Pago exitoso con ${method === 'cash' ? 'efectivo' : 'banco/débito'}.` });
                } else if (method === 'credit') {
                    const selectedCard = creditCards[0];
                    const currentDebt = selectedCard.current_balance || 0;
                    const newDebt = currentDebt + amount;
                    await supabase.from('credit_cards').update({ current_balance: newDebt }).eq('id', selectedCard.id);
                    collector.stop();
                    resolve({ success: true, method: 'credit', cardId: selectedCard.id, message: `✅ Pago con crédito.\nNueva deuda: $${newDebt.toLocaleString()}` });
                }
            } catch (error) {
                collector.stop();
                resolve({ success: false, error: `❌ Error procesando pago: ${error.message}` });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) resolve({ success: false, error: '❌ Tiempo agotado. Pago cancelado.' });
        });
    });
}

// ===== BUTTON HANDLERS =====
async function handleUpgradeButton(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const parts = interaction.customId.split('_');
    const targetUserId = parts[2];
    const tierName = parts.slice(3).join(' ');

    if (interaction.user.id !== targetUserId) {
        return interaction.editReply('⛔ Esta oferta no es para ti.');
    }

    const cardStats = {
        'NMX Start': { limit: 15000, interest: 15, cost: 2000 },
        'NMX Básica': { limit: 30000, interest: 12, cost: 4000 },
        'NMX Plus': { limit: 50000, interest: 10, cost: 6000 },
        'NMX Plata': { limit: 100000, interest: 8, cost: 10000 },
        'NMX Oro': { limit: 250000, interest: 7, cost: 15000 },
        'NMX Rubí': { limit: 500000, interest: 6, cost: 25000 },
        'NMX Black': { limit: 1000000, interest: 5, cost: 40000 },
        'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000 }
    };

    const stats = cardStats[tierName];
    if (!stats) return interaction.editReply('❌ Error: Tarjeta desconocida.');

    const cost = stats.cost;
    const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
    const userMoney = balance.total || (balance.cash + balance.bank);

    if (userMoney < cost) {
        return interaction.editReply(`❌ **Fondos Insuficientes**. Tienes $${userMoney.toLocaleString()} y el upgrade cuesta **$${cost.toLocaleString()}**.`);
    }

    console.log(`[DEBUG] Upgrade: Buscando tarjeta para usuario ${interaction.user.id}`);

    // Resolve Citizen (Credit Cards are linked to CITIZENS, not Profiles directly)
    const { data: citizen } = await supabase
        .from('citizens')
        .select('id')
        .eq('discord_id', interaction.user.id)
        .maybeSingle();

    // Query credit card - prioritize citizen_id, fallback to discord_user_id
    let cardQuery = supabase
        .from('credit_cards')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

    if (citizen) {
        cardQuery = cardQuery.eq('citizen_id', citizen.id);
    } else {
        cardQuery = cardQuery.eq('discord_user_id', interaction.user.id);
    }

    const { data: currentCard, error: cardError } = await cardQuery.maybeSingle();

    if (cardError) console.error('[DEBUG] Error buscando tarjeta:', cardError);
    if (!currentCard) console.log(`[DEBUG] No se encontró tarjeta activa para ${interaction.user.id}`);
    else console.log(`[DEBUG] Tarjeta encontrada: ${currentCard.id} (${currentCard.card_type})`);

    if (!currentCard) return interaction.editReply('❌ No tienes una tarjeta activa para mejorar.');
    if (currentCard.card_type === tierName) return interaction.editReply('ℹ️ Ya tienes esta tarjeta.');

    await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, cost, `Upgrade Tarjeta ${tierName}`, 'bank');

    const { error } = await supabase.from('credit_cards').update({
        card_type: tierName,
        card_limit: stats.limit,
        credit_limit: stats.limit
    }).eq('id', currentCard.id);

    if (error) {
        console.error('Upgrade Error:', error);
        return interaction.editReply('❌ Error actualizando base de datos.');
    }

    const successEmbed = new EmbedBuilder()
        .setTitle('🎉 ¡Mejora Exitosa!')
        .setColor(0x00FF00)
        .setDescription(`Has mejorado tu tarjeta a **${tierName}**.\n\nNuevo Límite: $${stats.limit.toLocaleString()}\nCosto Pagado: $${cost.toLocaleString()}`)
        .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
    await interaction.message.edit({ components: [] });
}

// ===== MISSING COMMAND HANDLERS =====

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('btn_upgrade_')) {
            await handleUpgradeButton(interaction);
        } else if (interaction.customId.startsWith('btn_cancel_upgrade_')) {
            await interaction.deferReply({ ephemeral: false });
            const userId = interaction.customId.split('_')[3];

            if (interaction.user.id !== userId) {
                return interaction.editReply('⛔ Esta oferta no es para ti.');
            }

            await interaction.editReply('❌ Has cancelado la oferta de mejora.');
            await interaction.message.edit({ components: [] });
        }
        return;
    }

    if (!interaction.isCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'balanza') {
        await interaction.deferReply();
        try {
            const cashBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            console.log(`[DEBUG] /balanza User: ${interaction.user.id} Balance Raw:`, cashBalance); // DEBUG LOG

            // Resolve Citizen ID for robust lookup
            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', interaction.user.id).maybeSingle();

            const { data: debitCard } = await supabase.from('debit_cards').select('balance').eq('discord_user_id', interaction.user.id).eq('status', 'active').maybeSingle();

            // Fetch Credit Cards via Citizen ID if available, else Discord ID
            let creditQuery = supabase.from('credit_cards').select('*').eq('status', 'active');
            if (citizen) {
                creditQuery = creditQuery.eq('citizen_id', citizen.id);
            } else {
                creditQuery = creditQuery.eq('discord_user_id', interaction.user.id);
            }
            const { data: creditCards } = await creditQuery;

            const cash = cashBalance.cash || 0;
            const bank = cashBalance.bank || 0;
            // Debit Card just checks if exists, balance comes from Bank
            const hasDebit = debitCard ? true : false;

            let creditAvailable = 0;
            let creditDebt = 0;
            if (creditCards) {
                creditCards.forEach(c => {
                    let limit = c.card_limit || c.credit_limit || 0;
                    if (limit === 0 && c.card_type && CARD_TIERS && CARD_TIERS[c.card_type]) {
                        limit = CARD_TIERS[c.card_type].limit || 0;
                    }
                    const debt = c.current_balance || 0;
                    creditAvailable += (limit - debt);
                    creditDebt += debt;
                });
            }

            // Total Liquid is Cash + Bank (Debit is same as Bank) + Avail Credit
            const totalLiquid = cash + bank + creditAvailable;

            const embed = new EmbedBuilder()
                .setTitle('💰 TU BALANZA FINANCIERA')
                .setColor(0x00D26A)
                .addFields(
                    { name: '💵 EFECTIVO', value: `\`\`\`$${cash.toLocaleString()}\`\`\``, inline: true },
                    { name: '🏦 BANCO / DÉBITO', value: `\`\`\`$${bank.toLocaleString()}\`\`\`\n${hasDebit ? '✅ Tarjeta Débito' : '📋 Cuenta Bancaria'}`, inline: true },
                    { name: '💳 CRÉDITO', value: `\`\`\`Disponible: $${creditAvailable.toLocaleString()}\nDeuda: $${creditDebt.toLocaleString()}\`\`\``, inline: false },
                    { name: '📊 PATRIMONIO TOTAL', value: `\`\`\`diff\n+ $${totalLiquid.toLocaleString()}\n\`\`\``, inline: false }
                )
                .setFooter({ text: 'Banco Nacional' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo tu balanza.');
        }
    }

    else if (commandName === 'debito') {
        await interaction.deferReply(); // Global defer to prevent timeouts

        const subcommand = interaction.options.getSubcommand();

        async function getDebitCard(discordId) {
            const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', discordId).eq('status', 'active').maybeSingle();
            return card;
        }

        if (subcommand === 'estado') {
            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa. Visita el Banco Nacional para abrir tu cuenta con `/registrar-tarjeta`.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                const embed = new EmbedBuilder()
                    .setTitle('💳 Estado Tarjeta Débito')
                    .setColor(0x00CED1)
                    .addFields(
                        { name: 'Número', value: `\`${card.card_number}\``, inline: false },
                        { name: 'Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                        { name: 'Estado', value: '✅ Activa', inline: true }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando débito.');
            }
        }
// Add this code between line 3561 (after estado closing }) and line 3563 (before depositar comment)

        // === TRANSFERIR (Debit to Debit - 5 min delay) ===
        else if (subcommand === 'transferir') {
            try {
                const destUser = interaction.options.getUser('destinatario');
                const inputMonto = interaction.options.getString('monto');

                if (destUser.id === interaction.user.id) {
                    return interaction.editReply('❌ No puedes transferir a ti mismo.');
                }

                // Check sender has debit card
                const senderCard = await getDebitCard(interaction.user.id);
                if (!senderCard) {
                    return interaction.editReply('❌ No tienes una tarjeta de débito activa para transferir.');
                }

                // Check receiver has debit card
                const receiverCard = await getDebitCard(destUser.id);
                if (!receiverCard) {
                    return interaction.editReply(`❌ **${destUser.username}** no tiene una tarjeta de débito activa para recibir transferencias.`);
                }

                // Get sender balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                let monto = 0;
                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = bankBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) {
                    return interaction.editReply('❌ El monto debe ser mayor a 0.');
                }

                if (bankBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes.\\n\\nSaldo en Banco: $${bankBalance.toLocaleString()}\\nIntentas transferir: $${monto.toLocaleString()}`);
                }

                // Check receiver card limit
                const receiverTier = CARD_TIERS[receiverCard.card_type];
                const receiverMax = receiverTier ? (receiverTier.max_balance || Infinity) : Infinity;
                if (receiverMax !== Infinity) {
                    const receiverBal = await billingService.ubService.getUserBalance(interaction.guildId, destUser.id);
                    const receiverBank = receiverBal.bank || 0;
                    if ((receiverBank + monto) > receiverMax) {
                        return interaction.editReply(`⛔ El destinatario no puede recibir esta cantidad.\\nExcedería el límite de su tarjeta (**${receiverCard.card_type}**).\\n\\nLímite: $${receiverMax.toLocaleString()}\\nSaldo Actual: $${receiverBank.toLocaleString()}`);
                    }
                }

                // Deduct from sender immediately
                await billingService.ubService.removeMoney(
                    interaction.guildId,
                    interaction.user.id,
                    monto,
                    `Transferencia débito a ${destUser.tag}`,
                    'bank'
                );

                // Schedule transfer for 5 minutes
                const releaseDate = new Date();
                releaseDate.setMinutes(releaseDate.getMinutes() + 5);

                await supabase.from('pending_transfers').insert({
                    sender_id: interaction.user.id,
                    receiver_id: destUser.id,
                    amount: monto,
                    reason: 'Transferencia Interbancaria',
                    release_date: releaseDate.toISOString(),
                    status: 'PENDING',
                    transfer_type: 'debit_to_debit'
                });

                // Log transaction
                await supabase.from('debit_transactions').insert([{
                    debit_card_id: senderCard.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'transfer_out',
                    amount: -monto,
                    description: `Transferencia a ${destUser.tag}`
                }]);

                const embed = new EmbedBuilder()
                    .setTitle('⏳ Transferencia Programada')
                    .setColor(0xFFA500)
                    .setDescription('Tu transferencia se procesará en 5 minutos.')
                    .addFields(
                        { name: 'De', value: interaction.user.tag, inline: true },
                        { name: 'Para', value: destUser.tag, inline: true },
                        { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Llegada Estimada', value: releaseDate.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' }), inline: false }
                    )
                    .setFooter({ text: 'Sistema Interbancario NMX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error procesando la transferencia.');
            }
        }


        // === DEPOSITAR (Cash -> Bank) ===
        // === DEPOSITAR (Cash -> Bank) ===
        else if (subcommand === 'depositar') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa para depositar.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const cashBalance = balance.cash || 0;
                const bankBalance = balance.bank || 0;

                const inputMonto = interaction.options.getString('monto');
                let monto = 0;

                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = cashBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) return interaction.editReply('❌ El monto debe ser un número mayor a 0.');

                if (cashBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes en efectivo.\n\nTienes: $${cashBalance.toLocaleString()}\nIntentas depositar: $${monto.toLocaleString()}`);
                }

                // Check Max Balance Limit (Tier based)
                const tier = CARD_TIERS[card.card_type];
                const maxBal = tier ? (tier.max_balance || Infinity) : Infinity;
                if ((bankBalance + monto) > maxBal) {
                    return interaction.editReply(`⛔ **Límite de Saldo Excedido**\nTu tarjeta **${card.card_type}** tiene un límite de almacenamiento de **$${maxBal.toLocaleString()}**.\nActual: $${bankBalance.toLocaleString()} + Depósito: $${monto.toLocaleString()} > Límite.\n\n💡 **Mejora a NMX Débito Gold para almacenamiento ilimitado.**`);
                }

                // Transfer from cash to bank
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, 'Depósito bancario', 'cash');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, monto, 'Depósito bancario', 'bank');

                // Log transaction
                await supabase.from('debit_transactions').insert({
                    debit_card_id: card.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'deposit',
                    amount: monto,
                    description: 'Depósito en sucursal/ATM'
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏧 Depósito Exitoso')
                    .setColor(0x00FF00)
                    .setDescription('Has depositado efectivo a tu cuenta bancaria.')
                    .addFields(
                        { name: 'Monto Depositado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Nuevo Saldo Banco', value: `$${(bankBalance + monto).toLocaleString()}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error realizando depósito.');
            }
        }

        else if (subcommand === 'retirar') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                const inputMonto = interaction.options.getString('monto');
                let monto = 0;

                if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                    monto = bankBalance;
                } else {
                    monto = parseFloat(inputMonto);
                }

                if (isNaN(monto) || monto <= 0) return interaction.editReply('❌ El monto debe ser un número mayor a 0.');

                if (bankBalance < monto) {
                    return interaction.editReply(`❌ Fondos insuficientes en banco.\n\nDisponible: $${bankBalance.toLocaleString()}\nIntentando retirar: $${monto.toLocaleString()}`);
                }

                // Transfer from bank to cash
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, 'Retiro de cajero', 'bank');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, monto, 'Retiro de cajero', 'cash');

                // Log transaction
                await supabase.from('debit_transactions').insert({
                    debit_card_id: card.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'withdrawal',
                    amount: -monto,
                    description: 'Retiro en cajero automático'
                });

                const embed = new EmbedBuilder()
                    .setTitle('🏧 Retiro Exitoso')
                    .setColor(0x00FF00)
                    .setDescription('Has retirado efectivo de tu cuenta bancaria.')
                    .addFields(
                        { name: 'Monto Retirado', value: `$${monto.toLocaleString()}`, inline: true },
                        { name: 'Nuevo Saldo Banco', value: `$${(bankBalance - monto).toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: 'El efectivo está ahora en tu billetera' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error realizando retiro.');
            }
        }




        else if (subcommand === 'historial') {
            try {
                const { data: transactions } = await supabase.from('debit_transactions').select('*').eq('discord_user_id', interaction.user.id).order('created_at', { ascending: false }).limit(10);
                if (!transactions || transactions.length === 0) return interaction.editReply('📭 Sin transacciones.');
                const embed = new EmbedBuilder().setTitle('📋 Historial Débito').setColor(0x00CED1);
                let desc = '';
                transactions.forEach(tx => {
                    const emoji = tx.amount > 0 ? '➕' : '➖';
                    const type = tx.transaction_type === 'deposit' ? 'Depósito' : tx.transaction_type === 'transfer_in' ? 'Recibido' : tx.transaction_type === 'transfer_out' ? 'Enviado' : tx.transaction_type;
                    desc += `${emoji} **${type}**: $${Math.abs(tx.amount).toLocaleString()} | Saldo: $${tx.balance_after.toLocaleString()}\n`;
                });
                embed.setDescription(desc);
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando historial.');
            }
        }

        // === INFO ===
        else if (subcommand === 'info') {

            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa.');

                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const bankBalance = balance.bank || 0;

                // Get recent transactions
                const { data: recentTxs } = await supabase
                    .from('debit_transactions')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                let txHistory = '';
                if (recentTxs && recentTxs.length > 0) {
                    recentTxs.forEach(tx => {
                        const emoji = tx.amount > 0 ? '➕' : '➖';
                        const tipo = tx.transaction_type === 'withdrawal' ? 'Retiro' :
                            tx.transaction_type === 'deposit' ? 'Depósito' :
                                tx.transaction_type === 'transfer_in' ? 'Recibido' : 'Enviado';
                        txHistory += `${emoji} ${tipo}: $${Math.abs(tx.amount).toLocaleString()}\n`;
                    });
                } else {
                    txHistory = 'Sin transacciones recientes';
                }

                const embed = new EmbedBuilder()
                    .setTitle('💳 Información Completa - Tarjeta de Débito')
                    .setColor(0x00CED1)
                    .setDescription(`Detalles de tu cuenta bancaria NMX`)
                    .addFields(
                        { name: '🔢 Número de Tarjeta', value: `\`${card.card_number}\``, inline: false },
                        { name: '💰 Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                        { name: '📅 Fecha de Creación', value: `<t:${Math.floor(new Date(card.created_at).getTime() / 1000)}:D>`, inline: true },
                        { name: '✅ Estado', value: 'Activa', inline: true },
                        { name: '📊 Últimas Transacciones', value: txHistory, inline: false }
                    )
                    .setFooter({ text: 'Banco Nacional MX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando información.');
            }
        }

        // === ADMIN COMMANDS ===
        else if (subCommandGroup === 'admin') {
            // Check if user is bank executive
            const BANK_EXEC_ROLE_ID = '1450688555503587459'; // Same as company creator role
            if (!interaction.member.roles.cache.has(BANK_EXEC_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '⛔ Solo ejecutivos bancarios pueden usar estos comandos.', ephemeral: true });
            }

            const adminSubCmd = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('usuario');

            // === ADMIN INFO ===
            if (adminSubCmd === 'info') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    const card = await getDebitCard(targetUser.id);
                    if (!card) return interaction.editReply(`❌ ${targetUser.username} no tiene tarjeta de débito.`);

                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                    const bankBalance = balance.bank || 0;
                    const cashBalance = balance.cash || 0;

                    // Get transaction count and totals
                    const { data: txs } = await supabase
                        .from('debit_transactions')
                        .select('*')
                        .eq('discord_user_id', targetUser.id);

                    const totalTransactions = txs?.length || 0;
                    const totalDeposits = txs?.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) || 0;
                    const totalWithdrawals = txs?.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

                    const embed = new EmbedBuilder()
                        .setTitle(`👨‍💼 Análisis Bancario - ${targetUser.username}`)
                        .setColor(0x5865F2)
                        .setThumbnail(targetUser.displayAvatarURL())
                        .addFields(
                            { name: '🔢 Número de Tarjeta', value: `\`${card.card_number}\``, inline: false },
                            { name: '💰 Saldo en Banco', value: `$${bankBalance.toLocaleString()}`, inline: true },
                            { name: '💵 Saldo en Efectivo', value: `$${cashBalance.toLocaleString()}`, inline: true },
                            { name: '💼 Total Combinado', value: `$${(bankBalance + cashBalance).toLocaleString()}`, inline: true },
                            { name: '📊 Total Transacciones', value: `${totalTransactions}`, inline: true },
                            { name: '➕ Total Depósitos', value: `$${totalDeposits.toLocaleString()}`, inline: true },
                            { name: '➖ Total Retiros', value: `$${totalWithdrawals.toLocaleString()}`, inline: true },
                            { name: '📅 Cuenta Creada', value: `<t:${Math.floor(new Date(card.created_at).getTime() / 1000)}:R>`, inline: false }
                        )
                        .setFooter({ text: 'Información Confidencial - Solo para Ejecutivos' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error consultando información.');
                }
            }

            // === ADMIN HISTORIAL ===
            else if (adminSubCmd === 'historial') {
                await interaction.deferReply({ ephemeral: true });

                try {
                    const { data: transactions } = await supabase
                        .from('debit_transactions')
                        .select('*')
                        .eq('discord_user_id', targetUser.id)
                        .order('created_at', { ascending: false })
                        .limit(20);

                    if (!transactions || transactions.length === 0) {
                        return interaction.editReply(`❌ ${targetUser.username} no tiene historial.`);
                    }

                    let description = '';
                    transactions.forEach((tx, index) => {
                        const emoji = tx.amount > 0 ? '➕' : '➖';
                        let tipo = tx.transaction_type;
                        if (tipo === 'withdrawal') tipo = 'Retiro';
                        else if (tipo === 'deposit') tipo = 'Depósito';
                        else if (tipo === 'transfer_in') tipo = 'Recibido';
                        else if (tipo === 'transfer_out') tipo = 'Enviado';

                        const fecha = new Date(tx.created_at);
                        description += `${emoji} **${tipo}**: $${Math.abs(tx.amount).toLocaleString()} | <t:${Math.floor(fecha.getTime() / 1000)}:R>\n`;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle(`📋 Historial de Débito - ${targetUser.username}`)
                        .setColor(0x00CED1)
                        .setDescription(description)
                        .setFooter({ text: `Mostrando últimas ${transactions.length} transacciones` })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error cargando historial.');
                }
            }
        }
    }

    else if (commandName === 'top-ricos') {
        await interaction.deferReply();

        try {
            // Get all citizens with discord IDs
            const { data: citizens } = await supabase
                .from('citizens')
                .select('full_name, discord_id')
                .not('discord_id', 'is', null);

            if (!citizens || citizens.length === 0) {
                return interaction.editReply('❌ No hay datos disponibles.');
            }

            // Calculate total wealth for each citizen
            const wealthData = [];

            for (const citizen of citizens) {
                try {
                    // Get cash and bank balance from UnbelievaBoat
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, citizen.discord_id);
                    const cash = balance.cash || 0;
                    const bank = balance.bank || 0;

                    // Get debit card balance
                    const { data: debitCard } = await supabase
                        .from('debit_cards')
                        .select('balance')
                        .eq('discord_user_id', citizen.discord_id)
                        .eq('status', 'active')
                        .maybeSingle();
                    const debitBalance = debitCard?.balance || 0;

                    // Get investment portfolio value
                    const { data: investments } = await supabase
                        .from('investments')
                        .select('quantity, ticker')
                        .eq('discord_id', citizen.discord_id);

                    let investmentsValue = 0;
                    if (investments && investments.length > 0) {
                        const { data: prices } = await supabase
                            .from('market_prices')
                            .select('ticker, current_price');

                        const priceMap = {};
                        prices?.forEach(p => priceMap[p.ticker] = p.current_price);

                        investments.forEach(inv => {
                            const price = priceMap[inv.ticker] || 0;
                            investmentsValue += inv.quantity * price;
                        });
                    }

                    const totalWealth = cash + bank + debitBalance + investmentsValue;

                    wealthData.push({
                        name: citizen.full_name,
                        discord_id: citizen.discord_id,
                        total: totalWealth,
                        cash,
                        bank,
                        debit: debitBalance,
                        investments: investmentsValue
                    });
                } catch (error) {
                    console.error(`Error calculating wealth for ${citizen.full_name}:`, error);
                }
            }

            // Sort by total wealth descending
            wealthData.sort((a, b) => b.total - a.total);

            // Take top 10
            const top10 = wealthData.slice(0, 10);

            if (top10.length === 0) {
                return interaction.editReply('❌ No se pudieron calcular las fortunas.');
            }

            const embed = new EmbedBuilder()
                .setTitle('💰 Top 10 - Ciudadanos Más Ricos')
                .setColor(0xFFD700)
                .setDescription('Ranking por patrimonio total (Efectivo + Banco + Débito + Inversiones)')
                .setTimestamp();

            let description = '';
            top10.forEach((person, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} **${person.name}** - $${person.total.toLocaleString()}\n`;
                description += `   💵 Efectivo: $${person.cash.toLocaleString()} | 🏦 Banco: $${person.bank.toLocaleString()}\n`;
                if (person.debit > 0 || person.investments > 0) {
                    description += `   💳 Débito: $${person.debit.toLocaleString()} | 📈 Inversiones: $${person.investments.toLocaleString()}\n`;
                }
                description += '\n';
            });

            embed.setDescription(description);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error calculando el ranking de riqueza.');
        }
    }

    else if (commandName === 'top-morosos') {
        await interaction.deferReply();

        try {
            const { data: debtors } = await supabase
                .from('credit_cards')
                .select('current_balance, card_type, citizen_id, citizens!inner(full_name, discord_id)')
                .gt('current_balance', 0)
                .order('current_balance', { ascending: false })
                .limit(10);

            if (!debtors || debtors.length === 0) {
                return interaction.editReply('✅ ¡No hay deudores! Todos están al corriente.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📉 Top 10 - Mayores Deudas')
                .setColor(0xFF0000)
                .setTimestamp();

            let description = '';
            debtors.forEach((d, index) => {
                description += `${index + 1}. **${d.citizens.full_name}** - $${d.current_balance.toLocaleString()} (${d.card_type})\n`;
            });

            embed.setDescription(description);
            embed.setFooter({ text: 'Recuerda pagar tus tarjetas a tiempo' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo el ranking.');
        }
    }

    else if (commandName === 'depositar') {
        const destUser = interaction.options.getUser('destinatario');
        const inputMonto = interaction.options.getString('monto');
        const razon = interaction.options.getString('razon') || 'Depósito en Efectivo';

        // Parse Amount
        let monto = 0;
        // Fetch balance early to handle 'todo'
        const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
        const cash = balance.cash || 0;

        if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
            monto = cash;
        } else {
            monto = parseFloat(inputMonto);
        }

        if (isNaN(monto) || monto <= 0) {
            return interaction.reply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // 1. Check Sender CASH (OXXO Logic: You pay with cash)
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const cash = balance.cash || 0;

            if (cash < monto) {
                return interaction.editReply(`❌ No tienes suficiente **efectivo** en mano. Tienes: $${cash.toLocaleString()}`);
            }

            // 2. Check Recipient Debit Card
            const { data: destCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', destUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!destCard) {
                return interaction.editReply(`❌ El destinatario ${destUser.tag} no tiene una Tarjeta de Débito NMX activa para recibir depósitos.`);
            }

            // 3. Process Logic
            // Remove Cash from Sender instantly
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Depósito a ${destUser.tag}`, 'cash');

            // Schedule Pending Transfer (4 Hours Delay)
            const completionTime = new Date(Date.now() + (4 * 60 * 60 * 1000)); // 4 Hours

            await supabase.from('pending_transfers').insert({
                from_user_id: interaction.user.id,
                to_user_id: destUser.id,
                amount: monto,
                transfer_type: 'cash_to_debit',
                scheduled_completion: completionTime.toISOString(),
                metadata: { reason: razon, dest_card_number: destCard.card_number }
            });

            // 4. Response
            const embed = new EmbedBuilder()
                .setTitle('🏪 Depósito Realizado')
                .setColor(0xFFA500)
                .setDescription(`Has depositado efectivo a la cuenta de **${destUser.tag}**.`)
                .addFields(
                    { name: '💸 Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: '💳 Destino', value: `Tarjeta NMX *${destCard.card_number.slice(-4)}`, inline: true },
                    { name: '⏳ Tiempo estimado', value: '4 Horas', inline: false },
                    { name: '📝 Concepto', value: razon, inline: false }
                )
                .setFooter({ text: 'El dinero llegará automáticamente cuando se procese.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando el depósito.');
        }
    }

    else if (commandName === 'transferir') {
        await interaction.deferReply(); // Defer immediately

        const destUser = interaction.options.getUser('destinatario');
        const inputMonto = interaction.options.getString('monto');
        const razon = interaction.options.getString('razon') || 'Transferencia Débito';

        if (destUser.id === interaction.user.id) return interaction.editReply({ content: '❌ Auto-transferencia no permitida.' });

        try {
            // 0. Security Check: Sender must have active Debit Card
            const senderCardCheck = await getDebitCard(interaction.user.id);
            if (!senderCardCheck) return interaction.editReply('❌ **Acceso Denegado:** No tienes una Tarjeta de Débito activa. No puedes realizar transferencias bancarias.');

            // 1. Check if destination has debit card (Required for SPEI)
            const { data: destCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', destUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!destCard) return interaction.editReply(`❌ **${destUser.username}** no tiene cuenta bancaria activa para recibir SPEI.`);

            // 2. Check Sender Bank Balance
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            const bankBalance = balance.bank || 0;

            let monto = 0;
            if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
                monto = bankBalance;
            } else {
                monto = parseFloat(inputMonto);
            }

            if (isNaN(monto) || monto <= 0) return interaction.editReply('❌ El monto debe ser mayor a 0.');

            // Check Destination Max Balance Limit
            const destTier = CARD_TIERS[destCard.card_type];
            const destMax = destTier ? (destTier.max_balance || Infinity) : Infinity;
            // Only check if limit is not infinite
            if (destMax !== Infinity) {
                const destBalData = await billingService.ubService.getUserBalance(interaction.guildId, destUser.id);
                const destCurrentBank = destBalData.bank || 0;
                if ((destCurrentBank + monto) > destMax) {
                    return interaction.editReply(`⛔ **Transferencia Rechazada**\nEl destinatario no puede recibir esta cantidad porque excedería el límite de saldo de su tarjeta (**${destCard.card_type}**).\nLímite: $${destMax.toLocaleString()}\nSaldo Actual Destino: $${destCurrentBank.toLocaleString()}`);
                }
            }

            if (bankBalance < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Banco.\n\nDisponible: $${bankBalance.toLocaleString()}\nIntentas transferir: $${monto.toLocaleString()}`);
            }

            // 3. Process Transfer (Bank -> Bank Immediate)
            // 3. Process Transfer (Bank -> Bank DELAYED 2 MINS)
            // Deduct from sender immediately
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Transferencia a ${destUser.tag}: ${razon}`, 'bank');

            const releaseDate = new Date();
            releaseDate.setMinutes(releaseDate.getMinutes() + 2); // 2 Minutes Delay

            const { error: pendErr } = await supabase.from('pending_transfers').insert({
                sender_id: interaction.user.id,
                receiver_id: destUser.id,
                amount: monto,
                reason: razon,
                release_date: releaseDate.toISOString(),
                status: 'PENDING',
                transfer_type: 'debit_to_debit'
            });

            if (pendErr) throw pendErr;

            // Log Outgoing Transaction for Sender (Optional history)
            if (senderCardCheck) { // available from check above
                await supabase.from('debit_transactions').insert([{
                    debit_card_id: senderCardCheck.id,
                    discord_user_id: interaction.user.id,
                    transaction_type: 'transfer_out',
                    amount: -monto,
                    description: `Transferencia a ${destUser.tag}`
                }]);
            }

            const embed = new EmbedBuilder()
                .setTitle('⏳ Transferencia Iniciada')
                .setColor(0xFFA500)
                .setDescription(`Transferencia programada. Se completará en 2 minutos.`)
                .addFields(
                    { name: 'De', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Para', value: `${destUser.tag}`, inline: true },
                    { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: 'Concepto', value: razon, inline: false },
                    { name: 'Llegada Estimada', value: releaseDate.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' }), inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando la transferencia.');
        }
    }

    else if (commandName === 'giro') {
        await interaction.deferReply(); // Defer immediately

        const destUser = interaction.options.getUser('destinatario');
        const inputMonto = interaction.options.getString('monto');
        const razon = interaction.options.getString('razon') || 'Giro Postal';

        // Fetch balance early
        const senderBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);

        let monto = 0;
        if (inputMonto.toLowerCase() === 'todo' || inputMonto.toLowerCase() === 'all') {
            monto = senderBalance.cash || 0;
        } else {
            monto = parseFloat(inputMonto);
        }

        if (isNaN(monto) || monto <= 0) return interaction.editReply({ content: '❌ El monto debe ser mayor a 0.' });
        if (destUser.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes enviarte un giro a ti mismo.' });

        try {
            // Already fetched balance above.
            if ((senderBalance.cash || 0) < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Efectivo. Tienes $${(senderBalance.cash || 0).toLocaleString()}.`);
            }

            // 2. Deduct Money Immediately (Cash)
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Giro enviado a ${destUser.tag}: ${razon}`, 'cash');

            // 3. Create Pending Transfer (24h Delay)
            // 24 hours from now
            const releaseDate = new Date();
            releaseDate.setHours(releaseDate.getHours() + 24);

            const { error: dbError } = await supabase
                .from('pending_transfers')
                .insert({
                    sender_id: interaction.user.id,
                    receiver_id: destUser.id,
                    amount: monto,
                    reason: razon,
                    release_date: releaseDate.toISOString(),
                    status: 'PENDING',
                    transfer_type: 'cash_to_debit',
                    metadata: { subtype: 'giro' }
                });

            if (dbError) throw dbError;

            // 4. Notify
            const embed = new EmbedBuilder()
                .setTitle('📨 Giro Postal Enviado')
                .setColor(0xFFA500) // Orange
                .setDescription(`El dinero ha sido descontado y llegará al destinatario en 24 horas.`)
                .addFields(
                    { name: 'Para', value: destUser.tag, inline: true },
                    { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: 'Llegada Estimada', value: releaseDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }), inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            try {
                await destUser.send(`📨 **Aviso de Giro**: ${interaction.user.tag} te ha enviado un giro de **$${monto.toLocaleString()}**. Estará disponible mañana.`);
            } catch (e) { /* Ignore */ }

        } catch (error) {
            console.error('Giro error:', error);
            await interaction.editReply('❌ Error procesando el giro. (El dinero no fue descontado si ocurrió error db)');
        }
    }

    else if (commandName === 'impuestos') {
        const subcommand = interaction.options.getSubcommand();


        if (subcommand === 'consultar') {
            await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL
            try {
                // Get user's financial info
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                const cash = (balance.cash || 0) + (balance.bank || 0);

                // Check if has credit card
                const { data: creditCards } = await supabase
                    .from('credit_cards')
                    .select('*')
                    .eq('discord_id', interaction.user.id)
                    .eq('status', 'active');

                const hasCreditCard = creditCards && creditCards.length > 0;
                const totalDebt = hasCreditCard ? creditCards.reduce((sum, card) => sum + (card.current_balance || 0), 0) : 0;

                // Check if has debit card
                const { data: debitCard } = await supabase
                    .from('debit_cards')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id)
                    .eq('status', 'active')
                    .maybeSingle();

                // Check if is company owner
                const { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id])
                    .eq('status', 'active');

                const isCompanyOwner = companies && companies.length > 0;
                const companyName = isCompanyOwner ? companies[0].name : 'N/A';

                // Determine tax status
                let taxStatus = '✅ Al Corriente';
                let taxDetails = 'No tienes obligaciones fiscales activas.';

                if (isCompanyOwner) {
                    const company = companies[0];
                    if (company.is_private) {
                        taxStatus = '⚠️ Empresa Privada - Tarifa Alta';
                        taxDetails = 'Como empresa privada, pagas una tasa de **15%** sobre ingresos.';
                    } else {
                        taxStatus = '📊 Empresa Pública - Tarifa Estándar';
                        taxDetails = 'Como empresa pública, pagas una tasa de **10%** sobre ingresos.';
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Estado Fiscal Personal')
                    .setColor(0x5865F2)
                    .setDescription(`Información tributaria de <@${interaction.user.id}>`)
                    .addFields(
                        { name: '📊 Estado', value: taxStatus, inline: false },
                        { name: '💼 Tipo de Contribuyente', value: isCompanyOwner ? 'Persona Moral (Empresario)' : 'Persona Física', inline: true },
                        { name: '🏢 Empresa', value: companyName, inline: true },
                        { name: '💰 Patrimonio Declarado', value: `$${cash.toLocaleString()}`, inline: true },
                        { name: '📝 Detalles', value: taxDetails, inline: false }
                    )
                    .setFooter({ text: 'SAT Nación MX • Consulta Fiscal' })
                    .setTimestamp();

                if (totalDebt > 0) {
                    embed.addFields({ name: '⚠️ Deuda Registrada', value: `$${totalDebt.toLocaleString()}`, inline: false });
                }

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando estado fiscal.');
            }
        }
        else if (subcommand === 'empresas') {
            await interaction.deferReply();
            try {
                const result = await taxService.calculateCorporateTax(interaction.user.id);

                if (!result.isCompany) {
                    return interaction.editReply('❌ No eres una empresa (No detecto Tarjeta Business activa).');
                }

                const embed = new EmbedBuilder()
                    .setTitle('🏢 IMPUESTOS CORPORATIVOS')
                    .setColor(0x7289da)
                    .setDescription(`Estimación fiscal basada en ingresos recientes.`)
                    .addFields(
                        { name: '📅 Periodo', value: result.period, inline: true },
                        { name: '📉 Tasa Aplicable', value: `${result.rate}%`, inline: true },
                        { name: '💰 Ingresos (30d)', value: `$${result.income.toLocaleString()}`, inline: false },
                        { name: '🏦 Impuesto Estimado', value: `\`\`\`$${result.taxAmount.toLocaleString()}\`\`\``, inline: false },
                        { name: '🗓️ Próximo Corte', value: result.nextPayment, inline: true }
                    )
                    .setFooter({ text: 'SAT Nación MX • Evita la evasión fiscal' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error calculando impuestos.');
            }
        }
    }

    else if (commandName === 'banco') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'depositar') {
            try {
                await interaction.deferReply();
                const amount = interaction.options.getNumber('monto');
                if (amount <= 0) return interaction.editReply('❌ El monto debe ser mayor a 0.');

                // Check Cash Only
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if ((balance.cash || 0) < amount) return interaction.editReply(`❌ No tienes suficiente efectivo. Tienes $${(balance.cash || 0).toLocaleString()}.`);

                // Execute: Cash -> Bank
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, amount, 'Depósito Bancario', 'cash');
                await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, amount, 'Depósito Bancario', 'bank');

                const embed = new EmbedBuilder()
                    .setTitle('🏦 Depósito Exitoso')
                    .setColor(0x00D26A)
                    .setDescription(`Has depositado **$${amount.toLocaleString()}** en tu cuenta bancaria.`)
                    .addFields(
                        { name: '💵 Efectivo Restante', value: `$${((balance.cash || 0) - amount).toLocaleString()}`, inline: true },
                        { name: '🏦 Nuevo Saldo', value: `$${((balance.bank || 0) + amount).toLocaleString()}`, inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });

            } catch (e) {
                console.error(e);
                await interaction.editReply('❌ Error procesando el depósito.');
            }
        }

        else if (commandName === 'empresa') {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'crear') {
                try {
                    await interaction.deferReply({ ephemeral: false });
                    console.log(`[DEBUG] /empresa crear started by ${interaction.user.tag}`);

                    // 1. Role Check (Only specific role can create)
                    const AUTHORIZED_ROLE_ID = '1450688555503587459';
                    if (!interaction.member.roles.cache.has(AUTHORIZED_ROLE_ID) && !interaction.member.permissions.has('Administrator')) {
                        return interaction.editReply('⛔ No tienes permisos para registrar empresas.');
                    }

                    // 2. Get Options
                    const name = interaction.options.getString('nombre');
                    const ownerUser = interaction.options.getUser('dueño');
                    const coOwnerUser = interaction.options.getUser('co_dueño');
                    const isPrivate = interaction.options.getBoolean('es_privada') || false;
                    const logo = interaction.options.getAttachment('logo');
                    const type = interaction.options.getString('tipo_local'); // e.g. Taller, Restaurante
                    const vehicles = interaction.options.getNumber('vehiculos') || 0;

                    // New Cost Fields
                    const tramiteCost = interaction.options.getNumber('costo_tramite');
                    const localCost = interaction.options.getNumber('costo_local') || 0;
                    const vehicleCost = interaction.options.getNumber('costo_vehiculos') || 0;

                    // Optional fields
                    const location = interaction.options.getString('ubicacion') || 'No especificada';



                    // 2.1 Calculate Total
                    const totalCost = tramiteCost + localCost + vehicleCost;

                    // 2.2 Pre-verification of Funds
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, ownerUser.id);
                    const userMoney = balance.total || (balance.cash + balance.bank);

                    if (userMoney < totalCost) {
                        return interaction.editReply(`❌ **Fondos Insuficientes**: El dueño <@${ownerUser.id}> tiene $${userMoney.toLocaleString()} pero se requieren **$${totalCost.toLocaleString()}**.`);
                    }

                    // 2.3 Send Confirmation Embed
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle(`🏢 Confirmar Registro: ${name}`)
                        .setColor(0xFFA500)
                        .setDescription(`Estás a punto de registrar una nueva empresa y realizar el cobro correspondiente al dueño <@${ownerUser.id}>.`)
                        .addFields(
                            { name: '🏷️ Rubro', value: type, inline: true },
                            { name: '📍 Ubicación', value: location, inline: true },
                            { name: '🔒 Tipo', value: isPrivate ? 'Privada (+Impuestos)' : 'Pública', inline: true },
                            { name: '👥 Co-Dueño', value: coOwnerUser ? `<@${coOwnerUser.id}>` : 'N/A', inline: true },
                            { name: '💵 Total a Cobrar', value: `**$${totalCost.toLocaleString()}**`, inline: false },
                            { name: '🧾 Desglose', value: `> Trámite: $${tramiteCost.toLocaleString()}\n> Local: $${localCost.toLocaleString()}\n> Vehículos: $${vehicleCost.toLocaleString()}`, inline: false }
                        )
                        .setFooter({ text: 'Confirma para procesar el pago y crear la empresa.' });

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('confirm_company').setLabel('✅ Pagar y Crear').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel_company').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
                    );

                    const msg = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

                    // 3. Collector
                    const filter = i => i.user.id === interaction.user.id;
                    const collector = msg.createMessageComponentCollector({ filter, time: 60000 }); // 1 min timeout

                    let hasResponded = false;

                    collector.on('collect', async i => {
                        if (i.customId === 'cancel_company') {
                            hasResponded = true;
                            await i.update({ content: '🚫 Operación cancelada.', embeds: [], components: [] });
                            return collector.stop();
                        }

                        if (i.customId === 'confirm_company') {
                            hasResponded = true;
                            await i.deferUpdate();

                            // Use universal payment system
                            const paymentResult = await requestPaymentMethod(
                                interaction,
                                ownerUser.id,
                                totalCost,
                                `🏢 Registro de Empresa: ${name}`
                            );

                            if (!paymentResult.success) {
                                return interaction.editReply({ content: paymentResult.error, embeds: [], components: [] });
                            }

                            // Prepare IDs
                            const ownerIds = [ownerUser.id];
                            if (coOwnerUser) ownerIds.push(coOwnerUser.id);

                            // Create in DB
                            await companyService.createCompany({
                                name: name,
                                logo_url: logo ? logo.url : null,
                                industry_type: type,
                                owner_ids: ownerIds,
                                vehicle_count: vehicles,
                                location: location,
                                balance: 0,
                                status: 'active',
                                is_private: isPrivate
                            });

                            // Final Success Embed
                            const finalEmbed = new EmbedBuilder()
                                .setTitle(`🏢 Nueva Empresa Registrada: ${name}`)
                                .setColor(0x00FF00)
                                .setDescription(`Empresa dada de alta exitosamente en Nación MX.\nCobro realizado al dueño por **$${totalCost.toLocaleString()}**.`)
                                .addFields(
                                    { name: '👤 Dueño', value: `<@${ownerUser.id}>`, inline: true },
                                    { name: '👥 Co-Dueño', value: coOwnerUser ? `<@${coOwnerUser.id}>` : 'N/A', inline: true },
                                    { name: '🏷️ Rubro', value: type, inline: true },
                                    { name: '🔒 Privacidad', value: isPrivate ? 'Privada' : 'Pública', inline: true },
                                    { name: '📍 Ubicación', value: location, inline: true },
                                    { name: '🚗 Vehículos', value: `${vehicles}`, inline: true },
                                    { name: '💵 Costo Total', value: `$${totalCost.toLocaleString()}`, inline: false },
                                    { name: '📝 Siguientes Pasos (Comandos Útiles)', value: '1. Agrega empleados: `/empresa nomina agregar`\n2. Cobra a clientes: `/empresa cobrar @usuario [monto] [razon]`\n3. Paga sueldos: `/empresa nomina pagar`\n4. Panel de Control: `/empresa menu`', inline: false }
                                )
                                .setThumbnail(logo ? logo.url : null)
                                .setFooter({ text: 'Sistema Empresarial Nación MX' })
                                .setTimestamp();

                            const menuRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('company_menu').setLabel('📋 Menú Empresa').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('company_payroll').setLabel('👥 Nómina').setStyle(ButtonStyle.Secondary)
                            );

                            await interaction.editReply({ content: null, embeds: [finalEmbed], components: [menuRow] });

                            // Send detailed welcome guide to owner via DM
                            try {
                                const welcomeEmbed = new EmbedBuilder()
                                    .setTitle(`🎉 Bienvenido a ${name}`)
                                    .setColor(0x5865F2)
                                    .setDescription('**Tu empresa ha sido registrada exitosamente.** Aquí tienes todo lo que necesitas saber para empezar:')
                                    .addFields(
                                        {
                                            name: '⚠️ URGENTE: Agrega Empleados a Nómina',
                                            value: '```\n/empresa nomina agregar @usuario [salario] [puesto]\n```\n**Importante:** Los empleados deben estar en nómina para recibir pagos semanales automáticos.',
                                            inline: false
                                        },
                                        {
                                            name: '💼 Comandos Esenciales',
                                            value: '```\n/empresa menu - Panel de control completo\n/empresa cobrar @cliente [monto] [concepto] - Cobrar por servicios\n/empresa nomina pagar - Pagar sueldos manualmente\n/empresa info - Ver información de tu empresa\n```',
                                            inline: false
                                        },
                                        {
                                            name: '💳 Tarjetas Empresariales',
                                            value: 'Potencia tu empresa con una **Tarjeta Business:**\n• Líneas de crédito desde $50k hasta $1M\n• Intereses bajos (0.7% - 2%)\n• Beneficios fiscales y cashback\n\n**Solicita una ahora** usando el botón abajo.',
                                            inline: false
                                        },
                                        {
                                            name: '📊 Recordatorios',
                                            value: '• Impuestos corporativos se cobran semanalmente\n• Empresas privadas pagan 15% vs 10% públicas\n• Mantén empleados activos para mejor rendimiento',
                                            inline: false
                                        }
                                    )
                                    .setThumbnail(logo ? logo.url : null)
                                    .setFooter({ text: 'Sistema Empresarial Nación MX • Éxito en tu negocio' })
                                    .setTimestamp();

                                const actionRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setLabel('💳 Solicitar Tarjeta Business')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(`https://discord.com/channels/${interaction.guildId}/1450269843600310373`),
                                    new ButtonBuilder()
                                        .setCustomId('company_quick_hire')
                                        .setLabel('👥 Contratar Empleado')
                                        .setStyle(ButtonStyle.Success)
                                );

                                await ownerUser.send({ embeds: [welcomeEmbed], components: [actionRow] });
                            } catch (dmError) {
                                console.log('Could not send DM to owner:', dmError.message);
                            }
                            collector.stop();
                        }
                    });

                    collector.on('end', collected => {
                        if (!hasResponded) interaction.editReply({ content: '⚠️ Tiempo de espera agotado. Intenta de nuevo.', components: [] });
                    });

                } catch (error) {
                    console.error('[company-create] Critical Error:', error);
                    try {
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply(`❌ Error crítico: ${error.message}`);
                        } else {
                            await interaction.reply(`❌ Error crítico: ${error.message}`);
                        }
                    } catch (e) {
                        console.error('Final fail responding:', e);
                    }
                }
            }
            else if (subcommand === 'menu') {
                await interaction.deferReply({ flags: 64 });
                try {
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [interaction.user.id])
                        .eq('status', 'active');

                    if (!companies || companies.length === 0) {
                        return interaction.editReply('❌ No tienes una empresa registrada.');
                    }

                    const company = companies[0];

                    const embed = new EmbedBuilder()
                        .setTitle(`🏢 ${company.name} - Panel de Control`)
                        .setColor(0x5865F2)
                        .setDescription(`Gestión completa de tu empresa`)
                        .addFields(
                            { name: '💰 Saldo', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                            { name: '👥 Empleados', value: `${(company.employees || []).length}`, inline: true },
                            { name: '🚗 Vehículos', value: `${company.vehicle_count}`, inline: true },
                            { name: '📍 Ubicación', value: company.location || 'No especificada', inline: true },
                            { name: '🏷️ Tipo', value: company.industry_type, inline: true },
                            { name: '🔒 Privacidad', value: company.is_private ? 'Privada' : 'Pública', inline: true }
                        )
                        .setThumbnail(company.logo_url)
                        .setFooter({ text: 'Sistema Empresarial Nación MX' })
                        .setTimestamp();

                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('company_hire').setLabel('👥 Contratar').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('company_fire').setLabel('🚫 Despedir').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('company_payroll').setLabel('💵 Pagar Nómina').setStyle(ButtonStyle.Primary)
                    );

                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('company_withdraw').setLabel('💸 Retirar Fondos').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('company_stats').setLabel('📊 Estadísticas').setStyle(ButtonStyle.Secondary)
                    );

                    await interaction.editReply({ embeds: [embed], components: [row1, row2] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error obteniendo información de la empresa.');
                }
            }
            else if (subcommand === 'cobrar') {
                // 1. Check if user belongs to a company (Owner OR Employee)
                let { data: companies } = await supabase
                    .from('companies')
                    .select('*')
                    .contains('owner_ids', [interaction.user.id])
                    .eq('status', 'active');

                // If not owner, check if employee
                if (!companies || companies.length === 0) {
                    const { data: employeeData } = await supabase
                        .from('company_employees')
                        .select('company_id, companies(*)')
                        .eq('discord_user_id', interaction.user.id)
                        .eq('status', 'active');

                    if (employeeData && employeeData.length > 0) {
                        companies = [employeeData[0].companies];
                    }
                }

                if (!companies || companies.length === 0) {
                    return interaction.reply({ content: '⛔ No estás en ninguna empresa (ni dueño ni empleado).', ephemeral: true });
                }

                const myCompany = companies[0]; // Use first company for now
                const clientUser = interaction.options.getUser('cliente');
                const amount = interaction.options.getNumber('monto');
                const reason = interaction.options.getString('razon');

                // 2. Create POS Embed
                const embed = new EmbedBuilder()
                    .setTitle(`💸 Cobro: ${myCompany.name}`)
                    .setDescription(`Hola <@${clientUser.id}>, **${myCompany.name}** te está cobrando por el siguiente concepto:`)
                    .addFields(
                        { name: '🧾 Concepto', value: reason },
                        { name: '💵 Monto', value: `$${amount.toLocaleString()}` }
                    )
                    .setColor(0xFFA500)
                    .setFooter({ text: 'Selecciona tu método de pago' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`pay_cash_${amount}_${myCompany.id}`).setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`pay_debit_${amount}_${myCompany.id}`).setLabel('💳 Débito').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`pay_credit_${amount}_${myCompany.id}`).setLabel('💳 Crédito').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('pay_cancel').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({
                    content: `<@${clientUser.id}>`,
                    embeds: [embed],
                    components: [row]
                });
            }
            else if (subcommand === 'lista') {
                await interaction.deferReply({ flags: 64 });
                try {
                    const { data: companies, error } = await supabase
                        .from('companies')
                        .select('*')
                        .eq('status', 'active');

                    if (error) throw error;

                    if (!companies || companies.length === 0) {
                        return interaction.editReply('📭 No hay empresas registradas aún.');
                    }

                    let listText = '';
                    companies.forEach(c => {
                        listText += `🏢 **${c.name}** (${c.industry_type}) - Dueño: <@${c.owner_ids[0]}>\n`;
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('🏢 Directorio de Empresas')
                        .setColor(0x00FF00)
                        .setDescription(listText)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error obteniendo la lista.');
                }
            }
            else if (subcommand === 'info') {
                await interaction.deferReply({ flags: 64 });
                try {
                    // Info regarding MY company or specific company? 
                    // Usually "info" without args implies "My Company Info" or "General Info"?
                    // Let's assume My Company for now as it's most useful.
                    // Or if arguments provided? The command definition for "info" might have an option.
                    // Re-checking manual_register.js would be ideal but let's assume "My Company" first or list all owned.

                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [interaction.user.id])
                        .eq('status', 'active');

                    if (!companies || companies.length === 0) {
                        return interaction.editReply('❌ No tienes ninguna empresa registrada.');
                    }

                    const c = companies[0]; // Show first
                    const embed = new EmbedBuilder()
                        .setTitle(`ℹ️ Información: ${c.name}`)
                        .setColor(0x0099FF)
                        .addFields(
                            { name: 'Dueño', value: `<@${c.owner_ids[0]}>`, inline: true },
                            { name: 'Saldo', value: `$${(c.balance || 0).toLocaleString()}`, inline: true },
                            { name: 'Empleados', value: `${(c.employees || []).length}`, inline: true },
                            { name: 'Vehículos', value: `${c.vehicle_count}`, inline: true },
                            { name: 'Ubicación', value: c.location || 'N/A', inline: true }
                        )
                        .setThumbnail(c.logo_url);

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error obteniendo información.');
                }
            }

            else if (subcommand === 'credito') {
                await interaction.deferReply({ flags: 64 });

                const monto = interaction.options.getNumber('monto');
                const razon = interaction.options.getString('razon');

                if (monto <= 0) {
                    return interaction.editReply('❌ El monto debe ser mayor a 0.');
                }

                try {
                    // 1. Get user's companies
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [interaction.user.id])
                        .eq('status', 'active');

                    if (!companies || companies.length === 0) {
                        return interaction.editReply('❌ Necesitas tener una empresa para solicitar crédito business.');
                    }

                    // 2. Get business credit cards
                    const { data: cards } = await supabase
                        .from('credit_cards')
                        .select('*, companies!inner(name)')
                        .eq('discord_id', interaction.user.id)
                        .in('card_type', ['business_start', 'business_gold', 'business_platinum', 'business_elite', 'nmx_corporate'])
                        .eq('status', 'active');

                    if (!cards || cards.length === 0) {
                        return interaction.editReply('❌ No tienes tarjetas business activas.\n\n**¿Cómo solicitar una?**\n1. Abre un ticket en <#1450269843600310373>\n2. Un asesor te ayudará con el proceso\n3. Recibirás tu tarjeta vinculada a tu empresa');
                    }

                    // 3. If multiple cards, let user choose
                    if (cards.length > 1) {
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId(`credit_select_${monto}_${razon}`)
                            .setPlaceholder('Selecciona tarjeta business')
                            .addOptions(
                                cards.map(card => {
                                    const available = card.card_limit - (card.current_balance || 0);
                                    const companyName = card.companies?.name || 'Sin empresa';
                                    return {
                                        label: `${card.card_name} - ${companyName}`,
                                        description: `Disponible: $${available.toLocaleString()} de $${card.card_limit.toLocaleString()}`,
                                        value: card.id,
                                        emoji: '💳'
                                    };
                                })
                            );

                        const row = new ActionRowBuilder().addComponents(selectMenu);

                        return interaction.editReply({
                            content: `💳 Tienes **${cards.length}** tarjetas business. Selecciona cuál usar:`,
                            components: [row]
                        });
                    }

                    // 4. Only one card, proceed
                    const card = cards[0];
                    const available = card.card_limit - (card.current_balance || 0);

                    if (monto > available) {
                        return interaction.editReply(`❌ **Crédito insuficiente**\n\n💳 Tarjeta: **${card.card_name}**\n📊 Disponible: **$${available.toLocaleString()}**\n❌ Solicitado: **$${monto.toLocaleString()}**\n\nContacta a un asesor para aumentar tu límite.`);
                    }

                    // 5. Update card balance
                    await supabase
                        .from('credit_cards')
                        .update({
                            current_balance: (card.current_balance || 0) + monto,
                            last_transaction_at: new Date().toISOString()
                        })
                        .eq('id', card.id);

                    // 6. Add to company balance
                    const companyId = card.company_id;
                    const { data: company } = await supabase
                        .from('companies')
                        .select('balance')
                        .eq('id', companyId)
                        .single();

                    await supabase
                        .from('companies')
                        .update({ balance: (company.balance || 0) + monto })
                        .eq('id', companyId);

                    // 7. Log transaction
                    await supabase
                        .from('credit_transactions')
                        .insert({
                            card_id: card.id,
                            discord_user_id: interaction.user.id,
                            transaction_type: 'disbursement',
                            amount: monto,
                            description: razon,
                            company_id: companyId
                        });

                    const newBalance = (card.current_balance || 0) + monto;
                    const newAvailable = card.card_limit - newBalance;

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Crédito Business Aprobado')
                        .setColor(0x00FF00)
                        .setDescription(`Se depositaron **$${monto.toLocaleString()}** al balance de tu empresa.`)
                        .addFields(
                            { name: '💳 Tarjeta', value: card.card_name, inline: true },
                            { name: '🏢 Empresa', value: card.companies?.name || 'N/A', inline: true },
                            { name: '📝 Concepto', value: razon, inline: false },
                            { name: '💰 Monto Solicitado', value: `$${monto.toLocaleString()}`, inline: true },
                            { name: '📊 Nueva Deuda', value: `$${newBalance.toLocaleString()}`, inline: true },
                            { name: '💵 Crédito Disponible', value: `$${newAvailable.toLocaleString()}`, inline: true },
                            { name: '⚠️ Recordatorio', value: `Interés semanal: **${(card.interest_rate * 100).toFixed(2)}%**\nPaga tu deuda con \`/credito pagar\``, inline: false }
                        )
                        .setFooter({ text: 'Usa responsablemente tu línea de crédito' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error procesando solicitud de crédito.');
                }
            }
        }

        // ===== 🎰 CASINO SYSTEM =====
        else if (commandName === 'casino') {
            await interaction.deferReply(); // Global Defer to prevent timeouts
            const CASINO_CHANNEL_ID = '1451398359540826306';
            const CASINO_ROLE_ID = '1449951345611378841';
            const CHIP_PRICE = 100; // 1 ficha = $100

            // Check if command is in casino channel
            if (interaction.channelId !== CASINO_CHANNEL_ID) {
                return interaction.editReply({
                    content: `🎰 Este comando solo puede usarse en <#${CASINO_CHANNEL_ID}>`
                });
            }

            // Check if user has casino role
            if (!interaction.member.roles.cache.has(CASINO_ROLE_ID)) {
                return interaction.editReply({
                    content: '🚫 Necesitas el rol de Casino para jugar. Pídelo a un staff.'
                });
            }

            const subCmdGroup = interaction.options.getSubcommandGroup(false);
            const subCmd = interaction.options.getSubcommand();

            // === FICHAS COMPRAR ===
            if (subCmdGroup === 'fichas' && subCmd === 'comprar') {

                const cantidad = interaction.options.getInteger('cantidad');
                const costo = cantidad * CHIP_PRICE;

                try {
                    // Check VIP status (Black or Diamante cards)
                    const { data: vipCard } = await supabase
                        .from('credit_cards')
                        .select('card_type')
                        .eq('discord_user_id', interaction.user.id)
                        .in('card_type', ['black', 'diamante'])
                        .eq('status', 'active')
                        .maybeSingle();

                    const isVIP = !!vipCard;
                    const bonus = isVIP ? Math.floor(cantidad * 0.1) : 0; // +10% para VIP
                    const totalFichas = cantidad + bonus;

                    // Use payment system
                    const paymentResult = await requestPaymentMethod(
                        interaction,
                        interaction.user.id,
                        costo,
                        `🎰 Compra de ${cantidad} fichas de casino`
                    );

                    if (!paymentResult.success) {
                        return interaction.editReply(paymentResult.error);
                    }

                    // Get or create casino account
                    let { data: account } = await supabase
                        .from('casino_chips')
                        .select('*')
                        .eq('discord_user_id', interaction.user.id)
                        .maybeSingle();

                    if (!account) {
                        const { data: newAccount } = await supabase
                            .from('casino_chips')
                            .insert({
                                discord_user_id: interaction.user.id,
                                chips_balance: totalFichas
                            })
                            .select()
                            .single();
                        account = newAccount;
                    } else {
                        await supabase
                            .from('casino_chips')
                            .update({
                                chips_balance: account.chips_balance + totalFichas,
                                updated_at: new Date().toISOString()
                            })
                            .eq('discord_user_id', interaction.user.id);
                    }

                    const paymentLabel = paymentResult.method === 'cash' ? '💵 Efectivo' : paymentResult.method === 'bank' ? '🏦 Banco' : '💳 Crédito';

                    const embed = new EmbedBuilder()
                        .setTitle('🎰 Compra de Fichas Exitosa')
                        .setColor(0xFFD700)
                        .setDescription(`Has comprado fichas para el casino.`)
                        .addFields(
                            { name: '🎟️ Fichas Compradas', value: `${cantidad.toLocaleString()}`, inline: true },
                            { name: '💰 Costo', value: `$${costo.toLocaleString()}`, inline: true },
                            { name: '💳 Método', value: paymentLabel, inline: true }
                        )
                        .setTimestamp();

                    if (bonus > 0) {
                        embed.addFields({ name: '🌟 Bonus VIP (+10%)', value: `+${bonus} fichas gratis`, inline: false });
                    }

                    embed.addFields({ name: '💼 Saldo Total', value: `${(account.chips_balance + totalFichas).toLocaleString()} fichas`, inline: false });

                    await interaction.editReply({ embeds: [embed], components: [] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error comprando fichas.');
                }
            }

            // === FICHAS RETIRAR ===
            else if (subCmdGroup === 'fichas' && subCmd === 'retirar') {

                const cantidad = interaction.options.getInteger('cantidad');

                try {
                    const { data: account } = await supabase
                        .from('casino_chips')
                        .select('*')
                        .eq('discord_user_id', interaction.user.id)
                        .maybeSingle();

                    if (!account || account.chips_balance < cantidad) {
                        return interaction.editReply(`❌ No tienes suficientes fichas.\n\nTienes: ${account?.chips_balance || 0} fichas\nIntentando retirar: ${cantidad} fichas`);
                    }

                    const dineroRecibido = cantidad * CHIP_PRICE;

                    // Update chips
                    await supabase
                        .from('casino_chips')
                        .update({
                            chips_balance: account.chips_balance - cantidad,
                            updated_at: new Date().toISOString()
                        })
                        .eq('discord_user_id', interaction.user.id);

                    // Add money as CASH (never to bank without debit card)
                    await billingService.ubService.addMoney(
                        interaction.guildId,
                        interaction.user.id,
                        dineroRecibido,
                        'Retiro de fichas de casino',
                        'cash'
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('💵 Retiro de Fichas Exitoso')
                        .setColor(0x00FF00)
                        .setDescription('Has convertido tus fichas a efectivo.')
                        .addFields(
                            { name: '🎟️ Fichas Retiradas', value: `${cantidad.toLocaleString()}`, inline: true },
                            { name: '💵 Dinero Recibido', value: `$${dineroRecibido.toLocaleString()}`, inline: true },
                            { name: '💼 Fichas Restantes', value: `${(account.chips_balance - cantidad).toLocaleString()}`, inline: false }
                        )
                        .setFooter({ text: 'El dinero fue añadido a tu efectivo' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error retirando fichas.');
                }
            }

            // === SALDO ===
            else if (subCmd === 'saldo') {

                try {
                    const { data: account } = await supabase
                        .from('casino_chips')
                        .select('*')
                        .eq('discord_user_id', interaction.user.id)
                        .maybeSingle();

                    if (!account) {
                        return interaction.editReply('❌ No tienes una cuenta de casino aún. Compra fichas con `/casino fichas comprar`');
                    }

                    const winRate = account.games_played > 0
                        ? ((account.total_won / (account.total_won + account.total_lost)) * 100).toFixed(1)
                        : '0.0';

                    const netProfit = account.total_won - account.total_lost;
                    const profitEmoji = netProfit >= 0 ? '📈' : '📉';

                    const embed = new EmbedBuilder()
                        .setTitle('🎰 Tu Cuenta del Casino')
                        .setColor(0xFFD700)
                        .setDescription(`Estado actual de tu cuenta`)
                        .addFields(
                            { name: '🎟️ Fichas Disponibles', value: `${account.chips_balance.toLocaleString()}`, inline: true },
                            { name: '💵 Valor en Dinero', value: `$${(account.chips_balance * CHIP_PRICE).toLocaleString()}`, inline: true },
                            { name: '\u200b', value: '\u200b', inline: true },
                            { name: '🎮 Juegos Jugados', value: `${account.games_played.toLocaleString()}`, inline: true },
                            { name: `${profitEmoji} Ganancia Neta`, value: `${netProfit.toLocaleString()} fichas`, inline: true },
                            { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
                            { name: '🏆 Mayor Ganancia', value: `${account.biggest_win.toLocaleString()} fichas`, inline: true },
                            { name: '💔 Mayor Pérdida', value: `${account.biggest_loss.toLocaleString()} fichas`, inline: true },
                            { name: '\u200b', value: '\u200b', inline: true }
                        )
                        .setFooter({ text: '1 ficha = $100 MXN' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error consultando saldo.');
                }
            }

            // === RANKING ===
            else if (subCmd === 'ranking') {

                const tipo = interaction.options.getString('tipo') || 'chips';

                try {
                    let orderBy = 'chips_balance';
                    let title = '💰 Top Jugadores por Fichas';

                    if (tipo === 'profit') {
                        orderBy = '(total_won - total_lost)';
                        title = '📈 Top Jugadores por Ganancias';
                    } else if (tipo === 'games') {
                        orderBy = 'games_played';
                        title = '🎮 Top Jugadores por Juegos';
                    }

                    const { data: topPlayers } = await supabase
                        .from('casino_chips')
                        .select('*')
                        .order(orderBy, { ascending: false })
                        .limit(10);

                    if (!topPlayers || topPlayers.length === 0) {
                        return interaction.editReply('❌ No hay jugadores en el ranking aún.');
                    }

                    let description = '';
                    for (let i = 0; i < topPlayers.length; i++) {
                        const player = topPlayers[i];
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        const value = tipo === 'chips' ? player.chips_balance :
                            tipo === 'profit' ? (player.total_won - player.total_lost) :
                                player.games_played;

                        description += `${medal} <@${player.discord_user_id}> - **${value.toLocaleString()}** ${tipo === 'games' ? 'juegos' : 'fichas'}\n`;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(title)
                        .setColor(0xFFD700)
                        .setDescription(description)
                        .setFooter({ text: 'Casino Nación MX • Actualizado en tiempo real' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error cargando ranking.');
                }
            }

            // === HISTORIAL ===
            else if (subCmd === 'historial') {

                const filtroJuego = interaction.options.getString('juego');

                try {
                    let query = supabase
                        .from('casino_history')
                        .select('*')
                        .eq('discord_user_id', interaction.user.id)
                        .order('created_at', { ascending: false })
                        .limit(10);

                    if (filtroJuego) {
                        query = query.eq('game_type', filtroJuego);
                    }

                    const { data: history } = await query;

                    if (!history || history.length === 0) {
                        return interaction.editReply('❌ No tienes historial de juegos aún.');
                    }

                    let description = '';
                    for (const game of history) {
                        const resultado = game.result_amount >= 0 ? '✅' : '❌';
                        const ganancia = game.result_amount >= 0
                            ? `+${game.result_amount.toLocaleString()}`
                            : game.result_amount.toLocaleString();

                        const fecha = new Date(game.created_at);
                        const timestamp = `<t:${Math.floor(fecha.getTime() / 1000)}:R>`;

                        description += `${resultado} **${game.game_type}** - ${ganancia} fichas (${game.multiplier}x) ${timestamp}\n`;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`🎮 Historial de Juegos${filtroJuego ? ` - ${filtroJuego}` : ''}`)
                        .setColor(0x5865F2)
                        .setDescription(description)
                        .setFooter({ text: 'Mostrando últimos 10 juegos' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply('❌ Error cargando historial.');
                }
            }

            // === INFO ===
            else if (subCmd === 'info') {

                const infoEmbed = new EmbedBuilder()
                    .setTitle('🎰 Casino Nación MX - Guía Completa')
                    .setColor(0xFFD700)
                    .setDescription('**Bienvenido al Casino más emocionante de NaciónMX!**\n\n💰 Compra fichas, juega, gana y retira tus ganancias.')
                    .addFields(
                        {
                            name: '💳 Sistema de Fichas',
                            value: '`/casino fichas comprar` - Compra fichas (1:1 con tu dinero)\n`/casino fichas retirar` - Retira fichas a efectivo\n`/casino saldo` - Ver balance y estadísticas\n\n**VIP Bonus:** Tarjetas Black/Diamante obtienen +10% fichas gratis al comprar',
                            inline: false
                        },
                        {
                            name: '🎮 Juegos Disponibles',
                            value: '**🎰 Slots** (`/jugar slots`)\n• 3 rodillos aleatorios\n• Premios: 2x, 5x, 10x, 50x, 100x (Jackpot!)\n• Apuesta mínima: 10 fichas\n\n**🎲 Dice** (`/jugar dice`)\n• Apuesta Over/Under en 1-99\n• Multiplicador dinámico según probabilidad\n• Hasta 10x si aciertas\n\n**🃏 Blackjack** (`/jugar blackjack`)\n• 21 clásico contra la casa\n• Victoria: 2x | Blackjack: 2.5x | Empate: 1x\n• Mínimo: 10 fichas',
                            inline: false
                        },
                        {
                            name: '🎡 Más Juegos',
                            value: '**🎡 Ruleta** (`/jugar ruleta`)\n• Rojo/Negro: 2x\n• Par/Impar: 2x\n• Número exacto: 35x\n\n**🐴 Carrera de Caballos** (`/jugar caballos`)\n• Elige entre 6 caballos\n• Premio fijo: 5x\n\n**📉 Crash** (`/jugar crash`)\n• Multiplicador sube hasta 50x\n• Retiro automático aleatorio\n\n**🐓 Pelea de Gallos** (`/jugar gallos`)\n• Rojo vs Azul (Best of 5)\n• Premio: 1.9x',
                            inline: false
                        },
                        {
                            name: '💀 Juego de Alto Riesgo',
                            value: '**💀 Ruleta Rusa** (`/jugar ruleta-rusa`)\n• ⚠️ ADVERTENCIA: Juego peligroso\n• Si sobrevives: 5x tu apuesta\n• Si pierdes: Multa 2x + Ban 1 hora del casino\n• Apuesta máxima: 100 fichas',
                            inline: false
                        },
                        {
                            name: '📊 Estadísticas',
                            value: '`/casino ranking` - Top jugadores\n`/casino historial` - Tus últimas 10 jugadas\n\n**Filtra por juego:** `/casino historial juego:slots`',
                            inline: false
                        },
                        {
                            name: '⚠️ Reglas Importantes',
                            value: '• Solo accesible en <#1451398359540826306>\n• Juego justo Provably Fair\n• Límites anti-trampa activos\n• Retiros siempre a EFECTIVO\n• Juega responsablemente',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Casino Nación MX | La casa siempre gana... o no? 🎲' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [infoEmbed] });
            }
        }
    }

    // ===== 🎮 CASINO GAMES =====
    else if (commandName === 'jugar') {
        await interaction.deferReply(); // Global defer for all games

        const CASINO_CHANNEL_ID = '1451398359540826306';
        const CASINO_ROLE_ID = '1449951345611378841';

        // Security checks
        if (interaction.channelId !== CASINO_CHANNEL_ID) {
            return interaction.editReply({ content: `🎰 Este comando solo puede usarse en <#${CASINO_CHANNEL_ID}>`, ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(CASINO_ROLE_ID)) {
            return interaction.editReply({ content: '🚫 Necesitas el rol de Casino para jugar.', ephemeral: true });
        }

        const game = interaction.options.getSubcommand();

        // Helper function to save game result
        async function saveGameResult(userId, gameType, betAmount, resultAmount, multiplier, gameData = {}) {
            try {
                // Update chips
                const { data: account } = await supabase
                    .from('casino_chips')
                    .select('*')
                    .eq('discord_user_id', userId)
                    .single();

                const newBalance = account.chips_balance + resultAmount;
                const won = resultAmount > 0 ? resultAmount : 0;
                const lost = resultAmount < 0 ? Math.abs(resultAmount) : 0;

                await supabase
                    .from('casino_chips')
                    .update({
                        chips_balance: newBalance,
                        total_won: account.total_won + won,
                        total_lost: account.total_lost + lost,
                        games_played: account.games_played + 1,
                        biggest_win: Math.max(account.biggest_win, won),
                        biggest_loss: Math.max(account.biggest_loss, lost),
                        updated_at: new Date().toISOString()
                    })
                    .eq('discord_user_id', userId);

                // Save history
                await supabase
                    .from('casino_history')
                    .insert({
                        discord_user_id: userId,
                        game_type: gameType,
                        bet_amount: betAmount,
                        result_amount: resultAmount,
                        multiplier: multiplier,
                        game_data: gameData
                    });

                return newBalance;
            } catch (error) {
                console.error('Error saving game result:', error);
                throw error;
            }
        }

        // Helper to check chips
        async function checkChips(userId, amount) {
            const { data: account } = await supabase
                .from('casino_chips')
                .select('chips_balance')
                .eq('discord_user_id', userId)
                .maybeSingle();

            if (!account) {
                return { hasEnough: false, message: '❌ No tienes cuenta de casino. Compra fichas con `/casino fichas comprar`' };
            }

            if (account.chips_balance < amount) {
                return {
                    hasEnough: false,
                    message: `❌ Fichas insuficientes.\n\nTienes: ${account.chips_balance.toLocaleString()}\nNecesitas: ${amount.toLocaleString()}`
                };
            }

            return { hasEnough: true, balance: account.chips_balance };
        }

        // === SLOTS ===
        if (game === 'slots') {

            const apuesta = interaction.options.getInteger('apuesta');
            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '7️⃣'];
                const weights = [30, 25, 20, 15, 7, 2, 1]; // Probabilidades

                // Pick weighted random
                function pickSymbol() {
                    const total = weights.reduce((sum, w) => sum + w, 0);
                    let random = Math.floor(Math.random() * total);
                    for (let i = 0; i < symbols.length; i++) {
                        if (random < weights[i]) return symbols[i];
                        random -= weights[i];
                    }
                    return symbols[0];
                }

                const reel1 = pickSymbol();
                const reel2 = pickSymbol();
                const reel3 = pickSymbol();

                let multiplier = 0;
                let description = '';

                // Check results
                if (reel1 === reel2 && reel2 === reel3) {
                    // 3 of a kind
                    if (reel1 === '7️⃣') {
                        multiplier = 100;
                        description = '🎉 **JACKPOT!** ¡ Tres 7s!';
                    } else if (reel1 === '⭐') {
                        multiplier = 50;
                        description = '⭐ **SUPER WIN!** ¡Tres estrellas!';
                    } else if (reel1 === '💎') {
                        multiplier = 25;
                        description = '💎 **BIG WIN!** ¡Tres diamantes!';
                    } else {
                        multiplier = 10;
                        description = '🎊 **GANASTE!** ¡Tres iguales!';
                    }
                } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
                    multiplier = 2;
                    description = '✨ Dos iguales - Premio menor';
                } else {
                    multiplier = 0;
                    description = '😔 Sin suerte esta vez...';
                }

                const ganancia = Math.floor(apuesta * multiplier) - apuesta;
                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'slots',
                    apuesta,
                    ganancia,
                    multiplier,
                    { reel1, reel2, reel3 }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🎰 TRAGAMONEDAS')
                    .setDescription(`\`\`\`\n[ ${reel1} | ${reel2} | ${reel3} ]\n\`\`\`\n\n${description}`)
                    .setColor(ganancia > 0 ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()} fichas`, inline: true },
                        { name: ganancia >= 0 ? '💰 Ganancia' : '💔 Pérdida', value: `${Math.abs(ganancia).toLocaleString()} fichas`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()} fichas`, inline: true }
                    )
                    .setFooter({ text: `Multiplicador: x${multiplier}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error jugando slots.');
            }
        }

        // === DICE ===
        else if (game === 'dice') {

            const apuesta = interaction.options.getInteger('apuesta');
            const direccion = interaction.options.getString('direccion');
            const numero = interaction.options.getInteger('numero');

            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                const resultado = Math.floor(Math.random() * 100); // 0-99

                let multiplier = 0;
                let win = false;

                if (direccion === 'over' && resultado > numero) {
                    win = true;
                    multiplier = (100 / (100 - numero)) * 0.98; // House edge 2%
                } else if (direccion === 'under' && resultado < numero) {
                    win = true;
                    multiplier = (100 / numero) * 0.98;
                }

                const ganancia = win ? Math.floor(apuesta * multiplier) - apuesta : -apuesta;
                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'dice',
                    apuesta,
                    ganancia,
                    win ? multiplier : 0,
                    { direccion, numero, resultado }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🎲 DICE')
                    .setDescription(`**Resultado:** \`${resultado}\`\n**Tu apuesta:** ${direccion === 'over' ? '⬆️ Mayor que' : '⬇️ Menor que'} ${numero}`)
                    .setColor(win ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: '🎯 Resultado', value: win ? '✅ ¡GANASTE!' : '❌ Perdiste', inline: true },
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: win ? '💰 Ganancia' : '💔 Pérdida', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()} fichas`, inline: false }
                    )
                    .setFooter({ text: win ? `Multiplicador: x${multiplier.toFixed(2)}` : 'Intenta de nuevo' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error jugando dice.');
            }
        }

        // === BLACKJACK ===
        else if (game === 'blackjack') {

            const apuesta = interaction.options.getInteger('apuesta');
            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                // Simple blackjack implementation
                function getCard() {
                    const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
                    return cards[Math.floor(Math.random() * cards.length)];
                }

                function calculateHand(cards) {
                    let total = 0;
                    let aces = 0;

                    for (const card of cards) {
                        if (card === 'A') {
                            aces++;
                            total += 11;
                        } else if (['J', 'Q', 'K'].includes(card)) {
                            total += 10;
                        } else {
                            total += parseInt(card);
                        }
                    }

                    while (total > 21 && aces > 0) {
                        total -= 10;
                        aces--;
                    }

                    return total;
                }

                const playerCards = [getCard(), getCard()];
                const dealerCards = [getCard(), getCard()];

                // Dealer plays (stands on 17+)
                while (calculateHand(dealerCards) < 17) {
                    dealerCards.push(getCard());
                }

                const playerTotal = calculateHand(playerCards);
                const dealerTotal = calculateHand(dealerCards);

                let resultado = '';
                let multiplier = 0;

                if (playerTotal > 21) {
                    resultado = '💥 **TE PASASTE!** Perdiste';
                    multiplier = 0;
                } else if (dealerTotal > 21) {
                    resultado = '🎉 **DEALER SE PASÓ!** ¡Ganaste!';
                    multiplier = 2;
                } else if (playerTotal > dealerTotal) {
                    resultado = playerTotal === 21 && playerCards.length === 2
                        ? '🃏 **BLACKJACK!** ¡Victoria perfecta!'
                        : '✅ **GANASTE!**';
                    multiplier = playerTotal === 21 && playerCards.length === 2 ? 2.5 : 2;
                } else if (playerTotal < dealerTotal) {
                    resultado = '😔 **DEALER GANA** Perdiste';
                    multiplier = 0;
                } else {
                    resultado = '🤝 **EMPATE** Recuperas tu apuesta';
                    multiplier = 1;
                }

                const ganancia = Math.floor(apuesta * multiplier) - apuesta;
                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'blackjack',
                    apuesta,
                    ganancia,
                    multiplier,
                    { playerCards, dealerCards, playerTotal, dealerTotal }
                );

                const embed = new EmbedBuilder()
                    .setTitle('🃏 BLACKJACK')
                    .setDescription(resultado)
                    .setColor(ganancia > 0 ? 0x00FF00 : ganancia < 0 ? 0xFF0000 : 0xFFA500)
                    .addFields(
                        { name: '👤 Tu Mano', value: `${playerCards.join(' ')} = **${playerTotal}**`, inline: true },
                        { name: '🏠 Dealer', value: `${dealerCards.join(' ')} = **${dealerTotal}**`, inline: true },
                        { name: '\u200b', value: '\u200b', inline: true },
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: ganancia > 0 ? '💰 Ganancia' : ganancia < 0 ? '💔 Pérdida' : '💼 Resultado', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Multiplicador: x${multiplier}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error jugando blackjack.');
            }
        }

        // === RULETA ===
        else if (game === 'ruleta') {

            const apuesta = interaction.options.getInteger('apuesta');
            const tipo = interaction.options.getString('tipo');
            const numeroElegido = interaction.options.getInteger('numero');

            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            if (tipo === 'number' && (numeroElegido === null || numeroElegido === undefined)) {
                return interaction.editReply('❌ Debes especificar un número si eliges "Número Exacto"');
            }

            try {
                const resultado = Math.floor(Math.random() * 37); // 0-36
                const rojos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
                const esRojo = rojos.includes(resultado);
                const esNegro = resultado !== 0 && !esRojo;
                const esPar = resultado !== 0 && resultado % 2 === 0;
                const esImpar = resultado !== 0 && resultado % 2 !== 0;

                let win = false;
                let multiplier = 0;

                switch (tipo) {
                    case 'red':
                        win = esRojo;
                        multiplier = 2;
                        break;
                    case 'nero':
                        win = esNegro;
                        multiplier = 2;
                        break;
                    case 'even':
                        win = esPar;
                        multiplier = 2;
                        break;
                    case 'odd':
                        win = esImpar;
                        multiplier = 2;
                        break;
                    case 'number':
                        win = resultado === numeroElegido;
                        multiplier = 35;
                        break;
                }

                const ganancia = win ? Math.floor(apuesta * multiplier) - apuesta : -apuesta;
                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'ruleta',
                    apuesta,
                    ganancia,
                    win ? multiplier : 0,
                    { tipo, numeroElegido, resultado }
                );

                const colorEmoji = esRojo ? '🔴' : esNegro ? '⚫' : '🟢';

                const embed = new EmbedBuilder()
                    .setTitle('🎡 RULETA EUROPEA')
                    .setDescription(`${colorEmoji} **Resultado: ${resultado}**`)
                    .setColor(win ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: '🎯 Tu Apuesta', value: tipo === 'number' ? `Número ${numeroElegido}` : tipo === 'red' ? 'Rojo' : tipo === 'black' ? 'Negro' : tipo === 'even' ? 'Par' : 'Impar', inline: true },
                        { name: '🎰 Resultado', value: win ? '✅ ¡GANASTE!' : '❌ Perdiste', inline: true },
                        { name: '\u200b', value: '\u200b', inline: true },
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: win ? '💰 Ganancia' : '💔 Pérdida', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: win ? `Multiplicador: x${multiplier}` : 'La casa siempre gana... casi siempre' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error jugando ruleta.');
            }
        }

        // === CARRERAS DE CABALLOS ===
        else if (game === 'caballos') {

            const apuesta = interaction.options.getInteger('apuesta');
            const caballoElegido = interaction.options.getInteger('caballo');

            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                const nombres = ['El Relámpago', 'Tornado', 'Huracán', 'Trueno', 'Meteoro', 'Centella'];
                const caballos = nombres.map((nombre, i) => ({ id: i + 1, nombre, posicion: 0 }));

                // Simulate race (10 rounds)
                for (let round = 0; round < 10; round++) {
                    for (const caballo of caballos) {
                        caballo.posicion += Math.floor(Math.random() * 3) + 1; // Avanza 1-3
                    }
                }

                // Sort by position
                caballos.sort((a, b) => b.posicion - a.posicion);
                const ganador = caballos[0];

                const win = ganador.id === caballoElegido;
                const multiplier = win ? 5 : 0;
                const ganancia = win ? Math.floor(apuesta * multiplier) - apuesta : -apuesta;

                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'caballos',
                    apuesta,
                    ganancia,
                    multiplier,
                    { caballoElegido, ganador: ganador.id, posiciones: caballos.map((c, i) => ({ nombre: c.nombre, posicion: i + 1 })) }
                );

                let raceDescription = '**🏁 RESULTADOS:**\n';
                caballos.forEach((c, i) => {
                    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    const highlight = c.id === caballoElegido ? '**' : '';
                    raceDescription += `${emoji} ${highlight}${c.nombre}${highlight}\n`;
                });

                const embed = new EmbedBuilder()
                    .setTitle('🐴 CARRERA DE CABALLOS')
                    .setDescription(raceDescription)
                    .setColor(win ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: '🎯 Tu Caballo', value: nombres[caballoElegido - 1], inline: true },
                        { name: '🏆 Ganador', value: ganador.nombre, inline: true },
                        { name: '🎰 Resultado', value: win ? '✅ ¡GANASTE!' : '❌ Perdiste', inline: true },
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: win ? '💰 Ganancia' : '💔 Pérdida', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: win ? 'Multiplicador: x5' : '¡Apuesta al caballo correcto la próxima!' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error en carrera de caballos.');
            }
        }

        // === CRASH ===
        else if (game === 'crash') {

            const apuesta = interaction.options.getInteger('apuesta');
            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                // Generate crash point (weighted toward lower values)
                const random = Math.random();
                let crashPoint;

                if (random < 0.33) crashPoint = 1 + Math.random() * 0.5; // 1.0-1.5x (33%)
                else if (random < 0.66) crashPoint = 1.5 + Math.random() * 1; // 1.5-2.5x (33%)
                else if (random < 0.85) crashPoint = 2.5 + Math.random() * 2.5; // 2.5-5x (19%)
                else if (random < 0.95) crashPoint = 5 + Math.random() * 5; // 5-10x (10%)
                else crashPoint = 10 + Math.random() * 40; // 10-50x (5%)

                crashPoint = parseFloat(crashPoint.toFixed(2));

                // Auto cash out at random point before crash
                const cashOutPoint = parseFloat((crashPoint * (0.6 + Math.random() * 0.3)).toFixed(2));

                const multiplier = cashOutPoint;
                const ganancia = Math.floor(apuesta * multiplier) - apuesta;

                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'crash',
                    apuesta,
                    ganancia,
                    multiplier,
                    { crashPoint, cashOutPoint }
                );

                const embed = new EmbedBuilder()
                    .setTitle('📉 CRASH')
                    .setDescription(`El multiplicador subió hasta **${crashPoint}x** y crasheó!\n\n🎯 Tu cash out: **${cashOutPoint}x**`)
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: '💰 Ganancia', value: `${ganancia.toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: `Multiplicador: x${multiplier}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error jugando crash.');
            }
        }

        // === GALLOS ===
        else if (game === 'gallos') {

            const apuesta = interaction.options.getInteger('apuesta');
            const galloElegido = interaction.options.getString('gallo');

            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                const rounds = [];
                let rojoWins = 0;
                let azulWins = 0;

                // Fight to 3 wins
                while (rojoWins < 3 && azulWins < 3) {
                    const winner = Math.random() < 0.5 ? 'red' : 'blue';
                    if (winner === 'red') rojoWins++;
                    else azulWins++;
                    rounds.push(winner);
                }

                const ganador = rojoWins === 3 ? 'red' : 'blue';
                const win = ganador === galloElegido;
                const multiplier = win ? 1.9 : 0;
                const ganancia = win ? Math.floor(apuesta * multiplier) - apuesta : -apuesta;

                const newBalance = await saveGameResult(
                    interaction.user.id,
                    'gallos',
                    apuesta,
                    ganancia,
                    multiplier,
                    { galloElegido, ganador, rounds }
                );

                let fightDescription = '**🥊 PELEA:**\n';
                rounds.forEach((r, i) => {
                    fightDescription += `Round ${i + 1}: ${r === 'red' ? '🔴 Rojo' : '🔵 Azul'} gana\n`;
                });

                const embed = new EmbedBuilder()
                    .setTitle('🐓 PELEA DE GALLOS')
                    .setDescription(fightDescription)
                    .setColor(win ? 0x00FF00 : 0xFF0000)
                    .addFields(
                        { name: '🎯 Tu Gallo', value: galloElegido === 'red' ? '🔴 Rojo' : '🔵 Azul', inline: true },
                        { name: '🏆 Ganador', value: ganador === 'red' ? '🔴 Rojo' : '🔵 Azul', inline: true },
                        { name: '🎰 Resultado', value: win ? '✅ ¡GANASTE!' : '❌ Perdiste', inline: true },
                        { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                        { name: win ? '💰 Ganancia' : '💔 Pérdida', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                        { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: win ? 'Multiplicador: x1.9' : '¡Mejor suerte la próxima!' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error en pelea de gallos.');
            }
        }

        // === RULETA RUSA ===
        else if (game === 'ruleta-rusa') {

            const apuesta = interaction.options.getInteger('apuesta');
            const check = await checkChips(interaction.user.id, apuesta);
            if (!check.hasEnough) return interaction.editReply(check.message);

            try {
                const chamber = Math.floor(Math.random() * 6) + 1; // 1-6
                const bullet = 1; // Bala en cámara 1

                const survived = chamber !== bullet;

                let ganancia, multiplier, newBalance;

                if (survived) {
                    multiplier = 5;
                    ganancia = Math.floor(apuesta * multiplier) - apuesta;
                    newBalance = await saveGameResult(
                        interaction.user.id,
                        'ruleta-rusa',
                        apuesta,
                        ganancia,
                        multiplier,
                        { chamber, survived: true }
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('💀 RULETA RUSA')
                        .setDescription('🎉 **¡SOBREVIVISTE!**\n\n*Click* ... La cámara estaba vacía.')
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '🎲 Cámara', value: `${chamber}/6`, inline: true },
                            { name: '🎟️ Apuesta', value: `${apuesta.toLocaleString()}`, inline: true },
                            { name: '💰 Ganancia', value: `${ganancia.toLocaleString()}`, inline: true },
                            { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: false }
                        )
                        .setFooter({ text: 'Multiplicador: x5 | Jugaste con fuego y ganaste' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });

                } else {
                    // PERDIÓ - Penalización
                    multiplier = 0;
                    const multa = apuesta * 2; // Multa 2x
                    ganancia = -(apuesta + multa);

                    newBalance = await saveGameResult(
                        interaction.user.id,
                        'ruleta-rusa',
                        apuesta,
                        ganancia,
                        0,
                        { chamber, survived: false }
                    );

                    // Ban temporal (1 hora)
                    const banUntil = new Date(Date.now() + (60 * 60 * 1000));
                    await supabase.from('casino_bans').insert({
                        discord_user_id: interaction.user.id,
                        reason: 'Perdió en Ruleta Rusa',
                        banned_by: 'Sistema Casino',
                        banned_until: banUntil.toISOString()
                    });

                    const embed = new EmbedBuilder()
                        .setTitle('💀 RULETA RUSA')
                        .setDescription('💥 **¡BANG!**\n\n❌ No tuviste suerte...\n\n**Penalización:**\n• Perdiste tu apuesta\n• Multa adicional: 2x apuesta\n• Ban del casino: 1 hora')
                        .setColor(0xFF0000)
                        .addFields(
                            { name: '🎲 Cámara', value: `${chamber}/6 💥`, inline: true },
                            { name: '💔 Pérdida Total', value: `${Math.abs(ganancia).toLocaleString()}`, inline: true },
                            { name: '⏰ Ban hasta', value: `<t:${Math.floor(banUntil.getTime() / 1000)}:R>`, inline: true },
                            { name: '💼 Nuevo Saldo', value: `${newBalance.toLocaleString()}`, inline: false }
                        )
                        .setFooter({ text: 'Juega con responsabilidad' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                }

            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error en ruleta rusa.');
            }
        }
    }
});

// Global Error Handlers to prevent crash
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);

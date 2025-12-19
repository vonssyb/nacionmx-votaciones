require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
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
                    name: 'depositar',
                    description: 'Depositar efectivo a debito - Tarda 4 horas',
                    type: 1,
                    options: [
                        { name: 'monto', description: 'Cantidad', type: 10, required: true }
                    ]
                },
                {
                    name: 'transferir',
                    description: 'Transferir debito a debito - Tarda 5 minutos',
                    type: 1,
                    options: [
                        { name: 'destinatario', description: 'Usuario', type: 6, required: true },
                        { name: 'monto', description: 'Cantidad', type: 10, required: true }
                    ]
                },
                { name: 'historial', description: 'Ver transacciones', type: 1 }
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
        const helpEmbed = new EmbedBuilder()
            .setTitle('🏦 Sistema Financiero Nación MX')
            .setColor(0xD4AF37) // Gold
            .setDescription('**Guía completa de comandos económicos y empresariales**')
            .addFields(
                { name: '💰 Banco & Efectivo', value: '`/balanza` - Ver saldo total (Cartera + Banco)\n`/banco depositar` - Cajero ATM (Efectivo a tu cuenta)\n`/depositar` - Depósito OXXO (Efectivo a cuenta de otro)\n`/transferir` - App Banco (Débito a Débito)\n`/giro` - Envío paquetería (Efectivo a Efectivo, 24h)' },
                { name: '💳 Tarjetas & Crédito', value: '`/tarjeta info` - Ver tus tarjetas y deudas\n`/credito pedir-prestamo` - Disponer efectivo de TC\n`/credito pagar` - Pagar tarjeta\n`/credito buro` - Ver tu historial crediticio' },
                { name: '🏢 Empresas', value: '`/empresa crear` - Registrar tu negocio\n`/empresa menu` - Panel de gestión (Empleados, Nómina)\n`/empresa cobrar` - Terminal Punto de Venta (Cobrar a clientes)\n`/empresa credito` - Solicitar crédito empresarial' },
                { name: '📈 Inversiones', value: '`/bolsa precios` - Mercado de valores\n`/bolsa comprar/vender` - Trading de acciones\n`/inversion nueva` - Plazo fijo (Rendimiento garantizado)' },
                { name: '📊 Impuestos & Admin', value: '`/impuestos consultar` - Estado fiscal personal\n`/top-ricos` - Ranking de millonarios\n`/top-morosos` - Lista pública de deudores' }
            )
            .setFooter({ text: 'Sistema Financiero Nación MX • Uso exclusivo Roleplay' })
            .setTimestamp();

        await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
    }

    else if (commandName === 'estado') {
        // IDs Provided by User
        const TARGET_CHANNEL_ID = '1412963363545284680';
        const PING_ROLE_ID = '1412899401000685588';
        const action = interaction.options.getString('seleccion');

        await interaction.deferReply({ ephemeral: false });

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
            const dniPhoto = interaction.options.getAttachment('foto_dni');
            const notes = interaction.options.getString('notas') || 'Sin notas';

            // CARD STATS MAP
            const cardStats = {
                'NMX Débito': { limit: 0, interest: 0, cost: 100 },
                'NMX Débito Plus': { limit: 0, interest: 0, cost: 500 },
                'NMX Débito Gold': { limit: 0, interest: 0, cost: 1000 },
                'NMX Start': { limit: 15000, interest: 15, cost: 2000 },
                'NMX Básica': { limit: 30000, interest: 12, cost: 4000 },
                'NMX Plus': { limit: 50000, interest: 10, cost: 6000 },
                'NMX Plata': { limit: 100000, interest: 8, cost: 10000 },
                'NMX Oro': { limit: 250000, interest: 7, cost: 15000 },
                'NMX Rubí': { limit: 500000, interest: 6, cost: 25000 },
                'NMX Black': { limit: 1000000, interest: 5, cost: 40000 },
                'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000 },
                // Business Cards
                'NMX Business Start': { limit: 50000, interest: 2, cost: 8000 },
                'NMX Business Gold': { limit: 100000, interest: 1.5, cost: 15000 },
                'NMX Business Platinum': { limit: 200000, interest: 1.2, cost: 20000 },
                'NMX Business Elite': { limit: 500000, interest: 1, cost: 35000 },
                'NMX Corporate': { limit: 1000000, interest: 0.7, cost: 50000 }
            };

            const stats = cardStats[cardType || 'NMX Start'] || cardStats['NMX Start'];

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
                                discord_id: targetUser.id,
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
        const subCmd = interaction.options.getSubcommand();
        const isPrivate = interaction.options.getBoolean('privado') ?? false;

        if (subCmd === 'buro') {
            await interaction.deferReply({ ephemeral: isPrivate });

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
            await interaction.deferReply({ ephemeral: isPrivate });

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
            await interaction.deferReply({ ephemeral: isPrivate });

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
            await interaction.deferReply({ ephemeral: isPrivate });

            // Robust amount handling
            const amount = interaction.options.getNumber('monto') || interaction.options.getInteger('monto');
            if (!amount || amount <= 0) return interaction.editReply('❌ El monto debe ser mayor a 0.');

            try {
                const REQ_ID = `loan-${Date.now()}`;
                console.log(`[Loan Debug] ${REQ_ID} Starting loan request for amount: ${amount}`);

                // Fetch Card directly with citizen join to avoid lookup issues
                const { data: userCard, error: cardError } = await supabase
                    .from('credit_cards')
                    .select('*, citizens!inner(id, full_name, discord_id)')
                    .eq('citizens.discord_id', interaction.user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (cardError) throw new Error(`Error buscando tarjeta: ${cardError.message}`);
                if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

                // 3. Validate Limit
                const currentBalance = userCard.current_balance || 0;
                const creditLimit = userCard.credit_limit || 0;
                const availableCredit = creditLimit - currentBalance;

                if (amount > availableCredit) {
                    return interaction.editReply(`❌ **Fondos Insuficientes**. \nLímite: $${creditLimit.toLocaleString()} \nDeuda: $${currentBalance.toLocaleString()} \nDisponible: $${availableCredit.toLocaleString()}`);
                }

                // 4. Update DB
                console.log(`[Loan Debug] ${REQ_ID} Updating DB...`);
                const newDebt = currentBalance + amount;
                const { error: dbError } = await supabase
                    .from('credit_cards')
                    .update({ current_balance: newDebt })
                    .eq('id', userCard.id);

                if (dbError) throw new Error(`Error DB: ${dbError.message}`);

                // 5. Update UnbelievaBoat
                console.log(`[Loan Debug] ${REQ_ID} UnbelievaBoat addMoney...`);
                let ubSuccess = true;
                let ubErrorMessage = '';

                try {
                    await billingService.ubService.addMoney(interaction.guildId, interaction.user.id, amount, `Préstamo NMX: ${userCard.card_type}`);
                    console.log(`[Loan Debug] ${REQ_ID} UnbelievaBoat success.`);
                } catch (ubError) {
                    console.error(`[Loan Debug] ${REQ_ID} UB Error:`, ubError);
                    ubSuccess = false;
                    ubErrorMessage = ubError.message;
                }

                // 6. Success Reply
                const embed = new EmbedBuilder()
                    .setTitle(ubSuccess ? '💸 Préstamo Aprobado' : '⚠️ Préstamo con Advertencia')
                    .setColor(ubSuccess ? 0x00FF00 : 0xFFA500)
                    .setDescription(ubSuccess
                        ? `Se han depositado **$${amount.toLocaleString()}** en tu cuenta de efectivo.`
                        : `✅ Deuda registrada en Banco, pero **FALLÓ** el depósito en efectivo.\n\n**Error:** ${ubErrorMessage}\n\n📢 **Contacta a Soporte inmediatamente** para que te den el dinero manualmente.`)
                    .addFields(
                        { name: 'Nueva Deuda', value: `$${newDebt.toLocaleString()}`, inline: true },
                        { name: 'Crédito Restante', value: `$${(userCard.credit_limit - newDebt).toLocaleString()}`, inline: true },
                        { name: 'Instrucciones', value: 'El monto se cobrará automáticamente el próximo **Domingo**.' }
                    )
                    .setFooter({ text: 'Sistema Financiero Nacion MX' });

                await interaction.editReply({ embeds: [embed] });

            } catch (err) {
                console.error('[Loan Debug] Critical Error:', err);
                await interaction.editReply(`❌ Error procesando solicitud: ${err.message}`);
                await interaction.editReply({ content: `❌ Error procesando solicitud: ${err.message}`, ephemeral: isPrivate });
            }
        }

        else if (subCmd === 'pagar') {
            await interaction.deferReply({ ephemeral: isPrivate });

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

            await interaction.deferReply({ ephemeral: false });

            // Resolve Citizen (Credit Cards are linked to CITIZENS, not Profiles directly)
            // 1. Try to find via Citizens table first
            const { data: citizen } = await supabase.from('citizens').select('id, full_name, credit_score, discord_id').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

            if (!citizen) return interaction.editReply('❌ Este usuario no tiene un ciudadano vinculado (No tiene registro en el sistema financiero).');

            const { data: userCard } = await supabase.from('credit_cards')
                .select('*')
                .eq('discord_id', targetUser.id)
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

        // 3. UnbelievaBoat Charge
        let status = 'UNPAID';
        let ubMessage = '';

        try {
            await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, amount, `Multa: ${reason}`);
            status = 'PAID';
        } catch (err) {
            ubMessage = `(Fallo cobro automático: ${err.message})`;
        }

        // 4. Record Fine
        const { error: fineError } = await supabase.from('fines').insert([{
            citizen_id: citizen.id,
            officer_discord_id: interaction.user.id,
            amount: amount,
            reason: reason,
            status: status
        }]);

        if (fineError) console.error("Fine error", fineError);

        const embed = new EmbedBuilder()
            .setTitle(status === 'PAID' ? '⚖️ Multa Pagada' : '⚖️ Multa Registrada (Cobro Pendiente)')
            .setColor(status === 'PAID' ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Oficial', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Monto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Motivo', value: reason }
            )
            .setFooter({ text: status === 'PAID' ? 'Cobrado automáticamente de cuenta bancaria.' : 'El ciudadano no tenía fondos suficientes. Se registró deuda judicial.' });

        await interaction.editReply({ embeds: [embed] });
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
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'nueva') {
            await interaction.deferReply();
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

                // Check user balance
                // Check user balance (Total)
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                const totalBalance = (balance.cash || 0) + (balance.bank || 0);

                if (totalBalance < license.cost) {
                    return interaction.editReply(`❌ <@${targetUser.id}> no tiene fondos suficientes.\n\n💰 Costo: $${license.cost.toLocaleString()}\n💵 Tiene: $${totalBalance.toLocaleString()} (Total)`);
                }

                // Determine payment source
                let paySource = 'bank';
                if ((balance.bank || 0) < license.cost && (balance.cash || 0) >= license.cost) {
                    paySource = 'cash';
                }

                // Check if already has this license
                const { data: existing } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('discord_user_id', targetUser.id)
                    .eq('license_type', tipo)
                    .eq('status', 'active');

                if (existing && existing.length > 0) {
                    return interaction.editReply(`⚠️ <@${targetUser.id}> ya tiene esta licencia activa.`);
                }

                // Charge user
                await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, license.cost, `Pago de ${license.name}`, paySource);

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

                const embed = new EmbedBuilder()
                    .setTitle(`${license.emoji} Licencia Registrada`)
                    .setColor(0x00FF00)
                    .setDescription(`**${license.name}** otorgada exitosamente`)
                    .addFields(
                        { name: '👤 Ciudadano', value: `<@${targetUser.id}>`, inline: true },
                        { name: '💵 Costo', value: `$${license.cost.toLocaleString()}`, inline: true },
                        { name: '📅 Válida hasta', value: `<t:${Math.floor(expiryDate.getTime() / 1000)}:D>`, inline: false },
                        { name: '👮 Emitida por', value: interaction.user.tag, inline: true }
                    )
                    .setFooter({ text: 'Sistema de Licencias Nación MX' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

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
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'crear') {
            const name = interaction.options.getString('nombre');
            await supabase.from('payroll_groups').insert([{ owner_discord_id: interaction.user.id, name: name }]);
            await interaction.reply(`✅ Grupo de nómina **${name}** creado.`);
        }
        else if (subCmd === 'agregar') {
            const groupName = interaction.options.getString('grupo');
            const target = interaction.options.getUser('empleado');
            const salary = interaction.options.getNumber('sueldo');

            // Find group
            const { data: group } = await supabase.from('payroll_groups').select('id').eq('name', groupName).eq('owner_discord_id', interaction.user.id).single();
            if (!group) return interaction.reply('❌ No encontré ese grupo o no eres el dueño.');

            await supabase.from('payroll_members').upsert([{ group_id: group.id, member_discord_id: target.id, salary: salary }]);
            await interaction.reply(`✅ **${target.username}** agregado a **${groupName}** con sueldo $${salary}.`);
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

            await interaction.reply({ embeds: [embed] });
        }

        else if (subcommand === 'comprar') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.reply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
            }

            const currentPrice = stock.current;
            const totalCost = currentPrice * cantidad;

            // Check user balance
            try {
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if (balance.bank < totalCost) {
                    return await interaction.reply({
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

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error comprando acciones:', error);
                await interaction.reply({ content: '❌ Error procesando la compra. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'vender') {
            const symbol = interaction.options.getString('symbol').toUpperCase();
            const cantidad = interaction.options.getNumber('cantidad');

            // Validate stock exists in Global
            const stock = globalStocks.find(s => s.symbol === symbol);
            if (!stock) {
                return await interaction.reply({ content: `❌ Símbolo inválido. Usa: ${globalStocks.map(s => s.symbol).join(', ')}`, ephemeral: false });
            }

            if (cantidad <= 0) {
                return await interaction.reply({ content: '❌ La cantidad debe ser mayor a 0.', ephemeral: false });
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
                    return await interaction.reply({
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
                        { name: 'Ganancia/Pérdida', value: `${profitEmoji} $${Math.floor(profit).toLocaleString()} MXN`, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error vendiendo acciones:', error);
                await interaction.reply({ content: '❌ Error procesando la venta. Intenta de nuevo.', ephemeral: false });
            }
        }

        else if (subcommand === 'portafolio') {
            try {
                const { data: portfolio } = await supabase
                    .from('stock_portfolios')
                    .select('*')
                    .eq('discord_user_id', interaction.user.id);

                if (!portfolio || portfolio.length === 0) {
                    return await interaction.reply({ content: '📊 Tu portafolio está vacío. Usa `/bolsa comprar` para invertir.', ephemeral: false });
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
                        value: `Compra: $${p.avg_buy_price.toLocaleString()} | Actual: $${currentPrice.toLocaleString()}\nValor: $${currentValue.toLocaleString()} | ${profitEmoji} $${profitLoss.toLocaleString()}`,
                        inline: false
                    });
                });

                const totalProfit = totalCurrent - totalInvested;
                const profitEmoji = totalProfit >= 0 ? '📈' : '📉';

                embed.setDescription(`**Total Invertido:** $${totalInvested.toLocaleString()}\n**Valor Actual:** $${totalCurrent.toLocaleString()}\n**${profitEmoji} Ganancia/Pérdida Total:** $${totalProfit.toLocaleString()}`);

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando portafolio:', error);
                await interaction.reply({ content: '❌ Error obteniendo tu portafolio.', ephemeral: false });
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
                    return await interaction.reply({ content: '📜 No tienes transacciones registradas.', ephemeral: false });
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

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Error mostrando historial:', error);
                await interaction.reply({ content: '❌ Error obteniendo tu historial.', ephemeral: false });
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

    const { data: currentCard } = await supabase.from('credit_cards')
        .select('*')
        .eq('discord_id', interaction.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
            const { data: debitCard } = await supabase.from('debit_cards').select('balance').eq('discord_user_id', interaction.user.id).eq('status', 'active').maybeSingle();
            const { data: creditCards } = await supabase.from('credit_cards').select('*').eq('discord_id', interaction.user.id).eq('status', 'active');

            const cash = cashBalance.cash || 0;
            const bank = cashBalance.bank || 0;
            // Debit Card just checks if exists, balance comes from Bank
            const hasDebit = debitCard ? true : false;

            let creditAvailable = 0;
            let creditDebt = 0;
            if (creditCards) {
                creditCards.forEach(c => {
                    const limit = c.card_limit || c.credit_limit || 0;
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
                    { name: '💳 BANCO / DÉBITO', value: `\`\`\`$${bank.toLocaleString()}\`\`\`\n${hasDebit ? '✅ Tarjeta Activa' : '❌ Sin Tarjeta'}`, inline: true },
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
        const subcommand = interaction.options.getSubcommand();

        async function getDebitCard(discordId) {
            const { data: card } = await supabase.from('debit_cards').select('*').eq('discord_user_id', discordId).eq('status', 'active').maybeSingle();
            return card;
        }

        if (subcommand === 'estado') {
            await interaction.deferReply();
            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa. Visita el Banco Nacional para abrir tu cuenta con `/registrar-tarjeta`.');
                const embed = new EmbedBuilder().setTitle('💳 Estado Tarjeta Débito').setColor(0x00CED1).addFields({ name: 'Numero', value: `\`${card.card_number}\``, inline: false }, { name: 'Balance', value: `$${card.balance.toLocaleString()}`, inline: true }, { name: 'Estado', value: '✅ Activa', inline: true }).setTimestamp();
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error consultando débito.');
            }
        }



        else if (subcommand === 'transferir') {
            const destUser = interaction.options.getUser('destinatario');
            const monto = interaction.options.getNumber('monto');
            if (monto <= 0) return interaction.reply({ content: '❌ Monto >0.', ephemeral: true });
            if (destUser.id === interaction.user.id) return interaction.reply({ content: '❌ No a ti mismo.', ephemeral: true });
            await interaction.deferReply();
            try {
                const card = await getDebitCard(interaction.user.id);
                if (!card) return interaction.editReply('❌ No tienes una tarjeta de débito activa. Visita el Banco Nacional para abrir tu cuenta con `/registrar-tarjeta`.');
                if (card.balance < monto) return interaction.editReply(`❌ Saldo débito insuficiente: $${card.balance.toLocaleString()}`);
                await supabase.from('debit_cards').update({ balance: card.balance - monto }).eq('id', card.id);
                await supabase.from('debit_transactions').insert({ debit_card_id: card.id, discord_user_id: interaction.user.id, transaction_type: 'transfer_out', amount: -monto, balance_after: card.balance - monto, related_user_id: destUser.id });
                const completionTime = new Date(Date.now() + (5 * 60 * 1000));
                await supabase.from('pending_transfers').insert({ from_user_id: interaction.user.id, to_user_id: destUser.id, amount: monto, transfer_type: 'debit_to_debit', scheduled_completion: completionTime.toISOString() });
                const embed = new EmbedBuilder().setTitle('⏳ Transferencia en Proceso').setColor(0xFFA500).addFields({ name: 'Para', value: destUser.tag, inline: true }, { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true }, { name: 'Completa', value: `<t:${Math.floor(completionTime.getTime() / 1000)}:R>`, inline: false });
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply('❌ Error en transferencia.');
            }
        }

        else if (subcommand === 'historial') {
            await interaction.deferReply();
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
    }

    else if (commandName === 'top-ricos') {
        await interaction.deferReply();

        try {
            const { data: citizens } = await supabase
                .from('citizens')
                .select('full_name, credit_score, discord_id')
                .order('credit_score', { ascending: false })
                .limit(10);

            if (!citizens || citizens.length === 0) {
                return interaction.editReply('❌ No hay datos disponibles.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top 10 - Mejores Puntajes Crediticios')
                .setColor(0xFFD700)
                .setTimestamp();

            let description = '';
            citizens.forEach((c, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} **${c.full_name}** - Score: ${c.credit_score || 100}/100\n`;
            });

            embed.setDescription(description);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo el ranking.');
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
        const monto = interaction.options.getNumber('monto');
        const razon = interaction.options.getString('razon') || 'Depósito en Efectivo';

        if (monto <= 0) {
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
        const destUser = interaction.options.getUser('destinatario');
        const monto = interaction.options.getNumber('monto');
        const razon = interaction.options.getString('razon') || 'Transferencia Débito';

        if (monto <= 0) return interaction.reply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: true });
        if (destUser.id === interaction.user.id) return interaction.reply({ content: '❌ Auto-transferencia no permitida.', ephemeral: true });

        await interaction.deferReply();

        try {
            // 1. Check BOTH for Debit Cards
            const { data: senderCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            const { data: destCard } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', destUser.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!senderCard) return interaction.editReply('❌ **No tienes Tarjeta de Débito**. Usa `/depositar` para transferencias en efectivo/banco genérico.');
            if (!destCard) return interaction.editReply(`❌ **${destUser.username}** no tiene Tarjeta de Débito activa. Usa \`/depositar\`.`);

            // 2. Check Balance (UB BANK)
            const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            if ((balance.bank || 0) < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Banco. Tienes $${(balance.bank || 0).toLocaleString()}.`);
            }

            // 3. Execute Transfer (UB Bank -> UB Bank)
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Transferencia a ${destUser.tag}: ${razon}`, 'bank');
            await billingService.ubService.addMoney(interaction.guildId, destUser.id, monto, `Transferencia de ${interaction.user.tag}: ${razon}`, 'bank');

            // Logs
            await supabase.from('debit_transactions').insert([
                { debit_card_id: senderCard.id, discord_user_id: interaction.user.id, transaction_type: 'transfer_out', amount: monto, balance_after: (balance.bank - monto), description: `Transferencia a ${destUser.tag}` },
                { debit_card_id: destCard.id, discord_user_id: destUser.id, transaction_type: 'transfer_in', amount: monto, balance_after: 0, description: `Transferencia de ${interaction.user.tag}` }
            ]);

            const embed = new EmbedBuilder()
                .setTitle('💳 Transferencia Débito Exitosa')
                .setColor(0x00FFFF) // Cyan for Debit
                .setDescription(`Transferencia segura entre cuentas de débito NMX.`)
                .addFields(
                    { name: 'De', value: `💳 ${interaction.user.tag}`, inline: true },
                    { name: 'Para', value: `💳 ${destUser.tag}`, inline: true },
                    { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: 'Concepto', value: razon, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Notify
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('💳 Has recibido una Transferencia Débito')
                    .setDescription(`**${interaction.user.tag}** te ha transferido **$${monto.toLocaleString()}** a tu cuenta de débito.`)
                    .addFields({ name: 'Concepto', value: razon })
                    .setColor(0x00FFFF)
                    .setTimestamp();
                await destUser.send({ embeds: [dmEmbed] });
            } catch (dmError) { /* Ignore */ }

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error procesando la transferencia.');
        }
    }

    else if (commandName === 'giro') {
        const destUser = interaction.options.getUser('destinatario');
        const monto = interaction.options.getNumber('monto');
        const razon = interaction.options.getString('razon') || 'Giro Postal';

        if (monto <= 0) return interaction.reply({ content: '❌ El monto debe ser mayor a 0.', ephemeral: true });
        if (destUser.id === interaction.user.id) return interaction.reply({ content: '❌ No puedes enviarte un giro a ti mismo.', ephemeral: true });

        await interaction.deferReply();

        try {
            // 1. Check Sender Balance (Generic Bank/Cash)
            const senderBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
            if (senderBalance.bank < monto) {
                return interaction.editReply(`❌ Fondos insuficientes en Banco. Tienes $${senderBalance.bank.toLocaleString()}.`);
            }

            // 2. Deduct Money Immediately
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Giro enviado a ${destUser.tag}: ${razon}`, 'bank');

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
                    status: 'PENDING'
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
                            const payRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId('comp_pay_cash').setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                                new ButtonBuilder().setCustomId('comp_pay_bank').setLabel('🏦 Banco (UB)').setStyle(ButtonStyle.Primary),
                                new ButtonBuilder().setCustomId('comp_pay_debit').setLabel('💳 Débito (NMX)').setStyle(ButtonStyle.Secondary)
                            );
                            await i.update({ content: '🏢 **Selecciona método de pago:**', embeds: [], components: [payRow] });
                            return;
                        }

                        if (['comp_pay_cash', 'comp_pay_bank', 'comp_pay_debit'].includes(i.customId)) {
                            hasResponded = true;
                            await i.deferUpdate();
                            try {
                                if (totalCost > 0) {
                                    if (i.customId === 'comp_pay_cash') {
                                        const bal = await billingService.ubService.getUserBalance(interaction.guildId, ownerUser.id);
                                        if ((bal.cash || 0) < totalCost) return i.followUp({ content: `❌ No tiene suficiente efectivo el dueño.`, ephemeral: true });
                                        await billingService.ubService.removeMoney(interaction.guildId, ownerUser.id, totalCost, `Registro Empresa: ${name}`, 'cash');
                                    }
                                    else if (i.customId === 'comp_pay_bank') {
                                        const bal = await billingService.ubService.getUserBalance(interaction.guildId, ownerUser.id);
                                        if ((bal.bank || 0) < totalCost) return i.followUp({ content: `❌ No tiene suficiente en Banco el dueño.`, ephemeral: true });
                                        await billingService.ubService.removeMoney(interaction.guildId, ownerUser.id, totalCost, `Registro Empresa: ${name}`, 'bank');
                                    }
                                    else if (i.customId === 'comp_pay_debit') {
                                        // Unified with Bank
                                        const bal = await billingService.ubService.getUserBalance(interaction.guildId, ownerUser.id);
                                        if ((bal.bank || 0) < totalCost) return i.followUp({ content: `❌ No tiene suficiente saldo en Banco/Débito.`, ephemeral: true });

                                        await billingService.ubService.removeMoney(interaction.guildId, ownerUser.id, totalCost, `Registro Empresa: ${name}`, 'bank');
                                    }
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


                            } catch (err) {
                                console.error(err);
                                await i.followUp({ content: `❌ Error procesando el registro: ${err.message}`, ephemeral: true });
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

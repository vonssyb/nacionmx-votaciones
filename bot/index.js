require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const BillingService = require('./services/BillingService');

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

client.once('ready', async () => {
    console.log(`🤖 Bot iniciado como ${client.user.tag}!`);
    console.log(`📡 Conectado a Supabase: ${supabaseUrl}`);

    client.user.setActivity('Finanzas Nacion MX', { type: ActivityType.Watching });

    // Start Auto-Billing Cron
    billingService.startCron();

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

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
            console.log(`✨ Registrando ${commands.length} nuevos comandos en: '${GUILD_ID}'...`);
            console.log(`🔑 Client ID: ${client.user.id}`);
            // console.log('📦 Payloads:', JSON.stringify(commands, null, 2)); // Too verbose for 17 commands

            // Timeout implementation to prevent hanging indefinitely
            const registrationTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT: La conexión con Discord API tardó demasiado (>15s).')), 15000)
            );

            try {
                await Promise.race([
                    rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands }),
                    registrationTimeout
                ]);
                console.log('✅ Comandos verificados y limpios (REST PUT Success).');
            } catch (putError) {
                console.error('❌ FATAL REST ERROR:', putError);
                // Optionally Fallback to Global? catch -> log
            }

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

    if (interaction.isButton()) { return; }

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const ping = Date.now() - interaction.createdTimestamp;
        await interaction.reply({ content: `🏓 Pong! Latencia: **${ping}ms**. API: **${Math.round(client.ws.ping)}ms**.`, ephemeral: false });
    }


    else if (commandName === 'ayuda') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🏦 Comandos Bancarios (Cheat Sheet)')
            .setColor(0xD4AF37) // Gold
            .setDescription('Lista de comandos del Sistema Financiero Nacional.')
            .addFields(
                { name: '💰 Utilidad', value: '`/credito info`: Datos de la tarjeta.\n`/credito estado`: Saldo y Deuda.\n`/transferir`: Enviar dinero.\n`/notificaciones`: Alertas DM.' },
                { name: '📊 Rankings', value: '`/top-morosos`: Deudores públicos.\n`/top-ricos`: Mejores Scores.' },
                { name: '👔 Gestión de Nóminas (Empresas)', value: '1. `/nomina crear [nombre]`: Registra tu empresa/grupo.\n2. `/nomina agregar [grupo] [empleado] [sueldo]`: Añade personal.\n3. `/nomina pagar [grupo]`: Paga a todos con un clic.' },
                { name: '📈 Inversiones', value: '`/inversion nueva`: Bloquea dinero por 7 días (5% ganancia).\n`/inversion estado`: Ver estatus y **Cobrar**.' },
                { name: '👮 Staff', value: '`/registrar-tarjeta`, `/fichar vincular`, `/credito admin`' }
            )
            .setFooter({ text: 'Sistema Financiero Nacion MX' });

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

    else if (commandName === 'registrar-tarjeta') {
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
            'NMX Start': { limit: 15000, interest: 15, cost: 2000 },
            'NMX Básica': { limit: 30000, interest: 12, cost: 4000 },
            'NMX Plus': { limit: 50000, interest: 10, cost: 6000 },
            'NMX Plata': { limit: 100000, interest: 8, cost: 10000 },
            'NMX Oro': { limit: 250000, interest: 7, cost: 15000 },
            'NMX Rubí': { limit: 500000, interest: 6, cost: 25000 },
            'NMX Black': { limit: 1000000, interest: 5, cost: 40000 },
            'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000 }
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
                await i.deferUpdate();
                try {
                    // Check Funds
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                    const userMoney = balance.total || (balance.cash + balance.bank);

                    if (userMoney < stats.cost) {
                        return i.followUp({ content: `❌ **Fondos Insuficientes**. Tienes: $${userMoney.toLocaleString()}. Requiere: $${stats.cost.toLocaleString()}.`, ephemeral: false });
                    }

                    // Charge
                    await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`);

                    // Create Card
                    const { error: insertError } = await supabase.from('credit_cards').insert([{
                        citizen_id: citizen.id,
                        card_type: cardType,
                        credit_limit: stats.limit,
                        current_balance: 0,
                        interest_rate: stats.interest,
                        status: 'active',
                        next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    }]);

                    if (insertError) throw new Error(insertError.message);

                    // Log Evidence (Optional)
                    // Could save DNI URL to evidence table if needed.

                    // UPDATE: Include 'Registrado por' in final success message
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Nueva Tarjeta Emitida')
                        .setColor(0x00FF00) // Green
                        .addFields(
                            { name: 'Titular', value: holderName, inline: true },
                            { name: 'DNI', value: (citizen && citizen.dni) ? citizen.dni : 'PENDING', inline: true },
                            { name: 'Nivel', value: cardType, inline: true },
                            { name: 'Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                            { name: 'Interés', value: `${stats.interest}%`, inline: true },
                            { name: 'Corte', value: 'Domingos 11:59PM', inline: true }
                        )
                        .setThumbnail(dniPhoto.url)
                        .addFields({ name: '💡 Comandos Útiles', value: '• `/credito estado`: Ver saldo y deuda.\n• `/credito pagar`: Abonar a tu tarjeta.\n• `/credito pedir-prestamo`: Retirar efectivo.' })
                        .setFooter({ text: `Banco Nacional RP • ${new Date().toLocaleDateString('es-MX')} • Registrado por: ${interaction.user.tag}` });

                    await message.edit({
                        content: '', // Remove plain text content
                        embeds: [successEmbed],
                        components: []
                    });

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
        else if (subCmd === 'info') {
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

                // 1. Fetch Citizen
                console.log(`[Loan Debug] ${REQ_ID} Fetching citizen...`);
                // Note: removed profile join to avoid crashes if username column missing
                const { data: citizen, error: citError } = await supabase.from('citizens').select('*').eq('discord_id', interaction.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

                if (citError) throw new Error(`Error buscando ciudadano: ${citError.message}`);
                if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado. Usa `/fichar` primero.');

                // 2. Fetch Card
                console.log(`[Loan Debug] ${REQ_ID} Fetching card for citizen ${citizen.id}...`);
                // Valid query without profiles join
                const { data: userCard, error: cardError } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

                if (cardError) throw new Error(`Error buscando tarjeta: ${cardError.message}`);
                if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

                // 3. Validate Limit
                const availableCredit = userCard.credit_limit - userCard.current_balance;
                if (amount > availableCredit) {
                    return interaction.editReply(`❌ **Fondos Insuficientes**. \nLímite: $${userCard.credit_limit.toLocaleString()} \nDeuda: $${userCard.current_balance.toLocaleString()} \nDisponible: $${availableCredit.toLocaleString()}`);
                }

                // 4. Update DB
                console.log(`[Loan Debug] ${REQ_ID} Updating DB...`);
                const newDebt = userCard.current_balance + amount;
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

            // Resolve Profile
            const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('discord_id', targetUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (!profile) return interaction.editReply('❌ Este usuario no tiene perfil vinculado.');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (!userCard) return interaction.editReply('❌ Este usuario no tiene tarjeta.');

            if (subCmdAdmin === 'info') {
                const embed = new EmbedBuilder()
                    .setTitle(`📂 Info Bancaria: ${profile.full_name}`)
                    .setColor(0x0000FF)
                    .addFields(
                        { name: 'Tarjeta', value: userCard.card_type, inline: true },
                        { name: 'Estado', value: userCard.status, inline: true },
                        { name: 'Deuda', value: `$${userCard.current_balance.toLocaleString()}`, inline: true },
                        { name: 'Límite', value: `$${userCard.credit_limit.toLocaleString()}`, inline: true },
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
                await interaction.editReply(`✅ Deuda perdonada para **${profile.full_name}**. Deuda actual: $0.`);
            }

            else if (subCmdAdmin === 'congelar') {
                await supabase.from('credit_cards').update({ status: 'FROZEN' }).eq('id', userCard.id);
                await interaction.editReply(`❄️ Tarjeta de **${profile.full_name}** ha sido **CONGELADA**.`);
            }

            else if (subCmdAdmin === 'descongelar') {
                await supabase.from('credit_cards').update({ status: 'ACTIVE' }).eq('id', userCard.id);
                await interaction.editReply(`🔥 Tarjeta de **${profile.full_name}** ha sido **DESCONGELADA** y está Activa.`);
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

    else if (commandName === 'registrar-tarjeta') {
        await interaction.deferReply({ ephemeral: false });

        // 1. Role Check (Staff Banco: 1450591546524307689)
        // Also allow Admin for testing
        if (!interaction.member.roles.cache.has('1450591546524307689') && !interaction.member.permissions.has('Administrator')) {
            return interaction.editReply('⛔ No tienes permisos para registrar tarjetas (Rol Staff Banco Requerido).');
        }

        const targetUser = interaction.options.getUser('usuario');
        if (!targetUser) return interaction.editReply('❌ Debes especificar un usuario.');

        const holderName = interaction.options.getString('nombre_titular');
        const cardType = interaction.options.getString('tipo'); // Use 'tipo' not 'tipo_tarjeta' as defined in options
        const dniPhoto = interaction.options.getAttachment('foto_dni');
        const notes = interaction.options.getString('notas') || 'Sin notas';

        // CARD STATS MAP
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

        const stats = cardStats[cardType || 'NMX Start'] || cardStats['NMX Start'];

        // 2. Find Citizen
        // The user said "pide foto de dni, nombre del titular".
        let { data: citizen } = await supabase.from('citizens').select('id, full_name').eq('discord_id', targetUser.id).limit(1).maybeSingle();

        if (!citizen) {
            // Create new Citizen record if not exists
            const { data: newCit, error: createError } = await supabase.from('citizens').insert([{
                discord_id: targetUser.id,
                full_name: holderName,
                dni: 'PENDING',
                created_at: new Date().toISOString(),
                credit_score: 100
            }]).select().single();

            if (createError) {
                console.error(createError);
                return interaction.editReply('❌ Error registrando Nuevo Ciudadano en base de datos.');
            }
            citizen = newCit;
        } else {
            // Update name matches RP name provided
            if (citizen.full_name !== holderName) {
                await supabase.from('citizens').update({ full_name: holderName }).eq('id', citizen.id);
            }
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
                    .setDescription('**1. Pagos:** Semanales obligatorios (25% mín).\n**2. Intereses:** Se aplican al corte.\n**3. Impago:** Congelamiento y Buró negativo.\n**4. Uso:** Responsabilidad del titular.');
                await i.reply({ embeds: [tycEmbed], ephemeral: false });
            }
            else if (i.customId === 'btn_reject') {
                await i.update({ content: '❌ Oferta rechazada.', components: [] });
                collector.stop();
            }
            else if (i.customId === 'btn_accept') {
                try {
                    await i.deferUpdate();
                } catch (e) {
                    // Ignore if already deferred/replied
                }

                try {
                    // Check Funds
                    const balance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);
                    const userMoney = balance.total || (balance.cash + balance.bank);

                    if (userMoney < stats.cost) {
                        return i.followUp({ content: `❌ **Fondos Insuficientes**. Tienes: $${userMoney.toLocaleString()}. Requiere: $${stats.cost.toLocaleString()}.`, ephemeral: false });
                    }

                    // Charge
                    await billingService.ubService.removeMoney(interaction.guildId, targetUser.id, stats.cost, `Apertura ${cardType}`);

                    // Create Card
                    const { error: insertError } = await supabase.from('credit_cards').insert([{
                        citizen_id: citizen.id,
                        card_type: cardType,
                        credit_limit: stats.limit,
                        current_balance: 0,
                        interest_rate: stats.interest,
                        status: 'active', // Ensure lowercase
                        next_payment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    }]);

                    if (insertError) throw new Error(insertError.message);

                    // UPDATE: Include 'Registrado por' in final success message
                    await message.edit({
                        content: `✅ **Tarjeta Activada** para **${holderName}**. Cobro de $${stats.cost.toLocaleString()} realizado.\n👮 **Registrado por:** <@${interaction.user.id}>`,
                        components: []
                    });

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

    else if (commandName === 'bolsa') {
        const stocks = [
            { symbol: 'BTC', name: 'Bitcoin', base: 45000, type: 'Cripto' },
            { symbol: 'ETH', name: 'Ethereum', base: 3000, type: 'Cripto' },
            { symbol: 'SOL', name: 'Solana', base: 100, type: 'Cripto' },
            { symbol: 'TSLA', name: 'Tesla Inc.', base: 200, type: 'Empresa' },
            { symbol: 'AMZN', name: 'Amazon', base: 145, type: 'Empresa' },
            { symbol: 'PEMEX', name: 'Petróleos Mexicanos', base: 18, type: 'Empresa' },
            { symbol: 'NMX', name: 'Nación MX Corp', base: 500, type: 'Empresa' }
        ];

        // Pseudo-random price based on hour
        const hour = new Date().getHours();
        const getPrice = (base, sym) => {
            const seed = (hour * base) % 100; // Deterministic random per hour
            const variance = (seed - 50) / 100; // -0.5 to 0.5 (Too high? Let's reduce to 20%)
            const cleanVariance = variance * 0.4; // +/- 20%
            return Math.floor(base * (1 + cleanVariance));
        };

        const embed = new EmbedBuilder()
            .setTitle('📈 Bolsa de Valores & Cripto')
            .setColor(0x0000FF)
            .setDescription(`Precios actualizados a las ${hour}:00 hrs.`)
            .setTimestamp();

        stocks.forEach(s => {
            const price = getPrice(s.base, s.symbol);
            const trend = price > s.base ? '📈' : '📉';
            embed.addFields({ name: `${trend} ${s.symbol} (${s.type})`, value: `$${price.toLocaleString()} USD`, inline: true });
        });

        await interaction.reply({ embeds: [embed] });
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
                        { name: 'Límite', value: `$${newCard.credit_limit}`, inline: true },
                        { name: 'Interés', value: `${newCard.interest_rate}%`, inline: true }
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

client.login(process.env.DISCORD_TOKEN);

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
const GUILD_ID = process.env.GUILD_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

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
        },
        {
            name: 'fichar',
            description: 'Inicia o Termina tu turno (Entrada/Salida)',
            options: [
                {
                    name: 'accion',
                    description: 'Entrar o Salir',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'Entrar a Turno', value: 'in' },
                        { name: 'Salir de Turno', value: 'out' }
                    ]
                }
            ]
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
            description: 'Enlace para solicitar tarjeta',
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
                    name: 'admin',
                    description: 'Herramientas Administrativas de Banco (Staff)',
                    type: 2, // SUB_COMMAND_GROUP
                    options: [
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
        }
    ];

    try {
        console.log('Iniciando registro de comandos...');

        if (GUILD_ID) {
            console.log(`Registrando comandos en Servidor: ${GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, GUILD_ID),
                { body: commands }
            );
            console.log('✅ Comandos (Guild) registrados correctamente.');
        } else {
            console.log('⚠️ GUILD_ID no encontrado. Registrando comandos GLOBALMENTE (tardará ~1 hora en aparecer).');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('✅ Comandos (Globales) registrados correctamente.');
        }
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }

    // Start listening to Supabase changes
    subscribeToNewCards();
    subscribeToCancellations();
});

// Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply('¡Pong! 🏓 El bot de finanzas está activo.');
    }

    else if (commandName === 'estado') {
        // IDs Provided by User
        const TARGET_CHANNEL_ID = '1412963363545284680';
        const PING_ROLE_ID = '1412899401000685588';
        const action = interaction.options.getString('seleccion');

        await interaction.deferReply({ ephemeral: true });

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
        const embed = new EmbedBuilder()
            .setTitle('💳 Solicitud de Tarjeta de Crédito')
            .setDescription('Para tramitar tu tarjeta, por favor **abre un Ticket** en el canal <#1450269843600310373>.\n\nEl sistema web es de uso exclusivo para el Staff administrativo.')
            .setColor(0xD4AF37);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'credito') {
        const subCmd = interaction.options.getSubcommand();
        const isPrivate = interaction.options.getBoolean('privado') ?? false;

        if (subCmd === 'estado') {
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
                return interaction.reply({ content: '⛔ Solo administradores pueden usar esto.', ephemeral: true });
            }

            const subCmdAdmin = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('usuario');
            await interaction.deferReply({ ephemeral: true });

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
            await interaction.deferReply({ ephemeral: true });

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
            await interaction.deferReply({ ephemeral: true });

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

    else if (commandName === 'fichar') {
        await interaction.deferReply({ ephemeral: true });
        const action = interaction.options.getString('accion');

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('discord_id', interaction.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!profile) {
            return interaction.editReply('❌ No tienes tu cuenta de Discord vinculada. Pide a un admin que añada tu ID de Discord a tu perfil en el Panel de Staff.');
        }

        // 2. Check for Active Shift
        const { data: activeShift } = await supabase
            .from('time_logs')
            .select('id, clock_in')
            .eq('user_id', profile.id)
            .eq('status', 'active')
            .single();

        if (activeShift) {
            // CLOCK OUT
            const now = new Date();
            const clockIn = new Date(activeShift.clock_in);
            const durationMinutes = Math.round((now - clockIn) / 60000);

            const { error } = await supabase
                .from('time_logs')
                .update({
                    clock_out: now.toISOString(),
                    status: 'completed',
                    duration_minutes: durationMinutes
                })
                .eq('id', activeShift.id);

            if (error) {
                console.error(error);
                return interaction.editReply('❌ Error al cerrar turno.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🛑 Turno Finalizado')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Oficial', value: profile.full_name || 'Agente' },
                    { name: 'Duración', value: `${durationMinutes} minutos` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Optional: Log to public channel
            if (NOTIFICATION_CHANNEL_ID) {
                const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
                if (channel) channel.send({ embeds: [embed] });
            }

        } else {
            // CLOCK IN
            const { error } = await supabase
                .from('time_logs')
                .insert([{
                    user_id: profile.id,
                    clock_in: new Date().toISOString(),
                    status: 'active'
                }]);

            if (error) {
                console.error(error);
                return interaction.editReply('❌ Error al iniciar turno.');
            }

            const embed = new EmbedBuilder()
                .setTitle('🟢 Turno Iniciado')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Oficial', value: profile.full_name || 'Agente' },
                    { name: 'Hora', value: new Date().toLocaleTimeString() }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (NOTIFICATION_CHANNEL_ID) {
                const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
                if (channel) channel.send({ embeds: [embed] });
            }
        }
    }

    if (commandName === 'saldo') {
        // ... (Existing logic or placeholder) ...
        await interaction.reply({ content: 'Esta función estará disponible pronto.', ephemeral: true });
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

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
                    type: 1 // SUB_COMMAND
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

        if (subCmd === 'estado') {
            await interaction.deferReply({ ephemeral: true });

            // FIX: Query 'citizens' table instead of 'profiles' because credit_cards are linked to citizens.
            const { data: citizen } = await supabase.from('citizens').select('id').eq('discord_id', interaction.user.id).single();

            if (!citizen) {
                return interaction.editReply('❌ No tienes un ciudadano vinculado a tu Discord. Contacta a un administrador en el Panel.');
            }

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).eq('status', 'ACTIVE').single();

            if (!userCard) {
                return interaction.editReply('❌ No tienes una tarjeta activa actualmente.');
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 Estado de Cuenta: ${userCard.card_type}`)
                .setColor(0xD4AF37)
                .addFields(
                    { name: 'Deuda Actual', value: `$${userCard.current_debt.toLocaleString()}`, inline: true },
                    { name: 'Límite', value: `$${userCard.credit_limit.toLocaleString()}`, inline: true },
                    { name: 'Interés Semanal', value: `${userCard.interest_rate}%`, inline: true }
                )
                .setFooter({ text: 'El corte es cada domingo a medianoche.' });

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'pedir-prestamo') {
            await interaction.deferReply({ ephemeral: true });
            const amount = interaction.options.getNumber('monto');

            if (amount <= 0) return interaction.editReply('❌ El monto debe ser mayor a 0.');

            // 1. Find User (Citizen) & Card
            const { data: citizen } = await supabase.from('citizens').select('id, discord_id').eq('discord_id', interaction.user.id).single();
            if (!citizen) return interaction.editReply('❌ No tienes un ciudadano vinculado.');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).eq('status', 'ACTIVE').single();
            if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

            // 2. Validate Limit
            const availableCredit = userCard.credit_limit - userCard.current_debt;
            if (amount > availableCredit) {
                return interaction.editReply(`❌ **Fondos Insuficientes**. \nDisponible: $${availableCredit.toLocaleString()}`);
            }

            // 3. Process Transaction (DB Update + UnbelievaBoat Add Money)
            // Update DB
            const newDebt = userCard.current_debt + amount;
            const { error: dbError } = await supabase
                .from('credit_cards')
                .update({ current_debt: newDebt })
                .eq('id', userCard.id);

            if (dbError) {
                console.error(dbError);
                return interaction.editReply('❌ Error actualizando tu saldo en base de datos.');
            }

            // Update UnbelievaBoat
            const ubResult = await billingService.ubService.addMoney(GUILD_ID, interaction.user.id, amount, `Préstamo/Avance Tarjeta ${userCard.card_type}`);

            // Log Transaction
            await supabase.from('transaction_logs').insert([{
                card_id: userCard.id,
                discord_user_id: interaction.user.id,
                amount: amount,
                type: 'LOAN',
                status: ubResult.success ? 'SUCCESS' : 'PARTIAL_ERROR',
                metadata: ubResult
            }]);

            // Embed Reply
            const embed = new EmbedBuilder()
                .setTitle('💸 Préstamo Aprobado')
                .setColor(0x00FF00)
                .setDescription(`Se han depositado **$${amount.toLocaleString()}** en tu cuenta de efectivo.`)
                .addFields(
                    { name: 'Nueva Deuda', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: 'Crédito Restante', value: `$${(userCard.credit_limit - newDebt).toLocaleString()}`, inline: true },
                    { name: 'Instrucciones', value: 'El monto se cobrará automáticamente el próximo **Domingo**.' }
                )
                .setFooter({ text: 'Sistema Financiero Nacion MX' });

            if (!ubResult.success) {
                embed.setDescription(`✅ Deuda registrada, pero hubo un error enviando el dinero a UnbelievaBoat.\nError: ${ubResult.error}\nContacta a Staff.`);
                embed.setColor(0xFFA500);
            }

            await interaction.editReply({ embeds: [embed] });
        }

        else if (subCmd === 'pagar') {
            await interaction.deferReply({ ephemeral: true });
            const amount = interaction.options.getNumber('monto');

            if (amount <= 0) return interaction.editReply('❌ El monto debe ser mayor a 0.');

            // 1. Find User (Citizen) & Card
            const { data: citizen } = await supabase.from('citizens').select('id, discord_id').eq('discord_id', interaction.user.id).single();
            if (!citizen) return interaction.editReply('❌ No tienes cuenta vinculada (Citizen).');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', citizen.id).eq('status', 'ACTIVE').single();
            if (!userCard) return interaction.editReply('❌ No tienes una tarjeta activa.');

            if (amount > userCard.current_debt) {
                return interaction.editReply(`⚠️ Solo debes **$${userCard.current_debt.toLocaleString()}**. No puedes pagar más de lo que debes.`);
            }

            // 2. Take Money from UnbelievaBoat
            const ubResult = await billingService.ubService.removeMoney(GUILD_ID, interaction.user.id, amount, `Pago Tarjeta ${userCard.card_type}`);

            if (!ubResult.success) {
                return interaction.editReply(`❌ No se pudo procesar el pago. Posiblemente no tienes fondos suficientes en efectivo.\nError: ${ubResult.error}`);
            }

            // 3. Update DB
            const newDebt = userCard.current_debt - amount;
            const { error: dbError } = await supabase
                .from('credit_cards')
                .update({ current_debt: newDebt, last_payment_date: new Date().toISOString() })
                .eq('id', userCard.id);

            if (dbError) {
                console.error(dbError);
                return interaction.editReply('❌ Pago recibido en efectivo, pero error al actualizar BD. Contacta a Staff.');
            }

            // 4. Log
            await supabase.from('transaction_logs').insert([{
                card_id: userCard.id,
                discord_user_id: interaction.user.id,
                amount: amount,
                type: 'PAYMENT',
                status: 'SUCCESS',
                metadata: ubResult
            }]);

            // 5. Reply
            const embed = new EmbedBuilder()
                .setTitle('✅ Pago Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Has abonado **$${amount.toLocaleString()}** a tu tarjeta.`)
                .addFields(
                    { name: 'Deuda Restante', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: 'Crédito Disponible', value: `$${(userCard.credit_limit - newDebt).toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Sistema Financiero Nacion MX' });

            await interaction.editReply({ embeds: [embed] });
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
            const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('discord_id', targetUser.id).single();
            if (!profile) return interaction.editReply('❌ Este usuario no tiene perfil vinculado.');

            const { data: userCard } = await supabase.from('credit_cards').select('*').eq('citizen_id', profile.id).single();
            if (!userCard) return interaction.editReply('❌ Este usuario no tiene tarjeta.');

            if (subCmdAdmin === 'info') {
                const embed = new EmbedBuilder()
                    .setTitle(`📂 Info Bancaria: ${profile.full_name}`)
                    .setColor(0x0000FF)
                    .addFields(
                        { name: 'Tarjeta', value: userCard.card_type, inline: true },
                        { name: 'Estado', value: userCard.status, inline: true },
                        { name: 'Deuda', value: `$${userCard.current_debt.toLocaleString()}`, inline: true },
                        { name: 'Límite', value: `$${userCard.credit_limit.toLocaleString()}`, inline: true },
                        { name: 'Discord ID', value: targetUser.id, inline: true }
                    );
                await interaction.editReply({ embeds: [embed] });
            }

            else if (subCmdAdmin === 'perdonar') {
                await supabase.from('credit_cards').update({ current_debt: 0 }).eq('id', userCard.id);
                await supabase.from('transaction_logs').insert([{
                    card_id: userCard.id,
                    discord_user_id: targetUser.id,
                    amount: userCard.current_debt,
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
    }

    else if (commandName === 'fichar') {
        await interaction.deferReply({ ephemeral: true });
        const action = interaction.options.getString('accion');

        // 1. Find User by Discord ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('discord_id', interaction.user.id)
            .single();

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

client.login(process.env.DISCORD_TOKEN);

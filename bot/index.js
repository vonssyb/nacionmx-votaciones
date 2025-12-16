require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

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

client.once('ready', () => {
    console.log(`🤖 Bot iniciado como ${client.user.tag}!`);
    console.log(`📡 Conectado a Supabase: ${supabaseUrl}`);

    // Register basic slash commands
    const guildId = process.env.GUILD_ID; // Optional: for instant registration
    const commands = [
        {
            name: 'ping',
            description: 'Comprueba si el bot está vivo',
        },
        {
            name: 'saldo',
            description: 'Consulta el saldo de tu tarjeta (Beta)',
        },
        {
            name: 'fichar',
            description: 'Inicia o Termina tu turno (Entrada/Salida)',
        },
        {
            name: 'registrar-tarjeta',
            description: 'Enlace para solicitar tarjeta',
        }
    ];

    // Register global commands (takes ~1 hour) or Guild commands (instant)
    if (guildId) {
        client.guilds.cache.get(guildId)?.commands.set(commands);
    } else {
        client.application.commands.set(commands);
    }

    // Start listening to Supabase changes
    subscribeToNewCards();
});

// Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('¡Pong! 🏓 Estoy en línea y listo para trabajar.');
    }

    if (interaction.commandName === 'saldo') {
        await interaction.reply({ content: 'Esta función estará disponible pronto. Necesito vincular tu usuario de Discord con tu DNI.', ephemeral: true });
    }
});

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

const BOT_COMMANDS = [
    {
        name: 'ping',
        description: 'Comprueba si el bot está vivo',
    },
    {
        name: 'saldo',
        description: 'Consulta el saldo de tu tarjeta',
    },
    {
        name: 'fichar',
        description: 'Inicia o Termina tu turno (Entrada/Salida)',
    },
    {
        name: 'registrar-tarjeta',
        description: 'Obtén el enlace para solicitar tu tarjeta',
    }
];

// ... (Inside client.once) ...
// client.application.commands.set(BOT_COMMANDS);

// Interaction Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        await interaction.reply('¡Pong! 🏓 Estoy en línea.');
    }

    if (commandName === 'registrar-tarjeta') {
        const embed = new EmbedBuilder()
            .setTitle('🏦 Solicitar Tarjeta Nacion MX')
            .setDescription('Para solicitar tu tarjeta con foto y datos biométricos, accede a nuestro portal seguro:')
            .setColor(0xFFD700) // Gold
            .addFields({ name: 'Enlace', value: 'https://nacionmx-portal.onrender.com/dashboard/bank' }) // Adjust if needed
            .setFooter({ text: 'Sistema Bancario' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (commandName === 'fichar') {
        await interaction.deferReply({ ephemeral: true });

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

client.login(process.env.DISCORD_TOKEN);

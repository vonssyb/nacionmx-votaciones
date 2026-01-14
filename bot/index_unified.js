const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '.env')) ? path.join(__dirname, '.env') : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, EmbedBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const { handleModerationLegacy } = require('./handlers/legacyModerationHandler');

// --- LOGGING ---
const log = (prefix, msg) => console.log(`${prefix} ${msg}`);

// --- CONFIGURATION ---
const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
console.log(`🆔 BOT INSTANCE STARTED: ${INSTANCE_ID}`);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GLOBAL ERROR HANDLERS (Prevent Exit Code 1) ---
process.on('uncaughtException', (err) => {
    console.error('💥 [CRASH PREVENTION] Uncaught Exception:', err);
    // Keep process alive if possible, but log critical error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [CRASH PREVENTION] Unhandled Rejection at:', promise, 'reason:', reason);
});

// --- SHARED WEB SERVER (Health Check) ---
const app = express();
const port = process.env.PORT || 8000;

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Nacion MX Unified System</h1>
        <p>✅ Moderation Bot: Online</p>
        <p>✅ Economy Bot: Online</p>
        <p>✅ Government Bot: Online</p>
    `);
});

app.listen(port, () => {
    log('🌐', `Unified Server listening on port ${port}`);
});

// =============================================================================
// HELPER: SAFE DEFER
// =============================================================================
async function safeDefer(interaction, options = {}) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: options.ephemeral || false });
            // PATCH: Prevent double defer
            interaction.deferReply = async () => { };
            return true;
        }
        return true; // Already deferred/replied is considered "safe"
    } catch (e) {
        if (e.code === 10062 || e.message === 'Unknown interaction') {
            // Silently ignore "Unknown interaction" (Race condition or Timeout)
            return false;
        }
        console.error(`[Wrapper] Defer Failed (${interaction.commandName || 'component'}):`, e);
        return false;
    }
}

// =============================================================================
// 👮‍♂️ MODERATION BOT SETUP
// =============================================================================
async function startModerationBot() {
    log('👮‍♂️', 'Starting Moderation Bot...');
    const ErlcPollingService = require('./services/ErlcPollingService');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates // REQUIRED for voice
        ]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // --- AUDIT LOGGING ---
    client.logAudit = async (action, details, moderator, target, color = 0x00AAFF, files = [], channelId = null) => {
        try {
            const AUDIT_CHANNEL_ID = channelId || '1456035521141670066'; // Security/Sanctions (Default)
            const channel = await client.channels.fetch(AUDIT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(`🛡️ Auditoría: ${action}`)
                    .setColor(color)
                    .addFields(
                        { name: '👮 Staff', value: `${moderator.tag} (<@${moderator.id}>)`, inline: true },
                        { name: '👤 Usuario', value: target ? `${target.tag} (<@${target.id}>)` : 'N/A', inline: true },
                        { name: '📝 Detalles', value: details.length > 1020 ? details.substring(0, 1020) + '...' : details }
                    )
                    .setTimestamp();
                await channel.send({ embeds: [embed], files: files });
            }
        } catch (error) {
            console.error('[MOD] Audit Log Error:', error);
        }
    };

    // Services
    const SanctionService = require('./services/SanctionService');
    const BillingService = require('./services/BillingService');
    const DailyMissionManager = require('./services/DailyMissionManager');
    const CasinoService = require('./services/CasinoService');
    const StockService = require('./services/StockService');

    const sanctionService = new SanctionService(supabase);
    client.missionManager = new DailyMissionManager(supabase);

    // ERLC Scheduler (Offline Queue)
    const ErlcScheduler = require('./services/ErlcScheduler');
    const erlcScheduler = new ErlcScheduler(supabase, process.env.ERLC_API_KEY || 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp');
    erlcScheduler.start(3000000); // Check every 50 minutes (requested by user)

    // ERLC Service & Log Manager (Adaptive Polling)
    const ErlcService = require('./services/ErlcService');
    const erlcService = new ErlcService(process.env.ERLC_API_KEY || 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp');

    // Log Channel ID from legacy code: 1457892493310951444
    // ERLC Log Manager (General Logs to Channel)
    const ErlcLogManager = require('./services/ErlcLogManager');
    const erlcLogManager = new ErlcLogManager(client, supabase, erlcService, '1457892493310951444');
    erlcLogManager.start();

    // ERLC Command Poller (Voice Swarm Enabler)
    const VoiceSwarmService = require('./services/VoiceSwarmService');
    const swarmTokens = process.env.VOICE_SWARM_TOKENS ? process.env.VOICE_SWARM_TOKENS.split(',') : [];

    // Initialize Swarm
    const swarmService = new VoiceSwarmService(swarmTokens);
    swarmService.init().catch(err => console.error('❌ [Swarm] Init Failed:', err));

    const erlcPollingService = new ErlcPollingService(supabase, client, swarmService, erlcService);
    erlcPollingService.start();

    client.services = {
        sanctions: sanctionService,
        billing: new BillingService(client, supabase),
        casino: new CasinoService(supabase),
        stocks: new StockService(supabase),
        erlcScheduler: erlcScheduler,
        erlc: erlcService,
        erlcLogManager: erlcLogManager,
        erlcPolling: erlcPollingService,
        swarm: swarmService
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['moderation', 'utils', 'owner']);

    // AUTO-REGISTER COMMANDS (On Startup)
    const MOD_TOKEN = process.env.DISCORD_TOKEN_MOD;
    const MAIN_GUILD_ID = process.env.GUILD_ID;
    const STAFF_GUILD_ID = '1460059764494041211';

    const TARGET_GUILDS = [MAIN_GUILD_ID, STAFF_GUILD_ID].filter(id => id);

    if (MOD_TOKEN && TARGET_GUILDS.length > 0) {
        console.log(`🔄 [MOD] Auto-registering commands for ${TARGET_GUILDS.length} guilds...`);
        const rest = new REST({ version: '10' }).setToken(MOD_TOKEN);

        try {
            const currentUser = await rest.get(Routes.user('@me'));
            const clientId = currentUser.id;
            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            for (const guildId of TARGET_GUILDS) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId),
                        { body: allCommands }
                    );
                    console.log(`✅ [MOD] Registered ${allCommands.length} commands to Guild ID: ${guildId}`);
                } catch (guildError) {
                    console.error(`❌ [MOD] Failed to register commands for Guild ID ${guildId}:`, guildError);
                }
            }
        } catch (regError) {
            console.error('❌ [MOD] Critical Auto-registration failure:', regError);
        }
    }


    // Events
    client.once('ready', () => {
        log('🟢', `[MOD] Logged in as ${client.user.tag}`);
        // Register Mod bot as a drone
        if (swarmService) swarmService.registerClient(client, 'MOD');
    });



    // --- ENHANCED LOGGING (MAIN GUILD ONLY) ---
    const LOG_CHANNEL_ID = '1457457209268109516'; // Canal de Logs General

    client.on('messageDelete', async message => {
        if (!message.guild || message.author?.bot) return;
        const MAIN_GUILDS = [process.env.GUILD_ID, '1460059764494041211'];
        if (!MAIN_GUILDS.includes(message.guild.id)) return; // ONLY LOG MAIN SERVERS

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
            const files = [];

            // Handle Attachments (Re-upload)
            if (message.attachments.size > 0) {
                message.attachments.forEach(att => {
                    // Try using proxyURL as it lasts slightly longer, or url
                    files.push(new AttachmentBuilder(att.proxyURL || att.url, { name: att.name }));
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🗑️ Mensaje Eliminado [${INSTANCE_ID}]`)
                .setColor('#FF0000')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .addFields(
                    { name: 'Autor', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Contenido', value: message.content ? message.content.substring(0, 1024) : '*(Sin contenido de texto)*' }
                )
                .setFooter({ text: `ID: ${message.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed], files: files });

        } catch (err) {
            console.error('[MOD] Error logging delete:', err);
        }
    });

    // Welcome System (MULTI-SERVER AWARE)
    client.on('guildMemberAdd', async member => {
        const MAIN_GUILDS = [process.env.GUILD_ID, '1460059764494041211'];
        if (!MAIN_GUILDS.includes(member.guild.id)) return;

        try {
            let welcomeChannelId, message;
            const ImageGenerator = require('./utils/ImageGenerator');
            const { AttachmentBuilder } = require('discord.js');

            if (member.guild.id === process.env.GUILD_ID) {
                // ORIGINAL SERVER CONFIG
                welcomeChannelId = '1398887127789473835';
                const VERIFY_CHANNEL_ID = '1398887174585323550';
                const DNI_CHANNEL_ID = '1398887380202688654';
                message = `<@${member.user.id}> **bienvenido al servidor** para verificarse usa el comando \`/verificar\` en <#${VERIFY_CHANNEL_ID}> y también crea tu dni con el comando \`/dni crear\` en el canal de <#${DNI_CHANNEL_ID}> **¡Bienvenido!**`;
            } else if (member.guild.id === '1460059764494041211') {
                // NEW MAIN SERVER CONFIG
                welcomeChannelId = '1460059765437890560'; // Placeholder
                message = `<@${member.user.id}> **¡Bienvenido al servidor!** Nos alegra tenerte aquí. **¡Disfruta tu estancia!**`;

                // AUTO-DISCOVERY FALLBACK
                try {
                    const channels = await member.guild.channels.fetch();
                    const found = channels.find(ch => ch.type === 0 && ch.name.toLowerCase().includes('bienvenida'));
                    if (found) welcomeChannelId = found.id;
                } catch (e) { /* ignore */ }
            }

            const welcomeChannel = await client.channels.fetch(welcomeChannelId).catch(() => null);
            if (!welcomeChannel) return;

            // Generate Luxury Image
            const buffer = await ImageGenerator.generateWelcome(member);
            const attachment = new AttachmentBuilder(buffer, { name: `bienvenida_${member.user.id}.png` });

            await welcomeChannel.send({
                content: message,
                files: [attachment]
            });

        } catch (err) {
            console.error('[MOD] Error in welcome system:', err);
        }
    });

    // JOB/ROLE PROTECTION (Police vs Cartel)
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // Optimization: Quick check if roles size changed or strict equality
        if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

        // Ignore bots
        if (newMember.user.bot) return;

        try {
            const JobValidator = require('./services/JobValidator');
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;
            const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));

            // Only process if roles were added
            if (addedRoles.size === 0) return;

            // 1. Check Incompatible Roles (Police vs Cartel)
            if (JobValidator.hasIncompatibleRoles(newMember)) {
                // Conflict Detected
                console.log(`[MOD] 🛡️ Role Conflict detected for ${newMember.user.tag}. Removing conflicting roles.`);

                // Remove the newly added conflicting roles
                await newMember.roles.remove(addedRoles);

                // Notify User
                try {
                    await newMember.send('⚠️ **Conflicto de Roles**: No puedes pertenecer a una facción legal (Policía/Ejército) y una ilegal (Cartel) simultáneamente.\nSe ha revertido la asignación de rol.');
                } catch (e) { /* DM closed */ }

                // Log to Security Channel
                const LOG_CHANNEL_ID = '1457457209268109516';
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Conflicto de Roles Preventivo')
                        .setColor('#FF0000')
                        .setDescription(`Se intentó asignar un rol incompatible a <@${newMember.id}>.`)
                        .addFields(
                            { name: 'Usuario', value: `${newMember.user.tag}`, inline: true },
                            { name: 'Rol Intentado', value: addedRoles.map(r => r.name).join(', ') || 'Desconocido', inline: true }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
                return; // Stop further checks if conflict found
            }

            // 2. Check Principal Job Limits (Numerical)
            const limits = JobValidator.getLimits(newMember);
            const currentPrincipal = JobValidator.getPrincipalJobCount(newMember);

            if (currentPrincipal > limits.principal) {
                const prevPrincipal = JobValidator.getPrincipalJobCount(oldMember);
                if (currentPrincipal > prevPrincipal) {
                    console.log(`[MOD] 🛡️ Job Limit Exceeded for ${newMember.user.tag}. Limit: ${limits.principal}, Count: ${currentPrincipal}`);
                    await newMember.roles.remove(addedRoles);
                    try {
                        await newMember.send(`⚠️ **Límite de Trabajos Alcanzado**: Tu nivel de membresía actual (**${limits.tier}**) solo permite **${limits.principal}** trabajos principales (Gobierno/Cartel).\nActualiza tu membresía (Booster/Premium) para obtener más espacios.`);
                    } catch (e) { }
                }
            }


        } catch (err) {
            console.error('[MOD] Role Conflict Handler Error:', err);
        }
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        const MAIN_GUILDS = [process.env.GUILD_ID, '1460059764494041211'];
        if (!MAIN_GUILDS.includes(oldMessage.guild.id)) return; // ONLY LOG MAIN SERVERS
        if (oldMessage.content === newMessage.content) return; // Ignore embed updates

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const { EmbedBuilder } = require('discord.js');

            const embed = new EmbedBuilder()
                .setTitle(`✏️ Mensaje Editado [${INSTANCE_ID}]`)
                .setColor('#FFA500')
                .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
                .setDescription(`[Ir al mensaje](${newMessage.url})`)
                .addFields(
                    { name: 'Autor', value: `<@${oldMessage.author.id}>`, inline: true },
                    { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
                    { name: 'Antes', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*(Vacío)*' },
                    { name: 'Después', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*(Vacío)*' }
                )
                .setFooter({ text: `ID: ${newMessage.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });

        } catch (err) {
            console.error('[MOD] Error logging update:', err);
        }
    });

    // --- VC AUTO-DISCONNECT ---
    const vcDisconnectTimers = new Map(); // channelId -> Timeout

    client.on('voiceStateUpdate', (oldState, newState) => {
        // We only care if the bot is involved or if it affects the bot's channel
        const botId = client.user.id;
        const botVoice = oldState.guild.members.me.voice;

        // If bot is not connected, ignore
        if (!botVoice.channelId) return;

        const channel = botVoice.channel;
        if (!channel) return;

        // Check if the channel is now empty (excluding bots)
        // Note: voice.channel.members includes the bot itself
        const humans = channel.members.filter(m => !m.user.bot);

        if (humans.size === 0) {
            // Channel is empty (only bots or just me)
            if (!vcDisconnectTimers.has(channel.id)) {
                console.log(`[VC] ⏳ Channel ${channel.name} empty. Disconnecting in 20s...`);
                const timeout = setTimeout(() => {
                    if (botVoice.channelId === channel.id) { // Still in same channel?
                        const currentHumans = channel.members.filter(m => !m.user.bot);
                        if (currentHumans.size === 0) {
                            console.log(`[VC] 🔌 Disconnecting from ${channel.name} due to inactivity.`);
                            const { getVoiceConnection } = require('@discordjs/voice');
                            const connection = getVoiceConnection(oldState.guild.id);
                            if (connection) connection.destroy();
                        }
                    }
                    vcDisconnectTimers.delete(channel.id);
                }, 20000); // 20 seconds
                vcDisconnectTimers.set(channel.id, timeout);
            }
        } else {
            // Channel is not empty, cancel any pending timer
            if (vcDisconnectTimers.has(channel.id)) {
                console.log(`[VC] 👤 User joined ${channel.name}. Cancelling disconnect timer.`);
                clearTimeout(vcDisconnectTimers.get(channel.id));
                vcDisconnectTimers.delete(channel.id);
            }
        }
    });

    // --- REALTIME APPLICATION MONITOR ---
    function initRealtimeMonitor(client, supabase) {
        log('🛡️', 'Realtime Application Monitor started.');

        const channel = supabase
            .channel('applications_db_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to ALL events (INSERT + UPDATE)
                    schema: 'public',
                    table: 'applications',
                },
                async (payload) => {
                    // HANDLE NEW APPLICATIONS
                    if (payload.eventType === 'INSERT') {
                        log('📨', 'New staff application detected!');
                        const app = payload.new;
                        const NOTIFY_CHANNEL_ID = '1456035521141670066'; // Security/Sanctions or Opos Channel
                        const targetChannel = await client.channels.fetch(NOTIFY_CHANNEL_ID).catch(() => null);

                        if (targetChannel) {
                            const { EmbedBuilder } = require('discord.js');
                            const embed = new EmbedBuilder()
                                .setTitle('📜 Nueva Solicitud de Staff (Opos)')
                                .setColor('#FFD700')
                                .setThumbnail('https://i.imgur.com/8QG5BZr.png') // Nación MX Logo
                                .addFields(
                                    { name: '👤 Candidato', value: `${app.applicant_username}`, inline: true },
                                    { name: '📝 Tipo', value: `${app.type}`, inline: true },
                                    { name: '📅 Fecha', value: new Date(app.created_at).toLocaleString(), inline: true },
                                    { name: '🔗 Enlace Administrativo', value: '[Ir al Panel de Opos](https://gonzalez-puebla.github.io/nacionmx-portal/dashboard/applications)' }
                                )
                                .setDescription('Se ha recibido una nueva postulación desde el portal web. Por favor revisa los detalles en el panel administrativo.')
                                .setFooter({ text: 'Nación MX Portal System • Realtime Monitor' })
                                .setTimestamp();

                            await targetChannel.send({ content: '🔔 **@everyone ¡Atención Mandos! Nueva postulación recibida.**', embeds: [embed] });
                        }
                    }

                    // HANDLE APPROVED APPLICATIONS (Role Assignment)
                    if (payload.eventType === 'UPDATE') {
                        const newRecord = payload.new;
                        const oldRecord = payload.old;

                        // Check if status changed to 'approved'
                        if (newRecord.status === 'approved') {
                            console.log(`[APP] ✅ Application approved for ${newRecord.applicant_username} (${newRecord.applicant_discord_id})`);

                            // DEFAULT FALLBACKS
                            let STAFF_GUILD_ID = '1460059764494041211';
                            let ROLES_TO_ADD = [
                                '1460678189104894138',
                                '1460071124074233897',
                                '1460074363708768391'
                            ];

                            try {
                                // FETCH DYNAMIC CONFIG
                                const { data: settings } = await supabase
                                    .from('bot_settings')
                                    .select('*')
                                    .in('key', ['staff_approval_roles', 'staff_guild_id']);

                                if (settings) {
                                    const guildConf = settings.find(s => s.key === 'staff_guild_id');
                                    const rolesConf = settings.find(s => s.key === 'staff_approval_roles');

                                    if (guildConf && guildConf.value) STAFF_GUILD_ID = guildConf.value;
                                    if (rolesConf && Array.isArray(rolesConf.value)) ROLES_TO_ADD = rolesConf.value;

                                    console.log(`[APP] ⚙️ Loaded config: Guild=${STAFF_GUILD_ID}, Roles=${ROLES_TO_ADD.length}`);
                                }
                            } catch (confError) {
                                console.error('[APP] ⚠️ Error loading settings, using defaults:', confError.message);
                            }

                            try {
                                const guild = await client.guilds.fetch(STAFF_GUILD_ID).catch(() => null);
                                if (!guild) {
                                    console.error(`[APP] ❌ Staff Guild (${STAFF_GUILD_ID}) not found!`);
                                    return;
                                }

                                const member = await guild.members.fetch(newRecord.applicant_discord_id).catch(() => null);
                                if (!member) {
                                    console.error(`[APP] ❌ Member (${newRecord.applicant_discord_id}) not found in Staff Guild!`);
                                    return;
                                }

                                await member.roles.add(ROLES_TO_ADD);
                                console.log(`[APP] 🎉 Roles assigned to ${member.user.tag} in Staff Guild.`);

                                // Optional: Log success to a channel
                                const LOG_CHANNEL_ID = '1456035521141670066'; // Reuse security channel
                                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
                                if (logChannel) {
                                    const { EmbedBuilder } = require('discord.js');
                                    const embed = new EmbedBuilder()
                                        .setTitle('✅ Staff Aceptado (Auto-Rol)')
                                        .setColor('#2ecc71')
                                        .setDescription(`El usuario **${member.user.tag}** ha sido aprobado en el portal.`)
                                        .addFields(
                                            { name: 'Roles Asignados', value: `${ROLES_TO_ADD.length} roles` },
                                            { name: 'Procesado por', value: newRecord.processed_by || 'Admin' }
                                        )
                                        .setTimestamp();
                                    logChannel.send({ embeds: [embed] });
                                }

                            } catch (err) {
                                console.error('[APP] 💥 Error assigning roles:', err);
                            }
                        }
                    }
                }
            )
            .subscribe();

        return channel;
    }

    // Interaction Handler
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) {
            try {
                // FALLBACK TO LEGACY (Handles Buttons, Modals, Menus)
                await handleModerationLegacy(interaction, client, client.supabase);
            } catch (e) {
                console.error('[MOD] Legacy Handler Error:', e);
            }
            return;
        }

        const ephemeralCommands = ['vc', '911', 'talk'];
        const isEphemeral = ephemeralCommands.includes(interaction.commandName);

        // GLOBAL SAFE DEFER
        if (!await safeDefer(interaction, { ephemeral: isEphemeral })) return;

        // COMMAND LOGGING
        if (isEphemeral) {
            try {
                const logChannelId = '1460022042622558391';
                const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const options = interaction.options.data.map(opt => `**${opt.name}**: ${opt.value}`).join('\n') || 'Sin opciones';
                    const embed = new EmbedBuilder()
                        .setTitle(`📝 Comando Usado: /${interaction.commandName}`)
                        .setColor('#0099ff')
                        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                        .addFields(
                            { name: 'Usuario', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Canal', value: `<#${interaction.channel.id}>`, inline: true },
                            { name: 'Parámetros', value: options }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (logErr) {
                console.error('[LOG] Error logging command:', logErr);
            }
        }

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction, client, supabase);
            } catch (e) {
                console.error('[MOD] Command Error:', e);
                const msg = '❌ Error fatal ejecutando el comando.';
                if (interaction.replied || interaction.deferred) await interaction.editReply(msg).catch(() => { });
                else await interaction.reply({ content: msg, ephemeral: true }).catch(() => { });
            }
        }
    });

    // Login with Retry
    const TOKEN = process.env.DISCORD_TOKEN_MOD;
    if (!TOKEN) return log('❌', '[MOD] No Token Found');

    loginWithRetry(client, TOKEN, 'MOD');

    // Start Realtime monitor once client is ready
    client.once('ready', () => {
        initRealtimeMonitor(client, supabase);
    });
}

// =============================================================================
// 💰 ECONOMY BOT SETUP
// =============================================================================
async function startEconomyBot() {
    log('💰', 'Starting Economy Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Services
    const LevelService = require('./services/LevelService');
    const MissionService = require('./services/MissionService');
    const AchievementService = require('./services/AchievementService');
    const StoreService = require('./services/StoreService');
    const BillingService = require('./services/BillingService');
    const TaxService = require('./services/TaxService');
    const CompanyService = require('./services/CompanyService');
    const StakingService = require('./services/StakingService');
    const SlotsService = require('./services/SlotsService');

    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const storeService = new StoreService(supabase);

    // Billing Service (Safe Instantiation)
    let billingService;
    try { billingService = new BillingService(client, supabase); } catch (e) { console.error('Eco Billing Error:', e); }

    // Exchange Rate Service
    const ExchangeRateService = require('./services/ExchangeRateService');
    const CasinoService = require('./services/CasinoService');
    const StockService = require('./services/StockService');

    const casinoService = new CasinoService(supabase);
    const stockService = new StockService(supabase);

    client.services = {
        billing: billingService,
        tax: new TaxService(supabase),
        company: new CompanyService(supabase),
        staking: new StakingService(supabase),
        slots: new SlotsService(supabase),
        levels: levelService,
        achievements: achievementService,
        missions: missionService,
        store: storeService,
        casino: casinoService,
        stocks: stockService,
        exchangeRate: new ExchangeRateService(supabase)
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games']);

    // AUTO-REGISTER COMMANDS (On Startup)
    const ECO_TOKEN = process.env.DISCORD_TOKEN_ECO;
    const MAIN_GUILD_ID = process.env.GUILD_ID;
    const STAFF_GUILD_ID = '1460059764494041211';

    const TARGET_GUILDS = [MAIN_GUILD_ID, STAFF_GUILD_ID].filter(id => id);

    if (ECO_TOKEN && TARGET_GUILDS.length > 0) {
        console.log(`🔄 [ECO] Auto-registering commands for ${TARGET_GUILDS.length} guilds...`);
        const rest = new REST({ version: '10' }).setToken(ECO_TOKEN);

        try {
            const currentUser = await rest.get(Routes.user('@me'));
            const clientId = currentUser.id;
            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            for (const guildId of TARGET_GUILDS) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId),
                        { body: allCommands }
                    );
                    console.log(`✅ [ECO] Registered ${allCommands.length} commands to Guild ID: ${guildId}`);
                } catch (guildError) {
                    console.error(`❌ [ECO] Failed to register commands for Guild ID ${guildId}:`, guildError);
                }
            }
        } catch (regError) {
            console.error('❌ [ECO] Critical Auto-registration failure:', regError);
        }
    }


    // Legacy Support
    const { handleEconomyLegacy } = require('./handlers/legacyEconomyHandler');
    client.legacyHandler = handleEconomyLegacy;

    // Events
    client.once('ready', () => {
        const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
        log('🟢', `[ECO] Logged in as ${client.user.tag}`);

        // Register Eco bot as a drone
        const swarm = client.services && client.services.swarm;
        if (swarm) swarm.registerClient(client, 'ECO');
    });

    client.on('interactionCreate', async interaction => {
        // Handle Buttons
        if (interaction.isButton() && interaction.customId.startsWith('buy_item_')) {
            await client.services.store.handleBuyButton(interaction);
            return;
        }
        // Handle Commands
        if (interaction.isChatInputCommand()) {
            if (!await safeDefer(interaction)) return;
        }

        const command = interaction.isChatInputCommand() ? client.commands.get(interaction.commandName) : null;
        if (command) {
            try { await command.execute(interaction, client, supabase); } catch (e) {
                console.error('[ECO] Command Error:', e);
                await interaction.editReply('❌ Error ejecutando comando.').catch(() => { });
            }
        } else if (client.legacyHandler) {
            // FALLBACK TO LEGACY (Handles Buttons, Modals, Menus not caught above)
            try { await client.legacyHandler(interaction, client, supabase); } catch (e) {
                console.error('[ECO] Legacy Error:', e);
                // Don't reply here as legacy handler might have handled it or it's an unrelated interaction
            }
        }
    });

    // Login
    const TOKEN = process.env.DISCORD_TOKEN_ECO;
    if (!TOKEN) return log('❌', '[ECO] No Token Found');

    loginWithRetry(client, TOKEN, 'ECO');
}

// =============================================================================
// 🏛️ GOVERNMENT BOT SETUP
// =============================================================================
async function startGovernmentBot() {
    log('🏛️', 'Starting Government Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Services
    const LevelService = require('./services/LevelService');
    const MissionService = require('./services/MissionService');
    const AchievementService = require('./services/AchievementService');
    const BillingService = require('./services/BillingService');
    const ExchangeService = require('./services/ExchangeService');

    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const billingService = new BillingService(client, supabase);
    const exchangeService = new ExchangeService(supabase, billingService.ubService);

    client.services = {
        levels: levelService,
        missions: missionService,
        achievements: achievementService,
        billing: billingService,
        exchange: exchangeService
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['gov']);

    // AUTO-REGISTER COMMANDS (On Startup)
    // AUTO-REGISTER COMMANDS (On Startup)
    const GOV_TOKEN = process.env.DISCORD_TOKEN_GOV;
    const MAIN_GUILD_ID = process.env.GUILD_ID;
    const STAFF_GUILD_ID = '1460059764494041211'; // Staff/New Main Server

    const TARGET_GUILDS = [MAIN_GUILD_ID, STAFF_GUILD_ID].filter(id => id); // Filter out undefined

    if (GOV_TOKEN && TARGET_GUILDS.length > 0) {
        console.log(`🔄 Auto-registering Gov commands for ${TARGET_GUILDS.length} guilds...`);
        const rest = new REST({ version: '10' }).setToken(GOV_TOKEN);

        try {
            const currentUser = await rest.get(Routes.user('@me'));
            const clientId = currentUser.id;
            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            for (const guildId of TARGET_GUILDS) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(clientId, guildId),
                        { body: allCommands }
                    );
                    console.log(`✅ Registered ${allCommands.length} Gov commands to Guild ID: ${guildId}`);
                } catch (guildError) {
                    console.error(`❌ Failed to register commands for Guild ID ${guildId}:`, guildError);
                }
            }
        } catch (regError) {
            console.error('❌ Critical Auto-registration failure:', regError);
        }
    }

    // Events
    client.once('ready', () => {
        const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
        log('🟢', `[GOV] Logged in as ${client.user.tag}`);

        // Register Gov bot as a drone
        const swarm = client.services && client.services.swarm;
        if (swarm) swarm.registerClient(client, 'GOV');
    });

    client.on('interactionCreate', async interaction => {
        // Handle button interactions
        if (interaction.isButton() && interaction.customId.startsWith('visa_pay_')) {
            const visaPaymentHandler = require('./handlers/visaPaymentHandler');
            try {
                await visaPaymentHandler.execute(interaction, client, interaction.customId);
            } catch (error) {
                console.error('[GOV] Visa Payment Error:', error);
                await interaction.editReply({ content: '❌ Error processing payment.', components: [] }).catch(() => { });
            }
            return;
        }

        // Handle emergency response button
        if (interaction.isButton() && interaction.customId.startsWith('emergency_respond_')) {
            const emergencyId = interaction.customId.split('_')[2];
            await interaction.deferUpdate();

            try {
                const { data: emergency } = await supabase
                    .from('emergency_calls')
                    .select('*')
                    .eq('id', emergencyId)
                    .single();

                if (!emergency) {
                    return interaction.followUp({ content: '❌ No se encontró la emergencia.', ephemeral: true });
                }

                // Update database (only if it was pending, to mark the first responder)
                if (emergency.status === 'pending') {
                    await supabase
                        .from('emergency_calls')
                        .update({
                            status: 'responding',
                            responder_discord_id: interaction.user.id,
                            responder_name: interaction.user.tag,
                            responded_at: new Date().toISOString()
                        })
                        .eq('id', emergencyId);
                }

                // Update embed to list multiple responders
                const oldEmbed = interaction.message.embeds[0];
                const embed = EmbedBuilder.from(oldEmbed).setColor(0xFFA500); // Orange

                // Find or create "Unidades en Camino" field
                let fields = [...oldEmbed.fields];
                let unitsField = fields.find(f => f.name === '🚔 Unidades en Camino');

                if (unitsField) {
                    // Check if user is already in the list
                    if (unitsField.value.includes(interaction.user.id)) {
                        return interaction.followUp({ content: '⚠️ Ya estás en camino a esta emergencia.', ephemeral: true });
                    }
                    unitsField.value += `\n- <@${interaction.user.id}>`;
                } else {
                    fields.push({ name: '🚔 Unidades en Camino', value: `- <@${interaction.user.id}>`, inline: false });
                }

                embed.setFields(fields);

                await interaction.message.edit({
                    embeds: [embed]
                    // components stay there for more people to join
                });

                await interaction.followUp({
                    content: `✅ Te has unido a la emergencia ${emergencyId}.`,
                    ephemeral: true
                });

                console.log(`[ERLC] Emergency ${emergencyId} joined by ${interaction.user.tag}`);

            } catch (error) {
                console.error('[ERLC] Emergency respond error:', error);
                await interaction.followUp({ content: '❌ Error al unirse a la emergencia.', ephemeral: true });
            }
            return;
        }

        // Handle payment accept button
        if (interaction.isButton() && interaction.customId.startsWith('payment_accept_')) {
            const requestId = interaction.customId.split('_')[2];
            await interaction.deferUpdate();

            try {
                const { data: request } = await supabase
                    .from('payment_requests')
                    .select('*')
                    .eq('id', requestId)
                    .single();

                if (!request || request.status !== 'pending') {
                    return interaction.followUp({ content: '❌ Esta solicitud ya fue procesada o expiró.', ephemeral: true });
                }

                if (request.debtor_discord_id !== interaction.user.id) {
                    return interaction.followUp({ content: '❌ Esta solicitud no es para ti.', ephemeral: true });
                }

                // Check balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if ((balance.cash || 0) < request.amount) {
                    return interaction.followUp({
                        content: `❌ Fondos insuficientes. Necesitas: $${request.amount.toLocaleString()}, tienes: $${(balance.cash || 0).toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Execute payment
                await billingService.ubService.removeMoney(
                    interaction.guildId,
                    request.debtor_discord_id,
                    request.amount,
                    `[ERLC Cobro] ${request.concept}`,
                    'cash'
                );

                await billingService.ubService.addMoney(
                    interaction.guildId,
                    request.requester_discord_id,
                    request.amount,
                    `[ERLC Cobro] De ${request.debtor_roblox}`,
                    'cash'
                );

                // Update request status
                await supabase
                    .from('payment_requests')
                    .update({
                        status: 'accepted',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', requestId);

                // Log transaction
                await supabase.from('erlc_transactions').insert({
                    transaction_type: 'charge',
                    sender_roblox: request.debtor_roblox,
                    sender_discord_id: request.debtor_discord_id,
                    receiver_roblox: request.requester_roblox,
                    receiver_discord_id: request.requester_discord_id,
                    amount: request.amount,
                    concept: request.concept
                });

                // Update embed
                const oldEmbed = interaction.message.embeds[0];
                const embed = EmbedBuilder.from(oldEmbed)
                    .setColor(0x00FF00) // Green
                    .setFooter({ text: `✅ PAGADO | ID: ${requestId}` });

                await interaction.message.edit({ embeds: [embed], components: [] });

                await interaction.followUp({
                    content: `✅ Pagaste $${request.amount.toLocaleString()} a <@${request.requester_discord_id}>`,
                    ephemeral: true
                });

                // Notify requester
                const requester = await interaction.guild.members.fetch(request.requester_discord_id);
                await requester.send(`💰 <@${interaction.user.id}> aceptó tu cobro de $${request.amount.toLocaleString()}. Concepto: ${request.concept}`).catch(() => { });

                console.log(`[ERLC] Payment request ${requestId} accepted`);

            } catch (error) {
                console.error('[ERLC] Payment accept error:', error);
                await interaction.followUp({ content: '❌ Error procesando pago.', ephemeral: true });
            }
            return;
        }

        // Handle payment reject button
        if (interaction.isButton() && interaction.customId.startsWith('payment_reject_')) {
            const requestId = interaction.customId.split('_')[2];
            await interaction.deferUpdate();

            try {
                const { data: request } = await supabase
                    .from('payment_requests')
                    .select('*')
                    .eq('id', requestId)
                    .single();

                if (!request || request.status !== 'pending') {
                    return interaction.followUp({ content: '❌ Esta solicitud ya fue procesada o expiró.', ephemeral: true });
                }

                if (request.debtor_discord_id !== interaction.user.id) {
                    return interaction.followUp({ content: '❌ Esta solicitud no es para ti.', ephemeral: true });
                }

                // Update request status
                await supabase
                    .from('payment_requests')
                    .update({
                        status: 'rejected',
                        resolved_at: new Date().toISOString()
                    })
                    .eq('id', requestId);

                // Update embed
                const oldEmbed = interaction.message.embeds[0];
                const embed = EmbedBuilder.from(oldEmbed)
                    .setColor(0xFF0000) // Red
                    .setFooter({ text: `❌ RECHAZADO | ID: ${requestId}` });

                await interaction.message.edit({ embeds: [embed], components: [] });

                await interaction.followUp({ content: '❌ Rechazaste la solicitud de cobro.', ephemeral: true });

                // Notify requester
                const requester = await interaction.guild.members.fetch(request.requester_discord_id);
                await requester.send(`❌ <@${interaction.user.id}> rechazó tu cobro de $${request.amount.toLocaleString()}. Concepto: ${request.concept}`).catch(() => { });

                console.log(`[ERLC] Payment request ${requestId} rejected`);

            } catch (error) {
                console.error('[ERLC] Payment reject error:', error);
                await interaction.followUp({ content: '❌ Error procesando rechazo.', ephemeral: true });
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        // GLOBAL SAFE DEFER
        if (!await safeDefer(interaction)) return;

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try { await command.execute(interaction, client, supabase); } catch (e) {
                console.error('[GOV] Command Error:', e);
                await interaction.editReply('❌ Error ejecutando comando.').catch(() => { });
            }
        }
    });

    // Login
    const TOKEN = process.env.DISCORD_TOKEN_GOV;
    if (!TOKEN) return log('❌', '[GOV] No Token Found');

    loginWithRetry(client, TOKEN, 'GOV');
}

// =============================================================================
// HELPER: ROBUST LOGIN
// =============================================================================
async function loginWithRetry(client, token, botName) {
    try {
        await client.login(token);
    } catch (error) {
        console.error(`❌ [${botName}] Login Failed:`, error.message);
        setTimeout(() => loginWithRetry(client, token, botName), 10000);
    }
}

// =============================================================================
// 🚀 LAUNCH ALL
// =============================================================================
// =============================================================================
// 🚀 LAUNCH ALL
// =============================================================================
(async () => {
    try {
        // --- SINGLE INSTANCE LOCK ---
        const SingleInstanceLock = require('./services/SingleInstanceLock');
        const locker = new SingleInstanceLock(supabase, INSTANCE_ID);

        // WAIT FOR LOCK (Do not exit, as that fails Health Checks)
        let acquired = await locker.acquireLock();
        let attempts = 0;
        const MAX_ATTEMPTS = 9; // 9 * 5s = 45s (Reduced from 2m)

        if (!acquired) {
            console.log(`⏳ [Startup] Another instance is active. Waiting for lock... (Max 45s)`);

            while (!acquired && attempts < MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
                acquired = await locker.acquireLock();
                attempts++;

                if (acquired) {
                    console.log(`🔓 [Startup] Lock acquired! Starting bots...`);
                    break;
                }
            }

            if (!acquired) {
                console.warn(`⚠️ [Startup] Lock TIMEOUT (${MAX_ATTEMPTS * 5}s). Force starting anyway...`);
            }
        }

        // Lock acquired, proceed
        await startModerationBot();
        await startEconomyBot();
        await startGovernmentBot();
        log('🚀', 'All Initialization Functions Called');
    } catch (error) {
        console.error('💥 FATAL UNIFIED CRASH:', error);
    }
})();
console.log('[SYSTEM] Koyeb Log Test: ERLC Persistence System Active');

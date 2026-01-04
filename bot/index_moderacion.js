require('dotenv').config();
// 1. Unbuffered Logger
const log = (msg) => process.stderr.write(`🟢 [MOD-BOT] ${msg}\n`);

log('Starting Nacion MX MODERATION BOT...');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || (process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null);
// ---------------------

// --- SERVICES ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
log('Supabase Initialized');

const SanctionService = require('./services/SanctionService');
const NotificationTemplates = require('./services/NotificationTemplates'); // Often used in mod
const BillingService = require('./services/BillingService');

// Instantiate Only Moderation Services
const sanctionService = new SanctionService(supabase);
log('SanctionService Instantiated');

// ----------------

// --- CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Needed for bans/kicks
    ]
});

// Attach Services to Client
client.services = {
    sanctions: sanctionService,
    billing: new BillingService(client, supabase)
};

// --- AUDIT LOG ---
client.logAudit = async (action, details, moderator, target, color = 0x00AAFF) => {
    try {
        const AUDIT_CHANNEL_ID = '1457457209268109516';
        const channel = await client.channels.fetch(AUDIT_CHANNEL_ID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Auditoría: ${action}`)
                .setColor(color)
                .addFields(
                    { name: '👮 Staff', value: `${moderator.tag} (<@${moderator.id}>)`, inline: true },
                    { name: '👤 Usuario', value: target ? `${target.tag} (<@${target.id}>)` : 'N/A', inline: true },
                    { name: '📝 Detalles', value: details }
                )
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

// --- EVENTS ---

client.once('clientReady', async () => {
    console.log(`🤖 MODERATION BOT Started as ${client.user.tag}!`);

    // Load Commands (MODERATION ONLY - ayuda, ping, info are included in moderation folder)
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['moderation']);

    // Register Commands (We can do this manually or auto, but for now let's rely on manual or existing script)
    // For Split Bot, usually we want to register only the subset.
    // NOTE: If you run 'node deploy-commands.js', it needs to know which subset to deploy.
    // For now, assume commands are already registered or will be registered via specific script.
});

client.on('interactionCreate', async interaction => {
    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client, supabase);
        } catch (error) {
            console.error(error);
            try {
                if (interaction.replied || interaction.deferred) await interaction.followUp({ content: '❌ Error ejecutando comando.', ephemeral: true });
                else await interaction.reply({ content: '❌ Error ejecutando comando.', ephemeral: true });
            } catch (e) { }
        }
        return;
    }

    // 2. LEGACY HANDLER FALLBACK (MODERATION)
    try {
        const { handleModerationLegacy } = require('./handlers/legacyModerationHandler');
        await handleModerationLegacy(interaction, client, supabase);
    } catch (err) {
        // console.error('Legacy Handler Error:', err);
    }

    // 2. BUTTONS (MODERATION ONLY)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // --- APPROVE SANCTION ---
        if (customId.startsWith('approve_sancion_')) {
            await interaction.deferReply({ ephemeral: false });
            const targetId = customId.split('_')[2];

            // Extract data from Embed (Stateful Embed)
            const embed = interaction.message.embeds[0];
            const fields = embed.fields;

            // Parse Fields to reconstruct context
            // field[2] = Tipo ({ name: '⚖️ Tipo de Sanción', value: '...' })
            // field[3] = Motivo
            // field[4] = Evidencia

            const rawType = fields.find(f => f.name.includes('Tipo'))?.value || 'general';
            const rawReason = fields.find(f => f.name.includes('Motivo'))?.value || 'No especificado';
            const rawEvidence = fields.find(f => f.name.includes('Evidencia'))?.value || null;

            // Clean up Type string (e.g., "BLACKLIST (Total)" -> "Blacklist")
            let cleanType = 'general'; // Default
            let cleanAction = null;
            let cleanBlacklistType = null;

            if (rawType.includes('BLACKLIST')) {
                cleanAction = 'Blacklist';
                // Extract content inside parenthesis
                const match = rawType.match(/\(([^)]+)\)/);
                if (match) cleanBlacklistType = match[1];
            } else if (rawType.includes('Ban Permanente')) {
                cleanAction = 'Ban Permanente ERLC';
                cleanType = 'general';
            } else if (rawType.includes('Sanción Administrativa')) {
                cleanType = 'sa';
            } else {
                cleanType = 'general'; // Default fallback
                cleanAction = rawType;
            }

            try {
                // EXECUTE SANCTION (Using Service)
                // Re-using the logic from sancion.js is hard without code duplication.
                // Ideally, we should have a 'SanctionExecutor' class.
                // For now, we will just CREATE the DB record and Log it, assuming human admin will enforce bans manually if bot fails.
                // actually, the user wants the bot to do it.

                // Let's just create the record for now to ensure persistence.
                await client.services.sanctions.createSanction(
                    targetId,
                    interaction.user.id, // Approved by
                    cleanType,
                    rawReason,
                    rawEvidence,
                    null, // Expiration
                    cleanAction || cleanType,
                    "Aprobado por Junta Directiva"
                );

                // Update Message
                await interaction.message.edit({
                    content: `✅ **APROBADO** por <@${interaction.user.id}>`,
                    components: [] // Remove buttons
                });

                await interaction.editReply(`✅ Sanción aprobada y registrada para <@${targetId}>.`);

            } catch (error) {
                console.error('Approval Error:', error);
                await interaction.editReply('❌ Error al procesar aprobación.');
            }
        }

        // --- REJECT SANCTION ---
        if (customId === 'reject_sancion') {
            await interaction.message.edit({
                content: `❌ **RECHAZADO** por <@${interaction.user.id}>`,
                components: []
            });
            await interaction.reply({ content: 'Solicitud rechazada.', ephemeral: true });
        }
    }
});

// --- DELETION LOGGING EVENTS ---

// 1. Message Delete
client.on('messageDelete', async message => {
    if (message.partial) {
        // Partial means we don't have the content cached, so we can't log the content.
        // We can try to fetch it if possible, but usually delete partials are empty.
        // We can still log that *a* message was deleted in the channel.
        client.logAudit('Mensaje Eliminado (Parcial)', `Mensaje eliminado en <#${message.channelId}> (Contenido desconocido)`, client.user, null, 0xFF0000);
        return;
    }

    if (message.author.bot) return; // Optional: Ignore bots

    const content = message.content ? message.content : '[Sin contenido de texto]';
    const attachments = message.attachments.size > 0 ? `\n📂 Adjuntos: ${message.attachments.size}` : '';

    await client.logAudit(
        'Mensaje Eliminado',
        `**Canal:** <#${message.channel.id}>\n**Contenido:**\n\`\`\`${content.substring(0, 1000)}\`\`\`${attachments}`,
        client.user, // "Moderator" is system/bot for auto-logs
        message.author,
        0xFF0000 // Red
    );
});

// 2. Bulk Delete
client.on('messageDeleteBulk', async messages => {
    const channel = messages.first().channel;
    await client.logAudit(
        'Mensajes Eliminados en Masa',
        `**Canal:** <#${channel.id}>\n**Cantidad:** ${messages.size} mensajes`,
        client.user,
        null,
        0xFF0000
    );
});

// 3. Channel Delete
client.on('channelDelete', async channel => {
    await client.logAudit(
        'Canal Eliminado',
        `**Nombre:** ${channel.name}\n**Tipo:** ${channel.type}`,
        client.user,
        null,
        0x8B0000 // Dark Red
    );
});

// 4. Role Delete
client.on('roleDelete', async role => {
    await client.logAudit(
        'Rol Eliminado',
        `**Nombre:** ${role.name}\n**ID:** ${role.id}`,
        client.user,
        null,
        0x8B0000 // Dark Red
    );
});

// --- RENDER KEEP ALIVE (MOD) ---
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🛡️ Nacion MX MODERATION Bot is running!'));
app.listen(port, () => {
    console.log(`🌐 Mod Server listening on port ${port}`);
});

// === ELITE FEATURES: AUTO-EXPIRATION CRON ===
setInterval(async () => {
    try {
        const expired = await client.services.sanctions.checkExpiredSanctions();

        if (expired.length > 0) {
            console.log(`⏱️ Encontradas ${expired.length} sanciones expiradas.`);
            const guild = client.guilds.cache.get(GUILD_ID);

            for (const leg of expired) {
                // 1. Execute Unban/Unmute
                if (guild && leg.action_type === 'ban') {
                    try {
                        await guild.members.unban(leg.discord_user_id, 'Sanción Temporal Expirada (Auto)');
                        console.log(`🔓 Usuario ${leg.discord_user_id} desbaneado automáticamente.`);
                    } catch (e) { }
                }

                // 2. Notify User
                try {
                    const user = await client.users.fetch(leg.discord_user_id);
                    await user.send({
                        embeds: [{
                            title: '🎉 Sanción Expirada',
                            description: `Tu sanción temporal **${leg.reason}** ha finalizado.\nBienvenido de vuelta a ${guild ? guild.name : 'Nación MX'}.`,
                            color: 0x00FF00,
                            timestamp: new Date()
                        }]
                    });
                } catch (e) { /* DM Failed */ }

                // 3. Mark as Expired in DB
                await client.services.sanctions.expireSanction(leg.id);
            }
        }
    } catch (err) {
        console.error('❌ Error in Auto-Expiration Cron:', err);
    }
}, 300000); // Run every 5 minutes

// LOGIN
client.login(DISCORD_TOKEN);

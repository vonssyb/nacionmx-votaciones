require('dotenv').config();
// 1. Unbuffered Logger
const log = (msg) => process.stderr.write(`🟢 [MOD-BOT] ${msg}\n`);

log('Starting Nacion MX MODERATION BOT... (v5.0 - CK Role Fixes)');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios'); // For downloading images


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
client.supabase = supabase;

// --- AUDIT LOG ---
client.logAudit = async (action, details, moderator, target, color = 0x00AAFF, files = []) => {
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
            await channel.send({ embeds: [embed], files: files });
        }
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
};

// --- HELPER: UPLOAD TO SUPABASE ---
async function uploadToSupabase(fileUrl, filename) {
    try {
        // 1. Download file
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        // 2. Upload
        const { data, error } = await supabase.storage
            .from('evidence')
            .upload(`logs/${Date.now()}_${filename}`, buffer, {
                contentType: response.headers['content-type'] || 'image/png',
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            return null;
        }

        // 3. Get Public URL
        const { data: publicData } = supabase.storage
            .from('evidence')
            .getPublicUrl(data.path);

        return publicData.publicUrl;

    } catch (err) {
        console.error('Upload Helper Error:', err.message);
        return null; // Fallback to original URL if upload fails
    }
}

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
        if (command) {
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
        // If command not found in modular registry, FALL THROUGH to legacy handler
    }

    // 2. LEGACY HANDLER FALLBACK (MODERATION)
    // Only try legacy if it IS a chat input command (and wasn't handled above) OR if we want legacy to handle other types?
    // Legacy handler checks interaction type internally.
    try {
        const { handleModerationLegacy } = require('./handlers/legacyModerationHandler');
        await handleModerationLegacy(interaction, client, supabase);
    } catch (err) {
        // console.error('Legacy Handler Error:', err);
    }

    // 2. BUTTONS (MODERATION ONLY)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // --- SA APPEAL CONFIRMATION ---
        if (customId.startsWith('appeal_sa_confirm_')) {
            await interaction.deferReply({ ephemeral: true });

            const userId = customId.split('_')[3];

            if (interaction.user.id !== userId) {
                return interaction.editReply('❌ Este botón no es para ti.');
            }

            // Show confirmation with warning
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ CONFIRMAR APELACIÓN DE SA')
                .setColor('#FFA500')
                .setDescription('¿Estás seguro que deseas apelar esta Sanción Administrativa?\n\n' +
                    '✅ Al confirmar, se enviará una notificación al **Encargado de Apelaciones**.\n' +
                    '⚠️ Solo apela si tienes razones válidas y evidencia.')
                .setFooter({ text: 'Esta acción no se puede deshacer' })
                .setTimestamp();

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`appeal_sa_send_${userId}`)
                        .setLabel('✅ Sí, Apelar')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('appeal_sa_cancel')
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Secondary)
                );

            return interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
        }

        // --- SA APPEAL SEND (CONFIRMED) ---
        if (customId.startsWith('appeal_sa_send_')) {
            await interaction.deferUpdate();

            const userId = customId.split('_')[3];

            if (interaction.user.id !== userId) {
                return interaction.followUp({ content: '❌ Este botón no es para ti.', ephemeral: true });
            }

            const encargadoApelacionesRoleId = '1412913086598299738'; // Encargado de Apelaciones
            const apelacionesChannelId = '1398889153919189042'; // Canal de apelaciones

            try {
                const apelacionesChannel = await client.channels.fetch(apelacionesChannelId);

                if (apelacionesChannel) {
                    const notificationEmbed = new EmbedBuilder()
                        .setTitle('📩 NUEVA APELACIÓN DE SA')
                        .setColor('#00AAC0')
                        .setDescription(`El usuario <@${interaction.user.id}> ha solicitado apelar su Sanción Administrativa.`)
                        .addFields(
                            { name: '👤 Usuario', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '🆔 User ID', value: interaction.user.id, inline: true }
                        )
                        .setFooter({ text: 'Revisa el caso y toma una decisión' })
                        .setTimestamp();

                    await apelacionesChannel.send({
                        content: `<@&${encargadoApelacionesRoleId}> Nueva apelación de SA`,
                        embeds: [notificationEmbed]
                    });

                    await interaction.editReply({
                        content: '✅ **Apelación enviada correctamente.**\n\nEl Encargado de Apelaciones ha sido notificado y revisará tu caso pronto.',
                        embeds: [],
                        components: []
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Error: No se encontró el canal de apelaciones.',
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('[appeal_sa] Error:', error);
                await interaction.editReply({
                    content: '❌ Error al enviar la apelación. Intenta de nuevo más tarde.',
                    embeds: [],
                    components: []
                });
            }
            return;
        }

        // --- SA APPEAL CANCEL ---
        if (customId === 'cancel_sa_appeal') {
            await interaction.deferUpdate();
            await interaction.editReply({
                content: '❌ Aceptación de apelación cancelada.',
                embeds: [],
                components: []
            });
            return;
        }

        // --- CONFIRM SA APPEAL (STAFF) ---
        if (customId.startsWith('confirm_sa_appeal_')) {
            await interaction.deferUpdate();

            const sancionId = customId.split('_')[3];

            // Extract motivo from message content
            const messageContent = interaction.message.content;
            const motivoMatch = messageContent.match(/_Motivo: (.+)_/);
            const motivo = motivoMatch ? motivoMatch[1] : 'Apelación Aprobada';

            try {
                // Process SA appeal acceptance
                const sanction = await client.services.sanctions.getSanctionById(sancionId);

                if (!sanction) {
                    return interaction.editReply({
                        content: '❌ Error: No se encontró la sanción.',
                        embeds: [],
                        components: []
                    });
                }

                // Remove SA from user
                await client.services.sanctions.appealSanction(sancionId, motivo);

                // Remove SA role from user
                try {
                    const member = await interaction.guild.members.fetch(sanction.discord_user_id);
                    if (member) {
                        // SA Role IDs (matching sancion.js)
                        const SA_ROLES = {
                            1: '1450997809234051122', // SA 1
                            2: '1454636391932756049', // SA 2
                            3: '1456028699718586459', // SA 3
                            4: '1456028797638934704', // SA 4
                            5: '1456028933995630701'  // SA 5
                        };

                        // Remove all SA roles
                        const allSaRoles = Object.values(SA_ROLES);
                        await member.roles.remove(allSaRoles);
                        console.log(`[SA Appeal] Removed all SA roles from ${member.user.tag}`);
                    }
                } catch (roleError) {
                    console.error('[SA Appeal] Error removing SA role:', roleError);
                }

                // Success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('⚖️ Apelación SA Aprobada')
                    .setColor(0x00FF00)
                    .setDescription(`La Sanción Administrativa ha sido **REVOCADA** exitosamente.`)
                    .addFields(
                        { name: '🆔 ID Sanción', value: sancionId, inline: true },
                        { name: '👤 Usuario', value: `<@${sanction.discord_user_id}>`, inline: true },
                        { name: '👮 Aprobado por', value: interaction.user.tag, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({
                    content: '',
                    embeds: [successEmbed],
                    components: []
                });

                // DM user
                try {
                    const user = await client.users.fetch(sanction.discord_user_id);
                    if (user) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('⚖️ Apelación Aprobada')
                            .setColor(0x00FF00)
                            .setDescription(`✅ **¡Buenas noticias!**\n\nTu apelación de Sanción Administrativa ha sido **APROBADA** en **${interaction.guild.name}**.\n\nLa sanción ha sido retirada de tu historial.`)
                            .addFields({ name: '📝 Motivo', value: motivo, inline: false })
                            .setTimestamp();
                        await user.send({ embeds: [dmEmbed] });
                    }
                } catch (e) { }

            } catch (error) {
                console.error('[confirm_sa_appeal] Error:', error);
                await interaction.editReply({
                    content: '❌ Error procesando la apelación.',
                    embeds: [],
                    components: []
                });
            }
            return;
        }

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
    let fileArray = [];
    let uploadedUrls = [];

    if (message.attachments.size > 0) {
        // Process uploads in parallel (limited)
        const uploadPromises = message.attachments.map(async attachment => {
            // Original URL
            fileArray.push(attachment.url);

            // Upload to Supabase for persistence
            const publicUrl = await uploadToSupabase(attachment.url, attachment.name);
            if (publicUrl) uploadedUrls.push(publicUrl);
            return publicUrl;
        });

        await Promise.all(uploadPromises);
    }

    // Construct text with permanent links
    let attachmentsText = '';
    if (uploadedUrls.length > 0) {
        attachmentsText = `\n\n📂 **Evidencia Persistente (Supabase):**\n` + uploadedUrls.map(url => `[Ver Imagen](${url})`).join('\n');
    } else if (message.attachments.size > 0) {
        attachmentsText = `\n📂 Adjuntos: ${message.attachments.size} (No se pudieron subir a Supabase, ver originales abajo si aún existen)`;
    }

    await client.logAudit(
        'Mensaje Eliminado',
        `**Canal:** <#${message.channel.id}>\n**Autor:** <@${message.author.id}>\n**Contenido:**\n\`\`\`${content.substring(0, 1000)}\`\`\`${attachmentsText}`,
        client.user, // "Moderator" is system/bot for auto-logs
        message.author,
        0xFF0000, // Red
        fileArray // Still attach originals as fallback/preview in Discord
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

// 5. Message Update (Edit)
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.partial) {
        try { await newMessage.fetch(); } catch (e) { return; }
    }
    if (oldMessage.partial) return; // Can't log old content if we didn't have it cached

    if (newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore link unfurls/embed updates

    await client.logAudit(
        'Mensaje Editado',
        `**Canal:** <#${newMessage.channel.id}>\n**Antes:**\n\`\`\`${oldMessage.content ? oldMessage.content.substring(0, 900) : '[Sin texto]'}\`\`\`\n**Después:**\n\`\`\`${newMessage.content ? newMessage.content.substring(0, 900) : '[Sin texto]'}\`\`\``,
        client.user,
        newMessage.author,
        0xFFFF00 // Yellow
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

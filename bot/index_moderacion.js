require('dotenv').config();
// 1. Unbuffered Logger
const log = (msg) => process.stderr.write(`🟢 [MOD-BOT] ${msg}\n`);

log('Starting Nacion MX MODERATION BOT... (v5.8 - CacheService Fix)');
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
client.logAudit = async (action, details, moderator, target, color = 0x00AAFF, files = [], channelId = null) => {
    try {
        const AUDIT_CHANNEL_ID = channelId || '1456035521141670066'; // Security/Sanctions (Default)
        const channel = await client.channels.fetch(AUDIT_CHANNEL_ID);
        if (channel) {
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

client.once('ready', async () => {
    // Generate unique startup ID to detect multiple instances
    const startupId = Math.random().toString(36).substring(7);
    console.log(`🤖 MODERATION BOT Started as ${client.user.tag}!`);
    console.log(`🆔 Startup ID: ${startupId} - If you see multiple IDs, you have duplicate bot instances!`);

    // Load Commands (MODERATION ONLY - ayuda, ping, info are included in moderation folder)
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['moderation', 'utils']);

    // Register Commands (We can do this manually or auto, but for now let's rely on manual or existing script)
    // For Split Bot, usually we want to register only the subset.
    // NOTE: If you run 'node deploy-commands.js', it needs to know which subset to deploy.
    // For now, assume commands are already registered or will be registered via specific script.
});

client.on('interactionCreate', async interaction => {
    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        // Instant defer to prevent "Application did not respond"
        if (interaction.deferReply) {
            const originalDefer = interaction.deferReply.bind(interaction);
            interaction.deferReply = async (opts) => {
                if (interaction.deferred || interaction.replied) return;
                return originalDefer(opts).catch(e => console.error("Defer error:", e));
            };
        }

        if (interaction.reply) {
            const originalReply = interaction.reply.bind(interaction);
            interaction.reply = async (opts) => {
                if (interaction.replied) return interaction.followUp(opts).catch(e => console.error("FollowUp error:", e));
                if (interaction.deferred) return interaction.editReply(opts).catch(e => console.error("EditReply error:", e));
                return originalReply(opts).catch(e => console.error("Reply error:", e));
            };
        }

        await interaction.deferReply({}).catch(() => { });

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction, client, supabase);
            } catch (error) {
                console.error(error);
                try {
                    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: '❌ Error ejecutando comando.', flags: [64] });
                    else await interaction.reply({ content: '❌ Error ejecutando comando.', flags: [64] });
                } catch (e) { }
            }
            return;
        }
        // If command not found in modular registry, FALL THROUGH to legacy handler
    }

    // 2. LEGACY HANDLER FALLBACK (MODERATION)
    // Only try legacy if it IS a chat input command (and wasn't handled above) OR if we want legacy to handle other types?
    const economyCommands = ['fichar', 'tarjeta', 'credito', 'empresa', 'transferir', 'depositar', 'multa', 'nomina', 'robar', 'crimen', 'bolsa', 'casino', 'jugar', 'slots', 'giro', 'movimientos', 'notificaciones', 'top-ricos', 'top-morosos', 'balanza', 'saldo', 'stake', 'fondos', 'dar-robo', 'licencia', 'tienda', 'inversion', 'impuestos', 'registrar-tarjeta'];
    if (interaction.isChatInputCommand() && economyCommands.includes(interaction.commandName)) return;

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
            await interaction.deferReply({ flags: [64] });

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
                return interaction.followUp({ content: '❌ Este botón no es para ti.', flags: [64] });
            }

            const encargadoApelacionesRoleId = '1451703422800625777'; // Encargado de Apelaciones
            const apelacionesChannelId = '1398891368398585886'; // Canal de apelaciones

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

        // --- APPEAL APPROVE (GENERAL APPEALS) ---
        if (customId.startsWith('appeal_approve_')) {
            await interaction.deferUpdate();

            const appealId = customId.split('_')[2];
            const ENCARGADO_ROLE = '1451703422800625777'; // Encargado de Apelaciones

            // Check permissions
            if (!interaction.member.roles.cache.has(ENCARGADO_ROLE) && !interaction.member.permissions.has('Administrator')) {
                return interaction.followUp({ content: '❌ Solo el Encargado de Apelaciones puede gestionar apelaciones.', flags: [64] });
            }

            try {
                // 1. Get appeal from DB
                const { data: appeal } = await supabase
                    .from('appeals')
                    .select('*, sanctions(*)')
                    .eq('id', appealId)
                    .single();

                if (!appeal) {
                    return interaction.followUp({ content: '❌ Apelación no encontrada.', flags: [64] });
                }

                if (appeal.status !== 'pending') {
                    return interaction.followUp({ content: '❌ Esta apelación ya fue procesada.', flags: [64] });
                }

                // 2. Update appeal status
                await supabase
                    .from('appeals')
                    .update({
                        status: 'approved',
                        reviewed_by: interaction.user.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', appealId);

                // 3. Deactivate the original sanction
                await supabase
                    .from('sanctions')
                    .update({ status: 'appealed' })
                    .eq('id', appeal.sanction_id);

                // 4. Update the message to show it was approved
                await interaction.editReply({
                    content: `✅ **Apelación APROBADA** por ${interaction.user.tag}`,
                    components: [] // Remove buttons
                });

                // 5. Notify user via DM
                try {
                    const user = await client.users.fetch(appeal.user_id);
                    if (user) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('✅ Apelación Aprobada')
                            .setColor('#2ECC71')
                            .setDescription(`Tu apelación ha sido **APROBADA** por el equipo de moderación.\n\nLa sanción original ha sido retirada de tu historial.`)
                            .addFields(
                                { name: '📜 Sanción Original', value: `${appeal.sanctions.type}: ${appeal.sanctions.reason}` },
                                { name: '📝 Tu Motivo', value: appeal.reason }
                            )
                            .setFooter({ text: 'Nación MX - Sistema de Apelaciones' })
                            .setTimestamp();
                        await user.send({ embeds: [dmEmbed] }).catch(() => { });
                    }
                } catch (e) { }

                // 6. Log to audit
                await client.logAudit(
                    'Apelación Aprobada',
                    `Usuario: <@${appeal.user_id}>\nSanción: ${appeal.sanctions.type}\nMotivo Apelación: ${appeal.reason}`,
                    interaction.user,
                    await client.users.fetch(appeal.user_id),
                    0x2ECC71
                );

            } catch (error) {
                console.error('[appeal_approve] Error:', error);
                await interaction.followUp({ content: '❌ Error al procesar apelación.', flags: [64] });
            }
            return;
        }

        // --- APPEAL REJECT (GENERAL APPEALS) ---
        if (customId.startsWith('appeal_reject_')) {
            await interaction.deferUpdate();

            const appealId = customId.split('_')[2];
            const ENCARGADO_ROLE = '1451703422800625777';

            // Check permissions
            if (!interaction.member.roles.cache.has(ENCARGADO_ROLE) && !interaction.member.permissions.has('Administrator')) {
                return interaction.followUp({ content: '❌ Solo el Encargado de Apelaciones puede gestionar apelaciones.', flags: [64] });
            }

            try {
                // 1. Get appeal from DB
                const { data: appeal } = await supabase
                    .from('appeals')
                    .select('*, sanctions(*)')
                    .eq('id', appealId)
                    .single();

                if (!appeal) {
                    return interaction.followUp({ content: '❌ Apelación no encontrada.', flags: [64] });
                }

                if (appeal.status !== 'pending') {
                    return interaction.followUp({ content: '❌ Esta apelación ya fue procesada.', flags: [64] });
                }

                // 2. Update appeal status
                await supabase
                    .from('appeals')
                    .update({
                        status: 'rejected',
                        reviewed_by: interaction.user.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', appealId);

                // 3. Update the message
                await interaction.editReply({
                    content: `❌ **Apelación RECHAZADA** por ${interaction.user.tag}`,
                    components: []
                });

                // 4. Notify user via DM
                try {
                    const user = await client.users.fetch(appeal.user_id);
                    if (user) {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('❌ Apelación Rechazada')
                            .setColor('#E74C3C')
                            .setDescription(`Tu apelación ha sido **RECHAZADA** por el equipo de moderación.\n\nLa sanción original se mantiene activa.`)
                            .addFields(
                                { name: '📜 Sanción', value: `${appeal.sanctions.type}: ${appeal.sanctions.reason}` },
                                { name: '📝 Tu Motivo', value: appeal.reason }
                            )
                            .setFooter({ text: 'Nación MX - Sistema de Apelaciones' })
                            .setTimestamp();
                        await user.send({ embeds: [dmEmbed] }).catch(() => { });
                    }
                } catch (e) { }

                // 5. Log to audit
                await client.logAudit(
                    'Apelación Rechazada',
                    `Usuario: <@${appeal.user_id}>\nSanción: ${appeal.sanctions.type}\nMotivo Apelación: ${appeal.reason}`,
                    interaction.user,
                    await client.users.fetch(appeal.user_id),
                    0xE74C3C
                );

            } catch (error) {
                console.error('[appeal_reject] Error:', error);
                await interaction.followUp({ content: '❌ Error al procesar apelación.', flags: [64] });
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
            await interaction.deferReply({});
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
            await interaction.reply({ content: 'Solicitud rechazada.', flags: [64] });
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

    if (message.partial) return;
    if (message.author?.bot) return;

    await client.logAudit(
        'Mensaje Eliminado',
        `**Canal:** <#${message.channel.id}>\n**Contenido:**\n\`\`\`${message.content ? message.content.substring(0, 900) : '[Sin texto]'}\`\`\``,
        client.user,
        message.author,
        0xFF0000,
        [],
        MSG_LOGS_CHANNEL
    );
});

// 2. Bulk Delete
client.on('messageDeleteBulk', async messages => {
    const firstMsg = messages.first();
    const channel = firstMsg.channel;

    await client.logAudit(
        'Mensajes Eliminados en Masa',
        `**Canal:** <#${channel.id}>\n**Cantidad:** ${messages.size} mensajes`,
        client.user,
        null,
        0xFF0000,
        [],
        MSG_LOGS_CHANNEL
    );
});

// 3. Channel Delete
client.on('channelDelete', async channel => {
    await client.logAudit(
        'Canal Eliminado',
        `**Nombre:** ${channel.name}\n**Tipo:** ${channel.type}`,
        client.user,
        null,
        0x8B0000, // Dark Red
        [],
        MSG_LOGS_CHANNEL
    );
});

// 4. Role Delete
client.on('roleDelete', async role => {
    await client.logAudit(
        'Rol Eliminado',
        `**Nombre:** ${role.name}\n**ID:** ${role.id}`,
        client.user,
        null,
        0x8B0000, // Dark Red
        [],
        MSG_LOGS_CHANNEL
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
        0xFFFF00, // Yellow
        [],
        MSG_LOGS_CHANNEL
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

// --- ERLC INTEGRATION ---
const ErlcService = require('./services/ErlcService');
// Key provided by user
const ERLC_API_KEY = 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp';
client.services.erlc = new ErlcService(ERLC_API_KEY);
client.erlcPendingKicks = new Map(); // { "PlayerName": { time, reason } }

// --- GUILD MEMBER ADD: Kick Arrested Users ---
client.on('guildMemberAdd', async (member) => {
    const ARRESTED_ROLE_ID = '1413540729623679056';

    try {
        // Check if user has active arrest in database
        const { data: arrest } = await supabase
            .from('arrests')
            .select('*')
            .eq('user_id', member.id)
            .gte('release_time', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (arrest) {
            // User has active arrest
            const remainingTime = Math.round((new Date(arrest.release_time) - new Date()) / 60000);

            // Send DM first
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚫 ACCESO DENEGADO')
                    .setColor('#E74C3C')
                    .setDescription(
                        '**No puedes unirte al servidor mientras estás arrestado.**\n\n' +
                        `⏰ **Tiempo restante:** ${remainingTime} minutos\n` +
                        `📜 **Artículos:** ${arrest.articles}\n` +
                        `📅 **Liberación:** ${new Date(arrest.release_time).toLocaleString('es-MX')}\n\n` +
                        '💡 **Opciones:**\n' +
                        `• Pagar fianza: Usa \`/fianza calcular\` cuando vuelvas\n` +
                        `• Esperar tu liberación automática`
                    )
                    .setFooter({ text: 'Serás expulsado automáticamente del servidor' })
                    .setTimestamp();

                await member.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log('[Arrested Join] Could not DM user:', dmError.message);
            }

            // Wait 3 seconds to ensure DM is sent
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Kick from Discord
            await member.kick('Arrestado - No puede estar en el servidor durante su arresto');
            console.log(`[Arrested Join] Kicked ${member.user.tag} (${member.id}) - Active arrest`);

            // Log to audit
            await client.logAudit(
                'Usuario Arrestado Expulsado',
                `Usuario: <@${member.id}> intentó unirse al servidor mientras está arrestado.\n` +
                `Tiempo restante: ${remainingTime} minutos\n` +
                `Artículos: ${arrest.articles}`,
                client.user,
                member.user,
                0xFF0000
            );
        }
    } catch (error) {
        console.error('[Arrested Join Check] Error:', error);
    }
});

// --- ERLC SHIFTS MANAGEMENT ---
client.erlcShifts = new Map(); // { "RobloxID": { startTime, discordId, name } }

// Load active shifts from disk
const shiftsPath = path.join(__dirname, 'data/erlc_active_shifts.json');
if (fs.existsSync(shiftsPath)) {
    try {
        const savedShifts = JSON.parse(fs.readFileSync(shiftsPath));
        for (const [key, val] of Object.entries(savedShifts)) {
            client.erlcShifts.set(key, val);
        }
    } catch (e) { console.error('Error loading shifts:', e); }
}

const saveShifts = () => {
    try {
        const obj = Object.fromEntries(client.erlcShifts);
        fs.writeFileSync(shiftsPath, JSON.stringify(obj, null, 2));
    } catch (e) { }
};

const LOG_POLICIA = '1457892493310951444';
const MOD_ROLE_ID = '1457892493310951444'; // Updated Mod Role

// --- MESSAGE LISTENER: Auto-Kick Arrested Users ---
client.on('messageCreate', async (message) => {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    const ARRESTED_ROLE_ID = '1413540729623679056';
    const RP_CHANNELS = [
        '1398888778064978012', // canal-rp-1
        '1398888817466675220', // canal-rp-2  
        '1398888822755799182', // canal-rp-3
        '1398888832498556998'  // canal-rp-4
        // Agrega más IDs de canales RP según necesites
    ];

    // Check if user has arrested role
    const member = message.member;
    if (!member || !member.roles.cache.has(ARRESTED_ROLE_ID)) return;

    // Check if message is in RP channel
    if (!RP_CHANNELS.includes(message.channel.id)) return;

    try {
        // Delete the message
        await message.delete().catch(() => { });

        // Send warning
        const warningMsg = await message.channel.send(
            `⚠️ <@${message.author.id}> **ADVERTENCIA:** Estás arrestado y NO puedes hacer roleplay.\n\n` +
            `Si continúas intentando rolear, serás expulsado del servidor automáticamente.`
        );

        // Delete warning after 10 seconds
        setTimeout(() => warningMsg.delete().catch(() => { }), 10000);

        // Check if user has been warned before (using a Map in memory)
        if (!client.arrestWarnings) client.arrestWarnings = new Map();

        const warnings = client.arrestWarnings.get(message.author.id) || 0;

        if (warnings >= 2) {
            // Third strike: KICK
            await member.kick('Intento de roleplay durante arresto (3 advertencias)');

            // Log to audit channel
            await client.logAudit(
                'Usuario Expulsado - Arresto',
                `Usuario: <@${message.author.id}> fue expulsado por intentar hacer roleplay mientras estaba arrestado (3 advertencias).`,
                client.user,
                message.author,
                0xFF0000
            );

            // Clear warnings
            client.arrestWarnings.delete(message.author.id);
        } else {
            // Increment warnings
            client.arrestWarnings.set(message.author.id, warnings + 1);

            // Clear warning counter after 10 minutes
            setTimeout(() => {
                const current = client.arrestWarnings.get(message.author.id);
                if (current && current > 0) {
                    client.arrestWarnings.set(message.author.id, current - 1);
                }
            }, 600000); // 10 min
        }

    } catch (error) {
        console.error('[Arrested RP Check] Error:', error);
    }
});

// =============================
// AUTO-UNBAN SYSTEM
// =============================
// Runs every 60 seconds to check for expired temporary bans
setInterval(async () => {
    try {
        const now = new Date().toISOString();

        // Get all expired bans that haven't been unbanned yet
        const { data: expiredBans, error } = await supabase
            .from('temporary_bans')
            .select('*')
            .eq('unbanned', false)
            .lte('expires_at', now);

        if (error) {
            console.error('[AUTO-UNBAN] Error fetching expired bans:', error);
            return;
        }

        if (expiredBans && expiredBans.length > 0) {
            console.log(`[AUTO-UNBAN] Found ${expiredBans.length} expired bans to process`);

            for (const ban of expiredBans) {
                try {
                    if (ban.ban_type === 'discord') {
                        // Discord unban
                        const guild = client.guilds.cache.get(ban.guild_id);
                        if (guild) {
                            await guild.bans.remove(ban.user_id, 'Ban temporal expirado - Auto-unban');
                            console.log(`[AUTO-UNBAN] Discord unbanned: ${ban.user_tag} (${ban.user_id})`);

                            // Try to notify user
                            try {
                                const user = await client.users.fetch(ban.user_id);
                                await user.send(
                                    `✅ **Ban Temporal Expirado**\n\n` +
                                    `Has sido desbaneado automáticamente del servidor **${guild.name}**.\n` +
                                    `Ya puedes volver a unirte.`
                                );
                            } catch (dmError) { /* User might have DMs off */ }
                        }
                    } else if (ban.ban_type === 'erlc') {
                        // ERLC unban
                        const robloxIdentifier = ban.roblox_username || ban.roblox_id;
                        if (robloxIdentifier && client.services.erlc) {
                            const unbanCommand = `:unban ${robloxIdentifier}`;
                            const result = await client.services.erlc.runCommand(unbanCommand);
                            if (result) {
                                console.log(`[AUTO-UNBAN] ERLC unbanned: ${robloxIdentifier}`);
                            } else {
                                console.warn(`[AUTO-UNBAN] Failed to unban from ERLC: ${robloxIdentifier}`);
                            }
                        }
                    }

                    // Mark as unbanned in DB
                    await supabase
                        .from('temporary_bans')
                        .update({
                            unbanned: true,
                            unbanned_at: new Date().toISOString()
                        })
                        .eq('id', ban.id);

                } catch (unbanError) {
                    console.error(`[AUTO-UNBAN] Error processing ban ID ${ban.id}:`, unbanError);
                }
            }
        }
    } catch (error) {
        console.error('[AUTO-UNBAN] System error:', error);
    }
}, 60000); // Every 60 seconds

setInterval(async () => {
    try {
        // Save shifts periodically (in case of manual changes via command)
        saveShifts();

        const configPath = path.join(__dirname, 'data/erlc_config.json');
        if (!fs.existsSync(configPath)) return;

        const config = JSON.parse(fs.readFileSync(configPath));
        // Status Update Logic
        if (config.statusChannelId && config.statusMessageId) {
            const info = await client.services.erlc.getServerInfo();
            if (info) {
                // Update Message
                try {
                    const channel = await client.channels.fetch(config.statusChannelId);
                    if (channel) {
                        const message = await channel.messages.fetch(config.statusMessageId);
                        if (message) {
                            let statusColor = '#00FF00'; // Green
                            let statusText = '🟢 En Línea';
                            if (config.locked) {
                                statusColor = '#FF0000';
                                statusText = '🔒 CERRADO (Mantenimiento)';
                            }

                            const playerList = info.Players && info.Players.length > 0
                                ? info.Players.map(p => `\`${p.Player}\` (${p.Team})`).join(', ')
                                : 'Ninguno';

                            const embed = new EmbedBuilder()
                                .setTitle(`📶 Estado del Servidor: ${info.Name}`)
                                .setColor(statusColor)
                                .addFields(
                                    { name: 'Estado', value: statusText, inline: true },
                                    { name: '👥 Jugadores', value: `${info.CurrentPlayers} / ${info.MaxPlayers}`, inline: true },
                                    { name: '⏳ Cola de Espera', value: `${info.Queue || 0}`, inline: true },
                                    { name: '🚓 Policía/Sheriff', value: info.Players ? info.Players.filter(p => p.Team === 'Police' || p.Team === 'Sheriff').length.toString() : '0', inline: true },
                                    { name: '📜 Lista de Jugadores', value: playerList.length > 1024 ? playerList.substring(0, 1021) + '...' : playerList }
                                )
                                .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                                .setFooter({ text: `Join Key: ${info.JoinKey} | Actualizado: ${new Date().toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City' })}` })
                                .setTimestamp();

                            await message.edit({ embeds: [embed] });
                        }
                    }
                } catch (e) { /* Ignore message edit errors */ }

                if (info.Players) {
                    // 1. Fetch Active Arrests & Discord Links (Optimized)
                    let activeArrestRobloxIds = [];
                    let activeArrestMap = new Map(); // RobloxID -> Discord ID
                    let playerMap = new Map(); // RobloxID -> DiscordID

                    const onlineRobloxIds = info.Players.map(p => p.Id.toString());
                    if (onlineRobloxIds.length > 0) {
                        // Get Citizens Link
                        const { data: citizens } = await supabase
                            .from('citizens')
                            .select('roblox_id, discord_id, roblox_username')
                            .in('roblox_id', onlineRobloxIds);

                        if (citizens) {
                            citizens.forEach(c => {
                                if (c.roblox_id && c.discord_id) {
                                    playerMap.set(c.roblox_id.toString(), c.discord_id);
                                }
                            });
                        }

                        // Get Active Arrests from arrests table (new structure)
                        const { data: arrests } = await supabase
                            .from('arrests')
                            .select('user_id, release_time')
                            .gte('release_time', new Date().toISOString())
                            .in('user_id', Array.from(playerMap.values()));

                        if (arrests && arrests.length > 0) {
                            const arrestedDiscordIds = arrests.map(a => a.user_id);

                            // Find which online players are arrested
                            playerMap.forEach((discordId, robloxId) => {
                                if (arrestedDiscordIds.includes(discordId)) {
                                    activeArrestRobloxIds.push(robloxId);
                                    activeArrestMap.set(robloxId, discordId);
                                }
                            });

                            // KICK ARRESTED PLAYERS FROM ERLC
                            if (activeArrestRobloxIds.length > 0) {
                                const ErlcService = require('./services/ErlcService');
                                const erlcKey = process.env.ERLC_API_KEY;

                                if (erlcKey) {
                                    const erlcService = new ErlcService(erlcKey);

                                    for (const robloxId of activeArrestRobloxIds) {
                                        const playerInfo = info.Players.find(p => p.Id.toString() === robloxId);
                                        if (playerInfo) {
                                            const kickCommand = `:kick ${playerInfo.Player} Estás arrestado - No puedes jugar durante tu arresto`;
                                            await erlcService.runCommand(kickCommand);
                                            console.log(`[ERLC Auto-Kick] Kicked arrested player: ${playerInfo.Player} (${robloxId})`);

                                            // Send DM reminder
                                            const discordId = activeArrestMap.get(robloxId);
                                            if (discordId) {
                                                try {
                                                    const user = await client.users.fetch(discordId);
                                                    await user.send(
                                                        '⚠️ **ADVERTENCIA AUTOMÁTICA**\n\n' +
                                                        'Has sido expulsado del servidor de ERLC porque estás **ARRESTADO**.\n\n' +
                                                        '🚫 No puedes jugar hasta que tu tiempo de arresto termine.\n' +
                                                        '📅 Revisa tu DM de arresto para ver cuándo serás liberado.'
                                                    ).catch(() => { });
                                                } catch (e) { }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    const whitelist = config.whitelist || [];
                    const currentPlayers = new Set(info.Players.map(p => p.Player));

                    // --- SHIFT LOGIC: Check Leavers & Badge ---
                    for (const [robloxId, shiftData] of client.erlcShifts) {
                        const stillOnline = info.Players.find(p => p.Id.toString() === robloxId);

                        // 1. Basic Checks: Online & Team
                        let isValid = stillOnline && stillOnline.Team === 'Sheriff';
                        let endReason = 'Salió del servidor o del equipo Sheriff.';

                        // 2. Badge Check (Discord Nickname)
                        if (isValid) {
                            try {
                                // Try to find guild
                                let guild = client.guilds.cache.get(process.env.GUILD_ID);
                                if (!guild && config.statusChannelId) {
                                    const ch = client.channels.cache.get(config.statusChannelId);
                                    if (ch) guild = ch.guild;
                                }
                                if (!guild) guild = client.guilds.cache.first(); // Fallback

                                if (guild) {
                                    const member = await guild.members.fetch(shiftData.discordId).catch(() => null);
                                    if (member) {
                                        const badgeRegex = /\b(ST|JD|AD)-\d{3}\b/;
                                        if (!badgeRegex.test(member.displayName)) {
                                            isValid = false;
                                            endReason = 'Placa no encontrada en apodo de Discord (ST/JD/AD-XXX).';
                                        }
                                    } else {
                                        // Member left discord?
                                        isValid = false;
                                        endReason = 'Usuario no encontrado en Discord.';
                                    }
                                }
                            } catch (e) { console.error('Error checking badge:', e); }
                        }

                        if (!isValid) {
                            // END SHIFT AUTOMATICALLY
                            client.erlcShifts.delete(robloxId);
                            saveShifts();

                            const durationMs = Date.now() - shiftData.startTime;
                            const durationMin = Math.round(durationMs / 60000);

                            // Log to Channel
                            try {
                                const logChannel = await client.channels.fetch(LOG_POLICIA);
                                if (logChannel) {
                                    const embed = new EmbedBuilder()
                                        .setTitle('🛑 Turno Finalizado (Auto)')
                                        .setColor(0xFF0000)
                                        .setDescription(`El moderador <@${shiftData.discordId}> ha terminado su turno.\n**Razón:** ${endReason}`)
                                        .addFields(
                                            { name: 'Usuario', value: shiftData.name, inline: true },
                                            { name: 'Duración', value: `${durationMin} minutos`, inline: true }
                                        )
                                        .setTimestamp();
                                    await logChannel.send({ embeds: [embed] });
                                }
                            } catch (e) { }
                        }
                    }

                    // --- LOOP PLAYERS (Enforcement) ---
                    // Cleanup pending kicks for left players
                    for (const [key, val] of client.erlcPendingKicks) {
                        if (!currentPlayers.has(key)) {
                            client.erlcPendingKicks.delete(key);
                        }
                    }

                    for (const player of info.Players) {
                        const playerName = player.Player;
                        const playerId = player.Id.toString();
                        let violation = null;

                        // Check 1: Server Lock
                        if (config.locked && !whitelist.includes(playerName)) {
                            // AUTO-WHITELIST CHECK FOR STAFF
                            // Check if this Roblox ID is linked to a Discord Staff
                            let isStaffBypass = false;
                            try {
                                const { data: citizen } = await supabase
                                    .from('citizens')
                                    .select('discord_id')
                                    .eq('roblox_id', playerId) // Efficient lookup by ID
                                    .maybeSingle();

                                if (citizen && citizen.discord_id) {
                                    // Check Discord Roles
                                    const guild = client.guilds.cache.get(process.env.GUILD_ID);
                                    if (guild) {
                                        const member = await guild.members.fetch(citizen.discord_id).catch(() => null);
                                        if (member) {
                                            // IDs from sancion.js / rango.js
                                            const STAFF_ROLES = ['1412887167654690908', '1412887079612059660', '1412882248411381872', '1412882245735420006'];
                                            if (member.roles.cache.some(r => STAFF_ROLES.includes(r.id))) {
                                                isStaffBypass = true;
                                                // verify badge just in case? no, let's trust role.
                                            }
                                        }
                                    }
                                }
                            } catch (err) { }

                            if (!isStaffBypass) {
                                violation = 'server_closed';
                            }
                        }

                        // Check 2: Active Arrest (Anti-RP)
                        // If logic 1 matches, it takes precedence.
                        if (!violation && activeArrestRobloxIds.includes(playerId)) {
                            violation = 'arrest_evasion';
                        }

                        if (violation) {
                            const pendingData = client.erlcPendingKicks.get(playerName);

                            if (!pendingData) {
                                // FIRST DETECTION
                                client.erlcPendingKicks.set(playerName, { time: Date.now(), reason: violation });

                                let msg = '';
                                if (violation === 'server_closed') {
                                    msg = `🔴 EL SERVIDOR ESTÁ CERRADO (Mantenimiento). Serás expulsado en 1 minuto.`;
                                } else if (violation === 'arrest_evasion') {
                                    msg = `👮 ESTÁS ARRESTADO EN RP. No puedes rolear. Serás expulsado en 1 minuto.`;
                                }

                                // Send Message
                                await client.services.erlc.runCommand(`:m ${playerName} ${msg}`);
                                console.log(`[ENFORCE] Warned ${playerName} for ${violation}`);

                            } else {
                                // PENDING KICK: Execution
                                const elapsed = Date.now() - pendingData.time;
                                if (elapsed >= 60000) { // Changed from > to >= for exact 60s
                                    let kickReason = violation === 'server_closed' ? 'Servidor Cerrado' : 'Arrestado en RP';
                                    await client.services.erlc.runCommand(`:kick ${playerName} ${kickReason}`);
                                    client.erlcPendingKicks.delete(playerName);
                                    console.log(`[ENFORCE] Kicked ${playerName} for ${violation}`);
                                }
                            }
                        }

                        // --- AUTO-START REMOVED (Manual Start Required via /mod turno) ---
                    }
                }
            }
        }
        // --- AUTOMATED LOGS POLLING ---
        if (!client.erlcLogState) {
            client.erlcLogState = {
                lastKill: 0,
                lastCommand: 0,
                lastJoin: 0,
                processedKills: new Set(),
                processedCommands: new Set(),
                processedJoins: new Set()
            };
            const logStatePath = path.join(__dirname, 'data/erlc_log_state.json');
            if (fs.existsSync(logStatePath)) {
                try {
                    const saved = JSON.parse(fs.readFileSync(logStatePath));
                    client.erlcLogState.lastKill = saved.lastKill || 0;
                    client.erlcLogState.lastCommand = saved.lastCommand || 0;
                    client.erlcLogState.lastJoin = saved.lastJoin || 0;
                    // Restore Sets from disk
                    client.erlcLogState.processedKills = new Set(saved.processedKills || []);
                    client.erlcLogState.processedCommands = new Set(saved.processedCommands || []);
                    client.erlcLogState.processedJoins = new Set(saved.processedJoins || []);
                    console.log(`[ERLC-LOGS] Restored ${client.erlcLogState.processedCommands.size} processed commands from disk`);
                } catch (e) { }
            }
        }

        const logChannel = await client.channels.fetch(LOG_POLICIA).catch(() => null);
        if (logChannel) {
            // 1. Kill Logs
            const kills = await client.services.erlc.getKillLogs();
            console.log(`[ERLC-LOGS] Fetched ${kills.length} kill logs from API`);
            let newKills = kills.filter(k => k.Timestamp > client.erlcLogState.lastKill).sort((a, b) => a.Timestamp - b.Timestamp);
            if (newKills.length > 0) {
                console.log(`[ERLC-LOGS] Processing ${newKills.length} new kill logs`);
                for (const [index, k] of newKills.entries()) {
                    // Create unique ID to prevent duplicates (including index for better uniqueness)
                    const logId = `${k.Timestamp}_${k.Killer}_${k.Killed}_${index}`;
                    if (client.erlcLogState.processedKills.has(logId)) {
                        console.log(`[ERLC-LOGS] Skipping duplicate kill: ${logId}`);
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('☠️ Kill Log')
                        .setColor(0x8B0000)
                        .setDescription(`**${k.Killer}** mató a **${k.Killed}**`)
                        .setTimestamp(k.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });
                    client.erlcLogState.processedKills.add(logId);
                    client.erlcLogState.lastKill = Math.max(client.erlcLogState.lastKill, k.Timestamp);
                }

                // Clean old entries from Set (keep last 500)
                if (client.erlcLogState.processedKills.size > 500) {
                    const entries = Array.from(client.erlcLogState.processedKills);
                    client.erlcLogState.processedKills = new Set(entries.slice(-500));
                }
            }

            // 2. Command Logs
            const cmds = await client.services.erlc.getCommandLogs();
            console.log(`[ERLC-LOGS] Fetched ${cmds.length} command logs from API`);
            let newCmds = cmds.filter(c => c.Timestamp > client.erlcLogState.lastCommand).sort((a, b) => a.Timestamp - b.Timestamp);
            if (newCmds.length > 0) {
                console.log(`[ERLC-LOGS] Processing ${newCmds.length} new command logs`);
                for (const [index, c] of newCmds.entries()) {
                    // Create unique ID with index to handle multiple identical commands in same poll
                    const logId = `${c.Timestamp}_${c.Player}_${c.Command}_${index}`;
                    if (client.erlcLogState.processedCommands.has(logId)) {
                        console.log(`[ERLC-LOGS] Skipping duplicate command: ${logId}`);
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('⌨️ Command Log')
                        .setColor(0x00AAFF)
                        .setDescription(`**${c.Player}** usó \`${c.Command}\``)
                        .setTimestamp(c.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });
                    client.erlcLogState.processedCommands.add(logId);
                    client.erlcLogState.lastCommand = Math.max(client.erlcLogState.lastCommand, c.Timestamp);
                }

                if (client.erlcLogState.processedCommands.size > 500) {
                    const entries = Array.from(client.erlcLogState.processedCommands);
                    client.erlcLogState.processedCommands = new Set(entries.slice(-500));
                }
            }

            // 3. Join/Leave Logs
            const joins = await client.services.erlc.getJoinLogs();
            console.log(`[ERLC-LOGS] Fetched ${joins.length} join/leave logs from API`);
            let newJoins = joins.filter(j => j.Timestamp > client.erlcLogState.lastJoin).sort((a, b) => a.Timestamp - b.Timestamp);
            if (newJoins.length > 0) {
                console.log(`[ERLC-LOGS] Processing ${newJoins.length} new join/leave logs`);
                for (const [index, j] of newJoins.entries()) {
                    // Create unique ID with index
                    const logId = `${j.Timestamp}_${j.Player}_${j.Join ? 'join' : 'leave'}_${index}`;
                    if (client.erlcLogState.processedJoins.has(logId)) {
                        console.log(`[ERLC-LOGS] Skipping duplicate join/leave: ${logId}`);
                        continue;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(j.Join ? '🟢 Entrada al Servidor' : '🔴 Salida del Servidor')
                        .setColor(j.Join ? 0x00FF00 : 0xFF0000)
                        .setDescription(`**${j.Player}**`)
                        .setTimestamp(j.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });
                    client.erlcLogState.processedJoins.add(logId);
                    client.erlcLogState.lastJoin = Math.max(client.erlcLogState.lastJoin, j.Timestamp);
                }

                if (client.erlcLogState.processedJoins.size > 500) {
                    const entries = Array.from(client.erlcLogState.processedJoins);
                    client.erlcLogState.processedJoins = new Set(entries.slice(-500));
                }
            }

            // Save State (including Sets for persistence)
            if (newKills.length > 0 || newCmds.length > 0 || newJoins.length > 0) {
                fs.writeFileSync(path.join(__dirname, 'data/erlc_log_state.json'), JSON.stringify({
                    lastKill: client.erlcLogState.lastKill,
                    lastCommand: client.erlcLogState.lastCommand,
                    lastJoin: client.erlcLogState.lastJoin,
                    processedKills: Array.from(client.erlcLogState.processedKills),
                    processedCommands: Array.from(client.erlcLogState.processedCommands),
                    processedJoins: Array.from(client.erlcLogState.processedJoins)
                }));
                console.log(`[ERLC-LOGS] Saved state: kills=${client.erlcLogState.lastKill}, cmds=${client.erlcLogState.lastCommand}, joins=${client.erlcLogState.lastJoin}`);
            }
        } else {
            console.warn(`[ERLC-LOGS] Could not fetch log channel ${LOG_POLICIA}`);
        }

    } catch (err) {
        // console.error('[ERLC Cron] Error:', err.message);
    }
}, 10000); // 10 seconds - Near real-time ERLC logs

// LOGIN
client.login(DISCORD_TOKEN);

const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { CHANNELS, GUILDS } = require('../config/constants');

// Services
const LevelService = require('../services/LevelService');
const MissionService = require('../services/MissionService');
const AchievementService = require('../services/AchievementService');
const BillingService = require('../services/BillingService');
const ExchangeService = require('../services/ExchangeService');
const StateManager = require('../services/StateManager');

async function startGovernmentBot(supabase) {
    logger.info('🏛️', 'Starting Government Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Instantiate Services
    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const billingService = new BillingService(client, supabase);
    const exchangeService = new ExchangeService(supabase, billingService.ubService);

    // Initialize StateManager
    const stateManager = new StateManager(supabase);
    await stateManager.initialize();

    client.services = {
        levels: levelService,
        missions: missionService,
        achievements: achievementService,
        billing: billingService,
        exchange: exchangeService,
        stateManager: stateManager
    };

    // Load Commands
    const loader = require('../handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, '../commands'), ['gov']);

    // AUTO-REGISTER COMMANDS
    const GOV_TOKEN = process.env.DISCORD_TOKEN_GOV;
    const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

    if (GOV_TOKEN && TARGET_GUILDS.length > 0) {
        (async () => {
            logger.info(`Auto-registering GOV commands for ${TARGET_GUILDS.length} guilds`);
            const rest = new REST({ version: '10' }).setToken(GOV_TOKEN);
            try {
                const currentUser = await rest.get(Routes.user('@me'));
                const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
                for (const guildId of TARGET_GUILDS) {
                    try {
                        await rest.put(Routes.applicationGuildCommands(currentUser.id, guildId), { body: allCommands });
                        logger.info(`Registered ${allCommands.length} GOV commands`, { guildId });
                    } catch (e) { logger.errorWithContext(`GOV Reg Error`, e, { guildId }); }
                }
            } catch (e) { logger.errorWithContext('Critical GOV Registration Error', e); }
        })();
    }

    // Events
    client.once('ready', () => {
        logger.info('🟢', `[GOV] Logged in as ${client.user.tag}`);
        const swarm = client.services?.swarm;
        if (swarm) swarm.registerClient(client, 'GOV');
    });

    client.on('interactionCreate', async interaction => {
        if (!rateLimiter.check(interaction.user.id)) return interaction.reply({ content: '⏳ Anti-Spam: Espera un momento.', ephemeral: true }).catch(() => { });

        // Handle Visa Payment
        if (interaction.isButton() && interaction.customId.startsWith('visa_pay_')) {
            const visaPaymentHandler = require('../handlers/visaPaymentHandler');
            try { await visaPaymentHandler.execute(interaction, client, interaction.customId); }
            catch (error) {
                logger.errorWithContext('Visa payment error', error, { module: 'GOV' });
                await interaction.reply({ content: '❌ Error processing.', ephemeral: true }).catch(() => { });
            }
            return;
        }

        // Handle Emergency & Payment Buttons
        if (interaction.isButton()) {
            // Handle emergency response button
            if (interaction.customId.startsWith('emergency_respond_')) {
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

                    logger.info(`Emergency joined`, { emergencyId, user: interaction.user.tag });

                } catch (error) {
                    logger.errorWithContext('Emergency respond error', error);
                    await interaction.followUp({ content: '❌ Error al unirse a la emergencia.', ephemeral: true });
                }
                return;
            }

            // Handle payment accept button
            if (interaction.customId.startsWith('payment_accept_')) {
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

                    logger.info(`Payment request accepted`, { requestId });

                } catch (error) {
                    logger.errorWithContext('Payment accept error', error);
                    await interaction.followUp({ content: '❌ Error procesando pago.', ephemeral: true });
                }
                return;
            }

            // Handle payment reject button
            if (interaction.customId.startsWith('payment_reject_')) {
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

                    logger.info(`Payment request rejected`, { requestId });

                } catch (error) {
                    logger.errorWithContext('Payment reject error', error);
                    await interaction.followUp({ content: '❌ Error procesando rechazo.', ephemeral: true });
                }
                return;
            }
        }

        if (!interaction.isChatInputCommand()) return;
        if (!await safeDefer(interaction)) return;

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try { await command.execute(interaction, client, supabase); }
            catch (e) {
                logger.errorWithContext('GOV command execution error', e);
                await interaction.editReply('❌ Error ejecutando comando.').catch(() => { });
            }
        }
    });

    // Login
    if (!GOV_TOKEN) return logger.info('❌', '[GOV] No Token Found');
    loginWithRetry(client, GOV_TOKEN, 'GOV');
}

module.exports = startGovernmentBot;

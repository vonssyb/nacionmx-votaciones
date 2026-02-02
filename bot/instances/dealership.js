const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { GUILDS } = require('../config/constants');

// We will load services later as we build them
const DealershipService = require('../services/DealershipService');
const dealershipPaymentHandler = require('../handlers/dealershipPaymentHandler');

async function startDealershipBot(supabase) {
    logger.info('🚗', 'Starting Dealership Bot...');
    const DEALERSHIP_TOKEN = process.env.DISCORD_TOKEN_DEALERSHIP; // [FIX] Defined at function scope
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Load Services
    client.dealershipService = new DealershipService(supabase);

    // Load Commands
    const loader = require('../handlers/commandLoader');
    // Ensure the dealership commands folder exists first
    await loader.loadCommands(client, path.join(__dirname, '../commands'), ['dealership']);

    client.once('ready', async () => {
        logger.info('🟢', `[DEALERSHIP] Logged in as ${client.user.tag}`);
        client.user.setActivity('autos de lujo 🏎️', { type: 4 });

        // Register commands for ALL guilds the bot acts in (since this might be a standalone server)
        if (DEALERSHIP_TOKEN) {
            const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);
            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            logger.info(`[DEALERSHIP] Fetching guilds for command registration...`);
            const guilds = await client.guilds.fetch();

            for (const [guildId, guild] of guilds) {
                try {
                    logger.info(`[DEALERSHIP] Registering commands in ${guild.name} (${guildId})`);
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: allCommands });
                    logger.info(`✅ [DEALERSHIP] Commands registered for ${guild.name}`);
                } catch (e) {
                    logger.errorWithContext(`DEALERSHIP Reg Error`, e, { guildId });
                }
            }
        }
    });

    // Register commands when joining a new guild
    client.on('guildCreate', async guild => {
        logger.info(`[DEALERSHIP] Joined new guild: ${guild.name}. Registering commands...`);
        if (!DEALERSHIP_TOKEN) return;

        const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);
        const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: allCommands });
            logger.info(`✅ [DEALERSHIP] Commands registered for ${guild.name}`);
        } catch (e) {
            logger.errorWithContext(`DEALERSHIP New Guild Reg Error`, e, { guildId: guild.id });
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!rateLimiter.check(interaction.user.id)) return interaction.reply({ content: '⏳ Anti-Spam activado.', ephemeral: true }).catch(() => { });

        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (command) {
                    if (!await safeDefer(interaction, { ephemeral: command.ephemeral || false })) return;
                    await command.execute(interaction, client, supabase);
                }
            }

            // --- HANDLER FOR PAYMENT BUTTONS (Purchase System) ---
            if (interaction.isButton() && (
                interaction.customId.startsWith('pay_cash_') ||
                interaction.customId.startsWith('pay_finance_') ||
                interaction.customId.startsWith('cancel_sale_') ||
                interaction.customId.startsWith('approve_sale_')
            )) {
                const handled = await dealershipPaymentHandler(interaction, client, supabase);
                if (handled) return;
            }

            // --- HANDLER FOR CATALOG (Buttons & Selects) ---
            if ((interaction.isButton() && interaction.customId.startsWith('cat_')) || (interaction.isStringSelectMenu() && interaction.customId === 'cat_select_category')) {

                await interaction.deferUpdate();

                let category = 'all';
                let page = 1;

                // Determine State based on Input
                if (interaction.isStringSelectMenu()) {
                    category = interaction.values[0];
                    page = 1; // Reset to first page on category change
                } else if (interaction.isButton()) {
                    const parts = interaction.customId.split('_');
                    // Format: cat_prev_category_page
                    const action = parts[1]; // next, prev, noop
                    if (action === 'noop') return;

                    category = parts[2] === 'null' ? 'all' : parts[2];
                    const currentPage = parseInt(parts[3]);
                    page = action === 'next' ? currentPage + 1 : currentPage - 1;
                }

                // Fetch Data (Limit 1)
                const result = await client.dealershipService.getCatalog(category === 'all' ? null : category, page, 1);

                if (result.data.length === 0) {
                    return interaction.followUp({ content: '❌ No se encontraron vehículos.', ephemeral: true });
                }

                const vehicle = result.data[0];

                // Build Embed
                const stockEmoji = vehicle.stock > 0 ? '✅' : '🔴';
                const financeText = vehicle.finance_available ? '💳 Financiamiento Disponible' : '💵 Solo Contado';

                const embed = new EmbedBuilder()
                    .setTitle(`${stockEmoji} ${vehicle.make} ${vehicle.model} (${vehicle.year || 'N/A'})`)
                    .setDescription(`**Categoría:** ${vehicle.category.toUpperCase()}\n**ID:** \`${vehicle.id}\`\n\n${vehicle.description || 'Vehículo de alto rendimiento disponible para entrega inmediata.'}`)
                    .setColor('#FFD700')
                    .addFields(
                        { name: '💰 Precio', value: `$${vehicle.price.toLocaleString()}`, inline: true },
                        { name: '🏎️ Velocidad', value: `${vehicle.specs?.max_speed || 'N/A'}`, inline: true },
                        { name: '📦 Stock', value: `${vehicle.stock} unidades`, inline: true },
                        { name: '💳 Estado', value: financeText, inline: false }
                    )
                    .setFooter({ text: `Vehículo ${page} de ${result.meta.totalItems} • Categoría: ${category.toUpperCase()}` });

                if (vehicle.image_url) {
                    embed.setImage(vehicle.image_url);
                }

                // Re-build Components
                // 1. Selector (Keep state?)
                const categoryRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('cat_select_category')
                        .setPlaceholder(`📂 Categoría: ${category.toUpperCase()}`)
                        .addOptions(
                            { label: 'Todo', value: 'all', description: 'Ver todos los vehículos' },
                            { label: 'Sedán', value: 'sedan', emoji: '🚗' },
                            { label: 'Deportivo', value: 'deportivo', emoji: '🏎️' },
                            { label: 'SUV / Camionetas', value: 'suv', emoji: '🚙' },
                            { label: 'Motos', value: 'moto', emoji: '🏍️' },
                            { label: 'Lujo', value: 'lujo', emoji: '💎' },
                            { label: 'Trabajo', value: 'trabajo', emoji: '🚛' }
                        )
                );

                // 2. Nav Buttons
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cat_prev_${category}_${page}`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                    new ButtonBuilder()
                        .setCustomId('cat_noop')
                        .setLabel(`${page} / ${result.meta.totalItems}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`cat_next_${category}_${page}`)
                        .setLabel('Siguiente ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= result.meta.totalItems)
                );

                await interaction.editReply({ embeds: [embed], components: [categoryRow, navRow] });
                return;
            }

        } catch (error) {
            logger.errorWithContext('Dealership Interaction Error', error);
        }
    });

    if (!DEALERSHIP_TOKEN) return logger.warn('⚠️', '[DEALERSHIP] No Token Found. Bot will not start.');
    loginWithRetry(client, DEALERSHIP_TOKEN, 'DEALERSHIP');

    return client;
}

module.exports = startDealershipBot;

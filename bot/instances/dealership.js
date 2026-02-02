const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { GUILDS } = require('../config/constants');

// We will load services later as we build them
const DealershipService = require('../services/DealershipService');

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
                return;
            }

            // Button Handler
            if (interaction.isButton()) {
                const parts = interaction.customId.split('_');
                const prefix = parts[0]; // cat
                const action = parts[1]; // next, prev, noop

                if (prefix === 'cat') {
                    if (action === 'noop') return interaction.deferUpdate();

                    await interaction.deferUpdate(); // Acknowledge click

                    const category = parts[2] === 'all' ? null : parts[2];
                    const currentPage = parseInt(parts[3]);
                    const nextPage = action === 'next' ? currentPage + 1 : currentPage - 1;

                    // Fetch Data
                    const result = await client.dealershipService.getCatalog(category, nextPage);

                    if (result.data.length === 0) {
                        return interaction.followUp({ content: '❌ Error: Página no encontrada.', ephemeral: true });
                    }

                    // Rebuild Embed (Duplicate logic from command - acceptable for now)
                    const embed = new EmbedBuilder()
                        .setTitle(category ? `Catálogo: ${category.toUpperCase()}` : '🏎️ Catálogo General de Vehículos')
                        .setDescription('Explora nuestra selección de vehículos premium. Usa los botones para navegar.')
                        .setColor('#FFD700')
                        .setFooter({ text: `Página ${nextPage}/${result.meta.totalPages} • Total: ${result.meta.totalItems} autos` });

                    result.data.forEach(vehicle => {
                        const stockEmoji = vehicle.stock > 0 ? '✅' : '🔴';
                        const financeText = vehicle.finance_available ? '💳 Financiamiento Disponible' : '💵 Solo Contado';
                        embed.addFields({
                            name: `${stockEmoji} ${vehicle.make} ${vehicle.model}`,
                            value: `**Precio:** $${vehicle.price.toLocaleString()}\n**Stock:** ${vehicle.stock}\n${financeText}\nID: \`${vehicle.id}\``,
                            inline: true
                        });
                    });

                    // Update Buttons
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`cat_prev_${category || 'all'}_${nextPage}`)
                            .setLabel('◀️ Anterior')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(nextPage <= 1),
                        new ButtonBuilder()
                            .setCustomId('cat_noop')
                            .setLabel(`${nextPage}/${result.meta.totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`cat_next_${category || 'all'}_${nextPage}`)
                            .setLabel('Siguiente ▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(nextPage >= result.meta.totalPages)
                    );

                    await interaction.editReply({ embeds: [embed], components: [row] });
                    return;
                }
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

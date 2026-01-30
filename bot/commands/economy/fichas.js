const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');
const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
const { CARD_TIERS } = require('../../services/EconomyHelper');

const COLORS = {
    SUCCESS: '#2ECC71',
    INFO: '#3498DB',
    WARNING: '#F39C12',
    ERROR: '#E74C3C'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fichas')
        .setDescription('🎰 Gestión de Fichas de Casino')
        .addSubcommand(subcommand =>
            subcommand
                .setName('comprar')
                .setDescription('💵 Comprar fichas de casino ($1 = 1 ficha)')
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('Cantidad de fichas a comprar')
                        .setRequired(true)
                        .setMinValue(100)
                        .setMaxValue(1000000))
                .addStringOption(option =>
                    option.setName('metodo')
                        .setDescription('Método de pago')
                        .setRequired(true)
                        .addChoices(
                            { name: '💵 Efectivo', value: 'efectivo' },
                            { name: '💳 Tarjeta de Débito', value: 'debito' },
                            { name: '💳 Tarjeta de Crédito', value: 'credito' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('vender')
                .setDescription('💰 Vender fichas por dinero')
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('Cantidad de fichas a vender')
                        .setRequired(true)
                        .setMinValue(100))
                .addStringOption(option =>
                    option.setName('metodo')
                        .setDescription('Dónde recibir el dinero')
                        .setRequired(true)
                        .addChoices(
                            { name: '💵 Efectivo', value: 'efectivo' },
                            { name: '💳 Cuenta Bancaria', value: 'debito' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('🎰 Ver tu balance de fichas'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('📊 Ver tus estadísticas de casino')),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const casinoService = new CasinoService(supabase);
        // Initialize UB Service
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN || process.env.DISCORD_TOKEN_UB, supabase);

        try {
            if (subcommand === 'comprar') {
                const amount = interaction.options.getInteger('cantidad');
                const metodo = interaction.options.getString('metodo');

                await interaction.deferReply();

                if (metodo === 'efectivo' || metodo === 'debito') {
                    // Check Balance via UB
                    const balance = await ubService.getUserBalance(guildId, userId);
                    const currentFunds = metodo === 'efectivo' ? balance.cash : balance.bank;
                    const fundName = metodo === 'efectivo' ? 'Efectivo' : 'Banco';

                    if (currentFunds < amount) {
                        return interaction.editReply({
                            content: `❌ No tienes suficiente dinero en ${fundName}.\n💰 Tienes: $${currentFunds.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}`
                        });
                    }

                    // Deduct Money
                    const result = await ubService.removeMoney(guildId, userId, amount, 'Compra de Fichas Casino', metodo === 'efectivo' ? 'cash' : 'bank');
                    if (!result.success) {
                        return interaction.editReply({ content: '❌ Error al procesar el pago con el banco.' });
                    }

                } else if (metodo === 'credito') {
                    // Credit Card Logic
                    // 1. Find Active Credit Card
                    // Trying both discord_id and discord_user_id column names as schema is inconsistent in some legacy dbs
                    const { data: cards, error } = await supabase
                        .from('credit_cards')
                        .select('*')
                        .or(`discord_id.eq.${userId},discord_user_id.eq.${userId}`) // Safety check
                        .eq('status', 'active');

                    if (error || !cards || cards.length === 0) {
                        return interaction.editReply({ content: '❌ No tienes una tarjeta de crédito activa registrada.' });
                    }

                    const card = cards[0]; // Use first active card
                    const tierInfo = CARD_TIERS[card.card_type];

                    if (!tierInfo) {
                        return interaction.editReply({ content: '❌ Error: Tipo de tarjeta inválido o desconocido.' });
                    }

                    const subLimit = tierInfo.limit;
                    const currentDebt = card.current_balance || 0;

                    if (currentDebt + amount > subLimit) {
                        return interaction.editReply({
                            content: `❌ Transacción rechazada. Excederías tu límite de crédito.\n📉 Disponible: $${(subLimit - currentDebt).toLocaleString()}\n💳 Límite: $${subLimit.toLocaleString()}`
                        });
                    }

                    // Increase Debt
                    const { error: updateError } = await supabase
                        .from('credit_cards')
                        .update({
                            current_balance: currentDebt + amount,
                            last_used_at: new Date().toISOString()
                        })
                        .eq('id', card.id);

                    if (updateError) {
                        return interaction.editReply({ content: '❌ Error al procesar el cargo a tu tarjeta de crédito.' });
                    }
                }

                // Add Chips to Casino Account
                const { data: chipsAccount } = await supabase
                    .from('casino_chips')
                    .select('chips_balance')
                    .eq('discord_user_id', userId)
                    .maybeSingle();

                const currentChips = chipsAccount?.chips_balance || 0;

                if (!chipsAccount) {
                    await supabase.from('casino_chips').insert({
                        discord_user_id: userId,
                        chips_balance: amount,
                        total_won: 0,
                        total_lost: 0,
                        games_played: 0
                    });
                } else {
                    await supabase.from('casino_chips').update({
                        chips_balance: currentChips + amount,
                        updated_at: new Date().toISOString()
                    }).eq('discord_user_id', userId);
                }

                const embed = new EmbedBuilder()
                    .setTitle('🎰 Compra Exitosa')
                    .setDescription(`Has comprado **${amount.toLocaleString()}** fichas.`)
                    .addFields(
                        { name: '💸 Costo', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '💳 Método', value: metodo.charAt(0).toUpperCase() + metodo.slice(1), inline: true },
                        { name: '💰 Nuevo Balance', value: `${(currentChips + amount).toLocaleString()} fichas`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'vender') {
                const amount = interaction.options.getInteger('cantidad');
                const metodo = interaction.options.getString('metodo'); // efectivo or debito

                await interaction.deferReply();

                // Check chips
                const check = await casinoService.checkChips(userId, amount);
                if (!check.hasEnough) {
                    return interaction.editReply({ content: check.message });
                }

                // Remove Chips first
                await supabase.from('casino_chips').update({
                    chips_balance: check.balance - amount,
                    updated_at: new Date().toISOString()
                }).eq('discord_user_id', userId);

                // Add Money via UB
                let ubMethod = metodo === 'efectivo' ? 'cash' : 'bank';
                const result = await ubService.addMoney(guildId, userId, amount, 'Venta de Fichas Casino', ubMethod);

                if (!result.success) {
                    // Rollback chips if payout fails (Optional but good practice)
                    // await supabase.from('casino_chips').update({ chips_balance: check.balance }).eq('discord_user_id', userId);
                    return interaction.editReply({ content: '❌ Error al depositar el dinero (Fichas descontadas, contacta a admin).' });
                }

                const embed = new EmbedBuilder()
                    .setTitle('💰 Venta Exitosa')
                    .setDescription(`Has vendido **${amount.toLocaleString()}** fichas.`)
                    .addFields(
                        { name: '💵 Recibido', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '🏦 Destino', value: metodo === 'efectivo' ? 'Bolsillo' : 'Banco', inline: true },
                        { name: '🎰 Fichas Restantes', value: `${(check.balance - amount).toLocaleString()}`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS);

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'balance') {
                const { data: account } = await supabase
                    .from('casino_chips')
                    .select('*')
                    .eq('discord_user_id', userId)
                    .maybeSingle();

                const balance = account?.chips_balance || 0;

                const embed = new EmbedBuilder()
                    .setTitle('🎰 Balance de Casino')
                    .setDescription(`Tu balance actual de fichas:`)
                    .addFields(
                        { name: '🪙 Fichas', value: `**${balance.toLocaleString()}**`, inline: true },
                        { name: '💵 Valor en efectivo', value: `$${balance.toLocaleString()}`, inline: true }
                    )
                    .setColor(COLORS.INFO)
                    .setFooter({ text: 'Usa /fichas comprar para obtener más' });

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'stats') {
                const { data: account } = await supabase
                    .from('casino_chips')
                    .select('*')
                    .eq('discord_user_id', userId)
                    .maybeSingle();

                if (!account) {
                    return interaction.reply({ content: '❌ Aún no has jugado en el casino.', ephemeral: true });
                }

                const profit = (account.total_won || 0) - (account.total_lost || 0);

                const embed = new EmbedBuilder()
                    .setTitle('📊 Estadísticas de Casino')
                    .setColor(COLORS.INFO)
                    .addFields(
                        { name: '🎮 Juegos Jugados', value: `${account.games_played || 0}`, inline: true },
                        { name: '💰 Total Ganado', value: `${(account.total_won || 0).toLocaleString()} fichas`, inline: true },
                        { name: '💸 Total Perdido', value: `${(account.total_lost || 0).toLocaleString()} fichas`, inline: true },
                        { name: '📈 Neto', value: `${profit > 0 ? '+' : ''}${profit.toLocaleString()} fichas`, inline: false }
                    );

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Fichas] Error:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Ocurrió un error al procesar la solicitud.' });
            } else {
                await interaction.reply({ content: '❌ Ocurrió un error al procesar la solicitud.', ephemeral: true });
            }
        }
    }
};

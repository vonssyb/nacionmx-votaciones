const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

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
                        .setMaxValue(1000000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('vender')
                .setDescription('💰 Vender fichas por dinero')
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('Cantidad de fichas a vender')
                        .setRequired(true)
                        .setMinValue(100)))
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
        const casinoService = new CasinoService(supabase);

        try {
            if (subcommand === 'comprar') {
                const amount = interaction.options.getInteger('cantidad');

                // Check wallet balance
                const { data: userData } = await supabase
                    .from('users')
                    .select('wallet')
                    .eq('id', userId)
                    .single();

                if (!userData || userData.wallet < amount) {
                    return interaction.reply({
                        content: `❌ No tienes suficiente dinero en efectivo.\n💰 Tienes: $${(userData?.wallet || 0).toLocaleString()}\nNecesitas: $${amount.toLocaleString()}`,
                        ephemeral: true
                    });
                }

                // Deduct money
                await supabase
                    .from('users')
                    .update({ wallet: userData.wallet - amount })
                    .eq('id', userId);

                // Add chips (using service or raw query since service addChips is static and I instantiated it, wait checking service definition...)
                // Service methods are static? No, in my last read they were instance methods in the file I wrote? No, create_casino_tables request failed? 
                // Ah, I need to check CasinoService.js content first to be sure how to call it.
                // Assuming static based on previous plan, but let's check file content to be safe.
                // Actually I wrote it as a class but methods were `static async` in the plan, but let's see what I actually wrote or if it exists.
                // Using the previously read content from Step 604: methods are NOT static in lines 53+ (checkChips), they are instance methods.
                // Wait, Step 604 shows `class CasinoService { constructor(supabase) { ... } checkChips(userId, amount) { ... } }`
                // So I need to instantiate it. `const casino = new CasinoService(supabase);`

                // Add chips logic
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
                        { name: '💰 Nuevo Balance', value: `${(currentChips + amount).toLocaleString()} fichas`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS);

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'vender') {
                const amount = interaction.options.getInteger('cantidad');

                // Check chips using service
                const check = await casinoService.checkChips(userId, amount);
                if (!check.hasEnough) {
                    return interaction.reply({ content: check.message, ephemeral: true });
                }

                // Add money to wallet
                const { data: userData } = await supabase
                    .from('users')
                    .select('wallet')
                    .eq('id', userId)
                    .single();

                await supabase.from('users').update({ wallet: (userData?.wallet || 0) + amount }).eq('id', userId);

                // Remove chips
                await supabase.from('casino_chips').update({
                    chips_balance: check.balance - amount,
                    updated_at: new Date().toISOString()
                }).eq('discord_user_id', userId);

                const embed = new EmbedBuilder()
                    .setTitle('💰 Venta Exitosa')
                    .setDescription(`Has vendido **${amount.toLocaleString()}** fichas.`)
                    .addFields(
                        { name: '💵 Recibido', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '🎰 Fichas Restantes', value: `${(check.balance - amount).toLocaleString()}`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS);

                await interaction.reply({ embeds: [embed] });

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

                const winRate = account.games_played > 0
                    ? ((account.total_won > account.total_lost) ? 'Ganador' : 'Perdedor')
                    : 'N/A';

                const profit = (account.total_won || 0) - (account.total_lost || 0);
                const profitColor = profit >= 0 ? COLORS.SUCCESS : COLORS.ERROR;

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
            await interaction.reply({ content: '❌ Ocurrió un error al procesar la solicitud.', ephemeral: true });
        }
    }
};

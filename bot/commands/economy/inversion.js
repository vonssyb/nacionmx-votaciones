const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAvailablePaymentMethods, processPayment } = require('../../utils/economyUtils');
const BillingService = require('../../services/BillingService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inversion')
        .setDescription('Sistema de Inversión a Plazo Fijo')
        .addSubcommand(subcommand =>
            subcommand
                .setName('nueva')
                .setDescription('Abrir una nueva inversión - 7 días con 5% rendimiento')
                .addIntegerOption(option =>
                    option.setName('monto')
                        .setDescription('Cantidad a invertir')
                        .setRequired(true)
                        .setMinValue(5000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('estado')
                .setDescription('Ver mis inversiones activas y retirar ganancias')),

    async execute(interaction, client, supabase) {
        const billingService = new BillingService(client);
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === 'nueva') {
            await interaction.deferReply();
            const amount = interaction.options.getInteger('monto');
            const DURATION_DAYS = 7;
            const RETURN_RATE = 0.05; // 5%

            try {
                // 1. Check Balance
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
                const totalMoney = balance.cash + balance.bank;

                if (totalMoney < amount) {
                    return interaction.editReply(`❌ **Fondos Insuficientes**\nTienes: $${totalMoney.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}`);
                }

                // 2. Select Payment Method
                const pm = await getAvailablePaymentMethods(supabase, userId, interaction.guildId);

                // For simplicity in this command compared to full store, we try to take from BANK first, then CASH
                let methodUsed = 'bank';
                if (balance.bank >= amount) {
                    await billingService.ubService.removeMoney(interaction.guildId, userId, amount, 'Inversión Plazo Fijo', 'bank');
                } else if (balance.cash >= amount) {
                    await billingService.ubService.removeMoney(interaction.guildId, userId, amount, 'Inversión Plazo Fijo', 'cash');
                    methodUsed = 'cash';
                } else {
                    // Should be covered by totalMoney check, but edge cases exist
                    return interaction.editReply('❌ Error de saldo detallado. Usa efectivo o banco.');
                }

                // 3. Create Investment in DB
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + DURATION_DAYS);

                const payout = Math.floor(amount * (1 + RETURN_RATE));

                const { data, error } = await supabase
                    .from('investments')
                    .insert({
                        user_id: userId,
                        amount: amount,
                        payout_amount: payout,
                        status: 'active',
                        end_date: endDate.toISOString(),
                        type: 'fixed_7d'
                    })
                    .select()
                    .maybeSingle();

                if (error) {
                    // Rollback
                    await billingService.ubService.addMoney(interaction.guildId, userId, amount, 'Rollback Inversión', methodUsed);
                    throw error;
                }

                const embed = new EmbedBuilder()
                    .setTitle('📈 Inversión Registrada')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '💰 Monto Invertido', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '📊 Retorno Esperado', value: `$${payout.toLocaleString()} (+5%)`, inline: true },
                        { name: '📅 Fecha de Cobro', value: `<t:${Math.floor(endDate.getTime() / 1000)}:D>`, inline: false }
                    )
                    .setFooter({ text: 'Nación MX Finanzas' });

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('[Inversion] Error:', error);
                await interaction.editReply('❌ Error al procesar la inversión.');
            }

        } else if (subcommand === 'estado') {
            await interaction.deferReply();
            try {
                // Get Active Investments
                const { data: investments, error } = await supabase
                    .from('investments')
                    .select('*')
                    .eq('user_id', userId)
                    .neq('status', 'completed'); // active or ready

                if (error) throw error;

                if (!investments || investments.length === 0) {
                    return interaction.editReply('❌ No tienes inversiones activas.');
                }

                const embed = new EmbedBuilder()
                    .setTitle('💼 Mis Inversiones')
                    .setColor(0x0099FF);

                const now = new Date();

                for (const inv of investments) {
                    const endDate = new Date(inv.end_date);
                    const isReady = now >= endDate;
                    const statusIcon = isReady ? '✅ Listo para cobrar' : '⏳ En progreso';

                    // Note: Collection happens via button usually, but here we can add a button if ready
                    embed.addFields({
                        name: `Inversión #${inv.id} - $${inv.amount.toLocaleString()}`,
                        value: `Estado: **${statusIcon}**\nCobro: $${inv.payout_amount.toLocaleString()}\nFecha: <t:${Math.floor(endDate.getTime() / 1000)}:R>`,
                        inline: false
                    });
                }

                // Add Collect Button if any is ready
                const readyInvs = investments.filter(inv => new Date(inv.end_date) <= now && inv.status === 'active');

                let components = [];
                if (readyInvs.length > 0) {
                    const row = new ActionRowBuilder();
                    readyInvs.slice(0, 5).forEach(inv => {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`btn_invest_${inv.id}`) // CORRECT ID
                                .setLabel(`Cobrar $${inv.payout_amount.toLocaleString()}`)
                                .setStyle(ButtonStyle.Success)
                        );
                    });
                    components.push(row);
                }

                await interaction.editReply({ embeds: [embed], components: components });

            } catch (error) {
                console.error('[Inversion Estado] Error:', error);
                await interaction.editReply('❌ Error consultando estado.');
            }
        }
    }
};

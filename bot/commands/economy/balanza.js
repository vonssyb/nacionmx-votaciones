const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balanza')
        .setDescription('💰 Ver tu balance financiero personal (Efectivo, Banco, Crédito)'),

    async execute(interaction, client, supabase, billingService) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.user;

        try {
            // 1. Obtener Balances de Efectivo/Banco (UnbelievaBoat)
            const billingService = client.services.billing;
            if (!billingService) throw new Error('Billing Service not initialized');
            const cashBalance = await billingService.ubService.getUserBalance(interaction.guildId, targetUser.id);

            // 2. Resolver Citizen ID (Supabase)
            const { data: citizen } = await supabase
                .from('citizens')
                .select('id, full_name, roblox_username')
                .eq('discord_id', targetUser.id)
                .maybeSingle();

            // 3. Tarjeta de Débito (MXN)
            const { data: debitCard } = await supabase
                .from('debit_cards')
                .select('balance, card_number')
                .eq('discord_user_id', targetUser.id)
                .eq('status', 'active')
                .maybeSingle();

            // 4. Tarjetas de Crédito MXN
            let creditQuery = supabase.from('credit_cards').select('*').eq('status', 'active');
            if (citizen) {
                creditQuery = creditQuery.eq('citizen_id', citizen.id);
            } else {
                creditQuery = creditQuery.eq('discord_user_id', targetUser.id);
            }
            const { data: creditCards } = await creditQuery;

            // 5. Datos USD (Efectivo y Crédito)
            const { data: usdStats } = await supabase
                .from('user_stats')
                .select('usd_cash')
                .eq('discord_user_id', targetUser.id)
                .maybeSingle();

            const { data: usdCards } = await supabase
                .from('us_credit_cards')
                .select('credit_limit, current_balance, card_type')
                .eq('user_id', targetUser.id)
                .eq('status', 'active');

            // --- CÁLCULOS ---
            const cash = cashBalance.cash || 0;
            const bank = cashBalance.bank || 0; // Usado si tiene tarjeta de debido
            const usdCash = usdStats?.usd_cash || 0;

            // Crédito MXN
            let totalCreditLimitMxn = 0;
            let totalCreditUsedMxn = 0;
            if (creditCards && creditCards.length > 0) {
                creditCards.forEach(card => {
                    totalCreditLimitMxn += card.credit_limit;
                    totalCreditUsedMxn += card.current_balance;
                });
            }

            // Crédito USD
            let totalCreditLimitUsd = 0;
            let totalCreditUsedUsd = 0;
            if (usdCards && usdCards.length > 0) {
                usdCards.forEach(card => {
                    totalCreditLimitUsd += card.credit_limit;
                    totalCreditUsedUsd += card.current_balance;
                });
            }

            // Net Worth
            const netWorthMxn = cash + bank - totalCreditUsedMxn;
            const netWorthUsd = usdCash - totalCreditUsedUsd;


            // --- CONSTRUIR EMBED ---
            const embed = new EmbedBuilder()
                .setTitle(`💰 Balanza Financiera: ${targetUser.username}`)
                .setColor(0x00FF00) // Green for personal balance
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Identidad', value: citizen ? `**${citizen.full_name}**\nRoblox: ${citizen.roblox_username || 'N/A'}` : 'No registrado como ciudadano', inline: false },
                    {
                        name: '🇲🇽 MXN (Pesos)', value:
                            `💵 **Efectivo:** $${cash.toLocaleString()}\n` +
                            `🏦 **Banco:** $${bank.toLocaleString()}\n` +
                            `💳 **Deuda Crédito:** $${totalCreditUsedMxn.toLocaleString()}\n` +
                            `🧾 **Patrimonio Neto:** $${netWorthMxn.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: '🇺🇸 USD (Dólares)', value:
                            `💵 **Efectivo:** $${usdCash.toLocaleString()}\n` +
                            `💳 **Deuda Crédito:** $${totalCreditUsedUsd.toLocaleString()}\n` +
                            `🧾 **Patrimonio Neto:** $${netWorthUsd.toLocaleString()}`,
                        inline: true
                    }
                )
                .setFooter({ text: 'Información financiera personal', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Detalles de Tarjetas (Opcional, para no saturar)
            // Si el usuario quiere ver detalles, puede usar /credito estado

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error en /balanza:', error);
            await interaction.editReply({ content: '❌ Hubo un error al recuperar tu información financiera.' });
        }
    }
};

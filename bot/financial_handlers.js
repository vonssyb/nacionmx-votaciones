// ===== FINANCIAL BALANCE SYSTEM HANDLERS =====
// Copy this code and add it to bot/index.js before line 2287 (MISSING COMMAND HANDLERS)

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName } = interaction;

    // ===== /BALANZA =====
    if (commandName === 'balanza') {
        await interaction.deferReply();

        try {
            const cashBalance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);

            const { data: debitCard } = await supabase
                .from('debit_cards')
                .select('balance')
                .eq('discord_user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            const { data: creditCard } = await supabase
                .from('credit_cards')
                .select('credit_limit, current_balance, citizens!inner(discord_id)')
                .eq('citizens.discord_id', interaction.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const cash = cashBalance.bank || 0;
            const debit = debitCard?.balance || 0;
            const creditAvailable = creditCard ? (creditCard.credit_limit - creditCard.current_balance) : 0;
            const creditDebt = creditCard?.current_balance || 0;
            const totalLiquid = cash + debit + creditAvailable;

            const embed = new EmbedBuilder()
                .setTitle('💰 TU BALANZA FINANCIERA')
                .setColor(0x00D26A)
                .setTimestamp()
                .addFields(
                    { name: '💵 EFECTIVO', value: `\`\`\`$${cash.toLocaleString()}\`\`\``, inline: true },
                    { name: '💳 DÉBITO', value: `\`\`\`$${debit.toLocaleString()}\`\`\``, inline: true },
                    { name: '💳 CRÉDITO', value: `\`\`\`Disponible: $${creditAvailable.toLocaleString()}\nDeuda: $${creditDebt.toLocaleString()}\`\`\``, inline: true },
                    { name: '📊 TOTAL LÍQUIDO', value: `### $${total Liquid.toLocaleString() }`, inline: false }
                )
                .setFooter({ text: 'Banco Nacional • Usa /debito depositar para mover efectivo a débito' });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error obteniendo tu balanza.');
        }
    }

    // (Rest of /debito code continues...)
});

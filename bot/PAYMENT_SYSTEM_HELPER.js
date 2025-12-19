// Universal Payment System Helper
// This will be integrated into the main bot file

async function requestPaymentMethod(interaction, userId, amount, description) {
    // 1. Check all available payment methods
    const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
    const cash = balance.cash || 0;
    const bank = balance.bank || 0;

    // Check debit card
    const { data: debitCard } = await supabase
        .from('debit_cards')
        .select('balance')
        .eq('discord_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

    // Check credit cards
    const { data: creditCards } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('discord_id', userId)
        .eq('status', 'active');

    let creditAvailable = 0;
    if (creditCards && creditCards.length > 0) {
        creditCards.forEach(c => {
            const limit = c.card_limit || c.credit_limit || 0;
            const debt = c.current_balance || 0;
            creditAvailable += (limit - debt);
        });
    }

    // 2. Build available payment methods
    const methods = [];

    if (cash >= amount) {
        methods.push({
            id: 'cash',
            label: `💵 Efectivo ($${cash.toLocaleString()})`,
            style: ButtonStyle.Success
        });
    }

    if (bank >= amount) {
        methods.push({
            id: 'bank',
            label: `🏦 Banco/Débito ($${bank.toLocaleString()})`,
            style: ButtonStyle.Primary
        });
    }

    if (creditAvailable >= amount) {
        methods.push({
            id: 'credit',
            label: `💳 Crédito (Disp: $${creditAvailable.toLocaleString()})`,
            style: ButtonStyle.Secondary
        });
    }

    if (methods.length === 0) {
        return {
            success: false,
            error: `❌ **Fondos Insuficientes**\\n\\nNecesitas: $${amount.toLocaleString()}\\n\\n💵 Efectivo: $${cash.toLocaleString()}\\n🏦 Banco: $${bank.toLocaleString()}\\n💳 Crédito disponible: $${creditAvailable.toLocaleString()}`
        };
    }

    // 3.  Show payment buttons
    const paymentRow = new ActionRowBuilder();
    methods.forEach(m => {
        paymentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`pay_${m.id}_${Date.now()}`)
                .setLabel(m.label)
                .setStyle(m.style)
        );
    });

    const embed = new EmbedBuilder()
        .setTitle('💳 Selecciona Método de Pago')
        .setColor(0xFFD700)
        .setDescription(`**${description}**\\n\\n💰 Total a pagar: **$${amount.toLocaleString()}**\\n\\nElige cómo deseas pagar:`)
        .setFooter({ text: 'Banco Nacional - Métodos de Pago' });

    const msg = await interaction.editReply({
        embeds: [embed],
        components: [paymentRow]
    });

    // 4. Wait for user selection
    const filter = i => i.user.id === userId && i.customId.startsWith('pay_');
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    return new Promise((resolve) => {
        collector.on('collect', async i => {
            await i.deferUpdate();
            const method = i.customId.split('_')[1];

            try {
                if (method === 'cash' || method === 'bank') {
                    // Standard payment
                    await billingService.ubService.removeMoney(
                        interaction.guildId,
                        userId,
                        amount,
                        description,
                        method
                    );

                    collector.stop();
                    resolve({ success: true, method, message: `✅ Pago exitoso con ${method === 'cash' ? 'efectivo' : 'banco/débito'}.` });

                } else if (method === 'credit') {
                    // Credit card payment - add to debt
                    const selectedCard = creditCards[0]; // Use first available card (can improve later)
                    const currentDebt = selectedCard.current_balance || 0;
                    const newDebt = currentDebt + amount;

                    await supabase
                        .from('credit_cards')
                        .update({ current_balance: newDebt })
                        .eq('id', selectedCard.id);

                    collector.stop();
                    resolve({
                        success: true,
                        method: 'credit',
                        cardId: selectedCard.id,
                        message: `✅ Pago exitoso con tarjeta de crédito.\\nNueva deuda: $${newDebt.toLocaleString()}`
                    });
                }
            } catch (error) {
                collector.stop();
                resolve({ success: false, error: `❌ Error procesando pago: ${error.message}` });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                resolve({ success: false, error: '❌ Tiempo agotado. Pago cancelado.' });
            }
        });
    });
}

module.exports = { requestPaymentMethod };

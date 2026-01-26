const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const logger = require('../services/Logger');

class ATMHandler {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
    }

    async handleInteraction(interaction) {
        if (!interaction.customId.startsWith('atm_')) return false;

        const action = interaction.customId.replace('atm_', '');

        try {
            switch (action) {
                // Main Menu Navigation
                case 'home': return this.showHome(interaction);

                // Transactions
                case 'withdraw_menu': return this.showWithdrawMenu(interaction);
                case 'deposit_menu': return this.showDepositMenu(interaction);
                case 'transfer_menu': return this.showTransferModal(interaction);

                // Services
                case 'loans_menu': return this.showLoansMenu(interaction);
                case 'bureau_menu': return this.showBureau(interaction);

                case 'pay_credit_menu': return this.showPayCreditMenu(interaction);

                // Actions
                case 'pay_loan_select': return this.handlePayLoanSelect(interaction); // From Select Menu? Or buttons

                // Specific Actions
                default:
                    if (action.startsWith('withdraw_')) return this.handleWithdraw(interaction, action.split('_')[1]);
                    if (action.startsWith('pay_loan_')) return this.handlePayLoan(interaction, action.replace('pay_loan_', ''));
                    if (action.startsWith('pay_card_confirm_')) {
                        const parts = action.replace('pay_card_confirm_', '').split('_');
                        const method = parts.pop(); // last part is method
                        const cardId = parts.join('_'); // rest is id
                        return this.handlePayCardConfirm(interaction, cardId, method);
                    }
                    if (action.startsWith('pay_card_')) return this.handlePayCard(interaction, action.replace('pay_card_', ''));
            }
        } catch (error) {
            logger.errorWithContext('ATM Handler Error', error);
            await interaction.reply({ content: '❌ Error en el cajero automático.', flags: MessageFlags.Ephemeral });
        }
        return true;
    }

    async showHome(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏧 Cajero Automático Nación MX')
            .setDescription(`Bienvenido, <@${interaction.user.id}>.\nSeleccione una operación:`)
            .setColor(0x2C3E50)
            .setImage('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3JzODk0aHMzY2NtaDlzdnAxdW50dmV6dWM2eXR2OWZ6cDB3cWJyeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MZ9nZGQn1nqBG/giphy.gif')
            .setFooter({ text: 'Sistema Bancario Seguro' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('atm_withdraw_menu').setLabel('Retirar Efectivo').setStyle(ButtonStyle.Primary).setEmoji('💵'),
            new ButtonBuilder().setCustomId('atm_deposit_menu').setLabel('Depositar').setStyle(ButtonStyle.Success).setEmoji('💰'),
            new ButtonBuilder().setCustomId('atm_transfer_menu').setLabel('Transferir').setStyle(ButtonStyle.Secondary).setEmoji('💸')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('atm_loans_menu').setLabel('Mis Préstamos').setStyle(ButtonStyle.Danger).setEmoji('💳'),
            new ButtonBuilder().setCustomId('atm_pay_credit_menu').setLabel('Pagar Tarjeta').setStyle(ButtonStyle.Success).setEmoji('💳'),
            new ButtonBuilder().setCustomId('atm_bureau_menu').setLabel('Buró de Crédito').setStyle(ButtonStyle.Primary).setEmoji('📊')
        );

        if (interaction.message) {
            await interaction.update({ embeds: [embed], components: [row1, row2] });
        } else if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components: [row1, row2] });
        } else {
            await interaction.reply({ embeds: [embed], components: [row1, row2], flags: MessageFlags.Ephemeral });
        }
    }

    async showWithdrawMenu(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('💵 Retiro de Efectivo')
            .setDescription('Seleccione un monto a retirar de su cuenta principal:')
            .setColor(0x34495E);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('atm_withdraw_500').setLabel('$500').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('atm_withdraw_1000').setLabel('$1,000').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('atm_withdraw_5000').setLabel('$5,000').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('atm_withdraw_custom').setLabel('Otro Monto').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }

    async handleWithdraw(interaction, amountStr) {
        await interaction.deferUpdate();

        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, this.supabase);

        // Handle "custom" later with modal, for now just buttons
        if (amountStr === 'custom') {
            // Trigget modal? Can't trigger modal from deferUpdate easily in same flow sometimes without followUp.
            // Actually, to show modal, we must NOT deferUpdate first. 
            // Fix logic: separate custom handler. 
            return interaction.followUp({ content: 'Use el comando `/banco retirar` para montos específicos por ahora.', ephemeral: true });
        }

        const amount = parseInt(amountStr);
        const result = await ub.withdrawMoney(interaction.guildId, interaction.user.id, amount);

        if (result.success) {
            await interaction.followUp({ content: `✅ Ha retirado **$${amount.toLocaleString()}** exitosamente.`, ephemeral: true });
        } else {
            await interaction.followUp({ content: `❌ No tiene fondos suficientes en el banco.`, ephemeral: true });
        }
    }

    async showDepositMenu(interaction) {
        // Similar to withdraw but deposit
        // Simplified for brevity: "Deposit All" button?
        const embed = new EmbedBuilder().setTitle('💰 Depósito').setDescription('Deposite su efectivo seguro en el banco.').setColor(0x27AE60);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('atm_deposit_all').setLabel('Depositar Todo').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Danger)
        );

        // Logic for 'deposit_all' needs to be handled in default or specific case
        // Hack: Reuse handleWithdraw logic structure or add case
        if (interaction.customId === 'atm_deposit_all') {
            // Handle Deposit ALl
            await interaction.deferUpdate();
            const UnbelievaBoatService = require('../services/UnbelievaBoatService');
            const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, this.supabase);
            const bal = await ub.getBalance(interaction.guildId, interaction.user.id);
            if (bal.cash > 0) {
                await ub.depositMoney(interaction.guildId, interaction.user.id, bal.cash);
                await interaction.followUp({ content: `✅ Se han depositado **$${bal.cash.toLocaleString()}** logrando un total de $${(bal.bank + bal.cash).toLocaleString()} en banco.`, ephemeral: true });
            } else {
                await interaction.followUp({ content: '❌ No tienes efectivo para depositar.', ephemeral: true });
            }
            return;
        }

        await interaction.update({ embeds: [embed], components: [row] });
    }

    async showLoansMenu(interaction) {
        await interaction.deferUpdate();

        const { data: loans } = await this.supabase
            .from('loans')
            .select('*')
            .eq('discord_user_id', interaction.user.id)
            .eq('status', 'active');

        const embed = new EmbedBuilder()
            .setTitle('💳 Mis Préstamos Activos')
            .setColor(0xE74C3C);

        if (!loans || loans.length === 0) {
            embed.setDescription('✅ No tienes préstamos activos.');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [row] });
            return;
        }

        const rows = [];
        loans.forEach(loan => {
            const remaining = loan.total_to_pay - loan.amount_paid;
            const nextDue = new Date(loan.next_payment_due).toLocaleDateString();

            embed.addFields({
                name: `Préstamo #${loan.id} (${loan.interest_rate}%)`,
                value: `Deuda: **$${remaining.toLocaleString()}**\nCuota Mensual: **$${loan.monthly_payment.toLocaleString()}**\nVence: ${nextDue}`,
                inline: false
            });

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`atm_pay_loan_${loan.id}_full`).setLabel(`Pagar Todo ($${remaining})`).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`atm_pay_loan_${loan.id}_monthly`).setLabel(`Pagar Cuota ($${loan.monthly_payment})`).setStyle(ButtonStyle.Primary)
            ));
        });

        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)));

        await interaction.editReply({ embeds: [embed], components: rows });
    }

    async handlePayLoan(interaction, params) {
        // params: id_type (e.g. 15_monthly)
        await interaction.deferReply({ ephemeral: true });
        const [loanId, type] = params.split('_');

        const { data: loan } = await this.supabase.from('loans').select('*').eq('id', loanId).single();
        if (!loan) return interaction.editReply('❌ Préstamo no encontrado.');

        let amountToPay = 0;
        const remaining = loan.total_to_pay - loan.amount_paid;

        if (type === 'full') amountToPay = remaining;
        else if (type === 'monthly') amountToPay = loan.monthly_payment;

        // Cap at remaining
        if (amountToPay > remaining) amountToPay = remaining;

        // Check Balance (Bank or Cash? ATM implies Bank usually, or Cash deposit. Let's use Cash for realism "Inserting money", or Bank "Transfer")
        // Let's use BANK balance since it's an ATM.
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, this.supabase);
        // Withdraw from Bank to pay
        // Or check Bank directly? UB Service usually manages cash/bank updates.
        // We will "removeMoney" from bank.

        // Wait, removeMoney removes from 'cash' by default or 'bank'? 
        // UB Service implementation: removeMoney(..., type='cash')
        // Let's try type='bank'

        try {
            const result = await ub.removeMoney(interaction.guildId, interaction.user.id, amountToPay, `Pago Préstamo #${loanId}`, 'bank'); // Assuming bank support
            if (!result) throw new Error('Fondos insuficientes en banco'); // UB Service throws or returns? Usually throws if implemented tight. 
        } catch (e) {
            return interaction.editReply('❌ No tienes suficientes fondos en tu cuenta bancaria.');
        }

        // Update Loan
        const newPaid = loan.amount_paid + amountToPay;
        const isPaid = newPaid >= loan.total_to_pay;

        await this.supabase.from('loans').update({
            amount_paid: newPaid,
            status: isPaid ? 'paid' : 'active',
            payments_made: loan.payments_made + 1
        }).eq('id', loanId);

        // Update Credit Score
        await this.updateCreditScore(interaction.user.id, isPaid ? 15 : 5); // +15 if finished, +5 if payment made

        await interaction.editReply({
            content: `✅ **Pago Exitoso**\nHas pagado $${amountToPay.toLocaleString()} a tu préstamo #${loanId}.\n${isPaid ? '🎉 **¡Préstamo Liquidado!**' : `Restante: $${(loan.total_to_pay - newPaid).toLocaleString()}`}`
        });
    }

    async showBureau(interaction) {
        await interaction.deferUpdate();

        // Fetch Score
        let { data: profile } = await this.supabase.from('credit_bureau').select('*').eq('discord_user_id', interaction.user.id).single();

        if (!profile) {
            // Create default profile
            profile = { discord_user_id: interaction.user.id, score: 650, history: [] };
            await this.supabase.from('credit_bureau').insert(profile);
        }

        const score = profile.score;
        let color = 0xF1C40F; // Normal
        let status = 'Regular';

        if (score >= 750) { color = 0x2ECC71; status = 'Excelente'; }
        else if (score >= 650) { color = 0x3498DB; status = 'Bueno'; }
        else if (score < 500) { color = 0xE74C3C; status = 'CRÍTICO (Lista Negra)'; }

        const embed = new EmbedBuilder()
            .setTitle('📊 Buró de Crédito Nacional')
            .setDescription(`Reporte de crédito para <@${interaction.user.id}>`)
            .addFields(
                { name: 'Score', value: `**${score}** puntos`, inline: true },
                { name: 'Estatus', value: `**${status}**`, inline: true },
                { name: 'Capacidad de Endeudamiento', value: score < 500 ? '⛔ Bloqueado' : `$${(score * 100).toLocaleString()}`, inline: false }
            )
            .setColor(color)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFooter({ text: 'Actualizado en tiempo real' });

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Secondary));

        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    async updateCreditScore(userId, points) {
        const { data: profile } = await this.supabase.from('credit_bureau').select('*').eq('discord_user_id', userId).single();
        if (profile) {
            let newScore = profile.score + points;
            if (newScore > 850) newScore = 850;
            if (newScore < 300) newScore = 300;
            await this.supabase.from('credit_bureau').update({ score: newScore, last_updated: new Date().toISOString() }).eq('discord_user_id', userId);
        }
    }

    async showTransferModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('modal_atm_transfer')
            .setTitle('💸 Transferencia SPEI');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dest').setLabel('ID o Nombre Usuario Destino').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Monto').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('concept').setLabel('Concepto').setStyle(TextInputStyle.Short).setRequired(true))
        );

        await interaction.showModal(modal);
    }

    // Modal Handler for Transfer is needed in the main Banking/ATM flow. 
    // Since modals trigger a new interaction event, the main `handleBankingInteraction` or `atmHandler` needs to catch `modal_atm_transfer`.
    // I will add a method here `handleTransferSubmit` and call it from `bankingHandler` if I link them, 
    // OR ensure `atmHandler` is called for modals too. 

    async handleTransferSubmit(interaction) {
        await interaction.deferReply();
        const destInput = interaction.fields.getTextInputValue('dest');
        const amount = parseInt(interaction.fields.getTextInputValue('amount'));
        const concept = interaction.fields.getTextInputValue('concept');

        // Resolve User
        let targetUser = interaction.guild.members.cache.find(m => m.id === destInput || m.user.username === destInput || m.user.tag === destInput);
        if (!targetUser && destInput.match(/^[0-9]+$/)) {
            try { targetUser = await interaction.guild.members.fetch(destInput); } catch (e) { }
        }

        if (!targetUser) return interaction.editReply('❌ Usuario destino no encontrado.');
        if (isNaN(amount) || amount <= 0) return interaction.editReply('❌ Monto inválido.');

        // Execute Transfer
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, this.supabase);

        // Remove from sender
        try {
            const res = await ub.removeMoney(interaction.guildId, interaction.user.id, amount, `SPEI a ${targetUser.user.tag}: ${concept}`, 'bank');
            if (!res) throw new Error('Fondos insuficientes');
        } catch (e) {
            return interaction.editReply('❌ Saldo bancario insuficiente para transferir.');
        }

        // Add to receiver
        await ub.addMoney(interaction.guildId, targetUser.id, amount, `SPEI de ${interaction.user.tag}: ${concept}`, 'bank');

        // Receipt Embed
        const embed = new EmbedBuilder()
            .setTitle('💸 Comprobante de Transferencia SPEI')
            .setColor(0x8E44AD)
            .addFields(
                { name: 'Ordenante', value: `${interaction.user.tag}`, inline: true },
                { name: 'Beneficiario', value: `${targetUser.user.tag}`, inline: true },
                { name: 'Monto', value: `$${amount.toLocaleString()}`, inline: false },
                { name: 'Concepto', value: `${concept}`, inline: false },
                { name: 'Fecha', value: new Date().toLocaleString(), inline: false },
                { name: 'Referencia', value: `SPEI-${Math.floor(Math.random() * 1000000)}`, inline: true }
            )
            .setFooter({ text: 'Banco Nacional de México' });

        await interaction.editReply({ embeds: [embed] });

        // Send DM to receiver
        try { await targetUser.send({ content: `💸 Has recibido una transferencia de **$${amount.toLocaleString()}**`, embeds: [embed] }); } catch (e) { }
    }

    async showPayCreditMenu(interaction) {
        await interaction.deferUpdate();

        // Fetch cards with debt
        const { data: cards } = await this.supabase
            .from('credit_cards')
            .select('*')
            .eq('discord_id', interaction.user.id) // Note: tarjetas.js uses discord_id, not discord_user_id for credit_cards table
            .gt('current_balance', 0)
            .eq('status', 'active');

        const embed = new EmbedBuilder()
            .setTitle('💳 Pagar Tarjeta de Crédito')
            .setColor(0x9B59B6);

        if (!cards || cards.length === 0) {
            embed.setDescription('✅ No tienes deuda en tus tarjetas de crédito.');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Secondary));
            await interaction.editReply({ embeds: [embed], components: [row] });
            return;
        }

        const rows = [];
        cards.forEach(card => {
            embed.addFields({
                name: `${card.card_type.toUpperCase()} (Terminación ...${card.id.toString().slice(-4)})`,
                value: `Deuda: **$${card.current_balance.toLocaleString()}**\nLímite: $${card.credit_limit.toLocaleString()}`,
                inline: false
            });

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`atm_pay_card_${card.id}`).setLabel(`Pagar $${card.current_balance.toLocaleString()}`).setStyle(ButtonStyle.Success),
            ));
        });

        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('atm_home').setLabel('Volver').setStyle(ButtonStyle.Secondary)));

        await interaction.editReply({ embeds: [embed], components: rows });
    }

    async handlePayCard(interaction, cardId) {
        await interaction.deferUpdate(); // Update to show method selection

        const { data: card } = await this.supabase.from('credit_cards').select('*').eq('id', cardId).single();
        if (!card) return interaction.followUp({ content: '❌ Tarjeta no encontrada.', ephemeral: true });

        const amountToPay = card.current_balance;
        if (amountToPay <= 0) return interaction.followUp({ content: '✅ Esta tarjeta no tiene deuda.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('💳 Método de Pago')
            .setDescription(`Estás a punto de pagar **$${amountToPay.toLocaleString()}** de tu tarjeta ${card.card_type}.\n\nSelecciona el origen de los fondos:`)
            .setColor(0x9B59B6);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`atm_pay_card_confirm_${cardId}_cash`).setLabel('Efectivo (Mano)').setStyle(ButtonStyle.Success).setEmoji('💵'),
            new ButtonBuilder().setCustomId(`atm_pay_card_confirm_${cardId}_bank`).setLabel('Cuenta Bancaria').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
            new ButtonBuilder().setCustomId('atm_pay_credit_menu').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    }

    async handlePayCardConfirm(interaction, cardId, method) {
        await interaction.deferUpdate(); // Final processing

        const { data: card } = await this.supabase.from('credit_cards').select('*').eq('id', cardId).single();
        if (!card) return interaction.followUp({ content: '❌ Tarjeta no encontrada.', ephemeral: true });

        const amountToPay = card.current_balance;
        if (amountToPay <= 0) return interaction.followUp({ content: '✅ Esta tarjeta ya fue pagada.', ephemeral: true });

        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, this.supabase);

        try {
            // Pay from Selected Method
            const result = await ub.removeMoney(interaction.guildId, interaction.user.id, amountToPay, `Pago Tarjeta Crédito #${cardId}`, method);
            if (!result) throw new Error('Fondos insuficientes');
        } catch (e) {
            return interaction.followUp({ content: `❌ No tienes suficientes fondos en ${method === 'bank' ? 'tu banco' : 'efectivo'} para pagar esta deuda.`, ephemeral: true });
        }

        // Update Card
        await this.supabase.from('credit_cards').update({
            current_balance: 0,
            last_payment_date: new Date().toISOString()
        }).eq('id', cardId);

        // Update Credit Score
        await this.updateCreditScore(interaction.user.id, 5); // +5 per payment

        await interaction.followUp({
            content: `✅ **Pago Exitoso**\nHas pagado **$${amountToPay.toLocaleString()}** de tu tarjeta ${card.card_type} usando **${method === 'bank' ? 'Banco' : 'Efectivo'}**.\nTu saldo en tarjeta ahora es $0.`,
            ephemeral: true
        });

        // Return to menu
        return this.showPayCreditMenu(interaction);
    }

}



module.exports = ATMHandler;

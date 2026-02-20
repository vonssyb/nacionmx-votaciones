const BaseTicketStrategy = require('./BaseTicketStrategy');
const { TextInputBuilder, TextInputStyle, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class LoanTicketStrategy extends BaseTicketStrategy {
    constructor() {
        super('ticket_prestamo');
        this.loanDetails = null;
    }

    getModalFields() {
        return [
            new TextInputBuilder()
                .setCustomId('q_monto')
                .setLabel("💰 Monto a solicitar (mínimo $10,000):")
                .setPlaceholder("Ejemplo: 50000")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_plazo')
                .setLabel("📅 Plazo en meses (3, 6, 12 o 24):")
                .setPlaceholder("Ejemplo: 12")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            new TextInputBuilder()
                .setCustomId('q_motivo')
                .setLabel("📝 Motivo del préstamo:")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500)
        ];
    }

    async handleModalSubmit(interaction, client, supabase) {
        const montoStr = interaction.fields.getTextInputValue('q_monto');
        const plazoStr = interaction.fields.getTextInputValue('q_plazo');
        const motivo = interaction.fields.getTextInputValue('q_motivo');

        const monto = parseInt(montoStr.replace(/[^0-9]/g, ''));
        const plazo = parseInt(plazoStr);

        if (isNaN(monto) || monto < 10000) {
            return interaction.editReply('❌ El monto mínimo es $10,000.'); // Use editReply because Base defers
        }

        const validPlazos = [3, 6, 12, 24];
        if (!validPlazos.includes(plazo)) {
            return interaction.editReply('❌ El plazo debe ser 3, 6, 12 o 24 meses.');
        }

        const interestRate = 5.00;
        const monthlyInterestRate = (interestRate / 100) / 12;
        const monthlyPayment = Math.ceil((monto * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, plazo)) / (Math.pow(1 + monthlyInterestRate, plazo) - 1));
        const totalToPay = monthlyPayment * plazo;
        const totalInterest = totalToPay - monto;

        this.loanDetails = {
            monto,
            plazo,
            motivo,
            monthlyPayment,
            totalToPay,
            totalInterest,
            interestRate
        };

        // Pass control to Base
        await super.handleModalSubmit(interaction, client, supabase);
    }

    async sendWelcomeMessage(channel, interaction, description, client, supabase) {
        // We defer sending the component until onTicketCreated where we have the ID
        // But we can send the Embed here.

        const embed = new EmbedBuilder()
            .setTitle('💰 Solicitud de Préstamo - Pendiente')
            .setColor(0xF1C40F)
            .setDescription(`**Solicitante:** ${interaction.user}\n**Motivo:** ${this.loanDetails.motivo}`)
            .addFields(
                { name: '💵 Monto Solicitado', value: `$${this.loanDetails.monto.toLocaleString()}`, inline: true },
                { name: '📅 Plazo', value: `${this.loanDetails.plazo} meses`, inline: true },
                { name: '📊 Tasa Interés', value: `${this.loanDetails.interestRate}% anual`, inline: true },
                { name: '💳 Pago Mensual', value: `$${this.loanDetails.monthlyPayment.toLocaleString()}`, inline: true },
                { name: '💰 Total a Pagar', value: `**$${this.loanDetails.totalToPay.toLocaleString()}**`, inline: true },
                { name: '📈 Intereses', value: `$${this.loanDetails.totalInterest.toLocaleString()}`, inline: true }
            )
            .setFooter({ text: 'Procesando solicitud...' })
            .setTimestamp();

        // Send payload and store message for later editing if needed
        this.welcomeMessage = await channel.send({
            content: `${interaction.user}`,
            embeds: [embed]
        });
    }

    async onTicketCreated(channel, interaction, ticketData, client, supabase) {
        // 1. Insert Loan Record
        const { data: loan, error } = await supabase.from('loans').insert([{
            discord_user_id: interaction.user.id,
            loan_amount: this.loanDetails.monto,
            term_months: this.loanDetails.plazo,
            purpose: this.loanDetails.motivo,
            status: 'pending',
            monthly_payment: this.loanDetails.monthlyPayment,
            total_to_pay: this.loanDetails.totalToPay,
            original_loan_amount: this.loanDetails.monto,
            original_term_months: this.loanDetails.plazo,
            ticket_id: ticketData.id
        }]).select().single();

        if (error) {
            console.error('Error creating loan record:', error);
            await channel.send('❌ Error critico al guardar solicitud de préstamo.');
            return;
        }

        // 2. Add Buttons with Loan ID
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`btn_approve_loan:${loan.id}`).setLabel('✅ Aprobar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`btn_modify_loan:${loan.id}`).setLabel('✏️ Modificar / Contraoferta').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`btn_reject_loan:${loan.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
        );

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
        );

        if (this.welcomeMessage) {
            await this.welcomeMessage.edit({ components: [row, closeRow] });
        } else {
            await channel.send({ components: [row, closeRow] });
        }
    }
}

module.exports = LoanTicketStrategy;

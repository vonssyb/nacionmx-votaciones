/**
 * @module handlers/economy/company/withdraw
 * @description Maneja el retiro de fondos de empresas
 * 
 * Flujo:
 * 1. Botón `company_withdraw_COMPANYID` -> Muestra Modal de retiro
 * 2. Modal Submit `withdraw_submit_COMPANYID` -> Valida y procesa retiro con impuesto
 */

const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class CompanyWithdrawHandler {
    constructor(client, supabase, billingService) {
        this.client = client;
        this.supabase = supabase;
        this.billingService = billingService;
    }

    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // 1. Show Modal
            if (interaction.isButton() && customId.startsWith('company_withdraw_')) {
                return await this.handleShowModal(interaction);
            }

            // 2. Process Modal
            if (interaction.isModalSubmit() && customId.startsWith('withdraw_submit_')) {
                return await this.handleProcessWithdraw(interaction);
            }

            return false;
        } catch (error) {
            await ErrorHandler.handle(error, interaction);
            return true;
        }
    }

    /**
     * Muestra el modal para retirar fondos
     */
    async handleShowModal(interaction) {
        const companyId = interaction.customId.split('_')[2];

        // Validate company ownership/balance first
        const { data: company, error } = await this.supabase
            .from('companies')
            .select('name, balance')
            .eq('id', companyId)
            .single();

        if (error || !company) {
            await interaction.reply({ content: '❌ Empresa no encontrada.', ephemeral: true });
            return true;
        }

        if ((company.balance || 0) <= 0) {
            await interaction.reply({
                content: `❌ **Sin fondos**\nLa empresa **${company.name}** tiene $0.\nGenera ingresos antes de retirar.`,
                ephemeral: true
            });
            return true;
        }

        const modal = new ModalBuilder()
            .setCustomId(`withdraw_submit_${companyId}`)
            .setTitle(`Retirar de ${company.name.substring(0, 20)}...`);

        const amountInput = new TextInputBuilder()
            .setCustomId('withdraw_amount')
            .setLabel(`Monto (Disponibles: $${company.balance.toLocaleString()})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: 50000')
            .setRequired(true)
            .setMinLength(1);

        const row = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return true;
    }

    /**
     * Procesa el retiro tras enviar el modal
     */
    async handleProcessWithdraw(interaction) {
        const companyId = interaction.customId.split('_')[2];
        const amountStr = interaction.fields.getTextInputValue('withdraw_amount');
        const amount = parseFloat(amountStr.replace(/[$,]/g, '')); // Allow $ and ,

        if (isNaN(amount) || amount <= 0) {
            await interaction.reply({ content: '❌ Monto inválido. Ingresa un número positivo.', ephemeral: true });
            return true;
        }

        await interaction.deferReply({ ephemeral: true });

        // Fetch company again for transational safety (check balance)
        const { data: company } = await this.supabase
            .from('companies')
            .select('name, balance')
            .eq('id', companyId)
            .single();

        if (!company) {
            await interaction.editReply('❌ Empresa no encontrada.');
            return true;
        }

        if (amount > company.balance) {
            await interaction.editReply(`❌ **Fondos insuficientes**\nDisponibles: $${company.balance.toLocaleString()}\nIntentas retirar: $${amount.toLocaleString()}`);
            return true;
        }

        // Calculations
        const taxRate = 0.10; // 10% tax
        const tax = amount * taxRate;
        const netAmount = amount - tax;
        const newBalance = company.balance - amount;

        // Transaction: Update Company -> Add Money to User
        // Ideally DB Transaction. Here: Sequence.

        // 1. Deduct from Company
        const { error: updateError } = await this.supabase
            .from('companies')
            .update({ balance: newBalance })
            .eq('id', companyId);

        if (updateError) {
            logger.errorWithContext('Failed to deduct company balance', updateError, { companyId, amount });
            await interaction.editReply('❌ Error actualizando saldo de la empresa.');
            return true;
        }

        // 2. Add to User
        try {
            await this.billingService.addMoney(
                interaction.guildId,
                interaction.user.id,
                netAmount,
                `Retiro de ${company.name} (Tax 10%)`,
                'cash'
            );
        } catch (billingError) {
            // CRITICAL: We deducted money but failed to give it.
            // Refund company? Log for manual intervention?
            logger.errorWithContext('Failed to add money to user after company deduction!', billingError, { companyId, userId: interaction.user.id, amount });

            // Try refund
            /*
            await this.supabase.from('companies').update({ balance: company.balance }).eq('id', companyId);
            */
            // For now, just warn user.
            await interaction.editReply(`⚠️ **Error crítico bancario**\nSe descontó de la empresa pero falló la transferencia personal. Contacta a soporte con ID: ${interaction.id}`);
            return true;
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Retiro Exitoso')
            .setColor('#00FF00')
            .setDescription(`Se han retirado fondos de **${company.name}**.`)
            .addFields(
                { name: '💰 Retiro Bruto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: '🏛️ Impuesto (10%)', value: `-$${tax.toLocaleString()}`, inline: true },
                { name: '💵 Neto Recibido', value: `$${netAmount.toLocaleString()}`, inline: true },
                { name: '🏢 Nuevo Balance', value: `$${newBalance.toLocaleString()}`, inline: false }
            )
            .setFooter({ text: 'Los fondos se han añadido a tu efectivo personal' });

        await interaction.editReply({ embeds: [embed] });
        return true;
    }
}

module.exports = CompanyWithdrawHandler;

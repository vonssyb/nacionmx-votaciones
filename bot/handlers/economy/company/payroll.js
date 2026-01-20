/**
 * @module handlers/economy/company/payroll
 * @description Maneja el pago de nóminas empresariales
 * 
 * Flujo:
 * 1. `company_payroll_COMPANYID` -> Muestra selector de grupos de nómina
 * 2. `payroll_select_COMPANYID` -> Calcula total y muestra opciones de pago
 * 3. `payroll_pay_METHOD_GROUPID_AMOUNT` -> Procesa cobro al dueño y pagos a empleados
 */

const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class CompanyPayrollHandler {
    constructor(client, supabase, paymentProcessor, billingService) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
        this.billingService = billingService;
    }

    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            if (interaction.isButton()) {
                if (customId.startsWith('company_payroll_')) {
                    return await this.handleStart(interaction);
                }
                if (customId.startsWith('payroll_pay_')) {
                    return await this.handlePayment(interaction);
                }
            }

            if (interaction.isStringSelectMenu() && customId.startsWith('payroll_select_')) {
                return await this.handleGroupSelection(interaction);
            }

            return false;
        } catch (error) {
            await ErrorHandler.handle(error, interaction);
            return true;
        }
    }

    /**
     * Paso 1: Mostrar grupos de nómina
     */
    async handleStart(interaction) {
        const companyId = interaction.customId.split('_')[2];
        await interaction.deferReply({ ephemeral: true });

        // Get groups owned by user (legacy logic checked owner_discord_id)
        // Check if DB column is correct. Legacy: .eq('owner_discord_id', interaction.user.id)
        const { data: groups, error } = await this.supabase
            .from('payroll_groups')
            .select('*')
            .eq('owner_discord_id', interaction.user.id);

        if (error) throw error;

        if (!groups || groups.length === 0) {
            await interaction.editReply({
                content: `❌ **No tienes grupos de nómina**\n\nCrea uno con \`/nomina crear nombre:MiGrupo\``
            });
            return true;
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`payroll_select_${companyId}`)
            .setPlaceholder('Selecciona grupo de nómina a pagar')
            .addOptions(groups.map(g => ({
                label: g.name,
                description: 'Grupo de nómina',
                value: g.id.toString(),
                emoji: '💼'
            })));

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.editReply({
            content: '💼 **Pago de Nómina**\nSelecciona el grupo de empleados a pagar:',
            components: [row]
        });
        return true;
    }

    /**
     * Paso 2: Calcular total y pedir método de pago
     */
    async handleGroupSelection(interaction) {
        const groupId = interaction.values[0];
        const companyId = interaction.customId.split('_')[2];

        await interaction.deferUpdate();

        // Get Members
        const { data: members, error } = await this.supabase
            .from('payroll_members')
            .select('*')
            .eq('group_id', groupId);

        if (error) throw error;

        if (!members || members.length === 0) {
            await interaction.followUp({ content: '❌ Este grupo no tiene empleados asignados.', ephemeral: true });
            return true;
        }

        // Calculate Total
        const totalAmount = members.reduce((sum, m) => sum + (m.salary || 0), 0);

        // Payment Buttons
        const row = new ActionRowBuilder().addComponents(
            { type: 2, label: '💵 Efectivo', style: 1, custom_id: `payroll_pay_cash_${groupId}_${totalAmount}` },
            { type: 2, label: '🏦 Banco', style: 1, custom_id: `payroll_pay_bank_${groupId}_${totalAmount}` }
        );

        const embed = new EmbedBuilder()
            .setTitle(`💼 Confirmar Nómina`)
            .setColor('#5865F2')
            .setDescription(`Se pagará a **${members.length} empleados**.`)
            .addFields(
                { name: '💰 Total a Pagar', value: `$${totalAmount.toLocaleString()}`, inline: true },
                { name: '👥 Empleados', value: `${members.length}`, inline: true }
            )
            .setFooter({ text: 'El dinero saldrá de tu cuenta personal' });

        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: [row]
        });
        return true;
    }

    /**
     * Paso 3: Cobrar y Distribuir
     */
    async handlePayment(interaction) {
        const parts = interaction.customId.split('_');
        // payroll_pay_METHOD_GROUPID_AMOUNT
        const method = parts[2];
        const groupId = parts[3];
        const totalAmount = parseFloat(parts[4]);

        await interaction.deferUpdate();

        // 1. Process Charge (From User)
        const paymentResult = await this.paymentProcessor.processPayment(
            method,
            interaction.user.id,
            interaction.guildId,
            totalAmount,
            `Pago de Nómina (Grupo ${groupId})`
        );

        if (!paymentResult.success) {
            await interaction.followUp({
                content: `❌ **Error en el cobro**\n${paymentResult.error}`,
                ephemeral: true
            });
            return true;
        }

        // 2. Fetch Members again to ensure up-to-date (stateless)
        const { data: members } = await this.supabase
            .from('payroll_members')
            .select('*')
            .eq('group_id', groupId);

        if (!members || members.length === 0) {
            logger.error('Payroll paid but no members found to distribute', { groupId, totalAmount });
            await interaction.followUp({ content: '⚠️ Cobro exitoso pero no se encontraron empleados para distribuir. Contacta a soporte.' });
            return true;
        }

        // 3. Distribute (Payout loop)
        // Ideally this should be a batch transaction or safer flow, but mirroring legacy logic for now.
        let report = `✅ **Nómina Pagada**\n\n💰 Total: $${totalAmount.toLocaleString()}\n💳 Método: ${paymentResult.methodName}\n\n**Empleados:**\n`;
        let successCount = 0;
        let failCount = 0;

        // Use billingService injected
        for (const m of members) {
            try {
                if (m.salary > 0) {
                    await this.billingService.addMoney(
                        interaction.guildId,
                        m.member_discord_id,
                        m.salary,
                        `Nómina de ${interaction.user.username}`,
                        'cash' // Employees receive in cash always? Legacy says yes.
                    );
                    report += `✅ <@${m.member_discord_id}>: $${m.salary.toLocaleString()}\n`;
                    successCount++;
                }
            } catch (err) {
                logger.errorWithContext('Failed to pay employee in payroll', err, { memberId: m.member_discord_id });
                report += `❌ <@${m.member_discord_id}>: Error ($${m.salary})\n`;
                failCount++;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Dispersión Completada')
            .setColor('#00FF00')
            .setDescription(report.substring(0, 4096)); // Safety truncate

        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: []
        });

        logger.info('Payroll completed', {
            payer: interaction.user.id,
            groupId,
            totalAmount,
            successCount,
            failCount
        });

        return true;
    }
}

module.exports = CompanyPayrollHandler;

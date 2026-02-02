const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const logger = require('../services/Logger');

/**
 * Handler for Dealership Payment Buttons
 * Handles: pay_cash_{saleId}, pay_finance_{saleId}, cancel_sale_{saleId}, approve_sale_{saleId}
 */

//  Roles to assign when someone purchases a vehicle
const DEALERSHIP_CUSTOMER_ROLES = [
    '1466559667013681422', // Primer rol de cliente
    '1466559974435061881'  // Segundo rol de cliente
];

module.exports = async (interaction, client, supabase) => {
    try {
        const { customId, user, guild } = interaction;

        // Parse button ID
        if (!customId.startsWith('pay_cash_') && !customId.startsWith('pay_finance_') &&
            !customId.startsWith('cancel_sale_') && !customId.startsWith('approve_sale_')) {
            return false;
        }

        await interaction.deferReply({ ephemeral: true });

        // Handle different button types
        if (customId.startsWith('pay_cash_')) {
            await handleCashPayment(interaction, client, supabase);
        } else if (customId.startsWith('pay_finance_')) {
            await handleFinancePayment(interaction, client, supabase);
        } else if (customId.startsWith('cancel_sale_')) {
            await handleCancelSale(interaction, client, supabase);
        } else if (customId.startsWith('approve_sale_')) {
            await handleApproveSale(interaction, client, supabase);
        }

        return true;

    } catch (error) {
        logger.errorWithContext('Dealership button handler error', error, interaction);
        await interaction.editReply('❌ Ocurrió un error al procesar tu solicitud.').catch(() => { });
        return false;
    }
};

async function handleCashPayment(interaction, client, supabase) {
    const saleId = interaction.customId.split('_')[2];

    // Get sale details
    const { data: sale, error } = await supabase
        .from('dealership_sales')
        .select('*, dealership_catalog(*)')
        .eq('id', saleId)
        .single();

    if (error || !sale) {
        return interaction.editReply('❌ No se encontró la solicitud de compra.');
    }

    if (sale.user_id !== interaction.user.id) {
        return interaction.editReply('❌ Esta solicitud no te pertenece.');
    }

    // Get user balance
    let userBalance = 0;
    try {
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
        const balance = await ubService.getUserBalance(interaction.guildId, interaction.user.id);
        userBalance = (balance?.cash || 0) + (balance?.bank || 0);
    } catch (e) {
        logger.error('Failed to fetch UB balance:', e);
    }

    if (userBalance < sale.price_total) {
        return interaction.editReply(`❌ No tienes suficiente dinero. Necesitas $${sale.price_total.toLocaleString()} pero solo tienes $${userBalance.toLocaleString()}.`);
    }

    // Deduct money
    try {
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
        await ubService.deductBalance(interaction.guildId, interaction.user.id, sale.price_total, `Compra: ${sale.dealership_catalog.make} ${sale.dealership_catalog.model}`);
    } catch (e) {
        logger.error('Failed to deduct balance:', e);
        return interaction.editReply('❌ Error al procesar el pago. Contacta a un administrador.');
    }

    // Update sale status
    await supabase
        .from('dealership_sales')
        .update({
            status: 'pending_approval',
            payment_method: 'cash',
            amount_paid: sale.price_total,
            updated_at: new Date().toISOString()
        })
        .eq('id', saleId);

    // Decrease vehicle stock
    await supabase
        .from('dealership_catalog')
        .update({ stock: sale.dealership_catalog.stock - 1 })
        .eq('id', sale.vehicle_id);

    // Assign customer roles
    const member = await interaction.guild.members.fetch(interaction.user.id);
    for (const roleId of DEALERSHIP_CUSTOMER_ROLES) {
        try {
            await member.roles.add(roleId);
        } catch (e) {
            logger.error(`Failed to add role ${roleId}:`, e.message);
        }
    }

    // Update message
    const successEmbed = new EmbedBuilder()
        .setTitle('✅ Pago Procesado')
        .setDescription(`Se ha procesado tu pago de **$${sale.price_total.toLocaleString()}** por el **${sale.dealership_catalog.make} ${sale.dealership_catalog.model}**.`)
        .addFields(
            { name: '📋 Estado', value: 'Pendiente de aprobación por vendedor' },
            { name: '🎟️ Roles', value: 'Se te han asignado los roles de cliente del concesionario' }
        )
        .setColor('#00FF00');

    await interaction.message.edit({
        embeds: [successEmbed],
        components: [] // Remove buttons
    });

    await interaction.editReply('✅ ¡Pago exitoso! Un vendedor revisará tu solicitud pronto.');

    // Notify staff
    const { data: staffRoleData } = await supabase.from('dealership_settings').select('value').eq('key', 'role_staff').single();
    if (staffRoleData?.value && staffRoleData.value !== "000000000000000000") {
        const approveButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_sale_${saleId}`)
                .setLabel('✅ Aprobar y Entregar')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({
            content: `<@&${staffRoleData.value}> Nueva solicitud de compra lista para aprobación.`,
            components: [approveButton]
        });
    }
}

async function handleFinancePayment(interaction, client, supabase) {
    const saleId = interaction.customId.split('_')[2];

    const { data: sale, error } = await supabase
        .from('dealership_sales')
        .select('*, dealership_catalog(*)')
        .eq('id', saleId)
        .single();

    if (error || !sale) {
        return interaction.editReply('❌ No se encontró la solicitud de compra.');
    }

    if (sale.user_id !== interaction.user.id) {
        return interaction.editReply('❌ Esta solicitud no te pertenece.');
    }

    // Get finance settings
    const { data: financeSettings } = await supabase
        .from('dealership_settings')
        .select('value')
        .eq('key', 'finance_rates')
        .single();

    const rates = financeSettings?.value || { down_payment_percent: 20, interest_rate: 5, max_installments: 10 };

    const downPayment = Math.ceil(sale.price_total * (rates.down_payment_percent / 100));
    const financeAmount = sale.price_total - downPayment;
    const totalWithInterest = Math.ceil(financeAmount * (1 + rates.interest_rate / 100));
    const installmentAmount = Math.ceil(totalWithInterest / rates.max_installments);

    // Check down payment
    let userBalance = 0;
    try {
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
        const balance = await ubService.getUserBalance(interaction.guildId, interaction.user.id);
        userBalance = (balance?.cash || 0) + (balance?.bank || 0);
    } catch (e) {
        logger.error('Failed to fetch UB balance:', e);
    }

    if (userBalance < downPayment) {
        return interaction.editReply(`❌ No tienes suficiente para el enganche de $${downPayment.toLocaleString()}. Tienes $${userBalance.toLocaleString()}.`);
    }

    // Deduct down payment
    try {
        const UnbelievaBoatService = require('../services/UnbelievaBoatService');
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
        await ubService.deductBalance(interaction.guildId, interaction.user.id, downPayment, `Enganche: ${sale.dealership_catalog.make} ${sale.dealership_catalog.model}`);
    } catch (e) {
        logger.error('Failed to deduct balance:', e);
        return interaction.editReply('❌ Error al procesar el enganche.');
    }

    // Update sale with finance plan
    await supabase
        .from('dealership_sales')
        .update({
            status: 'financing',
            payment_method: 'finance',
            amount_paid: downPayment,
            finance_plan: {
                total_installments: rates.max_installments,
                paid_installments: 0,
                amount_per_installment: installmentAmount,
                next_payment_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
            },
            updated_at: new Date().toISOString()
        })
        .eq('id', saleId);

    // Decrease stock
    await supabase
        .from('dealership_catalog')
        .update({ stock: sale.dealership_catalog.stock - 1 })
        .eq('id', sale.vehicle_id);

    // Assign customer roles
    const member = await interaction.guild.members.fetch(interaction.user.id);
    for (const roleId of DEALERSHIP_CUSTOMER_ROLES) {
        try {
            await member.roles.add(roleId);
        } catch (e) {
            logger.error(`Failed to add role ${roleId}:`, e.message);
        }
    }

    const financeEmbed = new EmbedBuilder()
        .setTitle('🏦 Financiamiento Aprobado')
        .setDescription(`Has pagado el enganche de **$${downPayment.toLocaleString()}** para el **${sale.dealership_catalog.make} ${sale.dealership_catalog.model}**.`)
        .addFields(
            { name: '💰 Monto Financiado', value: `$${totalWithInterest.toLocaleString()}`, inline: true },
            { name: '📅 Pagos', value: `${rates.max_installments} quincenales`, inline: true },
            { name: '💵 Pago Quincenal', value: `$${installmentAmount.toLocaleString()}`, inline: true },
            { name: '🎟️ Roles', value: 'Se te han asignado los roles de cliente' }
        )
        .setColor('#0099FF');

    await interaction.message.edit({
        embeds: [financeEmbed],
        components: []
    });

    await interaction.editReply('✅ ¡Financiamiento aprobado! Recibirás recordatorios de pago.');
}

async function handleCancelSale(interaction, client, supabase) {
    const saleId = interaction.customId.split('_')[2];

    const { data: sale } = await supabase
        .from('dealership_sales')
        .select('*')
        .eq('id', saleId)
        .single();

    if (!sale) {
        return interaction.editReply('❌ No se encontró la solicitud.');
    }

    if (sale.user_id !== interaction.user.id) {
        return interaction.editReply('❌ Esta solicitud no te pertenece.');
    }

    // Delete sale
    await supabase.from('dealership_sales').delete().eq('id', saleId);

    await interaction.editReply('✅ Solicitud cancelada. Este ticket se cerrará en 10 segundos.');

    // Close ticket channel
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (e) {
            logger.error('Failed to delete ticket channel:', e.message);
        }
    }, 10000);
}

async function handleApproveSale(interaction, client, supabase) {
    const saleId = interaction.customId.split('_')[2];

    const { data: sale, error } = await supabase
        .from('dealership_sales')
        .select('*, dealership_catalog(*)')
        .eq('id', saleId)
        .single();

    if (error || !sale) {
        return interaction.editReply('❌ No se encontró la solicitud de compra.');
    }

    // Update to completed
    await supabase
        .from('dealership_sales')
        .update({
            status: 'completed',
            approver_id: interaction.user.id,
            delivery_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', saleId);

    const deliveryEmbed = new EmbedBuilder()
        .setTitle('🎉 Vehículo Entregado')
        .setDescription(`El **${sale.dealership_catalog.make} ${sale.dealership_catalog.model}** ha sido entregado exitosamente.`)
        .addFields(
            { name: '📋 Aprobado por', value: `<@${interaction.user.id}>` },
            { name: '✅ Estado', value: 'Completado' }
        )
        .setColor('#00FF00')
        .setTimestamp();

    await interaction.message.edit({
        embeds: [deliveryEmbed],
        components: []
    });

    await interaction.editReply('✅ Venta completada y vehículo entregado.');

    // Notify customer
    try {
        const customer = await client.users.fetch(sale.user_id);
        await customer.send({
            embeds: [new EmbedBuilder()
                .setTitle('🚗 ¡Felicidades por tu nuevo vehículo!')
                .setDescription(`Tu **${sale.dealership_catalog.make} ${sale.dealership_catalog.model}** está listo.`)
                .setImage(sale.dealership_catalog.image_url)
                .setColor('#00FF00')
            ]
        });
    } catch (e) {
        logger.error('Failed to DM customer:', e.message);
    }
}

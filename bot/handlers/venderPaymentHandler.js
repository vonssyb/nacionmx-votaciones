const { EmbedBuilder } = require('discord.js');
const logger = require('../services/Logger');

/**
 * Handler para los botones de pago del comando /vender
 * Maneja: efectivo, crédito, financiamiento y cancelación
 */
module.exports = async function venderPaymentHandler(interaction, client, supabase) {
    const customId = interaction.customId;

    // Parse button ID: venta_tipo_vehiculoId_clienteId
    const parts = customId.split('_');
    const tipo = parts[1]; // efectivo, credito, financiamiento, cancelar
    const vehiculoId = parseInt(parts[2]);
    const clienteId = parts[3];

    await interaction.deferUpdate();

    try {
        // Manejar cancelación
        if (tipo === 'cancelar') {
            await interaction.editReply({
                content: '❌ Venta cancelada.',
                embeds: [],
                components: []
            });
            return true;
        }

        // Obtener información del vehículo
        const { data: vehiculo, error: vError } = await supabase
            .from('dealership_catalog')
            .select('*')
            .eq('id', vehiculoId)
            .single();

        if (vError || !vehiculo) {
            await interaction.editReply({
                content: '❌ Error: Vehículo no encontrado.',
                embeds: [],
                components: []
            });
            return true;
        }

        // Verificar stock
        if (vehiculo.stock <= 0) {
            await interaction.editReply({
                content: '❌ Este vehículo ya no tiene stock disponible.',
                embeds: [],
                components: []
            });
            return true;
        }

        const cliente = await client.users.fetch(clienteId);
        const asesor = interaction.user;

        // Obtener balance del cliente via UnbelievaBoat
        let clienteBalance = { cash: 0, bank: 0 };
        if (process.env.UNBELIEVABOAT_TOKEN) {
            try {
                const UnbelievaBoatService = require('../services/UnbelievaBoatService');
                const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
                clienteBalance = await ubService.getUserBalance(interaction.guildId, clienteId) || { cash: 0, bank: 0 };
            } catch (e) {
                logger.error('[VENDER] Error getting balance:', e);
            }
        }

        const totalDinero = (clienteBalance.cash || 0) + (clienteBalance.bank || 0);

        // Procesar según tipo de pago
        if (tipo === 'efectivo') {
            return await handleEfectivoPayment(interaction, supabase, vehiculo, cliente, asesor, totalDinero);
        } else if (tipo === 'credito') {
            return await handleCreditoPayment(interaction, supabase, vehiculo, cliente, asesor);
        } else if (tipo === 'financiamiento') {
            return await handleFinanciamientoPayment(interaction, supabase, vehiculo, cliente, asesor, totalDinero);
        }

    } catch (error) {
        logger.error('[VENDER] Payment handler error:', error);
        await interaction.editReply({
            content: '❌ Error procesando el pago.',
            embeds: [],
            components: []
        });
        return true;
    }

    return true;
};

/**
 * Pago en efectivo/débito - Pago completo inmediato
 */
async function handleEfectivoPayment(interaction, supabase, vehiculo, cliente, asesor, totalDinero) {
    const precio = vehiculo.price;

    if (totalDinero < precio) {
        await interaction.editReply({
            content: `❌ **${cliente.tag}** no tiene suficiente dinero.\\n💰 Tiene: $${totalDinero.toLocaleString()}\\n💵 Necesita: $${precio.toLocaleString()}`,
            embeds: [],
            components: []
        });
        return true;
    }

    try {
        // Descontar dinero via UnbelievaBoat
        if (process.env.UNBELIEVABOAT_TOKEN) {
            const UnbelievaBoatService = require('../services/UnbelievaBoatService');
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

            const balance = await ubService.getUserBalance(interaction.guildId, cliente.id);
            const newCash = Math.max(0, (balance.cash || 0) - precio);
            const remaining = precio - (balance.cash || 0);
            const newBank = remaining > 0 ? Math.max(0, (balance.bank || 0) - remaining) : (balance.bank || 0);

            await ubService.setBalance(interaction.guildId, cliente.id, {
                cash: newCash,
                bank: newBank
            }, `Compra vehículo: ${vehiculo.make} ${vehiculo.model}`);
        }

        // Registrar venta en BD
        const { error: saleError } = await supabase.from('dealership_sales').insert({
            user_id: cliente.id,
            vehicle_id: vehiculo.id,
            sale_price: precio,
            payment_method: 'cash',
            advisor_id: asesor.id,
            guild_id: interaction.guildId
        });

        if (saleError) throw saleError;

        // Reducir stock
        await supabase.from('dealership_catalog')
            .update({ stock: vehiculo.stock - 1 })
            .eq('id', vehiculo.id);

        // Embed de confirmación
        const embed = new EmbedBuilder()
            .setTitle('✅ Venta Completada - Pago en Efectivo')
            .setDescription(`**Cliente:** ${cliente.tag}\\n**Asesor:** ${asesor.tag}`)
            .addFields(
                { name: '🚗 Vehículo', value: `${vehiculo.make} ${vehiculo.model} (${vehiculo.year})` },
                { name: '💰 Precio Pagado', value: `$${precio.toLocaleString()}` },
                { name: '💵 Método', value: 'Efectivo/Débito - Pago completo' },
                { name: '📋 Estado', value: '✅ Entregado' }
            )
            .setColor('#00FF00')
            .setThumbnail(vehiculo.image_url)
            .setFooter({ text: 'McQueen Concesionario' })
            .setTimestamp();

        await interaction.editReply({
            content: `🎉 ${cliente}, ¡Felicidades por tu nuevo ${vehiculo.make} ${vehiculo.model}!`,
            embeds: [embed],
            components: []
        });

        logger.info(`[VENDER] Cash sale completed: ${cliente.tag} bought ${vehiculo.make} ${vehiculo.model} for $${precio}`);

    } catch (error) {
        logger.error('[VENDER] Efectivo payment error:', error);
        await interaction.editReply({
            content: '❌ Error al procesar el pago en efectivo.',
            embeds: [],
            components: []
        });
    }

    return true;
}

/**
 * Pago con tarjeta de crédito - Usar tarjetas registradas
 */
async function handleCreditoPayment(interaction, supabase, vehiculo, cliente, asesor) {
    const precio = vehiculo.price;

    try {
        // Obtener tarjetas del cliente
        const { data: tarjetas } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('discord_id', cliente.id)
            .order('created_at', { ascending: false });

        if (!tarjetas || tarjetas.length === 0) {
            await interaction.editReply({
                content: `❌ **${cliente.tag}** no tiene tarjetas de crédito registradas.\\n💡 Debe usar \`/registrar-tarjeta\` primero.`,
                embeds: [],
                components: []
            });
            return true;
        }

        // Buscar tarjeta con suficiente permiso y calcular deuda actual
        const tarjetaDisponible = tarjetas.find(t => {
            const limit = t.card_limit || t.credit_limit || 0;
            const currentDebt = t.current_balance || 0;
            const available = limit - currentDebt;
            return available >= precio;
        });

        if (!tarjetaDisponible) {
            await interaction.editReply({
                content: `❌ Ninguna tarjeta de **${cliente.tag}** tiene límite suficiente.\\n💰 Precio: $${precio.toLocaleString()}`,
                embeds: [],
                components: []
            });
            return true;
        }

        // Registrar venta
        const { error: saleError } = await supabase.from('dealership_sales').insert({
            user_id: cliente.id,
            vehicle_id: vehiculo.id,
            sale_price: precio,
            payment_method: 'credit_card',
            advisor_id: asesor.id,
            guild_id: interaction.guildId,
            metadata: {
                card_last4: tarjetaDisponible.card_number.slice(-4),
                card_type: tarjetaDisponible.card_type
            }
        });

        if (saleError) throw saleError;

        // Aumentar deuda de tarjeta
        const currentDebt = tarjetaDisponible.current_balance || 0;
        await supabase.from('credit_cards')
            .update({ current_balance: currentDebt + precio })
            .eq('id', tarjetaDisponible.id);

        // Reducir stock
        await supabase.from('dealership_catalog')
            .update({ stock: vehiculo.stock - 1 })
            .eq('id', vehiculo.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Venta Completada - Tarjeta de Crédito')
            .setDescription(`**Cliente:** ${cliente.tag}\\n**Asesor:** ${asesor.tag}`)
            .addFields(
                { name: '🚗 Vehículo', value: `${vehiculo.make} ${vehiculo.model} (${vehiculo.year})` },
                { name: '💰 Precio', value: `$${precio.toLocaleString()}` },
                { name: '💳 Método', value: `Tarjeta ${tarjetaDisponible.card_type} **** ${tarjetaDisponible.card_number.slice(-4)}` },
                { name: '📋 Estado', value: '✅ Entregado' }
            )
            .setColor('#0099FF')
            .setThumbnail(vehiculo.image_url)
            .setFooter({ text: 'McQueen Concesionario' })
            .setTimestamp();

        await interaction.editReply({
            content: `🎉 ${cliente}, ¡Felicidades por tu nuevo ${vehiculo.make} ${vehiculo.model}!`,
            embeds: [embed],
            components: []
        });

        logger.info(`[VENDER] Credit sale completed: ${cliente.tag} bought ${vehiculo.make} ${vehiculo.model}`);

    } catch (error) {
        logger.error('[VENDER] Credit payment error:', error);
        await interaction.editReply({
            content: '❌ Error al procesar el pago con tarjeta.',
            embeds: [],
            components: []
        });
    }

    return true;
}

/**
 * Financiamiento - Plan de pagos quincenal
 */
async function handleFinanciamientoPayment(interaction, supabase, vehiculo, cliente, asesor, totalDinero) {
    const precio = vehiculo.price;
    const enganche = Math.ceil(precio * 0.20);
    const montoFinanciar = precio - enganche;
    const interes = Math.ceil(montoFinanciar * 0.05);
    const totalFinanciado = montoFinanciar + interes;
    const cuotaQuincenal = Math.ceil(totalFinanciado / 10);

    // Verificar que tenga dinero para el enganche
    if (totalDinero < enganche) {
        await interaction.editReply({
            content: `❌ **${cliente.tag}** no tiene suficiente dinero para el enganche.\\n💰 Tiene: $${totalDinero.toLocaleString()}\\n💵 Enganche (20%): $${enganche.toLocaleString()}`,
            embeds: [],
            components: []
        });
        return true;
    }

    try {
        // Descontar enganche
        if (process.env.UNBELIEVABOAT_TOKEN) {
            const UnbelievaBoatService = require('../services/UnbelievaBoatService');
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

            const balance = await ubService.getUserBalance(interaction.guildId, cliente.id);
            const newCash = Math.max(0, (balance.cash || 0) - enganche);
            const remaining = enganche - (balance.cash || 0);
            const newBank = remaining > 0 ? Math.max(0, (balance.bank || 0) - remaining) : (balance.bank || 0);

            await ubService.setBalance(interaction.guildId, cliente.id, {
                cash: newCash,
                bank: newBank
            }, `Enganche vehículo: ${vehiculo.make} ${vehiculo.model}`);
        }

        // Registrar venta con financiamiento
        const { error: saleError } = await supabase.from('dealership_sales').insert({
            user_id: cliente.id,
            vehicle_id: vehiculo.id,
            sale_price: precio,
            payment_method: 'financing',
            advisor_id: asesor.id,
            guild_id: interaction.guildId,
            metadata: {
                down_payment: enganche,
                financed_amount: montoFinanciar,
                interest: interes,
                total_financed: totalFinanciado,
                installment_amount: cuotaQuincenal,
                installments_total: 10,
                installments_paid: 0,
                next_payment_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            }
        });

        if (saleError) throw saleError;

        // Reducir stock
        await supabase.from('dealership_catalog')
            .update({ stock: vehiculo.stock - 1 })
            .eq('id', vehiculo.id);

        const embed = new EmbedBuilder()
            .setTitle('✅ Venta Completada - Financiamiento Aprobado')
            .setDescription(`**Cliente:** ${cliente.tag}\\n**Asesor:** ${asesor.tag}`)
            .addFields(
                { name: '🚗 Vehículo', value: `${vehiculo.make} ${vehiculo.model} (${vehiculo.year})` },
                { name: '💰 Precio Total', value: `$${precio.toLocaleString()}` },
                { name: '💵 Enganche Pagado', value: `$${enganche.toLocaleString()} (20%)` },
                { name: '🏦 Monto Financiado', value: `$${montoFinanciar.toLocaleString()}` },
                { name: '📈 Interés', value: `$${interes.toLocaleString()} (5%)` },
                { name: '💳 Total a Pagar', value: `$${totalFinanciado.toLocaleString()}` },
                { name: '📅 Plan', value: `10 cuotas quincenales de $${cuotaQuincenal.toLocaleString()}` },
                { name: '⏰ Próximo Pago', value: 'En 15 días' },
                { name: '📋 Estado', value: '✅ Vehículo entregado' }
            )
            .setColor('#FFD700')
            .setThumbnail(vehiculo.image_url)
            .setFooter({ text: 'McQueen Concesionario - Plan de Financiamiento' })
            .setTimestamp();

        await interaction.editReply({
            content: `🎉 ${cliente}, ¡Felicidades! Tu ${vehiculo.make} ${vehiculo.model} está listo.\\n⚠️ Recuerda: Tienes 10 cuotas quincenales de $${cuotaQuincenal.toLocaleString()}`,
            embeds: [embed],
            components: []
        });

        logger.info(`[VENDER] Financing sale completed: ${cliente.tag} financed ${vehiculo.make} ${vehiculo.model}`);

    } catch (error) {
        logger.error('[VENDER] Financing payment error:', error);
        await interaction.editReply({
            content: '❌ Error al procesar el financiamiento.',
            embeds: [],
            components: []
        });
    }

    return true;
}

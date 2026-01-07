// Handler for Admin Credit Card Upgrade Button
// This fixes the issue where credit limit wasn't being updated

const { EmbedBuilder } = require('discord.js');

module.exports = async (interaction, supabase, billingService) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('btn_upgrade_')) {
        return false; // Not our handler
    }

    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const targetUserId = parts[2];
    const nextTier = parts.slice(3).join('_').replace(/_/g, ' ');

    // Only target user can accept
    if (interaction.user.id !== targetUserId) {
        return interaction.followUp({ content: '❌ Esta oferta no es para ti.', flags: [64] });
    }

    let moneyDeducted = false;
    let cost = 0;

    try {
        const cardStats = {
            'NMX Start': { limit: 15000, interest: 15, cost: 2000, color: 0x808080 },
            'NMX Básica': { limit: 30000, interest: 12, cost: 4000, color: 0xC0C0C0 },
            'NMX Plus': { limit: 50000, interest: 10, cost: 6000, color: 0x4169E1 },
            'NMX Plata': { limit: 100000, interest: 8, cost: 10000, color: 0xC0C0C0 },
            'NMX Oro': { limit: 250000, interest: 7, cost: 15000, color: 0xFFD700 },
            'NMX Rubí': { limit: 500000, interest: 6, cost: 25000, color: 0xE0115F },
            'NMX Black': { limit: 1000000, interest: 5, cost: 40000, color: 0x000000 },
            'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000, color: 0xB9F2FF },
            'NMX Zafiro': { limit: 5000000, interest: 2, cost: 100000, color: 0x0F52BA },
            'NMX Platino Elite': { limit: 10000000, interest: 1, cost: 200000, color: 0xE5E4E2 }
        };

        const stats = cardStats[nextTier];
        if (!stats) {
            throw new Error('Tier de tarjeta inválido');
        }
        cost = stats.cost;

        // Deduct cost from bank
        await billingService.ubService.removeMoney(
            interaction.guildId,
            interaction.user.id,
            stats.cost,
            `Mejora Tarjeta: ${nextTier}`,
            'bank'
        );
        moneyDeducted = true;

        // Get citizen
        const { data: citizen } = await supabase
            .from('citizens')
            .select('id')
            .eq('discord_id', interaction.user.id)
            .maybeSingle();

        if (!citizen) {
            throw new Error('Perfil de ciudadano no encontrado');
        }

        // UPDATE CARD WITH NEW LIMIT
        const { error: updateError } = await supabase
            .from('credit_cards')
            .update({
                card_type: nextTier,
                card_limit: stats.limit, // FIX: Use card_limit as per schema
                interest_rate: stats.interest,
                updated_at: new Date().toISOString()
            })
            .eq('citizen_id', citizen.id)
            .eq('status', 'active');

        if (updateError) throw updateError;

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 ¡Mejora Procesada con Éxito!')
            .setColor(stats.color)
            .setDescription(`Felicidades <@${interaction.user.id}>, tu tarjeta ha sido mejorada a **${nextTier}**.`)
            .addFields(
                { name: '📈 Nuevo Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                { name: '📉 Nueva Tasa de Interés', value: `${stats.interest}%`, inline: true },
                { name: '💰 Costo de Mejora', value: `$${stats.cost.toLocaleString()}`, inline: true }
            )
            .setFooter({ text: '¡Disfruta de tus nuevos beneficios!' })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] });

        console.log(`[Credit Upgrade] ${interaction.user.tag} upgraded to ${nextTier} with limit $${stats.limit}`);

    } catch (error) {
        console.error('[Admin Upgrade Handler] Error:', error);

        // AUTO-REFUND LOGIC
        if (moneyDeducted) {
            try {
                await billingService.ubService.addMoney(
                    interaction.guildId,
                    interaction.user.id,
                    cost,
                    'Reembolso Auto: Fallo en Mejora Tarjeta',
                    'bank'
                );
                await interaction.followUp({ content: '⚠️ **Error del sistema:** Se te ha reembolsado el dinero automáticamente.', flags: [64] });
            } catch (refundError) {
                console.error('CRITICAL: Failed to refund user!', refundError);
                await interaction.followUp({ content: '⚠️ **CRÍTICO:** Hubo un error y no se pudo procesar tu mejora. Por favor contacta a soporte inmediatamente para tu reembolso.', flags: [64] });
            }
        }

        await interaction.followUp({
            content: error.message.includes('does not have enough')
                ? '❌ **Fondos Insuficientes** en tu cuenta bancaria.'
                : `❌ Error al procesar la mejora: ${error.message}`,
            flags: [64]
        });
    }

    return true; // Handled
};

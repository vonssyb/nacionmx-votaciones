#!/usr/bin/env python3
import re

with open('bot/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

updates = []

# ============ UPDATE 1: /bolsa comprar ============
old_bolsa = """// Check balance and deduct
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if ((balance.cash || 0) < totalCost) {
                    return interaction.editReply(`❌ No tienes suficiente efectivo. Necesitas: $${totalCost.toLocaleString()}, Tienes: $${(balance.cash || 0).toLocaleString()}`);
                }
                
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, totalCost, `Compra ${cantidad} acciones ${symbol}`, 'cash');
                
                // Payment is already processed in requestPaymentMethod
                const methodLabel = '�� Efectivo';"""

new_bolsa = """// Show payment selector
                const payMethods_bolsa = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
                const payButtons_bolsa = createPaymentButtons(payMethods_bolsa);
                
                await interaction.editReply({
                    content: `📈 **${symbol}**\\n💰 Total: **$${totalCost.toLocaleString()}**\\n📊 ${cantidad} @ $${currentPrice.toLocaleString()}\\n\\n**Selecciona método de pago:**`,
                    components: [payButtons_bolsa]
                });
                
                const filter_b = i => i.user.id === interaction.user.id && i.customId.startsWith('pay_');
                const collector_b = interaction.channel.createMessageComponentCollector({ filter: filter_b, time: 60000, max: 1 });
                
                collector_b.on('collect', async (i) => {
                    await i.deferUpdate();
                    const method = i.customId.replace('pay_', '');
                    const payRes = await processPayment(method, interaction.user.id, interaction.guildId, totalCost, `Compra ${cantidad} ${symbol}`, payMethods_bolsa);
                    if (!payRes.success) return i.editReply({ content: payRes.error, components: [] });
                    
                    const methodLabel = payRes.method;"""

if old_bolsa in content:
    content = content.replace(old_bolsa, new_bolsa)
    updates.append('/bolsa comprar')

# ============ UPDATE 2: /casino fichas comprar ============  
old_casino = """const balance = await billingService.ubService.getUserBalance(interaction.guildId, userId);
                    if ((balance.cash || 0) < cantidad) {
                        return interaction.editReply(`❌ No tienes suficiente efectivo. Necesitas: $${cantidad.toLocaleString()}, Tienes: $${(balance.cash || 0).toLocaleString()}`);
                    }
                    
                    // Deduct cash
                    await billingService.ubService.removeMoney(interaction.guildId, userId, cantidad, '[Casino] Compra dehips', 'cash');"""

new_casino = """const payMethods_casino = await getAvailablePaymentMethods(userId, interaction.guildId);
                    const payButtons_casino = createPaymentButtons(payMethods_casino);
                    
                    await interaction.editReply({
                        content: `🎰 **Comprar Fichas**\\n💰 Monto: **$${cantidad.toLocaleString()}**\\n\\n**Selecciona método de pago:**`,
                        components: [payButtons_casino]
                    });
                    
                    const filter_c = i => i.user.id === userId && i.customId.startsWith('pay_');
                    const collector_c = interaction.channel.createMessageComponentCollector({ filter: filter_c, time: 60000, max: 1 });
                    
                    collector_c.on('collect', async (i) => {
                        await i.deferUpdate();
                        const method = i.customId.replace('pay_', '');
                        const payRes = await processPayment(method, userId, interaction.guildId, cantidad, '[Casino] Compra fichas', payMethods_casino);
                        if (!payRes.success) return i.editReply({ content: payRes.error, components: [] });"""

if old_casino in content:
    content = content.replace(old_casino, new_casino)
    updates.append('/casino fichas')

# Save
with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Updated {len(updates)} commands: {', '.join(updates)}")

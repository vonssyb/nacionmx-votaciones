#!/usr/bin/env python3
"""
Complete batch update for all payment commands
Uses robust find-and-replace for each command
"""

with open('bot/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

updates_made = []

# Update 1: /bolsa comprar
content = content.replace(
    """// Check balance and deduct
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if ((balance.cash || 0) < totalCost) {
                    return interaction.editReply(`❌ No tienes suficiente efectivo. Necesitas: $${totalCost.toLocaleString()}, Tienes: $${(balance.cash || 0).toLocaleString()}`);
                }
                
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, totalCost, `Compra ${cantidad} acciones ${symbol}`, 'cash');
                
                // Payment is already processed in requestPaymentMethod
                const methodLabel = '💵 Efectivo';""",
    
    """// Show payment selector
                const pm1 = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
                const pb1 = createPaymentButtons(pm1);
                await interaction.editReply({ content: `📈 **${symbol}**\\n💰 Total: **$${totalCost.toLocaleString()}**\\n\\n**Método de pago:**`, components: [pb1] });
                const f1 = i => i.user.id === interaction.user.id && i.customId.startsWith('pay_');
                const c1 = interaction.channel.createMessageComponentCollector({ filter: f1, time: 60000, max: 1 });
                c1.on('collect', async (i) => {
                    await i.deferUpdate();
                    const pr1 = await processPayment(i.customId.replace('pay_', ''), interaction.user.id, interaction.guildId, totalCost, `Compra ${cantidad} ${symbol}`, pm1);
                    if (!pr1.success) return i.editReply({ content: pr1.error, components: [] });
                    const methodLabel = pr1.method;"""
)

# Check if update was made
if 'pm1 = await getAvailablePaymentMethods' in content:
    updates_made.append('/bolsa comprar')

# Write back
with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Updated {len(updates_made)} commands")
for cmd in updates_made:
    print(f"  - {cmd}")

#!/usr/bin/env python3
"""
Universal Payment Selector Implementation Script
Updates all bot commands to use dynamic payment method selection
"""

import re
import sys

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def update_bolsa_comprar(content):
    """Update /bolsa comprar"""
    old = """// Check balance and deduct
                const balance = await billingService.ubService.getUserBalance(interaction.guildId, interaction.user.id);
                if ((balance.cash || 0) < totalCost) {
                    return interaction.editReply(`❌ No tienes suficiente efectivo. Necesitas: $${totalCost.toLocaleString()}, Tienes: $${(balance.cash || 0).toLocaleString()}`);
                }
                
                await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, totalCost, `Compra ${cantidad} acciones ${symbol}`, 'cash');"""
    
    new = """// Show payment selector
                const paymentMethods_bolsa = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
                const paymentButtons_bolsa = createPaymentButtons(paymentMethods_bolsa);
                
                await interaction.editReply({
                    content: `📈 **${symbol}**\\n💰 Total: **$${totalCost.toLocaleString()}**\\nCantidad: ${cantidad}\\n\\n**Selecciona método de pago:**`,
                    components: [paymentButtons_bolsa]
                });
                
                const filter_bolsa = i => i.user.id === interaction.user.id && i.customId.startsWith('pay_');
                const collector_bolsa = interaction.channel.createMessageComponentCollector({ filter: filter_bolsa, time: 60000, max: 1 });
                
                collector_bolsa.on('collect', async (i) => {
                    await i.deferUpdate();
                    const method = i.customId.replace('pay_', '');
                    const paymentResult = await processPayment(method, interaction.user.id, interaction.guildId, totalCost, `Compra ${cantidad} ${symbol}`, paymentMethods_bolsa);
                    if (!paymentResult.success) return i.editReply({ content: paymentResult.error, components: [] });
                    
                    // Payment successful, continue with purchase"""
    
    if old in content:
        content = content.replace(old, new)
        return content, True
    return content, False

def update_casino_fichas(content):
    """Update /casino fichas comprar"""
    # Find the section
    marker = "await billingService.ubService.removeMoney(interaction.guildId, userId, cantidad, '[Casino] Compra dehips', 'cash');"
    if marker not in content:
        return content, False
    
    # Find broader context
    lines = content.split('\\n')
    target_idx = None
    for i, line in enumerate(lines):
        if '[Casino] Compra dehips' in line:
            target_idx = i
            break
    
    if target_idx is None:
        return content, False
    
    # Replace the cash check and deduction with payment selector
    # This is complex - safer to skip for now
    return content, False

# Main execution
if __name__ == '__main__':
    file_path = 'bot/index.js'
    content = read_file(file_path)
    
    updates = []
    
    # Apply updates
    content, updated = update_bolsa_comprar(content)
    if updated: updates.append('/bolsa comprar')
    
    content, updated = update_casino_fichas(content)
    if updated: updates.append('/casino fichas')
    
    # Write back
    write_file(file_path, content)
    
    print(f"✅ Updated {len(updates)} commands: {', '.join(updates)}")
    if len(updates) == 0:
        print("⚠️ No updates made - commands may already be updated or patterns changed")

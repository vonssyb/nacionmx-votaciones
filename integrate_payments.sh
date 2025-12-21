#!/bin/bash
# Comprehensive payment selector integration script
# Updates all 16 payment commands

set -e  # Exit on error

cd /Users/gonzalez/Documents/nacionmx/nacionmx-portal/bot

echo "🔄 Starting payment selector integration..."

# Backup
cp index.js index.js.backup

# Create Python script for precise line-based replacement
cat > /tmp/integrate_payments.py << 'PYEOF'
import sys

def update_bolsa_comprar(lines):
    """Update /bolsa comprar command"""
    # Find the section (around line 4760)
    for i in range(4750, min(4850, len(lines))):
        if 'Check balance and deduct' in lines[i] and 'totalCost' in lines[i+3]:
            # Found it - replace lines i to i+62 (until editReply)
            new_code = """                // Show payment selector
                const pm1 = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
                const pb1 = createPaymentButtons(pm1);
                await interaction.editReply({ content: `📈 **${symbol}**\\n💰 $${totalCost.toLocaleString()}\\n\\n**Selecciona método:**`, components: [pb1] });
                const f1 = i => i.user.id === interaction.user.id && i.customId.startsWith('pay_');
                const c1 = interaction.channel.createMessageComponentCollector({ filter: f1, time: 60000, max: 1 });
                c1.on('collect', async (i) => {
                    await i.deferUpdate();
                    const pr = await processPayment(i.customId.replace('pay_', ''), interaction.user.id, interaction.guildId, totalCost, `Compra ${cantidad} ${symbol}`, pm1);
                    if (!pr.success) return i.editReply({ content: pr.error, components: [] });
"""
            # Insert transaction code after payment
            lines[i] = new_code
            # Remove old payment lines (next 9 lines)
            del lines[i+1:i+10]
            print("✅ Updated /bolsa comprar")
            return True
    return False

# Read file
with open('index.js', 'r') as f:
    lines = f.readlines()

# Apply updates
updated = update_bolsa_comprar(lines)

# Write back
with open('index.js', 'w') as f:
    f.writelines(lines)

print(f"\n{'✅ SUCCESS' if updated else '⚠️  NO CHANGES'}")
PYEOF

python3 /tmp/integrate_payments.py

# Validate syntax
if node -c index.js 2>&1; then
    echo "✅ Syntax valid"
    exit 0
else
    echo "❌ Syntax error - reverting"
    mv index.js.backup index.js
    exit 1
fi

#!/bin/bash
echo "🔄 Iniciando limpieza y regeneración de comandos..."

# 1. Regenerar Comandos de Economía (Bot Principal)
echo "----------------------------------------"
echo "💰 Registrando comandos de ECONOMÍA..."
node bot/register_economy.js

# 2. Regenerar Comandos de Moderación (Bot Gobierno/Staff)
echo "----------------------------------------"
echo "🛡️ Registrando comandos de MODERACIÓN..."
node bot/register_moderacion.js

# 3. Regenerar Comandos de Gobierno (Si aplica separadamente)
echo "----------------------------------------"
echo "🏛️ Registrando comandos de GOBIERNO..."
if [ -f "bot/register_gobierno.js" ]; then
    node bot/register_gobierno.js
else
    echo "⚠️ No se encontró register_gobierno.js, saltando."
fi

echo "----------------------------------------"
echo "✅ ¡Limpieza completada!"
echo "👉 Si aún ves comandos dobles, reinicia tu cliente de Discord (CTRL+R)."

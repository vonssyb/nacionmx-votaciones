#!/bin/bash

GUILD_ID="1398525215134318713"
CLIENT_ID="1450701617685991621"
TOKEN="MTQ1MDcwMTYxNzY4NTk5MTYyMQ.Gwwg5B.YM9kFRCu6c2iqxbKAc8lIZw0wxXeC6QlfeBSB0"

echo "🚀 Registrando comandos actualizados (incluye /tarjeta ver)..."

curl -s -X PUT \
  "https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands" \
  -H "Authorization: Bot ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
[
  {"name":"ping","description":"Test"},
  {"name":"tarjeta","description":"Catalogo de tarjetas","options":[
    {"name":"info","description":"Ver todas las tarjetas","type":1},
    {"name":"ver","description":"Ver detalles de una tarjeta","type":1,"options":[
      {"name":"nombre","description":"Nombre de la tarjeta","type":3,"required":true,"choices":[
        {"name":"NMX Start","value":"NMX Start"},
        {"name":"NMX Básica","value":"NMX Básica"},
        {"name":"NMX Plus","value":"NMX Plus"},
        {"name":"NMX Plata","value":"NMX Plata"},
        {"name":"NMX Oro","value":"NMX Oro"},
        {"name":"NMX Rubí","value":"NMX Rubí"},
        {"name":"NMX Black","value":"NMX Black"},
        {"name":"NMX Diamante","value":"NMX Diamante"},
        {"name":"Business Start","value":"NMX Business Start"},
        {"name":"Business Gold","value":"NMX Business Gold"},
        {"name":"Business Platinum","value":"NMX Business Platinum"},
        {"name":"Business Elite","value":"NMX Business Elite"},
        {"name":"Corporate","value":"NMX Corporate"}
      ]}
    ]}
  ]},
  {"name":"top-ricos","description":"Ranking de Score"},
  {"name":"top-morosos","description":"Ranking de Deuda"},
  {"name":"transferir","description":"Enviar dinero","options":[
    {"name":"destinatario","description":"Usuario","type":6,"required":true},
    {"name":"monto","description":"Cantidad","type":10,"required":true},
    {"name":"razon","description":"Concepto","type":3}
  ]}
]
JSON

echo ""
echo "✅ Comandos actualizados"
echo "📋 Ejecuta ./register_COMPLETE.sh para registrar TODOS los comandos"

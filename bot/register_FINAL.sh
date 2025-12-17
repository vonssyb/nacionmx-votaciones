#!/bin/bash

GUILD_ID="1398525215134318713"
CLIENT_ID="1450701617685991621"
TOKEN="MTQ1MDcwMTYxNzY4NTk5MTYyMQ.Gwwg5B.YM9kFRCu6c2iqxbKAc8lIZw0wxXeC6QlfeBSB0"

echo "🚀 Registrando TODOS los comandos (incluye /credito completo)..."

curl -s -X PUT \
  "https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands" \
  -H "Authorization: Bot ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
  {"name":"ping","description":"Test"},
  {"name":"bolsa","description":"Sistema de Bolsa","options":[
    {"name":"precios","description":"Ver precios","type":1},
    {"name":"comprar","description":"Comprar","type":1,"options":[
      {"name":"symbol","description":"BTC ETH TSLA","type":3,"required":true},
      {"name":"cantidad","description":"Cantidad","type":10,"required":true}
    ]},
    {"name":"vender","description":"Vender","type":1,"options":[
      {"name":"symbol","description":"BTC ETH TSLA","type":3,"required":true},
      {"name":"cantidad","description":"Cantidad","type":10,"required":true}
    ]},
    {"name":"portafolio","description":"Ver inversiones","type":1},
    {"name":"historial","description":"Ver transacciones","type":1}
  ]},
  {"name":"credito","description":"Gestion de Tarjetas","options":[
    {"name":"estado","description":"Ver deuda y estado","type":1,"options":[
      {"name":"privado","description":"Ocultar","type":5}
    ]},
    {"name":"pedir-prestamo","description":"Retirar efectivo","type":1,"options":[
      {"name":"monto","description":"Cantidad","type":10,"required":true},
      {"name":"privado","description":"Ocultar","type":5}
    ]},
    {"name":"pagar","description":"Abonar a tarjeta","type":1,"options":[
      {"name":"monto","description":"Cantidad","type":10,"required":true},
      {"name":"privado","description":"Ocultar","type":5}
    ]},
    {"name":"buro","description":"Ver Score","type":1},
    {"name":"info","description":"Ver detalles tarjeta","type":1},
    {"name":"debug","description":"Diagnostico","type":1},
    {"name":"admin","description":"Staff","type":2,"options":[
      {"name":"puntos","description":"Modificar Score","type":1,"options":[
        {"name":"usuario","description":"Usuario","type":6,"required":true},
        {"name":"cantidad","description":"Puntos","type":4,"required":true},
        {"name":"razon","description":"Motivo","type":3,"required":true}
      ]},
      {"name":"perdonar","description":"Perdonar deuda","type":1,"options":[
        {"name":"usuario","description":"Usuario","type":6,"required":true}
      ]},
      {"name":"congelar","description":"Congelar tarjeta","type":1,"options":[
        {"name":"usuario","description":"Usuario","type":6,"required":true}
      ]},
      {"name":"descongelar","description":"Descongelar tarjeta","type":1,"options":[
        {"name":"usuario","description":"Usuario","type":6,"required":true}
      ]},
      {"name":"info","description":"Ver info usuario","type":1,"options":[
        {"name":"usuario","description":"Usuario","type":6,"required":true}
      ]},
      {"name":"ofrecer-upgrade","description":"Ofrecer mejora","type":1,"options":[
        {"name":"usuario","description":"Cliente","type":6,"required":true}
      ]}
    ]}
  ]},
  {"name":"transferir","description":"Enviar dinero","options":[
    {"name":"destinatario","description":"Usuario","type":6,"required":true},
    {"name":"monto","description":"Cantidad","type":10,"required":true}
  ]},
  {"name":"registrar-tarjeta","description":"Registrar tarjeta","options":[
    {"name":"usuario","description":"Usuario","type":6,"required":true},
    {"name":"nombre_titular","description":"Nombre RP","type":3,"required":true},
    {"name":"tipo","description":"Nivel","type":3,"required":true,"choices":[
      {"name":"NMX Start 2k","value":"NMX Start"},
      {"name":"NMX Basica 4k","value":"NMX Básica"},
      {"name":"NMX Plus 6k","value":"NMX Plus"},
      {"name":"NMX Plata 10k","value":"NMX Plata"},
      {"name":"NMX Oro 15k","value":"NMX Oro"},
      {"name":"NMX Rubi 25k","value":"NMX Rubí"},
      {"name":"NMX Black 40k","value":"NMX Black"},
      {"name":"NMX Diamante 60k","value":"NMX Diamante"},
      {"name":"Business Start 50k","value":"NMX Business Start"},
      {"name":"Business Gold 100k","value":"NMX Business Gold"},
      {"name":"Business Platinum 200k","value":"NMX Business Platinum"},
      {"name":"Business Elite 500k","value":"NMX Business Elite"},
      {"name":"Corporate 1M","value":"NMX Corporate"}
    ]},
    {"name":"foto_dni","description":"Foto DNI","type":11,"required":true}
  ]}
]'

echo ""
echo "✅ Comandos principales registrados (prueba reducida)"
echo "Si funciona, te doy el script completo con TODOS"

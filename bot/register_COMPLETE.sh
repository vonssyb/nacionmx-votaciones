#!/bin/bash

GUILD_ID="1398525215134318713"
CLIENT_ID="1450701617685991621"
TOKEN="MTQ1MDcwMTYxNzY4NTk5MTYyMQ.Gwwg5B.YM9kFRCu6c2iqxbKAc8lIZw0wxXeC6QlfeBSB0"

echo "🚀 Registrando TODOS los comandos (incluye /credito y /empresa)..."

curl -s -X PUT \
  "https://discord.com/api/v10/applications/${CLIENT_ID}/guilds/${GUILD_ID}/commands" \
  -H "Authorization: Bot ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '[
  {"name":"ping","description":"Test de conectividad"},
  {"name":"ayuda","description":"Comandos disponibles"},
  {"name":"bolsa","description":"Sistema de Bolsa de Valores y Criptomonedas","options":[
    {"name":"precios","description":"Ver precios actuales del mercado","type":1},
    {"name":"comprar","description":"Comprar acciones o criptomonedas","type":1,"options":[
      {"name":"symbol","description":"Simbolo de la accion - BTC ETH TSLA etc","type":3,"required":true},
      {"name":"cantidad","description":"Numero de acciones a comprar","type":10,"required":true}
    ]},
    {"name":"vender","description":"Vender acciones o criptomonedas","type":1,"options":[
      {"name":"symbol","description":"Simbolo de la accion - BTC ETH TSLA etc","type":3,"required":true},
      {"name":"cantidad","description":"Numero de acciones a vender","type":10,"required":true}
    ]},
    {"name":"portafolio","description":"Ver tus inversiones actuales","type":1},
    {"name":"historial","description":"Ver tus ultimas transacciones","type":1}
  ]},
  {"name":"credito","description":"Gestion de Tarjetas de Credito","options":[
    {"name":"estado","description":"Ver tu deuda y estado actual","type":1,"options":[
      {"name":"privado","description":"Ocultar respuesta - Visible solo para ti","type":5,"required":false}
    ]},
    {"name":"pedir-prestamo","description":"Retira efectivo de tu tarjeta - Se suma a tu deuda","type":1,"options":[
      {"name":"monto","description":"Cantidad a retirar","type":10,"required":true},
      {"name":"privado","description":"Ocultar respuesta","type":5,"required":false}
    ]},
    {"name":"pagar","description":"Abona dinero a tu tarjeta de credito","type":1,"options":[
      {"name":"monto","description":"Cantidad a pagar","type":10,"required":true},
      {"name":"privado","description":"Ocultar respuesta","type":5,"required":false}
    ]},
    {"name":"buro","description":"Ver tu Score de Buro Financiero","type":1},
    {"name":"info","description":"Ver detalles del plastico - Titular Nivel Fecha","type":1},
    {"name":"admin","description":"Herramientas Administrativas - Staff","type":2,"options":[
      {"name":"puntos","description":"Modificar Score de Buro - Staff","type":1,"options":[
        {"name":"usuario","description":"Usuario afectado","type":6,"required":true},
        {"name":"cantidad","description":"Puntos a sumar o restar con signo","type":4,"required":true},
        {"name":"razon","description":"Motivo del ajuste","type":3,"required":true}
      ]},
      {"name":"perdonar","description":"Perdonar la deuda de un usuario","type":1,"options":[
        {"name":"usuario","description":"Usuario de Discord","type":6,"required":true}
      ]},
      {"name":"congelar","description":"Congelar una tarjeta - No podra usarse","type":1,"options":[
        {"name":"usuario","description":"Usuario de Discord","type":6,"required":true}
      ]},
      {"name":"descongelar","description":"Reactivar una tarjeta congelada","type":1,"options":[
        {"name":"usuario","description":"Usuario de Discord","type":6,"required":true}
      ]},
      {"name":"info","description":"Ver informacion completa de un usuario","type":1,"options":[
        {"name":"usuario","description":"Usuario de Discord","type":6,"required":true}
      ]},
      {"name":"ofrecer-upgrade","description":"Enviar oferta de mejora de tarjeta por DM","type":1,"options":[
        {"name":"usuario","description":"Cliente a evaluar","type":6,"required":true}
      ]}
    ]},
    {"name":"debug","description":"Diagnostico de cuenta - Usar si fallan comandos","type":1}
  ]},
  {"name":"empresa","description":"Gestion de Empresas y Negocios","options":[
    {"name":"registrar","description":"Registrar una nueva empresa","type":1,"options":[
      {"name":"nombre","description":"Nombre de la empresa","type":3,"required":true},
      {"name":"tipo","description":"Tipo de negocio","type":3,"required":true,"choices":[
        {"name":"Taller Mecanico","value":"taller"},
        {"name":"Restaurante","value":"restaurante"},
        {"name":"Tienda","value":"tienda"},
        {"name":"Inmobiliaria","value":"inmobiliaria"},
        {"name":"Otro","value":"otro"}
      ]},
      {"name":"descripcion","description":"Descripcion breve","type":3,"required":false}
    ]},
    {"name":"info","description":"Ver informacion de tu empresa","type":1},
    {"name":"depositar","description":"Depositar dinero en la cuenta empresarial","type":1,"options":[
      {"name":"monto","description":"Cantidad a depositar","type":10,"required":true}
    ]},
    {"name":"retirar","description":"Retirar dinero de la cuenta empresarial","type":1,"options":[
      {"name":"monto","description":"Cantidad a retirar","type":10,"required":true}
    ]},
    {"name":"lista","description":"Ver todas las empresas registradas","type":1}
  ]},
  {"name":"movimientos","description":"Ver historial de transacciones"},
  {"name":"impuestos","description":"Consulta estado fiscal"},
  {"name":"top-morosos","description":"Ranking de deuda"},
  {"name":"top-ricos","description":"Ranking de Score"},
  {"name":"transferir","description":"Enviar dinero a otro ciudadano","options":[
    {"name":"destinatario","description":"Ciudadano que recibira el dinero","type":6,"required":true},
    {"name":"monto","description":"Cantidad a transferir","type":10,"required":true},
    {"name":"razon","description":"Concepto de la transferencia","type":3,"required":false}
  ]},
  {"name":"multa","description":"Imponer multa a un ciudadano","options":[
    {"name":"usuario","description":"Ciudadano a multar","type":6,"required":true},
    {"name":"monto","description":"Monto de la multa","type":10,"required":true},
    {"name":"razon","description":"Motivo de la infraccion","type":3,"required":true}
  ]},
  {"name":"notificaciones","description":"Activar o Desactivar notificaciones","options":[
    {"name":"activo","description":"Recibir notificaciones?","type":5,"required":true}
  ]},
  {"name":"fichar","description":"Vincular ciudadano al sistema","options":[
    {"name":"vincular","description":"Vincular usuario - Solo Staff","type":1,"options":[
      {"name":"usuario","description":"Usuario de Discord a vincular","type":6,"required":true},
      {"name":"nombre","description":"Nombre y Apellido RP","type":3,"required":true},
      {"name":"dni","description":"Foto del DNI","type":11,"required":true}
    ]}
  ]},
  {"name":"estado","description":"Cambia el estado del servidor","options":[
    {"name":"seleccion","description":"Nuevo estado del servidor","type":3,"required":true,"choices":[
      {"name":"Abierto","value":"open"},
      {"name":"Mantenimiento","value":"maintenance"},
      {"name":"Cerrado","value":"closed"}
    ]}
  ]},
  {"name":"registrar-tarjeta","description":"Registrar nueva tarjeta - Staff","options":[
    {"name":"usuario","description":"Usuario de Discord","type":6,"required":true},
    {"name":"nombre_titular","description":"Nombre completo del titular RP","type":3,"required":true},
    {"name":"tipo","description":"Nivel de la tarjeta","type":3,"required":true,"choices":[
      {"name":"NMX Start 2k","value":"NMX Start"},
      {"name":"NMX Basica 4k","value":"NMX Básica"},
      {"name":"NMX Plus 6k","value":"NMX Plus"},
      {"name":"NMX Plata 10k","value":"NMX Plata"},
      {"name":"NMX Oro 15k","value":"NMX Oro"},
      {"name":"NMX Rubi 25k","value":"NMX Rubí"},
      {"name":"NMX Black 40k","value":"NMX Black"},
      {"name":"NMX Diamante 60k","value":"NMX Diamante"}
    ]},
    {"name":"foto_dni","description":"Foto del DNI o Identificacion","type":11,"required":true},
    {"name":"notas","description":"Notas opcionales","type":3,"required":false}
  ]},
  {"name":"rol","description":"Gestion de Roles y Sanciones","options":[
    {"name":"cancelar","description":"Reportar cancelacion de rol","type":1,"options":[
      {"name":"usuario","description":"Usuario sancionado - Nombre o ID","type":3,"required":true},
      {"name":"razon","description":"Motivo de la cancelacion","type":3,"required":true},
      {"name":"ubicacion","description":"Lugar de los hechos o arresto","type":3,"required":true},
      {"name":"prueba1","description":"Evidencia principal - Imagen","type":11,"required":true},
      {"name":"prueba2","description":"Evidencia secundaria - Imagen","type":11}
    ]}
  ]},
  {"name":"inversion","description":"Sistema de Inversion a Plazo Fijo","options":[
    {"name":"nueva","description":"Abrir nueva inversion - 7 dias con 5% rendimiento","type":1,"options":[
      {"name":"monto","description":"Cantidad a bloquear","type":10,"required":true}
    ]},
    {"name":"estado","description":"Ver inversiones activas y retirar ganancias","type":1}
  ]},
  {"name":"nomina","description":"Gestion de Nominas para Empresas","options":[
    {"name":"crear","description":"Crear un nuevo grupo de pago","type":1,"options":[
      {"name":"nombre","description":"Nombre del grupo como Taller","type":3,"required":true}
    ]},
    {"name":"agregar","description":"Agregar empleado al grupo","type":1,"options":[
      {"name":"grupo","description":"Nombre del grupo","type":3,"required":true},
      {"name":"empleado","description":"Usuario a pagar","type":6,"required":true},
      {"name":"sueldo","description":"Monto a pagar","type":10,"required":true}
    ]},
    {"name":"pagar","description":"Pagar a todos los empleados del grupo","type":1,"options":[
      {"name":"grupo","description":"Nombre del grupo","type":3,"required":true}
    ]}
  ]}
]' | jq '.'

echo ""
echo "✅ Comandos registrados"
echo "📋 Ahora incluye /credito y /empresa completos"

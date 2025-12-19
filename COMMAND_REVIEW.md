# Análisis y Mejoras de Comandos - NacionMX Bot

Este documento detalla el estado actual de los comandos del bot, identificando áreas de mejora, correcciones de errores potenciales y sugerencias para elevar la experiencia de usuario (UX) y seguridad.

## 🟢 Comandos Financieros (Débito, Efectivo, Transferencias)

### 1. `/debito` (Grupo)
- **Subcomandos:** `estado`, `depositar`, `retirar`, `transferir`, `historial`, `info`, `admin`.
- **Estado Actual:**
    - Recientemente actualizado para soportar opción "todo".
    - `depositar`/`retirar` mueven dinero entre UnbelievaBoat Cash <-> Bank.
    - `transferir` mueve Bank <-> Bank (diferido 5 minutos).
- **Mejoras Propuestas:**
    - **UX:** Agregar botones de "Acción Rápida" en `/debito estado` (e.g., botón "Depositar Todo", "Retirar 1000").
    - **Seguridad:** Verificar que `getDebitCard` siempre retorne la tarjeta activa correcta si el usuario tiene múltiples (aunque la DB debería restringir a 1 activa).
    - **Consistencia:** Asegurar que todos los mensajes de error usen `ephemeral: true` para no ensuciar el chat, o `editReply` si ya se difirió.

### 2. `/depositar` (OXXO)
- **Función:** Envío de Efectivo -> Débito de otro usuario (4 horas).
- **Estado:**
    - ✅ Usa cashBalance y soporta "todo".
    - ✅ **Completado:** Validación correcta de efectivo.

### 3. `/transferir` (SPEI)
- **Función:** Envío Bank -> Bank de otro usuario (Inmediato).
- **Estado:**
    - ✅ **Completado:** Ahora es estrictamente Bank -> Bank (SPEI puro). Eliminada selección de método. Soporta "todo".

### 4. `/giro` (Paquetería)
- **Función:** Envío de Efectivo -> Efectivo (24h).
- **Estado:**
    - ✅ **Completado:** Lógica corregida para usar estrictamente CASH del remitente.

## ❓ Comandos de Ayuda
- **Estado:**
    - ✅ **Completado:** `/ayuda` transformado a Menú Interactivo por categorías.

## 💳 Comandos de Crédito

### `/credito` (Grupo)
- **Subcomandos:** `info`, `pagar`, `buro`, `admin`.
- **Análisis:**
    - El pago de tarjeta (`pagar`) permite pagar deuda.
    - `buro` muestra historial.
- **Mejoras Exclusivas:**
    - **Recordatorios:** Sistema automático que avise al usuario X días antes de su fecha de corte (requiere cronjob).
    - **Simulador:** `/credito simular monto:10000` -> Muestra cuánto pagarías de intereses si pides eso.

## 🎰 Casino

### `/jugar` y `/casino`
- **Estado:** Muchos juegos (slots, dados, crash, etc).
- **Mejoras:**
    - **Ludopatía:** Implementar límites diarios de pérdidas configurables por el usuario (`/casino limites`).
    - **Animaciones:** Mejorar el "suspenso" en Crash y Ruleta editando el mensaje progresivamente (aunque cuidado con rate limits).

## 🏢 Empresas

### `/empresa` (Grupo)
- **Estado:** Permite crear empresas, cobrar, pagar nómina.
- **Problema Detectado:** Conflicto reciente con botones solucionado (`genpay_`).
- **Mejoras:**
    - **Dashboard:** Un comando `/empresa dashboard` que muestre gráficas ASCII simples de ingresos de la semana.
    - **Empleados:** Roles de empleados (Gerente vs Cajero). Ahora mismo parece que solo el dueño gestiona todo o se agregan a nómina simple.

## 🛠️ Sistema y Utilidades

### `/ping`, `/ayuda`, `/balanza`
- **Mejoras:**
    - `/ayuda`: Hacerlo interactivo con menú desplegable por categorías (Economía, Legal, Casino) para no llenar la pantalla de texto.
    - `/balanza`: Agregar valor neto (Patrimonio = Activos - Pasivos).

## ⚠️ Puntos Críticos a Revisar Código
1. **Manejo de Errores Global:** Revisar si todos los `deferReply` tienen `catch` que haga `editReply` con error amigable. A veces el bot se queda "Pensando..." si falla.
2. **Race Conditions:** En botones de pago, asegurar que no se pueda doble-clickear y cobrar dos veces (usar flags o `update` inmediato).
3. **Hardcoded Values:** Mover configuraciones (límites, tasas de interés) a una tabla `system_config` o constantes al inicio.

---
*Este documento se actualizará conforme revise el código línea por línea.*

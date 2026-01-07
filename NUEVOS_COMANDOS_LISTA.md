# 🚀 Nuevos Comandos Implementados - Nación MX

Lista completa de las nuevas funcionalidades integradas.

## 🛡️ Gestión de Staff y Servidor

### Gestión de Rangos (Nuevo)
Automatiza permisos de Discord y ERLC.
* `/rango promover @usuario`: Sube rango (+ permisos ERLC :mod/:admin).
* `/rango degradar @usuario`: Baja rango (- permisos ERLC).
* `/rango lock @usuario`: Bloquea ascensos (Rank Lock).
* `/rango unlock @usuario`: Desbloquea ascensos.

### Control de Servidor
* `/server lock`: Cierra el servidor (Solo Whitelist y Staff entran).
* `/server unlock`: Abre el servidor a todos.
* `/server whitelist @usuario`: Añade a la lista de acceso VIP.

### Sesiones
* `/sesion iniciar [votos]`: Inicia votación. Si se cumple, el servidor se ABRE SOLO.
* `/sesion forzar_apertura`: Abre inmediatamente (emergencia).

---

## ⚖️ Sistema de Fianza
Permite liberar a los arrestados pagando.

* `/fianza calcular`: Muestra cuánto cuesta salir.
* `/fianza pagar`: Paga la fianza y retira el rol de arrestado (+ libera en DB).

---

## 🏢 Expansión de Empresa
Gestión avanzada para dueños de empresas.

* `/empresa contratar @usuario`: Añade empleado.
* `/empresa despedir @usuario`: Elimina empleado.
* `/empresa empleados`: Lista paginada de personal.
* `/empresa salario @usuario [monto]`: Ajusta sueldo.
* `/empresa reporte`: Panel gráfico con estadísticas financieras.

---

## 📋 Misiones Diarias (Policía/Gov)
Sistema de recompensas por actividad.

* `/mision diaria`: Muestra la misión del día.
* `/mision completar @usuario`: Staff marca la misión como hecha.
* `/mision reclamar`: El usuario cobra su premio.

---

## ⭐ Sistema de Reputación
Karma para usuarios y policías.

* `/reputacion ver @usuario`: Consulta puntos.
* `/reputacion dar @usuario [+1/-1]`: Vota (Cooldown 7 días).
* `/reputacion top`: Ranking de los más respetados/odiados.
* `/reputacion historial`: Quién te votó.

# 🏢 Comandos de Empresa - Guía para Dueños

Esta guía detalla todos los comandos disponibles para **dueños de empresas** en Nación MX.

---

## 👥 Gestión de Empleados

### `/empresa contratar`
Contratar un nuevo empleado para tu empresa.

**Uso:**
```
/empresa contratar usuario:@empleado salario:2500 rol:Mecánico
```

**Parámetros:**
- `usuario` (requerido): Usuario a contratar
- `salario` (requerido): Salario mensual (mínimo $1,000)
- `rol` (opcional): Cargo del empleado

**Resultado:**
- Empleado agregado a la base de datos
- Aparecerá en `/empresa empleados`
- Podrá ver su salario en `/perfil`

---

### `/empresa empleados`
Ver lista completa de empleados activos.

**Uso:**
```
/empresa empleados
```

**Características:**
- Muestra paginación (10 empleados por página)
- Información: Nombre, cargo, salario
- Solo empleados activos (no despedidos)

---

### `/empresa salario`
Ajustar el salario de un empleado.

**Uso:**
```
/empresa salario usuario:@empleado nuevo_salario:3500
```

**Parámetros:**
- `usuario` (requerido): Empleado a ajustar
- `nuevo_salario` (requerido): Nuevo salario mensual (mínimo $1,000)

**Resultado:**
```
✅ Salario de @empleado actualizado:
~~$2,500~~ → **$3,500**/mes
```

---

### `/empresa despedir`
Despedir un empleado.

**Uso:**
```
/empresa despedir usuario:@empleado
```

**Efecto:**
- Marca al empleado como despedido (`fired_at` = fecha actual)
- Ya no aparecerá en `/empresa empleados`
- No podrá usar `/empresa cobrar`

---

## 💰 Gestión Financiera

### `/empresa cobrar`
Enviar una factura a un cliente.

**Uso:**
```
/empresa cobrar cliente:@cliente monto:500 concepto:Reparación de motor
```

**Parámetros:**
- `cliente` (requerido): Usuario a cobrar
- `monto` (requerido): Cantidad a cobrar (mínimo $1)
- `concepto` (requerido): Descripción del servicio

**Resultado:**
Cliente recibe:
- Embed amarillo con factura
- Botón "Pagar $500"
- Botón "Rechazar"

**Cuando el cliente paga:**
- ✅ Factura se actualiza a verde "PAGADO"
- 💰 Balance de empresa aumenta
- 📢 Empleado que cobró recibe notificación

---

### `/empresa retirar`
Retirar fondos de la empresa a tu cuenta personal.

**Uso:**
```
/empresa retirar monto:5000 concepto:Dividendos trimestrales
```

**Parámetros:**
- `monto` (requerido): Cantidad a retirar (mínimo $1)
- `concepto` (opcional): Motivo del retiro

**Validaciones:**
- Solo dueños pueden retirar
- Verifica fondos suficientes en `companies.balance`

**Resultado:**
- Descuenta de balance de empresa
- Suma a tu cuenta bancaria (UnbelievaBoat)
- Registra transacción tipo "expense"

---

### `/empresa reporte`
Ver dashboard completo de tu empresa.

**Uso:**
```
/empresa reporte
```

**Información mostrada:**
- 💼 Empleados activos
- 💰 Nómina mensual total
- 🏦 Balance actual
- 📈 Ingresos últimos 30 días
- 📉 Gastos últimos 30 días
- 💎 Ganancia neta (ingresos - gastos)

---

## 🔧 Gestión de Propiedad

### `/empresa remover_dueño`
Remover un socio/co-dueño de la empresa.

**Uso:**
```
/empresa remover_dueño usuario:@ex_socio
```

**Validaciones:**
- Solo dueños pueden remover otros dueños
- No se puede remover si solo queda 1 dueño
- Actualiza el array `owner_ids`

**Resultado:**
```
🚪 Socio Removido
🏢 Empresa: Pemex
👤 Socio Removido: @ex_socio
👥 Dueños Restantes: 2
```

---

    ### `/empresa transferir`
    Transferir la propiedad completa de la empresa.

    **Uso:**
    ```
    /empresa transferir nuevo_dueño:@comprador
    ```

    **Importante:**
    - ⚠️ **Transferencia TOTAL:** Reemplaza TODOS los dueños
    - El dueño anterior pierde todos los permisos
    - Útil para vender o ceder empresa completamente

    **Resultado:**
    ```
    🔄 Empresa Transferida
    🏢 Empresa: Pemex
    👤 Antiguo Dueño: @vendedor
    👤 Nuevo Dueño: @comprador
    ```

    ---

    ## 📊 Información General

    ### `/perfil`
    Ver información completa, incluyendo empresas.

    **Uso:**
    ```
    /perfil
    ```

    **Si eres dueño, muestra:**
    ```
    🏢 Empresas Propias
    🏢 Pemex - Balance: $15,000
    🏢 Staff Nacion MX - Balance: $8,500
    ```

    ---

    ## 💡 Tips y Mejores Prácticas

    ### 📈 Gestión Financiera
    - Revisa `/empresa reporte` regularmente
    - Retira fondos solo cuando sea necesario
    - Registra todos tus cobros con conceptos claros

    ### 👥 Gestión de Personal
    - Ajusta salarios según desempeño
    - Revisa `/empresa empleados` periódicamente
    - Comunica con tu equipo antes de despedir

    ### 🔐 Seguridad
    - No compartas propiedad con desconocidos
    - Usa `/empresa transferir` solo cuando vendas
    - Confirma antes de remover socios

    ---

    ## 🆘 Soporte

    Si tienes problemas con algún comando:
    1. Verifica que eres dueño de la empresa
    2. Revisa los permisos del bot
    3. Contacta al equipo de desarrollo

    **Canal de soporte:** `#soporte-economia`

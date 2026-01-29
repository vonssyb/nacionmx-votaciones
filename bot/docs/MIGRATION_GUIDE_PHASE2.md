# Guía de Migración - Phase 2 Services

## Servicios Creados

### 1. PermissionService
**Ubicación:** `/services/PermissionService.js`  
**Configuración:** `/config/roles.json`

**Funcionalidad:**
- Gestión centralizada de roles (200+ IDs)
- Métodos: `hasRole()`, `hasAnyRole()`, `isStaff()`, `canArrest()`, `requireRole()`, etc.
- Grupos predefinidos (admin, staff_all, law_enforcement, protected_from_ck, etc.)

### 2. EconomyHelper (Mejorado)
**Ubicación:** `/services/EconomyHelper.js`

**Nuevas funciones:**
- `formatMoney(amount)` - Formateo consistente de montos
- `calculateTax(amount, rate)` - Cálculo de impuestos
- `checkBalance(billingService, guildId, userId, amount)` - Verificación de balance
- `getCreditUtilization(debt, limit)` - Utilización de crédito
- `getUserRPRank(member)` - Obtener rango RP del usuario
- `getCardTier(cardName)` - Información de tarjeta
- `getCardType(cardName)` - Tipo de tarjeta (débito/crédito)

### 3. LogHelper
**Ubicación:** `/utils/LogHelper.js`

**Funcionalidad:**
- `logTransaction(client, guildId, data, channelKey)` - Logs de transacciones
- `logAction(client, data, channelKey)` - Logs de moderación
- `logError(client, error, context)` - Logs de errores
- `createEmbed(title, desc, color, fields)` - Embeds estandarizados
- `createSuccessEmbed()`, `createErrorEmbed()`, `createWarningEmbed()`, `createInfoEmbed()`

---

## Patrones de Migración

### Patrón 1: Validación de Permisos

#### ❌ Antes (Hardcoded)
```javascript
const ARREST_ROLES = [
    '1449942702744932372', // SSP
    '1457135315323195432', // SSPC
    '1412898911185797310', // Guardia Nacional
    '1412898913639923762', // Policía Federal
];

const canArrest = ARREST_ROLES.some(roleId => interaction.member.roles.cache.has(roleId)) ||
                  interaction.member.permissions.has(PermissionFlagsBits.Administrator);

if (!canArrest) {
    return interaction.editReply('❌ No tienes permisos.');
}
```

#### ✅ Después (PermissionService)
```javascript
const PermissionService = require('../../services/PermissionService');

if (!PermissionService.canArrest(interaction.member)) {
    return interaction.editReply('❌ No tienes permisos para arrestar.');
}
```

---

### Patrón 2: Verificación de Protección

#### ❌ Antes
```javascript
const PROTECTED_ROLES = [
    '1412887183089471568', // Presidente
    '1412891374700724234', // Candidato
    '1412891683535982632', // Abogado
    '1413541371503185961'  // Juez
];

const isProtected = PROTECTED_ROLES.some(roleId => targetMember.roles.cache.has(roleId));

if (isProtected) {
    return interaction.editReply('❌ Este usuario está protegido.');
}
```

#### ✅ Después
```javascript
const PermissionService = require('../../services/PermissionService');

if (PermissionService.isProtectedFromArrest(targetMember)) {
    return interaction.editReply('❌ Este usuario está protegido del arresto.');
}
```

---

### Patrón 3: Formateo de Dinero

#### ❌ Antes (Inconsistente)
```javascript
// Opción 1
const formatted = `$${amount.toLocaleString()}`;

// Opción 2
const formatted = `$${Math.floor(amount).toLocaleString ('en-US')}`;

// Opción 3
const formatted = `$${amount}`;
```

#### ✅ Después
```javascript
const EconomyHelper = require('../../services/EconomyHelper');

const formatted = EconomyHelper.formatMoney(amount);
// O con moneda personalizada
const formattedUSD = EconomyHelper.formatMoney(amount, 'USD $');
```

---

### Patrón 4: Logging de Transacciones

#### ❌ Antes (Duplicado en cada comando)
```javascript
const logChannel = interaction.guild.channels.cache.get('1452499876737978438');
if (logChannel) {
    const logEmbed = new EmbedBuilder()
        .setTitle('🛒 Nueva Compra')
        .setColor('#AA00FF')
        .addFields(
            { name: 'Cliente', value: `<@${userId}>`, inline: true },
            { name: 'Item', value: itemName, inline: true },
            { name: 'Precio', value: `$${price.toLocaleString()}`, inline: true }
        )
        .setTimestamp();
    await logChannel.send({ embeds: [logEmbed] });
}
```

#### ✅ Después
```javascript
const LogHelper = require('../../utils/LogHelper');

await LogHelper.logTransaction(client, interaction.guildId, {
    type: 'purchase',
    userId: userId,
    amount: price,
    description: `Compra de ${itemName}`,
    extra: { item: itemName }
}, 'tienda_logs');
```

---

### Patrón 5: Logging de Acciones de Moderación

#### ❌ Antes
```javascript
const arrestChannel = await client.channels.fetch('1398888960519835688');
const embed = new EmbedBuilder()
    .setTitle('🚔 Nuevo Arresto')
    .setColor('#FF0000')
    .addFields(
        { name: 'Oficial', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Arrestado', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Razón', value: razon, inline: false }
    )
    .setTimestamp();
await arrestChannel.send({ embeds: [embed] });
```

#### ✅ Después
```javascript
const LogHelper = require('../../utils/LogHelper');

await LogHelper.logAction(client, {
    type: 'arrest',
    moderator: interaction.user.id,
    target: targetUser.id,
    reason: razon,
    duration: duracion
}, 'arrest_public');
```

---

### Patrón 6: Verificación de Balance

#### ❌ Antes
```javascript
const balance = await client.services.billing.ubService.getBalance(interaction.guildId, interaction.user.id);
const cashBalance = balance.cash;

if (cashBalance < monto) {
    return interaction.editReply(`❌ Saldo insuficiente. Tienes: $${cashBalance.toLocaleString()}`);
}
```

#### ✅ Después
```javascript
const EconomyHelper = require('../../services/EconomyHelper');

const balanceCheck = await EconomyHelper.checkBalance(
    client.services.billing,
    interaction.guildId,
    interaction.user.id,
    monto,
    'cash'
);

if (!balanceCheck.sufficient) {
    return interaction.editReply(
        `❌ Saldo insuficiente. Tienes: ${EconomyHelper.formatMoney(balanceCheck.current)}`
    );
}
```

---

### Patrón 7: Embeds Estandarizados

#### ❌ Antes
```javascript
const successEmbed = new EmbedBuilder()
    .setTitle('✅ Operación Exitosa')
    .setColor('#00FF00')
    .setDescription(`Se ha completado la transacción.`)
    .addFields({ name: 'Monto', value: `$${amount.toLocaleString()}` })
    .setTimestamp();
```

#### ✅ Después
```javascript
const LogHelper = require('../../utils/LogHelper');
const EconomyHelper = require('../../services/EconomyHelper');

const successEmbed = LogHelper.createSuccessEmbed(
    '✅ Operación Exitosa',
    'Se ha completado la transacción.',
    [{ name: 'Monto', value: EconomyHelper.formatMoney(amount) }]
);
```

---

## Ejemplos de Refactorización Completa

### Ejemplo 1: `arrestar.js`

**Antes:**
```javascript
// Hardcoded roles
const ARREST_CHANNEL_ID = '1398888960519835688';
const ARREST_LOGS_CHANNEL_ID = '1457583225085100283';
const ARRESTED_ROLE_ID = '1413540729623679056';

const PROTECTED_ROLES = [
    '1412887183089471568',
    '1412891374700724234',
    '1412891683535982632',
    '1413541371503185961'
];

// Permission check
const ARREST_ROLES = ['1449942702744932372', '1457135315323195432', ...];
const canArrest = ARREST_ROLES.some(roleId => member.roles.cache.has(roleId));
if (!canArrest) return interaction.editReply('❌ No tienes permisos.');

// Protection check
const isProtected = PROTECTED_ROLES.some(roleId => target.roles.cache.has(roleId));
if (isProtected) return interaction.editReply('❌ Usuario protegido.');
```

**Después:**
```javascript
const PermissionService = require('../../services/PermissionService');
const LogHelper = require('../../utils/LogHelper');

// Permission check
if (!PermissionService.canArrest(interaction.member)) {
    return interaction.editReply('❌ No tienes permisos para arrestar.');
}

// Protection check
if (PermissionService.isProtectedFromArrest(targetMember)) {
    return interaction.editReply('❌ Este usuario está protegido del arresto.');
}

// Get role and channel IDs from config
const arrestedRoleId = PermissionService.getRoleId('police.arrested');

// Log action
await LogHelper.logAction(client, {
    type: 'arrest',
    moderator: interaction.user.id,
    target: targetUser.id,
    reason: razon,
    duration: `${duracion} minutos`
}, 'arrest_public');
```

---

### Ejemplo 2: `tarjetas.js`

**Antes:**
```javascript
const BANKER_ROLES = [
    '1450591546524307689', // Banqueros
    '1412882245735420006', // Junta Directiva
];

const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
                 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

if (!isBanker) {
    return interaction.editReply('❌ Solo los banqueros pueden consultar tarjetas de otros usuarios.');
}
```

**Después:**
```javascript
const PermissionService = require('../../services/PermissionService');

// Check if user is banker or admin
const isBanker = PermissionService.hasAnyRole(interaction.member, [
    'economy.banquero',
    'staff.junta_directiva'
]) || PermissionService.isAdmin(interaction.member);

if (!isBanker) {
    return interaction.editReply('❌ Solo los banqueros pueden consultar tarjetas de otros usuarios.');
}
```

---

## Archivos Prioritarios para Migración

### Alta Prioridad (10+ role IDs hardcodeados)
1. `commands/moderation/arrestar.js` - 15+ roles
2. `commands/moderation/ck.js` - 20+ roles
3. `commands/gov/licencia.js` - 12+ roles
4. `commands/utils/user.js` - 6 blacklist roles
5. `commands/economy/crimen.js` - 4 benefit roles

### Media Prioridad (5-10 role IDs)
1. `commands/economy/tarjetas.js`
2. `commands/economy/trabajar.js`
3. `commands/moderation/rechazar_apelacion.js`
4. `commands/economy/tienda.js`

### Baja Prioridad (1-4 role IDs)
- Resto de comandos con validaciones simples

---

## Checklist de Migración

- [ ] ✅ Servicios creados (PermissionService, EconomyHelper, LogHelper)
- [ ] ✅ Configuración roles.json creada
- [ ] Refactorizar 10+ comandos de alta prioridad
- [ ] Refactorizar comandos de media prioridad
- [ ] Refactorizar resto de comandos
- [ ] Testing de comandos refactorizados
- [ ] Actualizar documentación
- [ ] Commit y push a GitHub

---

## Beneficios de la Migración

1. **Mantenibilidad**: Un solo lugar para actualizar role IDs
2. **Legibilidad**: Código más limpio y autodocumentado
3. **Consistencia**: Embeds y logs uniformes
4. **Reutilización**: Funciones compartidas en vez de código duplicado
5. **Testing**: Más fácil crear tests unitarios
6. **Performance**: Menor overhead en queries

---

## Próximos Pasos

1. Seleccionar 5 comandos de alta prioridad
2. Refactorizar usando los nuevos servicios
3. Testear manualmente cada comando
4. Documentar cambios en CHANGELOG
5. Commit y push
6. Continuar con resto de comandos

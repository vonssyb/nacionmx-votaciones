# 🔥 Oracle Cloud Migration Toolkit

Scripts completos para migrar de Supabase a Oracle Cloud Autonomous Database (20GB gratis).

## 📋 Scripts Incluidos

### 1. Exportación
- `export_supabase_schema.js` - Exporta estructura de BD
- `export_supabase_data.js` - Exporta todos los datos

### 2. Conversión
- `convert_schema_to_oracle.js` - Convierte PostgreSQL → Oracle SQL

### 3. Importación
- `import_to_oracle.js` - Importa datos a Oracle Cloud

### 4. Cliente Oracle
- `lib/oracle.js` - Wrapper compatible con Supabase API

### 5. Testing
- `test_oracle_connection.js` - Valida conexión y operaciones

## 🚀 Uso Rápido

### Paso 1: Exportar de Supabase
```bash
# Reactiva Supabase temporalmente
# Luego ejecuta:
node scripts/export_supabase_data.js
```

### Paso 2: Generar Schema Oracle
```bash
node scripts/convert_schema_to_oracle.js
# Genera: exports/oracle_schema.sql
```

### Paso 3: Crear Database en Oracle Cloud
```
1. Ve a https://cloud.oracle.com
2. Create Autonomous Database (Always Free)
3. Descarga wallet
4. Configura .env
```

### Paso 4: Importar Schema
```bash
sqlplus ADMIN/<password>@nacionmxdb_high @exports/oracle_schema.sql
```

### Paso 5: Importar Datos
```bash
node scripts/import_to_oracle.js
```

### Paso 6: Test
```bash
node scripts/test_oracle_connection.js
```

## ⚙️ Configuración .env

```bash
# Oracle Cloud
ORACLE_USER=ADMIN
ORACLE_PASSWORD=tu_password_aqui
ORACLE_CONNECT_STRING=nacionmxdb_high
ORACLE_WALLET_LOCATION=/ruta/a/wallet
ORACLE_WALLET_PASSWORD=wallet_pass
```

## 📦 Dependencias

```bash
npm install oracledb
```

## ✅ Tablas Soportadas

- citizens
- debit_cards
- credit_cards  
- debit_transactions
- companies
- user_purchases
- casino_chips
- tax_evasion_history
- pending_transfers
- giro_transfers
- privacy_accounts
- bot_heartbeats

## 💡 Ventajas Oracle Cloud

- ✅ 20GB gratis (vs 500MB Supabase)
- ✅ $0/mes forever
- ✅ No se pausa
- ✅ Enterprise performance
- ✅ 99.95% uptime

## 📚 Documentación Completa

Ver: `oracle_cloud_migration.md` para guía detallada paso a paso.

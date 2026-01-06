# Quick Guide: Sistema de Visas

## 🚀 Implementación Rápida

### 1. Ejecutar SQL en Supabase

```sql
-- Paso 1: Aplicar schema de visas
\i supabase_visa_system.sql

-- Paso 2: Remover nacionalidad del DNI  
\i supabase_remove_nationality.sql
```

### 2. Configurar Variables

Agregar al `.env`:
```env
AMERICAN_ROLE_ID=<ID_DEL_ROL_AMERICANO>
VISA_LOG_CHANNEL_ID=<CANAL_LOGS_VISAS>
```

### 3. Tipos de Visa

| Tipo | Duración | Puede Trabajar | Puede Colectar |
|------|----------|----------------|----------------|
| 🛂 Turista | 7 días | ❌ No | ❌ No |
| 💼 Trabajo | 30 días | ✅ Sí | ✅ Sí |
| 📚 Estudiante | 90 días | ⚠️ Limitado | ❌ No |
| 🏠 Residente | 365 días | ✅ Sí | ✅ Sí |

### 4. Comandos que Necesita un Americano

1. **`/dni crear`** - Crear DNI (ahora sin nacionalidad)
2. **`/visa solicitar tipo:trabajo`** - Solicitar visa
3. Esperar aprobación de staff
4. **`/visa ver`** - Verificar visa activa

### 5. Comandos para Staff

- **`/visa aprobar usuario:@american tipo:trabajo`** - Otorgar visa
- **`/visa listar`** - Ver todas las visas
- **`/visa revocar usuario:@american razon:"..."` - Cancelar visa

## 📋 Próximos Pasos

1. ✅ SQL creado (listo para ejecutar)
2. ⏳ Crear comando `/visa` 
3. ⏳ Integrar checks en `/trabajar` y `/colectar`
4. ⏳ Crear tarea cron para expiración automática

# 🚀 Instrucciones de Deployment - Sistemas de Engagement

## ✅ Código Ya Implementado y Pusheado

Todo el código ha sido implementado exitosamente y está en GitHub:
- ✅ 4 Servicios nuevos (888 líneas)
- ✅ 4 Comandos nuevos
- ✅ 3 Migraciones SQL
- ✅ Handlers e integraciones
- ✅ Commit: `3bb9783`

---

## 📋 Paso 1: Ejecutar Migraciones en Supabase

> [!IMPORTANT]
> **Debes ejecutar estas 3 migraciones SQL en tu dashboard de Supabase:**

### Acceso a Supabase SQL Editor
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto de Nación MX
3. En el menú izquierdo, click en **SQL Editor**
4. Click en **New Query**

### Migración 1: user_streaks

```sql
-- Migration: Create streaks table for tracking user daily streaks
CREATE TABLE IF NOT EXISTS user_streaks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_claim_date TIMESTAMP WITH TIME ZONE,
    streak_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_claims INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_longest_streak ON user_streaks(longest_streak DESC);

COMMENT ON TABLE user_streaks IS 'Tracks user daily activity streaks for rewards system';
```

### Migración 2: server_events

```sql
-- Migration: Create server events table for random server-wide events
CREATE TABLE IF NOT EXISTS server_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    multiplier DECIMAL(10, 2) DEFAULT 1.0,
    event_data JSONB DEFAULT '{}',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_history (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES server_events(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    participants INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_impact BIGINT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_server_events_is_active ON server_events(is_active);
CREATE INDEX IF NOT EXISTS idx_server_events_event_type ON server_events(event_type);
CREATE INDEX IF NOT EXISTS idx_server_events_time_range ON server_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON event_history(event_id);

COMMENT ON TABLE server_events IS 'Active server-wide events with modifiers';
```

### Migración 3: daily_rewards

```sql
-- Migration: Create daily rewards table for improved daily claim system
CREATE TABLE IF NOT EXISTS daily_rewards (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    last_claim_date TIMESTAMP WITH TIME ZONE,
    consecutive_days INTEGER DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    total_earned BIGINT DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_bonus_amount BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reward_claims (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    claim_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    consecutive_day INTEGER NOT NULL,
    base_reward BIGINT NOT NULL,
    bonus_reward BIGINT DEFAULT 0,
    total_reward BIGINT NOT NULL,
    was_lucky_bonus BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON daily_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_consecutive_days ON daily_rewards(consecutive_days DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user_id ON daily_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_date ON daily_reward_claims(claim_date DESC);

COMMENT ON TABLE daily_rewards IS 'Tracks user daily reward claims with streaks';
```

### Verificar Migraciones

Ejecuta esto para verificar que se crearon las tablas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_streaks', 'server_events', 'event_history', 'daily_rewards', 'daily_reward_claims')
ORDER BY table_name;
```

Deberías ver las 5 tablas listadas.

---

## 📋 Paso 2: Actualizar Código Localmente

Primero actualiza tu código local desde GitHub:

```bash
cd /Users/gonzalez/Documents/nacionmx/nacionmx-portal/bot
git pull origin main
```

---

## 📋 Paso 3: Reiniciar el Bot

Según cómo ejecutes el bot, usa uno de estos comandos:

### Si usas PM2:
```bash
pm2 restart all
# o específicamente:
pm2 restart nacionmx-bot
```

### Si usas npm:
```bash
npm start
```

### Si lo ejecutas manualmente:
```bash
node index_unified.js
```

---

## 📋 Paso 4: Probar los Nuevos Comandos

Una vez que el bot esté corriendo y las migraciones ejecutadas, prueba:

### 1. Sistema de Rankings
```
/ranking dinero       # Ver top usuarios más ricos
/ranking casino       # Ver mejores jugadores de casino
/ranking empresas     # Ver empresas más exitosas
/ranking nivel        # Ver usuarios con más XP
/ranking streak       # Ver mejores rachas
```

Usa el menú dropdown que aparece para cambiar entre categorías.

### 2. Sistema de Rachas
```
/rachas              # Ver tu racha actual y récord
/fichar entrada      # Iniciar turno
/fichar salida       # Finalizar turno (actualiza racha automáticamente)
```

Deberías ver:
- Tu racha actual de días consecutivos
- Bonus por racha (si aplica)
- Notificación si rompiste récord

### 3. Recompensas Diarias
```
/diario              # Reclamar recompensa del día
```

Deberías recibir:
- Recompensa base según días consecutivos
- 10% de probabilidad de bonus de suerte
- Barra de progreso hacia siguiente meta

### 4. Eventos del Servidor
```
/eventos             # Ver evento activo (si hay alguno)
```

Los eventos aparecen aleatoriamente cada 6-12 horas. Tipos de eventos:
- 💰 Doble Sueldo (2x)
- 🎰 Suerte de Casino (1.5x)
- 📉 Crisis Económica (0.5x)
- 🎉 Festival (1.25x)
- ⭐ Doble XP (2x)
- ⚡ Hora Pico

### 5. Perfil Actualizado
```
/perfil              # Ver tu perfil con la nueva sección de rachas
```

Deberías ver:
- Sección "🔥 Actividad" con tu racha actual
- Récord personal
- Emblemas especiales si tienes racha larga

---

## ⚙️ Configuración Opcional

### Canal de Anuncios de Eventos

Para personalizar dónde se anuncian los eventos, agrega a tu `.env`:

```env
EVENT_CHANNEL_ID=TU_ID_DE_CANAL_AQUI
```

Si no lo configuras, usará el canal de logs bancarios por defecto (`1452346918620500041`).

---

## 🔍 Solución de Problemas

### Error: "relation user_streaks does not exist"
- ✅ **Solución:** Ejecuta la migración 1 en Supabase

### Error: "relation server_events does not exist"
- ✅ **Solución:** Ejecuta la migración 2 en Supabase

### Error: "relation daily_rewards does not exist"
- ✅ **Solución:** Ejecuta la migración 3 en Supabase

### Los comandos no aparecen en Discord
- ✅ **Solución:** El bot los registra automáticamente al iniciar. Espera 1-2 minutos o reinicia Discord.

### Eventos no se activan automáticamente
- ✅ **Solución:** El scheduler revisa cada 6 horas con 50% de probabilidad. 
- ✅ Para forzar un evento de prueba, tendrías que llamar manualmente `EventService.startRandomEvent()` desde código.

---

## 📊 Monitoreo

### Verificar que los Schedulers están activos

Revisa los logs del bot al iniciar. Deberías ver:

```
Economy Scheduler Initialized
All economy schedulers registered successfully
```

Esto confirma que:
- ✅ Scheduler de intereses de tarjetas (domingos 23:55)
- ✅ Scheduler de préstamos vencidos (diario 9:00 AM)
- ✅ Scheduler de eventos aleatorios (cada 6 horas)

### Ver Estadísticas de Uso

Puedes consultar en Supabase:

```sql
-- Top rachas activas
SELECT user_id, current_streak, longest_streak 
FROM user_streaks 
ORDER BY current_streak DESC 
LIMIT 10;

-- Eventos ejecutados
SELECT event_name, event_type, start_time, end_time 
FROM server_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Recompensas diarias reclamadas hoy
SELECT COUNT(*) as claims_today
FROM daily_reward_claims
WHERE claim_date::date = CURRENT_DATE;
```

---

## ✅ Checklist Final

- [ ] Ejecutar 3 migraciones SQL en Supabase
- [ ] Verificar tablas creadas (query de verificación)
- [ ] `git pull` para actualizar código local
- [ ] Reiniciar bot (pm2/npm)
- [ ] Probar `/ranking dinero`
- [ ] Probar `/rachas`
- [ ] Probar `/diario`
- [ ] Probar `/eventos`
- [ ] Probar `/fichar salida` (verifica que actualiza racha)
- [ ] Verificar `/perfil` muestra sección de rachas

---

¡Todo listo! 🎉 Los sistemas están fully implementados y listos para aumentar el engagement de tu servidor.

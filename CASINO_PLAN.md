# 🎰 Sistema de Casino Nación MX - Plan de Implementación

## Especificaciones:

### Configuración:
- **Canal Casino:** `1451398359540826306`
- **Rol Requerido:** `1449951345611378841` (para escribir en el canal)
- **Beneficio VIP:** Tarjetas Black & Diamante tienen acceso ilimitado (sin comprar entrada)

### Juegos (15 Total):

#### 🎰 Juegos de Azar Clásicos:
1. **🃏 Blackjack** - Clásico 21 contra la casa (hasta 2x)
2. **🎡 Ruleta** - Ruleta europea con todas las apuestas (hasta 35x)
3. **🎲 Dados (Craps)** - Tira 2 dados, apuesta al resultado (hasta 30x)
4. **🃏 Baccarat** - Jugador vs Banca, cartas altas ganan (1.95x)
5. **🎰 Slots** - Tragamonedas con símbolos (hasta 100x en Jackpot)

#### 🎮 Juegos Modernos/Virales:
6. **📉 Crash** - Apuesta y retira antes del crash (multiplicador x1.01 a x10+)
7. **� Plinko** - Pelota cayendo por clavijas (hasta 16x)
8. **💣 Minas** - Encuentra gemas, evita bombas (hasta 24x)
9. **🎲 Dice** - Tira dado, gana si sale arriba/abajo de número (hasta 9.9x)
10. **🎰 Keno** - Selecciona 10 números de 80 (hasta 10,000x)

#### 🏆 Juegos Temáticos RP:
11. **🐴 Carreras de Caballos** - 6 caballos, apuestas múltiples (5x)
12. **🐓 Pelea de Gallos** - Combate en rounds (1.9x)
13. **💀 Ruleta Rusa** - Alto riesgo, ban temporal si pierdes (5x)
14. **🎴 Video Poker** - Forma manos de poker (hasta 250x)
15. **⚔️ Guerra de Cartas** - Carta más alta gana (2x o empate)

### Sistema de Fichas:
- Comprar fichas con dinero real (efectivo, banco, crédito)
- 1 ficha = $100 (ajustable)
- Mínimo: 10 fichas ($1,000)
- Máximo: 1000 fichas ($100,000) por compra

### Diseño UI:
- Embeds elegantes con colores temáticos
- Botones interactivos para cada acción
- Animaciones con actualizaciones de embeds
- Sistema de historial personal

---

## Comandos a Crear:

### 1. `/casino` (comando principal)
Subcomandos:
- `entrada` - Comprar acceso al casino (gratis para Black/Diamante)
- `fichas comprar [cantidad]` - Comprar fichas con dinero
- `fichas retirar [cantidad]` - Convertir fichas a dinero
- `saldo` - Ver tus fichas y estadísticas
- `historial [juego]` - Ver tus últimas jugadas
- `ranking [tipo]` - Top ganadores (diario, semanal, all-time)
- `reglas [juego]` - Ver reglas de un juego específico

### 2. `/jugar` (comando de juegos)

#### Clásicos:
- `blackjack [apuesta]` - Jugar al 21
- `ruleta [tipo] [valor] [apuesta]` - Ruleta europea
- `dados [tipo] [valor] [apuesta]` - Craps/Dados
- `baccarat [lado] [apuesta]` - Jugador/Banca/Empate
- `slots [apuesta]` - Tragamonedas 3 rodillos

#### Modernos:
- `crash [apuesta]` - Multiplier crash game
- `plinko [riesgo] [apuesta]` - Pelota cayendo
- `minas [apuesta]` - Busca gemas, evita bombas
- `dice [direccion] [numero] [apuesta]` - Over/Under
- `keno [numeros] [apuesta]` - Lotería de casino

#### Temáticos:
- `caballos [caballo] [apuesta]` - Carreras de caballos
- `gallos [color] [apuesta]` - Pelea de gallos
- `ruleta-rusa [apuesta]` - ⚠️ ALTO RIESGO
- `poker [apuesta]` - Video Poker
- `guerra [apuesta]` - Guerra de cartas

### 3. `/casino-admin` (solo staff)
- `dar-fichas @user [cantidad]` - Dar fichas gratis
- `quitar-fichas @user [cantidad]` - Quitar fichas
- `stats` - Estadísticas del casino
- `ban @user [tiempo]` - Banear del casino
- `unban @user` - Desbanear
- `house-edge` - Ver ventaja de la casa por juego

---

## Estructura de Base de Datos (Supabase):

```sql
-- Tabla de fichas de casino
CREATE TABLE casino_chips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    chips_balance INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_lost INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de historial
CREATE TABLE casino_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    bet_amount INTEGER NOT NULL,
    result_amount INTEGER NOT NULL,
    game_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de accesos (entrada al casino)
CREATE TABLE casino_access (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    access_type TEXT DEFAULT 'paid', -- 'paid' o 'vip'
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Mecánicas de Juego Detalladas:

### � CLÁSICOS:

#### �🃏 Blackjack:
1. Usuario apuesta fichas (mín: 10)
2. Se reparten 2 cartas al jugador y dealer
3. Botones: "🎴 Pedir", "✋ Plantarse", "💰 Doblar"
4. Dealer juega automáticamente (se planta en 17+)
5. **Pago:** 2x si ganas, 2.5x si Blackjack natural (A+10/J/Q/K)

#### 🎡 Ruleta:
1. **Tipos de apuesta:**
   - Rojo/Negro (2x)
   - Par/Impar (2x)
   - Número exacto 0-36 (35x)
   - Docena (1-12, 13-24, 25-36) (3x)
   - Columna (3x)
2. Giro animado con embed
3. **Pago:** Según tipo de apuesta

#### 🎲 Dados (Craps):
1. Tira 2 dados (2-12)
2. **Apuestas:**
   - Número específico (30x para 2 o 12, 15x para 3 u 11)
   - Suma específica (5x-8x)
   - Par/Impar (2x)
   - Bajo (2-6) / Alto (8-12) (2x)
3. Animación de dados girando

#### 🃏 Baccarat:
1. Apuesta a: Jugador, Banca, o Empate
2. Se reparten 2-3 cartas a cada lado
3. Gana el más cercano a 9
4. **Pago:** 1.95x (Banca), 2x (Jugador), 8x (Empate)

#### 🎰 Slots (Tragamonedas):
1. 3 rodillos con símbolos: 🍒🍋🍊🍇💎⭐7️⃣
2. **Pagos:**
   - 3x 7️⃣ = 100x (JACKPOT)
   - 3x ⭐ = 50x
   - 3x 💎 = 25x
   - 3x Frutas iguales = 10x
   - 2x iguales = 2x
3. Animación de giro

---

### 🎮 MODERNOS:

#### 📉 Crash:
1. Multiplicador empieza en 1.00x y sube
2. Usuario debe hacer "Cash Out" antes del crash
3. Crash es aleatorio (1.01x - 100x+)
4. **Pago:** Apuesta × Multiplicador al momento de retirar
5. Embed se actualiza en tiempo real (cada 0.5s)

#### 🎯 Plinko:
1. Elige nivel de riesgo: Bajo, Medio, Alto
2. Pelota cae por 16 filas de clavijas
3. Multipliers al final: 0.5x, 1x, 2x, 5x, 10x, 16x (centro más probable)
4. **Riesgo Alto:** Multiplicadores más extremos (0.2x a 50x)
5. Animación visual de la caída

#### 💣 Minas:
1. Grid 5×5 con gemas 💎 y bombas 💣
2. Click en casillas para revelar
3. Cada gema encontrada aumenta multiplicador
4. **Multiplicador:** 1.2x → 1.5x → 2x → 3x → 5x → 10x → 24x
5. Toca bomba = pierdes todo
6. Botón "Cash Out" disponible en cualquier momento

#### 🎲 Dice (Dados Roll):
1. Tira dado de 100 caras (0.00 - 99.99)
2. Usuario elige: "Over X" o "Under X"
3. **Multiplicador:** Depende del número elegido
   - Over 50 o Under 50 = 1.98x
   - Over 90 = 10x
   - Under 10 = 10x
4. Visual: Barra de progreso con zona de victoria

#### 🎰 Keno:
1. Selecciona 1-10 números del 1-80
2. Sistema sortea 20 números random
3. **Pagos según aciertos:**
   - 10/10 = 10,000x
   - 9/10 = 1,000x
   - 8/10 = 100x
   - 7/10 = 25x
   - 6/10 = 10x
   - 5/10 = 3x
4. Botones interactivos para seleccionar números

---

### 🏆 TEMÁTICOS RP:

#### 🐴 Carreras de Caballos:
1. 6 caballos con nombres mexicanos
2. Apuesta a un caballo
3. Carrera simulada en 10 rounds
4. Cada round: avance aleatorio 1-3 posiciones
5. Animación ASCII con posiciones:
```
🐴 El Relámpago  =========>
🐴 Tornado       ======>
🐴 Huracán       ========>
```
6. **Pago:** 5x si tu caballo gana

#### 🐓 Pelea de Gallos:
1. 2 gallos: 🟥 Rojo vs 🔵 Azul
2. Combate a 3 victorias
3. Cada round: 50/50 con animación
4. Embed muestra vida de cada gallo
5. **Pago:** 1.9x si aciertas

#### 💀 Ruleta Rusa:
1. Revólver con 6 cámaras, 1 bala
2. Usuario hace clic en "🔫 Disparar"
3. **Si sobrevives:** 5x
4. **Si pierdes:** 
   - Pierdes apuesta
   - Multa adicional de 2x apuesta
   - Ban del casino 1 hora
5. Animación dramática

#### 🎴 Video Poker:
1. Se reparten 5 cartas
2. Usuario elige cuáles guardar (botones)
3. Se reemplazan las cartas descartadas
4. **Pagos:**
   - Royal Flush: 250x
   - Straight Flush: 50x
   - Four of a Kind: 25x
   - Full House: 9x
   - Flush: 6x
   - Straight: 4x
   - Three of a Kind: 3x
   - Two Pair: 2x
   - Jacks or Better: 1x

#### ⚔️ Guerra de Cartas:
1. Usuario y dealer reciben 1 carta
2. Carta más alta gana
3. **Empate:** Opción de "ir a la guerra" (doblar apuesta)
4. **Pago:** 2x si ganas, 1x si empatas y no vas a guerra

---

## Beneficios VIP (Black & Diamante):
- ✅ Acceso ilimitado sin pagar entrada
- 💰 +10% más de fichas al comprar
- 🎮 Límites de apuesta más altos
- 🎁 Multiplicador de ganancias +5%
- 🏆 Acceso a sala VIP (juegos exclusivos próximamente)
- 🎯 Cashback del 2% en pérdidas semanales

---

## 🎲 House Edge (Ventaja de la Casa):

| Juego | House Edge | RTP (Return to Player) |
|-------|-----------|----------------------|
| Blackjack | 0.5% | 99.5% |
| Baccarat (Banca) | 1.06% | 98.94% |
| Baccarat (Jugador) | 1.24% | 98.76% |
| Ruleta (Simple) | 2.7% | 97.3% |
| Ruleta (Número) | 2.7% | 97.3% |
| Dados (Básico) | 1.4% | 98.6% |
| Slots | 5% | 95% |
| Video Poker | 2% | 98% |
| Crash | 3% | 97% |
| Plinko | 4% | 96% |
| Minas | 3% | 97% |
| Dice | 2% | 98% |
| Keno | 25% | 75% |
| Caballos | 16.7% | 83.3% |
| Gallos | 5% | 95% |
| Guerra | 2.8% | 97.2% |
| Ruleta Rusa | 16.7% | 83.3% (+ penalización) |

---

## 🛡️ Sistema Anti-Trampa:

### Rate Limiting:
- Máximo 10 juegos por minuto por usuario
- Cooldown de 2 segundos entre juegos del mismo tipo
- Bloqueo automático si se detecta spam

### Límites Diarios:
- **Usuarios Normales:**
  - Máximo $500k en fichas compradas/día
  - Máximo $1M en apuestas totales/día
  
- **VIP (Black/Diamante):**
  - Máximo $2M en fichas compradas/día
  - Máximo $5M en apuestas totales/día

### Detección de Patrones:
- Flag si usuario gana >5 veces seguidas en mismo juego
- Revisión manual de ganancias >$1M en 24h
- Bloqueo temporal ante comportamiento sospechoso

### Hash Provably Fair:
- Cada resultado usa seed único
- Hash del resultado se genera ANTES de la apuesta
- Usuario puede verificar equidad después del juego

---

## Próximos pasos:
1. ✅ Crear tablas en Supabase
2. ✅ Implementar comando `/casino`
3. 🔄 Implementar juegos uno por uno (empezar con clásicos)
4. 🔄 Testing y balanceo de probabilidades
5. 🔄 Añadir sistema anti-trampa
6. 🔄 Sistema de logros y misiones
7. 🔄 Torneo semanal con premios
8. 🔄 Sala VIP exclusiva


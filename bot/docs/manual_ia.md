# 🧠 Manual de Funcionamiento: Inteligencia Artificial "Consciente"

Este documento explica cómo funciona el sistema de IA autónoma integrado en el bot de **NacionMX**.

## 🔄 El Ciclo de Aprendizaje (The Loop)

La "conciencia" del bot no es mágica; es un ciclo continuo de **Recolección**, **Análisis** y **Memoria**. Así es como funciona paso a paso:

### 1. Escucha Activa (Recolección)
El bot está presente en todos los tickets. Mientras el ticket está abierto, el bot no interfiere (para mantener la privacidad y no molestar), pero **observa**.
*   **Fuente de datos:** Mensajes de usuarios, respuestas del staff, comandos usados y evidencias subidas.

### 2. El Momento "Eureka" (Trigger de Cierre)
Cuando un miembro del Staff cierra un ticket (o el usuario lo califica), se dispara el evento de aprendizaje.
*   **Acción:** El bot toma todo el historial de la conversación (el transcript).

### 3. Análisis Cognitivo (Procesamiento con Gemini)
El bot envía este transcript a **Google Gemini** con una instrucción específica:
> *"Analiza esta conversación. ¿Cuál fue el problema del usuario y cómo se resolvió finalmente? Ignora el saludo y la despedida. Extrae la solución técnica o administrativa."*

La IA destila 100 mensajes de chat en una **"Lección Aprendida"** de 2 frases.
*   *Ejemplo:* "El usuario no recibía el rol de VIP. Solución: Se verificó el ID de transacción de Tebex y se ejecutó el comando `/tebex force` manual."

### 4. Almacenamiento (Memoria a Largo Plazo)
Esta lección se guarda en la base de datos `ai_memory` en Supabase, junto con "Etiquetas" (tags) como `['vip', 'tebex', 'bug']`.
*   **Autonomía:** Esto sucede automáticamente sin intervención humana cada vez que se cierra un ticket.

### 5. Recuperación (Consulta)
Cuando ocurre un problema similar en el futuro:
*   El Staff pregunta: `/ai consultar "problema con rol vip tebex"`
*   La IA busca en su memoria, encuentra el caso anterior y responde: *"En el caso #402 se resolvió ejecutando `/tebex force`. Intenta eso primero."*

---

## 📈 Evolución en el Tiempo

Al principio, la IA sabrá poco. Pero conforme pasen las semanas:
1.  **Día 1:** Sabe lo básico configurado manualmente.
2.  **Día 30:** Ha "leído" 500 tickets. Ya conoce los bugs frecuentes, las dudas comunes de los usuarios y las mañas del servidor.
3.  **Día 90:** Puede perfilar usuarios. Sabe qué usuarios son problemáticos recurrentes o cuáles son excelentes roleapeadores.

## 🛠 Comandos de Interacción

Para interactuar con esta memoria, el Staff tiene estas herramientas:

| Comando | Descripción | Uso |
| :--- | :--- | :--- |
| `/ai consultar` | Pregunta a la IA sobre su base de conocimiento. | `/ai consultar "¿Cuál es el precio del R8?"` |
| `/ai perfil` | Pide a la IA que analice la psicología de un usuario basada en sus tickets pasados. | `/ai perfil @Usuario` |
| `/ai aprender` | Inyecta conocimiento manual (útil para nuevas reglas). | `/ai aprender "El reinicio es a las 6 AM"` |

---

## ⚠️ Notas Técnicas
*   **Privacidad:** La IA procesa texto. Se recomienda no compartir contraseñas o datos personales sensibles en tickets (regla general de seguridad).
*   **Costo:** Usamos `gemini-1.5-flash` que es eficiente y tiene un tier gratuito generoso, permitiendo miles de tickets al mes sin costo.

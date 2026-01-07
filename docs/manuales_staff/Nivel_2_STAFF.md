# 📗 Manual de Staff / Moderador (Nivel 2-3)

Documentación para Moderadores confirmados y Administradores.
Tienes acceso a herramientas de gestión de servidor y sanciones graves.

---

## 🗳️ Apertura de Servidor (`/sesion`)

Eres responsable de abrir el servidor ERLC organizadamente.

1. **Iniciar Votación:**
   ```bash
   /sesion iniciar [meta_votos]
   # Ejemplo: /sesion iniciar 15
   ```
2. **Proceso:**
   * El bot publica el mensaje de votación.
   * Si se llega a la meta Y hay suficientes staffs (1 por cada 8 votos), el servidor se abre automáticamente.
3. **Emergencia:**
   * `/sesion forzar_apertura`: Omite la votación y abre ya.
   * `/sesion cancelar`: Cancela todo.

---

## ⚖️ Sanciones Avanzadas

Además de Warns, tienes acceso a:

* **Kick ERLC (Expulsión):**
  Saca a alguien del servidor de juego inmediatamente.
  ```bash
  /sancion @usuario Kick ERLC "Razón"
  ```

* **Ban ERLC (Prohibición):**
  Prohíbe la entrada al servidor ERLC.
  ```bash
  /sancion @usuario Ban ERLC "Razón"
  ```
  *(Solo Nivel 3+ puede dar Ban Permanente, Nivel 2 suele ser temporal)*.

---

## 🛠️ Herramientas de Gestión

* **Verificación Forzada:**
  Si un usuario no se puede verificar solo.
  ```bash
  /verificar @usuario
  ```

* **Server Status:**
  Ver estado actual del servidor (Abierto/Cerrado).
  ```bash
  /status
  ```

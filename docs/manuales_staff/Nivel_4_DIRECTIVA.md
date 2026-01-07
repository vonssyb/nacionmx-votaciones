# 📙 Manual de Directiva (Nivel 4)

**⚠️ DOCUMENTO CONFIDENCIAL - SOLO BOARD/ENCARGADOS**
Control total sobre la estructura del staff y acceso al servidor.

---

## ⚙️ Gestión de Staff (`/rango`)

Sistema automatizado para High Command.
**Nota:** Al promover/degradar, el bot ejecuta automáticamente los comandos de ERLC (`:mod`, `:admin`) y actualiza roles de Discord.

* **Ascensos:**
  ```bash
  /rango promover @usuario
  ```

* **Degradaciones:**
  ```bash
  /rango degradar @usuario
  ```
  *(Si degradas a un Nivel 1, es expulsado del Staff)*.

* **Rank Lock (Bloqueo):**
  Impide que un staff sea promovido (ideal para sanciones internas o periodos de prueba).
  ```bash
  /rango lock @usuario
  /rango unlock @usuario
  ```

---

## 🔐 Control de Acceso (`/server`)

Gestión de la Whitelist y Bloqueo del Servidor.

* **Bloqueo Total (Server Lock):**
  Cierra el servidor. Nadie entra excepto la Whitelist.
  **Bypass Automático:** Todo usuario con rol de Staff en Discord entra automáticamente (Rank Lock System).
  ```bash
  /server lock
  ```

* **Desbloqueo:**
  ```bash
  /server unlock
  ```

* **Whitelist Manual:**
  Para VIPs, Streamers o amigos que NO son staff.
  ```bash
  /server whitelist @usuario
  ```

* **Kick/Ban Remoto:**
  Ejecutar comandos de consola sin entrar al juego.
  ```bash
  /server ban @usuario "Razón"
  ```

---

## 💀 Blacklists (Máxima Sanción)

Solo Tú puedes ejecutar esto.
Banea al usuario de Discord, ERLC, Facciones y Economía.

```bash
/sancion @usuario Blacklist "Razón crítica"
```

# 🛡️ Guía Oficial de Comandos Staff — Nación MX

Documento interno para el uso correcto de comandos administrativos.
Aplicable a **promociones**, **degradaciones**, **bloqueo de rangos**, **moderación** y **control del servidor ERLC**.

---

## ⚙️ Gestión de Rangos (`/rango`)

**Acceso:** Junta Directiva / Encargado de Staff

Sistema automatizado para administrar rangos del staff.
Los roles de Discord se asignan y actualizan de forma automática.

### 📈 Promoción y Degradación

* **Promover usuario**
  Sube un nivel al staff.

  ```
  /rango promover @usuario
  ```

* **Degradar usuario**
  Baja un nivel.
  Si el usuario está en **Nivel 1**, será removido del staff.

  ```
  /rango degradar @usuario
  ```

* **Asignar rango manualmente**

  ```
  /rango establecer @usuario [nivel]
  ```

### 🎖️ Niveles de Staff

* `1` — Training
* `2` — Staff
* `3` — Admin
* `4` — Board

---

## � Rank Lock (Bloqueo de Ascensos)

**Acceso:** Junta Directiva / Encargado de Staff

El **Rank Lock** impide que un miembro del staff pueda ser promovido, sin necesidad de expulsarlo o degradarlo.

### 📌 Función del Rank Lock

* Bloquea **toda promoción futura**
* Mantiene el rango actual del usuario
* Cancela promociones manuales y automáticas
* Se identifica mediante un **rol especial en Discord**

---

### 🧷 Rol de Rank Locked

Rol asignado automáticamente:

* **`🔒 Rank Locked`**

Mientras el usuario tenga este rol:

* ❌ No puede subir de rango
* ❌ No puede recibir promociones manuales
* ❌ No puede ser promovido por automatismos
* ✅ Puede ser degradado si es necesario

---

### ⚙️ Comandos de Rank Lock

* **Aplicar Rank Lock**

  ```
  /rango lock @usuario
  ```

* **Quitar Rank Lock**

  ```
  /rango unlock @usuario
  ```

---

### 🚫 Restricciones

* Si se intenta promover a un usuario con Rank Lock:

  * El comando se cancela automáticamente
  * El bot mostrará un aviso de bloqueo
* El Rank Lock **no se elimina solo**
* Solo **Junta Directiva** puede retirarlo

---

### 📎 Casos recomendados de uso

* Bajo rendimiento continuo
* Falta de actividad
* Advertencias administrativas
* Periodo de evaluación
* Sanción interna sin expulsión

---

## 🔒 Control del Servidor (`/server`)

**Acceso:** Administrador / Staff (según subcomando)

Gestión directa del servidor privado de ERLC desde Discord.

### 🔐 Server Lock

Cuando el servidor está bloqueado:

* Solo entran usuarios en **Whitelist**

* El bot expulsa automáticamente a cualquier otro jugador

* **Cerrar servidor**

  ```
  /server lock
  ```

* **Abrir servidor**

  ```
  /server unlock
  ```

---

### 📋 Gestión de Whitelist

Usuarios autorizados a entrar durante el Server Lock
(Ej. Staff, VIPs, Streamers)

* **Agregar**

  ```
  /server whitelist @usuario_roblox
  ```

* **Quitar**

  ```
  /server unwhitelist @usuario_roblox
  ```

---

### 🧨 Moderación Remota

* **Kick**

  ```
  /server kick [usuario] [razón]
  ```

* **Ban**

  ```
  /server ban [usuario] [razón]
  ```

* **Mensaje Global**

  ```
  /server mensaje [texto]
  ```

---

## 🗳️ Gestión de Sesiones (`/sesion`)

**Acceso:** Staff

Sistema para abrir servidor mediante votación organizada.

* **Iniciar votación**

  ```
  /sesion iniciar [mínimo_votos]
  ```

* **Cancelar votación**

  ```
  /sesion cancelar
  ```

* **Forzar apertura**

  ```
  /sesion forzar_apertura
  ```

---

## ⚖️ Sanciones (`/sancion`)

**Acceso:** Staff Nivel 1+

```
/sancion [usuario] [tipo] [razón]
```

### Tipos de sanción

* **Warn** — Advertencia acumulable
* **Kick ERLC** — Expulsión del juego
* **Ban ERLC** — Prohibición de acceso
* **Blacklist** — Prohibición total (server/facciones)

  > Requiere Nivel 4
* **SA (Server Admin)** — Sanción administrativa grave

---

## 👮 Policía y Arrestos

**Acceso:** Rol Policía / Staff

* **Arrestar**

  ```
  /arrestar [usuario] [artículos]
  ```

  * Se registra el arresto
  * Si el usuario está en ERLC, el bot lo expulsa automáticamente

* **Fianza**

  * Ver costo:

    ```
    /fianza calcular
    ```
  * Pagar:

    ```
    /fianza pagar
    ```

---

## 🕵️ Auditoría y Registros

* **Ver caso**

  ```
  /auditar [id_caso]
  ```

* **Ver warns**

  ```
  /ver_warns @usuario
  ```

* **Ver sanción**

  ```
  /ver_sancion [id]
  ```

---

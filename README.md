# Nación MX - Portal de Moderación

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73C92?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)

Portal administrativo exclusivo para el Staff de Nación MX RP. Permite gestión de registros de actividad, visualización de BOLO (Criminales Buscados) y revisión de solicitudes, todo integrado con autenticación de Discord.

## Características

- 🛡️ **Role Guard**: Acceso restringido y validado contra el servidor de Discord de Nación MX.
- 📋 **Registros de Actividad**: Sistema de Logs para Bans, Warns y Kicks.
- 🔎 **BOLO Board**: Tablero de "Be On Look Out" para criminales de alto perfil.
- 📝 **Solicitudes**: Panel de revisión para Whitelists y Oposiciones.
- 🎨 **Diseño Premium**: Interfaz oscura con acentos dorados (`#d4af37`).

## Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/usuario/nacionmx-portal.git
   cd nacionmx-portal
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Entorno**
   Crea un archivo `.env` en la raíz basado en el ejemplo (o pide las credenciales al Owner):
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

4. **Correr en Desarrollo**
   ```bash
   npm run dev
   ```

## Base de Datos (Supabase)

El esquema de la base de datos se encuentra en `supabase_schema.sql`.
Este proyecto requiere:
- Authentication habilitado (Discord Provider).
- Tablas: `profiles`, `activity_logs`, `bolos`, `applications`.

## Despliegue

El proyecto está optimizado para desplegarse en [Vercel](https://vercel.com) o [Netlify].
Simplemente conecta tu repositorio de GitHub y añade las variables de entorno en el panel de hosting.

---
*Desarrollado para Nación MX RP.*
Fri Jan 16 23:45:00 CST 2026

/**
 * ErrorMessages - Mensajes de error amigables y útiles
 * 
 * Proporciona mensajes de error consistentes y contextuales
 * con sugerencias de solución para el usuario.
 */

const ERRORS = {
    // DNI Related
    NO_DNI: '❌ **DNI Requerido**\n\nNecesitas un Documento Nacional de Identidad para usar este comando.\n\n➡️ Usa `/dni crear` para obtener uno.',

    DNI_ALREADY_EXISTS: '❌ **Ya tienes un DNI registrado**\n\nSi necesitas actualizarlo, contacta a un Staff.',

    // Economy
    INSUFFICIENT_FUNDS: (required, current) =>
        `❌ **Fondos Insuficientes**\n\n` +
        `💰 **Balance actual:** $${current.toLocaleString()}\n` +
        `📊 **Necesitas:** $${required.toLocaleString()}\n` +
        `⚠️ **Faltante:** $${(required - current).toLocaleString()}\n\n` +
        `💡 **Sugerencias:**\n` +
        `• Usa \`/trabajar\` o \`/crimen\` para ganar dinero\n` +
        `• Solicita un crédito con \`/credito\``,

    NO_CREDIT_CARD: '❌ **Tarjeta de Crédito no encontrada**\n\nPrimero necesitas solicitar una tarjeta de crédito.\n\n➡️ Usa `/credito` para más información.',

    CREDIT_LIMIT_EXCEEDED: (limit, current) =>
        `❌ **Límite de Crédito Excedido**\n\n` +
        `📊 **Límite:** $${limit.toLocaleString()}\n` +
        `💳 **Deuda actual:** $${current.toLocaleString()}\n\n` +
        `💡 Realiza un pago con \`/credito pagar\` antes de usar más crédito.`,

    // Citizenship
    NOT_CITIZEN: '❌ **No eres ciudadano**\n\nSolo los ciudadanos pueden usar este comando.\n\n➡️ Crea un DNI con `/dni crear`',

    NOT_AMERICAN: '❌ **American ID Requerido**\n\nNecesitas ser ciudadano americano para esto.\n\n➡️ Solicita una visa con `/visa solicitar`',

    ALREADY_AMERICAN: '✅ **Ya eres ciudadano americano**\n\nNo necesitas solicitar una visa.',

    // Visa
    VISA_PENDING: '⏳ **Ya tienes una solicitud de visa pendiente**\n\nPor favor espera a que el staff la revise.',

    VISA_EXISTS: '✅ **Ya tienes una visa activa**\n\nNo necesitas solicitar otra.',

    // Sanctions
    NO_ACTIVE_SANCTION: '❌ **No tienes sanciones activas**\n\nNo hay nada que apelar.',

    APPEAL_PENDING: '⏳ **Ya tienes una apelación pendiente**\n\nEspera a que el equipo la revise antes de crear otra.',

    // Permissions
    NO_PERMISSION: (requiredRole) =>
        `❌ **Permisos Insuficientes**\n\nNecesitas el rol **${requiredRole}** para usar este comando.`,

    ADMIN_ONLY: '❌ **Solo Administradores**\n\nEste comando está restringido a administradores del servidor.',

    STAFF_ONLY: '❌ **Solo Staff**\n\nEste comando solo puede ser usado por miembros del Staff.',

    // Database/System
    DB_ERROR: '❌ **Error de Base de Datos**\n\nOcurrió un error técnico. Por favor intenta de nuevo.\n\n🔧 Si el problema persiste, reporta con `/solicitar-mod`',

    RATE_LIMIT: (seconds) =>
        `⏰ **Espera un momento**\n\nDebes esperar **${seconds}** segundos antes de usar este comando nuevamente.`,

    // Generic
    UNKNOWN_ERROR: '❌ **Error Desconocido**\n\nAlgo salió mal. Por favor contacta a un administrador.\n\n🆔 Menciona el comando que intentaste usar.',

    COMMAND_DISABLED: '🚧 **Comando en Mantenimiento**\n\nEste comando está temporalmente deshabilitado.\n\n📢 Revisa <#1398891838890311732> para más información.'
};

/**
 * Success Messages - Mensajes de éxito contextuales
 */
const SUCCESS = {
    DNI_CREATED: (name) =>
        `✅ **DNI Creado Exitosamente**\n\n` +
        `👤 **Titular:** ${name}\n` +
        `📋 Ya puedes usar todos los comandos que requieren DNI.`,

    PAYMENT_SUCCESS: (amount, newBalance) =>
        `✅ **Pago Procesado**\n\n` +
        `💰 **Pagado:** $${amount.toLocaleString()}\n` +
        `📊 **Nuevo balance:** $${newBalance.toLocaleString()}`,

    TRANSFER_SUCCESS: (amount, recipient) =>
        `✅ **Transferencia Exitosa**\n\n` +
        `💸 **Monto:** $${amount.toLocaleString()}\n` +
        `👤 **Destinatario:** ${recipient}`,

    VISA_APPROVED: (visaNumber) =>
        `✅ **Visa Aprobada 🎉**\n\n` +
        `🆔 **Número de Visa:** ${visaNumber}\n` +
        `🇺🇸 Ahora eres ciudadano Americano.\n\n` +
        `➡️ Obtén tu American ID con \`/american-id\``,

    APPEAL_SUBMITTED:
        `✅ **Apelación Enviada**\n\n` +
        `📬 Tu apelación ha sido recibida por el equipo de moderación.\n` +
        `⏳ Recibirás una respuesta pronto vía DM.`
};

module.exports = { ERRORS, SUCCESS };

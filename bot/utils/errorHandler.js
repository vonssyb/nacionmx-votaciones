const logger = require('../services/Logger');

/**
 * Centralized Error Handler
 * Provides consistent error handling, user-friendly messages, and admin notifications
 */
class ErrorHandler {
    /**
     * Main error handling method
     * @param {Error} error - The error object
     * @param {Interaction} interaction - Discord interaction
     * @param {Object} context - Additional context for logging
     */
    static async handle(error, interaction, context = {}) {
        // 1. Log structured error
        logger.errorWithContext('Command execution failed', error, {
            command: interaction?.commandName || 'unknown',
            customId: interaction?.customId || 'none',
            user: interaction?.user?.id,
            guild: interaction?.guildId,
            ...context
        });

        // 2. Get user-friendly message
        const userMessage = this.getUserFriendlyMessage(error);

        // 3. Send response to user
        try {
            await this.sendErrorToUser(interaction, userMessage);
        } catch (replyError) {
            logger.error('Failed to send error message to user', {
                originalError: error.message,
                replyError: replyError.message
            });
        }

        // 4. Notify admins if critical
        if (this.isCritical(error)) {
            await this.notifyAdmins(error, interaction);
        }
    }

    /**
     * Send error message to user
     */
    static async sendErrorToUser(interaction, message) {
        if (!interaction) return;

        const errorEmbed = {
            color: 0xFF0000,
            title: '❌ Error',
            description: message,
            footer: { text: 'Si el problema persiste, contacta a un administrador' },
            timestamp: new Date().toISOString()
        };

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (e) {
            // Fallback to simple message
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `❌ ${message}`, ephemeral: true });
            }
        }
    }

    /**
     * Convert error to user-friendly message
     */
    static getUserFriendlyMessage(error) {
        // Custom error codes
        const errorMap = {
            // Economy
            'INSUFFICIENT_FUNDS': 'No tienes suficiente dinero para realizar esta operación',
            'INSUFFICIENT_CHIPS': 'No tienes suficientes fichas de casino',
            'INVALID_AMOUNT': 'El monto especificado no es válido',
            'DAILY_LIMIT_EXCEEDED': 'Has alcanzado el límite diario para esta operación',
            'COOLDOWN_ACTIVE': 'Debes esperar antes de usar este comando de nuevo',

            // Identity
            'DNI_REQUIRED': 'Necesitas registrar tu DNI primero. Usa `/dni`',
            'DNI_ALREADY_EXISTS': 'Ya tienes un DNI registrado',
            'INVALID_DNI_IMAGE': 'La imagen del DNI no es válida',

            // Permissions
            'INVALID_PERMISSION': 'No tienes permiso para realizar esta acción',
            'MISSING_ROLE': 'No tienes el rol necesario para esto',
            'BLACKLISTED': 'Estás en blacklist y no puedes usar este comando',

            // Database
            'DATABASE_ERROR': 'Error de base de datos. Intenta de nuevo en unos momentos',
            'RECORD_NOT_FOUND': 'No se encontró el registro solicitado',
            'DUPLICATE_ENTRY': 'Este registro ya existe',

            // Payment
            'PAYMENT_FAILED': 'Error al procesar el pago. Tu saldo no fue afectado',
            'INVALID_PAYMENT_METHOD': 'Método de pago no válido',
            'CARD_NOT_FOUND': 'No se encontró una tarjeta activa',
            'CREDIT_LIMIT_EXCEEDED': 'Límite de crédito excedido',

            // Casino
            'GAME_IN_PROGRESS': 'Ya hay un juego en progreso',
            'INVALID_BET': 'Apuesta no válida',
            'SESSION_EXPIRED': 'La sesión expiró. Intenta de nuevo',

            // General
            'TIMEOUT': 'La operación tardó demasiado. Intenta de nuevo',
            'RATE_LIMIT': 'Estás haciendo esto demasiado rápido. Espera un momento',
            'MAINTENANCE': 'El sistema está en mantenimiento. Intenta más tarde',
            'UNKNOWN_INTERACTION': 'Interacción desconocida o expirada'
        };

        // Check if error has a code
        if (error.code && errorMap[error.code]) {
            return errorMap[error.code];
        }

        // Check error message for common patterns
        const message = error.message?.toLowerCase() || '';

        if (message.includes('insufficient') || message.includes('insuficiente')) {
            return 'Fondos insuficientes para esta operación';
        }
        if (message.includes('permission') || message.includes('permiso')) {
            return 'No tienes permisos para realizar esta acción';
        }
        if (message.includes('not found') || message.includes('no encontrado')) {
            return 'No se encontró el recurso solicitado';
        }
        if (message.includes('timeout') || message.includes('timedout')) {
            return 'La operación tardó demasiado tiempo';
        }
        if (message.includes('duplicate') || message.includes('duplicado')) {
            return 'Este registro ya existe';
        }

        // Database-specific errors
        if (error.code === '23505') { // PostgreSQL unique violation
            return 'Este registro ya existe en la base de datos';
        }
        if (error.code === '23503') { // PostgreSQL foreign key violation
            return 'No se puede completar la operación debido a dependencias';
        }

        // Discord.js specific errors
        if (message.includes('unknown interaction')) {
            return 'Esta interacción ha expirado. Intenta ejecutar el comando de nuevo';
        }
        if (message.includes('missing permissions')) {
            return 'El bot no tiene los permisos necesarios';
        }

        // Default message
        return 'Ocurrió un error inesperado. Por favor contacta a un administrador';
    }

    /**
     * Check if error is critical and requires admin notification
     */
    static isCritical(error) {
        const criticalCodes = [
            'DATABASE_ERROR',
            'PAYMENT_FAILED',
            'DATA_CORRUPTION',
            'SECURITY_BREACH'
        ];

        if (error.code && criticalCodes.includes(error.code)) {
            return true;
        }

        // Check for database errors
        if (typeof error.code === 'string' && (error.code.startsWith('23') || error.code.startsWith('42'))) {
            return true;
        }

        // Check for critical keywords in message
        const message = error.message?.toLowerCase() || '';
        const criticalKeywords = ['corruption', 'unauthorized', 'breach', 'fatal'];

        return criticalKeywords.some(keyword => message.includes(keyword));
    }

    /**
     * Notify administrators about critical errors
     */
    static async notifyAdmins(error, interaction) {
        try {
            const ADMIN_CHANNEL_ID = process.env.ADMIN_ERROR_CHANNEL_ID;
            if (!ADMIN_CHANNEL_ID) {
                logger.warn('ADMIN_ERROR_CHANNEL_ID not configured');
                return;
            }

            const client = interaction?.client;
            if (!client) return;

            const channel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
            if (!channel) return;

            const embed = {
                color: 0xFF0000,
                title: '🚨 Critical Error Detected',
                fields: [
                    { name: 'Error', value: `\`\`\`${error.message}\`\`\``, inline: false },
                    { name: 'Command', value: interaction?.commandName || 'Unknown', inline: true },
                    { name: 'User', value: `<@${interaction?.user?.id}>` || 'Unknown', inline: true },
                    { name: 'Guild', value: interaction?.guildId || 'Unknown', inline: true },
                    { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                ],
                timestamp: new Date().toISOString()
            };

            if (error.stack) {
                embed.fields.push({
                    name: 'Stack Trace',
                    value: `\`\`\`${error.stack.substring(0, 1000)}\`\`\``,
                    inline: false
                });
            }

            await channel.send({ embeds: [embed] });
        } catch (notifyError) {
            logger.error('Failed to notify admins', { notifyError: notifyError.message });
        }
    }

    /**
     * Create a custom error with code
     */
    static createError(code, message, details = {}) {
        const error = new Error(message || this.getUserFriendlyMessage({ code }));
        error.code = code;
        error.details = details;
        return error;
    }

    /**
     * Wrap async function with error handling
     */
    static wrap(fn, context = {}) {
        return async (interaction, ...args) => {
            try {
                return await fn(interaction, ...args);
            } catch (error) {
                await this.handle(error, interaction, context);
            }
        };
    }
}

module.exports = ErrorHandler;

/**
 * Centralized Validators
 * Provides reusable validation functions
 */

const ErrorHandler = require('./errorHandler');

class Validators {
    /**
     * Validate amount (positive number)
     */
    static validateAmount(amount, options = {}) {
        const {
            min = 1,
            max = Infinity,
            fieldName = 'monto'
        } = options;

        if (typeof amount !== 'number' || isNaN(amount)) {
            throw ErrorHandler.createError('INVALID_AMOUNT', `El ${fieldName} debe ser un número válido`);
        }

        if (amount < min) {
            throw ErrorHandler.createError('INVALID_AMOUNT', `El ${fieldName} mínimo es $${min.toLocaleString()}`);
        }

        if (amount > max) {
            throw ErrorHandler.createError('INVALID_AMOUNT', `El ${fieldName} máximo es $${max.toLocaleString()}`);
        }

        return true;
    }

    /**
     * Validate DNI exists for user
     */
    static async validateDNI(supabase, userId) {
        // Check citizens table
        const { data: citizen } = await supabase
            .from('citizens')
            .select('dni_number')
            .eq('discord_id', userId)
            .maybeSingle();

        if (citizen && citizen.dni_number) {
            return { valid: true, dni: citizen.dni_number };
        }

        // Check citizen_dni table as fallback
        const { data: dniRecord } = await supabase
            .from('citizen_dni')
            .select('dni_number')
            .eq('discord_id', userId)
            .maybeSingle();

        if (dniRecord && dniRecord.dni_number) {
            return { valid: true, dni: dniRecord.dni_number };
        }

        throw ErrorHandler.createError('DNI_REQUIRED', 'Necesitas registrar tu DNI primero. Usa `/dni`');
    }

    /**
     * Validate user has sufficient balance
     */
    static async validateBalance(billingService, guildId, userId, amount, source = 'total') {
        const balance = await billingService.ubService.getUserBalance(guildId, userId);

        let available = 0;
        let sourceLabel = '';

        switch (source) {
            case 'cash':
                available = balance.cash || 0;
                sourceLabel = 'efectivo';
                break;
            case 'bank':
                available = balance.bank || 0;
                sourceLabel = 'banco';
                break;
            case 'total':
                available = (balance.cash || 0) + (balance.bank || 0);
                sourceLabel = 'total';
                break;
            default:
                throw new Error(`Invalid balance source: ${source}`);
        }

        if (available < amount) {
            throw ErrorHandler.createError('INSUFFICIENT_FUNDS',
                `Fondos insuficientes en ${sourceLabel}\n` +
                `Necesitas: $${amount.toLocaleString()}\n` +
                `Tienes: $${available.toLocaleString()}`
            );
        }

        return { valid: true, available, balance };
    }

    /**
     * Validate user has specific role
     */
    static validateRole(member, requiredRoles, throwError = true) {
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        const hasRole = roles.some(roleId => member.roles.cache.has(roleId));

        if (!hasRole && throwError) {
            throw ErrorHandler.createError('MISSING_ROLE', 'No tienes el rol necesario para esta acción');
        }

        return hasRole;
    }

    /**
     * Validate user has permission
     */
    static validatePermission(member, permission, throwError = true) {
        const hasPermission = member.permissions.has(permission);

        if (!hasPermission && throwError) {
            throw ErrorHandler.createError('INVALID_PERMISSION', 'No tienes permiso para realizar esta acción');
        }

        return hasPermission;
    }

    /**
     * Validate cooldown
     */
    static validateCooldown(cooldownMap, userId, commandName, cooldownSeconds) {
        const key = `${userId}_${commandName}`;
        const now = Date.now();
        const lastUsed = cooldownMap.get(key);

        if (lastUsed) {
            const timeLeft = lastUsed + (cooldownSeconds * 1000) - now;
            if (timeLeft > 0) {
                const seconds = Math.ceil(timeLeft / 1000);
                throw ErrorHandler.createError('COOLDOWN_ACTIVE',
                    `⏱️ Debes esperar ${seconds} segundos antes de usar este comando de nuevo`
                );
            }
        }

        cooldownMap.set(key, now);
        return true;
    }

    /**
     * Validate interaction is not expired
     */
    static validateInteraction(interaction) {
        // Discord interactions expire after 15 minutes
        const age = Date.now() - interaction.createdTimestamp;
        const maxAge = 15 * 60 * 1000; // 15 minutes

        if (age > maxAge) {
            throw ErrorHandler.createError('UNKNOWN_INTERACTION',
                'Esta interacción ha expirado. Por favor, ejecuta el comando de nuevo'
            );
        }

        return true;
    }

    /**
     * Validate user is not blacklisted
     */
    static validateNotBlacklisted(member, throwError = true) {
        const blacklistRoles = [
            '1451860028653834300', // Blacklist Moderacion
            '1413714060423200778', // Blacklist Facciones Policiales
            '1449930883762225253', // Blacklist Cartel
            '1413714467287470172', // Blacklist Politica
            '1413714540834852875'  // Blacklist Empresas
        ];

        const isBlacklisted = blacklistRoles.some(roleId => member.roles.cache.has(roleId));

        if (isBlacklisted && throwError) {
            throw ErrorHandler.createError('BLACKLISTED',
                'Estás en blacklist y no puedes usar este comando'
            );
        }

        return !isBlacklisted;
    }

    /**
     * Validate casino chips
     */
    static async validateChips(supabase, userId, amount, throwError = true) {
        const { data: account } = await supabase
            .from('casino_chips')
            .select('chips_balance')
            .eq('discord_user_id', userId)
            .maybeSingle();

        if (!account) {
            if (throwError) {
                throw ErrorHandler.createError('INSUFFICIENT_CHIPS',
                    'No tienes cuenta de casino. Compra fichas con `/casino fichas comprar`'
                );
            }
            return { valid: false, balance: 0 };
        }

        const balance = account.chips_balance || 0;

        if (balance < amount) {
            if (throwError) {
                throw ErrorHandler.createError('INSUFFICIENT_CHIPS',
                    `Fichas insuficientes\n` +
                    `Necesitas: ${amount.toLocaleString()}\n` +
                    `Tienes: ${balance.toLocaleString()}`
                );
            }
            return { valid: false, balance };
        }

        return { valid: true, balance };
    }

    /**
     * Validate credit card limit
     */
    static async validateCreditLimit(supabase, userId, amount) {
        const { data: cards } = await supabase
            .from('credit_cards')
            .select('*')
            .eq('discord_id', userId)
            .eq('status', 'active')
            .order('card_limit', { ascending: false })
            .limit(1);

        if (!cards || cards.length === 0) {
            throw ErrorHandler.createError('CARD_NOT_FOUND', 'No tienes tarjetas de crédito activas');
        }

        const card = cards[0];
        const available = card.card_limit - (card.current_balance || 0);

        if (available < amount) {
            throw ErrorHandler.createError('CREDIT_LIMIT_EXCEEDED',
                `Límite de crédito excedido\n` +
                `Disponible: $${available.toLocaleString()}\n` +
                `Necesitas: $${amount.toLocaleString()}`
            );
        }

        return { valid: true, available, card };
    }

    /**
     * Sanitize string input
     */
    static sanitizeString(input, options = {}) {
        const {
            maxLength = 1000,
            allowNewlines = false,
            trim = true
        } = options;

        if (typeof input !== 'string') {
            return '';
        }

        let sanitized = input;

        if (trim) {
            sanitized = sanitized.trim();
        }

        if (!allowNewlines) {
            sanitized = sanitized.replace(/[\r\n]+/g, ' ');
        }

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Truncate if too long
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized;
    }

    /**
     * Validate Discord ID format
     */
    static validateDiscordId(id) {
        if (!/^\d{17,19}$/.test(id)) {
            throw ErrorHandler.createError('INVALID_INPUT', 'ID de Discord no válido');
        }
        return true;
    }

    /**
     * Parse amount from string (supports "todo", "all", numbers with commas)
     */
    static parseAmount(input, availableBalance = null) {
        if (typeof input === 'number') {
            return input;
        }

        const inputStr = String(input).toLowerCase().trim();

        // Check for "all" or "todo"
        if (inputStr === 'all' || inputStr === 'todo') {
            if (availableBalance === null) {
                throw ErrorHandler.createError('INVALID_AMOUNT', 'Balance no disponible para "todo"');
            }
            return availableBalance;
        }

        // Remove commas and parse
        const cleaned = inputStr.replace(/,/g, '');
        const amount = parseFloat(cleaned);

        if (isNaN(amount)) {
            throw ErrorHandler.createError('INVALID_AMOUNT', `"${input}" no es un monto válido`);
        }

        return Math.floor(amount);
    }
}

module.exports = Validators;

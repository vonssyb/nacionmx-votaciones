/**
 * ValidationHelper
 * Centralized validation utility for user inputs across bot commands
 * 
 * Usage:
 *   const ValidationHelper = require('../../utils/ValidationHelper');  
 *   const result = ValidationHelper.validateAmount(amount, 1000, 50000000);
 *   if (!result.valid) return interaction.editReply(result.message);
 */

class ValidationHelper {
    /**
     * Validate monetary amounts with min/max bounds
     * @param {number} amount - Amount to validate
     * @param {number} min - Minimum allowed value (default: 1)
     * @param {number} max - Maximum allowed value (default: 100M)
     * @returns {{valid: boolean, message?: string, value?: number}}
     */
    static validateAmount(amount, min = 1, max = 100000000) {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return { valid: false, message: '❌ **Monto Inválido**\nDebe ser un número válido.' };
        }

        if (amount < min) {
            return {
                valid: false,
                message: `❌ **Monto muy bajo**\nEl monto mínimo es **$${min.toLocaleString()}**`
            };
        }

        if (amount > max) {
            return {
                valid: false,
                message: `❌ **Monto excesivo**\nEl monto máximo permitido es **$${max.toLocaleString()}**`
            };
        }

        return { valid: true, value: amount };
    }

    /**
     * Validate names (citizen names, company names, etc.)
     * @param {string} name - Name to validate
     * @param {number} minLength - Minimum length (default: 3)
     * @param {number} maxLength - Maximum length (default: 50)
     * @param {boolean} allowSpecialChars - Allow hyphens and periods (default: true)
     * @returns {{valid: boolean, message?: string, value?: string}}
     */
    static validateName(name, minLength = 3, maxLength = 50, allowSpecialChars = true) {
        if (!name || typeof name !== 'string') {
            return { valid: false, message: '❌ **Nombre Inválido**\nEl nombre no puede estar vacío.' };
        }

        const trimmed = name.trim();

        if (trimmed.length === 0) {
            return { valid: false, message: '❌ **Nombre Vacío**\nProporciona un nombre válido.' };
        }

        if (trimmed.length < minLength) {
            return {
                valid: false,
                message: `❌ **Nombre muy corto**\nDebe tener al menos **${minLength} caracteres**.`
            };
        }

        if (trimmed.length > maxLength) {
            return {
                valid: false,
                message: `❌ **Nombre muy largo**\nNo puede exceder **${maxLength} caracteres**.`
            };
        }

        // Validate allowed characters
        const pattern = allowSpecialChars
            ? /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-\.]+$/
            : /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

        if (!pattern.test(trimmed)) {
            return {
                valid: false,
                message: '❌ **Caracteres no permitidos**\nUsa solo letras, espacios' +
                    (allowSpecialChars ? ', guiones y puntos.' : '.')
            };
        }

        return { valid: true, value: trimmed };
    }

    /**
     * Sanitize and validate general string input
     * @param {string} str - String to sanitize
     * @param {number} maxLength - Maximum allowed length (default: 200)
     * @returns {{valid: boolean, message?: string, value?: string}}
     */
    static sanitizeString(str, maxLength = 200) {
        if (typeof str !== 'string') {
            return { valid: false, message: '❌ Entrada inválida.' };
        }

        const trimmed = str.trim();

        if (trimmed.length === 0) {
            return { valid: false, message: '❌ El texto no puede estar vacío.' };
        }

        if (trimmed.length > maxLength) {
            return {
                valid: false,
                message: `❌ Texto muy largo. Máximo ${maxLength} caracteres.`
            };
        }

        // Remove potentially dangerous characters
        const sanitized = trimmed
            .replace(/[<>]/g, '') // Remove < and > to prevent injection
            .replace(/[`]/g, '\\`'); // Escape backticks for Discord embeds

        return { valid: true, value: sanitized };
    }

    /**
     * Validate percentage values (0-100)
     * @param {number} percentage - Percentage to validate
     * @returns {{valid: boolean, message?: string, value?: number}}
     */
    static validatePercentage(percentage) {
        if (typeof percentage !== 'number' || isNaN(percentage)) {
            return { valid: false, message: '❌ Porcentaje inválido.' };
        }

        if (percentage < 0 || percentage > 100) {
            return {
                valid: false,
                message: '❌ El porcentaje debe estar entre **0% y 100%**.'
            };
        }

        return { valid: true, value: percentage };
    }

    /**
     * Validate positive integers
     * @param {number} value - Value to validate
     *  @param {string} fieldName - Name of the field for error messages
     * @returns {{valid: boolean, message?: string, value?: number}}
     */
    static validatePositiveInteger(value, fieldName = 'Valor') {
        if (typeof value !== 'number' || isNaN(value)) {
            return { valid: false, message: `❌ ${fieldName} inválido.` };
        }

        if (!Number.isInteger(value)) {
            return { valid: false, message: `❌ ${fieldName} debe ser un número entero.` };
        }

        if (value < 1) {
            return { valid: false, message: `❌ ${fieldName} debe ser mayor a 0.` };
        }

        return { valid: true, value };
    }

    /**
     * Validate number is within range
     * @param {number} value - Value to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {string} fieldName - Name of field for errors
     * @returns {{valid: boolean, message?: string, value?: number}}
     */
    static validateRange(value, min, max, fieldName = 'Valor') {
        if (typeof value !== 'number' || isNaN(value)) {
            return { valid: false, message: `❌ ${fieldName} inválido.` };
        }

        if (value < min || value > max) {
            return {
                valid: false,
                message: `❌ ${fieldName} debe estar entre **${min.toLocaleString()}** y **${max.toLocaleString()}**.`
            };
        }

        return { valid: true, value };
    }

    /**
     * Validate Discord user ID format
     * @param {string} userId - User ID to validate
     * @returns {{valid: boolean, message?: string, value?: string}}
     */
    static validateDiscordId(userId) {
        if (typeof userId !== 'string') {
            return { valid: false, message: '❌ ID de usuario inválido.' };
        }

        // Discord IDs are 17-19 digit snowflakes
        const idPattern = /^\d{17,19}$/;

        if (!idPattern.test(userId)) {
            return { valid: false, message: '❌ Formato de ID de Discord inválido.' };
        }

        return { valid: true, value: userId };
    }

    /**
     * Validate date is in the future
     * @param {Date|string} date - Date to validate
     * @param {string} fieldName - Field name for errors
     * @returns {{valid: boolean, message?: string, value?: Date}}
     */
    static validateFutureDate(date, fieldName = 'Fecha') {
        const dateObj = date instanceof Date ? date : new Date(date);

        if (isNaN(dateObj.getTime())) {
            return { valid: false, message: `❌ ${fieldName} inválida.` };
        }

        if (dateObj <= new Date()) {
            return { valid: false, message: `❌ ${fieldName} debe ser en el futuro.` };
        }

        return { valid: true, value: dateObj };
    }

    /**
     * Validate email format (basic)
     * @param {string} email - Email to validate
     * @returns {{valid: boolean, message?: string, value?: string}}
     */
    static validateEmail(email) {
        if (typeof email !== 'string') {
            return { valid: false, message: '❌ Email inválido.' };
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return { valid: false, message: '❌ Formato de email inválido.' };
        }

        return { valid: true, value: email.toLowerCase().trim() };
    }

    /**
     * Validate hex color code
     * @param {string} color - Hex color code (with or without #)
     * @returns {{valid: boolean, message?: string, value?: string}}
     */
    static validateHexColor(color) {
        if (typeof color !== 'string') {
            return { valid: false, message: '❌ Color inválido.' };
        }

        const colorPattern = /^#?[0-9A-Fa-f]{6}$/;

        if (!colorPattern.test(color)) {
            return { valid: false, message: '❌ Color debe ser formato HEX (ejemplo: #FF5733).' };
        }

        // Ensure it starts with #
        const normalized = color.startsWith('#') ? color : `#${color}`;

        return { valid: true, value: normalized };
    }
}

module.exports = ValidationHelper;

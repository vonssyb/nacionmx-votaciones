/**
 * DNIService
 * Centralized Identity Document (DNI) management service
 * 
 * Handles:
 * - DNI CRUD operations
 * - CURP generation
 * - DNI number generation
 * - Document validation
 * - Embed formatting
 * 
 * Usage:
 *   const DNIService = require('../services/DNIService');
 *   const dni = await DNIService.getDNI(supabase, userId);
 */

const { EmbedBuilder } = require('discord.js');
const ValidationHelper = require('../utils/ValidationHelper');

class DNIService {
    /**
     * Create new DNI
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {object} dniData - DNI data
     * @param {string} dniData.nombre - Full name
     * @param {string} dniData.fecha_nacimiento - Birth date
     * @param {string} dniData.sexo - Gender (M/F)
     * @param {string} dniData.nacionalidad - Nationality
     * @param {string} dniData.estado_nacimiento - Birth state
     * @param {string} dniData.domicilio - Address
     * @returns {Promise<{success: boolean, message: string, data?: object}>}
     */
    static async createDNI(supabase, userId, dniData) {
        try {
            // Check if DNI already exists
            const existing = await this.getDNI(supabase, userId);
            if (existing) {
                return {
                    success: false,
                    message: '❌ Este usuario ya tiene un DNI registrado.'
                };
            }

            // Validate name
            const nameValidation = ValidationHelper.validateName(dniData.nombre, 3, 50);
            if (!nameValidation.valid) {
                return { success: false, message: nameValidation.message };
            }

            // Generate DNI number and CURP
            const dniNumber = this.generateDNINumber();
            const curp = this.generateCURP({
                nombre: dniData.nombre,
                apellidoPaterno: dniData.apellido_paterno || '',
                apellidoMaterno: dniData.apellido_materno || '',
                fecha: dniData.fecha_nacimiento,
                sexo: dniData.sexo,
                estado: dniData.estado_nacimiento
            });

            // Insert DNI
            const { data, error } = await supabase
                .from('citizen_dni')
                .insert({
                    discord_user_id: userId,
                    dni_number: dniNumber,
                    curp: curp,
                    nombre: dniData.nombre,
                    apellido_paterno: dniData.apellido_paterno,
                    apellido_materno: dniData.apellido_materno,
                    fecha_nacimiento: dniData.fecha_nacimiento,
                    sexo: dniData.sexo,
                    nacionalidad: dniData.nacionalidad || 'Mexicana',
                    estado_nacimiento: dniData.estado_nacimiento,
                    domicilio: dniData.domicilio,
                    foto_url: dniData.foto_url,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('[DNIService] Error creating DNI:', error);
                return {
                    success: false,
                    message: '❌ Error al crear DNI.'
                };
            }

            return {
                success: true,
                message: '✅ DNI creado exitosamente.',
                data
            };
        } catch (error) {
            console.error('[DNIService] Exception creating DNI:', error);
            return {
                success: false,
                message: '❌ Error al crear DNI.'
            };
        }
    }

    /**
     * Get DNI by user ID
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @returns {Promise<object|null>} DNI data or null
     */
    static async getDNI(supabase, userId) {
        const { data, error } = await supabase
            .from('citizen_dni')
            .select('*')
            .eq('discord_user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[DNIService] Error fetching DNI:', error);
            return null;
        }

        return data;
    }

    /**
     * Update DNI
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @param {object} updates - Fields to update
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async updateDNI(supabase, userId, updates) {
        try {
            // Validate updates if they contain name
            if (updates.nombre) {
                const nameValidation = ValidationHelper.validateName(updates.nombre, 3, 50);
                if (!nameValidation.valid) {
                    return { success: false, message: nameValidation.message };
                }
            }

            const { error } = await supabase
                .from('citizen_dni')
                .update(updates)
                .eq('discord_user_id', userId);

            if (error) {
                console.error('[DNIService] Error updating DNI:', error);
                return {
                    success: false,
                    message: '❌ Error al actualizar DNI.'
                };
            }

            return {
                success: true,
                message: '✅ DNI actualizado exitosamente.'
            };
        } catch (error) {
            console.error('[DNIService] Exception updating DNI:', error);
            return {
                success: false,
                message: '❌ Error al actualizar DNI.'
            };
        }
    }

    /**
     * Delete DNI
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async deleteDNI(supabase, userId) {
        try {
            const { error } = await supabase
                .from('citizen_dni')
                .delete()
                .eq('discord_user_id', userId);

            if (error) {
                console.error('[DNIService] Error deleting DNI:', error);
                return {
                    success: false,
                    message: '❌ Error al eliminar DNI.'
                };
            }

            return {
                success: true,
                message: '✅ DNI eliminado exitosamente.'
            };
        } catch (error) {
            console.error('[DNIService] Exception deleting DNI:', error);
            return {
                success: false,
                message: '❌ Error al eliminar DNI.'
            };
        }
    }

    /**
     * Check if DNI exists
     * @param {object} supabase - Supabase client
     * @param {string} userId - Discord user ID
     * @returns {Promise<boolean>}
     */
    static async dniExists(supabase, userId) {
        const dni = await this.getDNI(supabase, userId);
        return dni !== null;
    }

    /**
     * Validate DNI data
     * @param {object} data - DNI data to validate
     * @returns {{valid: boolean, message?: string}}
     */
    static validateDNIData(data) {
        // Validate name
        const nameValidation = ValidationHelper.validateName(data.nombre, 3, 50);
        if (!nameValidation.valid) {
            return nameValidation;
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(data.fecha_nacimiento)) {
            return {
                valid: false,
                message: '❌ Fecha de nacimiento inválida. Formato: YYYY-MM-DD'
            };
        }

        // Validate gender
        if (!['M', 'F', 'Masculino', 'Femenino'].includes(data.sexo)) {
            return {
                valid: false,
                message: '❌ Sexo inválido. Use M o F.'
            };
        }

        return { valid: true };
    }

    /**
     * Generate DNI number (Mexican format: 13 digits)
     * @returns {string} DNI number
     */
    static generateDNINumber() {
        // Generate format: XXXX-XXXX-XXXXX (13 digits)
        const part1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const part2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const part3 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');

        return `${part1}-${part2}-${part3}`;
    }

    /**
     * Generate CURP (Mexican Unique Population Registry Code)
     * @param {object} data - Person data
     * @param {string} data.apellidoPaterno - Father's surname
     * @param {string} data.apellidoMaterno - Mother's surname
     * @param {string} data.nombre - First name
     * @param {string} data.fecha - Birth date (YYYY-MM-DD)
     * @param {string} data.sexo - Sex (M/F)
     * @param {string} data.estado - Birth state code
     * @returns {string} CURP
     */
    static generateCURP(data) {
        try {
            // Simplifiied CURP generation (not fully compliant but visually similar)
            const apellidoP = (data.apellidoPaterno || 'X').toUpperCase();
            const apellidoM = (data.apellidoMaterno || 'X').toUpperCase();
            const nombre = (data.nombre || 'X').toUpperCase();
            const fecha = data.fecha.replace(/-/g, '').substring(2); // YYMMDD
            const sexo = data.sexo === 'M' || data.sexo === 'Masculino' ? 'H' : 'M';

            // State code (simplified)
            const estadoCodes = {
                'CDMX': 'DF',
                'Ciudad de México': 'DF',
                'Jalisco': 'JC',
                'Nuevo León': 'NL',
                'Default': 'NE'
            };
            const estado = estadoCodes[data.estado] || estadoCodes.Default;

            // Format: AAAA YYMMDD S EE XXX X
            // A = First letter apellidoPaterno + first vowel apellidoPaterno + inicial apellidoMaterno + inicial nombre
            const letra1 = apellidoP[0] || 'X';
            const vocal = (apellidoP.match(/[AEIOU]/)?.[0]) || 'X';
            const letra2 = apellidoM[0] || 'X';
            const letra3 = nombre.split(' ')[0][0] || 'X';

            // Random consonants for uniqueness
            const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();

            return `${letra1}${vocal}${letra2}${letra3}${fecha}${sexo}${estado}${randomPart}`;
        } catch (error) {
            console.error('[DNIService] Error generating CURP:', error);
            return 'XXXX000000XXXXXX00';
        }
    }

    /**
     * Format DNI display text
     * @param {object} dniData - DNI data
     * @returns {string} Formatted display string
     */
    static formatDNIDisplay(dniData) {
        if (!dniData) return 'Sin DNI';

        return `**${dniData.nombre}**\\n` +
            `📋 DNI: \`${dniData.dni_number}\`\\n` +
            `🆔 CURP: \`${dniData.curp}\`\\n` +
            `📅 Nacimiento: ${dniData.fecha_nacimiento}\\n` +
            `🏠 Domicilio: ${dniData.domicilio || 'No especificado'}`;
    }

    /**
     * Create DNI embed
     * @param {object} dniData - DNI data
     * @param {GuildMember} member - Discord guild member
     * @returns {EmbedBuilder} DNI embed
     */
    static createDNIEmbed(dniData, member) {
        const embed = new EmbedBuilder()
            .setTitle('🪪 Documento Nacional de Identidad')
            .setColor('#FF0000')
            .setThumbnail(dniData.foto_url || member.user.displayAvatarURL())
            .addFields(
                { name: '📋 Número de DNI', value: `\`${dniData.dni_number}\``, inline: true },
                { name: '🆔 CURP', value: `\`${dniData.curp}\``, inline: true },
                { name: '👤 Nombre Completo', value: `${dniData.nombre} ${dniData.apellido_paterno || ''} ${dniData.apellido_materno || ''}`, inline: false },
                { name: '📅 Fecha de Nacimiento', value: dniData.fech a_nacimiento, inline: true },
                { name: '⚧ Sexo', value: dniData.sexo === 'M' ? 'Masculino' : 'Femenino', inline: true },
                { name: '🌎 Nacionalidad', value: dniData.nacionalidad || 'Mexicana', inline: true },
                { name: '🏛️ Estado de Nacimiento', value: dniData.estado_nacimiento || 'No especificado', inline: true },
                { name: '🏠 Domicilio', value: dniData.domicilio || 'No especificado', inline: false }
            )
            .setFooter({ text: `Expedido: ${new Date(dniData.created_at).toLocaleDateString()}` })
            .setTimestamp();

        return embed;
    }
}

module.exports = DNIService;

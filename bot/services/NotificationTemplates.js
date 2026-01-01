/**
 * NotificationTemplates - Message templates for different notification types
 * Fase 3, Item #7: Notificaciones Inteligentes
 */

const { formatMoney, formatNumber } = require('../utils/formatters');

module.exports = {
    /**
     * Weekly Summary Template
     */
    weeklySummary: (stats) => ({
        embeds: [{
            title: '📊 Resumen Semanal - NacionMX',
            description: `Aquí está tu resumen financiero de la semana:`,
            color: 0xFFD700,
            fields: [
                {
                    name: '💸 Total Gastado',
                    value: formatMoney(stats.spent),
                    inline: true
                },
                {
                    name: '💰 Total Recibido',
                    value: formatMoney(stats.received),
                    inline: true
                },
                {
                    name: '📊 Balance Inicial',
                    value: formatMoney(stats.start_balance),
                    inline: true
                },
                {
                    name: '💼 Balance Final',
                    value: formatMoney(stats.end_balance),
                    inline: true
                },
                {
                    name: stats.change >= 0 ? '📈 Ganancia' : '📉 Pérdida',
                    value: `${stats.change >= 0 ? '+' : ''}${formatMoney(stats.change)}`,
                    inline: true
                }
            ],
            footer: {
                text: '¡Buen trabajo esta semana! 🎉'
            },
            timestamp: new Date()
        }]
    }),

    /**
     * Debt Alert Template
     */
    debtAlert: (card, percentage) => {
        const emoji = percentage >= 95 ? '🚨' : percentage >= 90 ? '⚠️' : '📊';
        const color = percentage >= 95 ? 0xFF0000 : percentage >= 90 ? 0xFF4500 : 0xFFA500;
        const title = percentage >= 95 ? 'ALERTA CRÍTICA DE DEUDA' : percentage >= 90 ? 'ALERTA DE DEUDA' : 'Aviso de Deuda';

        return {
            embeds: [{
                title: `${emoji} ${title}`,
                description: `Tu tarjeta ** ${card.card_type} ** está al ** ${percentage.toFixed(1)} %** del límite de crédito.`,
                color,
                fields: [
                    {
                        name: '💳 Tarjeta',
                        value: card.card_type,
                        inline: true
                    },
                    {
                        name: '💰 Deuda Actual',
                        value: formatMoney(card.current_balance),
                        inline: true
                    },
                    {
                        name: '📊 Límite Total',
                        value: formatMoney(card.credit_limit),
                        inline: true
                    },
                    {
                        name: '✅ Disponible',
                        value: formatMoney(card.credit_limit - card.current_balance),
                        inline: true
                    },
                    {
                        name: '⚠️ Interés',
                        value: `${card.interest_rate} % `,
                        inline: true
                    },
                    {
                        name: '📅 Recomendación',
                        value: percentage >= 90
                            ? '🚨 Paga URGENTE para evitar más intereses'
                            : '💡 Considera pagar pronto para mantener buen crédito',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Usa /credito pagar para reducir tu deuda'
                },
                timestamp: new Date()
            }]
        };
    },

    /**
     * Payment Reminder Template
     */
    paymentReminder: (payment) => ({
        embeds: [{
            title: '🔔 Recordatorio de Pago',
            description: `Tu pago vence ** mañana **.No olvides pagarlo a tiempo para evitar intereses.`,
            color: 0x00BFFF,
            fields: [
                {
                    name: '💰 Monto',
                    value: formatMoney(payment.amount),
                    inline: true
                },
                {
                    name: '📅 Vencimiento',
                    value: payment.dueDate,
                    inline: true
                },
                {
                    name: '📝 Concepto',
                    value: payment.concept || 'Pago de crédito',
                    inline: false
                },
                {
                    name: '⚡ Acción Rápida',
                    value: 'Usa el comando `/ credito pagar` para pagar ahora',
                    inline: false
                }
            ],
            footer: {
                text: 'NacionMX - Sistema Bancario'
            },
            timestamp: new Date()
        }]
    }),

    /**
     * Transaction Group Template
     */
    transactionGroup: (transactions) => {
        const total = transactions.reduce((sum, t) => sum + t.amount, 0);
        const income = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expenses = Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));

        return {
            embeds: [{
                title: `💰 ${transactions.length} Transacciones Recientes`,
                description: `Resumen de tus últimas transacciones agrupadas: `,
                color: total >= 0 ? 0x00FF00 : 0xFF0000,
                fields: [
                    {
                        name: '📊 Total Neto',
                        value: `${total >= 0 ? '+' : ''}${formatMoney(total)}`,
                        inline: true
                    },
                    {
                        name: '📥 Ingresos',
                        value: `+ ${formatMoney(income)}`,
                        inline: true
                    },
                    {
                        name: '📤 Gastos',
                        value: `- ${formatMoney(expenses)}`,
                        inline: true
                    },
                    {
                        name: '📋 Detalles de Transacciones',
                        value: transactions.slice(0, 5).map(t =>
                            `• ${t.type}: ${t.amount >= 0 ? '+' : ''}$${Math.abs(t.amount).toLocaleString()}`
                        ).join('\n') + (transactions.length > 5 ? `\n...y ${transactions.length - 5} más` : ''),
                        inline: false
                    }
                ],
                footer: {
                    text: `Total: ${transactions.length} transacciones`
                },
                timestamp: new Date()
            }]
        };
    },

    /**
     * Payroll Reminder Template
     */
    payrollReminder: (payroll) => ({
        embeds: [{
            title: '💼 Recordatorio de Nómina',
            description: `Hay una nómina pendiente de pagar.`,
            color: 0xFFD700,
            fields: [
                {
                    name: '👥 Empleados',
                    value: `${payroll.employeeCount} empleados`,
                    inline: true
                },
                {
                    name: '💰 Total',
                    value: formatMoney(payroll.totalAmount),
                    inline: true
                },
                {
                    name: '🏢 Empresa',
                    value: payroll.companyName,
                    inline: false
                },
                {
                    name: '⚡ Acción',
                    value: 'Usa `/ nomina pagar` para procesarla',
                    inline: false
                }
            ],
            timestamp: new Date()
        }]
    }),

    /**
     * Investment Maturity Reminder
     */
    investmentReminder: (investment) => ({
        embeds: [{
            title: '📈 Inversión Disponible',
            description: `Tu inversión está lista para cobrarse.`,
            color: 0x32CD32,
            fields: [
                {
                    name: '💰 Ganancia',
                    value: formatMoney(investment.profit),
                    inline: true
                },
                {
                    name: '📊 ROI',
                    value: `${investment.roi} % `,
                    inline: true
                },
                {
                    name: '⏰ Vence',
                    value: 'Mañana',
                    inline: true
                },
                {
                    name: '⚡ Acción',
                    value: 'Usa `/ bolsa cobrar` para retirar tu dinero',
                    inline: false
                }
            ],
            timestamp: new Date()
        }]
    }),

    /**
     * 10.1 REPORTE OFICIAL DE SANCIÓN (General)
     */
    officialSanction: (data) => {
        const { date, time, offender, moderator, ruleCode, description, sanctionType, duration, evidenceUrl } = data;

        // Build Sanction Checkbox visual
        // We now have more types, so we organize them better
        const types = [
            { label: 'Advertencia Verbal', match: ['verbal', 'advertencia verbal'] },
            { label: 'Warn (Advertencia)', match: ['warn', 'advertencia'] },
            { label: 'Kick (Expulsión)', match: ['kick', 'expulsión'] },
            { label: 'Ban Temporal', match: ['ban temporal'] },
            { label: 'Ban Permanente', match: ['ban permanente', 'blacklist total', 'permanent'] },
            { label: 'Blacklist (Veto)', match: ['blacklist'] }
        ];

        const sanctionVisual = types.map(t => {
            // Check if available sanctionType matches this category (Case Insensitive)
            const safeType = (sanctionType || '').toLowerCase();
            const isSelected = t.match.some(m => safeType.includes(m));

            let text = t.label;

            // Dynamic Text Logic
            if (isSelected) {
                if (safeType.includes('ban temporal')) {
                    text = `Ban Temporal (${duration || '?'} Días)`;
                } else if (safeType.includes('erlc')) {
                    text += ' (In-Game / ERLC)';
                } else if (safeType.includes('blacklist')) {
                    // Extract specific blacklist type if present
                    text = sanctionType; // e.g. "BLACKLIST: Cartel"
                }
            }

            return `${isSelected ? '☑️' : '⬜'} ${text}`;
        }).join('\n');

        // Check if it's a BLACKLIST TOTAL (Perm Ban)
        const isBlacklist = (sanctionType || '').toLowerCase().includes('blacklist');
        const isPerm = (sanctionType || '').toLowerCase().includes('total') || (sanctionType || '').toLowerCase().includes('permanente');

        let title = '👮‍♂️ REPORTE OFICIAL DE SANCIÓN';
        let color = 0x2f3136; // Dark grey/formal
        let thumbnail = null;

        // Custom Styling for Blacklist
        if (isBlacklist) {
            // Default to Partial Blacklist title
            // sanctionType usually looks like "BLACKLIST: Blacklist Empresas" or similar
            // We clean it up for the title
            const cleanType = sanctionType.replace(/BLACKLIST:?|Blacklist/gi, '').trim();

            title = `⛔ BLACKLIST ACTIVO: ${cleanType.toUpperCase()}`;
            color = 0x000000; // Pitch Black
            thumbnail = 'https://cdn-icons-png.flaticon.com/512/1602/1602305.png'; // Stop/Ban icon

            if (isPerm) {
                title = '☠️ BLACKLIST TOTAL - EXPULSIÓN PERMANENTE';
                color = 0x8b0000; // Blood Red
                thumbnail = 'https://cdn-icons-png.flaticon.com/512/9205/9205315.png'; // Adios icon
            }
        }

        const embedData = {
            title: title,
            description: `**⚖️ Sanción Aplicada:**\n${sanctionVisual}`,
            color: color,
            fields: [
                {
                    name: '📅 Fecha y Hora',
                    value: `${date} - ${time} (Hora México)`,
                    inline: true
                },
                {
                    name: '👤 Usuario Sancionado',
                    value: `${offender}\n🆔 ${offender.id || 'N/A'}`,
                    inline: true
                },
                {
                    name: '📜 Infracción Cometida',
                    value: `**${ruleCode}**`,
                    inline: false
                },
                {
                    name: '📝 Descripción de los Hechos',
                    value: description,
                    inline: false
                },
                {
                    name: '📸 Evidencia Adjunta',
                    value: evidenceUrl || 'Sin evidencia adjunta',
                    inline: false
                }
            ],
            image: evidenceUrl ? { url: evidenceUrl } : null,
            footer: {
                text: `Moderador: ${moderator.username} | Nación MX RP`,
                icon_url: moderator.displayAvatarURL ? moderator.displayAvatarURL() : null
            },
            timestamp: new Date()
        };

        if (thumbnail) embedData.thumbnail = { url: thumbnail };

        return { embeds: [embedData] };
    },

    /**
     * 10.2 FORMATO DE SANCIÓN ADMINISTRATIVA (SA)
     */
    administrativeSanction: (data) => {
        const { date, offender, reasonDetail } = data;

        return {
            embeds: [{
                title: '🚨 SANCIÓN ADMINISTRATIVA (SA) 🚨',
                description: 'Notificación oficial de falta administrativa.',
                color: 0x8b0000,
                fields: [
                    {
                        name: '📅 Fecha de Emisión',
                        value: date,
                        inline: true
                    },
                    {
                        name: '👤 Usuario',
                        value: `${offender}\n🆔 ${offender.id}`,
                        inline: true
                    },
                    {
                        name: '⚠️ Motivo',
                        value: reasonDetail || 'Conducta inapropiada en el ámbito administrativo.',
                        inline: false
                    },
                    {
                        name: 'ℹ️ INFORMACIÓN IMPORTANTE',
                        value: 'Esta es una **Sanción Administrativa (SA)** acumulativa.\n\n🔸 Las SAs **no caducan** automáticamente.\n🔸 Acumular **5 SAs** resultará en un **Ban Permanente** de la comunidad.\n\nSe le exhorta a mejorar su conducta para evitar futuras sanciones severas.',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Dirección de Nación MX RP • Sistema de Gestión de Personal'
                },
                timestamp: new Date()
            }]
        };
    },

    /**
     * 10.4 NOTIFICACIÓN PERSONAL (Directa al Usuario)
     */
    personalNotification: (data) => {
        const { date, subject, body, user } = data;

        return {
            embeds: [{
                title: '📩 NOTIFICACIÓN ADMINISTRATIVA',
                color: 0xFFA500, // Orange/Attention
                fields: [
                    {
                        name: '📅 Fecha',
                        value: date,
                        inline: true
                    },
                    {
                        name: '👤 Destinatario',
                        value: `${user} (\`${user.username}\`)`,
                        inline: true
                    },
                    {
                        name: '📌 Asunto',
                        value: subject,
                        inline: false
                    }
                ],
                description: `**Mensaje Oficial:**\n\n${body}\n\nAtentamente,\n**Dirección de Nación MX RP** 🇲🇽`,
                footer: {
                    text: 'Esta notificación ha sido registrada en tu expediente.'
                },
                timestamp: new Date()
            }]
        };
    },

    /**
     * 10.3 FORMATO DE NOTIFICACIÓN GENERAL (Anuncio Global)
     */
    generalNotification: (data) => {
        const { date, subject, body } = data;

        return {
            embeds: [{
                title: '📢 COMUNICADO OFICIAL - NACIÓN MX RP',
                color: 0x00BFFF, // Banner Blue
                fields: [
                    {
                        name: '📅 Fecha',
                        value: date,
                        inline: true
                    },
                    {
                        name: '📌 Asunto',
                        value: subject,
                        inline: false
                    }
                ],
                description: `Estimada comunidad, \n\n${body} \n\nAtentamente, \n ** Equipo de Administración **\nNación MX RP 🇲🇽`,
                timestamp: new Date()
            }]
        };
    }
};

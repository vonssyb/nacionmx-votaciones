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
                    value: `${stats.change >= 0 ? '+' : ''}${format Money(stats.change)
                }`,
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
                title: `${ emoji } ${ title }`,
                description: `Tu tarjeta ** ${ card.card_type } ** está al ** ${ percentage.toFixed(1) } %** del límite de crédito.`,
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
                        value: `${ card.interest_rate } % `,
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
                title: `💰 ${ transactions.length } Transacciones Recientes`,
                description: `Resumen de tus últimas transacciones agrupadas: `,
                color: total >= 0 ? 0x00FF00 : 0xFF0000,
                fields: [
                    {
                        name: '📊 Total Neto',
                        value: `${ total >= 0 ? '+' : ''}${ formatMoney(total) }`,
                        inline: true
                    },
                    {
                        name: '📥 Ingresos',
                        value: `+ ${ formatMoney(income) }`,
                        inline: true
                    },
                    {
                        name: '📤 Gastos',
                        value: `- ${ formatMoney(expenses) }`,
                        inline: true
                    },
                    {
                        name: '📋 Detalles de Transacciones',
                        value: transactions.slice(0, 5).map(t => 
                            `• ${ t.type }: ${ t.amount >= 0 ? '+' : '' }$${ Math.abs(t.amount).toLocaleString() }`
                        ).join('\n') + (transactions.length > 5 ? `\n...y ${ transactions.length - 5 } más` : ''),
                        inline: false
                    }
                ],
                footer: {
                    text: `Total: ${ transactions.length } transacciones`
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
                    value: `${ payroll.employeeCount } empleados`,
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
                    value: `${ investment.roi } % `,
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
    })
};

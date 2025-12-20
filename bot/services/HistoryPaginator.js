// Paginated History System - Fase 3, Item #9
// Enhanced /historial command with pagination, filters, and export

/**
 * HistoryPaginator - Manages paginated transaction history
 */
class HistoryPaginator {
    constructor(supabase) {
        this.supabase = supabase;
        this.pageSize = 10;
        this.activeSessions = new Map(); // userId -> session data
    }

    /**
     * Get paginated history for user
     */
    async getHistory(userId, page = 1, filters = {}) {
        const offset = (page - 1) * this.pageSize;

        let query = this.supabase
            .from('transaction_logs')
            .select('*', { count: 'exact' })
            .eq('discord_user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + this.pageSize - 1);

        // Apply filters
        if (filters.type) {
            query = query.eq('type', filters.type);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.dateFrom) {
            query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.lte('created_at', filters.dateTo);
        }
        if (filters.minAmount) {
            query = query.gte('amount', filters.minAmount);
        }
        if (filters.maxAmount) {
            query = query.lte('amount', filters.maxAmount);
        }

        const { data, count, error } = await query;

        if (error) throw error;

        return {
            transactions: data || [],
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / this.pageSize),
            hasNext: offset + this.pageSize < (count || 0),
            hasPrev: page > 1
        };
    }

    /**
     * Build embed for history page
     */
    buildHistoryEmbed(history, filters = {}) {
        const { transactions, page, totalPages, total } = history;

        const embed = {
            title: '📜 Historial de Transacciones',
            description: total > 0
                ? `Mostrando página ${page} de ${totalPages} (${total} transacciones total)`
                : 'No hay transacciones',
            color: 0xFFD700,
            fields: [],
            footer: {
                text: `Página ${page}/${totalPages}`
            },
            timestamp: new Date()
        };

        // Add active filters as description
        if (Object.keys(filters).length > 0) {
            const filterText = [];
            if (filters.type) filterText.push(`Tipo: ${filters.type}`);
            if (filters.status) filterText.push(`Estado: ${filters.status}`);
            if (filters.minAmount || filters.maxAmount) {
                filterText.push(`Monto: $${filters.minAmount || 0} - $${filters.maxAmount || '∞'}`);
            }
            if (filterText.length > 0) {
                embed.description += `\n🔍 Filtros: ${filterText.join(', ')}`;
            }
        }

        // Add transactions
        transactions.forEach((tx, index) => {
            const icon = tx.amount >= 0 ? '📥' : '📤';
            const sign = tx.amount >= 0 ? '+' : '';

            embed.fields.push({
                name: `${icon} ${tx.type || 'Transacción'}`,
                value: `Monto: ${sign}$${Math.abs(tx.amount).toLocaleString()}\nEstado: ${tx.status}\nFecha: ${new Date(tx.created_at).toLocaleString('es-MX')}`,
                inline: true
            });
        });

        if (transactions.length === 0) {
            embed.fields.push({
                name: '❌ Sin resultados',
                value: 'No hay transacciones que coincidan con los filtros.',
                inline: false
            });
        }

        return embed;
    }

    /**
     * Build pagination buttons
     */
    buildPaginationButtons(history, sessionId) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const row = new ActionRowBuilder();

        // Previous page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_prev_${sessionId}`)
                .setLabel('◀ Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!history.hasPrev)
        );

        // Page indicator button (disabled)
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_page_${sessionId}`)
                .setLabel(`${history.page}/${history.totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next page button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_next_${sessionId}`)
                .setLabel('Siguiente ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!history.hasNext)
        );

        // Export button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_export_${sessionId}`)
                .setLabel('📥 Exportar CSV')
                .setStyle(ButtonStyle.Success)
        );

        // Filter button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_filter_${sessionId}`)
                .setLabel('🔍 Filtros')
                .setStyle(ButtonStyle.Secondary)
        );

        return row;
    }

    /**
     * Create session for user
     */
    createSession(userId, filters = {}) {
        const sessionId = `${userId}_${Date.now()}`;

        this.activeSessions.set(sessionId, {
            userId,
            page: 1,
            filters,
            createdAt: Date.now()
        });

        // Auto-cleanup after 15 minutes
        setTimeout(() => {
            this.activeSessions.delete(sessionId);
        }, 15 * 60 * 1000);

        return sessionId;
    }

    /**
     * Get session
     */
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    /**
     * Update session page
     */
    updateSessionPage(sessionId, newPage) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.page = newPage;
            this.activeSessions.set(sessionId, session);
        }
    }

    /**
     * Export history to CSV
     */
    async exportToCSV(userId, filters = {}) {
        // Get ALL transactions (no pagination)
        let query = this.supabase
            .from('transaction_logs')
            .select('*')
            .eq('discord_user_id', userId)
            .order('created_at', { ascending: false });

        // Apply same filters
        if (filters.type) query = query.eq('type', filters.type);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        if (filters.minAmount) query = query.gte('amount', filters.minAmount);
        if (filters.maxAmount) query = query.lte('amount', filters.maxAmount);

        const { data, error } = await query;

        if (error) throw error;

        // Build CSV
        const headers = ['ID', 'Fecha', 'Tipo', 'Monto', 'Estado', 'Descripción'];
        const rows = data.map(tx => [
            tx.id,
            new Date(tx.created_at).toLocaleString('es-MX'),
            tx.type || 'N/A',
            tx.amount,
            tx.status,
            tx.description || ''
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        return {
            content: csv,
            filename: `historial_${userId}_${new Date().toISOString().split('T')[0]}.csv`
        };
    }
}

module.exports = HistoryPaginator;

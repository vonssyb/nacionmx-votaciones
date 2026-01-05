// Enhanced /historial command handler - Fase 3, Item #9
// Add to bot/index.js or replace existing /historial handler

/*
COMANDO: /historial (Enhanced)
Ver historial de transacciones con paginación y filtros

Features:
- Paginación con botones (10 items por página)
- Filtros: tipo, estado, fecha, monto
- Export a CSV
- Session management (15 min timeout)
*/

const HistoryPaginator = require('./services/HistoryPaginator');
const historyPaginator = new HistoryPaginator(supabase);

// Command handler
else if (commandName === 'historial') {
    await interaction.deferReply({ flags: [64] });

    try {
        // Get filters from options (if any)
        const filters = {};
        const typeFilter = interaction.options.getString('tipo');
        const statusFilter = interaction.options.getString('estado');
        const minAmount = interaction.options.getInteger('monto_min');
        const maxAmount = interaction.options.getInteger('monto_max');

        if (typeFilter) filters.type = typeFilter;
        if (statusFilter) filters.status = statusFilter;
        if (minAmount) filters.minAmount = minAmount;
        if (maxAmount) filters.maxAmount = maxAmount;

        // Create session
        const sessionId = historyPaginator.createSession(interaction.user.id, filters);

        // Get first page
        const history = await historyPaginator.getHistory(interaction.user.id, 1, filters);

        // Build embed and buttons
        const embed = historyPaginator.buildHistoryEmbed(history, filters);
        const buttons = historyPaginator.buildPaginationButtons(history, sessionId);

        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });

    } catch (error) {
        console.error('Error in /historial:', error);
        await interaction.editReply('❌ Error al obtener el historial.');
    }
}

// Button interactions for pagination
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    if (customId.startsWith('hist_')) {
        const [action, type, sessionId] = customId.split('_');

        const session = historyPaginator.getSession(sessionId);
        if (!session) {
            return interaction.reply({
                content: '❌ Sesión expirada. Ejecuta `/historial` nuevamente.',
                flags: [64]
            });
        }

        // Verify user owns session
        if (session.userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Esta sesión no te pertenece.',
                flags: [64]
            });
        }

        try {
            await interaction.deferUpdate();

            if (type === 'prev') {
                // Previous page
                const newPage = Math.max(1, session.page - 1);
                historyPaginator.updateSessionPage(sessionId, newPage);

                const history = await historyPaginator.getHistory(
                    session.userId,
                    newPage,
                    session.filters
                );

                const embed = historyPaginator.buildHistoryEmbed(history, session.filters);
                const buttons = historyPaginator.buildPaginationButtons(history, sessionId);

                await interaction.editReply({
                    embeds: [embed],
                    components: [buttons]
                });

            } else if (type === 'next') {
                // Next page
                const newPage = session.page + 1;
                historyPaginator.updateSessionPage(sessionId, newPage);

                const history = await historyPaginator.getHistory(
                    session.userId,
                    newPage,
                    session.filters
                );

                const embed = historyPaginator.buildHistoryEmbed(history, session.filters);
                const buttons = historyPaginator.buildPaginationButtons(history, sessionId);

                await interaction.editReply({
                    embeds: [embed],
                    components: [buttons]
                });

            } else if (type === 'export') {
                // Export to CSV
                const csv = await historyPaginator.exportToCSV(session.userId, session.filters);

                // Send as file attachment
                const { AttachmentBuilder } = require('discord.js');
                const attachment = new AttachmentBuilder(
                    Buffer.from(csv.content),
                    { name: csv.filename }
                );

                await interaction.followUp({
                    content: '✅ Tu historial ha sido exportado:',
                    files: [attachment],
                    flags: [64]
                });

            } else if (type === 'filter') {
                // Show filter modal  (future enhancement)
                await interaction.followUp({
                    content: '🔍 Filtros: Usa las opciones del comando `/historial` para filtrar.\n\nEjemplos:\n`/historial tipo:Transfer`\n`/historial estado:SUCCESS monto_min:1000`',
                    flags: [64]
                });
            }

        } catch (error) {
            console.error('Error in history pagination:', error);
            await interaction.followUp({
                content: '❌ Error al procesar la acción.',
                flags: [64]
            });
        }
    }
});

// Registration for enhanced /historial command
new SlashCommandBuilder()
    .setName('historial')
    .setDescription('Ver tu historial de transacciones con filtros')
    .addStringOption(option =>
        option
            .setName('tipo')
            .setDescription('Filtrar por tipo de transacción')
            .setRequired(false)
            .addChoices(
                { name: 'Transfer', value: 'Transfer' },
                { name: 'Payment', value: 'Payment' },
                { name: 'Deposit', value: 'Deposit' },
                { name: 'Withdrawal', value: 'Withdrawal' }
            )
    )
    .addStringOption(option =>
        option
            .setName('estado')
            .setDescription('Filtrar por estado')
            .setRequired(false)
            .addChoices(
                { name: 'Exitosas', value: 'SUCCESS' },
                { name: 'Fallidas', value: 'FAILED' },
                { name: 'Pendientes', value: 'PENDING' }
            )
    )
    .addIntegerOption(option =>
        option
            .setName('monto_min')
            .setDescription('Monto mínimo')
            .setRequired(false)
            .setMinValue(0)
    )
    .addIntegerOption(option =>
        option
            .setName('monto_max')
            .setDescription('Monto máximo')
            .setRequired(false)
            .setMinValue(0)
    )
    .toJSON()

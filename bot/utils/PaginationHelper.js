/**
 * PaginationHelper - Utilidad para crear navegación con botones
 * 
 * Proporciona paginación consistente para listados largos
 * con botones de navegación y timeout automático.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class PaginationHelper {
    /**
     * Crea una paginación simple con botones ◀️ ▶️
     * @param {Interaction} interaction - La interacción de Discord
     * @param {Array} items - Array de items a paginar
     * @param {Object} options - Opciones de configuración
     * @param {number} options.itemsPerPage - Items por página (default: 10)
     * @param {Function} options.formatPage - Función que recibe (items, pageNum) y retorna un Embed
     * @param {number} options.timeout - Tiempo en ms antes de desactivar botones (default: 120000 = 2 min)
     */
    static async paginate(interaction, items, options = {}) {
        const {
            itemsPerPage = 10,
            formatPage,
            timeout = 120000
        } = options;

        if (!formatPage) {
            throw new Error('formatPage function is required');
        }

        const totalPages = Math.ceil(items.length / itemsPerPage);

        if (totalPages === 0) {
            return interaction.editReply('❌ No hay resultados para mostrar.');
        }

        let currentPage = 0;

        const getPageItems = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            return items.slice(start, end);
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('pagination_first')
                    .setLabel('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('pagination_prev')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('pagination_page')
                    .setLabel(`${page + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('pagination_next')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('pagination_last')
                    .setLabel('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages - 1)
            );

            return row;
        };

        const embed = formatPage(getPageItems(currentPage), currentPage, totalPages);
        const message = await interaction.editReply({
            embeds: [embed],
            components: totalPages > 1 ? [generateButtons(currentPage)] : []
        });

        if (totalPages === 1) return; // No pagination needed

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: timeout
        });

        collector.on('collect', async i => {
            if (i.customId === 'pagination_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'pagination_next') {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            } else if (i.customId === 'pagination_first') {
                currentPage = 0;
            } else if (i.customId === 'pagination_last') {
                currentPage = totalPages - 1;
            }

            const newEmbed = formatPage(getPageItems(currentPage), currentPage, totalPages);
            await i.update({
                embeds: [newEmbed],
                components: [generateButtons(currentPage)]
            });
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => { });
        });
    }

    /**
     * Ejemplo de uso:
     * 
     * const items = [ ... ]; // Array de datos
     * 
     * await PaginationHelper.paginate(interaction, items, {
     *     itemsPerPage: 5,
     *     formatPage: (pageItems, pageNum, totalPages) => {
     *         return new EmbedBuilder()
     *             .setTitle(`Mis Items (Página ${pageNum + 1}/${totalPages})`)
     *             .setDescription(pageItems.map(item => `• ${item.name}`).join('\n'));
     *     }
     * });
     */
}

module.exports = PaginationHelper;

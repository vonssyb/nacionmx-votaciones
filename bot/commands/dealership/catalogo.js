const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../../services/Logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('catalogo')
        .setDescription('📖 Muestra el catálogo de vehículos disponibles')
        .addStringOption(option =>
            option.setName('categoria')
                .setDescription('Filtrar por categoría')
                .setRequired(false)
                .addChoices(
                    { name: 'Sedán', value: 'sedan' },
                    { name: 'Deportivo', value: 'deportivo' },
                    { name: 'SUV / Camionetas', value: 'suv' },
                    { name: 'Motos', value: 'moto' },
                    { name: 'Lujo', value: 'lujo' },
                    { name: 'Trabajo / Carga', value: 'trabajo' }
                )
        ),

    async execute(interaction, client, supabase) {
        try {
            const category = interaction.options.getString('categoria');
            const page = 1;

            // Get Data from Service
            const result = await client.dealershipService.getCatalog(category, page);

            if (result.data.length === 0) {
                return interaction.reply({
                    content: '❌ No hay vehículos disponibles en esta categoría por el momento.',
                    ephemeral: true
                });
            }

            // Create Embed
            const embed = new EmbedBuilder()
                .setTitle(category ? `Catálogo: ${category.toUpperCase()}` : '🏎️ Catálogo General de Vehículos')
                .setDescription('Explora nuestra selección de vehículos premium. Usa los botones para navegar.')
                .setColor('#FFD700') // Gold color
                .setFooter({ text: `Página ${page}/${result.meta.totalPages} • Total: ${result.meta.totalItems} autos` });

            // Add fields for items
            result.data.forEach(vehicle => {
                const stockEmoji = vehicle.stock > 0 ? '✅' : '🔴';
                const financeText = vehicle.finance_available ? '💳 Financiamiento Disponible' : '💵 Solo Contado';

                embed.addFields({
                    name: `${stockEmoji} ${vehicle.make} ${vehicle.model}`,
                    value: `**Precio:** $${vehicle.price.toLocaleString()}\n**Stock:** ${vehicle.stock}\n${financeText}\nID: \`${vehicle.id}\``,
                    inline: true
                });
            });

            // Navigation Buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`cat_prev_${category || 'all'}_${page}`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('cat_noop')
                    .setLabel(`${page}/${result.meta.totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`cat_next_${category || 'all'}_${page}`)
                    .setLabel('Siguiente ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(result.meta.totalPages <= 1)
            );

            await interaction.reply({ embeds: [embed], components: [row] });

        } catch (error) {
            logger.errorWithContext('Error en comando catalogo', error, interaction);
            await interaction.reply({ content: '❌ Error al cargar el catálogo.', ephemeral: true });
        }
    }
};

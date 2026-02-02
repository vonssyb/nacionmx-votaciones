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
            await interaction.deferReply();

            // Initial parameters
            const category = interaction.options.getString('categoria') || 'all';
            const page = 1;

            // Fetch Data (Limit 1 for single vehicle display)
            const result = await client.dealershipService.getCatalog(category === 'all' ? null : category, page, 1);

            if (result.data.length === 0) {
                return interaction.editReply({
                    content: '❌ No hay vehículos disponibles en esta categoría por el momento.',
                    ephemeral: true
                });
            }

            const vehicle = result.data[0];

            // Build Embed
            const stockEmoji = vehicle.stock > 0 ? '✅' : '🔴';
            const financeText = vehicle.finance_available ? '💳 Financiamiento Disponible' : '💵 Solo Contado';

            const embed = new EmbedBuilder()
                .setTitle(`${stockEmoji} ${vehicle.make} ${vehicle.model} (${vehicle.year || 'N/A'})`)
                .setDescription(`**Categoría:** ${vehicle.category.toUpperCase()}\n**ID:** \`${vehicle.id}\`\n\n${vehicle.description || 'Vehículo de alto rendimiento disponible para entrega inmediata.'}`)
                .setColor('#FFD700')
                .addFields(
                    { name: '💰 Precio', value: `$${vehicle.price.toLocaleString()}`, inline: true },
                    { name: '🏎️ Velocidad', value: `${vehicle.specs?.max_speed || 'N/A'}`, inline: true },
                    { name: '📦 Stock', value: `${vehicle.stock} unidades`, inline: true },
                    { name: '💳 Estado', value: financeText, inline: false }
                )
                .setFooter({ text: `Vehículo ${page} de ${result.meta.totalItems} • Categoría: ${category.toUpperCase()}` }); // Removed page count from footer logic for cleaner look or keep it

            if (vehicle.image_url) {
                embed.setImage(vehicle.image_url);
            }

            // --- COMPONENTS ---

            // 1. Category Select Menu
            const categoryRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cat_select_category')
                    .setPlaceholder('📂 Cambiar Categoría')
                    .addOptions(
                        { label: 'Todo', value: 'all', description: 'Ver todos los vehículos' },
                        { label: 'Sedán', value: 'sedan', emoji: '🚗' },
                        { label: 'Deportivo', value: 'deportivo', emoji: '🏎️' },
                        { label: 'SUV / Camionetas', value: 'suv', emoji: '🚙' },
                        { label: 'Motos', value: 'moto', emoji: '🏍️' },
                        { label: 'Lujo', value: 'lujo', emoji: '💎' },
                        { label: 'Trabajo', value: 'trabajo', emoji: '🚛' }
                    )
            );

            // 2. Navigation Buttons
            const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`cat_prev_${category}_${page}`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1),
                new ButtonBuilder()
                    .setCustomId('cat_noop')
                    .setLabel(`${page} / ${result.meta.totalItems}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`cat_next_${category}_${page}`)
                    .setLabel('Siguiente ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= result.meta.totalItems) // Total pages = total items since size is 1
            );

            await interaction.editReply({ embeds: [embed], components: [categoryRow, navRow] });

        } catch (error) {
            logger.errorWithContext('Error en comando catalogo', error, interaction);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Error al cargar el catálogo.' });
            } else {
                await interaction.reply({ content: '❌ Error al cargar el catálogo.', ephemeral: true });
            }
        }
    }
};

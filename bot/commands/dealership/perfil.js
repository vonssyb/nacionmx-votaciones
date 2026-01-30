const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../services/Logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('👤 Muestra tu perfil de propietario, autos y deudas'),

    async execute(interaction, client, supabase) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // 1. Fetch User's Vehicles (Completed Sales)
            const { data: sales, error } = await supabase
                .from('dealership_sales')
                .select('*, dealership_catalog(make, model, price)')
                .eq('user_id', interaction.user.id)
                .eq('status', 'completed');

            if (error) throw error;

            // 2. Fetch Active Contracts/Financing (Pending/Financing)
            const { data: activeFinancing, error: financeError } = await supabase
                .from('dealership_sales')
                .select('*, dealership_catalog(make, model)')
                .eq('user_id', interaction.user.id)
                .eq('status', 'financing');

            if (financeError) throw financeError;

            // 3. Build Embed
            const embed = new EmbedBuilder()
                .setTitle(`🏎️ Garaje de ${interaction.user.username}`)
                .setColor('#2B2D31')
                .setThumbnail(interaction.user.displayAvatarURL());

            if ((!sales || sales.length === 0) && (!activeFinancing || activeFinancing.length === 0)) {
                embed.setDescription('No tienes vehículos registrados ni contratos activos.');
            } else {

                // Owned Vehicles Section
                if (sales && sales.length > 0) {
                    const vehicleList = sales.map(s => `• **${s.dealership_catalog.make} ${s.dealership_catalog.model}** (Pagado)`).join('\n');
                    embed.addFields({ name: '🚗 Propiedad', value: vehicleList });
                }

                // Financing Section
                if (activeFinancing && activeFinancing.length > 0) {
                    const debtList = activeFinancing.map(s => {
                        const plan = s.finance_plan || {};
                        const remaining = (plan.total_installments || 0) - (plan.paid_installments || 0);
                        return `• **${s.dealership_catalog.make} ${s.dealership_catalog.model}**\n   - Restante: ${remaining} pagos\n   - Deuda: $${((remaining * plan.amount_per_installment) || 0).toLocaleString()}`;
                    }).join('\n\n');

                    embed.addFields({ name: '📉 Financiamientos Activos', value: debtList });
                }
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.errorWithContext('Error en comando perfil', error, interaction);
            await interaction.editReply('❌ Error al cargar tu perfil.');
        }
    }
};

/**
 * @module handlers/economy/company/stats
 * @description Handles detailed company statistics display
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

/**
 * Handles company statistics button interaction
 * @param {Interaction} interaction 
 * @param {Client} client 
 * @param {SupabaseClient} supabase 
 */
async function handleCompanyStats(interaction, client, supabase) {
    try {
        const companyId = interaction.customId.split('_')[2];
        if (!companyId) return false;

        // Get company data
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();

        if (companyError || !company) {
            return interaction.reply({ content: '❌ Empresa no encontrada.', ephemeral: true });
        }

        // Get business credit card if exists
        const { data: bizCard } = await supabase
            .from('business_credit_cards')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'active')
            .single();

        const embed = new EmbedBuilder()
            .setTitle(`📊 Estadísticas - ${company.name}`)
            .setColor(0x5865F2)
            .setThumbnail(company.logo_url)
            .addFields(
                { name: '🏷️ Industria', value: company.industry_type || 'N/A', inline: true },
                { name: '📍 Ubicación', value: company.location || 'N/A', inline: true },
                { name: '🔒 Tipo', value: company.is_private ? 'Privada' : 'Pública', inline: true },
                { name: '💰 Balance', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                { name: '👥 Empleados', value: `${company.employee_count || 0}`, inline: true },
                { name: '🚗 Vehículos', value: `${company.vehicles_count || 0}`, inline: true } // Assuming vehicles_count column
            );

        if (bizCard) {
            const debt = bizCard.current_balance || 0;
            const available = bizCard.card_limit - debt;
            embed.addFields({
                name: '💳 Crédito Empresarial',
                value: `**${bizCard.card_name}**\n📊 Deuda: $${debt.toLocaleString()}\n💵 Disponible: $${available.toLocaleString()}`,
                inline: false
            });
        }

        embed.addFields(
            { name: '📅 Creada', value: `<t:${Math.floor(new Date(company.created_at).getTime() / 1000)}:R>`, inline: false }
        );

        embed.setFooter({ text: 'Sistema Empresarial Nación MX' });
        embed.setTimestamp();

        // Check if we can edit or need new reply
        if (interaction.message) {
            await interaction.update({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        return true;

    } catch (error) {
        await ErrorHandler.handle(error, interaction, { operation: 'company_stats' });
        return true;
    }
}

module.exports = { handleCompanyStats };

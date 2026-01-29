const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tarjetas')
        .setDescription('💳 Gestión de tarjetas de crédito y débito')
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('Ver información de todas tus tarjetas')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Ver tarjetas de otro usuario (solo banqueros)')
                .setRequired(false))),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('usuario') || interaction.user;

        // Si está consultando otro usuario, requiere ser banquero
        if (targetUser.id !== interaction.user.id) {
            const BANKER_ROLES = [
                '1450591546524307689', // Banqueros
                '1412882245735420006', // Junta Directiva
            ];

            const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
                interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isBanker) {
                return interaction.editReply('❌ Solo los banqueros pueden consultar tarjetas de otros usuarios.');
            }
        }

        try {
            // 1. Get User's Companies (Dynamic Ownership)
            const { data: ownedCompanies } = await supabase
                .from('companies')
                .select('id')
                .or(`owner_id.eq.${targetUser.id},owner_ids.cs.{${targetUser.id}}`); // Support both single and multi-owner fields

            const companyIds = ownedCompanies ? ownedCompanies.map(c => c.id) : [];

            // 2. Build Query for Cards (Personal OR Corporate)
            let query = supabase
                .from('credit_cards')
                .select('*, companies(name)');

            if (companyIds.length > 0) {
                // Syntax for OR with Foreign User ID OR Company ID
                // "discord_id.eq.UID,company_id.in.(CID1,CID2)"
                query = query.or(`discord_id.eq.${targetUser.id},company_id.in.(${companyIds.join(',')})`);
            } else {
                query = query.eq('discord_id', targetUser.id);
            }

            const { data: mxnCards, error: mxnError } = await query.order('created_at', { ascending: false });

            if (mxnError) throw mxnError;

            // Obtener tarjetas USD
            const { data: usdCards, error: usdError } = await supabase
                .from('credit_cards_usd')
                .select('*')
                .eq('discord_user_id', targetUser.id)
                .order('created_at', { ascending: false });

            if (usdError) throw usdError;

            const totalMxnCards = mxnCards?.length || 0;
            const totalUsdCards = usdCards?.length || 0;

            if (totalMxnCards === 0 && totalUsdCards === 0) {
                return interaction.editReply({
                    content: `📭 **Sin Tarjetas**\n\n${targetUser.id === interaction.user.id ? 'No tienes' : `${targetUser.tag} no tiene`} tarjetas registradas.\n\n💡 Para solicitar tarjetas, acude al banco con un banquero.`
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`💳 Tarjetas de ${targetUser.tag}`)
                .setColor(0x5865F2)
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: 'Sistema Bancario Nación MX' })
                .setTimestamp();

            // Tarjetas MXN
            if (totalMxnCards > 0) {
                let mxnText = '';
                let totalDeudaMxn = 0;
                let totalLimiteMxn = 0;

                mxnCards.forEach((card, index) => {
                    const deuda = card.current_balance || 0;
                    const limite = card.credit_limit || 0;
                    const disponible = limite - deuda;
                    const utilizacion = limite > 0 ? ((deuda / limite) * 100).toFixed(1) : 0;

                    totalDeudaMxn += deuda;
                    totalLimiteMxn += limite;

                    const statusEmoji = card.status === 'active' ? '🟢' : card.status === 'frozen' ? '🟡' : '🔴';
                    let typeLabel = card.card_type?.toUpperCase() || 'DESCONOCIDA';

                    if (card.companies && card.companies.name) {
                        typeLabel = `🏢 ${card.companies.name} - ${typeLabel}`;
                    }

                    mxnText += `\n**${index + 1}. ${typeLabel}** ${statusEmoji}\n`;
                    mxnText += `├ 💰 Deuda: $${deuda.toLocaleString()} MXN\n`;
                    mxnText += `├ 📊 Límite: $${limite.toLocaleString()} MXN\n`;
                    mxnText += `├ ✅ Disponible: $${disponible.toLocaleString()} MXN\n`;
                    mxnText += `└ 📈 Utilización: ${utilizacion}%\n`;
                });

                embed.addFields({
                    name: `💵 Tarjetas MXN (${totalMxnCards})`,
                    value: mxnText || 'Sin datos',
                    inline: false
                });

                embed.addFields({
                    name: '📊 Resumen MXN',
                    value: `**Deuda Total:** $${totalDeudaMxn.toLocaleString()}\n**Límite Total:** $${totalLimiteMxn.toLocaleString()}\n**Disponible Total:** $${(totalLimiteMxn - totalDeudaMxn).toLocaleString()}`,
                    inline: true
                });
            }

            // Tarjetas USD
            if (totalUsdCards > 0) {
                let usdText = '';
                let totalDeudaUsd = 0;
                let totalLimiteUsd = 0;

                usdCards.forEach((card, index) => {
                    const deuda = card.current_balance || 0;
                    const limite = card.credit_limit || 0;
                    const disponible = limite - deuda;
                    const utilizacion = limite > 0 ? ((deuda / limite) * 100).toFixed(1) : 0;

                    totalDeudaUsd += deuda;
                    totalLimiteUsd += limite;

                    const statusEmoji = card.status === 'active' ? '🟢' : card.status === 'frozen' ? '🟡' : '🔴';
                    const typeLabel = card.card_type?.toUpperCase() || 'DESCONOCIDA';

                    usdText += `\n**${index + 1}. ${typeLabel}** ${statusEmoji}\n`;
                    usdText += `├ 💰 Deuda: $${deuda.toLocaleString()} USD\n`;
                    usdText += `├ 📊 Límite: $${limite.toLocaleString()} USD\n`;
                    usdText += `├ ✅ Disponible: $${disponible.toLocaleString()} USD\n`;
                    usdText += `└ 📈 Utilización: ${utilizacion}%\n`;
                });

                embed.addFields({
                    name: `💵 Tarjetas USD (${totalUsdCards})`,
                    value: usdText || 'Sin datos',
                    inline: false
                });

                embed.addFields({
                    name: '📊 Resumen USD',
                    value: `**Deuda Total:** $${totalDeudaUsd.toLocaleString()}\n**Límite Total:** $${totalLimiteUsd.toLocaleString()}\n**Disponible Total:** $${(totalLimiteUsd - totalDeudaUsd).toLocaleString()}`,
                    inline: true
                });
            }

            // Agregar total general
            embed.setDescription(`**Total de Tarjetas:** ${totalMxnCards + totalUsdCards}\n**MXN:** ${totalMxnCards} | **USD:** ${totalUsdCards}`);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[Tarjetas Info] Error:', error);
            await interaction.editReply('❌ Error al consultar las tarjetas. Contacta a un administrador.');
        }
    }
};

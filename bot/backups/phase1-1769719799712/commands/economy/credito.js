const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { CARD_TIERS } = require('../../services/EconomyHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('credito')
        .setDescription('💳 Sistema de Tarjetas de Crédito')
        .addSubcommandGroup(group =>
            group.setName('admin')
                .setDescription('🛠️ Herramientas de Administración')
                .addSubcommand(sub =>
                    sub.setName('upgrade')
                        .setDescription('Ofrecer mejora de tarjeta a un usuario')
                        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario objetivo').setRequired(true))
                        .addStringOption(opt => opt.setName('nivel')
                            .setDescription('Nivel de tarjeta a ofrecer')
                            .setRequired(true)
                            .addChoices(
                                { name: 'NMX Start ($2k)', value: 'NMX Start' },
                                { name: 'NMX Básica ($4k)', value: 'NMX Básica' },
                                { name: 'NMX Plus ($6k)', value: 'NMX Plus' },
                                { name: 'NMX Plata ($10k)', value: 'NMX Plata' },
                                { name: 'NMX Oro ($15k)', value: 'NMX Oro' },
                                { name: 'NMX Rubí ($25k)', value: 'NMX Rubí' },
                                { name: 'NMX Black ($40k)', value: 'NMX Black' },
                                { name: 'NMX Diamante ($60k)', value: 'NMX Diamante' },
                                { name: 'NMX Zafiro ($100k)', value: 'NMX Zafiro' },
                                { name: 'NMX Platino Elite ($150k)', value: 'NMX Platino Elite' }
                            ))
                )
        ),

    async execute(interaction, client, supabase, billingService) {
        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === 'admin' && subcommand === 'upgrade') {
            // Check Admin Permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('usuario');
            const targetTier = interaction.options.getString('nivel');

            await interaction.deferReply();

            // Validate Tier
            const tierInfo = CARD_TIERS[targetTier];
            if (!tierInfo) {
                return interaction.editReply('❌ Nivel de tarjeta inválido.');
            }

            // Check if user has a credit card
            const { data: cards, error } = await supabase
                .from('credit_cards') // Assuming upgrading CREDIT CARDS
                .select('*')
                .eq('discord_user_id', targetUser.id) // Or citizen_id logic? Admin Balanza used discord_user_id check mostly
                .eq('status', 'active');

            // Find valid card to upgrade (usually the active one)
            // If they have multiple, we might need to ask which one, but usually it's one active card per user in simple systems.
            const card = cards && cards.length > 0 ? cards[0] : null;

            if (!card) {
                // Check legacy 'citizens' table link if needed, but for now assuming direct discord_id link or previous logic
                return interaction.editReply(`❌ El usuario ${targetUser.tag} no tiene una tarjeta de crédito activa para mejorar.`);
            }

            // Create Offer Embed
            const nextLimit = tierInfo.limit;
            const cost = tierInfo.cost;

            const embed = new EmbedBuilder()
                .setTitle('💳 Oferta de Mejora de Tarjeta')
                .setColor(tierInfo.color || '#FFD700')
                .setDescription(`Hola ${targetUser}, la administración te ha ofrecido mejorar tu tarjeta actual a **${targetTier}**.`)
                .addFields(
                    { name: '🏦 Nivel Actual', value: card.card_type || 'Desconocido', inline: true },
                    { name: '✨ Nuevo Nivel', value: targetTier, inline: true },
                    { name: '💰 Costo Upgrade', value: `$${cost.toLocaleString()}`, inline: true },
                    { name: '📈 Nuevo Límite', value: `$${nextLimit.toLocaleString()}`, inline: true },
                    { name: '🎁 Beneficios', value: tierInfo.benefits ? tierInfo.benefits.join('\n') : 'N/A', inline: false }
                )
                .setFooter({ text: 'Acepta abajo para procesar el pago y la mejora.' })
                .setTimestamp();

            // Create Buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`btn_upgrade_${targetUser.id}_${targetTier.replace(/ /g, '_')}`) // Matches legacy handler format
                        .setLabel(`Aceptar y Pagar $${cost.toLocaleString()}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💳'),
                    new ButtonBuilder()
                        .setCustomId(`btn_cancel_upgrade_${targetUser.id}`)
                        .setLabel('Rechazar')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.editReply({
                content: `Oferta enviada a ${targetUser}.`,
                components: []
            });

            // Send to channel tagging the user to ensure they see it
            await interaction.channel.send({
                content: `<@${targetUser.id}>`,
                embeds: [embed],
                components: [row]
            });
        }
    }
};

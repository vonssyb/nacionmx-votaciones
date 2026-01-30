const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('../../services/Logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comprar')
        .setDescription('🛒 Inicia el proceso de compra de un vehículo')
        .addStringOption(option =>
            option.setName('auto')
                .setDescription('Nombre o ID del vehículo que deseas comprar')
                .setRequired(true)
        ),

    async execute(interaction, client, supabase) {
        try {
            const vehicleName = interaction.options.getString('auto');
            await interaction.deferReply({ ephemeral: true });

            // 1. Find Vehicle
            const vehicle = await client.dealershipService.getVehicleDetails(vehicleName);

            if (!vehicle) {
                return interaction.editReply(`❌ No encontré ningún vehículo que coincida con "**${vehicleName}**". Usa \`/catalogo\` para ver opciones.`);
            }

            if (vehicle.stock <= 0) {
                return interaction.editReply(`❌ El **${vehicle.make} ${vehicle.model}** está actualmente agotado.`);
            }

            // 2. Fetch Settings for Ticket Category and Staff Role
            const { data: ticketChan } = await supabase.from('dealership_settings').select('value').eq('key', 'channel_tickets').single();
            const { data: staffRole } = await supabase.from('dealership_settings').select('value').eq('key', 'role_staff').single();

            // Default fallback if not set (using interaction guild/category for testing)
            const parentCategory = ticketChan?.value || null;
            const handlerRole = staffRole?.value || null;

            // 3. Create Ticket Channel
            const channelName = `compra-${vehicle.model.replace(/\s+/g, '-').toLowerCase()}-${interaction.user.username}`;

            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: parentCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    }
                ],
            });

            // Add Staff Role permissions if configured
            if (handlerRole && handlerRole !== "000000000000000000") {
                await ticketChannel.permissionOverwrites.edit(handlerRole, {
                    ViewChannel: true,
                    SendMessages: true
                });
            }

            // 4. Create Sale Record
            const sale = await client.dealershipService.createSaleRequest(
                interaction.user.id,
                interaction.guild.id,
                vehicle.id,
                'pending_choice' // Default until they choose method
            );

            // 5. Send Initial Message in Ticket
            const embed = new EmbedBuilder()
                .setTitle(`🏎️ Solicitud de Compra: ${vehicle.make} ${vehicle.model}`)
                .setDescription(`Hola ${interaction.user}, has iniciado el proceso de compra.\n\n**Precio:** $${vehicle.price.toLocaleString()}\n**Stock Disponible:** ${vehicle.stock}`)
                .addFields(
                    { name: '📋 Pasos Siguientes', value: '1. Selecciona tu método de pago abajo.\n2. Un vendedor revisará tu solicitud.\n3. Firmarás el contrato y recibirás las llaves.' }
                )
                .setImage(vehicle.image_url)
                .setColor('#00FF00');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`pay_cash_${sale.id}`)
                    .setLabel('💵 Pago de Contado')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`pay_finance_${sale.id}`)
                    .setLabel('🏦 Financiamiento')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!vehicle.finance_available),
                new ButtonBuilder()
                    .setCustomId(`cancel_sale_${sale.id}`)
                    .setLabel('Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `${interaction.user}`,
                embeds: [embed],
                components: [row]
            });

            await interaction.editReply(`✅ Ticket creado exitosamente: ${ticketChannel}`);

        } catch (error) {
            logger.errorWithContext('Error en comando comprar', error, interaction);
            await interaction.editReply('❌ Ocurrió un error al procesar la solicitud.');
        }
    }
};

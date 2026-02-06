const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ASESOR_ROLE = '1466558863342964800';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vender')
        .setDescription('🚗 [ASESOR] Iniciar proceso de venta de vehículo')
        .addUserOption(option =>
            option.setName('cliente')
                .setDescription('Cliente que desea comprar')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('vehiculo_id')
                .setDescription('ID del vehículo del catálogo')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        // Verificar rol de asesor
        if (!interaction.member.roles.cache.has(ASESOR_ROLE)) {
            return interaction.reply({
                content: '❌ Solo los asesores de ventas pueden usar este comando.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const cliente = interaction.options.getUser('cliente');
        const vehiculoId = interaction.options.getInteger('vehiculo_id');

        try {
            // Obtener vehículo
            const { data: vehiculo, error: vError } = await supabase
                .from('dealership_catalog')
                .select('*')
                .eq('id', vehiculoId)
                .single();

            if (vError || !vehiculo) {
                return interaction.editReply('❌ No se encontró el vehículo con ese ID.');
            }

            if (vehiculo.stock <= 0) {
                return interaction.editReply('❌ Este vehículo no tiene stock disponible.');
            }

            // Obtener tarjetas de crédito del cliente
            const { data: tarjetas } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('discord_id', cliente.id)
                .order('created_at', { ascending: false });

            // Crear embed de venta
            const embed = new EmbedBuilder()
                .setTitle(`🚗 Proceso de Venta - ${vehiculo.make} ${vehiculo.model}`)
                .setDescription(`**Cliente:** ${cliente.tag}\n**Asesor:** ${interaction.user.tag}`)
                .addFields(
                    { name: '🚙 Vehículo', value: `${vehiculo.make} ${vehiculo.model} (${vehiculo.year})`, inline: true },
                    { name: '💰 Precio', value: `$${vehiculo.price.toLocaleString()}`, inline: true },
                    { name: '⚡ Velocidad Máx.', value: `${vehiculo.speed} mph`, inline: true },
                    { name: '📊 Stock Disponible', value: `${vehiculo.stock} unidades`, inline: true }
                )
                .setColor('#FF6B35')
                .setThumbnail(vehiculo.image_url);

            // Mostrar tarjetas disponibles
            if (tarjetas && tarjetas.length > 0) {
                const tarjetasInfo = tarjetas.map((t, i) => {
                    const limit = t.card_limit || t.credit_limit || 0;
                    return `${i + 1}. **${t.card_type}** - **** **** **** ${t.card_number.slice(-4)} (Límite: $${limit.toLocaleString()})`;
                }).join('\n');
                embed.addFields({ name: '💳 Tarjetas del Cliente', value: tarjetasInfo });
            } else {
                embed.addFields({ name: '💳 Tarjetas del Cliente', value: 'Sin tarjetas registradas' });
            }

            // Calcular plan de financiamiento
            const enganche = Math.ceil(vehiculo.price * 0.20); // 20% enganche
            const montoFinanciar = vehiculo.price - enganche;
            const interes = Math.ceil(montoFinanciar * 0.05); // 5% interés
            const totalFinanciado = montoFinanciar + interes;
            const cuotaQuincenal = Math.ceil(totalFinanciado / 10); // 10 quincenas

            embed.addFields(
                { name: '\n📋 Plan de Financiamiento Disponible', value: '** **' },
                { name: '💵 Enganche (20%)', value: `$${enganche.toLocaleString()}`, inline: true },
                { name: '📈 Interés (5%)', value: `$${interes.toLocaleString()}`, inline: true },
                { name: '💳 Total Financiado', value: `$${totalFinanciado.toLocaleString()}`, inline: true },
                { name: '📅 Cuotas', value: '10 quincenales', inline: true },
                { name: '💵 Cuota Quincenal', value: `$${cuotaQuincenal.toLocaleString()}`, inline: true },
                { name: '⏰ Duración', value: '5 meses (10 quincenas)', inline: true }
            );

            // Términos y condiciones
            embed.addFields({
                name: '📜 Términos y Condiciones',
                value:
                    '• El enganche debe pagarse al momento de la compra\n' +
                    '• Las cuotas se cobran cada 15 días automáticamente\n' +
                    '• El vehículo será entregado tras pagar el enganche\n' +
                    '• Falta de pago puede resultar en embargo del vehículo\n' +
                    '• Interés del 5% sobre el monto financiado\n' +
                    '• No se permiten cancelaciones después del pago inicial'
            });

            // Botones de método de pago
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`venta_efectivo_${vehiculoId}_${cliente.id}`)
                    .setLabel('💵 Efectivo/Débito')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`venta_credito_${vehiculoId}_${cliente.id}`)
                    .setLabel('💳 Tarjeta de Crédito')
                    .setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`venta_financiamiento_${vehiculoId}_${cliente.id}`)
                    .setLabel('🏦 Financiamiento (Plan)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`venta_cancelar_${vehiculoId}_${cliente.id}`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({
                embeds: [embed],
                components: [row1, row2]
            });

        } catch (error) {
            console.error('Error en comando vender:', error);
            await interaction.editReply('❌ Error al procesar la venta.');
        }
    }
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tarjeta-usa')
        .setDescription('🇺🇸 Tarjetas Americanas (USD) - Requiere Visa Activa')
        .addSubcommand(sub => sub
            .setName('debito')
            .setDescription('Solicitar tarjeta de débito americana ($50 USD)'))
        .addSubcommand(sub => sub
            .setName('credito')
            .setDescription('Solicitar tarjeta de crédito americana (Requiere ticket USCIS)')
            .addStringOption(opt => opt
                .setName('tipo')
                .setDescription('Tipo de tarjeta de crédito')
                .setRequired(true)
                .addChoices(
                    { name: 'US Basic - $1,000 límite | $100/año', value: 'us_basic' },
                    { name: 'US Silver - $5,000 límite | $250/año', value: 'us_silver' },
                    { name: 'US Gold - $15,000 límite | $500/año', value: 'us_gold' },
                    { name: 'US Platinum - $50,000 límite | $1,000/año', value: 'us_platinum' }
                )))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tus tarjetas americanas activas'))
        .addSubcommand(sub => sub
            .setName('pagar')
            .setDescription('Pagar deuda de tarjeta americana')
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a pagar en USD')
                .setRequired(true)
                .setMinValue(1)))
        .addSubcommand(sub => sub
            .setName('cancelar')
            .setDescription('Cancelar una tarjeta americana')
            .addStringOption(opt => opt
                .setName('id')
                .setDescription('ID de la tarjeta (usa /tarjeta-usa ver)')
                .setRequired(true))),

    async execute(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const subCmd = interaction.options.getSubcommand();
        const AMERICAN_ROLE_ID = process.env.AMERICAN_ROLE_ID || '1457950212923461632';

        // Verificar que el usuario tenga visa americana activa
        const hasVisa = interaction.member.roles.cache.has(AMERICAN_ROLE_ID);

        if (!hasVisa && subCmd !== 'ver') {
            return interaction.editReply({
                content: '❌ **Visa Americana Requerida**\n\nNecesitas una visa americana activa para solicitar tarjetas USD.\nUsa `/visa ver` para verificar tu estatus.',
                flags: [64]
            });
        }

        // Ver tarjetas
        if (subCmd === 'ver') {
            const { data: cards, error } = await supabase
                .from('us_credit_cards')
                .select('*')
                .eq('user_id', interaction.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                return interaction.editReply('❌ Error al obtener tus tarjetas.');
            }

            if (!cards || cards.length === 0) {
                return interaction.editReply({
                    content: '📭 **Sin Tarjetas USD**\n\nNo tienes tarjetas americanas activas.\n\nComandos disponibles:\n• `/tarjeta-usa debito` - Débito ($50 USD)\n• `/tarjeta-usa credito` - Crédito (requiere aprobación)',
                    flags: [64]
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('💳 Tus Tarjetas Americanas (USD)')
                .setColor('#0066CC')
                .setDescription('Lista de tus tarjetas USD activas')
                .setTimestamp();

            cards.forEach(card => {
                const available = (card.credit_limit || 0) - (card.current_balance || 0);
                const statusEmoji = card.status === 'active' ? '✅' : card.status === 'pending' ? '⏳' : '❌';

                embed.addFields({
                    name: `${statusEmoji} ${card.card_type.toUpperCase()} - *****${card.card_number.slice(-4)}`,
                    value: `💰 Límite: $${(card.credit_limit || 0).toLocaleString()} USD\n` +
                        `💳 Disponible: $${available.toLocaleString()} USD\n` +
                        `💸 Deuda: $${(card.current_balance || 0).toLocaleString()} USD\n` +
                        `📅 Emitida: ${new Date(card.issued_date).toLocaleDateString()}\n` +
                        `🆔 ID: \`${card.id}\``,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        }

        // Solicitar débito
        else if (subCmd === 'debito') {
            // Verificar que no tenga ya una débito USD
            const { data: existing } = await supabase
                .from('us_credit_cards')
                .select('id')
                .eq('user_id', interaction.user.id)
                .eq('card_type', 'debit')
                .eq('status', 'active')
                .maybeSingle();

            if (existing) {
                return interaction.editReply('❌ Ya tienes una tarjeta de débito americana activa.');
            }

            // Verificar USD en efectivo
            const { data: stats } = await supabase
                .from('user_stats')
                .select('usd_cash')
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            const usdCash = stats?.usd_cash || 0;
            const cost = 50;

            if (usdCash < cost) {
                return interaction.editReply({
                    content: `❌ **Fondos Insuficientes**\n\nNecesitas $${cost} USD en efectivo para solicitar esta tarjeta.\n\nTienes: $${usdCash} USD\nFaltan: $${cost - usdCash} USD`,
                    flags: [64]
                });
            }

            // Cobrar y crear tarjeta
            await supabase
                .from('user_stats')
                .update({ usd_cash: usdCash - cost })
                .eq('user_id', interaction.user.id);

            // Generar número de tarjeta
            const cardNumber = `4${Math.random().toString().slice(2, 18)}`;

            const { error: createError } = await supabase
                .from('us_credit_cards')
                .insert({
                    user_id: interaction.user.id,
                    card_number: cardNumber,
                    card_type: 'debit',
                    credit_limit: 0,
                    current_balance: 0,
                    status: 'active',
                    monthly_interest_rate: 0
                });

            if (createError) {
                // Refund
                await supabase
                    .from('user_stats')
                    .update({ usd_cash: usdCash })
                    .eq('user_id', interaction.user.id);

                return interaction.editReply('❌ Error creando la tarjeta. Fondos reembolsados.');
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Tarjeta de Débito Americana Activada')
                .setColor('#00FF00')
                .setDescription('Tu tarjeta de débito USD ha sido emitida exitosamente')
                .addFields(
                    { name: '💳 Número', value: `\`${cardNumber}\``, inline: false },
                    { name: '💰 Costo', value: `$${cost} USD`, inline: true },
                    { name: '🏦 Tipo', value: 'Débito USD', inline: true },
                    { name: '📝 Nota', value: 'Esta tarjeta te permite usar tus USD en efectivo en comercios americanos', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        // Solicitar crédito (crea ticket)
        else if (subCmd === 'credito') {
            const cardType = interaction.options.getString('tipo');

            // Verificar que no tenga solicitud pendiente
            const { data: pending } = await supabase
                .from('us_credit_cards')
                .select('id')
                .eq('user_id', interaction.user.id)
                .eq('status', 'pending')
                .maybeSingle();

            if (pending) {
                return interaction.editReply('❌ Ya tienes una solicitud de tarjeta pendiente de aprobación.');
            }

            // Crear tarjeta pendiente (requiere aprobación)
            const cardNumber = `5${Math.random().toString().slice(2, 18)}`;
            const limits = {
                us_basic: 1000,
                us_silver: 5000,
                us_gold: 15000,
                us_platinum: 50000
            };

            const { data: newCard, error: createError } = await supabase
                .from('us_credit_cards')
                .insert({
                    user_id: interaction.user.id,
                    card_number: cardNumber,
                    card_type: cardType,
                    credit_limit: limits[cardType],
                    current_balance: 0,
                    status: 'pending',
                    monthly_interest_rate: cardType === 'us_platinum' ? 2.5 : cardType === 'us_gold' ? 3.0 : cardType === 'us_silver' ? 3.5 : 4.0
                })
                .select()
                .maybeSingle();

            if (createError) {
                return interaction.editReply('❌ Error creando la solicitud.');
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Solicitud de Tarjeta Americana Enviada')
                .setColor('#FFA500')
                .setDescription('Tu solicitud ha sido enviada a USCIS para revisión')
                .addFields(
                    { name: '💳 Tipo', value: cardType.toUpperCase().replace('_', ' '), inline: true },
                    { name: '💰 Límite Solicitado', value: `$${limits[cardType].toLocaleString()} USD`, inline: true },
                    { name: '⏳ Estado', value: 'Pendiente de aprobación USCIS', inline: false },
                    { name: '📝 Próximos pasos', value: 'El staff de USCIS revisará tu visa y historial crediticio. Recibirás una notificación en 24-48h.', inline: false }
                )
                .setFooter({ text: `ID Solicitud: ${newCard.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // TODO: Crear ticket automático para USCIS
        }

        // Pagar deuda
        else if (subCmd === 'pagar') {
            const amount = interaction.options.getInteger('monto');

            // Get user USD cash
            const { data: stats } = await supabase
                .from('user_stats')
                .select('usd_cash')
                .eq('user_id', interaction.user.id)
                .maybeSingle();

            const usdCash = stats?.usd_cash || 0;

            if (usdCash < amount) {
                return interaction.editReply({
                    content: `❌ **Fondos Insuficientes**\n\nNo tienes suficiente USD en efectivo.\n\nDisponible: $${usdCash} USD\nNecesitas: $${amount} USD`,
                    flags: [64]
                });
            }

            // Get active US credit cards with debt
            const { data: cards } = await supabase
                .from('us_credit_cards')
                .select('*')
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .gt('current_balance', 0);

            if (!cards || cards.length === 0) {
                return interaction.editReply('❌ No tienes deudas en tarjetas americanas.');
            }

            // Apply payment to first card with debt
            const card = cards[0];
            const paymentAmount = Math.min(amount, card.current_balance);

            await supabase
                .from('us_credit_cards')
                .update({ current_balance: card.current_balance - paymentAmount })
                .eq('id', card.id);

            await supabase
                .from('user_stats')
                .update({ usd_cash: usdCash - paymentAmount })
                .eq('user_id', interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('✅ Pago Procesado')
                .setColor('#00FF00')
                .setDescription(`Pago aplicado a tu tarjeta ${card.card_type.toUpperCase()}`)
                .addFields(
                    { name: '💰 Monto Pagado', value: `$${paymentAmount.toLocaleString()} USD`, inline: true },
                    { name: '💳 Tarjeta', value: `*****${card.card_number.slice(-4)}`, inline: true },
                    { name: '📊 Nueva Deuda', value: `$${(card.current_balance - paymentAmount).toLocaleString()} USD`, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

        // Cancelar
        else if (subCmd === 'cancelar') {
            const cardId = interaction.options.getString('id');

            const { data: card } = await supabase
                .from('us_credit_cards')
                .select('*')
                .eq('id', cardId)
                .eq('user_id', interaction.user.id)
                .eq('status', 'active')
                .maybeSingle();

            if (!card) {
                return interaction.editReply('❌ Tarjeta no encontrada o ya cancelada.');
            }

            if (card.current_balance > 0) {
                return interaction.editReply(`❌ Debes pagar tu deuda de $${card.current_balance.toLocaleString()} USD antes de cancelar esta tarjeta.`);
            }

            await supabase
                .from('us_credit_cards')
                .update({ status: 'cancelled' })
                .eq('id', cardId);

            await interaction.editReply({
                content: `✅ Tarjeta ${card.card_type.toUpperCase()} cancelada exitosamente.\n\nNúmero: *****${card.card_number.slice(-4)}`,
                flags: [64]
            });
        }
    }
};

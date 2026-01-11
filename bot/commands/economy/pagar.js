const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config/erlcEconomyEmergency');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pagar')
        .setDescription('💰 Transferir dinero en efectivo a otro ciudadano')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('👤 Usuario al que deseas pagar')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('monto')
                .setDescription('💵 Cantidad a transferir')
                .setRequired(true)
                .setMinValue(config.TRANSACTION_LIMITS.MIN_AMOUNT)
                .setMaxValue(config.TRANSACTION_LIMITS.MAX_AMOUNT))
        .addStringOption(option =>
            option.setName('concepto')
                .setDescription('📝 Motivo del pago')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        const targetUser = interaction.options.getUser('usuario');
        const amount = interaction.options.getInteger('monto');
        const concept = interaction.options.getString('concepto');
        const sender = interaction.user;

        if (targetUser.id === sender.id) {
            return interaction.reply({ content: '❌ No puedes pagarte a ti mismo.', ephemeral: true });
        }

        try {
            // Check if both have DNI/Citizens record
            const { data: senderCitizen } = await supabase
                .from('citizens')
                .select('roblox_username')
                .eq('discord_id', sender.id)
                .maybeSingle();

            const { data: targetCitizen } = await supabase
                .from('citizens')
                .select('roblox_username')
                .eq('discord_id', targetUser.id)
                .maybeSingle();

            if (!senderCitizen) {
                return interaction.reply({ content: '❌ No tienes un DNI registrado. Usa `/dni` para empezar.', ephemeral: true });
            }

            if (!targetCitizen) {
                return interaction.reply({ content: '❌ El destinatario no tiene un DNI registrado.', ephemeral: true });
            }

            // Check sender balance
            const billingService = client.services.billing;
            if (!billingService) {
                return interaction.reply({ content: '❌ El servicio de economía no está disponible.', ephemeral: true });
            }

            const senderBalance = await billingService.ubService.getUserBalance(interaction.guild.id, sender.id);
            if ((senderBalance.cash || 0) < amount) {
                return interaction.reply({
                    content: `❌ Fondos insuficientes. Tienes: $${(senderBalance.cash || 0).toLocaleString()}, necesitas: $${amount.toLocaleString()}`,
                    ephemeral: true
                });
            }

            // Execute transaction
            await billingService.ubService.removeMoney(interaction.guild.id, sender.id, amount, `[Pago /pagar] ${concept}`, 'cash');
            await billingService.ubService.addMoney(interaction.guild.id, targetUser.id, amount, `[Pago /pagar] de ${sender.tag}`, 'cash');

            // Log to DB
            await supabase.from('erlc_transactions').insert({
                transaction_type: 'payment',
                sender_roblox: senderCitizen.roblox_username || sender.username,
                sender_discord_id: sender.id,
                receiver_roblox: targetCitizen.roblox_username || targetUser.username,
                receiver_discord_id: targetUser.id,
                amount: amount,
                concept: concept
            });

            // Confirmations
            const embedSender = new EmbedBuilder()
                .setTitle('✅ Transacción Exitosa')
                .setColor('#00FF00')
                .setDescription(`Has pagado **$${amount.toLocaleString()}** a <@${targetUser.id}>.`)
                .addFields(
                    { name: '📝 Concepto', value: concept },
                    { name: '💰 Saldo Restante', value: `$${((senderBalance.cash || 0) - amount).toLocaleString()}` }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embedSender], ephemeral: true });

            // Notify Target
            try {
                const embedTarget = new EmbedBuilder()
                    .setTitle('💰 Pago Recibido')
                    .setColor('#FFD700')
                    .setDescription(`<@${sender.id}> te ha transferido **$${amount.toLocaleString()}**.`)
                    .addFields({ name: '📝 Concepto', value: concept })
                    .setTimestamp();

                await targetUser.send({ embeds: [embedTarget] }).catch(() => {
                    // Fallback to channel if DM blocked
                    const logChannel = interaction.guild.channels.cache.get(config.CHANNELS.STAFF_LOGS);
                    if (logChannel) logChannel.send(`💰 <@${targetUser.id}> has recibido $${amount.toLocaleString()} de <@${sender.id}> (Concepto: ${concept})`);
                });
            } catch (e) { }

            console.log(`[Slash Command] 💵 Payment: ${sender.tag} → ${targetUser.tag} ($${amount})`);

        } catch (error) {
            console.error('[Slash Command] /pagar Error:', error);
            await interaction.reply({
                content: '❌ Error procesando el pago. Por favor, intenta de nuevo.',
                ephemeral: true
            });
        }
    }
};

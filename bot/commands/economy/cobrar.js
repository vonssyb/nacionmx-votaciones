const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/erlcEconomyEmergency');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('💳 Solicitar un pago a otro ciudadano')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('👤 Usuario al que deseas cobrar')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('monto')
                .setDescription('💵 Cantidad a cobrar')
                .setRequired(true)
                .setMinValue(config.TRANSACTION_LIMITS.MIN_AMOUNT)
                .setMaxValue(config.TRANSACTION_LIMITS.MAX_AMOUNT))
        .addStringOption(option =>
            option.setName('concepto')
                .setDescription('📝 Motivo del cobro')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        const targetUser = interaction.options.getUser('usuario');
        const amount = interaction.options.getInteger('monto');
        const concept = interaction.options.getString('concepto');
        const requester = interaction.user;

        if (targetUser.id === requester.id) {
            return interaction.reply({ content: '❌ No puedes cobrarte a ti mismo.', ephemeral: true });
        }

        try {
            // Check if both have DNI/Citizens record
            const { data: requesterCitizen } = await supabase
                .from('citizens')
                .select('roblox_username')
                .eq('discord_id', requester.id)
                .maybeSingle();

            const { data: targetCitizen } = await supabase
                .from('citizens')
                .select('roblox_username')
                .eq('discord_id', targetUser.id)
                .maybeSingle();

            if (!requesterCitizen) {
                return interaction.reply({ content: '❌ No tienes un DNI registrado. Usa `/dni` para empezar.', ephemeral: true });
            }

            if (!targetCitizen) {
                return interaction.reply({ content: '❌ El usuario al que intentas cobrar no tiene un DNI registrado.', ephemeral: true });
            }

            // Create payment request in DB
            const { data: request, error } = await supabase
                .from('payment_requests')
                .insert({
                    requester_roblox: requesterCitizen.roblox_username || requester.username,
                    requester_discord_id: requester.id,
                    debtor_roblox: targetCitizen.roblox_username || targetUser.username,
                    debtor_discord_id: targetUser.id,
                    amount: amount,
                    concept: concept,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Create embed with buttons
            const channel = await interaction.guild.channels.fetch(config.CHANNELS.PAYMENT_REQUESTS);
            if (!channel) {
                return interaction.reply({ content: '❌ El canal de transacciones no está disponible.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('💰 Solicitud de Cobro')
                .setColor('#FFD700')
                .setDescription(`**${requester.username}** está cobrando a **${targetUser.username}**`)
                .addFields(
                    { name: '💵 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📝 Concepto', value: concept, inline: true },
                    { name: '⏰ Expira', value: '<t:' + Math.floor((Date.now() + config.PAYMENT_REQUEST.TIMEOUT_MS) / 1000) + ':R>', inline: true }
                )
                .setFooter({ text: `ID: ${request.id} | <@${targetUser.id}>, tienes 5 minutos para responder` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`payment_accept_${request.id}`)
                    .setLabel(`✅ Aceptar Pago ($${amount.toLocaleString()})`)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`payment_reject_${request.id}`)
                    .setLabel('❌ Rechazar')
                    .setStyle(ButtonStyle.Danger)
            );

            const message = await channel.send({
                content: `<@${targetUser.id}> tienes una solicitud de cobro de <@${requester.id}>`,
                embeds: [embed],
                components: [row]
            });

            // Update DB with message ID
            await supabase
                .from('payment_requests')
                .update({ message_id: message.id, channel_id: channel.id })
                .eq('id', request.id);

            await interaction.reply({
                content: `✅ Solicitud de cobro enviada a <@${targetUser.id}> por **$${amount.toLocaleString()}**.\nSe ha enviado una notificación en <#${channel.id}>.`,
                ephemeral: true
            });

            console.log(`[Slash Command] 💳 Charge request ${request.id}: ${requester.tag} → ${targetUser.tag} ($${amount})`);

        } catch (error) {
            console.error('[Slash Command] /cobrar Error:', error);
            await interaction.reply({
                content: '❌ Error creando la solicitud de cobro. Por favor, intenta de nuevo.',
                ephemeral: true
            });
        }
    }
};

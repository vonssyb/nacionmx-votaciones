const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fianza')
        .setDescription('💰 Sistema de Fianza para Arrestos')
        .addSubcommand(subcommand =>
            subcommand
                .setName('calcular')
                .setDescription('Calcular el costo de tu fianza actual'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pagar')
                .setDescription('Pagar tu fianza para salir del arresto')),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ flags: [64] }); // Ephemeral

        const subcommand = interaction.options.getSubcommand();
        const ARRESTED_ROLE_ID = '1413540729623679056';

        try {
            // Check if user is arrested
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isArrested = member.roles.cache.has(ARRESTED_ROLE_ID);

            if (!isArrested) {
                return interaction.editReply('✅ No estás

 arrestado actualmente.');
            }

            // Get active arrest
            const { data: arrest, error: arrestError } = await supabase
                .from('arrests')
                .select('*')
                .eq('user_id', interaction.user.id)
                .gte('release_time', new Date().toISOString())
                .is('bail_paid', null) // Not paid yet
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (arrestError || !arrest) {
                return interaction.editReply('❌ No se encontró un arresto activo.');
            }

            if (subcommand === 'calcular') {
                // CALCULATE BAIL
                if (!arrest.bail_allowed) {
                    return interaction.editReply(
                        '🚫 **Fianza DENEGADA**\n\n' +
                        'Tu arresto es por delitos graves que no permiten fianza.\n' +
                        'Debes cumplir tu tiempo completo.'
                    );
                }

                // Calculate bail: fine_amount * 2
                const bailAmount = arrest.fine_amount * 2;

                const embed = new EmbedBuilder()
                    .setTitle('💰 Cálculo de Fianza')
                    .setColor('#F1C40F')
                    .setDescription('Puedes pagar una fianza para salir antes de tu tiempo de arresto.')
                    .addFields(
                        { name: '📜 Artículos', value: arrest.reason || arrest.articles, inline: false },
                        { name: '⏰ Tiempo Restante', value: `${Math.round((new Date(arrest.release_time) - new Date()) / 60000)} minutos`, inline: true },
                        { name: '💰 Multa Original', value: `$${arrest.fine_amount.toLocaleString()}`, inline: true },
                        { name: '💵 **Costo de Fianza**', value: `**$${bailAmount.toLocaleString()}**`, inline: false },
                        { name: '⚖️ Nota', value: 'Al pagar la fianza, saldrás inmediatamente pero la multa ya fue cobrada.', inline: false }
                    )
                    .setFooter({ text: 'Usa /fianza pagar para procesar el pago' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'pagar') {
                // PAY BAIL
                if (!arrest.bail_allowed) {
                    return interaction.editReply('🚫 Tu arresto no permite fianza.');
                }

                const bailAmount = arrest.fine_amount * 2;

                // Deduct money
                const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                const ubToken = process.env.UNBELIEVABOAT_TOKEN;

                if (!ubToken) {
                    return interaction.editReply('❌ Sistema de pagos no disponible.');
                }

                const ubService = new UnbelievaBoatService(ubToken);

                try {
                    // Try to remove money
                    await ubService.removeMoney(
                        interaction.guildId,
                        interaction.user.id,
                        bailAmount,
                        `Fianza pagada - Arresto: ${arrest.articles}`
                    );
                } catch (ubError) {
                    return interaction.editReply(
                        `❌ **Fondos Insuficientes**\n\n` +
                        `Necesitas **$${bailAmount.toLocaleString()}** para pagar la fianza.\n` +
                        `💡 Puedes pedirle a alguien que te transfiera el dinero.`
                    );
                }

                // Remove arrested role
                await member.roles.remove(ARRESTED_ROLE_ID);

                // Update arrest record
                await supabase
                    .from('arrests')
                    .update({
                        bail_paid: true,
                        bail_paid_at: new Date().toISOString(),
                        bail_amount: bailAmount
                    })
                    .eq('id', arrest.id);

                // Success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Fianza Pagada - LIBERADO')
                    .setColor('#2ECC71')
                    .setDescription('Has pagado tu fianza y has sido liberado del arresto.')
                    .addFields(
                        { name: '💵 Monto Pagado', value: `$${bailAmount.toLocaleString()}`, inline: true },
                        { name: '📜 Artículos', value: arrest.reason || arrest.articles, inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

                // Log to audit
                await client.logAudit(
                    'Fianza Pagada',
                    `Usuario: <@${interaction.user.id}>\nMonto: $${bailAmount.toLocaleString()}\nArtículos: ${arrest.articles}`,
                    interaction.user,
                    interaction.user,
                    0x2ECC71
                );

                // Send DM
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('✅ Fianza Procesada')
                        .setColor('#2ECC71')
                        .setDescription(`Has sido liberado del arresto tras pagar la fianza de **$${bailAmount.toLocaleString()}**.`)
                        .setFooter({ text: 'Ya puedes hacer roleplay normalmente' })
                        .setTimestamp();
                    await interaction.user.send({ embeds: [dmEmbed] });
                } catch (e) { }
            }

        } catch (error) {
            console.error('[fianza] Error:', error);
            await interaction.editReply('❌ Error al procesar la acción. Contacta a un administrador.');
        }
    }
};

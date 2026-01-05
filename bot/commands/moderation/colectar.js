const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('colectar')
        .setDescription('💰 Colectar tu salario semanal (cada 72 horas)'),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: false });

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
            // 1. Check DNI requirement
            const { data: dni, error: dniError } = await supabase
                .from('citizen_dni')
                .select('id')
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .maybeSingle();

            if (!dni) {
                return interaction.editReply({
                    content: '❌ **DNI Requerido**\n\nNecesitas un DNI válido para colectar salario.\nCrea uno usando `/dni crear`.',
                    ephemeral: true
                });
            }

            // 2. Check cooldown (72 hours)
            const { data: lastCollection } = await supabase
                .from('salary_collections')
                .select('collected_at')
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .order('collected_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastCollection) {
                const lastCollectedAt = moment(lastCollection.collected_at);
                const nextAvailable = lastCollectedAt.add(72, 'hours');
                const now = moment();

                if (now.isBefore(nextAvailable)) {
                    const timeLeft = moment.duration(nextAvailable.diff(now));
                    const hoursLeft = Math.floor(timeLeft.asHours());
                    const minutesLeft = timeLeft.minutes();

                    return interaction.editReply({
                        content: `⏰ **Cooldown Activo**\n\nYa colectaste tu salario recientemente.\n\n**Próxima colecta disponible:**\n🕐 En ${hoursLeft}h ${minutesLeft}m\n📅 ${nextAvailable.format('DD/MM/YYYY HH:mm')}`,
                        ephemeral: true
                    });
                }
            }

            // 3. Get user roles and find highest salary
            const member = await interaction.guild.members.fetch(userId);
            const userRoleIds = member.roles.cache.map(r => r.id);

            const { data: salaries } = await supabase
                .from('job_salaries')
                .select('*')
                .eq('guild_id', guildId)
                .in('role_id', userRoleIds);

            if (!salaries || salaries.length === 0) {
                return interaction.editReply({
                    content: '❌ **Sin Rol de Trabajo**\n\nNo tienes ningún rol con salario asignado.\nContacta a un administrador si crees que esto es un error.',
                    ephemeral: true
                });
            }

            // Get highest salary
            const highestSalary = salaries.reduce((max, current) =>
                current.salary_amount > max.salary_amount ? current : max
            );

            const grossAmount = highestSalary.salary_amount;
            const taxRate = 0.14; // 14% tax
            const taxAmount = Math.floor(grossAmount * taxRate);
            const netAmount = grossAmount - taxAmount;

            // 4. Deposit to bank using UnbelievaBoat
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubToken = process.env.UNBELIEVABOAT_TOKEN;

            if (!ubToken) {
                console.error('[colectar] UNBELIEVABOAT_TOKEN not configured');
                return interaction.editReply('❌ Error de configuración del bot.');
            }

            const ubService = new UnbelievaBoatService(ubToken);

            try {
                await ubService.addMoney(guildId, userId, netAmount, 0); // Add to cash only
                console.log(`[colectar] Deposited $${netAmount} to cash for ${interaction.user.tag}`);
            } catch (ubError) {
                console.error('[colectar] UnbelievaBoat error:', ubError);
                return interaction.editReply('❌ Error al depositar el salario. Intenta más tarde.');
            }

            // 5. Record collection
            const { error: insertError } = await supabase
                .from('salary_collections')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    collected_at: new Date().toISOString(),
                    role_used: highestSalary.role_name,
                    gross_amount: grossAmount,
                    tax_amount: taxAmount,
                    net_amount: netAmount
                });

            if (insertError) {
                console.error('[colectar] Error recording collection:', insertError);
            }

            // 6. Get new balance
            const balance = await ubService.getUserBalance(guildId, userId);
            const newCashBalance = balance.cash || 0;

            // 7. Send success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('💰 SALARIO COLECTADO')
                .setColor('#00FF00')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Ciudadano', value: `<@${userId}>`, inline: false },
                    { name: '🏷️ Rol', value: highestSalary.role_name, inline: false },
                    { name: '💵 Salario Bruto', value: `$${grossAmount.toLocaleString()}`, inline: true },
                    { name: '📉 Impuesto (14%)', value: `-$${taxAmount.toLocaleString()}`, inline: true },
                    { name: '💚 Neto Depositado', value: `**$${netAmount.toLocaleString()}**`, inline: true },
                    { name: '💵 Nuevo Balance en Efectivo', value: `$${newCashBalance.toLocaleString()}`, inline: false },
                    { name: '⏰ Próxima Colecta', value: moment().add(72, 'hours').format('DD/MM/YYYY HH:mm'), inline: false }
                )
                .setFooter({ text: 'Nación MX | Sistema de Nómina' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // 8. Log to audit (optional)
            const AuditService = require('../../services/AuditService');
            const auditService = new AuditService(supabase, client);

            await auditService.logTransaction({
                guildId,
                userId,
                transactionType: 'salary_collection',
                amount: netAmount,
                currencyType: 'cash',
                reason: `Salario colectado: ${highestSalary.role_name}`,
                metadata: {
                    role: highestSalary.role_name,
                    gross: grossAmount,
                    tax: taxAmount,
                    net: netAmount
                },
                createdBy: userId,
                createdByTag: interaction.user.tag,
                commandName: 'colectar',
                interactionId: interaction.id,
                canRollback: false
            });

        } catch (error) {
            console.error('[colectar] Error:', error);
            await interaction.editReply('❌ Error al procesar tu salario. Contacta a un administrador.');
        }
    }
};

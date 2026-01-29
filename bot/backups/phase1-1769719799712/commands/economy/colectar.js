const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('colectar')
        .setDescription('💰 Colectar tu salario (cada 3 días/72 horas)'),

    async execute(interaction, client, supabase) {
        // await interaction.deferReply({}); // Show "pensando..."

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
                    flags: [64]
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
                // 3 days = 72 hours
                const nextAvailable = lastCollectedAt.add(72, 'hours');
                const now = moment();

                if (now.isBefore(nextAvailable)) {
                    const unixTime = Math.floor(nextAvailable.valueOf() / 1000);

                    return interaction.editReply({
                        content: `⏰ **Cooldown Activo**\n\nYa colectaste tu salario semanal recientemente.\n\n**Próxima colecta disponible:**\n⏳ <t:${unixTime}:R>\n📅 <t:${unixTime}:F>`,
                        flags: [64]
                    });
                }
            }

            // 3. Get user roles and find highest salary
            const member = await interaction.guild.members.fetch(userId);
            const userRoleIds = member.roles.cache.map(r => r.id);

            console.log('[colectar] User roles:', userRoleIds);
            console.log('[colectar] Guild ID:', guildId);

            const { data: salaries, error: salaryError } = await supabase
                .from('job_salaries')
                .select('*')
                .eq('guild_id', guildId)
                .in('role_id', userRoleIds);

            console.log('[colectar] Salaries query result:', salaries);
            console.log('[colectar] Salaries error:', salaryError);

            if (!salaries || salaries.length === 0) {
                return interaction.editReply({
                    content: '❌ **Sin Rol de Trabajo**\n\nNo tienes ningún rol con salario asignado.\nContacta a un administrador si crees que esto es un error.',
                    flags: [64]
                });
            }

            // NEW LOGIC: Sum ALL applicable salaries
            let grossAmount = 0;
            const roleNames = [];

            salaries.forEach(job => {
                grossAmount += job.salary_amount;
                roleNames.push(job.role_name);
            });

            const rolesString = roleNames.join(' + ');

            // Calculate total salary
            const totalSalary = salaries.reduce((sum, s) => sum + (s.salary_amount || 0), 0); // Changed from s.amount to s.salary_amount

            // Detect Premium Roles for bonuses
            const PREMIUM_ROLE_ID = '1412887172503175270';
            const BOOSTER_ROLE_ID = '1423520675158691972';
            const ULTRAPASS_ROLE_ID = '1414033620636532849';
            const EVASOR_FISCAL_ROLE_ID = '1449950636371214397';

            const isPremium = interaction.member.roles.cache.has(PREMIUM_ROLE_ID);
            const isBooster = interaction.member.roles.cache.has(BOOSTER_ROLE_ID);
            const isUltraPass = interaction.member.roles.cache.has(ULTRAPASS_ROLE_ID);
            const hasEvasorRole = interaction.member.roles.cache.has(EVASOR_FISCAL_ROLE_ID);

            // Apply +10% bonus for Premium/Booster/UltraPass
            let bonusMultiplier = 1.0;
            let bonusLabel = '';
            if (isUltraPass) {
                bonusMultiplier = 1.10;
                bonusLabel = '👑 UltraPass +10%';
            } else if (isPremium) {
                bonusMultiplier = 1.10;
                bonusLabel = '⭐ Premium +10%';
            } else if (isBooster) {
                bonusMultiplier = 1.10;
                bonusLabel = '🚀 Booster +10%';
            }

            const grossSalary = Math.floor(totalSalary * bonusMultiplier);

            // Tax rates based on role
            let taxRate = 0.08; // Default 8%
            if (isUltraPass || hasEvasorRole) {
                taxRate = 0.04; // UltraPass or Evasor: 4%
            } else if (isPremium || isBooster) {
                taxRate = 0.06; // Premium/Booster: 6%
            }

            const taxAmount = Math.floor(grossSalary * taxRate);
            const netAmount = grossSalary - taxAmount;

            // 4. Credit using UnbelievaBoat
            if (!process.env.UNBELIEVABOAT_TOKEN) {
                console.error('[colectar] UNBELIEVABOAT_TOKEN not configured');
                return interaction.editReply('❌ Error: Token de UnbelievaBoat no configurado.');
            }

            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

            try {
                await ubService.addMoney(interaction.guildId, interaction.user.id, netAmount, `Salario Colectado`, 'cash');
                console.log(`[colectar] Deposited $${netAmount} to cash for ${interaction.user.tag}`);
            } catch (ubError) {
                console.error('[colectar] UnbelievaBoat error:', ubError);
                console.error('[colectar] UB Error details:', ubError.response?.data || ubError.message);
                return interaction.editReply('❌ Error al depositar el dinero. Intenta de nuevo.');
            }

            // Update last collection
            await supabase
                .from('citizen_dni')
                .update({ last_salary_collection: new Date().toISOString() })
                .eq('guild_id', guildId)
                .eq('user_id', interaction.user.id);

            // Record transaction history
            const { error: historyError } = await supabase.from('money_history').insert({
                guild_id: guildId,
                user_id: interaction.user.id,
                amount: netAmount,
                transaction_type: 'salary_collection',
                description: `Salario colectado via /colectar`,
                currency: 'cash'
                // timestamp usually handled by created_at default
            });

            if (historyError) {
                console.error('[colectar] Error recording collection:', historyError);
            }

            // 5. Record collection (original table)
            const { error: insertError } = await supabase
                .from('salary_collections')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    collected_at: new Date().toISOString(),
                    role_used: rolesString,
                    gross_amount: grossSalary, // Use grossSalary from new logic
                    tax_amount: taxAmount,
                    net_amount: netAmount
                });

            if (insertError) {
                console.error('[colectar] Error recording collection:', insertError);
            }

            // 6. Get new balance
            const balance = await ubService.getUserBalance(guildId, userId);
            const newCashBalance = balance.cash || 0;

            // 8. Build detailed breakdown string
            let salaryBreakdown = salaries.map(job => `• **${job.role_name}**: $${job.salary_amount.toLocaleString()}`).join('\n');

            if (bonusLabel) {
                salaryBreakdown += `\n\n**Bonos:**\n• ${bonusLabel} (+$${(grossSalary - totalSalary).toLocaleString()})`;
            }

            salaryBreakdown += `\n\n**Deducciones:**\n• Impuestos (${(taxRate * 100).toFixed(0)}%): -$${taxAmount.toLocaleString()}`;

            // 7. Send success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('💰 SALARIO COLECTADO')
                .setColor('#00FF00')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`Has colectado tu salario de **${roleNames.length}** rol(es).`) // Add description context
                .addFields(
                    { name: '📜 Desglose', value: salaryBreakdown, inline: false },
                    { name: '💵 Total Neto Depositado', value: `**$${netAmount.toLocaleString()}**`, inline: false },
                    { name: '💰 Nuevo Balance', value: `$${newCashBalance.toLocaleString()}`, inline: true },
                    { name: '⏰ Próxima Colecta', value: `<t:${Math.floor(moment().add(72, 'hours').valueOf() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: 'Nación MX | Sistema de Nómina (Multiempleo) v2' })
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
                reason: `Salario colectado: ${rolesString}`,
                metadata: {
                    roles: rolesString,
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
            await interaction.editReply(`❌ Error al procesar tu salario. Contacta a un administrador.\n\`\`\`${error.message}\`\`\``);
        }
    }
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getAvailablePaymentMethods, createPaymentButtons, createPaymentEmbed, processPayment } = require('../utils/economyUtils');

const handleEconomyButtons = async (interaction, client, supabase, billingService) => {

    // ============================================================
    // BUTTON: Pay Company Invoice (Initial Click)
    // ============================================================
    if (interaction.isButton() && interaction.customId.startsWith('btn_pay_company_')) {
        await interaction.deferReply({ ephemeral: true });

        const parts = interaction.customId.split('_');
        const companyId = parts[3];
        const amount = parseFloat(parts[4]);

        try {
            const pm = await getAvailablePaymentMethods(supabase, interaction.user.id, interaction.guildId);
            // Prefix: pay_comp_final_{ID}_{AMT}
            const pb = createPaymentButtons(pm, `pay_comp_final_${companyId}_${amount}`);

            await interaction.editReply({
                content: `💳 **Selecciona método de pago para abonar $${amount.toLocaleString()}**`,
                components: [pb],
                ephemeral: true
            });
        } catch (error) {
            console.error('[pay_company_init]', error);
            await interaction.editReply({ content: '❌ Error iniciando pago.', ephemeral: true });
        }
        return;
    }

    // ============================================================
    // BUTTON: Pay Company Invoice (Final Confirmation)
    // ============================================================
    if (interaction.isButton() && interaction.customId.startsWith('pay_comp_final_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        // ID: pay_comp_final_COMPANYID_AMOUNT_METHOD
        // 0:pay, 1:comp, 2:final, 3:compId, 4:amount, 5:method

        const companyId = parts[3];
        const amount = parseFloat(parts[4]);
        const paymentMethod = parts[5];

        try {
            // Re-fetch to be safe or pass PM? usually re-fetch for validation
            const pm = await getAvailablePaymentMethods(supabase, interaction.user.id, interaction.guildId);
            const result = await processPayment(billingService, supabase, paymentMethod, interaction.user.id, interaction.guildId, amount, `Pago a empresa`, pm);

            if (!result.success) {
                return interaction.editReply({ content: result.error, components: [] });
            }

            // Add funds to company
            const { data: company } = await supabase.from('companies').select('balance, name').eq('id', companyId).single();
            if (company) {
                await supabase.from('companies').update({ balance: (company.balance || 0) + amount }).eq('id', companyId);

                // Log transaction
                await supabase.from('company_transactions').insert({
                    company_id: companyId,
                    type: 'income',
                    amount: amount,
                    description: `Pago de cliente (Discord: ${interaction.user.id})`,
                    created_by: interaction.user.id
                });
            }

            // Update original invoice message
            try {
                const originalMessage = interaction.message;
                if (originalMessage && originalMessage.embeds[0]) {
                    const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
                        .setColor('#2ecc71') // Green for paid
                        .spliceFields(3, 1, { name: '✅ Estado', value: `PAGADO por <@${interaction.user.id}>`, inline: false });

                    await originalMessage.edit({
                        embeds: [updatedEmbed],
                        components: [] // Disable buttons
                    });
                }
            } catch (updateErr) {
                console.error('[pay_comp] Failed to update invoice:', updateErr);
            }

            // Notify employee who issued invoice (find employee_id from message metadata or interaction)
            try {
                // Get the employee who created the invoice from the original interaction
                // Since we don't have employee ID in button, we'll try to extract from embed description
                const employeeMatch = interaction.message?.embeds[0]?.description?.match(/<@(\d+)>/);
                if (employeeMatch) {
                    const employeeId = employeeMatch[1];
                    const employee = await interaction.guild.members.fetch(employeeId).catch(() => null);
                    if (employee) {
                        await employee.send(`💰 **Pago Recibido - ${company?.name}**\n\n<@${interaction.user.id}> ha pagado **$${amount.toLocaleString()}**\n\nBalance de empresa actualizado.`).catch(() => {
                            // If DM fails, send in channel
                            interaction.channel.send(`<@${employeeId}> 💰 Pago recibido: $${amount.toLocaleString()} de <@${interaction.user.id}>`).catch(() => { });
                        });
                    }
                }
            } catch (notifyErr) {
                console.error('[pay_comp] Failed to notify employee:', notifyErr);
            }

            await interaction.editReply({
                content: `✅ **Pago Exitoso**\nHas pagado **$${amount.toLocaleString()}** a **${company?.name || 'Empresa'}**.`,
                components: []
            });

        } catch (error) {
            console.error('[pay_comp_final]', error);
            await interaction.editReply({ content: '❌ Error procesando el pago.', components: [] });
        }
        return;
    }

    // ============================================================
    // BUTTON: Pay Business Credit Card Debt
    // ============================================================
    if (interaction.isButton() && interaction.customId.startsWith('pay_biz_debt_')) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        // CustomID: pay_biz_debt_METHOD_CARDID_AMOUNT
        // ex: pay_biz_debt_cash_123_5000
        const method = parts[3];
        const cardId = parts[4];
        const amount = parseFloat(parts[5]);

        try {
            // Get card info
            const { data: card } = await supabase
                .from('business_credit_cards')
                .select('*, companies!inner(name)')
                .eq('id', cardId)
                .single();

            if (!card) {
                return interaction.followUp({ content: '❌ Tarjeta no encontrada.', flags: [64] });
            }

            // Remove money from user
            await billingService.ubService.removeMoney(
                interaction.guildId,
                interaction.user.id,
                amount,
                `Pago tarjeta empresarial: ${card.companies.name}`,
                method
            );

            // Reduce debt
            const newDebt = (card.current_balance || 0) - amount;
            await supabase
                .from('business_credit_cards')
                .update({
                    current_balance: newDebt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', cardId);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Pago de Deuda Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Se abonó **$${amount.toLocaleString()}** a tu tarjeta empresarial`)
                .addFields(
                    { name: '🏢 Empresa', value: card.companies.name, inline: true },
                    { name: '💳 Tarjeta', value: card.card_name, inline: true },
                    { name: '💰 Abono', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Deuda Anterior', value: `$${(card.current_balance || 0).toLocaleString()}`, inline: true },
                    { name: '📈 Nueva Deuda', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: '💳 Método', value: method === 'cash' ? '💵 Efectivo' : '🏦 Banco', inline: false }
                )
                .setFooter({ text: '¡Excelente manejo financiero!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error('[pay_biz_debt] Error:', error);
            await interaction.followUp({
                content: `❌ Error procesando pago: ${error.message}`,
                flags: [64]
            });
        }
        return;
    }

    // ============================================================
    // BUTTON: Company Payroll (from panel)
    // ============================================================
    if (interaction.isButton() && interaction.customId.startsWith('company_payroll_')) {
        await interaction.deferReply({});

        const companyId = interaction.customId.split('_')[2];

        try {
            // Get payroll groups for this company
            // Note: In real app, we might filter by company_id if groups are company-specific, 
            // but currently they seem to be user-owned "payroll_groups". 
            // Assuming this logic is correct based on index.js
            const { data: groups } = await supabase
                .from('payroll_groups')
                .select('*')
                .eq('owner_discord_id', interaction.user.id);

            if (!groups || groups.length === 0) {
                return interaction.editReply({
                    content: `❌ **No tienes grupos de nómina**\n\nCrea uno con \`/nomina crear nombre:MiGrupo\``
                });
            }

            // Show selector of payroll groups
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`payroll_select_${companyId}`)
                .setPlaceholder('Selecciona grupo de nómina a pagar')
                .addOptions(groups.map(g => ({
                    label: g.name,
                    description: `Grupo de nómina`,
                    value: g.id.toString(),
                    emoji: '💼'
                })));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('💼 Pagar Nómina Empresarial')
                .setColor(0x5865F2)
                .setDescription(`Selecciona qué grupo de nómina pagar:`);

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[company_payroll] Error:', error);
            await interaction.editReply({ content: '❌ Error obteniendo grupos de nómina.' });
        }
        return;
    }

    // ============================================================
    // BUTTON: Company Withdraw Funds
    // ============================================================
    if (interaction.isButton() && interaction.customId.startsWith('company_withdraw_')) {
        await interaction.deferReply({});

        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.editReply('❌ Empresa no encontrada.');
            }

            const balance = company.balance || 0;

            if (balance === 0) {
                return interaction.editReply(`❌ **Sin fondos para retirar**\n\n🏢 ${company.name}\n💰 Balance: $0\n\nGenera ingresos con \`/empresa cobrar\``);
            }

            const embed = new EmbedBuilder()
                .setTitle(`💸 Retirar Fondos - ${company.name}`)
                .setColor(0xFFD700)
                .setDescription(`Balance disponible: **$${balance.toLocaleString()}**\n\nResponde con el monto que deseas retirar.\n\n⚠️ Se cobrará **10% de impuesto** sobre el retiro.`)
                .setFooter({ text: 'Tienes 60 segundos para responder' });

            await interaction.editReply({ embeds: [embed] });

            // Wait for message response
            const filter = m => m.author.id === interaction.user.id;
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
                .catch(() => null);

            if (!collected) {
                return interaction.followUp({ content: '⏱️ Tiempo agotado.', flags: [64] });
            }

            const amount = parseFloat(collected.first().content.replace(/[$,]/g, ''));

            if (isNaN(amount) || amount <= 0) {
                return interaction.followUp({ content: '❌ Monto inválido.', flags: [64] });
            }

            if (amount > balance) {
                return interaction.followUp({ content: `❌ Fondos insuficientes. Balance: $${balance.toLocaleString()}`, flags: [64] });
            }

            // Calculate tax (10%)
            const tax = amount * 0.10;
            const netAmount = amount - tax;

            // Remove from company
            await supabase
                .from('companies')
                .update({ balance: balance - amount })
                .eq('id', companyId);

            // Add to user (cash)
            await billingService.ubService.addMoney(
                interaction.guildId,
                interaction.user.id,
                netAmount,
                `Retiro de ${company.name}`,
                'cash'
            );

            const resultEmbed = new EmbedBuilder()
                .setTitle('✅ Retiro Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Fondos retirados de **${company.name}**`)
                .addFields(
                    { name: '💰 Monto Bruto', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Impuesto (10%)', value: `$${tax.toLocaleString()}`, inline: true },
                    { name: '💵 Recibido', value: `$${netAmount.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Los fondos están en tu efectivo personal' })
                .setTimestamp();

            await interaction.followUp({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('[company_withdraw] Error:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
        return;
    }

    // ============================================================
    // COMPANY VEHICLE ADDITION HANDLERS
    // ============================================================

    // BUTTON: Add Vehicle to Company
    if (interaction.isButton() && interaction.customId.startsWith('company_addvehicle_')) {
        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.reply({ content: '❌ Empresa no encontrada.', flags: [64] });
            }

            if (!company.owner_ids.includes(interaction.user.id)) {
                return interaction.reply({ content: '⛔ Solo los dueños pueden agregar vehículos.', flags: [64] });
            }

            const vehicleMenu = new StringSelectMenuBuilder()
                .setCustomId(`vehicle_select_${companyId}`)
                .setPlaceholder('Selecciona el tipo de vehículo')
                .addOptions([
                    { label: 'Ejecutiva Ligera', description: '$420,000 - Vehículo ligero para ejecutivos', value: 'ejecutiva_ligera', emoji: '🚗' },
                    { label: 'Operativa de Servicio', description: '$550,000 - Vehículo para operaciones', value: 'operativa_servicio', emoji: '🚙' },
                    { label: 'Carga Pesada', description: '$850,000 - Camión de carga', value: 'carga_pesada', emoji: '🚚' },
                    { label: 'Ejecutiva Premium', description: '$1,200,000 - Vehículo premium de lujo', value: 'ejecutiva_premium', emoji: '🚘' },
                    { label: 'Asistencia Industrial', description: '$1,500,000 - Vehículo industrial pesado', value: 'asistencia_industrial', emoji: '🚛' }
                ]);

            const row = new ActionRowBuilder().addComponents(vehicleMenu);

            await interaction.reply({
                content: `🚗 **Selecciona el tipo de vehículo para ${company.name}**`,
                components: [row],
                flags: [64]
            });

        } catch (error) {
            console.error('[company_addvehicle]', error);
            await interaction.reply({ content: '❌ Error cargando opciones.', flags: [64] });
        }
        return;
    }

    // SELECT MENU: Vehicle Type Selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vehicle_select_')) {
        await interaction.deferUpdate();

        const companyId = interaction.customId.split('_')[2];
        const vehicleType = interaction.values[0];

        const VEHICLE_COSTS = {
            'ejecutiva_ligera': 420000,
            'operativa_servicio': 550000,
            'carga_pesada': 850000,
            'ejecutiva_premium': 1200000,
            'asistencia_industrial': 1500000
        };

        const VEHICLE_NAMES = {
            'ejecutiva_ligera': '🚗 Ejecutiva Ligera',
            'operativa_servicio': '🚙 Operativa de Servicio',
            'carga_pesada': '🚚 Carga Pesada',
            'ejecutiva_premium': '🚘 Ejecutiva Premium',
            'asistencia_industrial': '🚛 Asistencia Industrial'
        };

        const cost = VEHICLE_COSTS[vehicleType];
        const name = VEHICLE_NAMES[vehicleType];

        try {
            const pmVehicle = await getAvailablePaymentMethods(supabase, interaction.user.id, interaction.guildId);
            const pbVehicle = createPaymentButtons(pmVehicle, 'vehicle_pay');
            const vehicleEmbed = createPaymentEmbed(name, cost, pmVehicle);

            await interaction.editReply({
                content: `💰 **Compra de vehículo para la empresa**`,
                embeds: [vehicleEmbed],
                components: [pbVehicle]
            });

            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('vehicle_pay_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const method = i.customId.replace('vehicle_pay_', '');

                    const paymentResult = await processPayment(billingService, supabase, method, interaction.user.id, interaction.guildId, cost, `[Vehículo] ${name}`, pmVehicle);

                    if (!paymentResult.success) {
                        return i.editReply({ content: paymentResult.error, embeds: [], components: [] });
                    }

                    const { data: company } = await supabase.from('companies').select('vehicle_count').eq('id', companyId).single();
                    await supabase.from('companies').update({ vehicle_count: (company.vehicle_count || 0) + 1 }).eq('id', companyId);

                    const vehicleRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`company_addvehicle_${companyId}`).setLabel('➕ Agregar Otro Vehículo').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId(`company_finish_${companyId}`).setLabel('✅ Finalizar').setStyle(ButtonStyle.Success)
                    );

                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Vehículo Agregado')
                        .setDescription(`${name}\n\n💰 Pagado: $${cost.toLocaleString()}\n💳 Método: ${paymentResult.method}`)
                        .addFields({ name: '🚗 Total de Vehículos', value: `${(company.vehicle_count || 0) + 1}`, inline: true })
                        .setTimestamp();

                    await i.editReply({ content: '¿Deseas agregar más vehículos?', embeds: [successEmbed], components: [vehicleRow] });

                } catch (error) {
                    console.error('[vehicle payment]', error);
                    await i.editReply({ content: '❌ Error procesando pago.', embeds: [], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ content: '⏰ Tiempo agotado.', embeds: [], components: [] });
                }
            });

        } catch (error) {
            console.error('[vehicle_select]', error);
            await interaction.editReply({ content: '❌ Error procesando vehículo.', components: [] });
        }
        return;
    }

    // BUTTON: Finish Adding Vehicles
    if (interaction.isButton() && interaction.customId.startsWith('company_finish_')) {
        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase.from('companies').select('name, vehicle_count').eq('id', companyId).single();

            const finalEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏢 Empresa Completada')
                .setDescription(`**${company.name}**\n\nRegistro finalizado exitosamente.`)
                .addFields({ name: '🚗 Vehículos Registrados', value: `${company.vehicle_count || 0}`, inline: true })
                .setTimestamp();

            await interaction.update({ content: '✅ Configuración de empresa completada!', embeds: [finalEmbed], components: [] });

        } catch (error) {
            console.error('[company_finish]', error);
            await interaction.update({ content: '✅ Empresa finalizada.', components: [] });
        }
        return;
    }

    // BUTTON: Company Stats
    if (interaction.isButton() && interaction.customId.startsWith('company_stats_')) {
        await interaction.deferReply({});

        const companyId = interaction.customId.split('_')[2];

        try {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (!company) {
                return interaction.editReply('❌ Empresa no encontrada.');
            }

            // Get business credit card if exists
            const { data: bizCard } = await supabase
                .from('business_credit_cards')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'active')
                .single();

            const embed = new EmbedBuilder()
                .setTitle(`📊 Estadísticas - ${company.name}`)
                .setColor(0x5865F2)
                .setThumbnail(company.logo_url)
                .addFields(
                    { name: '🏷️ Industria', value: company.industry_type, inline: true },
                    { name: '📍 Ubicación', value: company.location || 'N/A', inline: true },
                    { name: '🔒 Tipo', value: company.is_private ? 'Privada' : 'Pública', inline: true },
                    { name: '💰 Balance', value: `$${(company.balance || 0).toLocaleString()}`, inline: true },
                    { name: '👥 Empleados', value: `${company.employee_count || 0}`, inline: true },
                    { name: '🚗 Vehículos', value: `${company.vehicles || 0}`, inline: true }
                );

            if (bizCard) {
                const debt = bizCard.current_balance || 0;
                const available = bizCard.credit_limit - debt;
                embed.addFields({
                    name: '💳 Crédito Empresarial',
                    value: `**${bizCard.card_name}**\n📊 Deuda: $${debt.toLocaleString()}\n💵 Disponible: $${available.toLocaleString()}`,
                    inline: false
                });
            }

            embed.addFields(
                { name: '📅 Creada', value: `<t:${Math.floor(new Date(company.created_at).getTime() / 1000)}:R>`, inline: false }
            );

            embed.setFooter({ text: 'Sistema Empresarial Nación MX' });
            embed.setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[company_stats] Error:', error);
            await interaction.editReply({ content: '❌ Error obteniendo estadísticas.' });
        }
        return;
    }

    // ============================================================
    // BUTTON: Credit Card Upgrade
    // ============================================================
    if (interaction.isButton() && (interaction.customId.startsWith('btn_upgrade_') || interaction.customId.startsWith('btn_cancel_upgrade_'))) {
        const parts = interaction.customId.split('_');
        const targetUserId = parts[2];

        // Security: only target user can click these
        if (interaction.user.id !== targetUserId) {
            return interaction.reply({ content: '❌ Este botón no es para ti.', ephemeral: true });
        }

        if (interaction.customId.startsWith('btn_cancel_upgrade_')) {
            return interaction.update({ content: '❌ Mejora de tarjeta cancelada.', embeds: [], components: [] });
        }

        await interaction.deferUpdate();

        // btn_upgrade_USERID_TIER_NAME (with underscores)
        const tierNameUnderscore = parts.slice(3).join('_');
        const nextTier = tierNameUnderscore.replace(/_/g, ' ');

        const cardStats = {
            'NMX Start': { limit: 15000, interest: 15, cost: 2000, color: 0x34495E },
            'NMX Básica': { limit: 30000, interest: 12, cost: 4000, color: 0x7F8C8D },
            'NMX Plus': { limit: 50000, interest: 10, cost: 6000, color: 0x95A5A6 },
            'NMX Plata': { limit: 100000, interest: 8, cost: 10000, color: 0xC0C0C0 },
            'NMX Oro': { limit: 250000, interest: 7, cost: 15000, color: 0xFFD700 },
            'NMX Rubí': { limit: 500000, interest: 6, cost: 25000, color: 0xE74C3C },
            'NMX Black': { limit: 1000000, interest: 5, cost: 40000, color: 0x2C3E50 },
            'NMX Diamante': { limit: 2000000, interest: 3, cost: 60000, color: 0x3498DB },
            'NMX Zafiro': { limit: 5000000, interest: 2.5, cost: 100000, color: 0x0F52BA },
            'NMX Platino Elite': { limit: 10000000, interest: 2, cost: 150000, color: 0xE5E4E2 }
        };

        const stats = cardStats[nextTier];
        if (!stats) return interaction.followUp({ content: '❌ Error: Estadísticas de tarjeta no encontradas.', ephemeral: true });

        try {
            // 1. Check & Deduct Money
            await billingService.ubService.removeMoney(interaction.guildId, interaction.user.id, stats.cost, `Mejora Tarjeta: ${nextTier}`, 'bank');

            // 2. Update DB
            // First find the citizen associated with this discord user
            const { data: citizen } = await supabase
                .from('citizens')
                .select('id')
                .eq('discord_id', interaction.user.id)
                .maybeSingle();

            if (!citizen) throw new Error('Citizen profile not found');

            const updateData = {
                card_type: nextTier,
                card_limit: stats.limit, // FIX: Use card_limit as per schema
                interest_rate: stats.interest
            };

            // Add updated_at only if it potentially exists or just keep it since we want it
            updateData.updated_at = new Date().toISOString();

            const { error: updateError } = await supabase
                .from('credit_cards')
                .update(updateData)
                .eq('citizen_id', citizen.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (updateError) throw updateError;

            // 3. Success Embed
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 ¡Mejora Procesada con Éxito!')
                .setColor(stats.color)
                .setDescription(`Felicidades <@${interaction.user.id}>, tu tarjeta ha sido mejorada a **${nextTier}**.`)
                .addFields(
                    { name: '📈 Nuevo Límite', value: `$${stats.limit.toLocaleString()}`, inline: true },
                    { name: '📉 Nueva Tasa', value: `${stats.interest}%`, inline: true },
                    { name: '💰 Coste Pagado', value: `$${stats.cost.toLocaleString()}`, inline: true }
                )
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/6124/6124997.png')
                .setFooter({ text: 'Banco Nacional - Creciendo contigo' })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error('[Credit Upgrade Error]:', error);
            const errMsg = error.message?.includes('insufficient funds') ? '❌ No tienes fondos suficientes en el banco.' : `❌ Error al procesar mejora: ${error.message}`;
            await interaction.followUp({ content: errMsg, ephemeral: true });
        }
        return;
    }
};

module.exports = { handleEconomyButtons };

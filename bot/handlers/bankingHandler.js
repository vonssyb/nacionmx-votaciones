const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../services/Logger');
const ticketHandler = require('./ticketHandler'); // Reuse closing logic if needed or just button

const BANK_CONFIG = {
    BANKER_ROLE: '1450591546524307689', // Banqueros
    CATEGORY_ID: '1398888679216513044', // Categoría Banco
    LOG_CHANNEL: '1414065296704016465', // Canal de logs (igual que tickets)
    ADMIN_ROLES: ['1412882245735420006', '1412887195014557787'] // Junta Directiva, Co-Owner
};

/**
 * Handler for banking panel interactions
 */
async function handleBankingInteraction(interaction, client, supabase) {
    if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

    const { customId } = interaction;
    // logger.debug('[Banking Handler] Interaction received', { customId }); // Verbose

    try {
        // Banking Select Menu
        if (customId === 'banco_servicios') {
            const selectedService = interaction.values[0];
            return await handleBankServiceSelection(selectedService, interaction, client, supabase);
        }

        // Banking Quick Buttons & Actions
        if (customId.startsWith('banco_btn_') || customId.startsWith('btn_bank_')) {
            const service = customId.replace(/banco_btn_|btn_bank_/, '');
            return await handleBankButtonPress(service, interaction, client, supabase);
        }

        // Banking Modal Submissions
        if (customId.startsWith('modal_banco_')) {
            return await handleBankModalSubmit(customId, interaction, client, supabase);
        }

        return false;
    } catch (error) {
        logger.errorWithContext('Banking Handler Error', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error al procesar la solicitud bancaria.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply('❌ Error al procesar la solicitud bancaria.');
            }
        } catch (e) {
            // logger.errorWithContext('Banking Handler Failed to send error message', e);
        }
        return true; // Mark as handled even if error
    }
}

async function handleBankServiceSelection(service, interaction, client, supabase) {
    // logger.info('[Banking] Menu service selected', { service });
    switch (service) {
        case 'banco_debito':
            return showModalDebito(interaction);
        case 'banco_credito':
            return showModalCredito(interaction);
        case 'banco_prestamo':
            return showModalPrestamo(interaction);
        case 'banco_consulta':
            return showEstadoCuenta(interaction, supabase);
        case 'banco_cambio':
            return showModalCambio(interaction);
        case 'banco_empresa':
            return showModalEmpresa(interaction);
        case 'banco_ahorro':
            return showModalAhorro(interaction);
        case 'banco_ayuda':
            return showAyudaBanco(interaction);
        default:
            await interaction.reply({ content: '❌ Servicio no disponible.', flags: MessageFlags.Ephemeral });
            return true;
    }
}

// ... MODALS (Keep existing helpers, shortened for brevity if unchanged logic, but including for completeness)
async function showModalDebito(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_debito').setTitle('💳 Solicitud Tarjeta Débito');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nombre').setLabel('Nombre Completo').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ocupacion').setLabel('Ocupación').setStyle(TextInputStyle.Short).setRequired(false))
    );
    await interaction.showModal(modal);
    return true;
}
async function showModalCredito(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_credito').setTitle('💳 Solicitud Tarjeta Crédito');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ingreso').setLabel('Ingresos Mensuales').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}
async function showModalPrestamo(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_prestamo').setTitle('💰 Solicitud de Préstamo');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('monto').setLabel('Monto Solicitado').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plazo').setLabel('Plazo (3, 6, 12, 24 meses)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}
async function showModalCambio(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_cambio').setTitle('💱 Cambio de Divisas');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('monto').setLabel('Monto').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tipo').setLabel('Compra o Venta').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}
async function showModalEmpresa(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_empresa').setTitle('🏢 Servicio Empresarial');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('empresa').setLabel('Nombre Empresa').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('servicio').setLabel('Servicio').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}
async function showModalAhorro(interaction) {
    const modal = new ModalBuilder().setCustomId('modal_banco_ahorro').setTitle('🐷 Cuenta de Ahorro');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('deposito').setLabel('Depósito Inicial').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('plazo').setLabel('Plazo (3, 6, 12, 24 meses)').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
    return true;
}

// ... BUTTON HANDLERS
async function handleBankButtonPress(service, interaction, client, supabase) {
    // logger.info('[Banking] Button pressed', { service });
    if (service === 'claim_ticket') return handleClaimTicket(interaction);
    if (service.startsWith('approve_loan_')) return handleApproveLoan(service.replace('approve_loan_', ''), interaction, client, supabase);
    if (service.startsWith('approve_savings_')) return handleApproveSavings(service.replace('approve_savings_', ''), interaction, client, supabase);

    // Quick Buttons from Panel
    switch (service) {
        case 'creditoexpress':
            return showModalPrestamo(interaction);
        case 'estadocuenta':
            return showEstadoCuenta(interaction, supabase);
        case 'mistarjetas':
            return showMisTarjetas(interaction, supabase);
        default:
            return false;
    }
}

// ... VIEW FUNCTIONS (MisTarjetas, EstadoCuenta) - Keep previous implementation
async function showMisTarjetas(interaction, supabase) {
    // Re-implementing simplified to allow replace success
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const { data: debit } = await supabase.from('debit_cards').select('*').eq('discord_user_id', interaction.user.id).eq('status', 'active');
        const { data: credit } = await supabase.from('credit_cards').select('*').eq('discord_id', interaction.user.id).eq('status', 'active');

        const embed = new EmbedBuilder().setTitle('💳 Mis Tarjetas').setColor(0x3498DB);
        let has = false;
        if (debit?.length) { has = true; embed.addFields({ name: 'Débito', value: debit.map(c => `• **${c.card_tier}**: \`*${c.card_number?.slice(-4)}\` $${c.balance?.toLocaleString()}`).join('\n') }); }
        if (credit?.length) { has = true; embed.addFields({ name: 'Crédito', value: credit.map(c => `• **${c.card_type}**: \`*${c.card_number?.slice(-4)}\` Deuda: $${c.current_balance?.toLocaleString()}`).join('\n') }); }
        if (!has) embed.setDescription('No tienes tarjetas activas.');

        await interaction.editReply({ embeds: [embed] });
    } catch (e) { await interaction.editReply('Error consultando tarjetas'); }
    return true;
}

async function showEstadoCuenta(interaction, supabase) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const { count: mxn } = await supabase.from('credit_cards').select('*', { count: 'exact', head: true }).eq('discord_id', interaction.user.id);
        const { count: usd } = await supabase.from('credit_cards_usd').select('*', { count: 'exact', head: true }).eq('discord_user_id', interaction.user.id);

        const embed = new EmbedBuilder().setTitle('📊 Estado').setColor(0x5865F2)
            .addFields({ name: 'Tarjetas MXN', value: `${mxn || 0}`, inline: true }, { name: 'Tarjetas USD', value: `${usd || 0}`, inline: true });
        await interaction.editReply({ embeds: [embed] });
    } catch (e) { await interaction.editReply('Error'); }
    return true;
}

async function showAyudaBanco(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('❓ Ayuda - Servicios Bancarios')
        .setDescription(
            '**¿Cómo usar el Banco?**\n\n' +
            '1️⃣ Selecciona el servicio del menú\n' +
            '2️⃣ Completa el formulario\n' +
            '3️⃣ Un banquero te atenderá\n\n' +
            '**Servicios Disponibles:**\n' +
            '💳 **Tarjetas:** Débito y crédito MXN/USD\n' +
            '💰 **Préstamos:** Personales y empresariales\n' +
            '📊 **Consultas:** Estado de cuenta, movimientos\n' +
            '🔄 **Cambio:** Convertir MXN ⇄ USD\n\n' +
            '**Comandos Útiles:**\n' +
            '`/tarjetas info` - Ver tus tarjetas\n' +
            '`/credito` - Gestión de créditos\n' +
            '`/balanza` - Ver tu balance completo\n\n' +
            '💡 Para atención directa, abre un ticket bancario.'
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'Banco Nacional de México' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
}

// --- AUTOMATION HANDLERS ---

async function handleClaimTicket(interaction) {
    // Only bankers
    if (!interaction.member.roles.cache.has(BANK_CONFIG.BANKER_ROLE) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;

    // Update topic and perms
    await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
    await channel.setTopic(`${channel.topic} | Atendido por: ${interaction.user.tag}`);

    await interaction.editReply(`🙋‍♂️ **${interaction.user.tag}** ha tomado este ticket.`);
    return true;
}

async function handleApproveLoan(loanId, interaction, client, supabase) {
    // Check perms
    if (!interaction.member.roles.cache.has(BANK_CONFIG.BANKER_ROLE)) return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    // Get Loan
    const { data: loan } = await supabase.from('loans').select('*').eq('id', loanId).single();
    if (!loan || loan.status !== 'pending') return interaction.editReply('❌ Préstamo no encontrado o ya procesado.');

    // Approve logic (Same as command)
    const { error: updateError } = await supabase.from('loans').update({ status: 'active', approved_by: interaction.user.id, approved_at: new Date().toISOString() }).eq('id', loanId);
    if (updateError) {
        logger.errorWithContext('Error updating loan status', updateError);
        return interaction.editReply('❌ Error al actualizar el estado del préstamo en la base de datos.');
    }

    // Transfer Money (UB)
    const UnbelievaBoatService = require('../services/UnbelievaBoatService');
    const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
    const ubResult = await ub.addMoney(interaction.guildId, loan.discord_user_id, loan.loan_amount, `Préstamo #${loan.id} aprobado`, 'cash');

    if (!ubResult.success) {
        logger.errorWithContext('Error adding money for loan approval', ubResult.error);
        return interaction.editReply(`❌ Error al depositar el dinero al usuario: ${ubResult.error}`);
    }

    // Remove buttons from message
    await interaction.message.edit({ components: [] });

    await interaction.editReply(`✅ **Préstamo Aprobado Automáticamente**\nSe han depositado $${loan.loan_amount.toLocaleString()} al usuario.`);
    return true;
}

async function handleApproveSavings(accountId, interaction, client, supabase) {
    if (!interaction.member.roles.cache.has(BANK_CONFIG.BANKER_ROLE)) return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });

    const { data: acc, error: accError } = await supabase.from('savings_accounts').select('*').eq('id', accountId).single();
    if (accError || !acc || acc.status !== 'pending') {
        logger.errorWithContext('Error fetching savings account or invalid status', accError);
        return interaction.editReply('❌ Solicitud no válida o ya procesada.');
    }

    // Check User Balance
    const UnbelievaBoatService = require('../services/UnbelievaBoatService');
    const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
    const balanceResult = await ub.getBalance(interaction.guildId, acc.discord_user_id);

    if (!balanceResult.success) {
        logger.errorWithContext('Error fetching user balance for savings approval', balanceResult.error);
        return interaction.editReply(`❌ Error al consultar el balance del usuario: ${balanceResult.error}`);
    }

    if (balanceResult.balance.cash < acc.initial_deposit) {
        return interaction.editReply('❌ El usuario no tiene fondos suficientes para el depósito inicial.');
    }

    // Deduct and Activate
    const removeMoneyResult = await ub.removeMoney(interaction.guildId, acc.discord_user_id, acc.initial_deposit, `Apertura Ahorro ${acc.account_number}`, 'cash');
    if (!removeMoneyResult.success) {
        logger.errorWithContext('Error removing money for savings approval', removeMoneyResult.error);
        return interaction.editReply(`❌ Error al deducir el depósito inicial: ${removeMoneyResult.error}`);
    }

    const { error: updateError } = await supabase.from('savings_accounts').update({ status: 'active', current_balance: acc.initial_deposit, opened_by: interaction.user.id }).eq('id', accountId);
    if (updateError) {
        logger.errorWithContext('Error updating savings account status', updateError);
        return interaction.editReply('❌ Error al activar la cuenta de ahorro en la base de datos.');
    }

    // Transaction log
    const { error: transactionError } = await supabase.from('savings_transactions').insert({ account_id: accountId, transaction_type: 'deposit', amount: acc.initial_deposit, balance_after: acc.initial_deposit, executed_by: interaction.user.id });
    if (transactionError) {
        logger.errorWithContext('Error inserting savings transaction', transactionError);
        // This is not critical enough to revert, but should be logged.
    }

    await interaction.message.edit({ components: [] });
    await interaction.editReply(`✅ **Cuenta de Ahorro Activada**\nDepósito inicial de $${acc.initial_deposit.toLocaleString()} procesado.`);
    return true;
}


// --- MODAL SUBMIT & TICKET CREATION ---

async function handleBankModalSubmit(customId, interaction, client, supabase) {
    await interaction.deferReply({ ephemeral: true });
    const serviceType = customId.replace('modal_banco_', '');

    let automationData = null;
    let autoEmbed = null;

    // 1. Pre-Create Data for Automation
    if (serviceType === 'prestamo') {
        const monto = parseInt(interaction.fields.getTextInputValue('monto'));
        const plazo = parseInt(interaction.fields.getTextInputValue('plazo').replace(/[^0-9]/g, ''));
        const motivo = interaction.fields.getTextInputValue('motivo');

        if (isNaN(monto) || isNaN(plazo) || monto <= 0 || ![3, 6, 12, 24].includes(plazo)) {
            await interaction.editReply('❌ Monto o plazo de préstamo inválido. Asegúrate de que el monto sea un número positivo y el plazo sea 3, 6, 12 o 24 meses.');
            return true;
        }

        // Calculate Logic
        const rate = 5.0;
        const monthlyRate = (rate / 100) / 12;
        const payment = Math.ceil((monto * monthlyRate * Math.pow(1 + monthlyRate, plazo)) / (Math.pow(1 + monthlyRate, plazo) - 1));

        const { data: loan, error: loanError } = await supabase.from('loans').insert({
            guild_id: interaction.guildId, discord_user_id: interaction.user.id,
            loan_amount: monto, interest_rate: rate, term_months: plazo,
            monthly_payment: payment, total_to_pay: payment * plazo,
            purpose: motivo, status: 'pending',
            next_payment_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }).select().single();

        if (loanError) {
            logger.errorWithContext('Error inserting loan into DB', loanError);
            await interaction.editReply('❌ Error al registrar tu solicitud de préstamo.');
            return true;
        }

        if (loan) {
            automationData = { type: 'LOAN', id: loan.id };
            autoEmbed = new EmbedBuilder().setTitle('📋 Solicitud de Préstamo (Automática)')
                .addFields(
                    { name: 'Monto', value: `$${monto.toLocaleString()}`, inline: true },
                    { name: 'Plazo', value: `${plazo} meses`, inline: true },
                    { name: 'Pago Mensual', value: `$${payment.toLocaleString()}`, inline: true }
                )
                .setColor(0xFFA500);
        }
    }

    if (serviceType === 'ahorro') {
        const deposito = parseInt(interaction.fields.getTextInputValue('deposito'));
        const plazo = parseInt(interaction.fields.getTextInputValue('plazo').replace(/[^0-9]/g, ''));

        if (isNaN(deposito) || isNaN(plazo) || deposito <= 0 || ![3, 6, 12, 24].includes(plazo)) {
            await interaction.editReply('❌ Depósito inicial o plazo de ahorro inválido. Asegúrate de que el depósito sea un número positivo y el plazo sea 3, 6, 12 o 24 meses.');
            return true;
        }

        const accNum = '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
        const rates = { 3: 3, 6: 4, 12: 5, 24: 6 };
        const rate = rates[plazo] || 3;
        const maturity = new Date(); maturity.setMonth(maturity.getMonth() + plazo);

        const { data: acc, error: accError } = await supabase.from('savings_accounts').insert({
            guild_id: interaction.guildId, discord_user_id: interaction.user.id,
            account_number: accNum, initial_deposit: deposito, current_balance: 0, // 0 until activated
            interest_rate: rate, term_months: plazo, status: 'pending',
            maturity_date: maturity.toISOString()
        }).select().single();

        if (accError) {
            logger.errorWithContext('Error inserting savings account into DB', accError);
            await interaction.editReply('❌ Error al registrar tu solicitud de cuenta de ahorro.');
            return true;
        }

        if (acc) {
            automationData = { type: 'SAVINGS', id: acc.id };
            autoEmbed = new EmbedBuilder().setTitle('📋 Solicitud Ahorro (Automática)')
                .addFields(
                    { name: 'Depósito', value: `$${deposito.toLocaleString()}`, inline: true },
                    { name: 'Plazo', value: `${plazo} meses`, inline: true }
                )
                .setColor(0x2ECC71);
        }
    }

    // 2. Create Ticket
    const ticketChannel = await createBankingTicket(interaction, serviceType, client, supabase, automationData, autoEmbed);

    if (ticketChannel) {
        await interaction.editReply(`✅ Tu solicitud bancaria ha sido creada: ${ticketChannel}`);
        return true;
    } else {
        await interaction.editReply('❌ Error al crear tu solicitud bancaria.');
        return true;
    }
}

async function createBankingTicket(interaction, serviceType, client, supabase, automationData = null, autoEmbed = null) {
    try {
        const cleanName = interaction.user.username.replace(/[^a-z0-9\-_]/g, '').toLowerCase().substring(0, 15);
        const channelName = `banco-${serviceType}-${cleanName}`;

        // logger.info(`[BANK-DEBUG] Creating ticket channel: ${channelName}`);

        const permissionOverwrites = [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
            { id: BANK_CONFIG.BANKER_ROLE, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: BANK_CONFIG.CATEGORY_ID,
            topic: `ID: ${interaction.user.id} | Servicio: ${serviceType}`,
            permissionOverwrites
        });

        // logger.info(`[BANK-DEBUG] Channel created ID: ${ticketChannel.id}`);

        const { error: insertError } = await supabase.from('tickets').insert([{
            guild_id: interaction.guild.id,
            channel_id: ticketChannel.id,
            creator_id: interaction.user.id,
            status: 'OPEN',
            last_active_at: new Date().toISOString(),
            // panel_id: null // No panel for these custom ones
        }]);

        if (insertError) {
            logger.errorWithContext('[BANKING-CRITICAL] DB Insert Failed. Rolling back.', insertError);
            await ticketChannel.delete('DB Insert Failed - Atomic Rollback').catch(() => { });
            return null; // Signal failure
        }

        // logger.info(`[BANK-DEBUG] DB Insert Success. Processing modal fields...`);

        // Build description from modal fields
        let description = `**Tipo:** Solicitud Bancaria - ${serviceType.toUpperCase()}\n**Usuario:** <@${interaction.user.id}>\n\n`;

        // Iterate through modal fields correctly
        // Safety check for fields
        if (interaction.fields && interaction.fields.fields) {
            interaction.fields.fields.forEach((field) => {
                const label = field.customId.replace(/_/g, ' ').toUpperCase();
                description += `**${label}:** ${field.value}\n`;
            });
        } else {
            logger.warn('[BANK-DEBUG] No fields found in modal submission');
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏦 Solicitud Bancaria: ${serviceType.toUpperCase()}`)
            .setDescription(description)
            .setColor(0x2ECC71)
            .setFooter({ text: 'Un banquero te atenderá pronto' })
            .setTimestamp();

        // Control Row
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_bank_claim_ticket').setLabel('🙋 Atender Oficina').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_close_ticket_ask').setLabel('🔒 Cerrar Oficina').setStyle(ButtonStyle.Danger)
        );

        // Send Main Message
        await ticketChannel.send({
            content: `<@${interaction.user.id}> <@&${BANK_CONFIG.BANKER_ROLE}>`,
            embeds: [embed],
            components: [row]
        });

        // Send Automation Embed if exists
        if (autoEmbed && automationData) {
            const autoRow = new ActionRowBuilder();

            if (automationData.type === 'LOAN') {
                autoRow.addComponents(new ButtonBuilder().setCustomId(`btn_bank_approve_loan_${automationData.id}`).setLabel('✅ Aprobar Préstamo (Automático)').setStyle(ButtonStyle.Primary));
            } else if (automationData.type === 'SAVINGS') {
                autoRow.addComponents(new ButtonBuilder().setCustomId(`btn_bank_approve_savings_${automationData.id}`).setLabel('✅ Activar Cuenta (Cobrar)').setStyle(ButtonStyle.Primary));
            }

            await ticketChannel.send({ content: '**⚡ Panel de Gestión Automática**', embeds: [autoEmbed], components: [autoRow] });
        }

        // logger.info(`[BANK-DEBUG] Ticket setup complete.`);

        return ticketChannel;
    } catch (error) {
        logger.errorWithContext('Banking Ticket Error', error);
        return null;
    }
}

module.exports = { handleBankingInteraction };

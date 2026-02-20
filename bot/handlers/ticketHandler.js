const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder
} = require('discord.js');

const logger = require('../services/Logger');
const TicketStrategyFactory = require('../services/tickets/TicketStrategyFactory');
const TICKET_CONFIG = require('../config/TicketConfig');

module.exports = {
    async handleTicketInteraction(interaction, client, supabase) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return false;

        const { customId } = interaction;
        let ticketTypeKey = null;

        // --- 1. SELECCIÓN ---
        if (interaction.isStringSelectMenu() && customId === 'ticket_main_menu') ticketTypeKey = interaction.values[0];

        // Button Mapping for legacy/mixed buttons
        const buttonMap = {
            'ticket_btn_vip': 'ticket_vip',
            'ticket_btn_bug': 'ticket_bug',
            'ticket_compra_vehiculo': 'ticket_compra_vehiculo',
            'ticket_soporte_tecnico': 'ticket_soporte_tecnico',
            'ticket_agendar_cita': 'ticket_agendar_cita',
            'ticket_recursos_humanos': 'ticket_recursos_humanos'
        };

        if (interaction.isButton() && buttonMap[customId]) {
            ticketTypeKey = buttonMap[customId];
        }

        // --- 2. SHOW MODAL / INSTANT CREATE ---
        if (ticketTypeKey) {
            try {
                // Pre-check Blacklist
                const checkBlacklist = await supabase.from('ticket_blacklist').select('user_id').eq('user_id', interaction.user.id).maybeSingle();
                if (checkBlacklist.data) return interaction.reply({ content: '🚫 Estás vetado del sistema de soporte.', ephemeral: true });

                const strategy = TicketStrategyFactory.getStrategy(ticketTypeKey);

                // VIP Check
                if (strategy.config.vipOnly) {
                    const hasVipRole = interaction.member.roles.cache.some(r => TICKET_CONFIG.ROLES.VIP_ACCESS.includes(r.id));
                    if (!hasVipRole) return interaction.reply({ content: '🚫 Acceso VIP requerido.', ephemeral: true });
                }

                // Handle (Show Modal or Create Directly)
                if (typeof strategy.handleInteraction === 'function') {
                    await strategy.handleInteraction(interaction, client, supabase);
                } else {
                    await strategy.showModal(interaction);
                }

                return true;
            } catch (err) {
                logger.errorWithContext('[TICKET] Strategy Selection Error', err);
                return interaction.reply({ content: '❌ Error interno al seleccionar ticket.', ephemeral: true }).catch(() => { });
            }
        }

        // --- 3. MODAL SUBMIT (Strategy Based) ---
        if (interaction.isModalSubmit() && customId.startsWith('modal_create_ticket:')) {
            const typeKey = customId.split(':')[1];
            try {
                const strategy = TicketStrategyFactory.getStrategy(typeKey);
                await strategy.handleModalSubmit(interaction, client, supabase);
                return true;
            } catch (err) {
                logger.errorWithContext('[TICKET] Modal Submit Error', err);
                // Try to reply if not already
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Error al procesar el formulario.', ephemeral: true });
                } else {
                    await interaction.editReply('❌ Error al procesar el formulario.');
                }
            }
        }

        // -------------------------------------------------------------
        // --- 4. LEGACY / SHARED ACTIONS (Claim, Close, Feedback) ---
        // -------------------------------------------------------------

        // --- RATING SUBMIT ---
        if (interaction.isModalSubmit() && customId === 'rating_modal') {
            await this.handleRatingSubmit(interaction, client, supabase);
            return true;
        }

        // --- CLAIM ---
        if (customId === 'btn_claim_ticket' || customId === 'ticket_claim') {
            await this.handleClaim(interaction, client, supabase);
            return true;
        }

        // --- CLOSE REQUEST ---
        if (customId === 'btn_close_ticket_ask' || customId === 'ticket_cerrar') {
            await this.handleCloseAsk(interaction, client, supabase);
            return true;
        }

        // --- CLOSE CONFIRM ---
        if (customId === 'btn_close_ticket_confirm') {
            await this.handleCloseConfirm(interaction, client, supabase);
            return true;
        }

        // --- CLOSE CANCEL ---
        if (customId === 'btn_cancel_close') {
            await interaction.message.delete().catch(() => { });
            return true;
        }

        // --- OPEN RATING MODAL (From Close Confirm) ---
        if (customId === 'open_rating_modal') {
            const modal = new ModalBuilder()
                .setCustomId('rating_modal')
                .setTitle('Califica nuestra atención');

            const starsInput = new TextInputBuilder()
                .setCustomId('rating_stars')
                .setLabel('Calificación (1-5)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('5')
                .setMinLength(1)
                .setMaxLength(1)
                .setRequired(true);

            const commentInput = new TextInputBuilder()
                .setCustomId('rating_comments')
                .setLabel('Comentarios (Opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(starsInput), new ActionRowBuilder().addComponents(commentInput));
            await interaction.showModal(modal);
            return true;
        }

        // --- SKIP RATING ---
        if (customId === 'feedback_s') { // Skip
            await interaction.reply('✅ Gracias. Cerrando ticket...');
            setTimeout(() => interaction.channel.delete().catch(() => { }), 3000);
            await supabase.from('tickets').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('channel_id', interaction.channel.id);
            return true;
        }

        // --- LOAN ACTIONS ---
        if (customId.startsWith('btn_approve_loan:') || customId.startsWith('btn_modify_loan:') || customId.startsWith('modal_modify_loan:') || customId.startsWith('btn_reject_loan:') || customId.startsWith('modal_reject_loan:')) {
            return await this.handleLoanAction(interaction, client, supabase);
        }

        return false;
    },

    // --- HELPER METHODS ---

    async handleRatingSubmit(interaction, client, supabase) {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

        const rating = parseInt(interaction.fields.getTextInputValue('rating_stars'));
        const comments = interaction.fields.getTextInputValue('rating_comments') || 'Sin comentarios';

        if (isNaN(rating) || rating < 1 || rating > 5) {
            return interaction.editReply('❌ Por favor ingresa un número válido entre 1 y 5.');
        }

        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).single();
        if (!ticket) return interaction.editReply('❌ No se encontró la información del ticket.');

        // Update Metadata with rating
        const metadata = ticket.metadata || {};
        metadata.rating = rating;
        metadata.comments = comments;
        metadata.rated_at = new Date().toISOString();

        await supabase.from('tickets').update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
            metadata
        }).eq('channel_id', interaction.channel.id);

        // Generate Transcript
        const TranscriptService = require('../services/TranscriptService');
        const AIService = require('../services/AIService'); // Load AI Service

        let attachment;
        let transcriptText = ''; // To capture text for AI

        try {
            // We need a way to get text from TranscriptService or fetch messages separately
            // For now, TranscriptService.generate returns attachment. 
            // We might need to fetch messages again or modify TranscriptService. 
            // Let's assume we fetch messages quickly for AI.
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            transcriptText = Array.from(messages.values()).reverse().map(m => `${m.author.username}: ${m.content}`).join('\n');

            attachment = await TranscriptService.generate(interaction.channel, {
                ...ticket,
                metadata
            });

            // Trigger AI Learning (Fire and Forget)
            const ai = new AIService(supabase);
            ai.learnFromTicket(ticket, transcriptText).catch(e => logger.error('AI Learn Error:', e));

        } catch (e) {
            logger.error('Error generating transcript:', e);
        }

        // Log to Transcript Channel
        const logsChannelId = TICKET_CONFIG.LOGS.TRANSCRIPTS;
        const logsChannel = client.channels.cache.get(logsChannelId);

        if (logsChannel && attachment) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📑 Ticket Cerrado')
                .addFields(
                    { name: 'Ticket', value: ticket.ticket_type || 'General', inline: true },
                    { name: 'Usuario', value: `<@${ticket.user_id}>`, inline: true },
                    { name: 'Calificación', value: `${'⭐'.repeat(rating)} (${rating}/5)`, inline: true },
                    { name: 'Comentarios', value: comments }
                )
                .setColor(0x3498DB)
                .setTimestamp();

            await logsChannel.send({ embeds: [logEmbed], files: [attachment] });
        }

        // Send Feedback Logic
        if (rating >= 1) {
            const feedbackChannelId = TICKET_CONFIG.LOGS.FEEDBACK;
            const feedbackChannel = client.channels.cache.get(feedbackChannelId);
            if (feedbackChannel) {
                const stars = '⭐'.repeat(rating);
                await feedbackChannel.send(`📢 **Nuevo Feedback**\n👤 <@${ticket.user_id}>\n${stars}\n💬 "${comments}"`);
            }
        }

        await interaction.editReply('✅ Gracias por tu calificación. El ticket se eliminará en 5 segundos.');
        setTimeout(() => interaction.channel.delete().catch(() => { }), 5000);
    },

    async handleClaim(interaction, client, supabase) {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
        if (!isStaff) return interaction.reply({ content: '🚫 Solo Staff.', ephemeral: true });

        const { data: ticket } = await supabase.from('tickets').select('*').eq('channel_id', interaction.channel.id).maybeSingle();
        if (!ticket) return interaction.reply({ content: '❌ Ticket no encontrado.', ephemeral: true });

        if (ticket.claimed_by_id === interaction.user.id) {
            await supabase.from('tickets').update({ claimed_by_id: null }).eq('channel_id', interaction.channel.id);
            await interaction.channel.permissionOverwrites.delete(interaction.user.id);
            await interaction.reply(`👐 Ticket Liberado.`);
        } else if (ticket.claimed_by_id) {
            return interaction.reply({ content: '⚠️ Ya reclamado.', ephemeral: true });
        } else {
            await supabase.from('tickets').update({ claimed_by_id: interaction.user.id }).eq('channel_id', interaction.channel.id);
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✋ Atendido por ${interaction.user}`).setColor(0x2ECC71)] });
        }
    },

    async handleCloseAsk(interaction, client, supabase) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_close_ticket_confirm').setLabel('Confirmar').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_cancel_close').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ content: '¿Cerrar ticket?', components: [row] });
    },

    async handleCloseConfirm(interaction, client, supabase) {
        await interaction.message.delete().catch(() => { });
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const embed = new EmbedBuilder()
            .setTitle('🔒 Finalizado')
            .setDescription('Califica la atención:')
            .setColor(0xFEE75C);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_rating_modal').setLabel('Calificar').setStyle(ButtonStyle.Primary).setEmoji('✍️'),
            new ButtonBuilder().setCustomId('feedback_s').setLabel('Omitir').setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
    },

    async handleLoanAction(interaction, client, supabase) {
        const { customId } = interaction;
        const BANKER_ROLES = [TICKET_CONFIG.ROLES.BANKER, TICKET_CONFIG.ROLES.STAFF_ADMIN];
        const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // --- APPROVE ---
        if (customId.startsWith('btn_approve_loan:')) {
            if (!isBanker) return interaction.reply({ content: '❌ Solo banqueros pueden aprobar préstamos.', ephemeral: true });

            await interaction.deferReply();
            const loanId = parseInt(customId.split(':')[1]);
            const { data: loan } = await supabase.from('loans').select('*').eq('id', loanId).eq('status', 'pending').single();

            if (!loan) return interaction.editReply('❌ Préstamo no encontrado o ya procesado.');

            await supabase.from('loans').update({
                status: 'active',
                approved_by: interaction.user.id,
                approved_at: new Date().toISOString()
            }).eq('id', loanId);

            // Deposit Money
            try {
                const UnbelievaBoatService = require('../services/UnbelievaBoatService');
                const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
                await ubService.addMoney(interaction.guildId, loan.discord_user_id, loan.loan_amount, `Préstamo #${loanId} aprobado`, 'cash');
            } catch (e) {
                logger.error('Error depositing loan money:', e);
            }

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x00FF00)
                .setFooter({ text: `✅ Aprobado por ${interaction.user.tag}` });

            await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

            try {
                const user = await client.users.fetch(loan.discord_user_id);
                await user.send(`✅ **Préstamo Aprobado**\n\nTu solicitud #${loanId} por $${loan.loan_amount.toLocaleString()} ha sido aprobada.\nEl dinero ha sido depositado.`);
            } catch (e) { }

            return interaction.editReply(`✅ Préstamo #${loanId} aprobado.`);
        }

        // --- MODIFY BUTTON (Show Modal) ---
        if (customId.startsWith('btn_modify_loan:')) {
            if (!isBanker) return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });
            const loanId = parseInt(customId.split(':')[1]);
            const { data: currentLoan } = await supabase.from('loans').select('*').eq('id', loanId).single();

            const modal = new ModalBuilder().setCustomId(`modal_modify_loan:${loanId}`).setTitle('Modificar Préstamo');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_monto').setLabel('Nuevo Monto').setStyle(TextInputStyle.Short).setValue(String(currentLoan.loan_amount))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_plazo').setLabel('Nuevo Plazo').setStyle(TextInputStyle.Short).setValue(String(currentLoan.term_months))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('modification_reason').setLabel('Razón').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        // --- SUBMIT MODIFICATION ---
        if (customId.startsWith('modal_modify_loan:')) {
            await interaction.deferReply();
            const loanId = parseInt(customId.split(':')[1]);
            const newMonto = parseInt(interaction.fields.getTextInputValue('new_monto').replace(/[^0-9]/g, ''));
            const newPlazo = parseInt(interaction.fields.getTextInputValue('new_plazo'));
            const reason = interaction.fields.getTextInputValue('modification_reason');

            // Generic calc
            const interestRate = 5.00;
            const monthlyInterestRate = (interestRate / 100) / 12;
            const monthlyPayment = Math.ceil((newMonto * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, newPlazo)) / (Math.pow(1 + monthlyInterestRate, newPlazo) - 1));
            const totalToPay = monthlyPayment * newPlazo;

            const { data: original } = await supabase.from('loans').select('*').eq('id', loanId).single();

            await supabase.from('loans').update({
                loan_amount: newMonto,
                term_months: newPlazo,
                monthly_payment: monthlyPayment,
                total_to_pay: totalToPay,
                modification_reason: reason,
                modified_by: interaction.user.id
            }).eq('id', loanId);

            const modifiedEmbed = new EmbedBuilder() // Simplified for brevity
                .setTitle(`💰 Préstamo #${loanId} [MODIFICADO]`)
                .setDescription(`**De:** $${original.loan_amount} -> **$${newMonto}**\n**Razón:** ${reason}`)
                .setColor(0xFFA500);

            // Re-render buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`btn_approve_loan:${loanId}`).setLabel('✅ Aprobar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`btn_reject_loan:${loanId}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger)
            );

            await interaction.message.edit({ embeds: [modifiedEmbed], components: [row] });
            return interaction.editReply('✅ Préstamo modificado.');
        }

        // --- REJECT BUTTON ---
        if (customId.startsWith('btn_reject_loan:')) {
            if (!isBanker) return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });
            const loanId = parseInt(customId.split(':')[1]);
            const modal = new ModalBuilder().setCustomId(`modal_reject_loan:${loanId}`).setTitle('Rechazar Préstamo');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rejection_reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return interaction.showModal(modal);
        }

        // --- SUBMIT REJECTION ---
        if (customId.startsWith('modal_reject_loan:')) {
            await interaction.deferReply();
            const loanId = parseInt(customId.split(':')[1]);
            const reason = interaction.fields.getTextInputValue('rejection_reason');

            await supabase.from('loans').update({
                status: 'rejected',
                rejection_reason: reason,
                rejected_by: interaction.user.id,
                rejected_at: new Date().toISOString()
            }).eq('id', loanId);

            const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xFF0000).setFooter({ text: '❌ Rechazado' });
            await interaction.message.edit({ embeds: [rejectedEmbed], components: [] });

            return interaction.editReply('❌ Préstamo rechazado. Cerrando ticket en breve...');
        }

        // --- SAVINGS APPROVAL ---
        if (customId.startsWith('btn_approve_savings:') || customId.startsWith('btn_bank_approve_savings_')) {
            // Normalize ID
            const savingsId = parseInt(customId.split('_').pop().replace(':', ''));

            if (!isBanker) return interaction.reply({ content: '❌ Solo banqueros.', ephemeral: true });
            await interaction.deferReply({ ephemeral: true });

            const { data: acc, error: accError } = await supabase.from('savings_accounts').select('*').eq('id', savingsId).single();
            if (accError || !acc || acc.status !== 'pending') {
                return interaction.editReply('❌ Solicitud no válida o ya procesada.');
            }

            // Check User Balance
            const UnbelievaBoatService = require('../services/UnbelievaBoatService');
            const ub = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
            const balanceResult = await ub.getBalance(interaction.guildId, acc.discord_user_id);

            if (!balanceResult.success) {
                return interaction.editReply(`❌ Error al consultar balance: ${balanceResult.error}`);
            }

            if (balanceResult.balance.cash < acc.initial_deposit) {
                return interaction.editReply('❌ El usuario no tiene fondos suficientes para el depósito inicial.');
            }

            // Deduct and Activate
            const removeMoneyResult = await ub.removeMoney(interaction.guildId, acc.discord_user_id, acc.initial_deposit, `Apertura Ahorro ${acc.account_number}`, 'cash');
            if (!removeMoneyResult.success) {
                return interaction.editReply(`❌ Error al deducir depósito: ${removeMoneyResult.error}`);
            }

            const { error: updateError } = await supabase.from('savings_accounts').update({ status: 'active', current_balance: acc.initial_deposit, opened_by: interaction.user.id }).eq('id', savingsId);
            if (updateError) {
                return interaction.editReply('❌ Error DB al activar cuenta.');
            }

            // Transaction log
            await supabase.from('savings_transactions').insert({ account_id: savingsId, transaction_type: 'deposit', amount: acc.initial_deposit, balance_after: acc.initial_deposit, executed_by: interaction.user.id });

            // Update UI
            // Try to find the message components and remove them
            try {
                await interaction.message.edit({ components: [] });
            } catch (e) { }

            await interaction.editReply(`✅ **Cuenta de Ahorro Activada**\nDepósito inicial de $${acc.initial_deposit.toLocaleString()} procesado.`);
            return true;
        }

        return true;
    }
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transferir')
        .setDescription('🔄 Transfiere TODO de un usuario a otro (dinero, roles, empresas, DNI, etc.)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('origen').setDescription('Usuario desde el cual se transferirán los datos').setRequired(true))
        .addUserOption(option => option.setName('destino').setDescription('Usuario que recibirá todos los datos').setRequired(true))
        .addStringOption(option => option.setName('razon').setDescription('Motivo de la transferencia').setRequired(true)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        const sourceUser = interaction.options.getUser('origen');
        const destUser = interaction.options.getUser('destino');
        const razon = interaction.options.getString('razon');

        // Validation
        if (sourceUser.id === destUser.id) {
            return interaction.editReply('❌ El usuario origen y destino no pueden ser el mismo.');
        }

        if (sourceUser.bot || destUser.bot) {
            return interaction.editReply('❌ No puedes transferir datos de/hacia bots.');
        }

        // Fetch members
        const sourceMember = await interaction.guild.members.fetch(sourceUser.id).catch(() => null);
        const destMember = await interaction.guild.members.fetch(destUser.id).catch(() => null);

        if (!sourceMember) {
            return interaction.editReply('❌ El usuario origen no está en el servidor.');
        }

        if (!destMember) {
            return interaction.editReply('❌ El usuario destino no está en el servidor.');
        }

        // Get preliminary data for confirmation
        let sourceBalance = { cash: 0, bank: 0 };

        // Try to get balance from UnbelievaBoat
        if (process.env.UNBELIEVABOAT_TOKEN) {
            try {
                const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);
                const ubBalance = await ubService.getUserBalance(interaction.guildId, sourceUser.id);
                if (ubBalance) {
                    sourceBalance.cash = ubBalance.cash || 0;
                    sourceBalance.bank = ubBalance.bank || 0;
                }
            } catch (e) {
                console.error('UB Balance Fetch Failed:', e);
            }
        }

        // Fallback to Supabase
        if (sourceBalance.cash === 0 && sourceBalance.bank === 0) {
            const { data: balance } = await supabase
                .from('user_balances')
                .select('cash, bank')
                .eq('guild_id', interaction.guildId)
                .eq('user_id', sourceUser.id)
                .maybeSingle();
            if (balance) {
                sourceBalance.cash = balance.cash || 0;
                sourceBalance.bank = balance.bank || 0;
            }
        }

        // Count roles to transfer (ALL roles, no protected ones)
        const rolesToTransfer = sourceMember.roles.cache.filter(role =>
            !role.managed && role.id !== interaction.guildId
        );

        // Get companies count
        const { data: companies } = await supabase
            .from('companies')
            .select('id, name')
            .contains('owner_ids', [sourceUser.id]);

        // Create confirmation embed
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ TRANSFERENCIA TOTAL DE USUARIO')
            .setColor('#FF6600')
            .setDescription(
                `Estás a punto de transferir **ABSOLUTAMENTE TODO** de **${sourceUser.tag}** a **${destUser.tag}**.\n\n` +
                `Esta acción es **IRREVERSIBLE** y realizará:\n\n` +
                `✅ Transferir dinero (cash + banco)\n` +
                `✅ Transferir **TODOS** los roles (incluyendo staff)\n` +
                `✅ Transferir DNI y ciudadanía\n` +
                `✅ Transferir tarjetas de crédito/débito\n` +
                `✅ Transferir propiedad de empresas\n` +
                `✅ Transferir compras de tienda\n` +
                `✅ Transferir sanciones e historial\n` +
                `✅ Transferir préstamos, casino chips, etc.\n\n` +
                `❌ **EL USUARIO ORIGEN SERÁ KICKEADO** del servidor\n\n` +
                `**Razón:** ${razon}`
            )
            .addFields(
                { name: '💰 Dinero a Transferir', value: `$${(sourceBalance.cash + sourceBalance.bank).toLocaleString()}`, inline: true },
                { name: '🎭 Roles a Transferir', value: `${rolesToTransfer.size}`, inline: true },
                { name: '🏢 Empresas', value: `${companies?.length || 0}`, inline: true }
            )
            .setFooter({ text: '⚠️ Confirma esta acción con el botón. Se te pedirá una contraseña.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`transfer_confirm_${sourceUser.id}_${destUser.id}`)
                    .setLabel('✅ CONFIRMAR TRANSFERENCIA')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('transfer_cancel')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

        // Wait for button confirmation
        const filter = i => i.user.id === interaction.user.id;
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'transfer_cancel') {
                await i.update({ content: '❌ Transferencia cancelada.', embeds: [], components: [] });
                collector.stop();
                return;
            }

            if (i.customId === `transfer_confirm_${sourceUser.id}_${destUser.id}`) {
                // Show password modal
                const modal = new ModalBuilder()
                    .setCustomId(`transfer_password_${sourceUser.id}_${destUser.id}`)
                    .setTitle('🔐 Contraseña de Seguridad');

                const passwordInput = new TextInputBuilder()
                    .setCustomId('password')
                    .setLabel('Ingresa la contraseña de transferencia')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Contraseña...')
                    .setRequired(true)
                    .setMaxLength(50);

                const firstActionRow = new ActionRowBuilder().addComponents(passwordInput);
                modal.addComponents(firstActionRow);

                await i.showModal(modal);

                // Wait for modal submission
                const modalFilter = modalInteraction =>
                    modalInteraction.customId === `transfer_password_${sourceUser.id}_${destUser.id}` &&
                    modalInteraction.user.id === interaction.user.id;

                try {
                    const modalSubmit = await i.awaitModalSubmit({ filter: modalFilter, time: 120000 });
                    const password = modalSubmit.fields.getTextInputValue('password');

                    // Validate password
                    if (password !== 'VONSSYBMONO') {
                        await modalSubmit.reply({
                            content: '❌ Contraseña incorrecta. Transferencia cancelada.',
                            ephemeral: true
                        });
                        await interaction.editReply({ content: '❌ Transferencia cancelada por contraseña incorrecta.', embeds: [], components: [] });
                        collector.stop();
                        return;
                    }

                    // Password correct - proceed with transfer
                    await modalSubmit.reply({ content: '⏳ Contraseña correcta. Iniciando transferencia completa...', ephemeral: true });
                    await interaction.editReply({ content: '⏳ **INICIANDO TRANSFERENCIA TOTAL...**', embeds: [], components: [] });

                    try {
                        // Execute transfer
                        await executeTransfer(
                            interaction,
                            client,
                            supabase,
                            sourceUser,
                            destUser,
                            sourceMember,
                            destMember,
                            razon,
                            sourceBalance,
                            rolesToTransfer,
                            companies
                        );

                    } catch (error) {
                        console.error('[TRANSFERIR] Error:', error);
                        await interaction.editReply({ content: `❌ Error crítico durante la transferencia: ${error.message}`, embeds: [], components: [] });
                    }

                } catch (error) {
                    console.error('[TRANSFERIR] Modal timeout or error:', error);
                    await interaction.editReply({ content: '❌ Tiempo de espera agotado. Transferencia cancelada.', embeds: [], components: [] });
                }

                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '❌ Tiempo de espera agotado. Transferencia cancelada.', embeds: [], components: [] }).catch(() => { });
            }
        });
    }
};

async function executeTransfer(interaction, client, supabase, sourceUser, destUser, sourceMember, destMember, razon, sourceBalance, rolesToTransfer, companies) {
    const transferLog = {
        money: 0,
        roles: 0,
        companies: 0,
        cards: 0,
        purchases: 0,
        sanctions: 0
    };

    // 1. TRANSFER MONEY
    await interaction.editReply({ content: '⏳ [1/8] Transfiriendo dinero...' });

    if (process.env.UNBELIEVABOAT_TOKEN) {
        try {
            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

            // Get destination current balance
            const destBalance = await ubService.getUserBalance(interaction.guildId, destUser.id) || { cash: 0, bank: 0 };

            // Add source money to destination
            await ubService.setBalance(interaction.guildId, destUser.id, {
                cash: (destBalance.cash || 0) + sourceBalance.cash,
                bank: (destBalance.bank || 0) + sourceBalance.bank
            }, `Transferencia de ${sourceUser.tag}: ${razon}`);

            // Reset source balance to 0
            await ubService.setBalance(interaction.guildId, sourceUser.id, {
                cash: 0,
                bank: 0
            }, `Transferencia completa a ${destUser.tag}: ${razon}`);

            transferLog.money = sourceBalance.cash + sourceBalance.bank;
        } catch (e) {
            console.error('[TRANSFERIR] Money transfer error:', e);
        }
    }

    // 2. TRANSFER DNI
    await interaction.editReply({ content: '⏳ [2/8] Transfiriendo DNI y ciudadanía...' });

    await supabase
        .from('citizen_dni')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id);

    await supabase
        .from('citizens')
        .update({ discord_id: destUser.id })
        .eq('discord_id', sourceUser.id);

    // 3. TRANSFER CARDS
    await interaction.editReply({ content: '⏳ [3/8] Transfiriendo tarjetas...' });

    const { data: creditCards } = await supabase
        .from('credit_cards')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id)
        .select();

    const { data: debitCards } = await supabase
        .from('debit_cards')
        .update({ discord_user_id: destUser.id })
        .eq('discord_user_id', sourceUser.id)
        .select();

    transferLog.cards = (creditCards?.length || 0) + (debitCards?.length || 0);

    // 4. TRANSFER COMPANIES
    await interaction.editReply({ content: '⏳ [4/8] Transfiriendo empresas...' });

    if (companies && companies.length > 0) {
        for (const company of companies) {
            const { data: currentComp } = await supabase
                .from('companies')
                .select('owner_ids')
                .eq('id', company.id)
                .maybeSingle();

            if (currentComp) {
                const newOwners = currentComp.owner_ids.map(id =>
                    id === sourceUser.id ? destUser.id : id
                );

                await supabase
                    .from('companies')
                    .update({ owner_ids: newOwners })
                    .eq('id', company.id);
            }
        }
        transferLog.companies = companies.length;
    }

    // 5. TRANSFER PURCHASES
    await interaction.editReply({ content: '⏳ [5/8] Transfiriendo compras de tienda...' });

    const { data: purchases } = await supabase
        .from('user_purchases')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id)
        .select();

    transferLog.purchases = purchases?.length || 0;

    // 6. TRANSFER SANCTIONS & HISTORY
    await interaction.editReply({ content: '⏳ [6/8] Transfiriendo sanciones e historial...' });

    await supabase
        .from('sanctions')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id);

    const { data: warnings } = await supabase
        .from('warnings')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id)
        .select();

    await supabase
        .from('role_cooldowns')
        .update({ user_id: destUser.id })
        .eq('user_id', sourceUser.id);

    transferLog.sanctions = warnings?.length || 0;

    // 7. TRANSFER ADDITIONAL DATA
    await interaction.editReply({ content: '⏳ [7/8] Transfiriendo datos adicionales (préstamos, casino, etc.)...' });

    // Loans
    await supabase.from('loans').update({ user_id: destUser.id }).eq('user_id', sourceUser.id);

    // Savings
    await supabase.from('savings_accounts').update({ user_id: destUser.id }).eq('user_id', sourceUser.id);

    // Casino chips
    await supabase.from('casino_chips').update({ user_id: destUser.id }).eq('user_id', sourceUser.id);

    // 8. TRANSFER ROLES
    await interaction.editReply({ content: '⏳ [8/8] Transfiriendo roles...' });

    for (const role of rolesToTransfer.values()) {
        try {
            await destMember.roles.add(role);
            await sourceMember.roles.remove(role);
            transferLog.roles++;
        } catch (e) {
            console.error(`Failed to transfer role ${role.name}:`, e.message);
        }
    }

    // 9. LOG TO AUDIT
    const auditService = new AuditService(supabase, client);
    await auditService.logTransaction({
        guildId: interaction.guildId,
        userId: sourceUser.id,
        transactionType: 'user_transfer',
        amount: transferLog.money,
        currencyType: 'combined',
        reason: `Transferencia completa a ${destUser.tag}: ${razon}`,
        metadata: {
            transferred_by: interaction.user.id,
            destination_user: destUser.id,
            roles_transferred: transferLog.roles,
            companies_transferred: transferLog.companies,
            cards_transferred: transferLog.cards,
            purchases_transferred: transferLog.purchases
        },
        createdBy: interaction.user.id,
        createdByTag: interaction.user.tag,
        commandName: 'transferir',
        interactionId: interaction.id,
        canRollback: false
    });

    // 10. CREATE RESULT EMBED
    const resultEmbed = new EmbedBuilder()
        .setTitle('✅ TRANSFERENCIA COMPLETA EXITOSA')
        .setColor('#00FF00')
        .setDescription(`Se ha transferido exitosamente todos los datos de **${sourceUser.tag}** a **${destUser.tag}**.`)
        .addFields(
            { name: '📤 Usuario Origen', value: `<@${sourceUser.id}>`, inline: true },
            { name: '📥 Usuario Destino', value: `<@${destUser.id}>`, inline: true },
            { name: '👤 Ejecutado por', value: `<@${interaction.user.id}>`, inline: true },
            { name: '💰 Dinero Transferido', value: `$${transferLog.money.toLocaleString()}`, inline: true },
            { name: '🎭 Roles Transferidos', value: `${transferLog.roles}`, inline: true },
            { name: '🏢 Empresas Transferidas', value: `${transferLog.companies}`, inline: true },
            { name: '💳 Tarjetas Transferidas', value: `${transferLog.cards}`, inline: true },
            { name: '🛒 Compras Transferidas', value: `${transferLog.purchases}`, inline: true },
            { name: '⚠️ Sanciones Transferidas', value: `${transferLog.sanctions}`, inline: true },
            { name: '📝 Razón', value: razon, inline: false }
        )
        .setFooter({ text: `Nación MX | Sistema de Transferencia` })
        .setTimestamp();

    await interaction.editReply({ content: '', embeds: [resultEmbed], components: [] });

    // 11. LOGGING CHANNELS
    const CHANNELS = {
        PUBLIC: '1412957234824089732',
        PRIVATE_LOG: '1457576874602659921'
    };

    // Public log
    try {
        const publicChan = await client.channels.fetch(CHANNELS.PUBLIC);
        if (publicChan) await publicChan.send({ embeds: [resultEmbed] });
    } catch (e) {
        console.error('[TRANSFERIR] Failed public log:', e);
    }

    // Private security log
    try {
        const privateChan = await client.channels.fetch(CHANNELS.PRIVATE_LOG);
        if (privateChan) {
            const privateEmbed = new EmbedBuilder()
                .setTitle('🔐 TRANSFERENCIA TOTAL DE USUARIO - LOG DETALLADO')
                .setColor('#FFFF00')
                .addFields(
                    { name: 'Ejecutado por', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                    { name: 'Usuario Origen', value: `<@${sourceUser.id}> (${sourceUser.tag})`, inline: true },
                    { name: 'Usuario Destino', value: `<@${destUser.id}> (${destUser.tag})`, inline: true },
                    { name: 'Razón', value: razon, inline: false },
                    {
                        name: 'Datos Transferidos', value:
                            `💰 Dinero: $${transferLog.money.toLocaleString()}\n` +
                            `🎭 Roles: ${transferLog.roles}\n` +
                            `🏢 Empresas: ${transferLog.companies}\n` +
                            `💳 Tarjetas: ${transferLog.cards}\n` +
                            `🛒 Compras: ${transferLog.purchases}\n` +
                            `⚠️ Sanciones: ${transferLog.sanctions}`,
                        inline: false
                    }
                )
                .setTimestamp();
            await privateChan.send({ embeds: [privateEmbed] });
        }
    } catch (e) {
        console.error('[TRANSFERIR] Failed private log:', e);
    }

    // 12. SEND DM TO SOURCE USER
    try {
        await sourceUser.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🚨 TRANSFERENCIA COMPLETA')
                    .setDescription(`Todos tus datos han sido transferidos a **${destUser.tag}**.`)
                    .addFields(
                        { name: 'Razón', value: razon },
                        { name: 'Transferido por', value: interaction.user.tag }
                    )
                    .setColor('#FF0000')
                    .setTimestamp()
            ]
        });
    } catch (e) {
        console.log('[TRANSFERIR] Could not DM source user:', e.message);
    }

    // 13. KICK SOURCE USER
    await interaction.editReply({ content: '⏳ Kickeando usuario origen del servidor...' });

    try {
        await sourceMember.kick(`Transferencia completa a ${destUser.tag}: ${razon}`);
        await interaction.editReply({ content: `✅ **TRANSFERENCIA COMPLETA Y USUARIO KICKEADO.**`, embeds: [resultEmbed], components: [] });
    } catch (e) {
        console.error('[TRANSFERIR] Failed to kick user:', e);
        await interaction.editReply({ content: `⚠️ **TRANSFERENCIA COMPLETA, pero no se pudo kickear al usuario.** Error: ${e.message}`, embeds: [resultEmbed], components: [] });
    }
}

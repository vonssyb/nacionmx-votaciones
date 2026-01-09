const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const AuditService = require('../../services/AuditService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ck')
        .setDescription('💀 Sistema de Character Kill - Reseteo completo de personaje')
        .addSubcommand(subcommand =>
            subcommand
                .setName('aplicar')
                .setDescription('Aplicar CK a un usuario (reseteo total)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a resetear').setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de CK')
                        .setRequired(true)
                        .addChoices(
                            { name: 'CK Normal', value: 'CK Normal' },
                            { name: 'CK Administrativo', value: 'CK Administrativo' },
                            { name: 'Auto CK', value: 'Auto CK' }
                        ))
                .addStringOption(option => option.setName('razon').setDescription('Razón del CK').setRequired(true))
                .addAttachmentOption(option => option.setName('evidencia').setDescription('Screenshot de evidencia').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('revertir')
                .setDescription('♻️ Revertir un CK (Solo Encargado)')
                .addUserOption(option => option.setName('usuario').setDescription('Usuario a restaurar').setRequired(true))
                .addStringOption(option => option.setName('razon').setDescription('Motivo de la reversión').setRequired(true))),

    async execute(interaction, client, supabase) {

        const subcommand = interaction.options.getSubcommand();
        const rKRole = '1450938106395234526'; // Encargado CK

        // --- REVERTIR LOGIC ---
        if (subcommand === 'revertir') {
            // await interaction.deferReply();

            // Check Permissions (Strict)
            if (!interaction.member.roles.cache.has(rKRole) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply('❌ Solo el Encargado de CK puede revertir una muerte.');
            }

            const targetUser = interaction.options.getUser('usuario');

            try {
                // 1. Find last CK record with backup
                const { data: ckRecord, error } = await supabase
                    .from('ck_registry')
                    .select('*')
                    .eq('user_id', targetUser.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error || !ckRecord) {
                    return interaction.editReply('❌ No se encontró un registro de CK para este usuario o no tiene backup.');
                }

                const backup = ckRecord.backup_data;
                const rolesToRestore = ckRecord.roles_removed || [];

                if (!backup) {
                    return interaction.editReply('⚠️ El registro de CK existe pero es ANTIGUO y no tiene datos de respaldo (DNI/Empresas). Solo se puede devolver roles y dinero manualmente.');
                }

                await interaction.editReply(`⏳ **Iniciando Resurrección de ${targetUser.tag}...**\nRecuperando DNI, Bienes y Roles.`);

                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!member) return interaction.editReply('❌ El usuario no está en el servidor.');

                // A. Restore Money
                await supabase.from('user_balances').upsert({
                    guild_id: interaction.guildId,
                    user_id: targetUser.id,
                    cash: ckRecord.previous_cash,
                    bank: ckRecord.previous_bank
                }, { onConflict: 'guild_id,user_id' });

                // B. Restore DNI
                if (backup.dni) {
                    await supabase.from('citizen_dni').upsert(backup.dni);
                }

                // C. Restore Credit Cards
                if (backup.cards && backup.cards.length > 0) {
                    const cardIds = backup.cards.map(c => c.id);
                    await supabase.from('credit_cards').update({ active: true }).in('id', cardIds);
                }

                // D. Restore Companies (Expropriation Reversal)
                if (backup.companies && backup.companies.length > 0) {
                    for (const comp of backup.companies) {
                        const { data: currentComp } = await supabase.from('companies').select('owner_ids, status').eq('id', comp.id).single();

                        if (currentComp) {
                            let newOwners = currentComp.owner_ids || [];
                            if (!newOwners.includes(targetUser.id)) {
                                newOwners.push(targetUser.id);
                            }
                            const newStatus = currentComp.status === 'government_seized' ? 'active' : currentComp.status;
                            await supabase.from('companies').update({
                                owner_ids: newOwners,
                                status: newStatus,
                                name: comp.name
                            }).eq('id', comp.id);
                        }
                    }
                }

                // E. Restore Roles
                let rolesRestoredCount = 0;
                for (const roleName of rolesToRestore) {
                    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
                    if (role) {
                        try {
                            await member.roles.add(role);
                            rolesRestoredCount++;
                        } catch (e) { console.error(`Failed to give role ${roleName}`); }
                    }
                }

                // F. Notify
                const successEmbed = new EmbedBuilder()
                    .setTitle('♻️ CK REVERTIDO - RESURRECCIÓN')
                    .setColor('#00FF00')
                    .setDescription(`Se ha restaurado exitosamente a **${targetUser.tag}**.`)
                    .addFields(
                        { name: '💰 Dinero Restaurado', value: `$${(Number(ckRecord.previous_cash) + Number(ckRecord.previous_bank)).toLocaleString()}`, inline: true },
                        { name: '🪪 DNI', value: backup.dni ? 'Restaurado' : 'No encontrado', inline: true },
                        { name: '🎭 Roles', value: `${rolesRestoredCount} recuperados`, inline: true },
                        { name: '🏢 Empresas', value: backup.companies ? `${backup.companies.length} devueltas` : 'Ninguna', inline: true }
                    )
                    .setFooter({ text: `Autorizado por: ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ content: '', embeds: [successEmbed] });

                // LOGGING CHANNELS
                const CHANNELS = {
                    PUBLIC: '1412957234824089732',
                    PRIVATE_LOG: '1457576874602659921',
                    EXPIRED_ITEMS: '1455691472362934475'
                };

                // A. Public Log
                try {
                    const publicChan = await client.channels.fetch(CHANNELS.PUBLIC);
                    if (publicChan) await publicChan.send({ embeds: [successEmbed] });
                } catch (e) { console.error('[CK Revert] Failed public log:', e); }

                // B. Private Log (Detailed)
                try {
                    const ch = await client.channels.fetch(CHANNELS.PRIVATE_LOG);
                    if (ch) await ch.send({
                        content: `⚠️ **REVERSIÓN DE CK EJECUTADA**`,
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#FFFF00')
                                .addFields(
                                    { name: 'Admin', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
                                    { name: 'Razón Reversión', value: interaction.options.getString('razon'), inline: false },
                                    { name: 'Datos Restaurados', value: `Dinero: $${(Number(ckRecord.previous_cash) + Number(ckRecord.previous_bank)).toLocaleString()}\nDNI: ${backup.dni ? 'Sí' : 'No'}\nRoles: ${rolesRestoredCount}`, inline: false }
                                )
                                .setTimestamp()
                        ]
                    });
                } catch (e) { console.error('[CK Revert] Failed private log:', e); }

                // C. Expired Items Log (Restoration Entry)
                try {
                    const expiredChan = await client.channels.fetch(CHANNELS.EXPIRED_ITEMS);
                    if (expiredChan) {
                        const restoreEmbed = new EmbedBuilder()
                            .setTitle('♻️ RESTAURACIÓN ADMIN: CK REVERTIDO')
                            .setColor('#00FFFF')
                            .setDescription(`Se ha revertido un CK, restaurando bienes y estado al usuario.`)
                            .addFields(
                                { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
                                { name: 'Admin Responsable', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Motivo', value: interaction.options.getString('razon'), inline: false }
                            )
                            .setTimestamp();
                        await expiredChan.send({ embeds: [restoreEmbed] });
                    }
                } catch (e) { console.error('[CK Revert] Failed expired log:', e); }

            } catch (err) {
                console.error('[CK Revert] Error:', err);
                await interaction.editReply('❌ Error crítico al revertir. Consulta los logs.');
            }
            return;
        }

        // --- APLICAR LOGIC (Original Flow) ---
        // await interaction.deferReply({});
        const ckTipo = interaction.options.getString('tipo');
        const razon = interaction.options.getString('razon');
        const evidencia = interaction.options.getAttachment('evidencia');

        // Protected roles (NOT removed during CK)
        const protectedRoles = [
            // USER PROVIDED PROTECTED ROLES
            '1458506735185825993', '1458506888407810252',
            '1458507178619965522', '1458507296958316751',
            '1458507711938564399', '1458507744725176501',
            '1458513516913758208', '1458515486722625648',
            // CRITICAL SYSTEM ROLES
            '1412882248411381872', '1412887079612059660', '1412887167654690908'
        ];

        // License roles to remove
        const licenseRoles = [
            '1413543909761614005', // Conducir
            '1413543907110682784', // Armas Cortas
            '1413541379803578431'  // Armas Largas
        ];

        // Confirmation with buttons
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ CONFIRMACIÓN DE ${ckTipo.toUpperCase()}`)
            .setColor('#FF0000')
            .setDescription(`Estás a punto de aplicar un **${ckTipo}** a **${targetUser.tag}**. Esta acción es **IRREVERSIBLE** y realizará:\n\n` +
                `- ❌ Quitar TODO el dinero (cash + banco)\n` +
                `- ❌ Eliminar tarjetas de crédito/débito\n` +
                `- ❌ Remover TODOS los roles (excepto ${protectedRoles.length} protegidos)\n` +
                `- ❌ Eliminar licencias y **Vehículos**\n` +
                `- ❌ Resetear DNI y **Roles Temporales**\n\n` +
                `**Razón:** ${razon}`)
            .setFooter({ text: 'Confirma esta acción usando los botones' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ck_confirm_${targetUser.id}`)
                    .setLabel('✅ CONFIRMAR CK')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ck_cancel')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

        // Wait for button confirmation
        const filter = i => i.user.id === interaction.user.id;
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            if (i.customId === 'ck_cancel') {
                await i.update({ content: '❌ CK cancelado.', embeds: [], components: [] });
                collector.stop();
                return;
            }

            if (i.customId === `ck_confirm_${targetUser.id}`) {
                await i.update({ content: '⏳ Aplicando CK...', embeds: [], components: [] });

                try {
                    const member = await interaction.guild.members.fetch(targetUser.id);
                    const removedRoles = [];

                    // 0. CHECK FOR ANTI-CK INSURANCE (Role: 1449950413993410651)
                    const ANTI_CK_ROLE = '1449950413993410651';
                    const hasInsurance = member.roles.cache.has(ANTI_CK_ROLE);

                    if (hasInsurance && ckTipo !== 'CK Administrativo') { // Admin CK bypasses insurance? Or asks? Let's assume Insurance saves from RP Death (Normal/Auto)
                        await i.update({ content: '🛡️ **¡SEGURO ANTI-CK ACTIVADO!** Verificando...', embeds: [], components: [] });

                        // Consume Insurance (Remove role & Update DB)
                        try {
                            // 1. Remove Role
                            await member.roles.remove(ANTI_CK_ROLE);

                            // 2a. Expire the DB purchase
                            if (purchase) {
                                await supabase
                                    .from('user_purchases')
                                    .update({ status: 'consumed', uses_remaining: 0, expiration_date: new Date().toISOString() })
                                    .eq('id', purchase.id);

                                // Remove the Role
                                if (member.roles.cache.has(ANTI_CK_ROLE)) {
                                    await member.roles.remove(ANTI_CK_ROLE).catch(e => console.error('Failed to remove Anti-CK role:', e));
                                }
                            }

                            // 3. Prepare Notification Data
                            const savedMessages = [
                                "tenía un chaleco antibalas de alta tecnología y sobrevivió milagrosamente.",
                                "fue atendido rápidamente por los paramédicos y lograron estabilizarlo.",
                                "tuvo una suerte increíble y las balas no tocaron órganos vitales.",
                                "fingió su muerte de manera magistral y escapó en el último segundo.",
                                "llevaba una placa de metal en el pecho que detuvo el impacto fatal.",
                                "fue rescatado por un equipo de extracción táctica justo a tiempo.",
                                "despertó en el hospital sin recordar nada, pero vivo."
                            ];
                            const randomMsg = savedMessages[Math.floor(Math.random() * savedMessages.length)];
                            const usageReason = "Uso en enfrentamiento / Situación de riesgo mortal";

                            // Embed for Interaction & Public
                            const savedEmbed = new EmbedBuilder()
                                .setTitle(`🛡️ VIDA SALVADA - ANTI CK`)
                                .setColor('#00FF00')
                                .setDescription(`El usuario **${targetUser.tag}** ha sobrevivido a un intento de CK.\n\n✅ **El CK ha sido CANCELADO.**\n📖 **Roleplay:** El usuario ${randomMsg}`)
                                .addFields(
                                    { name: '👤 Usuario', value: `<@${targetUser.id}>`, inline: true },
                                    { name: '🛡️ Item Usado', value: 'Seguro Anti-CK', inline: true },
                                    { name: '📉 Estado', value: 'Consumido (1/1)', inline: true }
                                )
                                .setFooter({ text: 'Nación MX | Sistema de Vida Extra' })
                                .setTimestamp();

                            // Update Interaction (Origin)
                            await i.editReply({ content: '', embeds: [savedEmbed] });

                            // LOGGING CHANNELS
                            const CHANNELS = {
                                PUBLIC: '1412957234824089732',
                                PRIVATE_LOG: '1457576874602659921',
                                EXPIRED_ITEMS: '1455691472362934475'
                            };

                            // A. Log to Public Channel
                            try {
                                const publicChan = await client.channels.fetch(CHANNELS.PUBLIC);
                                if (publicChan) await publicChan.send({ embeds: [savedEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK public:', e); }

                            // B. Log to ID Private Log (Security)
                            try {
                                const privateEmbed = new EmbedBuilder()
                                    .setTitle(`🛡️ ANTI-CK ACTIVADO`)
                                    .setColor('#FFFF00')
                                    .addFields(
                                        { name: 'Usuario', value: `<@${targetUser.id}> (${targetUser.id})`, inline: true },
                                        { name: 'Trigger', value: `Intento de CK por <@${interaction.user.id}>`, inline: true },
                                        { name: 'Razón Original CK', value: razon, inline: false },
                                        { name: 'Resultado', value: 'CK Cancelado - Item Consumido', inline: false }
                                    )
                                    .setTimestamp();
                                const privateChan = await client.channels.fetch(CHANNELS.PRIVATE_LOG);
                                if (privateChan) await privateChan.send({ embeds: [privateEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK private:', e); }

                            // C. Log to Expired Items (The specific request)
                            try {
                                const expiredEmbed = new EmbedBuilder()
                                    .setTitle('📉 ITEM CONSUMIDO: SEGURO ANTI-CK')
                                    .setColor('#FFA500')
                                    .setDescription(`El usuario **${targetUser.tag}** ha consumido su seguro de vida.`)
                                    .addFields(
                                        { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
                                        { name: 'Motivo de Consumo', value: usageReason, inline: false },
                                        { name: 'Fecha', value: new Date().toLocaleDateString('es-MX'), inline: true }
                                    )
                                    .setTimestamp();
                                const expiredChan = await client.channels.fetch(CHANNELS.EXPIRED_ITEMS);
                                if (expiredChan) await expiredChan.send({ embeds: [expiredEmbed] });
                            } catch (e) { console.error('Failed to log Anti-CK expired:', e); }

                            return; // STOP CK EXECUTION

                        } catch (err) {
                            console.error('Error consuming insurance:', err);
                            await i.editReply('❌ Error crítico procesando el seguro Anti-CK. Contacta a soporte.');
                            return;
                        }
                    }

                    // 1. CAPTURE BACKUP DATA (Snapshot before deletion)
                    const backupData = { dni: null, cards: [], companies: [] };

                    // Backup DNI
                    const { data: bDni } = await supabase.from('citizen_dni').select('*').eq('user_id', targetUser.id).maybeSingle();
                    backupData.dni = bDni;

                    // Backup Cards
                    const { data: bCards } = await supabase.from('credit_cards').select('*').eq('user_id', targetUser.id);
                    backupData.cards = bCards || [];

                    // 1b. Get current balances
                    const { data: balance } = await supabase
                        .from('user_balances')
                        .select('cash, bank')
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id)
                        .maybeSingle();

                    const previousCash = balance?.cash || 0;
                    const previousBank = balance?.bank || 0;

                    // 2. Reset all money

                    // 2. Reset Ecosystem (Money)
                    if (process.env.UNBELIEVABOAT_TOKEN) {
                        try {
                            const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
                            const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN);

                            if (previousCash > 0) {
                                await ubService.removeMoney(interaction.guildId, targetUser.id, previousCash, `CK: ${razon}`, 'cash');
                            }
                            if (previousBank > 0) {
                                await ubService.removeMoney(interaction.guildId, targetUser.id, previousBank, `CK: ${razon}`, 'bank');
                            }
                        } catch (ubError) {
                            console.error('[CK] Failed to reset UnbelievaBoat balance:', ubError);
                            // Non-blocking, continue CK
                        }
                    }

                    // 2a. HANDLE COMPANIES (Expropriation / Partner Removal)
                    const { data: companies } = await supabase
                        .from('companies')
                        .select('*')
                        .contains('owner_ids', [targetUser.id]);

                    if (companies && companies.length > 0) {
                        // Store companies state in backup before modification
                        backupData.companies = JSON.parse(JSON.stringify(companies));

                        for (const company of companies) {
                            const newOwners = company.owner_ids.filter(id => id !== targetUser.id);

                            if (newOwners.length > 0) {
                                // Still has partners -> Just remove user
                                await supabase
                                    .from('companies')
                                    .update({ owner_ids: newOwners })
                                    .eq('id', company.id);
                            } else {
                                // Sole owner -> SEIZE FOR GOVERNMENT
                                await supabase
                                    .from('companies')
                                    .update({
                                        owner_ids: [],
                                        status: 'government_seized',
                                        name: `${company.name} (Expropiada)`
                                    })
                                    .eq('id', company.id);
                            }
                        }
                    }

                    // 3. Deactivate all credit cards
                    await supabase
                        .from('credit_cards')
                        .update({ active: false })
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id);

                    // 4. Remove roles (except protected)
                    // Additional role to ALWAYS remove regardless
                    const forceRemoveRoles = ['1449942943648714902']; // Autock role

                    for (const [roleId, role] of member.roles.cache) {
                        const protectedNames = ['Civil Mexicano', 'Roles administrativos', 'Soporte', 'Staff', 'Booster', 'Server Booster'];
                        const shouldRemove = (!protectedRoles.includes(roleId)
                            && !protectedNames.includes(role.name)
                            && !role.managed
                            && roleId !== interaction.guildId)
                            || forceRemoveRoles.includes(roleId);

                        if (shouldRemove) {
                            try {
                                await member.roles.remove(roleId);
                                removedRoles.push(role.name); // Use name, not mention
                            } catch (e) {
                                console.log(`Could not remove role ${role.name}:`, e.message);
                            }
                        }
                    }

                    // 5. Reset DNI (optional - set to null or delete)
                    await supabase
                        .from('citizen_dni')
                        .delete()
                        .eq('guild_id', interaction.guildId)
                        .eq('user_id', targetUser.id);

                    // 6. Log to CK registry
                    await supabase
                        .from('ck_registry')
                        .insert({
                            guild_id: interaction.guildId,
                            user_id: targetUser.id,
                            applied_by: interaction.user.id,
                            reason: razon,
                            evidencia_url: evidencia.url,
                            previous_cash: Number(previousCash),
                            previous_bank: Number(previousBank),
                            roles_removed: removedRoles,
                            backup_data: backupData
                        });

                    // 7. Log to audit
                    const auditService = new AuditService(supabase, client);
                    await auditService.logTransaction({
                        guildId: interaction.guildId,
                        userId: targetUser.id,
                        transactionType: 'character_kill',
                        amount: -(previousCash + previousBank),
                        currencyType: 'combined',
                        reason: `CK aplicado: ${razon}`,
                        metadata: {
                            applied_by: interaction.user.id,
                            roles_removed: removedRoles.length,
                            evidencia: evidencia.url
                        },
                        createdBy: interaction.user.id,
                        createdByTag: interaction.user.tag,
                        commandName: 'ck',
                        interactionId: interaction.id,
                        canRollback: false
                    });

                    // 8. Create result embed
                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`💀 ${ckTipo.toUpperCase()}`)
                        .setColor('#8B0000')
                        .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                        .addFields(
                            { name: 'Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                            { name: 'Tipo de CK:', value: ckTipo, inline: true },
                            { name: 'Razón del CK:', value: razon, inline: false },
                            { name: 'Roles removidos:', value: removedRoles.length > 0 ? removedRoles.slice(0, 10).join(', ') + (removedRoles.length > 10 ? `... (+${removedRoles.length - 10} más)` : '') : 'Ninguno', inline: false }
                        )
                        .setImage(evidencia.url)
                        .setFooter({ text: `${new Date().toLocaleDateString('es-MX')}, ${new Date().toLocaleTimeString('es-MX')}` })
                        .setTimestamp();

                    await i.editReply({ content: '', embeds: [resultEmbed] });

                    // 9a. PUBLIC LOG (To Announcements)
                    const LOG_PUBLIC_ID = '1412957234824089732';
                    try {
                        const publicChannel = await client.channels.fetch(LOG_PUBLIC_ID);
                        if (publicChannel) await publicChannel.send({ embeds: [resultEmbed] });
                    } catch (e) { console.error('[CK] Error sending public log:', e); }

                    // 9b. PRIVATE LOG (Detailed Security)
                    const LOG_PRIVATE_ID = '1457576874602659921';
                    try {
                        const privateChannel = await client.channels.fetch(LOG_PRIVATE_ID);
                        if (privateChannel) {
                            // 9. Embed Calculations
                            const cardsList = backupData.cards.length > 0
                                ? backupData.cards.map(c => `💳 ${c.card_type.toUpperCase()} (...${c.card_number.slice(-4)})`).join('\n')
                                : 'Todas desactivadas';

                            const moneyFormatted = `Cash: $${Number(previousCash).toLocaleString()}\nBanco: $${Number(previousBank).toLocaleString()}\n**Total:** $${(Number(previousCash) + Number(previousBank)).toLocaleString()}`;

                            const detailedLogEmbed = new EmbedBuilder()
                                .setTitle(`💀 ${ckTipo.toUpperCase()} - LOG DETALLADO`)
                                .setColor('#8B0000')
                                .setThumbnail('https://cdn.discordapp.com/attachments/885232074083143741/1457553016743006363/25174-skull-lmfao.gif')
                                .addFields(
                                    { name: '👮 Aprobado por:', value: `<@${interaction.user.id}>`, inline: true },
                                    { name: '👤 Usuario afectado:', value: `<@${targetUser.id}>`, inline: true },
                                    { name: '📋 Tipo de CK:', value: ckTipo, inline: true },
                                    { name: '📝 Razón del CK:', value: razon, inline: false },
                                    { name: '💵 Dinero Removido', value: moneyFormatted, inline: true },
                                    { name: '🪪 Licencias Removidas', value: licenseRoles.length > 0 ? '🚗 Conducir\n🔫 Armas Cortas\n🎯 Armas Largas' : 'Ninguna', inline: true },
                                    { name: '💳 Tarjetas', value: cardsList, inline: true },
                                    { name: '🏷️ Roles Removidos', value: removedRoles.length > 0 ? removedRoles.slice(0, 15).join(', ') + (removedRoles.length > 15 ? `\n... (+${removedRoles.length - 15} más)` : '') : 'Ninguno', inline: false },
                                    { name: '🏢 Empresas', value: backupData.companies && backupData.companies.length > 0 ? backupData.companies.map(c => c.name).join(', ') : 'Ninguna', inline: false },
                                    { name: '💾 Backup', value: '✅ Guardado para Reversión', inline: true }
                                )
                                .setImage(evidencia.url)
                                .setFooter({ text: `CK Registry | ${new Date().toLocaleDateString('es-MX')}, ${new Date().toLocaleTimeString('es-MX')}` })
                                .setTimestamp();

                            await privateChannel.send({ embeds: [detailedLogEmbed] });
                        }
                    } catch (e) {
                        console.error('[CK] Error sending private log:', e);
                    }

                    // 10. Notify user via DM
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle(`💀 ${ckTipo} Aplicado`)
                            .setColor('#FF0000')
                            .setDescription(`Tu personaje en Nación MX ha sido reseteado completamente.`)
                            .addFields(
                                { name: 'Tipo de CK', value: ckTipo, inline: false },
                                { name: 'Razón', value: razon, inline: false },
                                { name: '¿Qué perdiste?', value: 'Dinero, roles, licencias, tarjetas, y DNI', inline: false },
                                { name: '⚠️ Importante', value: 'Debes crear un nuevo DNI usando `/dni crear`', inline: false }
                            )
                            .setFooter({ text: 'Puedes volver a empezar desde cero' })
                            .setTimestamp();

                        await targetUser.send({ embeds: [dmEmbed] });
                    } catch (e) {
                        console.log('Could not DM user:', e.message);
                    }

                } catch (error) {
                    console.error('[CK] Error applying CK:', error);
                    await i.editReply('❌ Error al aplicar el CK. Revisa los logs.');
                }

                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ content: '❌ Tiempo agotado. CK cancelado.', embeds: [], components: [] });
            }
        });
    }
};
